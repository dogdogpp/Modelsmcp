"""MCP Server logic and tool registry."""

import base64
import io
import threading
import time
import random
from typing import Any, Callable
from pathlib import Path

from PIL import Image
import numpy as np

from .protocol import (
    McpToolSchema,
    ToolsResponse,
    CallRequest,
    CallResponse,
    HealthResponse,
    HealthModelInfo,
    MetricsResponse,
    MetricsDataPoint,
)

# Tool registry: name -> handler
_TOOL_HANDLERS: dict[str, Callable[[dict[str, Any]], CallResponse]] = {}
_TOOL_SCHEMAS: dict[str, McpToolSchema] = {}

# Lazy-loaded real model instances
_YOLO_MODEL = None
_YOLO_LOCK = threading.Lock()

# Camera manager instance (set by main.py lifespan)
_CAMERA_MANAGER = None

# Webhook queue instance (set by main.py lifespan)
_WEBHOOK_QUEUE = None


def set_webhook_queue(queue) -> None:
    global _WEBHOOK_QUEUE
    _WEBHOOK_QUEUE = queue


def register_tool(schema: McpToolSchema, handler: Callable[[dict[str, Any]], CallResponse]) -> None:
    _TOOL_SCHEMAS[schema.name] = schema
    _TOOL_HANDLERS[schema.name] = handler


def get_tools() -> ToolsResponse:
    return ToolsResponse(tools=list(_TOOL_SCHEMAS.values()))


def call_tool(request: CallRequest) -> CallResponse:
    handler = _TOOL_HANDLERS.get(request.tool)
    if not handler:
        return CallResponse(
            status="error",
            model="unknown",
            inference_time="0ms",
            device="cpu",
            result=None,
            error={"code": "TOOL_NOT_FOUND", "message": f"Tool '{request.tool}' not found"},
        )
    try:
        return handler(request.arguments)
    except Exception as e:
        return CallResponse(
            status="error",
            model=request.tool,
            inference_time="0ms",
            device="cpu",
            result=None,
            error={"code": "INFERENCE_ERROR", "message": str(e)},
        )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _decode_image(image_input: str) -> Image.Image:
    """Decode an image from base64 string (with or without data URI prefix) or HTTP URL to PIL Image."""
    if image_input.startswith("http://") or image_input.startswith("https://"):
        import urllib.request
        with urllib.request.urlopen(image_input, timeout=10) as resp:
            image_bytes = resp.read()
        return Image.open(io.BytesIO(image_bytes)).convert("RGB")
    image_b64 = image_input
    if "," in image_b64:
        image_b64 = image_b64.split(",", 1)[1]
    image_bytes = base64.b64decode(image_b64)
    return Image.open(io.BytesIO(image_bytes)).convert("RGB")


def _load_yolo_model(variant: str = "yolo26n"):
    """Lazily load a YOLO model (auto-downloads weights on first use)."""
    global _YOLO_MODEL
    if _YOLO_MODEL is None:
        from ultralytics import YOLO
        _YOLO_MODEL = YOLO(f"{variant}.pt")
    return _YOLO_MODEL


# ---------------------------------------------------------------------------
# Tool schemas
# ---------------------------------------------------------------------------

