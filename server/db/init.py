"""Database initialization: create tables, partitions, and seed data."""

from datetime import datetime, timedelta
import uuid

from sqlalchemy.ext.asyncio import AsyncEngine
from sqlalchemy import select

from .engine import engine
from .base import Base
from .partition import ensure_partitions
from .models import ModelMeta, Incident, Subscription, CommunicationLog, SubscriptionAggregate, Metric


# Seed data derived from frontend models.ts
MODEL_SEEDS = [
    {
        "id": "yolo2026", "name": "YOLO2026", "category": "目标检测", "version": "8.3.0",
        "description": "实时目标检测与分割，支持80+类别识别，毫秒级推理速度",
        "long_description": "YOLO2026 是 Ultralytics 推出的最新一代目标检测模型...",
        "params": "43M", "framework": "PyTorch / ONNX", "license": "AGPL-3.0",
        "color": "#00d4ff", "icon": "🎯", "mcp_tool": "yolo2026_detect",
        "input_types": ["image/jpeg", "image/png", "video/mp4"],
        "output_types": ["application/json"],
        "tags": ["COCO", "实时", "多任务", "ONNX"],
        "use_cases": ["安防监控", "自动驾驶", "工业质检", "人流统计"],
        "status": "online", "latency_ms": 12.0, "throughput_rps": 83.0,
    },
    {
        "id": "whisper", "name": "Whisper", "category": "语音识别", "version": "large-v3",
        "description": "OpenAI多语言语音识别，支持99种语言的转录与翻译",
        "long_description": "Whisper 是 OpenAI 开源的自动语音识别系统...",
        "params": "1.5B", "framework": "PyTorch", "license": "MIT",
        "color": "#06b6d4", "icon": "🎙️", "mcp_tool": "whisper_transcribe",
        "input_types": ["audio/wav", "audio/mp3", "audio/flac", "audio/m4a"],
        "output_types": ["application/json", "text/plain"],
        "tags": ["多语言", "翻译", "转录", "噪声鲁棒"],
        "use_cases": ["会议记录", "字幕生成", "语音翻译", "播客转录"],
        "status": "online", "latency_ms": 320.0, "throughput_rps": 3.1,
    },
]

INCIDENT_SEEDS = []

SUBSCRIPTION_SEEDS = [
    {"id": "sub-001", "model_id": "yolo2026", "model_name": "YOLO2026", "status": "active",
     "subscribed_at": datetime(2026, 4, 20, 8, 0, 0), "last_active_at": datetime(2026, 5, 13, 6, 30, 0),
     "total_calls": 12450, "success_rate": 0.994, "avg_latency_ms": 12.3},
    {"id": "sub-003", "model_id": "whisper", "model_name": "Whisper", "status": "paused",
     "subscribed_at": datetime(2026, 3, 15, 14, 0, 0), "last_active_at": datetime(2026, 5, 10, 18, 0, 0),
     "total_calls": 5420, "success_rate": 0.987, "avg_latency_ms": 318.5},
]

LOG_SEEDS = [
    {"id": "log-001", "timestamp": datetime(2026, 5, 13, 6, 30, 0), "model_id": "yolo2026", "model_name": "YOLO2026",
     "direction": "inbound", "log_type": "inference", "mode": "HTTP", "status": "success",
     "latency_ms": 11.2, "payload_size_bytes": 245760, "summary": "Detect 2 objects (person, car)"},
    {"id": "log-003", "timestamp": datetime(2026, 5, 13, 6, 29, 30), "model_id": "whisper", "model_name": "Whisper",
     "direction": "inbound", "log_type": "inference", "mode": "Webhook", "status": "success",
     "latency_ms": 312.0, "payload_size_bytes": 102400, "summary": "Transcribe 3.2s audio"},
    {"id": "log-004", "timestamp": datetime(2026, 5, 13, 6, 29, 15), "model_id": "yolo2026", "model_name": "YOLO2026",
     "direction": "outbound", "log_type": "webhook", "mode": "Webhook", "status": "success",
     "latency_ms": 45.0, "payload_size_bytes": 2048, "summary": "Delivery to OpenClaw"},
]


