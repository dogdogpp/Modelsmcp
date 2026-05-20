import { motion } from "motion/react";
import { useState, useEffect } from "react";
import {
  Activity,
  CheckCircle,
  AlertCircle,
  Clock,
  Cpu,
  MemoryStick,
  Zap,
  RefreshCw,
  Server,
  HardDrive,
} from "lucide-react";
import { models } from "../data/models";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

// Generate mock latency history
function generateHistory(base: number, points = 20) {
  return Array.from({ length: points }, (_, i) => ({
    time: `${i}m`,
    value: Math.round(base + (Math.random() - 0.5) * base * 0.3),
  }));
}

const latencyHistory = generateHistory(25);
const throughputHistory = generateHistory(60);

const systemStats = [
  { label: "GPU 利用率", value: "67%", sub: "RTX 4090", color: "#00d4ff", icon: <Cpu size={16} /> },
  { label: "GPU 显存", value: "14.2 / 24 GB", sub: "59% 使用", color: "#7c3aed", icon: <MemoryStick size={16} /> },
  { label: "CPU 利用率", value: "23%", sub: "16 核心", color: "#00ff88", icon: <Server size={16} /> },
  { label: "磁盘空间", value: "48.3 GB", sub: "模型存储", color: "#f59e0b", icon: <HardDrive size={16} /> },
];

const incidents = [
  { time: "2026-03-29 10:23", type: "info", msg: "SAM2 模型权重更新至 v2.1.0" },
  { time: "2026-03-28 14:55", type: "warning", msg: "DINOv2 模型冷启动加载中（预计 2 分钟）" },
  { time: "2026-03-27 09:10", type: "info", msg: "新增 Grounding DINO v1.5 支持" },
  { time: "2026-03-25 16:00", type: "resolved", msg: "GPU 显存不足问题已修复（已优化批处理队列）" },
];

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="px-3 py-2 rounded-lg border border-white/10 bg-[#0f1520] text-xs text-gray-300">
        {payload[0].value}{payload[0].name === "延迟" ? "ms" : " req/s"}
      </div>
    );
  }
  return null;
};

