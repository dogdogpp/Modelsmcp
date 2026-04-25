import { motion } from "motion/react";
import { useState, useRef, useEffect } from "react";
import {
  Play,
  Upload,
  Copy,
  CheckCircle,
  RotateCcw,
  ChevronDown,
  ImageIcon,
  Mic,
  Type,
  Loader2,
  Terminal,
  Sparkles,
  Camera,
  Brain,
  AlertCircle,
} from "lucide-react";
import { models } from "../data/models";
import { CameraPanel } from "../components/CameraPanel";

const cvImage = "https://images.unsplash.com/photo-1554936970-ce06538caf54?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjb21wdXRlciUyMHZpc2lvbiUyMG9iamVjdCUyMGRldGVjdGlvbiUyMHRlY2hub2xvZ3l8ZW58MXx8fHwxNzc0NzcxMDU4fDA&ixlib=rb-4.1.0&q=80&w=1080";

// Mock inference results per model
const mockResults: Record<string, object> = {
  yolov8: {
    model: "yolov8",
    inference_time: "12ms",
    device: "CUDA (RTX 4090)",
    detections: [
      { class: "person", confidence: 0.94, bbox: [120, 80, 280, 420], class_id: 0 },
      { class: "car", confidence: 0.87, bbox: [350, 150, 680, 380], class_id: 2 },
      { class: "bicycle", confidence: 0.73, bbox: [20, 200, 110, 400], class_id: 1 },
    ],
    total_objects: 3,
  },
  detr: {
    model: "detr",
    inference_time: "38ms",
    device: "CUDA (RTX 4090)",
    detections: [
      { label: "person", score: 0.99, box: { xmin: 119, ymin: 78, xmax: 281, ymax: 422 } },
      { label: "car", score: 0.96, box: { xmin: 348, ymin: 148, xmax: 682, ymax: 381 } },
    ],
    total_objects: 2,
  },
  paddleocr: {
    model: "paddleocr",
    inference_time: "45ms",
    device: "CPU",
    texts: [
      { text: "DeepMCP Platform", confidence: 0.98, bbox: [[10, 10], [320, 10], [320, 45], [10, 45]] },
      { text: "AI Model Inference Hub", confidence: 0.96, bbox: [[10, 60], [480, 60], [480, 95], [10, 95]] },
      { text: "Powered by MCP Protocol", confidence: 0.94, bbox: [[10, 110], [420, 110], [420, 145], [10, 145]] },
    ],
    language: "en",
  },
  sam2: {
    model: "sam2",
    inference_time: "23ms",
    device: "CUDA (RTX 4090)",
    masks: [
      { id: 0, area: 45231, stability_score: 0.97, bbox: [120, 80, 160, 340] },
      { id: 1, area: 89432, stability_score: 0.95, bbox: [350, 150, 330, 230] },
    ],
    iou_predictions: [0.97, 0.95],
  },
  clip: {
    model: "clip",
    inference_time: "18ms",
    device: "CUDA (RTX 4090)",
    results: [
      { text: "a person walking", similarity: 0.89 },
      { text: "outdoor street scene", similarity: 0.82 },
      { text: "urban environment", similarity: 0.78 },
      { text: "a cat", similarity: 0.12 },
    ],
  },
  whisper: {
    model: "whisper",
    inference_time: "320ms",
    language: "zh",
    segments: [
      { start: 0.0, end: 3.2, text: "欢迎使用 DeepMCP 语音识别服务" },
      { start: 3.2, end: 6.8, text: "支持本地推理，保护数据隐私" },
    ],
    text: "欢迎使用 DeepMCP 语音识别服务 支持本地推理，保护数据隐私",
  },
  "depth-anything": {
    model: "depth-anything",
    inference_time: "35ms",
    device: "CUDA (RTX 4090)",
    depth_map: "base64://[depth_map_data]",
    min_depth: 0.42,
    max_depth: 18.7,
    format: "colormap",
  },
  dinov2: {
    model: "dinov2",
    inference_time: "28ms",
    device: "CUDA (RTX 4090)",
    embedding: "[1024-dim vector]",
    embedding_norm: 1.0,
    patch_tokens: "196 x 1024",
  },
  "yolov8-pose": {
    model: "yolov8-pose",
    inference_time: "15ms",
    device: "CUDA (RTX 4090)",
    persons: [
      {
        confidence: 0.94,
        bbox: [120, 80, 280, 420],
        keypoints: {
          nose: [198, 95, 0.98],
          left_shoulder: [160, 145, 0.96],
          right_shoulder: [238, 143, 0.97],
          left_elbow: [143, 215, 0.92],
          right_elbow: [258, 212, 0.93],
          left_wrist: [135, 282, 0.89],
          right_wrist: [267, 279, 0.88],
        },
      },
    ],
  },
  "grounding-dino": {
    model: "grounding-dino",
    inference_time: "55ms",
    device: "CUDA (RTX 4090)",
    prompt: "person . car . bicycle",
    detections: [
      { phrase: "person", logit: 0.78, box: [0.23, 0.18, 0.54, 0.89] },
      { phrase: "car", logit: 0.82, box: [0.67, 0.34, 0.97, 0.81] },
    ],
  },
};

