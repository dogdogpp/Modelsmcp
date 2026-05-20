import { NavLink } from "react-router";
import { motion } from "motion/react";
import {
  Zap,
  Shield,
  Globe,
  ArrowRight,
  Terminal,
  Copy,
  CheckCircle,
  Cpu,
  Network,
  Code2,
  ChevronRight,
} from "lucide-react";
import { models } from "../data/models";
import { useState } from "react";

const heroImage = "https://images.unsplash.com/photo-1753693765800-afdf24bfefaa?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxuZXVyYWwlMjBuZXR3b3JrJTIwQUklMjB2aXN1YWxpemF0aW9uJTIwZGFya3xlbnwxfHx8fDE3NzQ3NzEwNTh8MA&ixlib=rb-4.1.0&q=80&w=1080";

const codeSnippet = `# 使用 Claude / OpenClaw 调用 YOLO 检测
{
  "tool": "yolo2026_detect",
  "arguments": {
    "image": "https://example.com/photo.jpg",
    "confidence": 0.5,
    "classes": ["person", "car"]
  }
}

# 返回结果
{
  "detections": [
    {
      "class": "person",
      "confidence": 0.94,
      "bbox": [120, 80, 280, 420]
    }
  ],
  "inference_time": "12ms"
}`;

const features = [
  {
    icon: <Zap size={20} className="text-cyan-400" />,
    title: "毫秒级推理",
    description: "本地 GPU/CPU 推理，无需网络延迟，目标检测低至 12ms",
  },
  {
    icon: <Shield size={20} className="text-purple-400" />,
    title: "数据安全",
    description: "完全本地运行，图像与音频数据不离开设备，保护隐私安全",
  },
  {
    icon: <Globe size={20} className="text-green-400" />,
    title: "标准 MCP 协议",
    description: "兼容 Claude、OpenClaw 等所有支持 MCP 的应用",
  },
  {
    icon: <Cpu size={20} className="text-amber-400" />,
    title: "多后端支持",
    description: "支持 CUDA、Metal、ROCm、CPU 等多种推理后端",
  },
  {
    icon: <Network size={20} className="text-pink-400" />,
    title: "模型可扩展",
    description: "注册新模型后前端自动感知，动态展示模型能力与状态",
  },
  {
    icon: <Code2 size={20} className="text-blue-400" />,
    title: "一键集成",
    description: "三行配置即可完成 MCP 服务接入，开箱即用",
  },
];

const stats = [
  { value: `${models.length}+`, label: "内置模型" },
  { value: "12ms", label: "最低延迟" },
  { value: "80+", label: "支持语言" },
  { value: "100%", label: "本地推理" },
];

