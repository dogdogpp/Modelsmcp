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
import random
import socket
import time
import uuid
from datetime import datetime, timedelta
from contextlib import asynccontextmanager

import base64
import json

from fastapi import FastAPI, File, Form, HTTPException, Depends, Security, UploadFile, WebSocket, WebSocketDisconnect, Query, Body, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.security.api_key import APIKeyHeader
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from config import (
    CORS_ORIGINS, HOST, MOCK_MODE, PORT, API_KEY,
    CAMERA_ENABLED, CAMERA_DEVICE_IDS,
    OPENCLAW_WEBHOOK_URL, OPENCLAW_API_KEY,
    WEBHOOK_TIMEOUT, WEBHOOK_MAX_RETRIES,
    WEBHOOK_DEDUP_WINDOW_SECONDS, WEBHOOK_DB_PATH,
    WEBHOOK_BACKOFF_BASE_SECONDS,
    COMMUNICATION_LOG_RETENTION_DAYS,
    METRICS_COLLECTION_INTERVAL,
)
from mcp.server import init_tools, get_tools, call_tool, call_tool_stream, get_metrics
from mcp.protocol import (
    CallRequest, CallResponse, SseCallRequest, format_sse,
    Incident as IncidentSchema,
    ModelStatusResponse, ModelPerformance,
    Subscription as SubscriptionSchema,
    CommunicationLog as CommunicationLogSchema,
    SubscriptionsMetrics, LatencyDistribution, ModeRatio, ThroughputHistoryPoint,
    MetricsDataPoint,
    HealthResponse, HealthModelInfo,
)
from camera import CameraManager
from webhook import WebhookQueue
from mcp.server import set_webhook_queue
import communication_settings as comm_settings

# Database imports
from db import init_db, engine, get_db, ensure_partitions
from db.models import CommunicationLog
from db.crud import (
    get_incidents,
    get_metrics_history,
    get_models_performance,
    get_communication_logs,
    get_subscriptions,
    get_latest_subscription_aggregates,
    get_latency_distribution,
    get_mode_ratios,
    create_metrics_batch,
    create_subscription_aggregate,
    get_model_meta_by_mcp_tool,
    create_communication_log,
    upsert_subscription_stats,
)

# APScheduler
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

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


# ---------------------------------------------------------------------------
# Inference recording helper
# ---------------------------------------------------------------------------

async def _record_inference(
    session: AsyncSession,
    tool_name: str,
    response: CallResponse,
    mode: str,
    payload_size_bytes: int = 0,
) -> None:
    """Write a communication log and update subscription stats atomically.

    Failures are silently logged and must NOT block the inference response.
    """
    try:
        model = await get_model_meta_by_mcp_tool(session, tool_name)
        if model is None:
            return

        latency_str = response.inference_time.replace("ms", "").strip()
        try:
            latency_ms = float(latency_str)
        except ValueError:
            latency_ms = 0.0

        now = datetime.utcnow()
        partition_key = now.strftime("%Y-%m-%d")
        success = response.status == "success"

        summary = "Inference completed"
        if isinstance(response.result, dict):
            if "detections" in response.result:
                summary = f"Detect {len(response.result['detections'])} objects"
            elif "texts" in response.result:
                summary = f"Recognize {len(response.result['texts'])} texts"
            elif "masks" in response.result:
                summary = f"Segment {len(response.result['masks'])} masks"
            elif "segments" in response.result:
                summary = f"Transcribe {len(response.result['segments'])} segments"
            elif "persons" in response.result:
                summary = f"Detect {len(response.result['persons'])} persons"
            elif "available_cameras" in response.result:
                summary = f"List {len(response.result['available_cameras'])} cameras"
            elif "image_base64" in response.result:
                summary = "Return camera frame"
            elif "detected" in response.result:
                summary = "Return last detection"
            elif "results" in response.result:
                summary = f"Encode {len(response.result['results'])} results"
            elif "embedding" in response.result:
                summary = "Extract visual features"
            elif "depth_map" in response.result:
                summary = "Estimate depth map"

        log = CommunicationLog(
            id=str(uuid.uuid4()),
            timestamp=now,
            model_id=model.id,
            model_name=model.name,
            direction="inbound",
            log_type="inference",
            mode=mode,
            status="success" if success else "error",
            latency_ms=round(latency_ms, 2),
            payload_size_bytes=payload_size_bytes,
            summary=summary,
            partition_key=partition_key,
        )
        session.add(log)

        await upsert_subscription_stats(
            session,
            model_id=model.id,
            model_name=model.name,
            latency_ms=latency_ms,
            success=success,
        )

        await session.commit()
        await session.refresh(log)
    except Exception as exc:
        print(f"[DeepMCP] Failed to record inference: {exc}")