def _partition_key_from_dt(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%d")


async def init_db(engine: AsyncEngine, retention_days: int = 7) -> None:
    """Create tables, partitions, and seed data if tables are empty."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    await ensure_partitions(engine, retention_days=retention_days)

    from .engine import AsyncSessionLocal
    async with AsyncSessionLocal() as session:
        # Seed models
        result = await session.execute(select(ModelMeta).limit(1))
        if result.scalar_one_or_none() is None:
            for m in MODEL_SEEDS:
                session.add(ModelMeta(**m))

        # Seed incidents
        result = await session.execute(select(Incident).limit(1))
        if result.scalar_one_or_none() is None:
            for inc in INCIDENT_SEEDS:
                session.add(Incident(**inc))

        # Seed subscriptions
        result = await session.execute(select(Subscription).limit(1))
        if result.scalar_one_or_none() is None:
            for sub in SUBSCRIPTION_SEEDS:
                session.add(Subscription(**sub))

        # Seed communication logs
        result = await session.execute(select(CommunicationLog).limit(1))
        if result.scalar_one_or_none() is None:
            for log in LOG_SEEDS:
                log["partition_key"] = _partition_key_from_dt(log["timestamp"])
                session.add(CommunicationLog(**log))

        # Seed one initial subscription aggregate
        result = await session.execute(select(SubscriptionAggregate).limit(1))
        if result.scalar_one_or_none() is None:
            session.add(SubscriptionAggregate(
                id=uuid.uuid4(),
                timestamp=datetime.utcnow(),
                metric_type="latency_dist",
                data={"p50_ms": 22.0, "p95_ms": 85.0, "p99_ms": 320.0},
            ))
            session.add(SubscriptionAggregate(
                id=uuid.uuid4(),
                timestamp=datetime.utcnow(),
                metric_type="mode_ratio",
                data={
                    "HTTP": {"count": 4200, "percentage": 42.0},
                    "SSE": {"count": 2800, "percentage": 28.0},
                    "Webhook": {"count": 1800, "percentage": 18.0},
                    "WebSocket": {"count": 900, "percentage": 9.0},
                    "Redis": {"count": 300, "percentage": 3.0},
                },
            ))
            # Seed 20 throughput aggregates for smooth cold-start curve
            now = datetime.utcnow()
            for i in range(20):
                ts = now - timedelta(seconds=15 * (19 - i))
                session.add(SubscriptionAggregate(
                    id=uuid.uuid4(),
                    timestamp=ts,
                    metric_type="throughput",
                    data={
                        "inbound": round(40.0 + i * 0.5, 1),
                        "outbound": round(18.0 + i * 0.3, 1),
                    },
                ))

            # Seed initial metrics so /metrics endpoint has data on first load
            partition_key = now.strftime("%Y-%m")
            for i in range(20):
                ts = now - timedelta(seconds=15 * (19 - i))
                session.add(Metric(
                    timestamp=ts,
                    metric_type="system",
                    metric_name="gpu_utilization",
                    value=round(60.0 + (i % 5) * 2, 1),
                    partition_key=partition_key,
                ))
                session.add(Metric(
                    timestamp=ts,
                    metric_type="system",
                    metric_name="cpu_utilization",
                    value=round(20.0 + (i % 3), 1),
                    partition_key=partition_key,
                ))
                session.add(Metric(
                    timestamp=ts,
                    metric_type="latency",
                    metric_name="avg_ms",
                    value=round(20.0 + (i % 5) * 2, 1),
                    partition_key=partition_key,
                ))
                session.add(Metric(
                    timestamp=ts,
                    metric_type="throughput",
                    metric_name="req_per_sec",
                    value=round(50.0 + (i % 4) * 3, 1),
                    partition_key=partition_key,
                ))

        await session.commit()
