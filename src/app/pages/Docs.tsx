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
  { name: "yolo26_detect", desc: "YOLO2026 目标检测", params: ["image", "confidence", "classes", "model_size"] },
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
deepmcp pull yolo26 paddleocr

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

# 测试推理（需携带 API Key）
curl -X POST http://localhost:8080/call \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: your-api-key-here" \\
  -d '{"tool": "yolo26_detect", "arguments": {"image": "https://example.com/img.jpg"}}'`}
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
  "tool": "yolo26_detect",
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
  "model": "yolo26",
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
  yolo26:
    enabled: true
    variant: "yolo26n"    # n/s/m/l/x
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
  cors_origins:
    - "http://localhost:5173"
    - "http://localhost:3000"
    - "https://deepmcp.example.com"
  api_key: "your-secure-api-key-here"`}
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
        "DEEPMCP_MODELS": "yolo26,paddleocr,sam2,whisper"
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
      - yolo26_detect
      - paddleocr_recognize
      - sam2_segment
      - whisper_transcribe
    auth:
      type: none
    timeout: 60`}
              />
            </section>

            {/* OpenClaw Bidirectional Pub/Sub */}
            <section id="openclaw-bidirectional">
              <h2 className="text-white mb-4" style={{ fontSize: "1.5rem", fontWeight: 700 }}>OpenClaw 双向订阅通信</h2>
              <p className="text-gray-400 leading-relaxed mb-4">
                标准的 MCP 调用是单向请求-响应模式：OpenClaw 请求 → DeepMCP 推理 → 返回结果。
                在异步任务、流式推理、事件通知等场景下，需要建立<strong>双向订阅通道</strong>，让 DeepMCP 也能主动向 OpenClaw 推送消息。
              </p>

              <div className="p-4 rounded-xl border border-cyan-500/20 bg-cyan-500/5 mb-6">
                <div className="flex items-start gap-3">
                  <Server size={18} className="text-cyan-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-cyan-300 text-sm font-medium mb-1">通信架构概览</p>
                    <p className="text-gray-400 text-sm leading-relaxed">
                      双向订阅 = OpenClaw → DeepMCP（命令/调用）+ DeepMCP → OpenClaw（事件/通知）。
                      两条通道可独立工作，也可组合成闭环：OpenClaw 下发任务，DeepMCP 异步完成后主动回传结果。
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-8">
                {/* Pattern 1: Webhook */}
                <div>
                  <h3 className="text-white mb-3 flex items-center gap-2" style={{ fontWeight: 600 }}>
                    <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 text-xs flex items-center justify-center" style={{ fontWeight: 700 }}>1</span>
                    Webhook 回调模式（最简单）
                  </h3>
                  <p className="text-gray-400 text-sm leading-relaxed mb-3">
                    DeepMCP 在推理完成或状态变更时，通过 HTTP POST 向 OpenClaw 的 webhook 端点推送事件。
                    适用于：异步任务完成通知、批量推理结果回传、异常告警。
                  </p>
                  <CodeBlock
                    copyKey="webhook-yaml"
                    lang="yaml"
                    code={`# deepmcp.config.yaml — 启用 webhook 推送
