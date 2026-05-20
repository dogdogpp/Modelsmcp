export type CommDirection = "mcp-to-openclaw" | "openclaw-to-mcp";
export type CommMode = "Webhook" | "WebSocket" | "SSE" | "Redis";
export type CommStatus = "success" | "error" | "pending" | "timeout";
export type CommType =
  | "tool_call"
  | "tool_result"
  | "heartbeat"
  | "config_sync"
  | "notification"
  | "callback";

export interface SubscriptionModel {
  id: string;
  name: string;
  icon: string;
  color: string;
  status: "active" | "idle" | "error";
  subscribedAt: string;
  lastActivity: string;
  totalCalls: number;
  successRate: number;
  avgLatency: number;
}

export interface CommunicationLog {
  id: string;
  timestamp: string;
  modelId: string;
  modelName: string;
  direction: CommDirection;
  type: CommType;
  mode: CommMode;
  status: CommStatus;
  latencyMs: number;
  payloadSize: number;
  summary: string;
  errorMessage?: string;
}

export interface LatencyDistribution {
  p50: number;
  p95: number;
  p99: number;
}

export interface ModeRatio {
  mode: CommMode;
  count: number;
  percentage: number;
}

export interface ThroughputPoint {
  time: string;
  inbound: number;
  outbound: number;
}
