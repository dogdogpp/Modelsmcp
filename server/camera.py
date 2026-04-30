"""Camera manager with real-time YOLO person detection."""

import base64
import io
import threading
import time
import asyncio
from dataclasses import dataclass, field
from typing import Any

import cv2
import numpy as np
from PIL import Image

import config
from mcp.server import _YOLO_LOCK

# Suppress noisy OpenCV warnings when no camera device is present.
cv2.utils.logging.setLogLevel(cv2.utils.logging.LOG_LEVEL_ERROR)


def _encode_frame_to_jpeg(frame: np.ndarray, quality: int = 85) -> bytes:
    """Encode OpenCV BGR frame to JPEG bytes."""
    encode_params = [int(cv2.IMWRITE_JPEG_QUALITY), quality]
    success, buf = cv2.imencode(".jpg", frame, encode_params)
    if not success:
        raise RuntimeError("JPEG encode failed")
    return buf.tobytes()


def _encode_frame_to_base64(frame: np.ndarray, quality: int = 85) -> str:
    """Encode OpenCV BGR frame to base64 JPEG data URI."""
    buf = _encode_frame_to_jpeg(frame, quality)
    b64 = base64.b64encode(buf).decode("utf-8")
    return f"data:image/jpeg;base64,{b64}"


@dataclass
class DetectionEvent:
    camera_id: str
    timestamp: float
    confidence: float
    screenshot_b64: str
    bbox: list[float]
    class_name: str = ""


class CameraStream:
    """Manages a single camera feed with YOLO person detection."""

    def __init__(
        self,
        camera_id: str,
        source: str | int,
        yolo_model: Any,
        confidence: float = 0.5,
        inference_interval: float = 0.2,
        webhook_cooldown: float = 5.0,
        classes: list[str] | None = None,
    ) -> None:
        self.camera_id = camera_id
        self.source = int(source) if str(source).isdigit() else source
        self.yolo_model = yolo_model
        self.confidence = confidence
        self.inference_interval = inference_interval
        self.webhook_cooldown = webhook_cooldown
        self.classes = classes

        self._cap: cv2.VideoCapture | None = None
        self._thread: threading.Thread | None = None
        self._stop_event = threading.Event()

        self._lock = threading.Lock()
        self._latest_frame: np.ndarray | None = None
        self._annotated_frame: np.ndarray | None = None
        self._last_detection_frame: np.ndarray | None = None
        self._last_detection_event: DetectionEvent | None = None
        self._last_webhook_time_per_class: dict[str, float] = {}
        self._status: str = "idle"
        self._fps: float = 0.0

        self._webhook_callbacks: list[callable] = []

    def add_webhook_callback(self, cb: callable) -> None:
        self._webhook_callbacks.append(cb)

    @property
    def status(self) -> str:
        return self._status

    @property
    def fps(self) -> float:
        return self._fps

    def get_latest_frame_bytes(self, quality: int = 85) -> bytes | None:
        with self._lock:
            frame = self._annotated_frame if self._annotated_frame is not None else self._latest_frame
            if frame is None:
                return None
            return _encode_frame_to_jpeg(frame.copy(), quality)

    def get_last_detection_bytes(self, quality: int = 85) -> bytes | None:
        with self._lock:
            if self._last_detection_frame is None:
                return None
            return _encode_frame_to_jpeg(self._last_detection_frame.copy(), quality)

    def get_last_detection_event(self) -> DetectionEvent | None:
        with self._lock:
            return self._last_detection_event

    def start(self) -> None:
        if self._thread is not None and self._thread.is_alive():
            return
        self._stop_event.clear()
        self._thread = threading.Thread(target=self._run_loop, daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._stop_event.set()
        if self._thread is not None:
            self._thread.join(timeout=2.0)
        if self._cap is not None:
            self._cap.release()
            self._cap = None
        self._status = "stopped"

    def _run_loop(self) -> None:
        self._cap = cv2.VideoCapture(self.source)
        if not self._cap.isOpened():
            self._status = "error"
            print(f"[Camera {self.camera_id}] Failed to open source {self.source}")
            return

        # Try to set buffer size low for latency
        self._cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)

        self._status = "streaming"
        last_inference = 0.0
        frame_count = 0
        t0 = time.time()
        read_failures = 0

        while not self._stop_event.is_set():
            success, frame = self._cap.read()
            if not success:
                read_failures += 1
                if read_failures % 100 == 1:
                    print(f"[Camera {self.camera_id}] Frame read failed ({read_failures} times)")
                if read_failures > 500:
                    self._status = "error"
                    print(f"[Camera {self.camera_id}] Stream broken after {read_failures} read failures")
                    break
                time.sleep(0.01)
                continue
            read_failures = 0

            frame_count += 1
            elapsed = time.time() - t0
            if elapsed >= 1.0:
                self._fps = frame_count / elapsed
                frame_count = 0
                t0 = time.time()

            now = time.time()
            annotated = frame.copy()
            person_detected = False
            best_conf = 0.0
            best_bbox = []
            best_class = ""

            if now - last_inference >= self.inference_interval and self.yolo_model is not None:
                last_inference = now
                try:
                    with _YOLO_LOCK:
                        results = self.yolo_model(frame, conf=self.confidence, verbose=False)
                    boxes = results[0].boxes
                    if boxes is not None and len(boxes) > 0:
                        names = self.yolo_model.names
                        for i in range(len(boxes)):
                            cls_id = int(boxes.cls[i].item())
                            cls_name = names.get(cls_id, str(cls_id))
                            conf = float(boxes.conf[i].item())
                            if self.classes and cls_name not in self.classes:
                                continue
                            person_detected = True
                            if conf > best_conf:
                                best_conf = conf
                                best_bbox = [round(float(v), 2) for v in boxes.xyxy[i].tolist()]
                                best_class = cls_name
                            x1, y1, x2, y2 = map(int, boxes.xyxy[i].tolist())
                            cv2.rectangle(annotated, (x1, y1), (x2, y2), (0, 255, 0), 2)
                            label = f"{cls_name} {conf:.2f}"
                            cv2.putText(
                                annotated, label, (x1, max(y1 - 10, 20)),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2,
                            )
                except Exception as e:
                    print(f"[Camera {self.camera_id}] Inference error: {e}")

            with self._lock:
                self._latest_frame = frame
                self._annotated_frame = annotated
                if person_detected:
                    self._last_detection_frame = annotated.copy()
                    self._last_detection_event = DetectionEvent(
                        camera_id=self.camera_id,
                        timestamp=now,
                        confidence=best_conf,
                        screenshot_b64=_encode_frame_to_base64(annotated, quality=90),
                        bbox=best_bbox,
                        class_name=best_class,
                    )
                    last_sent = self._last_webhook_time_per_class.get(best_class, 0.0)
                    if now - last_sent >= self.webhook_cooldown:
                        self._last_webhook_time_per_class[best_class] = now
                        self._trigger_webhook(self._last_detection_event)

    def _trigger_webhook(self, event: DetectionEvent) -> None:
        for cb in self._webhook_callbacks:
            try:
                cb(event)
            except Exception:
                pass


