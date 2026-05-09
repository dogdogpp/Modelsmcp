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