# ---------------------------------------------------------------------------
# Background metrics collection job
# ---------------------------------------------------------------------------

async def _collect_metrics_job():
    """APScheduler job: collect system metrics and subscription aggregates."""
    from db.engine import AsyncSessionLocal
    async with AsyncSessionLocal() as session:
        now = datetime.utcnow()
        partition_key = now.strftime("%Y-%m")

        # 1. System metrics (GPU/CPU/disk)
        # For now, read from get_metrics() mock and persist
        metrics_data = get_metrics()
        batch = []

        # Latency
        batch.append({
            "timestamp": now,
            "metric_type": "latency",
            "metric_name": "avg_ms",
            "value": metrics_data.latency["avg_ms"],
            "extra_data": {"p50": metrics_data.latency["p50_ms"], "p99": metrics_data.latency["p99_ms"]},
            "partition_key": partition_key,
        })

        # Throughput
        batch.append({
            "timestamp": now,
            "metric_type": "throughput",
            "metric_name": "req_per_sec",
            "value": metrics_data.throughput["req_per_sec"],
            "partition_key": partition_key,
        })

        # System resources
        sys_data = metrics_data.system
        batch.append({
            "timestamp": now,
            "metric_type": "system",
            "metric_name": "gpu_utilization",
            "value": sys_data["gpu_utilization"],
            "partition_key": partition_key,
        })
        batch.append({
            "timestamp": now,
            "metric_type": "system",
            "metric_name": "gpu_memory_used_gb",
            "value": sys_data["gpu_memory_used_gb"],
            "partition_key": partition_key,
        })
        batch.append({
            "timestamp": now,
            "metric_type": "system",
            "metric_name": "cpu_utilization",
            "value": sys_data["cpu_utilization"],
            "partition_key": partition_key,
        })
        batch.append({
            "timestamp": now,
            "metric_type": "system",
            "metric_name": "disk_used_gb",
            "value": sys_data["disk_used_gb"],
            "partition_key": partition_key,
        })

        await create_metrics_batch(session, batch)

        # 2. Model performance jitter (update DB with slight variations)
        from mcp.server import _MOCK_MODEL_STATUS
        perf_map = {
            "yolo26": (12.0, 83.0),
            "detr": (38.0, 26.0),
            "paddleocr": (45.0, 22.0),
            "sam2": (23.0, 44.0),
            "clip": (18.0, 55.0),
            "whisper": (320.0, 3.1),
            "depth_anything": (35.0, 28.0),
            "dinov2": (28.0, 35.0),
            "yolov8_pose": (15.0, 66.0),
            "grounding_dino": (55.0, 18.0),
        }
        for model_id in _MOCK_MODEL_STATUS:
            base_lat, base_tput = perf_map.get(model_id, (25.0, 40.0))
            latency = round(base_lat + random.uniform(-1.5, 1.5), 1)
            throughput = round(base_tput + random.uniform(-2.0, 2.0), 1)
            await session.execute(
                text("UPDATE models SET latency_ms = :lat, throughput_rps = :tput, updated_at = NOW() WHERE id = :id"),
                {"lat": latency, "tput": throughput, "id": model_id},
            )
        await session.commit()

        # 3. Subscription aggregates (latency distribution, mode ratios)
        lat_dist = await get_latency_distribution(session)
        await create_subscription_aggregate(
            session,
            timestamp=now,
            metric_type="latency_dist",
            data=lat_dist,
        )

        mode_ratios = await get_mode_ratios(session)
        await create_subscription_aggregate(
            session,
            timestamp=now,
            metric_type="mode_ratio",
            data={m["mode"]: {"count": m["count"], "percentage": m["percentage"]} for m in mode_ratios},
        )

        # Throughput aggregate
        await create_subscription_aggregate(
            session,
            timestamp=now,
            metric_type="throughput",
            data={"inbound": round(40 + random.uniform(-10, 10), 1),
                  "outbound": round(20 + random.uniform(-5, 5), 1)},
        )

        # 4. Ensure partitions exist and cleanup old ones
        await ensure_partitions(engine, retention_days=COMMUNICATION_LOG_RETENTION_DAYS)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize database (tables, partitions, seed)
    await init_db(engine, retention_days=COMMUNICATION_LOG_RETENTION_DAYS)
    print("[DeepMCP] Database initialized.")

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

    # Start APScheduler background metrics collector
    scheduler = AsyncIOScheduler()
    scheduler.add_job(
        _collect_metrics_job,
        trigger=IntervalTrigger(seconds=METRICS_COLLECTION_INTERVAL),
        id="metrics_collector",
        replace_existing=True,
    )
    scheduler.start()
    print(f"[DeepMCP] Metrics collector started (interval={METRICS_COLLECTION_INTERVAL}s).")

    print("[DeepMCP] Server started. Mock mode:", MOCK_MODE)
    yield

    scheduler.shutdown(wait=False)
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
async def health(session: AsyncSession = Depends(get_db)):
    """Return health status with model list from PostgreSQL."""
    models = await get_models_performance(session)
    return HealthResponse(
        status="healthy",
        version="0.1.0",
        uptime="up",
        models=[
            HealthModelInfo(
                id=m.id,
                name=m.name,
                status=m.status,  # type: ignore[arg-type]
            )
            for m in models
        ],
    )


