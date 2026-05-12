import { useState, useEffect, useMemo } from "react";
import { motion } from "motion/react";
import {
  Activity,
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
  Radio,
  Zap,
  CheckCircle,
  AlertCircle,
  Clock,
  Filter,
  Server,
  Wifi,
  WifiOff,
  AlertTriangle,
  Layers,
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
import {
  subscriptionModels,
  communicationLogs,
  latencyDistribution,
  modeRatios,
  throughputHistory,
  generateLogs,
} from "../data/subscriptions";
import type {
  CommDirection,
  CommMode,
  CommStatus,
  CommunicationLog,
} from "../data/subscriptions";

const COLORS = ["#00d4ff", "#00ff88", "#f59e0b", "#ec4899"];

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString("zh-CN", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function statusIcon(status: CommStatus) {
  switch (status) {
    case "success":
      return <CheckCircle size={14} className="text-green-400" />;
    case "error":
      return <AlertCircle size={14} className="text-red-400" />;
    case "timeout":
      return <Clock size={14} className="text-amber-400" />;
    case "pending":
      return <Activity size={14} className="text-cyan-400 animate-pulse" />;
  }
}

function statusBadge(status: CommStatus) {
  const map: Record<CommStatus, string> = {
    success: "bg-green-500/10 text-green-400",
    error: "bg-red-500/10 text-red-400",
    timeout: "bg-amber-500/10 text-amber-400",
    pending: "bg-cyan-500/10 text-cyan-400",
  };
  const labelMap: Record<CommStatus, string> = {
    success: "成功",
    error: "失败",
    timeout: "超时",
    pending: "进行中",
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${map[status]}`}>
      <div
        className={`w-1.5 h-1.5 rounded-full ${
          status === "success"
            ? "bg-green-400"
            : status === "error"
            ? "bg-red-400"
            : status === "timeout"
            ? "bg-amber-400"
            : "bg-cyan-400 animate-pulse"
        }`}
      />
      {labelMap[status]}
    </span>
  );
}

function directionBadge(direction: CommDirection) {
  return direction === "mcp-to-openclaw" ? (
    <span className="inline-flex items-center gap-1 text-xs text-cyan-400">
      <ArrowUpRight size={12} />
      DeepMCP → OpenClaw
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-xs text-green-400">
      <ArrowDownLeft size={12} />
      OpenClaw → DeepMCP
    </span>
  );
}

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="px-3 py-2 rounded-lg border border-white/10 bg-[#0f1520] text-xs text-gray-300">
        {payload.map((p: any, idx: number) => (
          <div key={idx} className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
            <span>
              {p.name}: {p.value} req/s
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export function Subscriptions() {
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [refreshing, setRefreshing] = useState(false);
  const [logs, setLogs] = useState<CommunicationLog[]>(communicationLogs);
  const [filterModel, setFilterModel] = useState<string>("all");
  const [filterDirection, setFilterDirection] = useState<CommDirection | "all">("all");
  const [filterMode, setFilterMode] = useState<CommMode | "all">("all");
  const [filterStatus, setFilterStatus] = useState<CommStatus | "all">("all");

  const activeModels = subscriptionModels.filter((m) => m.status === "active");
  const errorModels = subscriptionModels.filter((m) => m.status === "error");
  const idleModels = subscriptionModels.filter((m) => m.status === "idle");

  const overallStatus =
    errorModels.length > 0 ? "degraded" : idleModels.length > 0 ? "partial" : "operational";

  const totalCalls = subscriptionModels.reduce((s, m) => s + m.totalCalls, 0);
  const avgSuccessRate =
    subscriptionModels.reduce((s, m) => s + m.successRate, 0) / subscriptionModels.length;
  const avgLatency =
    subscriptionModels.reduce((s, m) => s + m.avgLatency, 0) / subscriptionModels.length;

  const handleRefresh = async () => {
    setRefreshing(true);
    await new Promise((r) => setTimeout(r, 800));
    setLogs(generateLogs(60));
    setLastUpdated(new Date());
    setRefreshing(false);
  };

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (filterModel !== "all" && log.modelId !== filterModel) return false;
      if (filterDirection !== "all" && log.direction !== filterDirection) return false;
      if (filterMode !== "all" && log.mode !== filterMode) return false;
      if (filterStatus !== "all" && log.status !== filterStatus) return false;
      return true;
    });
  }, [logs, filterModel, filterDirection, filterMode, filterStatus]);

  // Auto-scroll to top of log list effect could go here
  const [liveMode, setLiveMode] = useState(true);
  useEffect(() => {
    if (!liveMode) return;
    const interval = setInterval(() => {
      setLogs((prev) => {
        const next = generateLogs(1)[0];
        next.timestamp = new Date().toISOString();
        return [next, ...prev].slice(0, 200);
      });
      setLastUpdated(new Date());
    }, 3000);
    return () => clearInterval(interval);
  }, [liveMode]);

  const successCount = logs.filter((l) => l.status === "success").length;
  const errorCount = logs.filter((l) => l.status === "error" || l.status === "timeout").length;
  const totalLogCount = logs.length;
  const currentSuccessRate = totalLogCount > 0 ? ((successCount / totalLogCount) * 100).toFixed(1) : "0";

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="border-b border-white/5 py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-start justify-between">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <div className="flex items-center gap-2 mb-2">
                <Radio size={16} className="text-cyan-400" />
                <span className="text-cyan-400 text-sm" style={{ fontWeight: 500 }}>
                  订阅通信
                </span>
              </div>
              <h1 style={{ fontSize: "2rem", fontWeight: 700, letterSpacing: "-0.02em" }}>
                双向订阅通信监控
              </h1>
              <p className="text-gray-400 mt-2 text-sm">
                上次更新：{lastUpdated.toLocaleTimeString("zh-CN")}
                {liveMode && (
                  <span className="ml-2 inline-flex items-center gap-1 text-green-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                    实时
                  </span>
                )}
              </p>
            </motion.div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setLiveMode(!liveMode)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm transition-all ${
                  liveMode
                    ? "border-green-500/20 bg-green-500/10 text-green-400"
                    : "border-white/10 text-gray-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <Radio size={14} />
                {liveMode ? "实时中" : "已暂停"}
              </button>
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
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        {/* Overall status banner */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`flex items-center gap-4 p-5 rounded-2xl border ${
            overallStatus === "operational"
              ? "border-green-500/20 bg-green-500/5"
              : overallStatus === "partial"
              ? "border-amber-500/20 bg-amber-500/5"
              : "border-red-500/20 bg-red-500/5"
          }`}
        >
          {overallStatus === "operational" ? (
            <CheckCircle size={24} className="text-green-400 shrink-0" />
          ) : overallStatus === "partial" ? (
            <AlertTriangle size={24} className="text-amber-400 shrink-0" />
          ) : (
            <AlertCircle size={24} className="text-red-400 shrink-0" />
          )}
          <div>
            <div
              className={`text-sm mb-0.5 ${
                overallStatus === "operational"
                  ? "text-green-400"
                  : overallStatus === "partial"
                  ? "text-amber-400"
                  : "text-red-400"
              }`}
              style={{ fontWeight: 600 }}
            >
              {overallStatus === "operational"
                ? "双向通信正常运行"
                : overallStatus === "partial"
                ? "部分订阅处于空闲状态"
                : "存在通信异常模型"}
            </div>
            <div className="text-gray-400 text-sm">
              {activeModels.length} 个活跃 · {idleModels.length} 个空闲 · {errorModels.length} 个异常
            </div>
          </div>
        </motion.div>

        {/* Stats cards */}
        <div>
          <h2 className="text-white mb-4" style={{ fontWeight: 600 }}>
            通信概览
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                label: "总调用量",
                value: totalCalls.toLocaleString(),
                sub: "累计请求",
                color: "#00d4ff",
                icon: <Zap size={16} />,
              },
              {
                label: "平均成功率",
                value: `${avgSuccessRate.toFixed(1)}%`,
                sub: "近 24h",
                color: "#00ff88",
                icon: <CheckCircle size={16} />,
              },
              {
                label: "平均延迟",
                value: `${Math.round(avgLatency)}ms`,
                sub: "P50",
                color: "#f59e0b",
                icon: <Clock size={16} />,
              },
              {
                label: "活跃模型",
                value: `${activeModels.length}`,
                sub: `共 ${subscriptionModels.length} 个`,
                color: "#ec4899",
                icon: <Server size={16} />,
              },
            ].map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="p-5 rounded-2xl border border-white/5 bg-white/[0.02]"
              >
                <div className="flex items-center gap-2 mb-3">
                  <div style={{ color: stat.color }}>{stat.icon}</div>
                  <span className="text-gray-500 text-xs">{stat.label}</span>
                </div>
                <div className="text-white mb-0.5" style={{ fontSize: "1.4rem", fontWeight: 700 }}>
                  {stat.value}
                </div>
                <div className="text-gray-500 text-xs">{stat.sub}</div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Latency distribution cards */}
        <div>
          <h2 className="text-white mb-4" style={{ fontWeight: 600 }}>
            延迟分布
          </h2>
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "P50", value: latencyDistribution.p50, color: "#00d4ff" },
              { label: "P95", value: latencyDistribution.p95, color: "#00ff88" },
              { label: "P99", value: latencyDistribution.p99, color: "#f59e0b" },
            ].map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="p-5 rounded-2xl border border-white/5 bg-white/[0.02] flex items-center justify-between"
              >
                <div>
                  <span className="text-gray-500 text-xs">{stat.label}</span>
                  <div className="text-white mt-1" style={{ fontSize: "1.4rem", fontWeight: 700 }}>
                    {stat.value}ms
                  </div>
                </div>
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: `${stat.color}15` }}
                >
                  <Clock size={18} style={{ color: stat.color }} />
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Throughput chart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-5 rounded-2xl border border-white/5 bg-white/[0.02]"
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-white text-sm" style={{ fontWeight: 600 }}>
                消息吞吐量
              </h3>
              <span className="text-cyan-400 text-xs" style={{ fontWeight: 600 }}>
                实时 req/s
              </span>
            </div>
            <ResponsiveContainer width="100%" height={180}>
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
                <Area
                  type="monotone"
                  dataKey="inbound"
                  name="入站"
                  stroke="#00d4ff"
                  strokeWidth={2}
                  fill="url(#inboundGrad)"
                />
                <Area
                  type="monotone"
                  dataKey="outbound"
                  name="出站"
                  stroke="#00ff88"
                  strokeWidth={2}
                  fill="url(#outboundGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Mode ratio pie chart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-5 rounded-2xl border border-white/5 bg-white/[0.02]"
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-white text-sm" style={{ fontWeight: 600 }}>
                通信模式占比
              </h3>
              <span className="text-cyan-400 text-xs" style={{ fontWeight: 600 }}>
                按调用量
              </span>
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={modeRatios}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={4}
                  dataKey="count"
                  nameKey="mode"
                  stroke="none"
                >
                  {modeRatios.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }: any) => {
                    if (active && payload && payload.length) {
                      const d = payload[0].payload;
                      return (
                        <div className="px-3 py-2 rounded-lg border border-white/10 bg-[#0f1520] text-xs text-gray-300">
                          <div className="flex items-center gap-2 mb-1">
                            <div
                              className="w-2 h-2 rounded-full"
                              style={{ background: payload[0].fill }}
                            />
                            <span className="font-medium">{d.mode}</span>
                          </div>
                          <div className="text-gray-400">
                            {d.count.toLocaleString()} 次 ({d.percentage}%)
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex items-center justify-center gap-4 mt-2">
              {modeRatios.map((m, i) => (
                <div key={m.mode} className="flex items-center gap-1.5">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ background: COLORS[i % COLORS.length] }}
                  />
                  <span className="text-gray-400 text-xs">
                    {m.mode} {m.percentage}%
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Active models */}
        <div>
          <h2 className="text-white mb-4" style={{ fontWeight: 600 }}>
            参与通信的模型
          </h2>
          <div className="rounded-2xl border border-white/5 overflow-hidden">
            <div className="hidden md:grid grid-cols-7 gap-4 px-5 py-3 border-b border-white/5 bg-white/[0.02]">
              {["模型", "状态", "订阅时间", "最后活动", "总调用", "成功率", "平均延迟"].map((h) => (
                <div key={h} className="text-gray-500 text-xs" style={{ fontWeight: 500 }}>
                  {h}
                </div>
              ))}
            </div>
            {subscriptionModels.map((model, i) => (
              <motion.div
                key={model.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.04 }}
                className="grid grid-cols-2 md:grid-cols-7 gap-4 px-5 py-4 border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors items-center"
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-sm shrink-0"
                    style={{ background: `${model.color}15` }}
                  >
                    {model.icon}
                  </div>
                  <span className="text-white text-sm" style={{ fontWeight: 500 }}>
                    {model.name}
                  </span>
                </div>
                <div>
                  <div
                    className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs ${
                      model.status === "active"
                        ? "bg-green-500/10 text-green-400"
                        : model.status === "idle"
                        ? "bg-amber-500/10 text-amber-400"
                        : "bg-red-500/10 text-red-400"
                    }`}
                  >
                    <div
                      className={`w-1.5 h-1.5 rounded-full ${
                        model.status === "active"
                          ? "bg-green-400 animate-pulse"
                          : model.status === "idle"
                          ? "bg-amber-400"
                          : "bg-red-400"
                      }`}
                    />
                    {model.status === "active" ? "活跃" : model.status === "idle" ? "空闲" : "异常"}
                  </div>
                </div>
                <div className="hidden md:block text-gray-500 text-xs">
                  {new Date(model.subscribedAt).toLocaleDateString("zh-CN")}
                </div>
                <div className="hidden md:block text-gray-500 text-xs">
                  {formatTime(model.lastActivity)}
                </div>
                <div className="hidden md:block text-gray-400 text-sm">
                  {model.totalCalls.toLocaleString()}
                </div>
                <div className="hidden md:block text-green-400 text-sm" style={{ fontWeight: 500 }}>
                  {model.successRate}%
                </div>
                <div className="hidden md:block text-cyan-400 text-sm" style={{ fontWeight: 500 }}>
                  {model.avgLatency}ms
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Communication logs */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white" style={{ fontWeight: 600 }}>
              实时通信日志
            </h2>
            <div className="flex items-center gap-3">
              <span className="text-gray-500 text-xs">成功率 {currentSuccessRate}%</span>
              <span className="text-gray-600">·</span>
              <span className="text-gray-500 text-xs">{filteredLogs.length} 条</span>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2 mb-4 p-3 rounded-xl border border-white/5 bg-white/[0.02]">
            <Filter size={14} className="text-gray-500 mr-1" />
            <select
              value={filterModel}
              onChange={(e) => setFilterModel(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-[#0f1520] border border-white/10 text-gray-300 text-xs focus:outline-none focus:border-cyan-500/50"
            >
              <option value="all">全部模型</option>
              {subscriptionModels.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            <select
              value={filterDirection}
              onChange={(e) => setFilterDirection(e.target.value as CommDirection | "all")}
              className="px-3 py-1.5 rounded-lg bg-[#0f1520] border border-white/10 text-gray-300 text-xs focus:outline-none focus:border-cyan-500/50"
            >
              <option value="all">全部方向</option>
              <option value="mcp-to-openclaw">DeepMCP → OpenClaw</option>
              <option value="openclaw-to-mcp">OpenClaw → DeepMCP</option>
            </select>
            <select
              value={filterMode}
              onChange={(e) => setFilterMode(e.target.value as CommMode | "all")}
              className="px-3 py-1.5 rounded-lg bg-[#0f1520] border border-white/10 text-gray-300 text-xs focus:outline-none focus:border-cyan-500/50"
            >
              <option value="all">全部模式</option>
              <option value="Webhook">Webhook</option>
              <option value="WebSocket">WebSocket</option>
              <option value="SSE">SSE</option>
              <option value="Redis">Redis</option>
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as CommStatus | "all")}
              className="px-3 py-1.5 rounded-lg bg-[#0f1520] border border-white/10 text-gray-300 text-xs focus:outline-none focus:border-cyan-500/50"
            >
              <option value="all">全部状态</option>
              <option value="success">成功</option>
              <option value="pending">进行中</option>
              <option value="error">失败</option>
              <option value="timeout">超时</option>
            </select>
          </div>

          {/* Log list */}
          <div className="rounded-2xl border border-white/5 overflow-hidden">
            <div className="hidden md:grid grid-cols-12 gap-4 px-5 py-3 border-b border-white/5 bg-white/[0.02]">
              {["时间", "模型", "方向", "类型", "模式", "状态", "延迟", "Payload", "摘要"].map((h) => (
                <div
                  key={h}
                  className="text-gray-500 text-xs"
                  style={{ fontWeight: 500 }}
                >
                  {h}
                </div>
              ))}
            </div>
            <div className="max-h-[480px] overflow-y-auto">
              {filteredLogs.length === 0 ? (
                <div className="px-5 py-10 text-center text-gray-500 text-sm">
                  <Layers size={24} className="mx-auto mb-2 opacity-50" />
                  无匹配日志
                </div>
              ) : (
                filteredLogs.map((log, i) => (
                  <motion.div
                    key={log.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: Math.min(i * 0.01, 0.3) }}
                    className="grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-4 px-5 py-3 border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors items-start md:items-center"
                  >
                    <div className="md:col-span-1 text-gray-500 text-xs">{formatTime(log.timestamp)}</div>
                    <div className="md:col-span-1 text-white text-xs" style={{ fontWeight: 500 }}>
                      {log.modelName}
                    </div>
                    <div className="md:col-span-2">{directionBadge(log.direction)}</div>
                    <div className="md:col-span-1 text-gray-400 text-xs">{log.type}</div>
                    <div className="md:col-span-1 text-gray-400 text-xs">{log.mode}</div>
                    <div className="md:col-span-1">{statusBadge(log.status)}</div>
                    <div className="md:col-span-1 text-cyan-400 text-xs" style={{ fontWeight: 500 }}>
                      {log.latencyMs}ms
                    </div>
                    <div className="md:col-span-1 text-gray-500 text-xs">{(log.payloadSize / 1024).toFixed(1)}KB</div>
                    <div className="md:col-span-3 text-gray-300 text-xs truncate">
                      {log.summary}
                      {log.errorMessage && (
                        <span className="block text-red-400 text-[10px] mt-0.5">{log.errorMessage}</span>
                      )}
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Call chain timeline */}
        <div>
          <h2 className="text-white mb-4" style={{ fontWeight: 600 }}>
            调用链路时间线
          </h2>
          <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5 space-y-4">
            {logs
              .filter((l) => l.status !== "heartbeat")
              .slice(0, 8)
              .map((log, i) => (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.06 }}
                  className="flex items-start gap-4"
                >
                  <div className="flex flex-col items-center shrink-0">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        log.direction === "mcp-to-openclaw"
                          ? "bg-cyan-500/10"
                          : "bg-green-500/10"
                      }`}
                    >
                      {log.direction === "mcp-to-openclaw" ? (
                        <ArrowUpRight
                          size={14}
                          className={
                            log.status === "success"
                              ? "text-cyan-400"
                              : log.status === "error"
                              ? "text-red-400"
                              : "text-amber-400"
                          }
                        />
                      ) : (
                        <ArrowDownLeft
                          size={14}
                          className={
                            log.status === "success"
                              ? "text-green-400"
                              : log.status === "error"
                              ? "text-red-400"
                              : "text-amber-400"
                          }
                        />
                      )}
                    </div>
                    {i < 7 && <div className="w-px h-full min-h-[24px] bg-white/5 mt-2" />}
                  </div>
                  <div className="flex-1 pb-2">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-white text-sm" style={{ fontWeight: 500 }}>
                        {log.modelName}
                      </span>
                      <span className="text-gray-600">·</span>
                      {directionBadge(log.direction)}
                      <span className="text-gray-600">·</span>
                      {statusBadge(log.status)}
                    </div>
                    <p className="text-gray-400 text-xs">{log.summary}</p>
                    <div className="flex items-center gap-3 mt-1.5 text-gray-600 text-xs">
                      <span>{formatTime(log.timestamp)}</span>
                      <span>{log.mode}</span>
                      <span>{log.latencyMs}ms</span>
                      <span>{(log.payloadSize / 1024).toFixed(1)}KB</span>
                    </div>
                    {log.errorMessage && (
                      <div className="mt-1.5 p-2 rounded-lg bg-red-500/5 border border-red-500/10 text-red-400 text-xs">
                        {log.errorMessage}
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}