_MOCK_TOOL_SCHEMAS = [
    McpToolSchema(
        name="yolo26_detect",
        description="YOLO2026 object detection",
        parameters={
            "type": "object",
            "properties": {
                "image": {"type": "string", "description": "Image URL or base64"},
                "confidence": {"type": "number", "default": 0.5},
                "classes": {"type": "array", "items": {"type": "string"}},
            },
            "required": ["image"],
        },
    ),
    McpToolSchema(
        name="detr_detect",
        description="DETR Transformer object detection",
        parameters={
            "type": "object",
            "properties": {
                "image": {"type": "string"},
                "threshold": {"type": "number", "default": 0.7},
            },
            "required": ["image"],
        },
    ),
    McpToolSchema(
        name="paddleocr_recognize",
        description="PaddleOCR text recognition",
        parameters={
            "type": "object",
            "properties": {
                "image": {"type": "string"},
                "lang": {"type": "string", "default": "ch"},
            },
            "required": ["image"],
        },
    ),
    McpToolSchema(
        name="sam2_segment",
        description="SAM 2 image/video segmentation",
        parameters={
            "type": "object",
            "properties": {
                "image": {"type": "string"},
                "prompts": {"type": "object"},
            },
            "required": ["image"],
        },
    ),
    McpToolSchema(
        name="clip_encode",
        description="CLIP image-text encoding",
        parameters={
            "type": "object",
            "properties": {
                "image": {"type": "string"},
                "texts": {"type": "array", "items": {"type": "string"}},
                "mode": {"type": "string", "enum": ["classify", "encode"]},
            },
        },
    ),
    McpToolSchema(
        name="whisper_transcribe",
        description="Whisper speech recognition",
        parameters={
            "type": "object",
            "properties": {
                "audio": {"type": "string"},
                "language": {"type": "string", "default": "zh"},
                "task": {"type": "string", "enum": ["transcribe", "translate"]},
            },
            "required": ["audio"],
        },
    ),
    McpToolSchema(
        name="depth_estimate",
        description="Depth Anything depth estimation",
        parameters={
            "type": "object",
            "properties": {
                "image": {"type": "string"},
                "model_size": {"type": "string", "enum": ["small", "large"]},
            },
            "required": ["image"],
        },
    ),
    McpToolSchema(
        name="dinov2_embed",
        description="DINOv2 visual feature extraction",
        parameters={
            "type": "object",
            "properties": {
                "image": {"type": "string"},
                "model": {"type": "string"},
            },
            "required": ["image"],
        },
    ),
    McpToolSchema(
        name="pose_estimate",
        description="YOLOv8 human pose estimation",
        parameters={
            "type": "object",
            "properties": {
                "image": {"type": "string"},
                "confidence": {"type": "number", "default": 0.5},
                "visualize": {"type": "boolean", "default": False},
            },
            "required": ["image"],
        },
    ),
    McpToolSchema(
        name="grounding_dino_detect",
        description="Grounding DINO open-vocabulary detection",
        parameters={
            "type": "object",
            "properties": {
                "image": {"type": "string"},
                "text_prompt": {"type": "string"},
                "box_threshold": {"type": "number", "default": 0.35},
            },
            "required": ["image", "text_prompt"],
        },
    ),
    McpToolSchema(
        name="camera_list",
        description="List available local cameras and their current status",
        parameters={
            "type": "object",
            "properties": {},
        },
    ),
    McpToolSchema(
        name="camera_get_frame",
        description="Get the real-time frame from a specified camera as base64 JPEG",
        parameters={
            "type": "object",
            "properties": {
                "camera_id": {"type": "string", "description": "Camera identifier, e.g. cam_0"},
            },
            "required": ["camera_id"],
        },
    ),
    McpToolSchema(
        name="camera_get_last_detection",
        description="Get the most recent frame containing a detected person from a specified camera",
        parameters={
            "type": "object",
            "properties": {
                "camera_id": {"type": "string", "description": "Camera identifier, e.g. cam_0"},
            },
            "required": ["camera_id"],
        },
    ),
]

# ---------------------------------------------------------------------------
# Real inference handlers
# ---------------------------------------------------------------------------

def _real_yolov8(args: dict[str, Any]) -> CallResponse:
    t0 = time.time()
    img = _decode_image(args["image"])
    conf = args.get("confidence", 0.5)
    classes = args.get("classes", [])
    model = _load_yolo_model("yolo26n")
    with _YOLO_LOCK:
        results = model(img, conf=conf, verbose=False)
    boxes = results[0].boxes
    detections = []
    if boxes is not None and len(boxes) > 0:
        names = model.names
        for i in range(len(boxes)):
            cls_id = int(boxes.cls[i].item())
            cls_name = names.get(cls_id, str(cls_id))
            if classes and cls_name not in classes:
                continue
            detections.append({
                "class": cls_name,
                "confidence": round(float(boxes.conf[i].item()), 4),
                "bbox": [round(float(v), 2) for v in boxes.xyxy[i].tolist()],
            })
    elapsed = round((time.time() - t0) * 1000, 1)
    import torch
    device = "cuda" if torch.cuda.is_available() else "cpu"
    return CallResponse(
        status="success",
        model="yolo26",
        inference_time=f"{elapsed}ms",
        device=device,
        result={"detections": detections, "total_objects": len(detections)},
    )


# ---------------------------------------------------------------------------
# Mock inference handlers
# ---------------------------------------------------------------------------

def _mock_yolo26(args: dict[str, Any]) -> CallResponse:
    time.sleep(0.012)
    return CallResponse(
        status="success",
        model="yolo26",
        inference_time="12ms",
        device="cuda",
        result={
            "detections": [
                {"class": "person", "confidence": 0.94, "bbox": [120, 80, 280, 420]},
                {"class": "car", "confidence": 0.87, "bbox": [350, 150, 680, 380]},
            ],
            "total_objects": 2,
        },
    )


