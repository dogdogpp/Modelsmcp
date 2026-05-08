import { motion } from "motion/react";
import { useState } from "react";
import {
  Copy,
  CheckCircle,
  BookOpen,
  Terminal,
  Zap,
  Package,
  Server,
  ArrowRight,
  ChevronRight,
} from "lucide-react";

const sections = [
  { id: "intro", label: "简介" },
  { id: "quickstart", label: "快速开始" },
  { id: "mcp-protocol", label: "MCP 协议" },
  { id: "tools", label: "工具列表" },
  { id: "config", label: "配置参考" },
  { id: "claude", label: "接入 Claude" },
  { id: "openclaw", label: "接入 OpenClaw" },
  { id: "openclaw-bidirectional", label: "OpenClaw 双向订阅" },
  { id: "local-deploy", label: "本地部署" },
  { id: "faq", label: "常见问题" },
];

const tools = [
  { name: "yolov8_detect", desc: "YOLOv8 目标检测", params: ["image", "confidence", "classes", "model_size"] },
  { name: "detr_detect", desc: "DETR Transformer 检测", params: ["image", "threshold", "return_masks"] },
  { name: "paddleocr_recognize", desc: "PaddleOCR 文字识别", params: ["image", "lang", "use_angle_cls", "det", "rec"] },
  { name: "sam2_segment", desc: "SAM 2 图像/视频分割", params: ["image", "prompts", "multimask_output"] },
  { name: "clip_encode", desc: "CLIP 图文编码", params: ["image", "texts", "mode"] },
  { name: "whisper_transcribe", desc: "Whisper 语音识别", params: ["audio", "language", "task", "word_timestamps"] },
  { name: "depth_estimate", desc: "Depth Anything 深度估计", params: ["image", "model_size", "output_format"] },
  { name: "dinov2_embed", desc: "DINOv2 视觉特征提取", params: ["image", "model", "return_patch_tokens"] },
  { name: "pose_estimate", desc: "YOLOv8 人体姿态估计", params: ["image", "confidence", "visualize"] },
  { name: "grounding_dino_detect", desc: "开放词汇目标检测", params: ["image", "text_prompt", "box_threshold"] },
];

