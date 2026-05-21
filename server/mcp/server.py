"""MCP Server logic and tool registry."""

import asyncio
import base64
import io
import threading
import time
from typing import Any, AsyncGenerator, Callable
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
    SseProgressData,
    SseResultData,
    SseErrorData,
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


# Tool-specific progress messages for SSE streaming
_TOOL_PROGRESS_STEPS: dict[str, list[str]] = {
    "yolo2026_detect": ["正在加载 YOLO 模型...", "执行目标检测...", "解析检测结果..."],
    "whisper_transcribe": ["正在加载 Whisper 模型...", "预处理音频...", "执行语音转录...", "后处理结果..."],
    "camera_list": ["正在发现可用摄像头...", "获取摄像头状态..."],
    "camera_get_frame": ["正在连接摄像头...", "获取视频帧...", "编码图像..."],
    "camera_get_last_detection": ["正在查询检测历史...", "获取最新检测帧...", "编码图像..."],
}


async def call_tool_stream(request: CallRequest) -> AsyncGenerator[dict[str, Any], None]:
    """Async generator that yields SSE event dicts for a tool call.

    Yields:
        dicts with keys ``event`` ("progress" | "result" | "error") and ``data``.
    """
    handler = _TOOL_HANDLERS.get(request.tool)
    if not handler:
        yield {
            "event": "error",
            "data": {"code": "TOOL_NOT_FOUND", "message": f"Tool '{request.tool}' not found"},
        }
        return

    steps = _TOOL_PROGRESS_STEPS.get(request.tool, ["正在初始化推理引擎...", "执行推理...", "处理结果..."])
    total_steps = len(steps) + 1

    # Emit initial progress
    yield {
        "event": "progress",
        "data": {"message": steps[0], "step": 1, "total_steps": total_steps},
    }

    # Run the synchronous handler in a thread pool so the event loop stays free
    try:
        response: CallResponse = await asyncio.to_thread(call_tool, request)
    except Exception as e:
        yield {
            "event": "error",
            "data": {"code": "INFERENCE_ERROR", "message": str(e)},
        }
        return

    # Emit intermediate progress steps (quickly, for visual feedback)
    for idx, msg in enumerate(steps[1:], start=2):
        yield {
            "event": "progress",
            "data": {"message": msg, "step": idx, "total_steps": total_steps},
        }
        await asyncio.sleep(0.01)

    # Final progress
    yield {
        "event": "progress",
        "data": {"message": "推理完成", "step": total_steps, "total_steps": total_steps},
    }

    if response.status == "error":
        yield {"event": "error", "data": response.error}
    else:
        yield {"event": "result", "data": response}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _decode_image(image_input: str) -> Image.Image:
    """Decode an image from base64 string (with or without data URI prefix), HTTP URL, or OpenClaw media URI to PIL Image."""
    if image_input.startswith("http://") or image_input.startswith("https://"):
        import urllib.request
        with urllib.request.urlopen(image_input, timeout=10) as resp:
            image_bytes = resp.read()
        return Image.open(io.BytesIO(image_bytes)).convert("RGB")

    # OpenClaw media URI: media://inbound/<id>
    if image_input.startswith("media://inbound/"):
        media_id = image_input[len("media://inbound/"):]
        openclaw_media_dir = Path.home() / ".openclaw" / "media" / "inbound"
        if openclaw_media_dir.exists():
            candidates = list(openclaw_media_dir.glob(f"*{media_id}*"))
            if candidates:
                candidates.sort(key=lambda p: p.stat().st_mtime, reverse=True)
                with open(candidates[0], "rb") as f:
                    return Image.open(io.BytesIO(f.read())).convert("RGB")
            exact = openclaw_media_dir / media_id
            if exact.exists():
                with open(exact, "rb") as f:
                    return Image.open(io.BytesIO(f.read())).convert("RGB")
        # Fallback: try OpenClaw HTTP media endpoint
        try:
            import urllib.request
            with urllib.request.urlopen(f"http://localhost:18789/media/{media_id}", timeout=5) as resp:
                return Image.open(io.BytesIO(resp.read())).convert("RGB")
        except Exception as exc:
            raise ValueError(f"OpenClaw media not found: {image_input}") from exc

    image_b64 = image_input
    if "," in image_b64:
        image_b64 = image_b64.split(",", 1)[1]
    image_bytes = base64.b64decode(image_b64)
    return Image.open(io.BytesIO(image_bytes)).convert("RGB")