@app.get("/tools")
def tools():
    return get_tools()


@app.post("/call", dependencies=[Depends(verify_api_key)])
async def call(request: CallRequest, session: AsyncSession = Depends(get_db)):
    response = call_tool(request)
    if response.status == "error":
        raise HTTPException(status_code=400, detail=response.error)
    payload_size = len(json.dumps(request.arguments or {}).encode("utf-8"))
    await _record_inference(session, request.tool, response, mode="HTTP", payload_size_bytes=payload_size)
    return response


@app.post("/sse", dependencies=[Depends(verify_api_key)])
async def sse_call(request: SseCallRequest, raw_request: Request, session: AsyncSession = Depends(get_db)):
    """Stream tool execution results via Server-Sent Events.

    Emits ``progress`` events during inference, followed by either a
    ``result`` or ``error`` event. Heartbeats are sent every 15 s to keep
    the connection alive for long-running operations.
    """
    if not comm_settings.is_enabled("sse_send"):
        raise HTTPException(status_code=503, detail="sse_send disabled")
    queue: asyncio.Queue[str | None] = asyncio.Queue()

    async def producer():
        response: CallResponse | None = None
        try:
            async for event_dict in call_tool_stream(
                CallRequest(tool=request.tool, arguments=request.arguments)
            ):
                await queue.put(format_sse(event_dict["event"], event_dict["data"]))
                if event_dict["event"] == "result":
                    response = CallResponse(**event_dict["data"])
                    break
                elif event_dict["event"] == "error":
                    response = CallResponse(
                        status="error",
                        model=request.tool,
                        inference_time="0ms",
                        device="cpu",
                        result=None,
                        error=event_dict["data"],
                    )
                    break
        except Exception as e:
            await queue.put(format_sse("error", {"code": "STREAM_ERROR", "message": str(e)}))
            response = CallResponse(
                status="error",
                model=request.tool,
                inference_time="0ms",
                device="cpu",
                result=None,
                error={"code": "STREAM_ERROR", "message": str(e)},
            )
        finally:
            await queue.put(None)  # sentinel to signal completion
            if response is not None:
                payload_size = len(json.dumps(request.arguments or {}).encode("utf-8"))
                try:
                    await _record_inference(session, request.tool, response, mode="SSE", payload_size_bytes=payload_size)
                except Exception:
                    pass

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
    session: AsyncSession = Depends(get_db),
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
    await _record_inference(session, tool, response, mode="HTTP", payload_size_bytes=len(contents))
    return response