function CodeBlock({ code, lang = "bash", copyKey }: { code: string; lang?: string; copyKey: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const langColors: Record<string, string> = {
    bash: "#00d4ff",
    json: "#f59e0b",
    yaml: "#a78bfa",
    python: "#00ff88",
  };

  return (
    <div className="rounded-xl border border-white/10 bg-[#0d1117] overflow-hidden my-4">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/5 bg-white/[0.02]">
        <span className="text-xs font-mono" style={{ color: langColors[lang] || "#888" }}>
          {lang}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-gray-500 hover:text-white text-xs transition-colors"
        >
          {copied ? (
            <><CheckCircle size={12} className="text-green-400" /><span className="text-green-400">已复制</span></>
          ) : (
            <><Copy size={12} /><span>复制</span></>
          )}
        </button>
      </div>
      <div className="p-4 overflow-x-auto">
        <pre className="text-xs font-mono text-gray-300 leading-relaxed">{code}</pre>
      </div>
    </div>
  );
}

export function Docs() {
  const [activeSection, setActiveSection] = useState("intro");

  const scrollTo = (id: string) => {
    setActiveSection(id);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="border-b border-white/5 py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="flex items-center gap-2 mb-2">
              <BookOpen size={16} className="text-cyan-400" />
              <span className="text-cyan-400 text-sm" style={{ fontWeight: 500 }}>文档中心</span>
            </div>
            <h1 style={{ fontSize: "2rem", fontWeight: 700, letterSpacing: "-0.02em" }}>
              DeepMCP 开发文档
            </h1>
            <p className="text-gray-400 mt-2">
              了解如何将深度学习推理能力集成到您的 MCP 工作流中
            </p>
          </motion.div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex gap-10">
          {/* Sidebar */}
          <div className="hidden lg:block w-52 shrink-0">
            <div className="sticky top-24 space-y-1">
              <div className="text-gray-600 text-xs mb-3 px-3" style={{ fontWeight: 500 }}>目录</div>
              {sections.map((s) => (
                <button
                  key={s.id}
                  onClick={() => scrollTo(s.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${
                    activeSection === s.id
                      ? "bg-cyan-500/10 text-cyan-400"
                      : "text-gray-500 hover:text-gray-300 hover:bg-white/5"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0 space-y-16">
            {/* Intro */}
            <section id="intro">
              <h2 className="text-white mb-4" style={{ fontSize: "1.5rem", fontWeight: 700 }}>简介</h2>
              <p className="text-gray-400 leading-relaxed mb-4">
                DeepMCP 是一个开源的深度学习模型 MCP 服务平台，将主流视觉、语音、多模态模型封装为标准
                Model Context Protocol (MCP) 工具，让 AI 应用可以直接调用本地推理能力。
              </p>
              <p className="text-gray-400 leading-relaxed mb-6">
                通过 DeepMCP，您可以在保护数据隐私的前提下，让 Claude、OpenClaw 等 AI 助手具备：
                目标检测、图像分割、文字识别、语音转录、深度估计等强大的视觉感知能力。
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { icon: <Zap size={16} className="text-cyan-400" />, title: "毫秒级推理", desc: "本地 GPU 推理，延迟最低 12ms" },
                  { icon: <Package size={16} className="text-purple-400" />, title: "10+ 模型", desc: "覆盖主流 CV/NLP 任务" },
                  { icon: <Server size={16} className="text-green-400" />, title: "标准 MCP", desc: "兼容所有 MCP 客户端" },
                ].map((item) => (
                  <div key={item.title} className="p-4 rounded-xl border border-white/5 bg-white/[0.02]">
                    <div className="mb-2">{item.icon}</div>
                    <div className="text-white text-sm mb-1" style={{ fontWeight: 600 }}>{item.title}</div>
                    <div className="text-gray-500 text-xs">{item.desc}</div>
                  </div>
                ))}
              </div>
            </section>

            {/* Quickstart */}
            <section id="quickstart">
              <h2 className="text-white mb-4" style={{ fontSize: "1.5rem", fontWeight: 700 }}>快速开始</h2>
              <div className="space-y-6">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 text-xs flex items-center justify-center" style={{ fontWeight: 700 }}>1</span>
                    <h3 className="text-white" style={{ fontWeight: 600 }}>安装 DeepMCP</h3>
                  </div>
                  <CodeBlock
                    copyKey="install"
                    lang="bash"
                    code={`# 安装 DeepMCP
pip install deepmcp

# 或通过 pipx 安装（推荐）
pipx install deepmcp`}
                  />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 text-xs flex items-center justify-center" style={{ fontWeight: 700 }}>2</span>
                    <h3 className="text-white" style={{ fontWeight: 600 }}>下载模型并启动服务</h3>
                  </div>
                  <CodeBlock
                    copyKey="start"
                    lang="bash"
                    code={`# 下载所有默认模型
deepmcp pull --all

# 下载单个模型
deepmcp pull yolov8 paddleocr

# 启动 MCP 服务（默认端口 8080）
deepmcp serve --gpu

# 指定 CPU 运行
deepmcp serve --device cpu`}
                  />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 text-xs flex items-center justify-center" style={{ fontWeight: 700 }}>3</span>
                    <h3 className="text-white" style={{ fontWeight: 600 }}>验证服务正常运行</h3>
                  </div>
                  <CodeBlock
                    copyKey="verify"
                    lang="bash"
                    code={`# 查看可用工具列表
curl http://localhost:8080/tools

# 测试推理
curl -X POST http://localhost:8080/call \\
  -H "Content-Type: application/json" \\
  -d '{"tool": "yolov8_detect", "arguments": {"image": "https://example.com/img.jpg"}}'`}
                  />
                </div>
              </div>
            </section>

            {/* MCP Protocol */}
            <section id="mcp-protocol">
              <h2 className="text-white mb-4" style={{ fontSize: "1.5rem", fontWeight: 700 }}>MCP 协议</h2>
              <p className="text-gray-400 leading-relaxed mb-4">
                DeepMCP 遵循 Anthropic 定义的 Model Context Protocol (MCP) 规范。
                服务暴露标准 HTTP 端点，所有工具调用使用统一的 JSON 格式。
              </p>
              <div className="mb-4">
                <h3 className="text-white mb-3" style={{ fontWeight: 600 }}>API 端点</h3>
                <div className="space-y-2">
                  {[
                    { method: "GET", path: "/tools", desc: "列出所有可用工具" },
                    { method: "POST", path: "/call", desc: "调用工具执行推理" },
                    { method: "GET", path: "/health", desc: "检查服务健康状态" },
                    { method: "GET", path: "/metrics", desc: "获取推理性能指标" },
                  ].map((ep) => (
                    <div key={ep.path} className="flex items-center gap-3 p-3 rounded-lg border border-white/5 bg-white/[0.02]">
                      <span className={`text-xs font-mono px-2 py-0.5 rounded ${
                        ep.method === "GET" ? "bg-green-500/10 text-green-400" : "bg-blue-500/10 text-blue-400"
                      }`} style={{ fontWeight: 600 }}>
                        {ep.method}
                      </span>
                      <code className="text-cyan-300 text-sm font-mono">{ep.path}</code>
                      <span className="text-gray-500 text-sm">{ep.desc}</span>
                    </div>
                  ))}
                </div>
              </div>

              <h3 className="text-white mb-3" style={{ fontWeight: 600 }}>请求格式</h3>
              <CodeBlock
                copyKey="request"
                lang="json"
                code={`POST /call HTTP/1.1
Content-Type: application/json

{
  "tool": "yolov8_detect",
  "arguments": {
    "image": "https://example.com/photo.jpg",
    "confidence": 0.5,
    "classes": ["person", "car"],
    "model_size": "m"
  }
}`}
              />

              <h3 className="text-white mb-3" style={{ fontWeight: 600 }}>响应格式</h3>
              <CodeBlock
                copyKey="response"
                lang="json"
                code={`{
  "status": "success",
  "model": "yolov8",
  "inference_time": "12ms",
  "device": "CUDA",
  "result": {
    "detections": [
      {
        "class": "person",
        "confidence": 0.94,
        "bbox": [120, 80, 280, 420],
        "class_id": 0
      }
    ],
    "total_objects": 1
  }
}`}
              />
            </section>

            {/* Tools */}
            <section id="tools">
              <h2 className="text-white mb-4" style={{ fontSize: "1.5rem", fontWeight: 700 }}>工具列表</h2>
              <div className="space-y-3">
                {tools.map((tool) => (
                  <div key={tool.name} className="p-4 rounded-xl border border-white/5 bg-white/[0.02]">
                    <div className="flex items-start justify-between mb-2">
                      <code className="text-cyan-400 text-sm font-mono" style={{ fontWeight: 600 }}>{tool.name}</code>
                      <span className="text-gray-500 text-xs">{tool.desc}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {tool.params.map((p) => (
                        <span key={p} className="px-2 py-0.5 rounded bg-white/5 text-gray-400 text-xs font-mono">
                          {p}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Config */}
            <section id="config">
              <h2 className="text-white mb-4" style={{ fontSize: "1.5rem", fontWeight: 700 }}>配置参考</h2>
              <CodeBlock
                copyKey="config"
                lang="yaml"
                code={`# deepmcp.config.yaml
server:
  host: "0.0.0.0"
  port: 8080
  workers: 4

inference:
  device: "cuda"          # cuda / cpu / mps (Apple Silicon)
  precision: "fp16"       # fp32 / fp16 / int8
  batch_size: 1
  timeout: 30s

models:
  yolov8:
    enabled: true
    variant: "yolov8m"    # n/s/m/l/x
    weights: "auto"       # auto download or local path
  paddleocr:
    enabled: true
    lang: ["ch", "en"]
  sam2:
    enabled: true
    variant: "sam2_hiera_large"
  whisper:
    enabled: true
    model: "large-v3"

security:
  cors_origins: ["*"]
  api_key: null           # Set to enable auth`}
              />
            </section>

            {/* Claude */}
            <section id="claude">
              <h2 className="text-white mb-4" style={{ fontSize: "1.5rem", fontWeight: 700 }}>接入 Claude Desktop</h2>
              <p className="text-gray-400 leading-relaxed mb-4">
                编辑 Claude Desktop 的配置文件，添加 DeepMCP 服务器：
              </p>
              <p className="text-gray-500 text-sm mb-2">
                配置文件路径：<code className="text-cyan-300 font-mono">~/Library/Application Support/Claude/claude_desktop_config.json</code>
              </p>
              <CodeBlock
                copyKey="claude"
                lang="json"
                code={`{
  "mcpServers": {
    "deepmcp": {
      "command": "deepmcp",
      "args": ["serve", "--port", "8080", "--device", "cuda"],
      "env": {
        "DEEPMCP_MODELS": "yolov8,paddleocr,sam2,whisper"
      }
    }
  }
}`}
              />
              <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 text-amber-300 text-sm">
                ⚠️ 重启 Claude Desktop 后，DeepMCP 工具将自动出现在工具列表中
              </div>
            </section>

            {/* OpenClaw */}
            <section id="openclaw">
              <h2 className="text-white mb-4" style={{ fontSize: "1.5rem", fontWeight: 700 }}>接入 OpenClaw</h2>
              <CodeBlock
                copyKey="openclaw"
                lang="yaml"
                code={`# openclaw_config.yaml
mcp_servers:
  deepmcp:
    transport: "http"
    url: "http://localhost:8080/mcp"
    tools:
      - yolov8_detect
      - paddleocr_recognize
      - sam2_segment
      - whisper_transcribe
    auth:
      type: none
    timeout: 60`}
              />
            </section>

            {/* OpenClaw 双向订阅通信（小白教程） */}
            <section id="openclaw-bidirectional">
              <h2 className="text-white mb-4" style={{ fontSize: "1.5rem", fontWeight: 700 }}>OpenClaw 双向订阅通信</h2>

              <p className="text-gray-400 leading-relaxed mb-4">
                这一节面向零基础用户，手把手教你怎么让 <strong>OpenClaw</strong>（你的 AI 助手）和 <strong>DeepMCP</strong>（你的视觉推理引擎）实现"双向聊天"。
              </p>

              <div className="p-4 rounded-xl border border-cyan-500/20 bg-cyan-500/5 mb-6">
                <p className="text-cyan-300 text-sm font-medium mb-2">打个比方</p>
                <p className="text-gray-400 text-sm leading-relaxed">
                  想象 OpenClaw 是你的"老板"，DeepMCP 是你的"视觉专家"。
                  <br/><br/>
                  <strong>单向模式</strong>：老板把照片递给专家，专家看完直接在纸上写结果递回来。一锤子买卖，中间不能打断、不能追问。
                  <br/><br/>
                  <strong>双向模式</strong>：老板和专家加了个微信群。老板可以随时@专家发新照片；专家处理到一半还能在群里发"正在数人数，60%了…"；处理完自动发结果到群里。甚至专家发现摄像头新画面有异常，也能主动@老板报警。
                  <br/><br/>
                  这就是双向订阅——两个人都能主动说话，不是只能等对方先开口。
                </p>
              </div>

              <div className="space-y-10">

                {/* 第一步 */}
                <div>
                  <h3 className="text-white mb-3 flex items-center gap-2" style={{ fontWeight: 600 }}>
                    <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 text-xs flex items-center justify-center" style={{ fontWeight: 700 }}>1</span>
                    前置准备：两个服务都要先跑起来
                  </h3>
                  <p className="text-gray-400 text-sm leading-relaxed mb-3">
                    就像微信聊天前两人都要先安装微信。你需要同时启动 OpenClaw 和 DeepMCP。
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div className="p-4 rounded-xl border border-white/5 bg-white/[0.02]">
                      <div className="text-white text-sm font-medium mb-2">启动 DeepMCP（视觉专家）</div>
                      <div className="text-gray-500 text-xs mb-2">默认监听 http://localhost:8080</div>
                      <CodeBlock copyKey="step1-deepmcp" lang="bash" code={`# 启动服务
deepmcp serve --port 8080

# 看到类似输出就说明成功了
# INFO  DeepMCP ready at http://0.0.0.0:8080
# INFO  Loaded tools: yolov8_detect, paddleocr_recognize, sam2_segment`} />
                    </div>
                    <div className="p-4 rounded-xl border border-white/5 bg-white/[0.02]">
                      <div className="text-white text-sm font-medium mb-2">启动 OpenClaw（AI 老板）</div>
                      <div className="text-gray-500 text-xs mb-2">默认监听 http://localhost:18789</div>
                      <CodeBlock copyKey="step1-openclaw" lang="bash" code={`# 启动网关
openclaw gateway

# 看到类似输出就说明成功了
# INFO  Gateway listening on ws://0.0.0.0:18789
# INFO  Control UI: http://127.0.0.1:18789`} />
                    </div>
                  </div>

                  <div className="p-3 rounded-lg border border-amber-500/20 bg-amber-500/5 text-amber-300 text-xs">
                    验证两个小窗口都开着，别关掉。记住两个地址：DeepMCP 是 <code className="text-cyan-300">8080</code> 端口，OpenClaw 是 <code className="text-cyan-300">18789</code> 端口。
                  </div>
                </div>

                {/* 第二步 */}
                <div>
                  <h3 className="text-white mb-3 flex items-center gap-2" style={{ fontWeight: 600 }}>
                    <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 text-xs flex items-center justify-center" style={{ fontWeight: 700 }}>2</span>
                    第一路：让 OpenClaw 能"指挥" DeepMCP（老板@专家）
                  </h3>
                  <p className="text-gray-400 text-sm leading-relaxed mb-3">
                    这一步是让 OpenClaw 知道："我有个叫 DeepMCP 的手下，它擅长看图说话"。
                    配置完成后，你在 OpenClaw 聊天窗口发一张图，它就能自动调用 DeepMCP 做目标检测。
                  </p>

                  <div className="mb-3">
                    <p className="text-white text-sm font-medium mb-2">打开 OpenClaw 配置文件</p>
                    <p className="text-gray-500 text-xs mb-2">文件位置：<code className="text-cyan-300">~/.openclaw/openclaw.json</code>（JSON5 格式，支持注释）</p>
                  </div>

                  <CodeBlock
                    copyKey="step2-config"
                    lang="json"
                    code={`{
  // ... 你原来的配置 ...

  plugins: {
    entries: {
      acpx: {
        enabled: true,
        config: {
          mcpServers: {
            deepmcp: {
              // DeepMCP 的 HTTP 地址
              url: "http://localhost:8080/mcp",

              // 启用哪些工具（白名单）
              tools: [
                "yolov8_detect",
                "paddleocr_recognize",
                "sam2_segment",
                "whisper_transcribe"
              ],

              // 安全设置：不需要额外认证（都在本机跑）
              auth: { type: "none" },

              // 单次调用最长等 60 秒
              timeout: 60
            }
          }
        }
      }
    }
  }
}`}
                  />

                  <div className="mb-3 mt-4">
                    <p className="text-white text-sm font-medium mb-2">保存后重启 OpenClaw</p>
                    <CodeBlock copyKey="step2-restart" lang="bash" code={`# 按 Ctrl+C 停止旧进程，再重新启动
openclaw gateway`} />
                  </div>

                  <div className="mb-3">
                    <p className="text-white text-sm font-medium mb-2">验证是否连通</p>
                    <p className="text-gray-500 text-xs mb-2">在 OpenClaw 的任意聊天窗口发消息：</p>
                    <CodeBlock copyKey="step2-test" lang="text" code={`请用 yolov8_detect 工具分析这张照片里有多少人
[附上一张照片]`} />
                  </div>

                  <div className="p-3 rounded-lg border border-green-500/20 bg-green-500/5 text-green-300 text-xs">
                    如果 OpenClaw 回复了检测结果（比如"图中有 3 个人，分别在…"），说明第一路已经通了。这就是标准的 MCP 单向调用。
                  </div>
                </div>

                {/* 第三步 */}
                <div>
                  <h3 className="text-white mb-3 flex items-center gap-2" style={{ fontWeight: 600 }}>
                    <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 text-xs flex items-center justify-center" style={{ fontWeight: 700 }}>3</span>
                    第二路：让 DeepMCP 能"汇报"给 OpenClaw（专家@老板）
                  </h3>
                  <p className="text-gray-400 text-sm leading-relaxed mb-3">
                    第一路是老板主动找专家。但如果专家处理一张超大图片要 30 秒，老板不想干等；或者专家想主动说"模型加载好了"、"推理出错了"——这就需要第二路。
                    <br/><br/>
                    原理很简单：DeepMCP 完成任务后，主动发一条 HTTP 消息到 OpenClaw 的"收件箱"（叫做 Hooks）。
                  </p>

                  <div className="mb-3">
                    <p className="text-white text-sm font-medium mb-2">先给 OpenClaw 打开收件箱</p>
                    <p className="text-gray-500 text-xs mb-2">在 <code className="text-cyan-300">~/.openclaw/openclaw.json</code> 里增加 hooks 配置：</p>
                  </div>

                  <CodeBlock
                    copyKey="step3-hooks"
                    lang="json"
                    code={`{
  // ... 你原来的配置 ...

  hooks: {
    enabled: true,

    // 收件箱的统一前缀，默认就是 /hooks
    path: "/hooks",

    // 验证口令（防止陌生人冒充 DeepMCP 给你发消息）
    token: "my-secret-token-123",

    // 把来自 DeepMCP 的消息交给 AI 处理
    mappings: [
      {
        // 匹配路径：DeepMCP 发到 /hooks/deepmcp 的消息都由这条规则处理
        match: { path: "deepmcp" },

        // 动作：交给 AI 助手处理
        action: "agent",

        // 会话名称
        sessionKey: "hook:deepmcp:results",

        // 消息模板：把 DeepMCP 推送的内容转成 AI 能看懂的格式
        messageTemplate: "DeepMCP 任务完成\\n任务ID: {{task_id}}\\n工具: {{tool}}\\n结果: {{result}}",

        // 唤醒模式：立即处理
        wakeMode: "now",

        // 是否通过聊天渠道推送结果
        deliver: true
      }
    ]
  }
}`}
                  />

                  <div className="mb-3 mt-4">
                    <p className="text-white text-sm font-medium mb-2">再给 DeepMCP 配置"发件人"</p>
                    <p className="text-gray-500 text-xs mb-2">在 <code className="text-cyan-300">deepmcp.config.yaml</code> 里增加 webhook 推送：</p>
                  </div>

                  <CodeBlock
                    copyKey="step3-webhook"
                    lang="yaml"
                    code={`webhooks:
  openclaw:
    # OpenClaw 的收件箱地址
    url: "http://localhost:18789/hooks/deepmcp"

    # 发生这些事件时自动推送
    events:
      - inference.complete    # 推理完成
      - inference.failed      # 推理失败
      - model.loaded          # 模型加载完毕

    # 安全头：口令要和 OpenClaw 配置里的一致
    headers:
      Authorization: "Bearer my-secret-token-123"

    # 如果网络抖了，最多重试 3 次
    retry: 3
    timeout: 10s`}
                  />

                  <div className="mb-3 mt-4">
                    <p className="text-white text-sm font-medium mb-2">保存配置，两边都重启</p>
                    <CodeBlock copyKey="step3-restart" lang="bash" code={`# 1. 重启 DeepMCP
deepmcp serve --config deepmcp.config.yaml

# 2. 重启 OpenClaw
openclaw gateway`} />
                  </div>
                </div>

                {/* 第四步 */}
                <div>
                  <h3 className="text-white mb-3 flex items-center gap-2" style={{ fontWeight: 600 }}>
                    <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 text-xs flex items-center justify-center" style={{ fontWeight: 700 }}>4</span>
                    实战：跑一个完整的双向流程
                  </h3>
                  <p className="text-gray-400 text-sm leading-relaxed mb-3">
                    现在两个方向都通了，我们来跑一次完整的"对话"。
                  </p>

                  <div className="space-y-3">
                    <div className="p-3 rounded-lg border border-white/5 bg-white/[0.02]">
                      <p className="text-cyan-300 text-xs font-medium mb-1">第 1 步：老板下任务</p>
                      <p className="text-gray-400 text-xs">你在 OpenClaw（WhatsApp / Telegram / 网页）发消息：</p>
                      <p className="text-gray-300 text-xs mt-1 font-mono">"请分析这张照片里有什么物体，置信度大于 0.5 的都要标出来"</p>
                    </div>

                    <div className="p-3 rounded-lg border border-white/5 bg-white/[0.02]">
                      <p className="text-cyan-300 text-xs font-medium mb-1">第 2 步：专家收到任务</p>
                      <p className="text-gray-400 text-xs">OpenClaw 自动调用 DeepMCP 的 <code className="text-cyan-300">yolov8_detect</code> 工具，把照片传过去。</p>
                    </div>

                    <div className="p-3 rounded-lg border border-white/5 bg-white/[0.02]">
                      <p className="text-cyan-300 text-xs font-medium mb-1">第 3 步：专家主动汇报</p>
                      <p className="text-gray-400 text-xs">DeepMCP 推理完成后，自动发一条 HTTP POST 到 OpenClaw 的 <code className="text-cyan-300">/hooks/deepmcp</code>：</p>
                      <CodeBlock copyKey="step4-payload" lang="json" code={`{
  "event": "inference.complete",
  "task_id": "task_001",
  "tool": "yolov8_detect",
  "result": {
    "detections": [
      { "class": "person", "confidence": 0.94, "bbox": [120, 80, 280, 420] },
      { "class": "car",    "confidence": 0.87, "bbox": [400, 200, 600, 350] }
    ]
  }
}`} />
                    </div>

                    <div className="p-3 rounded-lg border border-white/5 bg-white/[0.02]">
                      <p className="text-cyan-300 text-xs font-medium mb-1">第 4 步：老板收到汇报</p>
                      <p className="text-gray-400 text-xs">OpenClaw 收到 hook 消息后，根据 <code className="text-cyan-300">messageTemplate</code> 转成自然语言，推送到你的聊天窗口：</p>
                      <p className="text-gray-300 text-xs mt-1 font-mono">"DeepMCP 任务完成。检测到 2 个物体：1 个人（置信度 94%）、1 辆车（置信度 87%）。"</p>
                    </div>
                  </div>
                </div>

                {/* 第五步 */}
                <div>
                  <h3 className="text-white mb-3 flex items-center gap-2" style={{ fontWeight: 600 }}>
                    <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 text-xs flex items-center justify-center" style={{ fontWeight: 700 }}>5</span>
                    进阶：不用等老板开口，专家也能主动报警
                  </h3>
                  <p className="text-gray-400 text-sm leading-relaxed mb-3">
                    上面的流程还是"老板先开口"。如果你想让 DeepMCP 自己发现异常就主动通知你（比如监控摄像头里突然出现陌生人），可以加上定时任务。
                  </p>

                  <CodeBlock
                    copyKey="step5-cron"
                    lang="json"
                    code={`{
  // ... 在 openclaw.json 里增加 ...

  cron: {
    enabled: true,

    jobs: [
      {
        // 每 5 分钟执行一次
        schedule: "*/5 * * * *",

        // 调用 DeepMCP 检测工具
        action: {
          tool: "yolov8_detect",
          args: {
            image: "http://camera.local/current.jpg",
            classes: ["person"]
          }
        },

        // 如果检测到"人"，就通过 hook 推送告警
        onResult: {
          condition: "result.detections.length > 0",
          notify: true,
          message: "检测到陌生人！共 {{result.detections.length}} 人"
        }
      }
    ]
  }
}`}
                  />

                  <div className="p-3 rounded-lg border border-amber-500/20 bg-amber-500/5 text-amber-300 text-xs mt-3">
                    这只是 Cron 的一种用法思路。具体语法请参考 OpenClaw 官方 Cron 文档，核心思想是：DeepMCP 不仅能被动等调用，还能被定时触发主动干活。
                  </div>
                </div>

                {/* 常见问题 */}
                <div>
                  <h3 className="text-white mb-3 flex items-center gap-2" style={{ fontWeight: 600 }}>
                    <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 text-xs flex items-center justify-center" style={{ fontWeight: 700 }}>6</span>
                    常见问题排查
                  </h3>
                  <div className="space-y-3">
                    <div className="p-3 rounded-lg border border-white/5 bg-white/[0.02]">
                      <p className="text-white text-xs font-medium">Q: OpenClaw 说"找不到工具"？</p>
                      <p className="text-gray-400 text-xs mt-1">A: 检查 <code className="text-cyan-300">mcpServers.deepmcp.url</code> 是否写对，DeepMCP 是否正在运行，以及 <code className="text-cyan-300">tools</code> 白名单里是否列出了你想用的工具名。</p>
                    </div>
                    <div className="p-3 rounded-lg border border-white/5 bg-white/[0.02]">
                      <p className="text-white text-xs font-medium">Q: DeepMCP 推送了，但 OpenClaw 没反应？</p>
                      <p className="text-gray-400 text-xs mt-1">A: 检查两边的 token 是否一致；检查 OpenClaw 的 <code className="text-cyan-300">hooks.enabled</code> 是否为 <code className="text-cyan-300">true</code>；检查 <code className="text-cyan-300">match.path</code> 和 DeepMCP 推送的 URL 路径是否匹配（比如 <code className="text-cyan-300">/hooks/deepmcp</code>）。</p>
                    </div>
                    <div className="p-3 rounded-lg border border-white/5 bg-white/[0.02]">
                      <p className="text-white text-xs font-medium">Q: 能不能让 OpenClaw 推送消息到 Telegram / 微信？</p>
                      <p className="text-gray-400 text-xs mt-1">A: 可以。在 hooks mapping 里加 <code className="text-cyan-300">channel: "telegram"</code> 和 <code className="text-cyan-300">to: "你的用户ID"</code>，OpenClaw 就会把结果推送到指定渠道。</p>
                    </div>
                    <div className="p-3 rounded-lg border border-white/5 bg-white/[0.02]">
                      <p className="text-white text-xs font-medium">Q: 两边不在同一台机器上怎么办？</p>
                      <p className="text-gray-400 text-xs mt-1">A: 把配置里的 <code className="text-cyan-300">localhost</code> 改成实际 IP 或域名，并确保防火墙开放了对应端口。生产环境建议用 Tailscale 或内网穿透，不要直接把端口暴露在公网。</p>
                    </div>
                  </div>
                </div>

              </div>
            </section>

            {/* Local Deploy */}
            <section id="local-deploy">
              <h2 className="text-white mb-4" style={{ fontSize: "1.5rem", fontWeight: 700 }}>本地部署</h2>
              <div className="space-y-4">
                <div>
                  <h3 className="text-white mb-2" style={{ fontWeight: 600 }}>Docker 部署（推荐）</h3>
                  <CodeBlock
                    copyKey="docker"
                    lang="bash"
                    code={`# GPU 版本
docker run -d \\
  --gpus all \\
  -p 8080:8080 \\
  -v ~/.deepmcp/models:/models \\
  deepmcp/deepmcp:latest

# CPU 版本
docker run -d \\
  -p 8080:8080 \\
  -v ~/.deepmcp/models:/models \\
  deepmcp/deepmcp:cpu`}
                  />
                </div>
                <div>
                  <h3 className="text-white mb-2" style={{ fontWeight: 600 }}>Docker Compose</h3>
                  <CodeBlock
                    copyKey="compose"
                    lang="yaml"
                    code={`version: "3.8"
services:
  deepmcp:
    image: deepmcp/deepmcp:latest
    ports:
      - "8080:8080"
    volumes:
      - ./models:/models
      - ./deepmcp.config.yaml:/config.yaml
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]`}
                  />
                </div>
              </div>
            </section>

            {/* FAQ */}
            <section id="faq">
              <h2 className="text-white mb-4" style={{ fontSize: "1.5rem", fontWeight: 700 }}>常见问题</h2>
              <div className="space-y-4">
                {[
                  {
                    q: "支持哪些硬件加速？",
                    a: "支持 NVIDIA GPU (CUDA)、Apple Silicon (Metal/CoreML)、AMD GPU (ROCm) 以及纯 CPU 推理。",
                  },
                  {
                    q: "模型文件存储在哪里？",
                    a: "默认存储在 ~/.deepmcp/models/ 目录，可通过 --models-dir 参数或配置文件修改路径。",
                  },
                  {
                    q: "如何添加自定义模型？",
                    a: "实现 DeepMCP 提供的 BaseModel 接口，注册到模型注册表即可。详见扩展开发文档。",
                  },
                  {
                    q: "推理数据会上传到云端吗？",
                    a: "不会。DeepMCP 完全在本地运行，所有推理在本机完成，数据不会离开您的设备。",
                  },
                  {
                    q: "如何在生产环境中使用？",
                    a: "建议使用 Docker 部署，配置 API Key 认证，并将 CORS origins 设置为具体的域名而非通配符。",
                  },
                ].map((faq) => (
                  <div key={faq.q} className="p-5 rounded-xl border border-white/5 bg-white/[0.02]">
                    <div className="flex items-start gap-3">
                      <span className="text-cyan-400 text-sm shrink-0 mt-0.5" style={{ fontWeight: 700 }}>Q</span>
                      <div>
                        <p className="text-white text-sm mb-2" style={{ fontWeight: 500 }}>{faq.q}</p>
                        <p className="text-gray-400 text-sm leading-relaxed">{faq.a}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
