import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import {
  Settings,
  ArrowLeftRight,
  ArrowRight,
  Radio,
  Database,
  Webhook,
  Zap,
  MessageSquare,
  Activity,
  Loader2,
  ChevronDown,
  ChevronUp,
  Clock,
  User,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { Switch } from "../components/ui/switch";
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
import {
  useCommunicationSettings,
  type SwitchKey,
} from "../hooks/useCommunicationSettings";

interface CommSwitchDef {
  key: SwitchKey;
  title: string;
  description: string;
  icon: React.ReactNode;
  critical?: boolean;
}

const bidirectionalSwitches: CommSwitchDef[] = [
  {
    key: "websocket_bidirectional",
    title: "WebSocket 全双工",
    description:
      "启用 DeepMCP 与 OpenClaw 之间的实时全双工 WebSocket 通信通道",
    icon: <Radio size={18} />,
    critical: true,
  },
  {
    key: "redis_subscription",
    title: "Redis 消息代理订阅",
    description: "通过 Redis 消息代理接收异步事件与指令广播",
    icon: <Database size={18} />,
  },
  {
    key: "sse_receive",
    title: "SSE 流式推送接收",
    description: "接收 Server-Sent Events 流式数据推送",
    icon: <ArrowLeftRight size={18} />,
  },
];

const unidirectionalSwitches: CommSwitchDef[] = [
  {
    key: "webhook_send",
    title: "Webhook 回调发送",
    description: "向外部系统发送 Webhook 回调通知",
    icon: <Webhook size={18} />,
  },
  {
    key: "sse_send",
    title: "SSE 流式推送发送",
    description: "对外发送 Server-Sent Events 流式数据",
    icon: <Zap size={18} />,
  },
  {
    key: "feishu_push",
    title: "飞书 / OpenClaw 消息推送",
    description: "向飞书或 OpenClaw 推送消息与告警",
    icon: <MessageSquare size={18} />,
  },
];

function trackEvent(
  eventName: string,
  payload?: Record<string, unknown>
) {
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.debug("[trackEvent]", eventName, payload);
  }
}