webhooks:
  openclaw:
    url: "http://localhost:3000/hooks/agent"
    events:
      - inference.complete
      - inference.failed
      - model.loaded
    headers:
      Authorization: "Bearer ${OPENCLAW_WEBHOOK_TOKEN}"
    retry: 3
    timeout: 10s`}
                  />
                  <CodeBlock
                    copyKey="webhook-payload"
                    lang="json"
                    code={`// DeepMCP → OpenClaw 推送示例
{
  "event": "inference.complete",
  "timestamp": "2026-05-07T12:34:56Z",
  "task_id": "task_abc123",
  "tool": "yolov8_detect",
  "result": {
    "detections": [{"class": "person", "confidence": 0.94, "bbox": [120, 80, 280, 420]}],
    "inference_time_ms": 12,
    "device": "cuda"
  }
}`}
                  />
                </div>

                {/* Pattern 2: WebSocket */}
                <div>
                  <h3 className="text-white mb-3 flex items-center gap-2" style={{ fontWeight: 600 }}>
                    <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 text-xs flex items-center justify-center" style={{ fontWeight: 700 }}>2</span>
                    WebSocket 全双工模式（实时性最强）
                  </h3>
                  <p className="text-gray-400 text-sm leading-relaxed mb-3">
                    建立持久化 WebSocket 连接，双方均可随时发送消息。
                    适用于：实时视频流推理、交互式分割、语音对话场景。
                  </p>
                  <CodeBlock
                    copyKey="websocket-server"
                    lang="python"
                    code={`# DeepMCP WebSocket 服务端片段 (FastAPI)
from fastapi import FastAPI, WebSocket
import json

app = FastAPI()

@app.websocket("/ws/openclaw")
async def openclaw_ws(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            msg = await websocket.receive_json()
            # msg: { "action": "infer", "tool": "yolov8_detect", "args": {...} }
            result = await run_inference(msg["tool"], msg["args"])
            await websocket.send_json({
                "type": "result",
                "task_id": msg.get("task_id"),
                "data": result
            })
    except Exception as e:
        await websocket.send_json({"type": "error", "message": str(e)})
    finally:
        await websocket.close()`}
                  />
                  <CodeBlock
                    copyKey="websocket-client"
                    lang="python"
                    code={`# OpenClaw 侧 WebSocket 客户端片段
import asyncio
import websockets
import json

async def deepmcp_bridge():
    uri = "ws://localhost:8080/ws/openclaw"
    async with websockets.connect(uri) as ws:
        # 发送推理请求
        await ws.send(json.dumps({
            "task_id": "task_001",
            "tool": "sam2_segment",
            "args": {"image": "frame_42.jpg", "prompts": [{"x": 320, "y": 240}]}
        }))
        # 实时接收结果/进度
        async for message in ws:
            data = json.loads(message)
            if data["type"] == "progress":
                print(f"进度: {data['percent']}%")
            elif data["type"] == "result":
                print(f"结果: {data['data']}")`}
                  />
                </div>

                {/* Pattern 3: SSE */}
                <div>
                  <h3 className="text-white mb-3 flex items-center gap-2" style={{ fontWeight: 600 }}>
                    <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 text-xs flex items-center justify-center" style={{ fontWeight: 700 }}>3</span>
                    SSE 流式推送模式（轻量单向流）
                  </h3>
                  <p className="text-gray-400 text-sm leading-relaxed mb-3">
                    Server-Sent Events 基于 HTTP，自动重连，浏览器原生支持。
                    适用于：逐 token 返回 OCR 结果、视频推理进度条、长耗时任务状态流。
                  </p>
                  <CodeBlock
                    copyKey="sse-server"
                    lang="python"
                    code={`# DeepMCP SSE 端点
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
import asyncio

app = FastAPI()

async def inference_stream(tool: str, args: dict):
    """逐步 yield 推理进度与最终结果"""
    yield f"data: {{\\"type\\": \\"start\\", \\"tool\\": \\"{tool}\\"}}\\n\\n"
    for percent in range(0, 101, 10):
        await asyncio.sleep(0.1)
        yield f"data: {{\\"type\\": \\"progress\\", \\"percent\\": {percent}}}\\n\\n"
    result = await run_inference(tool, args)
    yield f"data: {{\\"type\\": \\"complete\\", \\"result\\": {json.dumps(result)}}}\\n\\n"

@app.get("/stream/infer")
def stream_infer(tool: str, image: str):
    return StreamingResponse(
        inference_stream(tool, {"image": image}),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}
    )`}
                  />
                  <CodeBlock
                    copyKey="sse-client"
                    lang="javascript"
                    code={`// OpenClaw / 浏览器端订阅