class CameraManager:
    """Manages all camera streams."""

    def __init__(self, yolo_model: Any, webhook_queue: Any | None = None) -> None:
        self._yolo_model = yolo_model
        self._streams: dict[str, CameraStream] = {}
        self._lock = threading.Lock()
        self._webhook_queue = webhook_queue

    def discover_cameras(self) -> list[dict[str, Any]]:
        """Probe configured camera device IDs and return available ones.

        Active streams are reflected in the result to avoid V4L2 exclusive-lock
        conflicts and to prevent an empty available list while streaming.
        Dummy devices (0x0 resolution) are filtered out.
        """
        available = []
        for dev_id in config.CAMERA_DEVICE_IDS:
            cam_id = f"cam_{dev_id}"
            # If already actively streaming, echo it without re-opening the
            # device (avoids V4L2 exclusive-lock conflict).
            with self._lock:
                stream = self._streams.get(cam_id)
            if stream is not None and stream.status == "streaming":
                available.append({
                    "id": cam_id,
                    "name": f"Camera {dev_id}",
                    "source": str(dev_id),
                    "resolution": None,
                    "fps": round(stream.fps, 1) if stream.fps > 0 else None,
                    "status": "streaming",
                })
                continue

            cap = cv2.VideoCapture(int(dev_id))
            if cap.isOpened():
                w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
                h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
                # Filter dummy devices that report 0x0 resolution
                if w > 0 and h > 0:
                    fps = cap.get(cv2.CAP_PROP_FPS)
                    available.append({
                        "id": cam_id,
                        "name": f"Camera {dev_id}",
                        "source": str(dev_id),
                        "resolution": f"{w}x{h}",
                        "fps": round(fps, 1) if fps > 0 else None,
                        "status": "available",
                    })
            cap.release()
        return available

    def start_camera(
        self,
        camera_id: str,
        source: str | int,
        confidence: float | None = None,
        classes: list[str] | None = None,
    ) -> CameraStream:
        with self._lock:
            existing = self._streams.get(camera_id)
            # Normalize: empty list and None both mean "no class filter"
            normalized_classes = classes if classes else None
            if existing is not None:
                # Hot-reconfig: if params differ, stop and recreate
                target_conf = confidence if confidence is not None else config.CAMERA_PERSON_CONFIDENCE
                existing_classes = existing.classes if existing.classes else None
                if existing.confidence != target_conf or existing_classes != normalized_classes:
                    existing.stop()
                    self._streams.pop(camera_id, None)
                else:
                    return existing
            stream = CameraStream(
                camera_id=camera_id,
                source=source,
                yolo_model=self._yolo_model,
                confidence=confidence if confidence is not None else config.CAMERA_PERSON_CONFIDENCE,
                inference_interval=config.CAMERA_INFERENCE_INTERVAL,
                webhook_cooldown=config.CAMERA_WEBHOOK_COOLDOWN,
                classes=normalized_classes,
            )
            if self._webhook_queue is not None:
                stream.add_webhook_callback(self._on_person_detected)
            stream.start()
            self._streams[camera_id] = stream
            return stream

    def stop_camera(self, camera_id: str) -> None:
        with self._lock:
            stream = self._streams.pop(camera_id, None)
            if stream:
                stream.stop()

    def stop_all(self) -> None:
        with self._lock:
            for stream in list(self._streams.values()):
                stream.stop()
            self._streams.clear()

    def get_stream(self, camera_id: str) -> CameraStream | None:
        with self._lock:
            return self._streams.get(camera_id)

    def list_streams(self) -> list[dict[str, Any]]:
        with self._lock:
            return [
                {
                    "id": s.camera_id,
                    "source": s.source,
                    "status": s.status,
                    "fps": round(s.fps, 1),
                    "thread_alive": s._thread is not None and s._thread.is_alive(),
                }
                for s in self._streams.values()
            ]

    def _on_person_detected(self, event: DetectionEvent) -> None:
        if self._webhook_queue is None:
            return
        payload = {
            "event": "person_detected",
            "camera_id": event.camera_id,
            "timestamp": event.timestamp,
            "confidence": event.confidence,
            "screenshot_base64": event.screenshot_b64,
            "bbox": event.bbox,
            "class_name": event.class_name,
        }
        self._webhook_queue.enqueue(
            event.camera_id, event.class_name, payload, confidence=event.confidence
        )