def _load_yolo_model(variant: str = "yolo2026n"):
    """Lazily load a YOLO model (auto-downloads weights on first use)."""
    global _YOLO_MODEL
    if _YOLO_MODEL is None:
        from ultralytics import YOLO
        models_dir = Path(__file__).resolve().parent.parent.parent / "models_storage"
        weights_path = models_dir / f"{variant}.pt"
        if weights_path.exists():
            _YOLO_MODEL = YOLO(str(weights_path))
        else:
            models_dir.mkdir(parents=True, exist_ok=True)
            _YOLO_MODEL = YOLO(f"{variant}.pt")
            cwd_file = Path(f"{variant}.pt")
            if cwd_file.exists():
                import shutil
                shutil.move(str(cwd_file), str(weights_path))
    return _YOLO_MODEL


def _normalize_camera_id(camera_id: str | None) -> str | None:
    """Normalize camera_id so numeric inputs like '0' become 'cam_0'."""
    if camera_id is None:
        return None
    if isinstance(camera_id, str) and camera_id.isdigit():
        return f"cam_{camera_id}"
    return camera_id


# Alias -> index in available_cameras list (0 = first, 1 = second, etc.)
_DEFAULT_CAMERA_ALIASES: dict[str, int] = {
    "default": 0,
    "main": 0,
    "门口": 0,
    "entrance": 0,
    "室内": 1,
    "indoor": 1,
    "room": 1,
    "backyard": 2,
    "后院": 2,
}


def _resolve_camera_alias(camera_id: str, available_cameras: list[dict[str, Any]]) -> str:
    """Resolve alias names like 'default' or '门口' to actual camera ids.

    Falls back to the original camera_id if alias is unknown or index out of range.
    """
    idx = _DEFAULT_CAMERA_ALIASES.get(camera_id)
    if idx is not None and available_cameras and idx < len(available_cameras):
        return available_cameras[idx]["id"]
    return camera_id


def _resolve_camera_id(raw_id: str | None) -> str | None:
    """Full resolution pipeline: normalize digits, then resolve aliases."""
    camera_id = _normalize_camera_id(raw_id)
    if camera_id is None or _CAMERA_MANAGER is None:
        return camera_id
    if camera_id in _DEFAULT_CAMERA_ALIASES:
        available = _CAMERA_MANAGER.discover_cameras()
        camera_id = _resolve_camera_alias(camera_id, available)
    return camera_id


# ---------------------------------------------------------------------------
# Tool schemas
# ---------------------------------------------------------------------------

