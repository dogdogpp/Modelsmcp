import { NavLink } from "react-router";
import { motion } from "motion/react";
import { Search, Filter, Zap, ChevronRight } from "lucide-react";
import { useState } from "react";
import { models, categories, type ModelInfo } from "../data/models";

function ModelCard({ model, index }: { model: ModelInfo; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <NavLink
        to={`/models/${model.id}`}
        className="flex flex-col h-full p-6 rounded-2xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/10 transition-all group"
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0"
              style={{
                background: `${model.color}12`,
                border: `1px solid ${model.color}25`,
              }}
            >
              {model.icon}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-white" style={{ fontWeight: 600, fontSize: "0.95rem" }}>{model.name}</span>
                <span className="text-gray-600 text-xs px-1.5 py-0.5 rounded bg-white/5">v{model.version}</span>
              </div>
              <span className="text-gray-500 text-xs">{model.category}</span>
            </div>
          </div>
          <div
            className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs shrink-0 ${
              model.status === "online"
                ? "bg-green-500/10 text-green-400"
                : model.status === "loading"
                ? "bg-amber-500/10 text-amber-400"
                : "bg-red-500/10 text-red-400"
            }`}
          >
            <div
              className={`w-1.5 h-1.5 rounded-full ${
                model.status === "online"
                  ? "bg-green-400 animate-pulse"
                  : model.status === "loading"
                  ? "bg-amber-400 animate-pulse"
                  : "bg-red-400"
              }`}
            />
            {model.status === "online" ? "在线" : model.status === "loading" ? "加载中" : "离线"}
          </div>
        </div>

        {/* Description */}
        <p className="text-gray-400 text-sm leading-relaxed mb-4 flex-1">{model.description}</p>

        {/* Tags */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {model.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="px-2 py-0.5 rounded-md text-xs bg-white/5 text-gray-500"
            >
              {tag}
            </span>
          ))}
        </div>

        {/* Stats row */}
        <div className="flex items-center justify-between pt-4 border-t border-white/5">
          <div className="flex gap-4">
            <div>
              <div className="text-white text-xs" style={{ fontWeight: 500 }}>{model.latency}</div>
              <div className="text-gray-600 text-xs">延迟</div>
            </div>
            <div>
              <div className="text-white text-xs" style={{ fontWeight: 500 }}>{model.params}</div>
              <div className="text-gray-600 text-xs">参数量</div>
            </div>
            <div>
              <div className="text-white text-xs" style={{ fontWeight: 500 }}>{model.throughput}</div>
              <div className="text-gray-600 text-xs">吞吐量</div>
            </div>
          </div>
          <div className="flex items-center gap-1 text-gray-600 group-hover:text-cyan-400 transition-colors">
            <span className="text-xs">详情</span>
            <ChevronRight size={13} />
          </div>
        </div>
      </NavLink>
    </motion.div>
  );
}

export function Models() {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("全部");

  const filtered = models.filter((m) => {
    const matchCategory = activeCategory === "全部" || m.category === activeCategory;
    const matchSearch =
      search === "" ||
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.description.includes(search) ||
      m.category.includes(search) ||
      m.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()));
    return matchCategory && matchSearch;
  });

  const onlineCount = models.filter((m) => m.status === "online").length;

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="relative py-20 border-b border-white/5">
        <div
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `linear-gradient(rgba(0,212,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,255,1) 1px, transparent 1px)`,
            backgroundSize: "60px 60px",
          }}
        />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="flex items-center gap-2 mb-3">
              <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              <span className="text-green-400 text-xs" style={{ fontWeight: 500 }}>{onlineCount} 个模型在线</span>
            </div>
            <h1 className="mb-3" style={{ fontSize: "2.5rem", fontWeight: 700, letterSpacing: "-0.03em" }}>
              模型市场
            </h1>
            <p className="text-gray-400 max-w-xl">
              浏览所有可用的深度学习推理模型，每个模型均已封装为标准 MCP 工具，支持本地 GPU/CPU 推理
            </p>
          </motion.div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Search & Filter */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              placeholder="搜索模型名称、类别、标签..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-white/10 bg-white/5 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-cyan-500/30 focus:bg-white/[0.07] transition-all"
            />
          </div>
        </div>

        {/* Category tabs */}
        <div className="flex flex-wrap gap-2 mb-8">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-4 py-1.5 rounded-full text-sm transition-all ${
                activeCategory === cat
                  ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"
                  : "text-gray-500 border border-white/5 hover:border-white/10 hover:text-gray-300"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Results count */}
        <div className="flex items-center gap-2 mb-6">
          <span className="text-gray-500 text-sm">找到 <span className="text-white">{filtered.length}</span> 个模型</span>
          {search && (
            <button
              onClick={() => setSearch("")}
              className="text-cyan-400 text-xs hover:text-cyan-300"
            >
              清除搜索
            </button>
          )}
        </div>

        {/* Model grid */}
        {filtered.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {filtered.map((model, i) => (
              <ModelCard key={model.id} model={model} index={i} />
            ))}
          </div>
        ) : (
          <div className="text-center py-24">
            <div className="text-4xl mb-4">🔍</div>
            <p className="text-gray-400">未找到匹配的模型</p>
            <button
              onClick={() => { setSearch(""); setActiveCategory("全部"); }}
              className="mt-4 text-cyan-400 text-sm hover:text-cyan-300"
            >
              重置筛选
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