@app.get("/metrics", dependencies=[Depends(verify_api_key)])
async def metrics(session: AsyncSession = Depends(get_db)):
    """Return metrics from PostgreSQL with webhook data from memory."""
    from sqlalchemy import select, desc
    from db.models import Metric

    # 1. System resources — latest value for each metric_name
    system = {
        "gpu_utilization": 0,
        "gpu_memory_used_gb": 0.0,
        "gpu_memory_total_gb": 24.0,
        "cpu_utilization": 0,
        "disk_used_gb": 0.0,
    }
    for name in ["gpu_utilization", "gpu_memory_used_gb", "cpu_utilization", "disk_used_gb"]:
        result = await session.execute(
            select(Metric)
            .where(Metric.metric_type == "system", Metric.metric_name == name)
            .order_by(desc(Metric.timestamp))
            .limit(1)
        )
        row = result.scalar_one_or_none()
        if row is not None:
            system[name] = row.value

    # 2. Latency history (last 20 points)
    lat_rows = await get_metrics_history(
        session, metric_type="latency", metric_name="avg_ms", hours=1
    )
    latency_history = [
        MetricsDataPoint(
            timestamp=r.timestamp.isoformat(), value=r.value
        ).model_dump()
        for r in lat_rows[-20:]
    ]
    if not latency_history:
        latency_history = [MetricsDataPoint(timestamp=datetime.utcnow().isoformat(), value=0.0).model_dump()]
    latest_lat = lat_rows[-1].value if lat_rows else 0.0

    # 3. Throughput history (last 20 points)
    tput_rows = await get_metrics_history(
        session, metric_type="throughput", metric_name="req_per_sec", hours=1
    )
    throughput_history = [
        MetricsDataPoint(
            timestamp=r.timestamp.isoformat(), value=r.value
        ).model_dump()
        for r in tput_rows[-20:]
    ]
    if not throughput_history:
        throughput_history = [MetricsDataPoint(timestamp=datetime.utcnow().isoformat(), value=0.0).model_dump()]
    latest_tput = tput_rows[-1].value if tput_rows else 0.0

    # 4. Webhook metrics (still from memory)
    mem_metrics = get_metrics()

    return {
        "latency": {
            "avg_ms": latest_lat,
            "p50_ms": latest_lat,
            "p99_ms": latest_lat,
            "history": latency_history,
        },
        "throughput": {
            "req_per_sec": latest_tput,
            "history": throughput_history,
        },
        "system": system,
        "webhook": mem_metrics.webhook,
    }


# ---------------------------------------------------------------------------
# MCP SSE transport endpoint (standard MCP HTTP+SSE transport)
# ---------------------------------------------------------------------------

_mcp_sessions: dict[str, asyncio.Queue[str | None]] = {}