export function Status() {
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await new Promise((r) => setTimeout(r, 800));
    setLastUpdated(new Date());
    setRefreshing(false);
  };

  const onlineModels = models.filter((m) => m.status === "online").length;
  const loadingModels = models.filter((m) => m.status === "loading").length;
  const offlineModels = models.filter((m) => m.status === "offline").length;

  const overallStatus =
    offlineModels > 0 ? "degraded" : loadingModels > 0 ? "partial" : "operational";

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="border-b border-white/5 py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-start justify-between">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <div className="flex items-center gap-2 mb-2">
                <Activity size={16} className="text-cyan-400" />
                <span className="text-cyan-400 text-sm" style={{ fontWeight: 500 }}>系统状态</span>
              </div>
              <h1 style={{ fontSize: "2rem", fontWeight: 700, letterSpacing: "-0.02em" }}>
                服务状态监控
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
          ) : (
            <AlertCircle size={24} className="text-amber-400 shrink-0" />
          )}
          <div>
            <div
              className={`text-sm mb-0.5 ${
                overallStatus === "operational" ? "text-green-400" : overallStatus === "partial" ? "text-amber-400" : "text-red-400"
              }`}
              style={{ fontWeight: 600 }}
            >
              {overallStatus === "operational" ? "所有服务运行正常" : overallStatus === "partial" ? "部分服务加载中" : "服务降级"}
            </div>
            <div className="text-gray-400 text-sm">
              {onlineModels} 个模型在线 · {loadingModels} 个加载中 · {offlineModels} 个离线
            </div>
          </div>
        </motion.div>

        {/* System stats */}
        <div>
          <h2 className="text-white mb-4" style={{ fontWeight: 600 }}>系统资源</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {systemStats.map((stat, i) => (
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
                <div className="text-white mb-0.5" style={{ fontSize: "1.4rem", fontWeight: 700 }}>{stat.value}</div>
                <div className="text-gray-500 text-xs">{stat.sub}</div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="p-5 rounded-2xl border border-white/5 bg-white/[0.02]">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-white text-sm" style={{ fontWeight: 600 }}>平均推理延迟</h3>
              <span className="text-cyan-400 text-xs" style={{ fontWeight: 600 }}>~25ms</span>
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={latencyHistory}>
                <defs>
                  <linearGradient id="latencyGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00d4ff" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#00d4ff" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                <XAxis dataKey="time" tick={{ fill: "#555", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#555", fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="value"
                  name="延迟"
                  stroke="#00d4ff"
                  strokeWidth={2}
                  fill="url(#latencyGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="p-5 rounded-2xl border border-white/5 bg-white/[0.02]">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-white text-sm" style={{ fontWeight: 600 }}>请求吞吐量</h3>
              <span className="text-green-400 text-xs" style={{ fontWeight: 600 }}>~60 req/s</span>
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={throughputHistory}>
                <defs>
                  <linearGradient id="throughputGrad" x1="0" y1="0" x2="0" y2="1">
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
                  dataKey="value"
                  name="吞吐"
                  stroke="#00ff88"
                  strokeWidth={2}
                  fill="url(#throughputGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Model status table */}
        <div>
          <h2 className="text-white mb-4" style={{ fontWeight: 600 }}>模型状态</h2>
          <div className="rounded-2xl border border-white/5 overflow-hidden">
            <div className="hidden md:grid grid-cols-6 gap-4 px-5 py-3 border-b border-white/5 bg-white/[0.02]">
              {["模型", "类别", "状态", "延迟", "吞吐量", "参数量"].map((h) => (
                <div key={h} className="text-gray-500 text-xs" style={{ fontWeight: 500 }}>{h}</div>
              ))}
            </div>
            {models.map((model, i) => (
              <motion.div
                key={model.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.04 }}
                className="grid grid-cols-3 md:grid-cols-6 gap-4 px-5 py-4 border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors items-center"
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-sm shrink-0"
                    style={{ background: `${model.color}15` }}
                  >
                    {model.icon}
                  </div>
                  <span className="text-white text-sm" style={{ fontWeight: 500 }}>{model.name}</span>
                </div>
                <div className="hidden md:block text-gray-500 text-xs">{model.category}</div>
                <div>
                  <div
                    className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs ${
                      model.status === "online"
                        ? "bg-green-500/10 text-green-400"
                        : model.status === "loading"
                        ? "bg-amber-500/10 text-amber-400"
                        : "bg-red-500/10 text-red-400"
                    }`}
                  >
                    <div
                      className={`w-1.5 h-1.5 rounded-full ${
                        model.status === "online" ? "bg-green-400 animate-pulse" : model.status === "loading" ? "bg-amber-400 animate-pulse" : "bg-red-400"
                      }`}
                    />
                    {model.status === "online" ? "在线" : model.status === "loading" ? "加载中" : "离线"}
                  </div>
                </div>
                <div className="hidden md:block text-cyan-400 text-sm" style={{ fontWeight: 500 }}>{model.latency}</div>
                <div className="hidden md:block text-gray-400 text-sm">{model.throughput}</div>
                <div className="hidden md:block text-gray-500 text-xs">{model.params}</div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Incidents */}
        <div>
          <h2 className="text-white mb-4" style={{ fontWeight: 600 }}>近期事件</h2>
          <div className="space-y-3">
            {incidents.map((inc, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.08 }}
                className="flex items-start gap-4 p-4 rounded-xl border border-white/5 bg-white/[0.02]"
              >
                <div className={`mt-0.5 shrink-0 ${
                  inc.type === "info" ? "text-cyan-400" :
                  inc.type === "warning" ? "text-amber-400" : "text-green-400"
                }`}>
                  {inc.type === "info" ? <Activity size={15} /> :
                   inc.type === "warning" ? <AlertCircle size={15} /> : <CheckCircle size={15} />}
                </div>
                <div className="flex-1">
                  <p className="text-gray-300 text-sm">{inc.msg}</p>
                  <p className="text-gray-600 text-xs mt-1">{inc.time}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${
                  inc.type === "info" ? "bg-cyan-500/10 text-cyan-400" :
                  inc.type === "warning" ? "bg-amber-500/10 text-amber-400" : "bg-green-500/10 text-green-400"
                }`}>
                  {inc.type === "info" ? "信息" : inc.type === "warning" ? "警告" : "已解决"}
                </span>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
