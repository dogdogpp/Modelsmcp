"""MCP (Model Context Protocol) type definitions."""

import json
from typing import Any, Literal
from pydantic import BaseModel


class McpParameterSchema(BaseModel):
    type: str
    description: str
    enum: list[str] | None = None
    default: Any | None = None


class McpToolSchema(BaseModel):
    name: str
    description: str
    inputSchema: dict[str, Any]


class ToolsResponse(BaseModel):
    tools: list[McpToolSchema]


class CallRequest(BaseModel):
    tool: str
    arguments: dict[str, Any]


class CallResponse(BaseModel):
    status: Literal["success", "error"]
    model: str
    inference_time: str
    device: str
    result: Any
    error: dict[str, str] | None = None


class HealthModelInfo(BaseModel):
    id: str
    name: str
    status: Literal["online", "loading", "offline"]


class HealthResponse(BaseModel):
    status: Literal["healthy", "degraded", "unhealthy"]
    version: str
    uptime: str
    models: list[HealthModelInfo]


class MetricsDataPoint(BaseModel):
    timestamp: str
    value: float


class MetricsResponse(BaseModel):
    latency: dict[str, Any]
    throughput: dict[str, Any]
    system: dict[str, Any]
    webhook: dict[str, Any] | None = None


class ApiErrorResponse(BaseModel):
    error: dict[str, Any]


# ---------------------------------------------------------------------------
# Incident / Event types
# ---------------------------------------------------------------------------

class Incident(BaseModel):
    id: str
    time: str
    type: Literal["info", "warning", "resolved", "error"]
    msg: str
    source: str | None = None


# ---------------------------------------------------------------------------
# Model performance types
# ---------------------------------------------------------------------------

class ModelPerformance(BaseModel):
    id: str
    latency_ms: float
    throughput_rps: float


class ModelStatusResponse(BaseModel):
    models: list[ModelPerformance]


# ---------------------------------------------------------------------------
# Subscription types
# ---------------------------------------------------------------------------

class Subscription(BaseModel):
    model_config = {"protected_namespaces": ()}
    id: str
    model_id: str
    model_name: str
    status: Literal["active", "paused", "error"]
    subscribed_at: str
    last_active_at: str
    total_calls: int
    success_rate: float
    avg_latency_ms: float


class CommunicationLog(BaseModel):
    model_config = {"protected_namespaces": ()}
    id: str
    timestamp: str
    model_id: str
    model_name: str
    direction: Literal["inbound", "outbound"]
    type: Literal["inference", "webhook", "health_check", "system"]
    mode: Literal["Webhook", "WebSocket", "SSE", "Redis", "HTTP"]
    status: Literal["success", "error", "pending"]
    latency_ms: float
    payload_size_bytes: int
    summary: str


class LatencyDistribution(BaseModel):
    p50_ms: float
    p95_ms: float
    p99_ms: float


class ModeRatio(BaseModel):
    mode: str
    count: int
    percentage: float


class ThroughputHistoryPoint(BaseModel):
    timestamp: str
    inbound: float
    outbound: float


class SubscriptionsMetrics(BaseModel):
    latency_distribution: LatencyDistribution
    mode_ratios: list[ModeRatio]
    throughput_history: list[ThroughputHistoryPoint]


# ---------------------------------------------------------------------------
# SSE (Server-Sent Events) types
# ---------------------------------------------------------------------------

class SseProgressData(BaseModel):
    message: str
    step: int | None = None
    total_steps: int | None = None


class SseResultData(BaseModel):
    status: Literal["success", "error"]
    model: str
    inference_time: str
    device: str
    result: Any
    error: dict[str, str] | None = None


class SseErrorData(BaseModel):
    code: str
    message: str


class SseHeartbeatData(BaseModel):
    pass


class SseEvent(BaseModel):
    event: Literal["progress", "result", "error", "heartbeat"]
    data: SseProgressData | SseResultData | SseErrorData | SseHeartbeatData


class SseCallRequest(BaseModel):
    tool: str
    arguments: dict[str, Any]
    stream_progress: bool = True


def format_sse(event: str, data: dict | BaseModel) -> str:
    """Format a single SSE event block."""
    if isinstance(data, BaseModel):
        payload = json.dumps(data.model_dump(exclude_none=True), ensure_ascii=False)
    else:
        payload = json.dumps(data, ensure_ascii=False)
    return f"event: {event}\ndata: {payload}\n\n"
