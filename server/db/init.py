"""Database initialization: create tables, partitions, and seed data."""

from datetime import datetime, timedelta
import uuid

from sqlalchemy.ext.asyncio import AsyncEngine
from sqlalchemy import select

from .engine import engine
from .base import Base
from .partition import ensure_partitions
from .models import ModelMeta, Incident, Subscription, CommunicationLog, SubscriptionAggregate


# Seed data derived from frontend models.ts
MODEL_SEEDS = [
    {
        "id": "yolo26", "name": "YOLO2026", "category": "目标检测", "version": "8.3.0",
        "description": "实时目标检测与分割，支持80+类别识别，毫秒级推理速度",
        "long_description": "YOLO2026 是 Ultralytics 推出的最新一代目标检测模型...",
        "params": "43M", "framework": "PyTorch / ONNX", "license": "AGPL-3.0",
        "color": "#00d4ff", "icon": "🎯", "mcp_tool": "yolo26_detect",
        "input_types": ["image/jpeg", "image/png", "video/mp4"],
        "output_types": ["application/json"],
        "tags": ["COCO", "实时", "多任务", "ONNX"],
        "use_cases": ["安防监控", "自动驾驶", "工业质检", "人流统计"],
        "status": "online", "latency_ms": 12.0, "throughput_rps": 83.0,
    },
    {
        "id": "detr", "name": "DETR", "category": "目标检测", "version": "1.2.0",
        "description": "基于Transformer的端到端目标检测，无需NMS后处理",
        "long_description": "DETR (Detection Transformer) 是 Facebook AI 提出的革命性目标检测模型...",
        "params": "41M", "framework": "PyTorch", "license": "Apache-2.0",
        "color": "#7c3aed", "icon": "🔲", "mcp_tool": "detr_detect",
        "input_types": ["image/jpeg", "image/png"],
        "output_types": ["application/json"],
        "tags": ["Transformer", "端到端", "COCO", "ResNet"],
        "use_cases": ["精准检测", "全景分割", "场景理解", "图像标注"],
        "status": "online", "latency_ms": 38.0, "throughput_rps": 26.0,
    },
    {
        "id": "paddleocr", "name": "PaddleOCR", "category": "文字识别", "version": "2.8.0",
        "description": "支持80+语言的高精度OCR，包含文本检测、方向分类、识别全流水线",
        "long_description": "PaddleOCR 是百度开源的超轻量OCR系统...",
        "params": "12M", "framework": "PaddlePaddle", "license": "Apache-2.0",
        "color": "#00ff88", "icon": "📝", "mcp_tool": "paddleocr_recognize",
        "input_types": ["image/jpeg", "image/png", "image/tiff"],
        "output_types": ["application/json"],
        "tags": ["多语言", "中文", "表格", "轻量"],
        "use_cases": ["文档数字化", "票据识别", "车牌识别", "标签提取"],
        "status": "online", "latency_ms": 45.0, "throughput_rps": 22.0,
    },
    {
        "id": "sam2", "name": "SAM 2", "category": "图像分割", "version": "2.1.0",
        "description": "Segment Anything Model 2，支持图像和视频的零样本分割",
        "long_description": "SAM 2 是 Meta AI 发布的第二代 Segment Anything Model...",
        "params": "224M", "framework": "PyTorch", "license": "Apache-2.0",
        "color": "#f59e0b", "icon": "✂️", "mcp_tool": "sam2_segment",
        "input_types": ["image/jpeg", "image/png", "video/mp4"],
        "output_types": ["image/png", "application/json"],
        "tags": ["零样本", "视频", "交互式", "多模态"],
        "use_cases": ["图像编辑", "医学影像", "遥感分析", "视频剪辑"],
        "status": "online", "latency_ms": 23.0, "throughput_rps": 44.0,
    },
    {
        "id": "clip", "name": "CLIP", "category": "多模态", "version": "ViT-L/14",
        "description": "OpenAI图文对比学习模型，支持零样本图像分类与图文检索",
        "long_description": "CLIP (Contrastive Language-Image Pre-training) 是 OpenAI 开发的多模态模型...",
        "params": "307M", "framework": "PyTorch", "license": "MIT",
        "color": "#ec4899", "icon": "🔗", "mcp_tool": "clip_encode",
        "input_types": ["image/jpeg", "image/png", "text/plain"],
        "output_types": ["application/json"],
        "tags": ["零样本", "图文", "Embedding", "检索"],
        "use_cases": ["图像搜索", "内容审核", "相似度排序", "标签生成"],
        "status": "online", "latency_ms": 18.0, "throughput_rps": 55.0,
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
    {
        "id": "depth-anything", "name": "Depth Anything V2", "category": "深度估计", "version": "2.0.0",
        "description": "单目深度估计SOTA模型，生成高质量深度图，支持室内外场景",
        "long_description": "Depth Anything V2 是港大发布的单目深度估计模型...",
        "params": "335M", "framework": "PyTorch", "license": "Apache-2.0",
        "color": "#10b981", "icon": "📐", "mcp_tool": "depth_estimate",
        "input_types": ["image/jpeg", "image/png"],
        "output_types": ["image/png", "application/json"],
        "tags": ["单目", "SLAM", "三维重建", "室内外"],
        "use_cases": ["三维重建", "AR增强", "机器人导航", "自动驾驶"],
        "status": "online", "latency_ms": 35.0, "throughput_rps": 28.0,
    },
    {
        "id": "dinov2", "name": "DINOv2", "category": "视觉特征", "version": "2.0.0",
        "description": "Meta自监督视觉基础模型，提取通用视觉特征用于下游任务",
        "long_description": "DINOv2 是 Meta 提出的自监督视觉基础模型...",
        "params": "307M", "framework": "PyTorch", "license": "Apache-2.0",
        "color": "#8b5cf6", "icon": "🧠", "mcp_tool": "dinov2_embed",
        "input_types": ["image/jpeg", "image/png"],
        "output_types": ["application/json"],
        "tags": ["自监督", "特征提取", "ViT", "基础模型"],
        "use_cases": ["图像检索", "少样本学习", "异常检测", "聚类分析"],
        "status": "loading", "latency_ms": 28.0, "throughput_rps": 35.0,
    },
    {
        "id": "yolov8-pose", "name": "YOLOv8-Pose", "category": "姿态估计", "version": "8.3.0",
        "description": "17关键点人体姿态估计，支持多人实时检测，精度业界领先",
        "long_description": "YOLOv8-Pose 专为人体姿态估计设计...",
        "params": "26M", "framework": "PyTorch / ONNX", "license": "AGPL-3.0",
        "color": "#f97316", "icon": "🏃", "mcp_tool": "pose_estimate",
        "input_types": ["image/jpeg", "image/png", "video/mp4"],
        "output_types": ["application/json", "image/jpeg"],
        "tags": ["关键点", "多人", "骨架", "COCO"],
        "use_cases": ["运动分析", "健身指导", "行为识别", "人机交互"],
        "status": "online", "latency_ms": 15.0, "throughput_rps": 66.0,
    },
    {
        "id": "grounding-dino", "name": "Grounding DINO", "category": "开放词汇", "version": "1.5.0",
        "description": "开放词汇目标检测，通过文本描述检测任意类别，无需预定义类别",
        "long_description": "Grounding DINO 将 DINO 检测器与文本编码器结合...",
        "params": "172M", "framework": "PyTorch", "license": "Apache-2.0",
        "color": "#ef4444", "icon": "🔍", "mcp_tool": "grounding_dino_detect",
        "input_types": ["image/jpeg", "image/png"],
        "output_types": ["application/json"],
        "tags": ["开放词汇", "文本引导", "零样本", "DINO"],
        "use_cases": ["开放域检测", "机器人视觉", "VQA", "内容理解"],
        "status": "online", "latency_ms": 55.0, "throughput_rps": 18.0,
    },
]

INCIDENT_SEEDS = [
    {"id": "evt-001", "time": "2026-05-13 10:23", "type": "info", "msg": "SAM2 模型权重更新至 v2.1.0", "source": "model_registry", "created_by": "system"},
    {"id": "evt-002", "time": "2026-05-12 14:55", "type": "warning", "msg": "DINOv2 模型冷启动加载中（预计 2 分钟）", "source": "inference_engine", "created_by": "system"},
    {"id": "evt-003", "time": "2026-05-11 09:10", "type": "info", "msg": "新增 Grounding DINO v1.5 支持", "source": "model_registry", "created_by": "system"},
    {"id": "evt-004", "time": "2026-05-09 16:00", "type": "resolved", "msg": "GPU 显存不足问题已修复（已优化批处理队列）", "source": "system", "created_by": "system"},
]

SUBSCRIPTION_SEEDS = [
    {"id": "sub-001", "model_id": "yolo26", "model_name": "YOLO2026", "status": "active",
     "subscribed_at": datetime(2026, 4, 20, 8, 0, 0), "last_active_at": datetime(2026, 5, 13, 6, 30, 0),
     "total_calls": 12450, "success_rate": 0.994, "avg_latency_ms": 12.3},
    {"id": "sub-002", "model_id": "sam2", "model_name": "SAM 2", "status": "active",
     "subscribed_at": datetime(2026, 4, 22, 10, 0, 0), "last_active_at": datetime(2026, 5, 13, 6, 25, 0),
     "total_calls": 8320, "success_rate": 0.998, "avg_latency_ms": 23.1},
    {"id": "sub-003", "model_id": "whisper", "model_name": "Whisper", "status": "paused",
     "subscribed_at": datetime(2026, 3, 15, 14, 0, 0), "last_active_at": datetime(2026, 5, 10, 18, 0, 0),
     "total_calls": 5420, "success_rate": 0.987, "avg_latency_ms": 318.5},
    {"id": "sub-004", "model_id": "clip", "model_name": "CLIP", "status": "active",
     "subscribed_at": datetime(2026, 5, 1, 9, 0, 0), "last_active_at": datetime(2026, 5, 13, 6, 28, 0),
     "total_calls": 3890, "success_rate": 0.996, "avg_latency_ms": 18.2},
]

LOG_SEEDS = [
    {"id": "log-001", "timestamp": datetime(2026, 5, 13, 6, 30, 0), "model_id": "yolo26", "model_name": "YOLO2026",
     "direction": "inbound", "log_type": "inference", "mode": "HTTP", "status": "success",
     "latency_ms": 11.2, "payload_size_bytes": 245760, "summary": "Detect 2 objects (person, car)"},
    {"id": "log-002", "timestamp": datetime(2026, 5, 13, 6, 29, 45), "model_id": "sam2", "model_name": "SAM 2",
     "direction": "inbound", "log_type": "inference", "mode": "SSE", "status": "success",
     "latency_ms": 24.5, "payload_size_bytes": 184320, "summary": "Segment 3 masks"},
    {"id": "log-003", "timestamp": datetime(2026, 5, 13, 6, 29, 30), "model_id": "whisper", "model_name": "Whisper",
     "direction": "inbound", "log_type": "inference", "mode": "Webhook", "status": "success",
     "latency_ms": 312.0, "payload_size_bytes": 102400, "summary": "Transcribe 3.2s audio"},
    {"id": "log-004", "timestamp": datetime(2026, 5, 13, 6, 29, 15), "model_id": "yolo26", "model_name": "YOLO2026",
     "direction": "outbound", "log_type": "webhook", "mode": "Webhook", "status": "success",
     "latency_ms": 45.0, "payload_size_bytes": 2048, "summary": "Delivery to OpenClaw"},
    {"id": "log-005", "timestamp": datetime(2026, 5, 13, 6, 29, 0), "model_id": "clip", "model_name": "CLIP",
     "direction": "inbound", "log_type": "inference", "mode": "WebSocket", "status": "success",
     "latency_ms": 17.8, "payload_size_bytes": 153600, "summary": "Classify 5 text prompts"},
    {"id": "log-006", "timestamp": datetime(2026, 5, 13, 6, 28, 40), "model_id": "grounding-dino", "model_name": "Grounding DINO",
     "direction": "inbound", "log_type": "inference", "mode": "Redis", "status": "error",
     "latency_ms": 1200.0, "payload_size_bytes": 204800, "summary": "Timeout after 1.2s"},
    {"id": "log-007", "timestamp": datetime(2026, 5, 13, 6, 28, 20), "model_id": "depth-anything", "model_name": "Depth Anything V2",
     "direction": "inbound", "log_type": "inference", "mode": "HTTP", "status": "success",
     "latency_ms": 34.2, "payload_size_bytes": 307200, "summary": "Estimate depth map"},
    {"id": "log-008", "timestamp": datetime(2026, 5, 13, 6, 28, 0), "model_id": "yolov8-pose", "model_name": "YOLOv8-Pose",
     "direction": "inbound", "log_type": "inference", "mode": "SSE", "status": "success",
     "latency_ms": 14.5, "payload_size_bytes": 245760, "summary": "Detect 4 persons with keypoints"},
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
            session.add(SubscriptionAggregate(
                id=uuid.uuid4(),
                timestamp=datetime.utcnow(),
                metric_type="throughput",
                data={"inbound": 45.0, "outbound": 22.0},
            ))

        await session.commit()
