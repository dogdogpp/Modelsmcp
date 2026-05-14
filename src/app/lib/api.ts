const API_BASE = import.meta.env.VITE_API_BASE || "";

async function fetchJSON<T>(path: string): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const apiKey = import.meta.env.VITE_DEEPMCP_API_KEY || import.meta.env.VITE_API_KEY || "";
  if (apiKey) headers["X-API-Key"] = apiKey;

  const res = await fetch(`${API_BASE}${path}`, { headers });
  if (!res.ok) {
    const body = await res.text().catch(() => "Unknown error");
    throw new Error(`HTTP ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Types matching backend protocol
// ---------------------------------------------------------------------------

export interface HealthModelInfo {
  id: string;
  name: string;
  status: "online" | "loading" | "offline";
}

export interface HealthResponse {
  status: "healthy" | "degraded" | "unhealthy";
  version: string;
  uptime: string;
  models: HealthModelInfo[];
}

export interface MetricsDataPoint {
  timestamp: string;
  value: number;
}

export interface MetricsResponse {
  latency: {
    avg_ms: number;
    p50_ms: number;
    p99_ms: number;
    history: MetricsDataPoint[];
  };
  throughput: {
    req_per_sec: number;
    history: MetricsDataPoint[];
  };
  system: {
    gpu_utilization: number;
    gpu_memory_used_gb: number;
    gpu_memory_total_gb: number;
    cpu_utilization: number;
    disk_used_gb: number;
  };
  webhook?: {
    webhook_delivery_total: number;
    webhook_delivery_failed_total: number;
    webhook_queue_depth: number;
  };
}

export interface Incident {
  id: string;
  time: string;
  type: "info" | "warning" | "resolved" | "error";
  msg: string;
  source?: string;
}

export interface ModelPerformance {
  id: string;
  latency_ms: number;
  throughput_rps: number;
}

export interface ModelStatusResponse {
  models: ModelPerformance[];
}

export interface Subscription {
  id: string;
  model_id: string;
  model_name: string;
  status: "active" | "paused" | "error";
  subscribed_at: string;
  last_active_at: string;
  total_calls: number;
  success_rate: number;
  avg_latency_ms: number;
}

export interface CommunicationLog {
  id: string;
  timestamp: string;
  model_id: string;
  model_name: string;
  direction: "inbound" | "outbound";
  type: "inference" | "webhook" | "health_check" | "system";
  mode: "Webhook" | "WebSocket" | "SSE" | "Redis" | "HTTP";
  status: "success" | "error" | "pending";
  latency_ms: number;
  payload_size_bytes: number;
  summary: string;
}

export interface LatencyDistribution {
  p50_ms: number;
  p95_ms: number;
  p99_ms: number;
}

export interface ModeRatio {
  mode: string;
  count: number;
  percentage: number;
}

export interface ThroughputHistoryPoint {
  timestamp: string;
  inbound: number;
  outbound: number;
}

export interface SubscriptionsMetrics {
  latency_distribution: LatencyDistribution;
  mode_ratios: ModeRatio[];
  throughput_history: ThroughputHistoryPoint[];
}

// ---------------------------------------------------------------------------
// API wrappers
// ---------------------------------------------------------------------------

export const api = {
  health: () => fetchJSON<HealthResponse>("/health"),
  metrics: () => fetchJSON<MetricsResponse>("/metrics"),
  incidents: () => fetchJSON<Incident[]>("/incidents"),
  modelStatus: () => fetchJSON<ModelStatusResponse>("/models/status"),
  subscriptions: () => fetchJSON<Subscription[]>("/subscriptions"),
  subscriptionLogs: () => fetchJSON<CommunicationLog[]>("/subscriptions/logs"),
  subscriptionMetrics: () => fetchJSON<SubscriptionsMetrics>("/subscriptions/metrics"),
};