def _mock_detr(args: dict[str, Any]) -> CallResponse:
    time.sleep(0.038)
    return CallResponse(
        status="success",
        model="detr",
        inference_time="38ms",
        device="cuda",
        result={
            "detections": [
                {"label": "person", "score": 0.99, "box": {"xmin": 119, "ymin": 78, "xmax": 281, "ymax": 422}},
            ],
            "total_objects": 1,
        },
    )


def _mock_paddleocr(args: dict[str, Any]) -> CallResponse:
    time.sleep(0.045)
    return CallResponse(
        status="success",
        model="paddleocr",
        inference_time="45ms",
        device="cpu",
        result={
            "texts": [
                {"text": "DeepMCP Platform", "confidence": 0.98},
                {"text": "AI Model Inference Hub", "confidence": 0.96},
            ],
            "language": args.get("lang", "ch"),
        },
    )


def _mock_sam2(args: dict[str, Any]) -> CallResponse:
    time.sleep(0.023)
    return CallResponse(
        status="success",
        model="sam2",
        inference_time="23ms",
        device="cuda",
        result={
            "masks": [{"id": 0, "area": 45231, "stability_score": 0.97}],
            "iou_predictions": [0.97],
        },
    )


def _mock_clip(args: dict[str, Any]) -> CallResponse:
    time.sleep(0.018)
    texts = args.get("texts", ["a cat", "a dog", "a bird"])
    return CallResponse(
        status="success",
        model="clip",
        inference_time="18ms",
        device="cuda",
        result={
            "results": [
                {"text": t, "similarity": round(0.9 - i * 0.15 + random.random() * 0.1, 2)}
                for i, t in enumerate(texts)
            ]
        },
    )


def _mock_whisper(args: dict[str, Any]) -> CallResponse:
    time.sleep(0.320)
    return CallResponse(
        status="success",
        model="whisper",
        inference_time="320ms",
        device="cuda",
        result={
            "language": args.get("language", "zh"),
            "segments": [
                {"start": 0.0, "end": 3.2, "text": "欢迎使用 DeepMCP 语音识别服务"},
            ],
            "text": "欢迎使用 DeepMCP 语音识别服务",
        },
    )


def _mock_depth(args: dict[str, Any]) -> CallResponse:
    time.sleep(0.035)
    return CallResponse(
        status="success",
        model="depth_anything",
        inference_time="35ms",
        device="cuda",
        result={
            "depth_map": "base64://[depth_map_data]",
            "min_depth": 0.42,
            "max_depth": 18.7,
            "format": "colormap",
        },
    )


def _mock_dinov2(args: dict[str, Any]) -> CallResponse:
    time.sleep(0.028)
    return CallResponse(
        status="success",
        model="dinov2",
        inference_time="28ms",
        device="cuda",
        result={
            "embedding": "[1024-dim vector]",
            "embedding_norm": 1.0,
            "patch_tokens": "196 x 1024",
        },
    )


def _mock_pose(args: dict[str, Any]) -> CallResponse:
    time.sleep(0.015)
    return CallResponse(
        status="success",
        model="yolov8_pose",
        inference_time="15ms",
        device="cuda",
        result={
            "persons": [
                {
                    "confidence": 0.94,
                    "keypoints": {
                        "nose": [198, 95, 0.98],
                        "left_shoulder": [160, 145, 0.96],
                        "right_shoulder": [238, 143, 0.97],
                    },
                }
            ]
        },
    )


def _mock_grounding_dino(args: dict[str, Any]) -> CallResponse:
    time.sleep(0.055)
    return CallResponse(
        status="success",
        model="grounding_dino",
        inference_time="55ms",
        device="cuda",
        result={
            "prompt": args.get("text_prompt", ""),
            "detections": [
                {"phrase": "person", "logit": 0.78, "box": [0.23, 0.18, 0.54, 0.89]},
            ],
        },
    )


# ---------------------------------------------------------------------------
# Camera tool handlers
# ---------------------------------------------------------------------------

def _camera_list(args: dict[str, Any]) -> CallResponse:
    if _CAMERA_MANAGER is None:
        return CallResponse(
            status="error",
            model="camera",
            inference_time="0ms",
            device="cpu",
            result=None,
            error={"code": "CAMERA_DISABLED", "message": "Camera manager not initialized"},
        )
    available = _CAMERA_MANAGER.discover_cameras()
    active = _CAMERA_MANAGER.list_streams()
    return CallResponse(
        status="success",
        model="camera",
        inference_time="0ms",
        device="cpu",
        result={
            "available_cameras": available,
            "active_streams": active,
        },
    )