@app.get("/sse")
async def mcp_sse_endpoint(raw_request: Request):
    """MCP SSE transport endpoint.

    Follows the standard MCP HTTP+SSE transport protocol:
    1. Client connects via GET /sse
    2. Server sends ``event: endpoint`` with a JSON-RPC POST URL
    3. Client POSTs JSON-RPC messages to that URL
    4. Server may push responses back through this SSE connection
    """
    if not comm_settings.is_enabled("sse_receive"):
        raise HTTPException(status_code=503, detail="sse_receive disabled")

    session_id = str(uuid.uuid4())
    queue: asyncio.Queue[str | None] = asyncio.Queue()
    _mcp_sessions[session_id] = queue

    async def event_stream():
        try:
            # Send the endpoint event so the client knows where to POST messages
            endpoint_url = f"/messages?session_id={session_id}"
            yield f"event: endpoint\ndata: {endpoint_url}\n\n"

            # Keep connection alive and forward any queued messages
            while True:
                if await raw_request.is_disconnected():
                    break
                try:
                    msg = await asyncio.wait_for(queue.get(), timeout=15.0)
                    if msg is None:
                        break
                    yield msg
                except asyncio.TimeoutError:
                    yield format_sse("heartbeat", {})
        finally:
            _mcp_sessions.pop(session_id, None)

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.post("/messages", dependencies=[Depends(verify_api_key)])
async def mcp_messages(session_id: str = Query(...), raw_request: Request = None, session: AsyncSession = Depends(get_db)):
    """Receive JSON-RPC messages for MCP SSE transport."""
    body = await raw_request.json()

    method = body.get("method", "")
    params = body.get("params", {})
    req_id = body.get("id")

    if method == "initialize":
        result = {
            "jsonrpc": "2.0",
            "id": req_id,
            "result": {
                "protocolVersion": "2024-11-05",
                "capabilities": {},
                "serverInfo": {"name": "deepmcp", "version": "0.2.0"},
            },
        }
    elif method == "notifications/initialized":
        # Notification — no response required
        return {"ok": True}
    elif method == "tools/list":
        tools_response = get_tools()
        result = {
            "jsonrpc": "2.0",
            "id": req_id,
            "result": tools_response.model_dump(),
        }
    elif method == "tools/call":
        tool_name = params.get("name", "")
        arguments = params.get("arguments", {})
        response = call_tool(CallRequest(tool=tool_name, arguments=arguments))
        payload_size = len(json.dumps(arguments or {}).encode("utf-8"))
        try:
            await _record_inference(session, tool_name, response, mode="SSE", payload_size_bytes=payload_size)
        except Exception:
            pass
        result = {
            "jsonrpc": "2.0",
            "id": req_id,
            "result": response.model_dump(),
        }
    else:
        result = {
            "jsonrpc": "2.0",
            "id": req_id,
            "error": {
                "code": -32601,
                "message": f"Method not found: {method}",
            },
        }

    # Also push the response to the SSE queue so the client can receive it via SSE
    queue = _mcp_sessions.get(session_id)
    if queue is not None:
        await queue.put(f"event: message\ndata: {json.dumps(result)}\n\n")

    return result


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

    await websocket.accept()

    if not comm_settings.is_enabled("websocket_bidirectional"):
        await websocket.close(code=4003, reason="websocket_bidirectional disabled")
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


# ---------------------------------------------------------------------------
# Communication settings endpoints
# ---------------------------------------------------------------------------

@app.get("/settings/communication", dependencies=[Depends(verify_api_key)])
def get_communication_settings():
    """Return current communication switch states and operation logs."""
    return comm_settings.get_settings()


@app.post("/settings/communication/{key}", dependencies=[Depends(verify_api_key)])
def update_communication_switch(key: str, value: bool = Body(..., embed=True)):
    """Toggle a single communication switch and record the operation log."""
    try:
        return comm_settings.set_switch(key, value)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ---------------------------------------------------------------------------
# Incident / Event endpoints (DB-backed)
# ---------------------------------------------------------------------------

@app.get("/incidents")
async def list_incidents(session: AsyncSession = Depends(get_db)):
    """Return recent system events and incidents from DB."""
    rows = await get_incidents(session, limit=50)
    return [
        IncidentSchema(
            id=r.id,
            time=r.time,
            type=r.type,
            msg=r.msg,
            source=r.source,
        )
        for r in rows
    ]


# ---------------------------------------------------------------------------
# Model performance endpoint (DB-backed)
# ---------------------------------------------------------------------------

@app.get("/models/status")
async def model_status(session: AsyncSession = Depends(get_db)):
    """Return per-model latency and throughput metrics from DB."""
    rows = await get_models_performance(session)
    models = []
    for r in rows:
        models.append(ModelPerformance(
            id=r.id,
            latency_ms=round(r.latency_ms, 1),
            throughput_rps=round(r.throughput_rps, 1),
        ))
    return ModelStatusResponse(models=models)


# ---------------------------------------------------------------------------
# Subscription endpoints (DB-backed)
# ---------------------------------------------------------------------------

