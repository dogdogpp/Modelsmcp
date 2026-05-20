import { motion } from "motion/react";
import { useState } from "react";
import {
  Activity,
  CheckCircle,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { models } from "../data/models";

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
      </div>
    </div>
  );
}