def _camera_get_frame(args: dict[str, Any]) -> CallResponse:
    if _CAMERA_MANAGER is None:
        return CallResponse(
            status="error",
            model="camera",
            inference_time="0ms",
            device="cpu",
            result=None,
            error={"code": "CAMERA_DISABLED", "message": "Camera manager not initialized"},
        )
    camera_id = args.get("camera_id")
    stream = _CAMERA_MANAGER.get_stream(camera_id)
    if stream is None:
        # Auto-start if camera exists in discovery
        available = _CAMERA_MANAGER.discover_cameras()
        source = None
        for cam in available:
            if cam["id"] == camera_id:
                source = cam["source"]
                break
        if source is None:
            return CallResponse(
                status="error",
                model="camera",
                inference_time="0ms",
                device="cpu",
                result=None,
                error={"code": "CAMERA_NOT_FOUND", "message": f"Camera '{camera_id}' not found"},
            )
        stream = _CAMERA_MANAGER.start_camera(camera_id, source)
        # Give it a moment to capture first frame
        time.sleep(0.3)

    frame_bytes = stream.get_latest_frame_bytes()
    if frame_bytes is None:
        return CallResponse(
            status="error",
            model="camera",
            inference_time="0ms",
            device="cpu",
            result=None,
            error={"code": "FRAME_UNAVAILABLE", "message": "Frame not available yet"},
        )

    b64 = base64.b64encode(frame_bytes).decode("utf-8")
    return CallResponse(
        status="success",
        model="camera",
        inference_time="0ms",
        device="cpu",
        result={
            "camera_id": camera_id,
            "format": "jpeg",
            "image_base64": b64,
        },
    )


def _camera_get_last_detection(args: dict[str, Any]) -> CallResponse:
    if _CAMERA_MANAGER is None:
        return CallResponse(
            status="error",
            model="camera",
            inference_time="0ms",
            device="cpu",
            result=None,
            error={"code": "CAMERA_DISABLED", "message": "Camera manager not initialized"},
        )
    camera_id = args.get("camera_id")
    stream = _CAMERA_MANAGER.get_stream(camera_id)
    if stream is None:
        return CallResponse(
            status="error",
            model="camera",
            inference_time="0ms",
            device="cpu",
            result=None,
            error={"code": "CAMERA_NOT_FOUND", "message": f"Camera '{camera_id}' not found"},
        )

    event = stream.get_last_detection_event()
    frame_bytes = stream.get_last_detection_bytes()
    if event is None or frame_bytes is None:
        return CallResponse(
            status="success",
            model="camera",
            inference_time="0ms",
            device="cpu",
            result={
                "camera_id": camera_id,
                "detected": False,
                "message": "No person detected yet",
            },
        )

    b64 = base64.b64encode(frame_bytes).decode("utf-8")
    return CallResponse(
        status="success",
        model="camera",
        inference_time="0ms",
        device="cpu",
        result={
            "camera_id": camera_id,
            "detected": True,
            "timestamp": event.timestamp,
            "confidence": event.confidence,
            "bbox": event.bbox,
            "format": "jpeg",
            "image_base64": b64,
        },
    )


# ---------------------------------------------------------------------------
# Model status
# ---------------------------------------------------------------------------

_MOCK_MODEL_STATUS = {
    "yolo26": "online",
    "detr": "online",
    "paddleocr": "online",
    "sam2": "online",
    "clip": "online",
    "whisper": "online",
    "depth_anything": "online",
    "dinov2": "loading",
    "yolov8_pose": "online",
    "grounding_dino": "online",
}


# ---------------------------------------------------------------------------
# Init
# ---------------------------------------------------------------------------

def _bridge_real_handler(tool_name: str) -> Callable[[dict[str, Any]], CallResponse] | None:
    """Look up a handler in the server.models registry and wrap it as a CallResponse-returning callable.

    Returns None if the handler is unavailable (e.g. optional dep missing, not registered).
    """
    try:
        from server.models import get_handler
    except Exception:
        return None
    handler = get_handler(tool_name)
    if handler is None:
        return None

    def _adapter(args: dict[str, Any]) -> CallResponse:
        t0 = time.perf_counter()
        try:
            result = handler.infer(args)
        except Exception as e:
            return CallResponse(
                status="error",
                model=getattr(handler, "model_id", tool_name),
                inference_time="0ms",
                device=getattr(handler, "device", "cpu"),
                result=None,
                error={"code": "INFERENCE_ERROR", "message": str(e)},
            )
        elapsed_ms = round((time.perf_counter() - t0) * 1000, 1)
        return CallResponse(
            status="success",
            model=getattr(handler, "model_id", tool_name),
            inference_time=f"{elapsed_ms}ms",
            device=getattr(handler, "device", "cpu"),
            result=result,
        )

    return _adapter


