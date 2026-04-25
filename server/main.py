"""DeepMCP FastAPI Server entry point."""

import asyncio
import hmac
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Depends, Security, WebSocket, WebSocketDisconnect, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.security.api_key import APIKeyHeader

from config import (
    CORS_ORIGINS, HOST, MOCK_MODE, PORT, API_KEY,
    CAMERA_ENABLED, CAMERA_DEVICE_IDS,
)
from mcp.server import init_tools, get_tools, call_tool, get_health, get_metrics
from mcp.protocol import CallRequest
from camera import CameraManager

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
    camera_manager = None
    if CAMERA_ENABLED:
        from mcp.server import _load_yolo_model
        yolo_model = _load_yolo_model("yolo26n")
        camera_manager = CameraManager(yolo_model)
        # Auto-start configured cameras
        available = camera_manager.discover_cameras()
        for cam in available:
            camera_manager.start_camera(cam["id"], cam["source"])
        print(f"[DeepMCP] Camera manager initialized. Auto-started {len(available)} camera(s).")
    init_tools(MOCK_MODE, camera_manager)
    app.state.camera_manager = camera_manager
    print("[DeepMCP] Server started. Mock mode:", MOCK_MODE)
    yield
    if camera_manager is not None:
        camera_manager.stop_all()
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
def start_camera(camera_id: str):
    cm = _get_camera_manager()
    available = cm.discover_cameras()
    source = None
    for cam in available:
        if cam["id"] == camera_id:
            source = cam["source"]
            break
    if source is None:
        raise HTTPException(status_code=404, detail=f"Camera '{camera_id}' not available")
    stream = cm.start_camera(camera_id, source)
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
    }


@app.get("/cameras/{camera_id}/status", dependencies=[Depends(verify_api_key)])
def get_camera_status(camera_id: str):
    cm = _get_camera_manager()
    stream = cm.get_stream(camera_id)
    if stream is None:
        return {"camera_id": camera_id, "status": "idle", "fps": 0.0}
    return {"camera_id": camera_id, "status": stream.status, "fps": round(stream.fps, 1)}


@app.websocket("/ws/cameras/{camera_id}")
async def camera_websocket(websocket: WebSocket, camera_id: str):
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
        stream = cm.start_camera(camera_id, source)
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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=HOST, port=PORT, reload=False)
