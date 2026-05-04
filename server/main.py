"""DeepMCP FastAPI Server entry point."""

import sys
from pathlib import Path

# Fix: Ensure project root is on sys.path so `import server.xxx` works when
# running `python main.py` directly inside the `server/` directory.
_project_root = Path(__file__).resolve().parent.parent
if str(_project_root) not in sys.path:
    sys.path.insert(0, str(_project_root))

import asyncio
import hmac
import socket
import time
from contextlib import asynccontextmanager

import base64
import json

from fastapi import FastAPI, File, Form, HTTPException, Depends, Security, UploadFile, WebSocket, WebSocketDisconnect, Query, Body, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.security.api_key import APIKeyHeader

from config import (
    CORS_ORIGINS, HOST, MOCK_MODE, PORT, API_KEY,
    CAMERA_ENABLED, CAMERA_DEVICE_IDS,
    OPENCLAW_WEBHOOK_URL, OPENCLAW_API_KEY,
    WEBHOOK_TIMEOUT, WEBHOOK_MAX_RETRIES,
    WEBHOOK_DEDUP_WINDOW_SECONDS, WEBHOOK_DB_PATH,
    WEBHOOK_BACKOFF_BASE_SECONDS,
)
from mcp.server import init_tools, get_tools, call_tool, call_tool_stream, get_health, get_metrics
from mcp.protocol import CallRequest, SseCallRequest, format_sse
from camera import CameraManager
from webhook import WebhookQueue
from mcp.server import set_webhook_queue

# Optionally register real-mode model handlers (Whisper / YOLO) into server.models registry.
# Failures (missing optional deps like `whisper` or `ultralytics`) must not crash the server.
try:
    import server.models.whisper_handler  # noqa: F401  (self-registers on import)
except Exception as _e:  # pragma: no cover
    print(f"[DeepMCP] Whisper handler not available: {_e}")
try:
    import server.models.yolo_handler  # noqa: F401  (self-registers on import)
except Exception as _e:  # pragma: no cover
    print(f"[DeepMCP] YOLO handler not available: {_e}")

api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


async def verify_api_key(api_key: str = Security(api_key_header)):
    # Security: Empty API_KEY disables auth (development only).
    if not API_KEY:
        return None
    if not api_key:
        raise HTTPException(status_code=401, detail="Missing X-API-Key header")
    # Security: Use timing-safe comparison to prevent timing attacks.
    if not hmac.compare_digest(api_key, API_KEY):
        raise HTTPException(status_code=403, detail="Invalid API Key")
    return api_key


@asynccontextmanager
async def lifespan(app: FastAPI):
    webhook_queue = None
    if OPENCLAW_WEBHOOK_URL:
        webhook_queue = WebhookQueue(
            db_path=WEBHOOK_DB_PATH,
            webhook_url=OPENCLAW_WEBHOOK_URL,
            api_key=OPENCLAW_API_KEY,
            timeout=WEBHOOK_TIMEOUT,
            max_retries=WEBHOOK_MAX_RETRIES,
            dedup_window_seconds=WEBHOOK_DEDUP_WINDOW_SECONDS,
            backoff_base_seconds=WEBHOOK_BACKOFF_BASE_SECONDS,
        )
        webhook_queue.start()
        set_webhook_queue(webhook_queue)
        print(f"[DeepMCP] Webhook queue initialized. Target: {OPENCLAW_WEBHOOK_URL}")

    camera_manager = None
    if CAMERA_ENABLED:
        from mcp.server import _load_yolo_model
        yolo_model = _load_yolo_model("yolo26n")
        camera_manager = CameraManager(yolo_model, webhook_queue=webhook_queue)
        # Auto-start configured cameras
        available = camera_manager.discover_cameras()
        if available:
            for cam in available:
                camera_manager.start_camera(cam["id"], cam["source"])
            print(f"[DeepMCP] Camera manager initialized. Auto-started {len(available)} camera(s).")
        else:
            print("[DeepMCP] No cameras detected; camera manager initialized but idle.")
    init_tools(MOCK_MODE, camera_manager)
    app.state.camera_manager = camera_manager
    app.state.webhook_queue = webhook_queue
    print("[DeepMCP] Server started. Mock mode:", MOCK_MODE)
    yield
    if camera_manager is not None:
        camera_manager.stop_all()
    if webhook_queue is not None:
        webhook_queue.stop()
    print("[DeepMCP] Server shutting down...")


app = FastAPI(
    title="DeepMCP Server",
    description="Model Context Protocol (MCP) inference server for deep learning models with real-time camera detection.",
    version="0.2.0",
    lifespan=lifespan,
)

# Security: Restrict allowed methods and headers explicitly instead of using "*".
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "X-API-Key"],
)


