import { motion } from "motion/react";
import { useState } from "react";
import {
  Play,
  Upload,
  Copy,
  CheckCircle,
  RotateCcw,
  ChevronDown,
  ImageIcon,
  Loader2,
  Terminal,
  Sparkles,
} from "lucide-react";
import { models } from "../data/models";

export function Playground() {
  const [selectedModel, setSelectedModel] = useState(models[0]);
  const [imageUrl, setImageUrl] = useState("https://example.com/image.jpg");
  const [confidence, setConfidence] = useState(0.5);
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<object | null>(null);
  const [copied, setCopied] = useState(false);
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  const handleRun = async () => {
    setIsRunning(true);
    setResult(null);
    const newLogs: string[] = [];

    newLogs.push(`[${new Date().toLocaleTimeString()}] 初始化推理引擎...`);
    setLogs([...newLogs]);
    await new Promise((r) => setTimeout(r, 400));

    newLogs.push(`[${new Date().toLocaleTimeString()}] 加载模型 ${selectedModel.name}...`);
    setLogs([...newLogs]);
    await new Promise((r) => setTimeout(r, 600));

    newLogs.push(`[${new Date().toLocaleTimeString()}] 预处理输入数据...`);
    setLogs([...newLogs]);
    await new Promise((r) => setTimeout(r, 300));

    newLogs.push(`[${new Date().toLocaleTimeString()}] 执行推理 (${selectedModel.latency})...`);
    setLogs([...newLogs]);
    await new Promise((r) => setTimeout(r, 800));

    newLogs.push(`[${new Date().toLocaleTimeString()}] 推理请求已提交，真实结果需从后端服务获取`);
    setLogs([...newLogs]);

    setResult({
      message: "推理请求已提交，真实结果需从后端服务获取",
      model: selectedModel.id,
      tool: selectedModel.mcpTool,
    });
    setIsRunning(false);
  };

  const handleCopy = () => {
    if (result) {
      navigator.clipboard.writeText(JSON.stringify(result, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleReset = () => {
    setResult(null);
    setLogs([]);
    setImageUrl("https://example.com/image.jpg");
    setConfidence(0.5);
  };

  const mcpCallJson = JSON.stringify({
    tool: selectedModel.mcpTool,
    arguments: {
      image: imageUrl,
      confidence: confidence,
    }
  }, null, 2);

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="border-b border-white/5 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="flex items-center gap-2 mb-2">
              <Sparkles size={16} className="text-cyan-400" />
              <span className="text-cyan-400 text-sm" style={{ fontWeight: 500 }}>交互式测试环境</span>
            </div>
            <h1 style={{ fontSize: "2rem", fontWeight: 700, letterSpacing: "-0.02em" }}>
              Playground
            </h1>
            <p className="text-gray-400 mt-2">
              选择模型，配置参数，即时查看推理结果
            </p>
          </motion.div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Left panel - Config */}
          <div className="lg:col-span-2 space-y-5">
            {/* Model selector */}
            <div className="p-5 rounded-2xl border border-white/5 bg-white/[0.02]">
              <label className="text-gray-400 text-xs mb-3 block" style={{ fontWeight: 500 }}>选择模型</label>
              <div className="relative">
                <button
                  onClick={() => setShowModelDropdown(!showModelDropdown)}
                  className="w-full flex items-center justify-between p-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/[0.07] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-base"
                      style={{ background: `${selectedModel.color}15` }}
                    >
                      {selectedModel.icon}
                    </div>
                    <div className="text-left">
                      <div className="text-white text-sm" style={{ fontWeight: 500 }}>{selectedModel.name}</div>
                      <div className="text-gray-500 text-xs">{selectedModel.category}</div>
                    </div>
                  </div>
                  <ChevronDown size={15} className={`text-gray-500 transition-transform ${showModelDropdown ? "rotate-180" : ""}`} />
                </button>

                {showModelDropdown && (
                  <div className="absolute top-full mt-2 left-0 right-0 z-10 rounded-xl border border-white/10 bg-[#0f1520] shadow-2xl overflow-hidden">
                    <div className="max-h-64 overflow-y-auto">
                      {models.map((m) => (
                        <button
                          key={m.id}
                          onClick={() => { setSelectedModel(m); setShowModelDropdown(false); setResult(null); setLogs([]); }}
                          className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left ${selectedModel.id === m.id ? "bg-white/5" : ""}`}
                        >
                          <div
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-base shrink-0"
                            style={{ background: `${m.color}15` }}
                          >
                            {m.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-white text-sm" style={{ fontWeight: 500 }}>{m.name}</div>
                            <div className="text-gray-500 text-xs truncate">{m.category}</div>
                          </div>
                          <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                            m.status === "online" ? "bg-green-400" : m.status === "loading" ? "bg-amber-400" : "bg-red-400"
                          }`} />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Input config */}
            <div className="p-5 rounded-2xl border border-white/5 bg-white/[0.02]">
              <label className="text-gray-400 text-xs mb-3 block" style={{ fontWeight: 500 }}>输入配置</label>

              <div className="space-y-4">
                <div>
                  <label className="text-gray-500 text-xs mb-1.5 block">图片 URL</label>
                  <input
                    type="text"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-cyan-500/30 transition-colors font-mono"
                    placeholder="https://example.com/image.jpg"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-gray-500 text-xs">置信度阈值</label>
                    <span className="text-cyan-400 text-xs" style={{ fontWeight: 600 }}>{confidence.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="0.95"
                    step="0.05"
                    value={confidence}
                    onChange={(e) => setConfidence(parseFloat(e.target.value))}
                    className="w-full accent-cyan-400 cursor-pointer"
                  />
                  <div className="flex justify-between text-gray-600 text-xs mt-1">
                    <span>0.1</span>
                    <span>0.95</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={handleRun}
                disabled={isRunning || selectedModel.status !== "online"}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: isRunning ? "#1a2030" : `linear-gradient(135deg, ${selectedModel.color}, ${selectedModel.color}99)`,
                  fontWeight: 600,
                }}
              >
                {isRunning ? (
                  <><Loader2 size={16} className="animate-spin" /><span>推理中...</span></>
                ) : (
                  <><Play size={16} /><span>运行推理</span></>
                )}
              </button>
              <button
                onClick={handleReset}
                className="p-3 rounded-xl border border-white/10 text-gray-400 hover:text-white hover:bg-white/5 transition-all"
              >
                <RotateCcw size={16} />
              </button>
            </div>
          </div>

          {/* Right panel - Results */}
          <div className="lg:col-span-3 space-y-5">
            {/* MCP Request preview */}
            <div className="rounded-2xl border border-white/5 bg-[#0d1117] overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-white/[0.02]">
                <div className="flex items-center gap-2">
                  <Terminal size={13} className="text-cyan-400" />
                  <span className="text-gray-400 text-xs" style={{ fontWeight: 500 }}>MCP 请求</span>
                </div>
                <div
                  className="text-xs px-2 py-0.5 rounded-full"
                  style={{ color: selectedModel.color, background: `${selectedModel.color}15` }}
                >
                  {selectedModel.mcpTool}
                </div>
              </div>
              <div className="p-4">
                <pre className="text-xs font-mono text-gray-300 leading-relaxed overflow-x-auto">{mcpCallJson}</pre>
              </div>
            </div>

            {/* Logs */}
            {logs.length > 0 && (
              <div className="rounded-2xl border border-white/5 bg-[#0d1117] overflow-hidden">
                <div className="px-4 py-3 border-b border-white/5 bg-white/[0.02]">
                  <span className="text-gray-400 text-xs" style={{ fontWeight: 500 }}>运行日志</span>
                </div>
                <div className="p-4 space-y-1.5">
                  {logs.map((log, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${
                        log.includes("已提交") ? "bg-amber-400" : "bg-cyan-400/50"
                      }`} />
                      <span className={`text-xs font-mono ${log.includes("已提交") ? "text-amber-400" : "text-gray-500"}`}>{log}</span>
                    </div>
                  ))}
                  {isRunning && (
                    <div className="flex items-center gap-2">
                      <Loader2 size={12} className="text-cyan-400 animate-spin" />
                      <span className="text-gray-600 text-xs font-mono">处理中...</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Result */}
            {result && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl border border-white/5 bg-[#0d1117] overflow-hidden"
              >
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-white/[0.02]">
                  <div className="flex items-center gap-2">
                    <CheckCircle size={13} className="text-green-400" />
                    <span className="text-gray-400 text-xs" style={{ fontWeight: 500 }}>推理结果</span>
                  </div>
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 text-gray-500 hover:text-white text-xs transition-colors"
                  >
                    {copied ? (
                      <><CheckCircle size={12} className="text-green-400" /><span className="text-green-400">已复制</span></>
                    ) : (
                      <><Copy size={12} /><span>复制结果</span></>
                    )}
                  </button>
                </div>
                <div className="p-4 max-h-80 overflow-y-auto">
                  <pre className="text-xs font-mono text-gray-300 leading-relaxed whitespace-pre-wrap">
                    {JSON.stringify(result, null, 2)
                      .split("\n")
                      .map((line, i) => {
                        let color = "text-gray-300";
                        if (line.includes('"message"')) color = "text-amber-300";
                        else if (line.includes('"model"') || line.includes('"tool"')) color = "text-cyan-300";
                        return (
                          <span key={i} className={`block ${color}`}>{line}</span>
                        );
                      })}
                  </pre>
                </div>
              </motion.div>
            )}

            {/* Empty state */}
            {!result && !isRunning && logs.length === 0 && (
              <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.01] flex flex-col items-center justify-center py-16 text-center">
                <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
                  <ImageIcon size={20} className="text-gray-600" />
                </div>
                <p className="text-gray-500 text-sm">配置参数后点击「运行推理」</p>
                <p className="text-gray-600 text-xs mt-1">结果将在此处展示</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