export function Home() {
  const [copied, setCopied] = useState(false);
  const featuredModels = models.slice(0, 6);

  const handleCopy = () => {
    navigator.clipboard.writeText(codeSnippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="overflow-hidden">
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center">
        {/* Background */}
        <div className="absolute inset-0">
          <img
            src={heroImage}
            alt="AI Background"
            className="w-full h-full object-cover opacity-5"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#080b14] via-[#080b14]/80 to-[#080b14]" />
          {/* Grid */}
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: `linear-gradient(rgba(0,212,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,255,1) 1px, transparent 1px)`,
              backgroundSize: "60px 60px",
            }}
          />
          {/* Glow orbs */}
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7 }}
            >
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-cyan-500/20 bg-cyan-500/5 mb-6">
                <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                <span className="text-cyan-400 text-xs" style={{ fontWeight: 500 }}>基于 MCP 协议 · 完全开源</span>
              </div>

              <h1 className="mb-6" style={{ fontSize: "clamp(2.2rem, 5vw, 3.5rem)", fontWeight: 800, lineHeight: 1.1, letterSpacing: "-0.03em" }}>
                本地深度模型
                <br />
                <span className="bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-500 bg-clip-text text-transparent">
                  MCP 推理平台
                </span>
              </h1>

              <p className="text-gray-400 text-lg leading-relaxed mb-8 max-w-lg">
                将 YOLO2026、Whisper 等深度学习模型封装为标准 MCP 工具，
                让 Claude、OpenClaw 等 AI 应用直接调用本地推理能力。
                新模型注册后前端自动感知并展示。
              </p>

              <div className="flex flex-wrap gap-4">
                <NavLink
                  to="/playground"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl hover:opacity-90 transition-opacity"
                  style={{ fontWeight: 600 }}
                >
                  <Terminal size={18} />
                  立即体验
                  <ArrowRight size={16} />
                </NavLink>
                <NavLink
                  to="/models"
                  className="inline-flex items-center gap-2 px-6 py-3 border border-white/10 text-white rounded-xl hover:bg-white/5 transition-colors"
                  style={{ fontWeight: 500 }}
                >
                  浏览模型
                  <ChevronRight size={16} />
                </NavLink>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-4 gap-4 mt-12 pt-8 border-t border-white/5">
                {stats.map((stat) => (
                  <div key={stat.label}>
                    <div className="text-cyan-400" style={{ fontSize: "1.5rem", fontWeight: 700 }}>{stat.value}</div>
                    <div className="text-gray-500 text-xs mt-0.5">{stat.label}</div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Code preview */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.7, delay: 0.2 }}
              className="relative"
            >
              <div className="relative rounded-2xl border border-white/10 bg-[#0d1117] overflow-hidden">
                {/* Terminal header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-[#0a0e18]">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500/60" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
                    <div className="w-3 h-3 rounded-full bg-green-500/60" />
                    <span className="text-gray-500 text-xs ml-2">MCP 调用示例</span>
                  </div>
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 text-gray-500 hover:text-white transition-colors text-xs"
                  >
                    {copied ? (
                      <><CheckCircle size={13} className="text-green-400" /><span className="text-green-400">已复制</span></>
                    ) : (
                      <><Copy size={13} /><span>复制</span></>
                    )}
                  </button>
                </div>
                {/* Code content */}
                <div className="p-5 overflow-x-auto">
                  <pre className="text-xs leading-relaxed font-mono">
                    {codeSnippet.split("\n").map((line, i) => {
                      let color = "text-gray-400";
                      if (line.startsWith("#")) color = "text-green-400/70";
                      else if (line.includes('"tool"') || line.includes('"arguments"')) color = "text-cyan-300";
                      else if (line.includes('"image"') || line.includes('"confidence"') || line.includes('"classes"')) color = "text-purple-300";
                      else if (line.includes('"detections"') || line.includes('"class"') || line.includes('"confidence"') || line.includes('"bbox"') || line.includes('"inference_time"')) color = "text-blue-300";
                      else if (line.includes("yolo2026_detect") || line.includes("person") || line.includes("car") || line.includes("0.") || line.includes("12ms")) color = "text-amber-300";
                      return (
                        <div key={i} className={`${color}`}>{line || " "}</div>
                      );
                    })}
                  </pre>
                </div>
                {/* Glow */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 blur-2xl pointer-events-none" />
              </div>

              {/* Floating badges */}
              <div className="absolute -top-4 -right-4 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-xs" style={{ fontWeight: 500 }}>
                ✓ 本地推理
              </div>
              <div className="absolute -bottom-4 -left-4 px-3 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs" style={{ fontWeight: 500 }}>
                ⚡ 12ms 延迟
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 bg-white/5 mb-4">
              <span className="text-gray-400 text-xs">平台特性</span>
            </div>
            <h2 style={{ fontSize: "2rem", fontWeight: 700, letterSpacing: "-0.02em" }}>
              为本地 AI 推理而生
            </h2>
            <p className="text-gray-400 mt-3 max-w-lg mx-auto">
              将工业级深度学习模型打包为开箱即用的 MCP 工具，无缝集成到您的 AI 工作流
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="relative p-6 rounded-2xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/10 transition-all group"
              >
                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  {feature.icon}
                </div>
                <h3 className="text-white mb-2" style={{ fontWeight: 600 }}>{feature.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Models */}
      <section className="py-24 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/[0.01] to-transparent pointer-events-none" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between mb-12">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 bg-white/5 mb-4">
                <span className="text-gray-400 text-xs">模型市场</span>
              </div>
              <h2 style={{ fontSize: "2rem", fontWeight: 700, letterSpacing: "-0.02em" }}>
                热门推理模型
              </h2>
            </div>
            <NavLink
              to="/models"
              className="hidden sm:flex items-center gap-1.5 text-cyan-400 hover:text-cyan-300 text-sm transition-colors"
              style={{ fontWeight: 500 }}
            >
              查看全部 <ArrowRight size={14} />
            </NavLink>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {featuredModels.map((model, i) => (
              <motion.div
                key={model.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
              >
                <NavLink
                  to={`/models/${model.id}`}
                  className="block p-5 rounded-2xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/10 transition-all group"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                        style={{ background: `${model.color}15`, border: `1px solid ${model.color}30` }}
                      >
                        {model.icon}
                      </div>
                      <div>
                        <div className="text-white" style={{ fontWeight: 600 }}>{model.name}</div>
                        <div className="text-gray-500 text-xs">{model.category}</div>
                      </div>
                    </div>
                    <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs ${
                      model.status === "online"
                        ? "bg-green-500/10 text-green-400"
                        : model.status === "loading"
                        ? "bg-amber-500/10 text-amber-400"
                        : "bg-red-500/10 text-red-400"
                    }`}>
                      <div className={`w-1.5 h-1.5 rounded-full ${
                        model.status === "online"
                          ? "bg-green-400 animate-pulse"
                          : model.status === "loading"
                          ? "bg-amber-400"
                          : "bg-red-400"
                      }`} />
                      {model.status === "online" ? "在线" : model.status === "loading" ? "加载中" : "离线"}
                    </div>
                  </div>
                  <p className="text-gray-400 text-sm leading-relaxed mb-4">{model.description}</p>
                  <div className="flex items-center justify-between">
                    <div className="flex gap-2">
                      <span className="px-2 py-0.5 rounded bg-white/5 text-gray-500 text-xs">{model.latency}</span>
                      <span className="px-2 py-0.5 rounded bg-white/5 text-gray-500 text-xs">{model.params}</span>
                    </div>
                    <div
                      className="text-xs px-2 py-0.5 rounded-full"
                      style={{ color: model.color, background: `${model.color}15` }}
                    >
                      {model.mcpTool}
                    </div>
                  </div>
                </NavLink>
              </motion.div>
            ))}
          </div>

          <div className="mt-8 text-center sm:hidden">
            <NavLink
              to="/models"
              className="inline-flex items-center gap-1.5 text-cyan-400 text-sm"
              style={{ fontWeight: 500 }}
            >
              查看全部模型 <ArrowRight size={14} />
            </NavLink>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 bg-white/5 mb-4">
              <span className="text-gray-400 text-xs">工作原理</span>
            </div>
            <h2 style={{ fontSize: "2rem", fontWeight: 700, letterSpacing: "-0.02em" }}>
              三步接入 MCP 推理服务
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            {/* Connecting line */}
            <div className="hidden md:block absolute top-8 left-1/3 right-1/3 h-px bg-gradient-to-r from-cyan-500/30 via-purple-500/30 to-cyan-500/30" />

            {[
              {
                step: "01",
                title: "安装服务",
                description: "通过 pip 安装 DeepMCP 服务端，自动下载所需模型权重文件",
                code: "pip install deepmcp\ndeep run --gpu",
                color: "#00d4ff",
              },
              {
                step: "02",
                title: "配置 MCP",
                description: "在 Claude / OpenClaw 配置文件中添加 DeepMCP 服务地址",
                code: `"deepmcp": {\n  "url": "http://localhost:8080"\n}`,
                color: "#7c3aed",
              },
              {
                step: "03",
                title: "开始调用",
                description: "AI 应用即可通过自然语言触发模型推理，获取结构化结果",
                code: `"分析这张图片中\n 的所有目标"`,
                color: "#00ff88",
              },
            ].map((step, i) => (
              <motion.div
                key={step.step}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
                className="relative"
              >
                <div className="p-6 rounded-2xl border border-white/5 bg-white/[0.02]">
                  <div
                    className="inline-flex items-center justify-center w-8 h-8 rounded-lg mb-4 text-sm"
                    style={{ background: `${step.color}15`, color: step.color, fontWeight: 700 }}
                  >
                    {step.step}
                  </div>
                  <h3 className="text-white mb-2" style={{ fontWeight: 600, fontSize: "1.05rem" }}>{step.title}</h3>
                  <p className="text-gray-500 text-sm mb-4 leading-relaxed">{step.description}</p>
                  <div className="rounded-lg bg-[#0d1117] border border-white/5 p-3">
                    <pre className="text-xs font-mono" style={{ color: step.color }}>
                      {step.code}
                    </pre>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="relative p-12 rounded-3xl border border-white/10 bg-gradient-to-br from-cyan-500/5 via-purple-500/5 to-blue-500/5 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/0 via-cyan-500/3 to-cyan-500/0 pointer-events-none" />
            <h2 className="mb-4" style={{ fontSize: "2.2rem", fontWeight: 700, letterSpacing: "-0.02em" }}>
              开始构建你的本地 AI 工作流
            </h2>
            <p className="text-gray-400 mb-8 max-w-lg mx-auto leading-relaxed">
              立即在 Playground 中测试模型效果，或查阅文档了解如何将 DeepMCP 接入你的应用
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <NavLink
                to="/playground"
                className="inline-flex items-center gap-2 px-8 py-3.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl hover:opacity-90 transition-opacity"
                style={{ fontWeight: 600 }}
              >
                <Terminal size={18} />
                在线 Playground
              </NavLink>
              <NavLink
                to="/docs"
                className="inline-flex items-center gap-2 px-8 py-3.5 border border-white/10 text-white rounded-xl hover:bg-white/5 transition-colors"
                style={{ fontWeight: 500 }}
              >
                查阅文档
                <ArrowRight size={16} />
              </NavLink>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
