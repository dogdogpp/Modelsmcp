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
    ) -> None:
        self.camera_id = camera_id
        self.source = int(source) if str(source).isdigit() else source
        self.yolo_model = yolo_model
        self.confidence = confidence
        self.inference_interval = inference_interval
        self.webhook_cooldown = webhook_cooldown

        self._cap: cv2.VideoCapture | None = None
        self._thread: threading.Thread | None = None
        self._stop_event = threading.Event()

        self._lock = threading.Lock()
        self._latest_frame: np.ndarray | None = None
        self._annotated_frame: np.ndarray | None = None
        self._last_detection_frame: np.ndarray | None = None
        self._last_detection_event: DetectionEvent | None = None
        self._last_webhook_time: float = 0.0
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
            return

        # Try to set buffer size low for latency
        self._cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)

        self._status = "streaming"
        last_inference = 0.0
        frame_count = 0
        t0 = time.time()

        while not self._stop_event.is_set():
            success, frame = self._cap.read()
            if not success:
                time.sleep(0.01)
                continue

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

            if now - last_inference >= self.inference_interval and self.yolo_model is not None:
                last_inference = now
                results = self.yolo_model(frame, conf=self.confidence, verbose=False, classes=[0])
                boxes = results[0].boxes
                if boxes is not None and len(boxes) > 0:
                    names = self.yolo_model.names
                    for i in range(len(boxes)):
                        cls_id = int(boxes.cls[i].item())
                        cls_name = names.get(cls_id, str(cls_id))
                        conf = float(boxes.conf[i].item())
                        if cls_name == "person":
                            person_detected = True
                            if conf > best_conf:
                                best_conf = conf
                                best_bbox = [round(float(v), 2) for v in boxes.xyxy[i].tolist()]
                            x1, y1, x2, y2 = map(int, boxes.xyxy[i].tolist())
                            cv2.rectangle(annotated, (x1, y1), (x2, y2), (0, 255, 0), 2)
                            label = f"person {conf:.2f}"
                            cv2.putText(
                                annotated, label, (x1, max(y1 - 10, 20)),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2,
                            )

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
                    )
                    if now - self._last_webhook_time >= self.webhook_cooldown:
                        self._last_webhook_time = now
                        self._trigger_webhook(self._last_detection_event)

    def _trigger_webhook(self, event: DetectionEvent) -> None:
        for cb in self._webhook_callbacks:
            try:
                cb(event)
            except Exception:
                pass


class CameraManager:
    """Manages all camera streams."""

    def __init__(self, yolo_model: Any) -> None:
        self._yolo_model = yolo_model
        self._streams: dict[str, CameraStream] = {}
        self._lock = threading.Lock()
        self._webhook_url = config.OPENCLAW_WEBHOOK_URL
        self._webhook_key = config.OPENCLAW_API_KEY

    def discover_cameras(self) -> list[dict[str, Any]]:
        """Probe configured camera device IDs and return available ones."""
        available = []
        for dev_id in config.CAMERA_DEVICE_IDS:
            cam_id = f"cam_{dev_id}"
            cap = cv2.VideoCapture(int(dev_id))
            if cap.isOpened():
                w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
                h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
                fps = cap.get(cv2.CAP_PROP_FPS)
                available.append({
                    "id": cam_id,
                    "name": f"Camera {dev_id}",
                    "source": dev_id,
                    "resolution": f"{w}x{h}",
                    "fps": round(fps, 1) if fps > 0 else None,
                    "status": "available",
                })
            cap.release()
        return available

    def start_camera(self, camera_id: str, source: str | int) -> CameraStream:
        with self._lock:
            if camera_id in self._streams:
                return self._streams[camera_id]
            stream = CameraStream(
                camera_id=camera_id,
                source=source,
                yolo_model=self._yolo_model,
                confidence=config.CAMERA_PERSON_CONFIDENCE,
                inference_interval=config.CAMERA_INFERENCE_INTERVAL,
                webhook_cooldown=config.CAMERA_WEBHOOK_COOLDOWN,
            )
            if self._webhook_url:
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
                }
                for s in self._streams.values()
            ]

    def _on_person_detected(self, event: DetectionEvent) -> None:
        if not self._webhook_url:
            return
        payload = {
            "event": "person_detected",
            "camera_id": event.camera_id,
            "timestamp": event.timestamp,
            "confidence": event.confidence,
            "screenshot_base64": event.screenshot_b64,
            "bbox": event.bbox,
        }
        # Fire-and-forget in a background thread to avoid blocking detection loop
        threading.Thread(
            target=self._send_webhook_sync,
            args=(payload,),
            daemon=True,
        ).start()

    def _send_webhook_sync(self, payload: dict[str, Any]) -> None:
        try:
            import httpx
            headers = {"Content-Type": "application/json"}
            if self._webhook_key:
                headers["Authorization"] = f"Bearer {self._webhook_key}"
            with httpx.Client(timeout=5.0) as client:
                client.post(self._webhook_url, json=payload, headers=headers)
        except Exception:
            pass
