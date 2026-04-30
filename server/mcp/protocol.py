"""MCP (Model Context Protocol) type definitions."""

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
    parameters: dict[str, Any]


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