@app.get("/subscriptions")
async def list_subscriptions(session: AsyncSession = Depends(get_db)):
    """Return the list of model subscriptions from DB."""
    rows = await get_subscriptions(session)
    return [
        SubscriptionSchema(
            id=r.id,
            model_id=r.model_id,
            model_name=r.model_name,
            status=r.status,
            subscribed_at=r.subscribed_at.isoformat(),
            last_active_at=r.last_active_at.isoformat(),
            total_calls=r.total_calls,
            success_rate=r.success_rate,
            avg_latency_ms=r.avg_latency_ms,
        )
        for r in rows
    ]


@app.get("/subscriptions/logs")
async def list_subscription_logs(
    session: AsyncSession = Depends(get_db),
    limit: int = Query(50, ge=1, le=200),
):
    """Return communication logs for subscriptions from DB."""
    rows = await get_communication_logs(session, limit=limit)
    return [
        CommunicationLogSchema(
            id=r.id,
            timestamp=r.timestamp.isoformat(),
            model_id=r.model_id,
            model_name=r.model_name,
            direction=r.direction,
            type=r.log_type,
            mode=r.mode,
            status=r.status,
            latency_ms=r.latency_ms,
            payload_size_bytes=r.payload_size_bytes,
            summary=r.summary,
        )
        for r in rows
    ]


@app.get("/subscriptions/metrics")
async def subscription_metrics(session: AsyncSession = Depends(get_db)):
    """Return aggregated subscription metrics from DB."""
    aggregates = await get_latest_subscription_aggregates(session)

    lat_dist = LatencyDistribution(p50_ms=0.0, p95_ms=0.0, p99_ms=0.0)
    mode_data = []
    throughput_data = []

    for agg in aggregates:
        if agg.metric_type == "latency_dist":
            lat_dist = LatencyDistribution(
                p50_ms=agg.data.get("p50_ms", 0.0),
                p95_ms=agg.data.get("p95_ms", 0.0),
                p99_ms=agg.data.get("p99_ms", 0.0),
            )
        elif agg.metric_type == "mode_ratio":
            for mode, info in agg.data.items():
                mode_data.append(ModeRatio(
                    mode=mode,
                    count=info.get("count", 0),
                    percentage=info.get("percentage", 0.0),
                ))
        elif agg.metric_type == "throughput":
            # Return recent throughput history from aggregates
            throughput_data.append(ThroughputHistoryPoint(
                timestamp=agg.timestamp.isoformat(),
                inbound=agg.data.get("inbound", 0.0),
                outbound=agg.data.get("outbound", 0.0),
            ))

    # Fallback if no aggregates found
    if not mode_data:
        mode_data = [
            ModeRatio(mode="HTTP", count=0, percentage=0.0),
        ]

    # Build a simple throughput history (last 20 aggregates)
    # For now, return what we have; frontend expects a list
    if len(throughput_data) < 20:
        # Fill with the same point repeated for visual continuity
        last = throughput_data[-1] if throughput_data else ThroughputHistoryPoint(
            timestamp=datetime.utcnow().isoformat(), inbound=0.0, outbound=0.0,
        )
        while len(throughput_data) < 20:
            throughput_data.insert(0, last)

    return SubscriptionsMetrics(
        latency_distribution=lat_dist,
        mode_ratios=mode_data,
        throughput_history=throughput_data[-20:],
    )


# ---------------------------------------------------------------------------
# Metrics endpoint (DB-backed history)
# ---------------------------------------------------------------------------

@app.get("/metrics/history")
async def metrics_history(
    session: AsyncSession = Depends(get_db),
    metric_type: str = Query(...),
    metric_name: str | None = Query(None),
    hours: int = Query(24, ge=1, le=168),
):
    """Return time-series metrics from DB."""
    rows = await get_metrics_history(session, metric_type=metric_type, metric_name=metric_name, hours=hours)
    return [
        {
            "timestamp": r.timestamp.isoformat(),
            "metric_type": r.metric_type,
            "metric_name": r.metric_name,
            "value": r.value,
            "extra_data": r.extra_data,
        }
        for r in rows
    ]


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