_TOOL_SCHEMAS_LIST = [
    McpToolSchema(
        name="yolo2026_detect",
        description="YOLO2026 object detection",
        inputSchema={
            "type": "object",
            "properties": {
                "image": {"type": "string", "description": "Image input: supports HTTP/HTTPS URL, base64, data URI, local file path, and OpenClaw media reference (media://inbound/<id>). If the user message contains [media attached: media://inbound/<id>], pass that URI directly as this parameter."},
                "confidence": {"type": "number", "default": 0.5},
                "classes": {"type": "array", "items": {"type": "string"}},
            },
            "required": ["image"],
        },
    ),
    McpToolSchema(
        name="whisper_transcribe",
        description="Whisper speech recognition",
        inputSchema={
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
        name="camera_list",
        description="List available local cameras and their current status. Call this first to discover valid camera identifiers before using camera_get_frame or camera_get_last_detection.",
        inputSchema={
            "type": "object",
            "properties": {},
            "required": [],
        },
    ),
    McpToolSchema(
        name="camera_get_frame",
        description="Get the real-time frame from a specified camera as base64 JPEG. Example natural language: '查看门口摄像头实时画面' or '获取 cam_0 的画面'. Use camera_list first if you are unsure of the identifier.",
        inputSchema={
            "type": "object",
            "properties": {
                "camera_id": {
                    "type": "string",
                    "description": "Camera identifier. Accepts canonical ID (cam_0), numeric string (0), or alias (default, main, 门口, 室内).",
                    "examples": ["cam_0", "0", "default", "门口"],
                },
            },
            "required": ["camera_id"],
        },
    ),
    McpToolSchema(
        name="camera_get_last_detection",
        description="Get the most recent frame containing a detected person from a specified camera. Example natural language: '查看门口摄像头最近一次检测到人的画面' or '获取 cam_0 的人形检测截图'. Use camera_list first if you are unsure of the identifier.",
        inputSchema={
            "type": "object",
            "properties": {
                "camera_id": {
                    "type": "string",
                    "description": "Camera identifier. Accepts canonical ID (cam_0), numeric string (0), or alias (default, main, 门口, 室内).",
                    "examples": ["cam_0", "0", "default", "门口"],
                },
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
    model = _load_yolo_model("yolo2026n")
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
        model="yolo2026",
        inference_time=f"{elapsed}ms",
        device=device,
        result={"detections": detections, "total_objects": len(detections)},
    )


# ---------------------------------------------------------------------------
# Fallback inference handlers (used when optional real handlers are unavailable)
# ---------------------------------------------------------------------------

def _mock_yolo2026(args: dict[str, Any]) -> CallResponse:
    time.sleep(0.012)
    return CallResponse(
        status="success",
        model="yolo2026",
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
    camera_id = _resolve_camera_id(args.get("camera_id"))
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
    camera_id = _resolve_camera_id(args.get("camera_id"))
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

_MODEL_STATUS = {
    "yolo2026": "online",
    "whisper": "online",
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
    """Register tool handlers. Real handlers from server.models are bridged where
    available; tools without a real implementation fall back to built-in defaults."""
    global _CAMERA_MANAGER
    _CAMERA_MANAGER = camera_manager
    if mock_mode:
        register_tool(_TOOL_SCHEMAS_LIST[0], _mock_yolo2026)
    else:
        # Pre-load model on startup to avoid cold-start latency on first request
        _load_yolo_model("yolo2026n")
        register_tool(_TOOL_SCHEMAS_LIST[0], _real_yolov8)

    # Bridge real Whisper handler when available in non-mock mode.
    whisper_handler = None if mock_mode else _bridge_real_handler("whisper_transcribe")
    if whisper_handler is not None:
        register_tool(_TOOL_SCHEMAS_LIST[1], whisper_handler)
        print("[DeepMCP] Registered REAL whisper handler")
    else:
        register_tool(_TOOL_SCHEMAS_LIST[1], _mock_whisper)
        if not mock_mode:
            print("[DeepMCP] WARNING: real whisper handler unavailable; falling back to mock")

    register_tool(_TOOL_SCHEMAS_LIST[2], _camera_list)
    register_tool(_TOOL_SCHEMAS_LIST[3], _camera_get_frame)
    register_tool(_TOOL_SCHEMAS_LIST[4], _camera_get_last_detection)


def get_health() -> HealthResponse:
    # Update yolo2026 status based on whether real model is loaded
    status_map = dict(_MODEL_STATUS)
    if _YOLO_MODEL is not None:
        status_map["yolo2026"] = "online"
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
            "avg_ms": 0.0,
            "p50_ms": 0.0,
            "p99_ms": 0.0,
            "history": [],
        },
        throughput={
            "req_per_sec": 0.0,
            "history": [],
        },
        system={
            "gpu_utilization": 0,
            "gpu_memory_used_gb": 0.0,
            "gpu_memory_total_gb": 0.0,
            "cpu_utilization": 0,
            "disk_used_gb": 0.0,
        },
        webhook=webhook_metrics,
    )
