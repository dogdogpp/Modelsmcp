import { useParams, NavLink } from "react-router";
import { motion } from "motion/react";
import {
  ArrowLeft,
  Copy,
  CheckCircle,
  Zap,
  Cpu,
  Package,
  FileCode2,
  Play,
  ExternalLink,
  ChevronRight,
} from "lucide-react";
import { models } from "../data/models";
import { useState } from "react";

export function ModelDetail() {
  const { modelId } = useParams<{ modelId: string }>();
  const model = models.find((m) => m.id === modelId);
  const [copied, setCopied] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "api" | "example">("overview");

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  if (!model) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4">404</div>
          <p className="text-gray-400 mb-4">模型不存在</p>
          <NavLink to="/models" className="text-cyan-400 hover:text-cyan-300">
            返回模型市场
          </NavLink>
        </div>
      </div>
    );
  }

  const installCmd = `pip install deepmcp\ndeep pull ${model.id}`;
  const pythonExample = `import deepmcp

client = deepmcp.Client("http://localhost:8081")

result = client.call("${model.mcpTool}", {
    "image": "https://example.com/image.jpg",
    # 更多参数见下方 API 文档
})

print(result)`;

  const relatedModels = models.filter(
    (m) => m.id !== model.id && m.category === model.category
  ).slice(0, 3);

  return (
    <div className="min-h-screen">
      {/* Breadcrumb */}
      <div className="border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-2 text-sm">
            <NavLink to="/models" className="text-gray-500 hover:text-gray-300 flex items-center gap-1.5 transition-colors">
              <ArrowLeft size={14} />
              模型市场
            </NavLink>
            <ChevronRight size={13} className="text-gray-600" />
            <span className="text-gray-400">{model.name}</span>
          </div>
        </div>
      </div>

      {/* Hero */}
      <div className="relative py-12 border-b border-white/5 overflow-hidden">
        <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse at 20% 50%, ${model.color}08 0%, transparent 60%)` }} />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col lg:flex-row lg:items-start gap-8"
          >
            <div className="flex-1">
              <div className="flex items-center gap-4 mb-5">
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl"
                  style={{ background: `${model.color}15`, border: `1px solid ${model.color}30` }}
                >
                  {model.icon}
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h1 style={{ fontSize: "2rem", fontWeight: 700, letterSpacing: "-0.02em" }}>{model.name}</h1>
                    <span className="text-gray-500 text-sm px-2 py-0.5 rounded bg-white/5 border border-white/5">
                      v{model.version}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className="text-sm px-2.5 py-0.5 rounded-full"
                      style={{ color: model.color, background: `${model.color}15` }}
                    >
                      {model.category}
                    </span>
                    <div className={`flex items-center gap-1.5 text-sm ${
                      model.status === "online" ? "text-green-400" : model.status === "loading" ? "text-amber-400" : "text-red-400"
                    }`}>
                      <div className={`w-1.5 h-1.5 rounded-full ${
                        model.status === "online" ? "bg-green-400 animate-pulse" : model.status === "loading" ? "bg-amber-400 animate-pulse" : "bg-red-400"
                      }`} />
                      {model.status === "online" ? "在线可用" : model.status === "loading" ? "加载中" : "离线"}
                    </div>
                  </div>
                </div>
              </div>

              <p className="text-gray-400 leading-relaxed max-w-2xl mb-6">{model.longDescription}</p>

              <div className="flex flex-wrap gap-2 mb-6">
                {model.tags.map((tag) => (
                  <span key={tag} className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/5 text-gray-400 text-xs">
                    {tag}
                  </span>
                ))}
              </div>

              <div className="flex flex-wrap gap-3">
                <NavLink
                  to="/playground"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm"
                  style={{ background: `linear-gradient(135deg, ${model.color}, ${model.color}99)`, fontWeight: 600 }}
                >
                  <Play size={15} />
                  在 Playground 中测试
                </NavLink>
                <NavLink
                  to="/docs"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-white/10 text-gray-300 text-sm hover:bg-white/5 transition-colors"
                >
                  <FileCode2 size={15} />
                  查看文档
                </NavLink>
              </div>
            </div>

            {/* Stats card */}
            <div className="lg:w-72 shrink-0">
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
                <h3 className="text-white text-sm mb-4" style={{ fontWeight: 600 }}>模型信息</h3>
                <div className="space-y-3">
                  {[
                    { label: "参数量", value: model.params },
                    { label: "推理延迟", value: model.latency, accent: true },
                    { label: "吞吐量", value: model.throughput },
                    { label: "推理框架", value: model.framework },
                    { label: "开源许可", value: model.license },
                    { label: "MCP 工具名", value: model.mcpTool, mono: true },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
                      <span className="text-gray-500 text-xs">{item.label}</span>
                      <span
                        className={`text-xs ${item.mono ? "font-mono" : ""} ${item.accent ? "text-cyan-400" : "text-gray-300"}`}
                        style={{ fontWeight: item.accent ? 600 : 400 }}
                      >
                        {item.value}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="mt-4 pt-4 border-t border-white/5">
                  <div className="text-gray-500 text-xs mb-2">输入格式</div>
                  <div className="flex flex-wrap gap-1">
                    {model.inputType.map((t) => (
                      <span key={t} className="px-1.5 py-0.5 rounded bg-white/5 text-gray-500 text-xs font-mono">{t}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-1 mb-8 border-b border-white/5">
          {(["overview", "api", "example"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-2.5 text-sm transition-all border-b-2 -mb-px ${
                activeTab === tab
                  ? "text-white border-cyan-400"
                  : "text-gray-500 border-transparent hover:text-gray-300"
              }`}
              style={{ fontWeight: activeTab === tab ? 600 : 400 }}
            >
              {tab === "overview" ? "概览" : tab === "api" ? "API 参数" : "代码示例"}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === "overview" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-8"
          >
            {/* Use cases */}
            <div>
              <h3 className="text-white mb-4" style={{ fontWeight: 600 }}>应用场景</h3>
              <div className="grid grid-cols-2 gap-3">
                {model.useCases.map((uc) => (
                  <div
                    key={uc}
                    className="flex items-center gap-2.5 p-3 rounded-xl border border-white/5 bg-white/[0.02]"
                  >
                    <div className="w-2 h-2 rounded-full" style={{ background: model.color }} />
                    <span className="text-gray-300 text-sm">{uc}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Install */}
            <div>
              <h3 className="text-white mb-4" style={{ fontWeight: 600 }}>快速安装</h3>
              <div className="rounded-xl border border-white/10 bg-[#0d1117] overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/5 bg-white/[0.02]">
                  <div className="flex items-center gap-2">
                    <Cpu size={13} className="text-gray-500" />
                    <span className="text-gray-500 text-xs">Terminal</span>
                  </div>
                  <button
                    onClick={() => handleCopy(installCmd, "install")}
                    className="flex items-center gap-1 text-gray-500 hover:text-white text-xs transition-colors"
                  >
                    {copied === "install" ? (
                      <><CheckCircle size={12} className="text-green-400" /><span className="text-green-400">已复制</span></>
                    ) : (
                      <><Copy size={12} /><span>复制</span></>
                    )}
                  </button>
                </div>
                <div className="p-4">
                  <pre className="text-sm font-mono text-cyan-300">{installCmd}</pre>
                </div>
              </div>

              <h3 className="text-white mb-4 mt-6" style={{ fontWeight: 600 }}>Python 调用</h3>
              <div className="rounded-xl border border-white/10 bg-[#0d1117] overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/5 bg-white/[0.02]">
                  <div className="flex items-center gap-2">
                    <FileCode2 size={13} className="text-gray-500" />
                    <span className="text-gray-500 text-xs">Python</span>
                  </div>
                  <button
                    onClick={() => handleCopy(pythonExample, "python")}
                    className="flex items-center gap-1 text-gray-500 hover:text-white text-xs transition-colors"
                  >
                    {copied === "python" ? (
                      <><CheckCircle size={12} className="text-green-400" /><span className="text-green-400">已复制</span></>
                    ) : (
                      <><Copy size={12} /><span>复制</span></>
                    )}
                  </button>
                </div>
                <div className="p-4 overflow-x-auto">
                  <pre className="text-xs font-mono text-gray-300 leading-relaxed">{pythonExample}</pre>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === "api" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div>
                <h3 className="text-white mb-4" style={{ fontWeight: 600 }}>MCP 调用格式</h3>
                <div className="rounded-xl border border-white/10 bg-[#0d1117] overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/5 bg-white/[0.02]">
                    <span className="text-gray-500 text-xs font-mono">{model.mcpTool}</span>
                    <button
                      onClick={() => handleCopy(model.mcpExample, "mcp")}
                      className="flex items-center gap-1 text-gray-500 hover:text-white text-xs transition-colors"
                    >
                      {copied === "mcp" ? (
                        <><CheckCircle size={12} className="text-green-400" /><span className="text-green-400">已复制</span></>
                      ) : (
                        <><Copy size={12} /><span>复制</span></>
                      )}
                    </button>
                  </div>
                  <div className="p-4 overflow-x-auto">
                    <pre className="text-xs font-mono text-gray-300 leading-relaxed">{model.mcpExample}</pre>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-white mb-4" style={{ fontWeight: 600 }}>输入/输出规格</h3>
                <div className="space-y-4">
                  <div className="p-4 rounded-xl border border-white/5 bg-white/[0.02]">
                    <div className="text-gray-400 text-xs mb-2" style={{ fontWeight: 500 }}>输入格式</div>
                    <div className="flex flex-wrap gap-2">
                      {model.inputType.map((t) => (
                        <span key={t} className="px-2 py-1 rounded bg-cyan-500/10 text-cyan-400 text-xs font-mono border border-cyan-500/20">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="p-4 rounded-xl border border-white/5 bg-white/[0.02]">
                    <div className="text-gray-400 text-xs mb-2" style={{ fontWeight: 500 }}>输出格式</div>
                    <div className="flex flex-wrap gap-2">
                      {model.outputType.map((t) => (
                        <span key={t} className="px-2 py-1 rounded bg-purple-500/10 text-purple-400 text-xs font-mono border border-purple-500/20">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <h3 className="text-white mb-4 mt-6" style={{ fontWeight: 600 }}>性能指标</h3>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "推理延迟", value: model.latency, color: "#00d4ff" },
                    { label: "吞吐量", value: model.throughput, color: "#00ff88" },
                    { label: "参数量", value: model.params, color: "#7c3aed" },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="p-3 rounded-xl border border-white/5 bg-white/[0.02] text-center"
                    >
                      <div style={{ color: item.color, fontSize: "1.1rem", fontWeight: 700 }}>{item.value}</div>
                      <div className="text-gray-500 text-xs mt-0.5">{item.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === "example" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="space-y-6">
              <div>
                <h3 className="text-white mb-4" style={{ fontWeight: 600 }}>在 Claude 中使用</h3>
                <div className="rounded-xl border border-white/10 bg-[#0d1117] overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-white/5 bg-white/[0.02] flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-cyan-400" />
                    <span className="text-gray-500 text-xs">claude_config.json</span>
                  </div>
                  <div className="p-4 overflow-x-auto">
                    <pre className="text-xs font-mono text-gray-300 leading-relaxed">{`{
  "mcpServers": {
    "deepmcp": {
      "command": "deepmcp",
      "args": ["serve", "--port", "8081"],
      "env": {
        "DEEPMCP_MODELS": "${model.id}",
        "DEEPMCP_DEVICE": "cuda"
      }
    }
  }
}`}</pre>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-white mb-4" style={{ fontWeight: 600 }}>在 OpenClaw 中使用</h3>
                <div className="rounded-xl border border-white/10 bg-[#0d1117] overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-white/5 bg-white/[0.02] flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-purple-400" />
                    <span className="text-gray-500 text-xs">openclaw_config.yaml</span>
                  </div>
                  <div className="p-4 overflow-x-auto">
                    <pre className="text-xs font-mono text-gray-300 leading-relaxed">{`mcp_servers:
  deepmcp:
    url: "http://localhost:8081/mcp"
    tools:
      - ${model.mcpTool}
    auth:
      type: none`}</pre>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Related models */}
        {relatedModels.length > 0 && (
          <div className="mt-16">
            <h3 className="text-white mb-6" style={{ fontWeight: 600 }}>同类模型</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {relatedModels.map((rm) => (
                <NavLink
                  key={rm.id}
                  to={`/models/${rm.id}`}
                  className="flex items-center gap-3 p-4 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/10 transition-all"
                >
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-xl shrink-0"
                    style={{ background: `${rm.color}12`, border: `1px solid ${rm.color}25` }}
                  >
                    {rm.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-white text-sm" style={{ fontWeight: 500 }}>{rm.name}</div>
                    <div className="text-gray-500 text-xs truncate">{rm.description.slice(0, 30)}...</div>
                  </div>
                  <ChevronRight size={14} className="text-gray-600 shrink-0" />
                </NavLink>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