@app.get("/health")
def health():
    return get_health()


@app.get("/tools")
def tools():
    return get_tools()


@app.post("/call", dependencies=[Depends(verify_api_key)])
def call(request: CallRequest):
    response = call_tool(request)
    if response.status == "error":
        raise HTTPException(status_code=400, detail=response.error)
    return response


@app.post("/sse", dependencies=[Depends(verify_api_key)])
async def sse_call(request: SseCallRequest, raw_request: Request):
    """Stream tool execution results via Server-Sent Events.

    Emits ``progress`` events during inference, followed by either a
    ``result`` or ``error`` event. Heartbeats are sent every 15 s to keep
    the connection alive for long-running operations.
    """
    queue: asyncio.Queue[str | None] = asyncio.Queue()

    async def producer():
        try:
            async for event_dict in call_tool_stream(
                CallRequest(tool=request.tool, arguments=request.arguments)
            ):
                await queue.put(format_sse(event_dict["event"], event_dict["data"]))
                if event_dict["event"] in ("result", "error"):
                    break
        except Exception as e:
            await queue.put(format_sse("error", {"code": "STREAM_ERROR", "message": str(e)}))
        finally:
            await queue.put(None)  # sentinel to signal completion

    async def heartbeat():
        try:
            while True:
                await asyncio.sleep(15)
                await queue.put(format_sse("heartbeat", {}))
        except asyncio.CancelledError:
            pass

    producer_task = asyncio.create_task(producer())
    heartbeat_task = asyncio.create_task(heartbeat())

    async def consumer():
        try:
            while True:
                # Check for client disconnect every queue poll
                if await raw_request.is_disconnected():
                    break
                item = await queue.get()
                if item is None:
                    break
                yield item
        finally:
            producer_task.cancel()
            heartbeat_task.cancel()
            try:
                await producer_task
            except asyncio.CancelledError:
                pass
            try:
                await heartbeat_task
            except asyncio.CancelledError:
                pass

    return StreamingResponse(
        consumer(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# Security: Limit uploaded file size to prevent OOM (16 MB).
_MAX_UPLOAD_SIZE = 16 * 1024 * 1024


@app.post("/upload", dependencies=[Depends(verify_api_key)])
async def upload(
    tool: str = Form(...),
    file: UploadFile = File(...),
    arguments: str = Form("{}"),
):
    """Upload a file and run inference. The file is converted to base64 and passed
to the specified tool as the 'image' or 'audio' argument."""
    contents = await file.read()
    if len(contents) > _MAX_UPLOAD_SIZE:
        raise HTTPException(
            status_code=413,
            detail={"code": "FILE_TOO_LARGE", "message": f"File exceeds {_MAX_UPLOAD_SIZE // (1024 * 1024)} MB limit"},
        )

    # Determine MIME type; fallback to generic binary if unknown
    mime = file.content_type or "application/octet-stream"
    b64 = base64.b64encode(contents).decode("utf-8")
    data_uri = f"data:{mime};base64,{b64}"

    try:
        args: dict = json.loads(arguments) if arguments else {}
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=400,
            detail={"code": "INVALID_JSON", "message": "arguments must be valid JSON"},
        )

    # Auto-detect whether this is an image or audio upload based on MIME type
    if mime.startswith("image/"):
        args["image"] = data_uri
    elif mime.startswith("audio/"):
        args["audio"] = data_uri
    else:
        # Default to image for backward compatibility
        args["image"] = data_uri

    request = CallRequest(tool=tool, arguments=args)
    response = call_tool(request)
    if response.status == "error":
        raise HTTPException(status_code=400, detail=response.error)
    return response


@app.get("/metrics", dependencies=[Depends(verify_api_key)])
def metrics():
    return get_metrics()


# ---------------------------------------------------------------------------
# Camera endpoints
# ---------------------------------------------------------------------------

def _get_camera_manager():
    cm = app.state.camera_manager
    if cm is None:
        raise HTTPException(status_code=503, detail="Camera manager not initialized")
    return cm


@app.get("/cameras", dependencies=[Depends(verify_api_key)])
def list_cameras():
    cm = _get_camera_manager()
    return {
        "available": cm.discover_cameras(),
        "active": cm.list_streams(),
    }


@app.post("/cameras/{camera_id}/start", dependencies=[Depends(verify_api_key)])
def start_camera(
    camera_id: str,
    confidence: float = Body(0.5),
    classes: list[str] = Body([]),
):
    cm = _get_camera_manager()
    available = cm.discover_cameras()
    source = None
    for cam in available:
        if cam["id"] == camera_id:
            source = cam["source"]
            break
    if source is None:
        raise HTTPException(status_code=404, detail=f"Camera '{camera_id}' not available")
    stream = cm.start_camera(camera_id, source, confidence=confidence, classes=classes or None)
    return {"camera_id": camera_id, "status": stream.status}


@app.post("/cameras/{camera_id}/stop", dependencies=[Depends(verify_api_key)])
def stop_camera(camera_id: str):
    cm = _get_camera_manager()
    cm.stop_camera(camera_id)
    return {"camera_id": camera_id, "status": "stopped"}


@app.get("/cameras/{camera_id}/frame", dependencies=[Depends(verify_api_key)])
def get_camera_frame(camera_id: str):
    cm = _get_camera_manager()
    stream = cm.get_stream(camera_id)
    if stream is None:
        raise HTTPException(status_code=404, detail=f"Camera '{camera_id}' not streaming")
    frame_bytes = stream.get_latest_frame_bytes()
    if frame_bytes is None:
        raise HTTPException(status_code=503, detail="Frame not available yet")
    return StreamingResponse(iter([frame_bytes]), media_type="image/jpeg")


@app.get("/cameras/{camera_id}/last_detection", dependencies=[Depends(verify_api_key)])
def get_last_detection(camera_id: str):
    cm = _get_camera_manager()
    stream = cm.get_stream(camera_id)
    if stream is None:
        raise HTTPException(status_code=404, detail=f"Camera '{camera_id}' not streaming")
    frame_bytes = stream.get_last_detection_bytes()
    if frame_bytes is None:
        raise HTTPException(status_code=404, detail="No detection captured yet")
    return StreamingResponse(iter([frame_bytes]), media_type="image/jpeg")


@app.get("/cameras/{camera_id}/detections", dependencies=[Depends(verify_api_key)])
def get_camera_detections(camera_id: str):
    cm = _get_camera_manager()
    stream = cm.get_stream(camera_id)
    if stream is None:
        raise HTTPException(status_code=404, detail=f"Camera '{camera_id}' not streaming")
    event = stream.get_last_detection_event()
    if event is None:
        return {"camera_id": camera_id, "detected": False}
    return {
        "camera_id": camera_id,
        "detected": True,
        "timestamp": event.timestamp,
        "confidence": event.confidence,
        "bbox": event.bbox,
        "class_name": event.class_name,
    }


@app.get("/cameras/{camera_id}/status", dependencies=[Depends(verify_api_key)])
def get_camera_status(camera_id: str):
    cm = _get_camera_manager()
    stream = cm.get_stream(camera_id)
    if stream is None:
        return {"camera_id": camera_id, "status": "idle", "fps": 0.0}
    return {"camera_id": camera_id, "status": stream.status, "fps": round(stream.fps, 1)}


@app.websocket("/ws/cameras/{camera_id}")
async def camera_websocket(
    websocket: WebSocket,
    camera_id: str,
    confidence: float = Query(0.5),
    classes: list[str] = Query([]),
):
    # Security: Verify API Key (timing-safe) before accepting WebSocket connection.
    api_key = websocket.query_params.get("api_key") or websocket.headers.get("x-api-key")
    if API_KEY:
        if not api_key or not hmac.compare_digest(api_key, API_KEY):
            await websocket.close(code=4001, reason="Invalid or missing API Key")
            return

    cm = _get_camera_manager()
    stream = cm.get_stream(camera_id)
    if stream is None:
        # Auto-start
        available = cm.discover_cameras()
        source = None
        for cam in available:
            if cam["id"] == camera_id:
                source = cam["source"]
                break
        if source is None:
            await websocket.close(code=4004, reason="Camera not found")
            return
        stream = cm.start_camera(
            camera_id, source, confidence=confidence, classes=classes or None
        )
        await asyncio.sleep(0.5)

    await websocket.accept()
    try:
        while True:
            frame_bytes = stream.get_latest_frame_bytes()
            if frame_bytes is not None:
                await websocket.send_bytes(frame_bytes)
            await asyncio.sleep(0.05)  # 20 FPS cap for WebSocket
    except WebSocketDisconnect:
        pass
    except Exception:
        pass


def _find_available_port(preferred: int, max_tries: int = 10) -> int:
    """Return the preferred port if free, otherwise scan upwards."""
    for offset in range(max_tries):
        port = preferred + offset
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            if s.connect_ex((HOST, port)) != 0:
                if offset > 0:
                    print(f"[DeepMCP] Port {preferred} in use, falling back to {port}.")
                return port
    raise RuntimeError(f"No free port found in range {preferred}..{preferred + max_tries - 1}")


if __name__ == "__main__":
    import uvicorn
    actual_port = _find_available_port(PORT)
    uvicorn.run("main:app", host=HOST, port=actual_port, reload=False)
