import { useState, useEffect, useCallback } from "react";
import { motion } from "motion/react";
import {
  Radio,
  Server,
  Download,
  Webhook,
  Upload,
  Send,
  Settings,
  Loader2,
} from "lucide-react";
import { Switch } from "../components/ui/switch";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../components/ui/alert-dialog";

const STORAGE_KEY = "deepmcp-communication-settings";

interface CommMode {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  category: "bidirectional" | "unidirectional";
  requiresConfirm?: boolean;
}

const commModes: CommMode[] = [
  {
    id: "websocket",
    label: "WebSocket 全双工",
    description: "启用与 OpenClaw 的实时双向 WebSocket 连接",
    icon: <Radio size={18} />,
    category: "bidirectional",
    requiresConfirm: true,
  },
  {
    id: "redis",
    label: "Redis 消息代理订阅",
    description: "通过 Redis Pub/Sub 接收异步任务通知",
    icon: <Server size={18} />,
    category: "bidirectional",
  },
  {
    id: "sse-receive",
    label: "SSE 流式推送接收",
    description: "接收服务端发送的 Server-Sent Events 流数据",
    icon: <Download size={18} />,
    category: "bidirectional",
  },
  {
    id: "webhook",
    label: "Webhook 回调发送",
    description: "向外部系统发送 HTTP Webhook 回调",
    icon: <Webhook size={18} />,
    category: "unidirectional",
  },
  {
    id: "sse-send",
    label: "SSE 流式推送发送",
    description: "对外提供 Server-Sent Events 流式数据推送",
    icon: <Upload size={18} />,
    category: "unidirectional",
  },
  {
    id: "feishu",
    label: "飞书 / OpenClaw 消息推送",
    description: "向飞书或 OpenClaw 推送文本与卡片消息",
    icon: <Send size={18} />,
    category: "unidirectional",
  },
];

function loadPersistedState(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return {
    websocket: true,
    redis: true,
    "sse-receive": true,
    webhook: true,
    "sse-send": true,
    feishu: true,
  };
}

function savePersistedState(state: Record<string, boolean>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

export function SettingsCommunication() {
  const [states, setStates] = useState<Record<string, boolean>>(loadPersistedState);
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [confirmNextValue, setConfirmNextValue] = useState<boolean>(false);

  useEffect(() => {
    savePersistedState(states);
  }, [states]);

  const performToggle = useCallback((id: string, nextValue: boolean) => {
    setLoading((prev) => ({ ...prev, [id]: true }));

    // Simulate async operation
    setTimeout(() => {
      setStates((prev) => ({ ...prev, [id]: nextValue }));
      setLoading((prev) => ({ ...prev, [id]: false }));

      const mode = commModes.find((m) => m.id === id);
      const label = mode?.label ?? id;
      toast.success(
        nextValue ? `${label} 已启用` : `${label} 已停用`,
        {
          description: nextValue
            ? "通信模式已开启，链路将按新配置工作"
            : "通信模式已关闭，相关链路已断开",
        }
      );
    }, 600);
  }, []);

  const handleToggle = useCallback(
    (id: string, nextValue: boolean) => {
      const mode = commModes.find((m) => m.id === id);
      if (mode?.requiresConfirm) {
        setConfirmId(id);
        setConfirmNextValue(nextValue);
        return;
      }
      performToggle(id, nextValue);
    },
    [performToggle]
  );

  const handleConfirm = useCallback(() => {
    if (confirmId) {
      performToggle(confirmId, confirmNextValue);
    }
    setConfirmId(null);
  }, [confirmId, confirmNextValue, performToggle]);

  const bidirectional = commModes.filter((m) => m.category === "bidirectional");
  const unidirectional = commModes.filter((m) => m.category === "unidirectional");

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="border-b border-white/5 py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="flex items-center gap-2 mb-2">
              <Settings size={16} className="text-cyan-400" />
              <span className="text-cyan-400 text-sm" style={{ fontWeight: 500 }}>
                系统设置
              </span>
            </div>
            <h1
              style={{
                fontSize: "2rem",
                fontWeight: 700,
                letterSpacing: "-0.02em",
              }}
            >
              通信模式开关
            </h1>
            <p className="text-gray-400 mt-2 text-sm">
              按需启停 DeepMCP 与 OpenClaw 之间的各类通信能力，实现精细化的链路管控
            </p>
          </motion.div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
        {/* Bidirectional */}
        <Section
          title="双向通信"
          subtitle="同时支持收发数据，需要两端保持活跃连接"
          modes={bidirectional}
          states={states}
          loading={loading}
          onToggle={handleToggle}
        />

        {/* Unidirectional */}
        <Section
          title="单向通信"
          subtitle="仅支持发送或接收，适用于事件通知与消息推送场景"
          modes={unidirectional}
          states={states}
          loading={loading}
          onToggle={handleToggle}
        />
      </div>

      {/* WebSocket confirm dialog */}
      <AlertDialog
        open={confirmId === "websocket"}
        onOpenChange={(open) => {
          if (!open) setConfirmId(null);
        }}
      >
        <AlertDialogContent className="bg-[#0f1520] border-white/10 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>确认切换 WebSocket 全双工？</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              {confirmNextValue
                ? "即将启用 WebSocket 实时连接，所有双向通道将重新握手。"
                : "关闭 WebSocket 将立即断开所有实时双向通道，正在进行的推理任务可能中断。"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              className="border-white/10 bg-white/5 text-white hover:bg-white/10 hover:text-white"
              onClick={() => setConfirmId(null)}
            >
              取消
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-gradient-to-r from-cyan-500 to-blue-600 text-white hover:opacity-90"
              onClick={handleConfirm}
            >
              确认
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Section({
  title,
  subtitle,
  modes,
  states,
  loading,
  onToggle,
}: {
  title: string;
  subtitle: string;
  modes: CommMode[];
  states: Record<string, boolean>;
  loading: Record<string, boolean>;
  onToggle: (id: string, nextValue: boolean) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="mb-4">
        <h2 className="text-white" style={{ fontWeight: 600 }}>
          {title}
        </h2>
        <p className="text-gray-500 text-sm mt-1">{subtitle}</p>
      </div>
      <div className="space-y-3">
        {modes.map((mode, i) => {
          const isOn = states[mode.id] ?? false;
          const isLoading = loading[mode.id] ?? false;
          return (
            <motion.div
              key={mode.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-center justify-between p-5 rounded-2xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.03] transition-colors"
            >
              <div className="flex items-center gap-4">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    isOn
                      ? "bg-cyan-500/10 text-cyan-400"
                      : "bg-white/5 text-gray-500"
                  }`}
                >
                  {mode.icon}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className="text-white text-sm"
                      style={{ fontWeight: 500 }}
                    >
                      {mode.label}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${
                        isOn
                          ? "bg-green-500/10 text-green-400"
                          : "bg-gray-500/10 text-gray-500"
                      }`}
                    >
                      <span
                        className={`w-1 h-1 rounded-full ${
                          isOn ? "bg-green-400" : "bg-gray-500"
                        }`}
                      />
                      {isOn ? "开启" : "关闭"}
                    </span>
                  </div>
                  <p className="text-gray-500 text-xs mt-1">
                    {mode.description}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0 ml-4">
                {isLoading && (
                  <Loader2 size={16} className="text-cyan-400 animate-spin" />
                )}
                <Switch
                  checked={isOn}
                  disabled={isLoading}
                  onCheckedChange={(checked) => onToggle(mode.id, checked)}
                  className="data-[state=checked]:bg-cyan-500 data-[state=unchecked]:bg-white/10"
                />
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