const sampleImages = [
  { label: "街景", url: "https://images.unsplash.com/photo-1554936970-ce06538caf54?w=400" },
  { label: "办公室", url: cvImage },
];

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";
const DEFAULT_API_KEY = import.meta.env.VITE_DEEPMCP_API_KEY || "";

const sampleAudio = "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3";

function getPrimaryInputType(inputTypes: string[]): "image" | "audio" | "text" | "mixed" {
  const hasImage = inputTypes.some((t) => t.startsWith("image/") || t.startsWith("video/"));
  const hasAudio = inputTypes.some((t) => t.startsWith("audio/"));
  const hasText = inputTypes.includes("text/plain");

  if (hasImage && hasText) return "mixed";
  if (hasAudio) return "audio";
  if (hasText) return "text";
  if (hasImage) return "image";
  return "image";
}

function buildMcpRequest(model: (typeof models)[0], inputs: Record<string, unknown>) {
  return {
    tool: model.mcpTool,
    arguments: inputs,
  };
}

async function callRealApi(request: object, apiKey: string): Promise<object> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) headers["X-API-Key"] = apiKey;
  const res = await fetch(`${API_BASE_URL}/call`, {
    method: "POST",
    headers,
    body: JSON.stringify(request),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

export function Playground() {
  const [mode, setMode] = useState<"model" | "camera">("model");
  const [selectedModel, setSelectedModel] = useState(models[0]);
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<object | null>(null);
  const [copied, setCopied] = useState(false);
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [apiKey, setApiKey] = useState(DEFAULT_API_KEY);
  const [useMockFallback, setUseMockFallback] = useState(false);

  // Dynamic inputs
  const [imageUrl, setImageUrl] = useState("https://example.com/image.jpg");
  const [confidence, setConfidence] = useState(0.5);
  const [audioUrl, setAudioUrl] = useState(sampleAudio);
  const [language, setLanguage] = useState("zh");
  const [task, setTask] = useState<"transcribe" | "translate">("transcribe");
  const [wordTimestamps, setWordTimestamps] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [clipTexts, setClipTexts] = useState("a cat\na dog\na bird");
  const [clipMode, setClipMode] = useState<"classify" | "encode">("classify");

  const primaryInput = getPrimaryInputType(selectedModel.inputType);

  // Reset inputs when model changes
  useEffect(() => {
    setResult(null);
    setLogs([]);
    setUseMockFallback(false);
    setImageUrl("https://example.com/image.jpg");
    setConfidence(0.5);
    setAudioUrl(sampleAudio);
    setLanguage("zh");
    setTask("transcribe");
    setWordTimestamps(false);
    setTextInput("");
    setClipTexts("a cat\na dog\na bird");
    setClipMode("classify");
  }, [selectedModel.id]);

  const getInputs = (): Record<string, unknown> => {
    const base: Record<string, unknown> = {};
    if (primaryInput === "image" || primaryInput === "mixed") {
      base.image = imageUrl;
    }
    if (selectedModel.id === "yolov8" || selectedModel.id === "yolov8-pose" || selectedModel.id === "grounding-dino") {
      base.confidence = confidence;
    }
    if (selectedModel.id === "detr") {
      base.threshold = confidence;
    }
    if (primaryInput === "audio") {
      base.audio = audioUrl;
      base.language = language;
      base.task = task;
      base.word_timestamps = wordTimestamps;
    }
    if (primaryInput === "text" && selectedModel.id === "clip") {
      base.image = imageUrl;
      base.texts = clipTexts.split("\n").filter((t) => t.trim());
      base.mode = clipMode;
    }
    if (selectedModel.id === "sam2") {
      base.prompts = { points: [[320, 240]], labels: [1] };
      base.multimask_output = true;
    }
    if (selectedModel.id === "paddleocr") {
      base.lang = language;
      base.use_angle_cls = true;
      base.det = true;
      base.rec = true;
    }
    if (selectedModel.id === "depth-anything") {
      base.model_size = "large";
      base.output_format = "colormap";
      base.normalize = true;
    }
    if (selectedModel.id === "dinov2") {
      base.model = "vitl14";
      base.return_patch_tokens = false;
    }
    if (selectedModel.id === "grounding-dino") {
      base.text_prompt = "person . car . bicycle";
      base.box_threshold = 0.35;
      base.text_threshold = 0.25;
    }
    return base;
  };

  const mcpCallJson = JSON.stringify(buildMcpRequest(selectedModel, getInputs()), null, 2);

  const handleRun = async () => {
    setIsRunning(true);
    setResult(null);
    setUseMockFallback(false);
    const newLogs: string[] = [];

    const pushLog = (msg: string) => {
      newLogs.push(`[${new Date().toLocaleTimeString()}] ${msg}`);
      setLogs([...newLogs]);
    };

    pushLog("初始化推理引擎...");
    await new Promise((r) => setTimeout(r, 300));

    pushLog(`加载模型 ${selectedModel.name}...`);
    await new Promise((r) => setTimeout(r, 400));

    pushLog("预处理输入数据...");
    await new Promise((r) => setTimeout(r, 200));

    pushLog(`执行推理 (${selectedModel.latency})...`);

    const request = buildMcpRequest(selectedModel, getInputs());
    let apiResult: object | null = null;

    try {
      apiResult = await callRealApi(request, apiKey);
      pushLog("✓ 推理完成 (真实推理)");
    } catch (err: any) {
      const msg = err?.message || String(err);
      if (msg.includes("401") || msg.includes("403") || /API Key/i.test(msg)) {
        pushLog(`✗ API Key 认证失败: ${msg}`);
      } else {
        pushLog(`⚠ 后端不可用: ${msg}`);
      }
      pushLog("回退到 Mock 数据...");
      setUseMockFallback(true);
      await new Promise((r) => setTimeout(r, 400));
      apiResult = mockResults[selectedModel.id] || {
        model: selectedModel.id,
        inference_time: selectedModel.latency,
        result: "success",
      };
      pushLog("✓ 推理完成 (Mock)");
    }

    setResult(apiResult);
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
    setUseMockFallback(false);
    setImageUrl("https://example.com/image.jpg");
    setConfidence(0.5);
    setAudioUrl(sampleAudio);
    setLanguage("zh");
    setTask("transcribe");
    setWordTimestamps(false);
    setTextInput("");
    setClipTexts("a cat\na dog\na bird");
    setClipMode("classify");
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="border-b border-white/5 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="flex items-center gap-2 mb-2">
              <Sparkles size={16} className="text-cyan-400" />
              <span className="text-cyan-400 text-sm" style={{ fontWeight: 500 }}>交互式测试环境</span>
            </div>
            <h1 style={{ fontSize: "2rem", fontWeight: 700, letterSpacing: "-0.02em" }}>Playground</h1>
            <p className="text-gray-400 mt-2">选择模型，配置参数，即时查看推理结果</p>
          </motion.div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Mode toggle */}
        <div className="flex items-center gap-2 mb-6">
          <button
            onClick={() => setMode("model")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm transition-all ${
              mode === "model"
                ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"
                : "text-gray-400 hover:text-white hover:bg-white/5 border border-transparent"
            }`}
            style={{ fontWeight: 500 }}
          >
            <Brain size={15} />
            模型推理
          </button>
          <button
            onClick={() => setMode("camera")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm transition-all ${
              mode === "camera"
                ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"
                : "text-gray-400 hover:text-white hover:bg-white/5 border border-transparent"
            }`}
            style={{ fontWeight: 500 }}
          >
            <Camera size={15} />
            实时摄像头
          </button>
        </div>

        {mode === "camera" ? (
          <CameraPanel />
        ) : (
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
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base" style={{ background: `${selectedModel.color}15` }}>
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
                          onClick={() => { setSelectedModel(m); setShowModelDropdown(false); }}
                          className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left ${selectedModel.id === m.id ? "bg-white/5" : ""}`}
                        >
                          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-base shrink-0" style={{ background: `${m.color}15` }}>
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

              {/* Input type badges */}
              <div className="flex flex-wrap gap-1.5 mt-3">
                {selectedModel.inputType.map((t) => (
                  <span key={t} className="px-1.5 py-0.5 rounded bg-white/5 text-gray-500 text-xs font-mono">{t}</span>
                ))}
              </div>
            </div>

            {/* Input config — dynamic based on model */}
            <div className="p-5 rounded-2xl border border-white/5 bg-white/[0.02]">
              <label className="text-gray-400 text-xs mb-3 block" style={{ fontWeight: 500 }}>输入配置</label>
              <div className="space-y-4">
                {/* API Key (universal, used for X-API-Key header) */}
                <div>
                  <label className="text-gray-500 text-xs mb-1.5 block">API Key</label>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-cyan-500/30 transition-colors font-mono"
                    placeholder="输入 X-API-Key"
                  />
                </div>

                {/* Image input */}
                {(primaryInput === "image" || primaryInput === "mixed") && (
                  <div>
                    <label className="text-gray-500 text-xs mb-1.5 block flex items-center gap-1">
                      <ImageIcon size={12} /> 图片 URL
                    </label>
                    <input
                      type="text"
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-cyan-500/30 transition-colors font-mono"
                      placeholder="https://example.com/image.jpg"
                    />
                  </div>
                )}

                {/* Audio input */}
                {primaryInput === "audio" && (
                  <>
                    <div>
                      <label className="text-gray-500 text-xs mb-1.5 block flex items-center gap-1">
                        <Mic size={12} /> 音频 URL
                      </label>
                      <input
                        type="text"
                        value={audioUrl}
                        onChange={(e) => setAudioUrl(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-cyan-500/30 transition-colors font-mono"
                        placeholder="https://example.com/audio.mp3"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-gray-500 text-xs mb-1.5 block">语言</label>
                        <select
                          value={language}
                          onChange={(e) => setLanguage(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-white text-sm focus:outline-none focus:border-cyan-500/30 transition-colors"
                        >
                          <option value="zh">中文 (zh)</option>
                          <option value="en">English (en)</option>
                          <option value="ja">日本語 (ja)</option>
                          <option value="ko">한국어 (ko)</option>
                          <option value="auto">自动检测</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-gray-500 text-xs mb-1.5 block">任务</label>
                        <select
                          value={task}
                          onChange={(e) => setTask(e.target.value as "transcribe" | "translate")}
                          className="w-full px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-white text-sm focus:outline-none focus:border-cyan-500/30 transition-colors"
                        >
                          <option value="transcribe">转录</option>
                          <option value="translate">翻译为英文</option>
                        </select>
                      </div>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={wordTimestamps}
                        onChange={(e) => setWordTimestamps(e.target.checked)}
                        className="rounded border-white/10 bg-white/5 accent-cyan-400"
                      />
                      <span className="text-gray-400 text-xs">启用词级时间戳</span>
                    </label>
                  </>
                )}

                {/* Text input (CLIP mode) */}
                {primaryInput === "mixed" && selectedModel.id === "clip" && (
                  <>
                    <div>
                      <label className="text-gray-500 text-xs mb-1.5 block flex items-center gap-1">
                        <Type size={12} /> 候选文本（每行一个）
                      </label>
                      <textarea
                        value={clipTexts}
                        onChange={(e) => setClipTexts(e.target.value)}
                        rows={3}
                        className="w-full px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-cyan-500/30 transition-colors font-mono resize-none"
                      />
                    </div>
                    <div>
                      <label className="text-gray-500 text-xs mb-1.5 block">模式</label>
                      <select
                        value={clipMode}
                        onChange={(e) => setClipMode(e.target.value as "classify" | "encode")}
                        className="w-full px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-white text-sm focus:outline-none focus:border-cyan-500/30 transition-colors"
                      >
                        <option value="classify">分类</option>
                        <option value="encode">编码</option>
                      </select>
                    </div>
                  </>
                )}

                {/* Confidence slider for detection models */}
                {(selectedModel.id === "yolov8" || selectedModel.id === "yolov8-pose" || selectedModel.id === "detr" || selectedModel.id === "grounding-dino") && (
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
                )}

                {/* Sample images */}
                {(primaryInput === "image" || primaryInput === "mixed") && (
                  <div>
                    <label className="text-gray-500 text-xs mb-2 block">快速示例图片</label>
                    <div className="grid grid-cols-2 gap-2">
                      {sampleImages.map((img) => (
                        <button
                          key={img.label}
                          onClick={() => setImageUrl(img.url)}
                          className="relative rounded-lg overflow-hidden border border-white/10 hover:border-cyan-500/30 transition-all group aspect-video"
                        >
                          <img src={img.url} alt={img.label} className="w-full h-full object-cover opacity-60 group-hover:opacity-80 transition-opacity" />
                          <div className="absolute inset-0 flex items-end p-1.5">
                            <span className="text-white text-xs px-1.5 py-0.5 rounded bg-black/60">{img.label}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
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
                <div className="text-xs px-2 py-0.5 rounded-full" style={{ color: selectedModel.color, background: `${selectedModel.color}15` }}>
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
                        log.includes("✓") ? "bg-green-400" : log.includes("⚠") ? "bg-amber-400" : "bg-cyan-400/50"
                      }`} />
                      <span className={`text-xs font-mono ${
                        log.includes("✓") ? "text-green-400" : log.includes("⚠") ? "text-amber-400" : "text-gray-500"
                      }`}>{log}</span>
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
                    {useMockFallback && (
                      <span className="text-amber-400 text-xs px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">Mock</span>
                    )}
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
                        if (line.includes('"confidence"') || line.includes('"score"') || line.includes('"logit"') || line.includes('"similarity"')) color = "text-green-300";
                        else if (line.includes('"class"') || line.includes('"text"') || line.includes('"phrase"') || line.includes('"label"') || line.includes('"word"')) color = "text-cyan-300";
                        else if (line.includes('"inference_time"') || line.includes('"device"') || line.includes('"language"') || line.includes('"task"')) color = "text-amber-300";
                        return <span key={i} className={`block ${color}`}>{line}</span>;
                      })}
                  </pre>
                </div>
              </motion.div>
            )}

            {/* Empty state */}
            {!result && !isRunning && logs.length === 0 && (
              <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.01] flex flex-col items-center justify-center py-16 text-center">
                <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
                  {primaryInput === "audio" ? <Mic size={20} className="text-gray-600" /> : <ImageIcon size={20} className="text-gray-600" />}
                </div>
                <p className="text-gray-500 text-sm">配置参数后点击「运行推理」</p>
                <p className="text-gray-600 text-xs mt-1">结果将在此处展示</p>
              </div>
            )}
          </div>
        </div>
        )}
      </div>
    </div>
  );
}