def init_tools(mock_mode: bool = False, camera_manager=None) -> None:
    """Register tool handlers. In non-mock mode, real handlers from server.models are
    bridged where available; tools without a real implementation fall back to mock."""
    global _CAMERA_MANAGER
    _CAMERA_MANAGER = camera_manager
    if mock_mode:
        register_tool(_MOCK_TOOL_SCHEMAS[0], _mock_yolo26)
    else:
        # Pre-load model on startup to avoid cold-start latency on first request
        _load_yolo_model("yolo26n")
        register_tool(_MOCK_TOOL_SCHEMAS[0], _real_yolov8)
    register_tool(_MOCK_TOOL_SCHEMAS[1], _mock_detr)
    register_tool(_MOCK_TOOL_SCHEMAS[2], _mock_paddleocr)
    register_tool(_MOCK_TOOL_SCHEMAS[3], _mock_sam2)
    register_tool(_MOCK_TOOL_SCHEMAS[4], _mock_clip)

    # Bridge real Whisper handler when available in non-mock mode.
    whisper_handler = None if mock_mode else _bridge_real_handler("whisper_transcribe")
    if whisper_handler is not None:
        register_tool(_MOCK_TOOL_SCHEMAS[5], whisper_handler)
        print("[DeepMCP] Registered REAL whisper handler")
    else:
        register_tool(_MOCK_TOOL_SCHEMAS[5], _mock_whisper)
        if not mock_mode:
            print("[DeepMCP] WARNING: real whisper handler unavailable; falling back to mock")

    register_tool(_MOCK_TOOL_SCHEMAS[6], _mock_depth)
    register_tool(_MOCK_TOOL_SCHEMAS[7], _mock_dinov2)
    register_tool(_MOCK_TOOL_SCHEMAS[8], _mock_pose)
    register_tool(_MOCK_TOOL_SCHEMAS[9], _mock_grounding_dino)
    register_tool(_MOCK_TOOL_SCHEMAS[10], _camera_list)
    register_tool(_MOCK_TOOL_SCHEMAS[11], _camera_get_frame)
    register_tool(_MOCK_TOOL_SCHEMAS[12], _camera_get_last_detection)


def get_health() -> HealthResponse:
    # Update yolo26 status based on whether real model is loaded
    status_map = dict(_MOCK_MODEL_STATUS)
    if _YOLO_MODEL is not None:
        status_map["yolo26"] = "online"
    return HealthResponse(
        status="healthy",
        version="0.1.0",
        uptime="up",
        models=[
            HealthModelInfo(id=k, name=k.replace("_", " ").title(), status=v)  # type: ignore[arg-type]
            for k, v in status_map.items()
        ],
    )


def get_metrics() -> MetricsResponse:
    now = time.strftime("%H:%M:%S")
    webhook_metrics = {}
    if _WEBHOOK_QUEUE is not None:
        webhook_metrics = _WEBHOOK_QUEUE.get_metrics()
    else:
        webhook_metrics = {
            "webhook_delivery_total": 0,
            "webhook_delivery_failed_total": 0,
            "webhook_queue_depth": 0,
        }
    return MetricsResponse(
        latency={
            "avg_ms": 25.0,
            "p50_ms": 22.0,
            "p99_ms": 320.0,
            "history": [
                MetricsDataPoint(timestamp=f"2026-04-24T{now}", value=random.randint(15, 45)).model_dump()
                for _ in range(20)
            ],
        },
        throughput={
            "req_per_sec": 60.0,
            "history": [
                MetricsDataPoint(timestamp=f"2026-04-24T{now}", value=random.randint(40, 80)).model_dump()
                for _ in range(20)
            ],
        },
        system={
            "gpu_utilization": 67,
            "gpu_memory_used_gb": 14.2,
            "gpu_memory_total_gb": 24.0,
            "cpu_utilization": 23,
            "disk_used_gb": 48.3,
        },
        webhook=webhook_metrics,
    )
