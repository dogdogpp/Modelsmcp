import { motion } from "motion/react";
import { useState, useEffect, useCallback } from "react";
import {
  Activity,
  AlertCircle,
  RefreshCw,
  Zap,
  Clock,
  ArrowDownLeft,
  ArrowUpRight,
  Layers,
  BarChart3,
  Radio,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { api, type Subscription, type CommunicationLog, type SubscriptionsMetrics } from "../lib/api";

const MODE_COLORS: Record<string, string> = {
  HTTP: "#00d4ff",
  SSE: "#7c3aed",
  Webhook: "#00ff88",
  WebSocket: "#f59e0b",
  Redis: "#ef4444",
};

const StatusBadge = ({ status }: { status: Subscription["status"] }) => {
  const map = {
    active: { text: "活跃", cls: "bg-green-500/10 text-green-400" },
    paused: { text: "暂停", cls: "bg-amber-500/10 text-amber-400" },
    error: { text: "错误", cls: "bg-red-500/10 text-red-400" },
  };
  const s = map[status];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs ${s.cls}`}>
      <div className={`w-1.5 h-1.5 rounded-full mr-1.5 ${status === "active" ? "bg-green-400 animate-pulse" : status === "paused" ? "bg-amber-400" : "bg-red-400"}`} />
      {s.text}
    </span>
  );
};

const LogDirection = ({ direction }: { direction: CommunicationLog["direction"] }) =>
  direction === "inbound" ? (
    <span className="inline-flex items-center gap-1 text-cyan-400 text-xs">
      <ArrowDownLeft size={12} /> 入站
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-green-400 text-xs">
      <ArrowUpRight size={12} /> 出站
    </span>
  );

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="px-3 py-2 rounded-lg border border-white/10 bg-[#0f1520] text-xs text-gray-300">
        {payload[0].value} req/s
      </div>
    );
  }
  return null;
};

export function Subscriptions() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [logs, setLogs] = useState<CommunicationLog[]>([]);
  const [metrics, setMetrics] = useState<SubscriptionsMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  const fetchData = useCallback(async () => {
    try {
      const [subs, logData, metricData] = await Promise.all([
        api.subscriptions(),
        api.subscriptionLogs(),
        api.subscriptionMetrics(),
      ]);
      setSubscriptions(subs);
      setLogs(logData);
      setMetrics(metricData);
      setLastUpdated(new Date());
      setError(null);
    } catch (e: any) {
      setError(e.message || "加载失败");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-400">
          <RefreshCw size={18} className="animate-spin" />
          <span className="text-sm">加载订阅数据中...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertCircle size={32} className="text-red-400 mx-auto mb-3" />
          <p className="text-gray-300 mb-4">{error}</p>
          <button
            onClick={handleRefresh}
            className="px-4 py-2 rounded-xl border border-white/10 text-gray-400 hover:text-white hover:bg-white/5 transition-all text-sm"
          >
            重试
          </button>
        </div>
      </div>
    );
  }

  const throughputHistory = metrics?.throughput_history.map((p) => ({
    time: p.timestamp.slice(11, 16),
    inbound: p.inbound,
    outbound: p.outbound,
  })) || [];

  const modeData = metrics?.mode_ratios.map((m) => ({
    name: m.mode,
    value: m.count,
    color: MODE_COLORS[m.mode] || "#888",
  })) || [];

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="border-b border-white/5 py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-start justify-between">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <div className="flex items-center gap-2 mb-2">
                <Radio size={16} className="text-cyan-400" />
                <span className="text-cyan-400 text-sm" style={{ fontWeight: 500 }}>订阅管理</span>
              </div>
              <h1 style={{ fontSize: "2rem", fontWeight: 700, letterSpacing: "-0.02em" }}>
                模型订阅监控
              </h1>
              <p className="text-gray-400 mt-2 text-sm">
                上次更新：{lastUpdated.toLocaleTimeString("zh-CN")}
              </p>
            </motion.div>
            <button
              onClick={handleRefresh}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 text-gray-400 hover:text-white hover:bg-white/5 transition-all text-sm"
            >
              <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
              刷新
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        {/* Subscription list */}
        <div>
          <h2 className="text-white mb-4" style={{ fontWeight: 600 }}>订阅模型</h2>
          <div className="rounded-2xl border border-white/5 overflow-hidden">
            <div className="hidden md:grid grid-cols-7 gap-4 px-5 py-3 border-b border-white/5 bg-white/[0.02]">
              {["模型", "状态", "订阅时间", "最后活跃", "总调用", "成功率", "平均延迟"].map((h) => (
                <div key={h} className="text-gray-500 text-xs" style={{ fontWeight: 500 }}>{h}</div>
              ))}
            </div>
            {subscriptions.map((sub, i) => (
              <motion.div
                key={sub.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.04 }}
                className="grid grid-cols-2 md:grid-cols-7 gap-4 px-5 py-4 border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors items-center"
              >
                <div className="text-white text-sm" style={{ fontWeight: 500 }}>{sub.model_name}</div>
                <div><StatusBadge status={sub.status} /></div>
                <div className="hidden md:block text-gray-500 text-xs">{new Date(sub.subscribed_at).toLocaleDateString("zh-CN")}</div>
                <div className="hidden md:block text-gray-500 text-xs">{new Date(sub.last_active_at).toLocaleString("zh-CN")}</div>
                <div className="hidden md:block text-gray-400 text-sm">{sub.total_calls.toLocaleString()}</div>
                <div className="hidden md:block text-green-400 text-sm">{(sub.success_rate * 100).toFixed(1)}%</div>
                <div className="hidden md:block text-cyan-400 text-sm">{sub.avg_latency_ms.toFixed(1)}ms</div>
              </motion.div>
            ))}
            {subscriptions.length === 0 && (
              <div className="px-5 py-8 text-center text-gray-500 text-sm">暂无订阅数据</div>
            )}
          </div>
        </div>

        {/* Metrics row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Latency distribution */}
          <div className="p-5 rounded-2xl border border-white/5 bg-white/[0.02]">
            <div className="flex items-center gap-2 mb-5">
              <BarChart3 size={14} className="text-cyan-400" />
              <h3 className="text-white text-sm" style={{ fontWeight: 600 }}>延迟分布</h3>
            </div>
            <div className="space-y-4">
              {[
                { label: "P50", value: metrics?.latency_distribution.p50_ms || 0, color: "#00d4ff" },
                { label: "P95", value: metrics?.latency_distribution.p95_ms || 0, color: "#7c3aed" },
                { label: "P99", value: metrics?.latency_distribution.p99_ms || 0, color: "#f59e0b" },
              ].map((item) => (
                <div key={item.label}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-gray-500 text-xs">{item.label}</span>
                    <span className="text-white text-xs" style={{ fontWeight: 600 }}>{item.value.toFixed(1)}ms</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min((item.value / 400) * 100, 100)}%`,
                        background: item.color,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Mode ratios */}
          <div className="p-5 rounded-2xl border border-white/5 bg-white/[0.02]">
            <div className="flex items-center gap-2 mb-5">
              <Layers size={14} className="text-cyan-400" />
              <h3 className="text-white text-sm" style={{ fontWeight: 600 }}>通信模式占比</h3>
            </div>
            <div className="flex items-center gap-6">
              <div className="w-28 h-28 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={modeData}
                      cx="50%"
                      cy="50%"
                      innerRadius={30}
                      outerRadius={50}
                      paddingAngle={2}
                      dataKey="value"
                      stroke="none"
                    >
                      {modeData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-2">
                {modeData.map((m) => (
                  <div key={m.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ background: m.color }} />
                      <span className="text-gray-400 text-xs">{m.name}</span>
                    </div>
                    <span className="text-white text-xs" style={{ fontWeight: 500 }}>{m.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Throughput history */}
          <div className="p-5 rounded-2xl border border-white/5 bg-white/[0.02]">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <Zap size={14} className="text-cyan-400" />
                <h3 className="text-white text-sm" style={{ fontWeight: 600 }}>吞吐量历史</h3>
              </div>
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1 text-cyan-400 text-xs">
                  <div className="w-2 h-2 rounded-full bg-cyan-400" /> 入站
                </span>
                <span className="flex items-center gap-1 text-green-400 text-xs">
                  <div className="w-2 h-2 rounded-full bg-green-400" /> 出站
                </span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={120}>
              <AreaChart data={throughputHistory}>
                <defs>
                  <linearGradient id="inboundGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00d4ff" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#00d4ff" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="outboundGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00ff88" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#00ff88" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                <XAxis dataKey="time" tick={{ fill: "#555", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#555", fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="inbound" name="入站" stroke="#00d4ff" strokeWidth={2} fill="url(#inboundGrad)" />
                <Area type="monotone" dataKey="outbound" name="出站" stroke="#00ff88" strokeWidth={2} fill="url(#outboundGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Communication logs */}
        <div>
          <h2 className="text-white mb-4" style={{ fontWeight: 600 }}>通信日志</h2>
          <div className="rounded-2xl border border-white/5 overflow-hidden">
            <div className="hidden md:grid grid-cols-9 gap-4 px-5 py-3 border-b border-white/5 bg-white/[0.02]">
              {["时间", "模型", "方向", "类型", "模式", "状态", "延迟", "Payload", "摘要"].map((h) => (
                <div key={h} className="text-gray-500 text-xs" style={{ fontWeight: 500 }}>{h}</div>
              ))}
            </div>
            {logs.map((log, i) => (
              <motion.div
                key={log.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className="grid grid-cols-2 md:grid-cols-9 gap-4 px-5 py-3 border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors items-center"
              >
                <div className="hidden md:block text-gray-500 text-xs">{new Date(log.timestamp).toLocaleTimeString("zh-CN")}</div>
                <div className="text-white text-sm" style={{ fontWeight: 500 }}>{log.model_name}</div>
                <div className="hidden md:block"><LogDirection direction={log.direction} /></div>
                <div className="hidden md:block text-gray-500 text-xs">{log.type}</div>
                <div className="hidden md:block text-gray-400 text-xs">{log.mode}</div>
                <div>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs ${
                    log.status === "success" ? "bg-green-500/10 text-green-400" :
                    log.status === "pending" ? "bg-amber-500/10 text-amber-400" :
                    "bg-red-500/10 text-red-400"
                  }`}>
                    {log.status === "success" ? "成功" : log.status === "pending" ? "等待中" : "失败"}
                  </span>
                </div>
                <div className="hidden md:block text-cyan-400 text-xs">{log.latency_ms.toFixed(1)}ms</div>
                <div className="hidden md:block text-gray-500 text-xs">{(log.payload_size_bytes / 1024).toFixed(1)} KB</div>
                <div className="text-gray-400 text-xs truncate">{log.summary}</div>
              </motion.div>
            ))}
            {logs.length === 0 && (
              <div className="px-5 py-8 text-center text-gray-500 text-sm">暂无日志数据</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