function formatTime(ts: number) {
  const d = new Date(ts);
  return d.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function CommunicationSettings() {
  const { states, logs, toggle, isLoading } = useCommunicationSettings();
  const [confirmKey, setConfirmKey] = useState<SwitchKey | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [logsOpen, setLogsOpen] = useState(true);

  const handleToggle = useCallback(
    (def: CommSwitchDef, checked: boolean) => {
      if (isLoading(def.key)) return;
      if (def.critical && !checked) {
        setConfirmKey(def.key);
        setConfirmOpen(true);
        return;
      }
      toggle(def.key, def.title, checked);
    },
    [isLoading, toggle]
  );

  const confirmToggle = () => {
    if (confirmKey) {
      const def = [...bidirectionalSwitches, ...unidirectionalSwitches].find(
        (s) => s.key === confirmKey
      );
      if (def) {
        toggle(confirmKey, def.title, false);
        trackEvent("comm_switch_confirmed", { switch_id: confirmKey });
      }
      setConfirmKey(null);
    }
    setConfirmOpen(false);
  };

  const cancelToggle = () => {
    if (confirmKey) {
      trackEvent("comm_switch_cancelled", { switch_id: confirmKey });
    }
    setConfirmKey(null);
    setConfirmOpen(false);
  };

  const renderSwitchItem = (def: CommSwitchDef) => {
    const isOn = states[def.key] ?? false;
    const loading = isLoading(def.key);
    return (
      <motion.div
        key={def.key}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-colors"
      >
        <div className="flex items-start gap-3 min-w-0">
          <div
            className={`mt-0.5 shrink-0 ${
              isOn ? "text-cyan-400" : "text-gray-600"
            } transition-colors`}
          >
            {def.icon}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
              <span className="text-white text-sm" style={{ fontWeight: 500 }}>
                {def.title}
              </span>
              {def.critical && (
                <span className="px-1.5 py-0.5 rounded text-[10px] bg-red-500/10 text-red-400 border border-red-500/10">
                  关键
                </span>
              )}
            </div>
            <p className="text-gray-500 text-xs leading-relaxed">
              {def.description}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto">
          <div className="flex items-center gap-1.5">
            <div
              className={`w-1.5 h-1.5 rounded-full ${
                loading
                  ? "bg-amber-400 animate-pulse"
                  : isOn
                  ? "bg-green-400"
                  : "bg-gray-600"
              }`}
            />
            <span className="text-xs text-gray-500 w-10 text-right">
              {loading ? "加载中" : isOn ? "已开启" : "已关闭"}
            </span>
          </div>
          {loading ? (
            <Loader2 size={18} className="text-gray-500 animate-spin" />
          ) : (
            <Switch
              checked={isOn}
              disabled={loading}
              onCheckedChange={(checked) => handleToggle(def, checked)}
            />
          )}
        </div>
      </motion.div>
    );
  };

  const activeCount = Object.values(states).filter(Boolean).length;

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
              通信模式开关控制面板
            </h1>
            <p className="text-gray-400 mt-2 text-sm max-w-xl">
              管理 DeepMCP 与外部系统的通信链路。关键开关变更将触发二次确认，防止误操作导致服务中断。
            </p>
          </motion.div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
        {/* Status summary */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-wrap items-center gap-4 p-4 rounded-2xl border border-white/5 bg-white/[0.02]"
        >
          <div className="flex items-center gap-2">
            <Activity size={16} className="text-cyan-400" />
            <span className="text-gray-300 text-sm">
              活跃链路：
              <span className="text-white" style={{ fontWeight: 600 }}>
                {activeCount}
              </span>{" "}
              / {Object.keys(states).length}
            </span>
          </div>
          <div className="hidden sm:block w-px h-4 bg-white/10" />
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
            <span className="text-gray-500 text-xs">已开启</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-gray-600" />
            <span className="text-gray-500 text-xs">已关闭</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-gray-500 text-xs">加载中</span>
          </div>
        </motion.div>

        {/* Bidirectional */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <ArrowLeftRight size={16} className="text-cyan-400" />
            <h2 className="text-white" style={{ fontWeight: 600 }}>
              双向通信
            </h2>
            <span className="text-gray-600 text-xs">
              数据可在 DeepMCP 与 OpenClaw 之间双向流动
            </span>
          </div>
          <div className="space-y-3">
            {bidirectionalSwitches.map(renderSwitchItem)}
          </div>
        </div>

        {/* Unidirectional */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <ArrowRight size={16} className="text-cyan-400" />
            <h2 className="text-white" style={{ fontWeight: 600 }}>
              单向通信
            </h2>
            <span className="text-gray-600 text-xs">
              数据仅从 DeepMCP 向外部系统单向发送
            </span>
          </div>
          <div className="space-y-3">
            {unidirectionalSwitches.map(renderSwitchItem)}
          </div>
        </div>

        {/* Operation logs */}
        <div>
          <button
            onClick={() => setLogsOpen((v) => !v)}
            className="flex items-center gap-2 mb-4 group"
          >
            <Clock size={16} className="text-cyan-400" />
            <h2 className="text-white" style={{ fontWeight: 600 }}>
              最近操作日志
            </h2>
            <span className="text-gray-600 text-xs">
              共 {logs.length} 条记录
            </span>
            {logsOpen ? (
              <ChevronUp size={14} className="text-gray-500 group-hover:text-gray-300 transition-colors" />
            ) : (
              <ChevronDown size={14} className="text-gray-500 group-hover:text-gray-300 transition-colors" />
            )}
          </button>

          <AnimatePresence>
            {logsOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="rounded-2xl border border-white/5 bg-white/[0.02] overflow-hidden">
                  <div className="grid grid-cols-12 gap-4 px-5 py-3 border-b border-white/5 bg-white/[0.02]">
                    <div className="col-span-3 text-gray-500 text-xs" style={{ fontWeight: 500 }}>
                      时间
                    </div>
                    <div className="col-span-3 text-gray-500 text-xs" style={{ fontWeight: 500 }}>
                      通信模式
                    </div>
                    <div className="col-span-3 text-gray-500 text-xs" style={{ fontWeight: 500 }}>
                      变更内容
                    </div>
                    <div className="col-span-3 text-gray-500 text-xs" style={{ fontWeight: 500 }}>
                      操作人
                    </div>
                  </div>
                  {logs.length === 0 ? (
                    <div className="px-5 py-8 text-center text-gray-600 text-sm">
                      暂无操作记录，开关变更后将自动记录日志。
                    </div>
                  ) : (
                    <div className="max-h-80 overflow-y-auto">
                      {logs
                        .slice()
                        .reverse()
                        .map((log) => (
                          <div
                            key={log.id}
                            className="grid grid-cols-12 gap-4 px-5 py-3 border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors items-center"
                          >
                            <div className="col-span-3 text-gray-400 text-xs">
                              {formatTime(log.timestamp)}
                            </div>
                            <div className="col-span-3 text-white text-xs" style={{ fontWeight: 500 }}>
                              {log.switchTitle}
                            </div>
                            <div className="col-span-3 flex items-center gap-1.5">
                              {log.newState ? (
                                <>
                                  <CheckCircle2 size={12} className="text-green-400" />
                                  <span className="text-green-400 text-xs">开启</span>
                                </>
                              ) : (
                                <>
                                  <XCircle size={12} className="text-gray-500" />
                                  <span className="text-gray-500 text-xs">关闭</span>
                                </>
                              )}
                            </div>
                            <div className="col-span-3 flex items-center gap-1.5 text-gray-500 text-xs">
                              <User size={12} />
                              {log.actor}
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Critical confirmation dialog */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="bg-[#0c111a] border-white/10 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">
              确认停用 WebSocket 全双工通信？
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              停用后将断开所有活跃连接，Claude / OpenClaw 客户端需重新握手。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={cancelToggle}
              className="bg-transparent border-white/10 text-gray-300 hover:bg-white/5 hover:text-white"
            >
              取消
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmToggle}
              className="bg-red-500/90 text-white hover:bg-red-500 border-0"
            >
              确认停用
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