const es = new EventSource("http://localhost:8080/stream/infer?tool=whisper_transcribe&audio=call.wav");

es.onmessage = (e) => {
  const data = JSON.parse(e.data);
  if (data.type === "progress") updateProgressBar(data.percent);
  if (data.type === "complete") { handleResult(data.result); es.close(); }
};

es.onerror = () => console.error("SSE 连接中断，浏览器会自动重连");`}
                  />
                </div>

                {/* Pattern 4: Message Broker */}
                <div>
                  <h3 className="text-white mb-3 flex items-center gap-2" style={{ fontWeight: 600 }}>
                    <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 text-xs flex items-center justify-center" style={{ fontWeight: 700 }}>4</span>
                    消息代理解耦模式（生产级）
                  </h3>
                  <p className="text-gray-400 text-sm leading-relaxed mb-3">
                    引入 Redis/RabbitMQ 作为中间层，DeepMCP 与 OpenClaw 互不直接依赖，天然支持削峰、重试、多实例消费。
                    适用于：高并发推理队列、多 OpenClaw 实例共享 DeepMCP 集群、任务持久化。
                  </p>
                  <CodeBlock
                    copyKey="broker-redis"
                    lang="yaml"
                    code={`# deepmcp.config.yaml — Redis Pub/Sub 配置
broker:
  type: redis
  url: redis://localhost:6379/0
  channels:
    requests: "deepmcp:requests"      # OpenClaw 发布 → DeepMCP 订阅
    responses: "deepmcp:responses"    # DeepMCP 发布 → OpenClaw 订阅
    events: "deepmcp:events"          # 广播事件（模型加载、异常等）`}
                  />
                  <CodeBlock
                    copyKey="broker-pubsub"
                    lang="python"
                    code={`# DeepMCP Redis 双向订阅示例
import redis
import json
import asyncio

r = redis.Redis.from_url("redis://localhost:6379/0")
ps = r.pubsub()
ps.subscribe("deepmcp:requests")

async def handle_requests():
    for message in ps.listen():
        if message["type"] != "message":
            continue
        task = json.loads(message["data"])
        # 执行推理
        result = await run_inference(task["tool"], task["args"])
        # 将结果发布到响应频道
        r.publish("deepmcp:responses", json.dumps({
            "task_id": task["task_id"],
            "result": result
        }))`}
                  />
                  <CodeBlock
                    copyKey="broker-openclaw"
                    lang="python"
                    code={`# OpenClaw 侧 Redis 消费者示例
import redis
import json

r = redis.Redis.from_url("redis://localhost:6379/0")
ps = r.pubsub()
ps.subscribe("deepmcp:responses", "deepmcp:events")

for message in ps.listen():
    if message["type"] != "message":
        continue
    data = json.loads(message["data"])
    channel = message["channel"].decode()
    if channel == "deepmcp:responses":
        print(f"任务 {data['task_id']} 完成: {data['result']}")
    elif channel == "deepmcp:events":
        print(f"事件: {data['event']} — {data.get('detail', '')}")`}
                  />
                </div>
              </div>

              <div className="mt-8 p-4 rounded-xl border border-amber-500/20 bg-amber-500/5">
                <p className="text-amber-300 text-sm font-medium mb-2">选型建议</p>
                <ul className="text-gray-400 text-sm space-y-1 list-disc list-inside">
                  <li><strong>快速验证</strong>：先用 Webhook，10 分钟搭通闭环。</li>
                  <li><strong>实时交互</strong>：WebSocket，延迟最低，支持双向任意时刻发消息。</li>
                  <li><strong>浏览器/轻量场景</strong>：SSE，无需额外库，自动断线重连。</li>
                  <li><strong>生产部署</strong>：Redis/RabbitMQ 消息代理，解耦、削峰、可横向扩展。</li>
                </ul>
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
