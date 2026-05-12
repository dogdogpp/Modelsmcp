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

export const subscriptionModels: SubscriptionModel[] = [
  {
    id: "yolov8",
    name: "YOLOv8",
    icon: "🎯",
    color: "#00d4ff",
    status: "active",
    subscribedAt: "2026-05-10T08:00:00Z",
    lastActivity: "2026-05-12T03:20:00Z",
    totalCalls: 12480,
    successRate: 99.2,
    avgLatency: 18,
  },
  {
    id: "sam2",
    name: "SAM 2",
    icon: "✂️",
    color: "#f59e0b",
    status: "active",
    subscribedAt: "2026-05-10T08:15:00Z",
    lastActivity: "2026-05-12T03:19:30Z",
    totalCalls: 8320,
    successRate: 98.7,
    avgLatency: 28,
  },
  {
    id: "clip",
    name: "CLIP",
    icon: "🔗",
    color: "#ec4899",
    status: "active",
    subscribedAt: "2026-05-11T02:00:00Z",
    lastActivity: "2026-05-12T03:18:45Z",
    totalCalls: 5670,
    successRate: 99.5,
    avgLatency: 14,
  },
  {
    id: "whisper",
    name: "Whisper",
    icon: "🎙️",
    color: "#06b6d4",
    status: "idle",
    subscribedAt: "2026-05-11T10:00:00Z",
    lastActivity: "2026-05-12T02:45:00Z",
    totalCalls: 2100,
    successRate: 97.8,
    avgLatency: 280,
  },
  {
    id: "dinov2",
    name: "DINOv2",
    icon: "🧠",
    color: "#8b5cf6",
    status: "error",
    subscribedAt: "2026-05-10T09:00:00Z",
    lastActivity: "2026-05-12T01:30:00Z",
    totalCalls: 3450,
    successRate: 92.4,
    avgLatency: 35,
  },
  {
    id: "paddleocr",
    name: "PaddleOCR",
    icon: "📝",
    color: "#00ff88",
    status: "active",
    subscribedAt: "2026-05-11T06:00:00Z",
    lastActivity: "2026-05-12T03:20:10Z",
    totalCalls: 9870,
    successRate: 99.1,
    avgLatency: 38,
  },
];

export const latencyDistribution: LatencyDistribution = {
  p50: 24,
  p95: 142,
  p99: 310,
};

export const modeRatios: ModeRatio[] = [
  { mode: "Webhook", count: 15230, percentage: 42.5 },
  { mode: "WebSocket", count: 9870, percentage: 27.5 },
  { mode: "SSE", count: 6450, percentage: 18.0 },
  { mode: "Redis", count: 4290, percentage: 12.0 },
];

export const throughputHistory: ThroughputPoint[] = Array.from(
  { length: 20 },
  (_, i) => ({
    time: `${i * 5}s`,
    inbound: Math.round(45 + Math.random() * 30),
    outbound: Math.round(40 + Math.random() * 25),
  })
);

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomLatency(): number {
  const r = Math.random();
  if (r < 0.7) return Math.round(10 + Math.random() * 40);
  if (r < 0.95) return Math.round(60 + Math.random() * 200);
  return Math.round(250 + Math.random() * 300);
}

const logModels = [
  { id: "yolov8", name: "YOLOv8" },
  { id: "sam2", name: "SAM 2" },
  { id: "clip", name: "CLIP" },
  { id: "whisper", name: "Whisper" },
  { id: "dinov2", name: "DINOv2" },
  { id: "paddleocr", name: "PaddleOCR" },
];

const logTypes: CommType[] = [
  "tool_call",
  "tool_result",
  "heartbeat",
  "config_sync",
  "notification",
  "callback",
];

const logModes: CommMode[] = ["Webhook", "WebSocket", "SSE", "Redis"];

const logSummaries: Record<CommType, string[]> = {
  tool_call: [
    "调用 detect 工具识别图像",
    "调用 segment 工具分割掩码",
    "调用 encode 工具提取 Embedding",
    "调用 transcribe 工具转录音频",
    "调用 estimate 工具深度估计",
  ],
  tool_result: [
    "返回检测结果 12 个目标",
    "返回分割掩码 3 个区域",
    "返回 Embedding 向量 512-dim",
    "返回转录文本 120 字",
    "返回深度图 1920x1080",
  ],
  heartbeat: ["心跳检测", "健康检查通过", "保活信号"],
  config_sync: ["同步模型配置", "更新推理参数", "推送权重版本"],
  notification: ["模型加载完成", "新版本可用", "告警：延迟升高"],
  callback: ["回调确认", "异步结果通知", "任务完成回调"],
};

export function generateLogs(count = 50): CommunicationLog[] {
  const logs: CommunicationLog[] = [];
  const now = new Date("2026-05-12T03:20:00Z");

  for (let i = 0; i < count; i++) {
    const model = randomItem(logModels);
    const direction = randomItem<CommDirection>(["mcp-to-openclaw", "openclaw-to-mcp"]);
    const type = randomItem(logTypes);
    const mode = randomItem(logModes);
    const latency = randomLatency();
    const statusRoll = Math.random();
    let status: CommStatus = "success";
    if (statusRoll < 0.02) status = "error";
    else if (statusRoll < 0.04) status = "timeout";
    else if (statusRoll < 0.08) status = "pending";

    const ts = new Date(now.getTime() - i * 3000);

    logs.push({
      id: `log-${i}`,
      timestamp: ts.toISOString(),
      modelId: model.id,
      modelName: model.name,
      direction,
      type,
      mode,
      status,
      latencyMs: latency,
      payloadSize: Math.round(200 + Math.random() * 4800),
      summary: randomItem(logSummaries[type]),
      errorMessage:
        status === "error"
          ? "连接超时，OpenClaw 节点无响应"
          : status === "timeout"
          ? "请求在 30s 内未返回"
          : undefined,
    });
  }

  return logs;
}

export const communicationLogs = generateLogs(60);
