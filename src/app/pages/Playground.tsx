import { motion } from "motion/react";
import { useState, useRef, useEffect, useCallback } from "react";
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
  FileUp,
  Activity,
} from "lucide-react";
import { models } from "../data/models";
import { COCO_CLASSES } from "../data/cocoClasses";
import { CameraPanel } from "../components/CameraPanel";
import { DetectionOverlay } from "../components/DetectionOverlay";

const cvImage = "https://images.unsplash.com/photo-1554936970-ce06538caf54?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjb21wdXRlciUyMHZpc2lvbiUyMG9iamVjdCUyMGRldGVjdGlvbiUyMHRlY2hub2xvZ3l8ZW58MXx8fHwxNzc0NzcxMDU4fDA&ixlib=rb-4.1.0&q=80&w=1080";

// Mock inference results per model
const mockResults: Record<string, object> = {
  yolo26: {
    model: "yolo26",
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

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8081";
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
    const errData = await res.json().catch(() => ({ detail: res.statusText }));
    const detail =
      typeof errData.detail === "string"
        ? errData.detail
        : JSON.stringify(errData.detail || errData);
    throw new Error(detail || `HTTP ${res.status}`);
  }
  return res.json();
}

function isNetworkError(msg: string): boolean {
  const networkPatterns = [
    "Failed to fetch",
    "NetworkError",
    "ECONNREFUSED",
    "net::ERR",
    "Network request failed",
    "fetch failed",
    "Load failed",
  ];
  return networkPatterns.some((p) => msg.includes(p));
}

// ---------------------------------------------------------------------------
// SSE helpers
// ---------------------------------------------------------------------------

type SseEventItem = { event: string; data: unknown; time: string };

function parseSseBuffer(buffer: string): { events: SseEventItem[]; remainder: string } {
  const parts = buffer.split("\n\n");
  const remainder = parts.pop() || "";
  const events: SseEventItem[] = [];
  for (const part of parts) {
    const lines = part.split("\n");
    let event = "";
    let data = "";
    for (const line of lines) {
      if (line.startsWith("event: ")) event = line.slice(7);
      if (line.startsWith("data: ")) data = line.slice(6);
    }
    if (event) {
      try {
        events.push({ event, data: JSON.parse(data), time: new Date().toLocaleTimeString() });
      } catch {
        events.push({ event, data, time: new Date().toLocaleTimeString() });
      }
    }
  }
  return { events, remainder };
}

async function subscribeSse(
  request: object,
  apiKey: string,
  onEvent: (item: SseEventItem) => void,
  onError: (msg: string) => void,
  signal: AbortSignal
) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) headers["X-API-Key"] = apiKey;
  try {
    const res = await fetch(`${API_BASE_URL}/sse`, {
      method: "POST",
      headers,
      body: JSON.stringify(request),
      signal,
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({ detail: res.statusText }));
      const detail =
        typeof errData.detail === "string"
          ? errData.detail
          : JSON.stringify(errData.detail || errData);
      throw new Error(detail || `HTTP ${res.status}`);
    }
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      if (signal.aborted) break;
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const { events, remainder } = parseSseBuffer(buffer);
      buffer = remainder;
      for (const evt of events) {
        onEvent(evt);
        if (evt.event === "result" || evt.event === "error") {
          return;
        }
      }
    }
  } catch (err: any) {
    if (err.name !== "AbortError") {
      onError(err.message || String(err));
    }
  }
}

export function Playground() {
  const [mode, setMode] = useState<"model" | "camera" | "sse">("model");
  const [selectedModel, setSelectedModel] = useState(models[0]);
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<object | null>(null);
  const [copied, setCopied] = useState(false);
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [apiKey, setApiKey] = useState(DEFAULT_API_KEY);
  const [useMockFallback, setUseMockFallback] = useState(false);

  // SSE state
  const [sseEvents, setSseEvents] = useState<SseEventItem[]>([]);
  const [sseConnected, setSseConnected] = useState(false);
  const [sseResult, setSseResult] = useState<object | null>(null);
  const sseAbortRef = useRef<AbortController | null>(null);

  // Dynamic inputs
  const [imageUrl, setImageUrl] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [confidence, setConfidence] = useState(0.5);
  const [audioUrl, setAudioUrl] = useState(sampleAudio);
  const [language, setLanguage] = useState("zh");
  const [task, setTask] = useState<"transcribe" | "translate">("transcribe");
  const [wordTimestamps, setWordTimestamps] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [clipTexts, setClipTexts] = useState("a cat\na dog\na bird");
  const [clipMode, setClipMode] = useState<"classify" | "encode">("classify");
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);

  // Microphone recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const primaryInput = getPrimaryInputType(selectedModel.inputType);

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setImageUrl(dataUrl);
      setImagePreview(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const handleAudioFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setAudioUrl(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result as string;
          setAudioUrl(dataUrl);
        };
        reader.readAsDataURL(audioBlob);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime((t) => t + 1);
      }, 1000);
    } catch (err) {
      alert("无法访问麦克风，请检查权限设置: " + String(err));
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  };

  // Reset inputs when model changes
  useEffect(() => {
    setResult(null);
    setLogs([]);
    setUseMockFallback(false);
    setImageUrl("");
    setImagePreview(null);
    setConfidence(0.5);
    setAudioUrl(sampleAudio);
    setLanguage("zh");
    setTask("transcribe");
    setWordTimestamps(false);
    setTextInput("");
    setClipTexts("a cat\na dog\na bird");
    setClipMode("classify");
    setSelectedClasses([]);
  }, [selectedModel.id]);

  const getInputs = (): Record<string, unknown> => {
    const base: Record<string, unknown> = {};
    if (primaryInput === "image" || primaryInput === "mixed") {
      base.image = imageUrl;
    }
    if (selectedModel.id === "yolo26" || selectedModel.id === "yolov8-pose" || selectedModel.id === "grounding-dino") {
      base.confidence = confidence;
    }
    if (selectedModel.id === "yolo26" && selectedClasses.length > 0) {
      base.classes = selectedClasses;
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

    // Input validation: block empty required inputs before calling API
    if ((primaryInput === "image" || primaryInput === "mixed") && !imageUrl.trim()) {
      pushLog("✗ 请先输入图片 URL 或选择示例图片");
      setIsRunning(false);
      return;
    }
    if (primaryInput === "audio" && !audioUrl.trim()) {
      pushLog("✗ 请先输入音频 URL");
      setIsRunning(false);
      return;
    }

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
      } else if (isNetworkError(msg)) {
        pushLog(`⚠ 后端不可用: ${msg}`);
        pushLog("回退到 Mock 数据...");
        setUseMockFallback(true);
        await new Promise((r) => setTimeout(r, 400));
        apiResult = mockResults[selectedModel.id] || {
          model: selectedModel.id,
          inference_time: selectedModel.latency,
          result: "success",
        };
        pushLog("✓ 推理完成 (Mock)");
      } else {
        pushLog(`✗ 推理失败: ${msg}`);
      }
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
    setImageUrl("");
    setImagePreview(null);
    setConfidence(0.5);
    setAudioUrl(sampleAudio);
    setLanguage("zh");
    setTask("transcribe");
    setWordTimestamps(false);
    setTextInput("");
    setClipTexts("a cat\na dog\na bird");
    setClipMode("classify");
    setSelectedClasses([]);
    setIsRecording(false);
    setRecordingTime(0);
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    // Reset SSE state
    setSseEvents([]);
    setSseResult(null);
    if (sseAbortRef.current) {
      sseAbortRef.current.abort();
      sseAbortRef.current = null;
    }
    setSseConnected(false);
  };

  // SSE handlers
  const handleSseStart = useCallback(async () => {
    setSseEvents([]);
    setSseResult(null);
    setSseConnected(true);
    const abortCtrl = new AbortController();
    sseAbortRef.current = abortCtrl;

    const request = {
      tool: selectedModel.mcpTool,
      arguments: getInputs(),
      stream_progress: true,
    };

    await subscribeSse(
      request,
      apiKey,
      (item) => {
        setSseEvents((prev) => [...prev, item]);
        if (item.event === "result" || item.event === "error") {
          setSseResult(item.data as object);
          setSseConnected(false);
        }
      },
      (msg) => {
        setSseEvents((prev) => [
          ...prev,
          { event: "error", data: { message: msg }, time: new Date().toLocaleTimeString() },
        ]);
        setSseConnected(false);
      },
      abortCtrl.signal
    );
  }, [selectedModel, getInputs, apiKey]);

  const handleSseStop = useCallback(() => {
    if (sseAbortRef.current) {
      sseAbortRef.current.abort();
      sseAbortRef.current = null;
    }
    setSseConnected(false);
  }, []);

  // Cleanup SSE on unmount or mode change away from sse
  useEffect(() => {
    return () => {
      if (sseAbortRef.current) {
        sseAbortRef.current.abort();
        sseAbortRef.current = null;
      }
    };
  }, []);

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
          <button
            onClick={() => setMode("sse")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm transition-all ${
              mode === "sse"
                ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"
                : "text-gray-400 hover:text-white hover:bg-white/5 border border-transparent"
            }`}
            style={{ fontWeight: 500 }}
          >
            <Activity size={15} />
            SSE 流式测试
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
                  <div className="space-y-3">
                    <div>
                      <label className="text-gray-500 text-xs mb-1.5 block flex items-center gap-1">
                        <ImageIcon size={12} /> 图片 URL 或本地上传
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={imageUrl}
                          onChange={(e) => { setImageUrl(e.target.value); setImagePreview(e.target.value || null); }}
                          className="flex-1 px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-cyan-500/30 transition-colors font-mono"
                          placeholder="https://example.com/image.jpg"
                        />
                        <label className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-gray-300 text-sm hover:bg-white/[0.07] hover:text-white transition-colors cursor-pointer shrink-0">
                          <FileUp size={14} />
                          <span>上传</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleImageFileChange}
                            className="hidden"
                          />
                        </label>
                      </div>
                    </div>
                    {imagePreview && (
                      <div className="rounded-lg overflow-hidden border border-white/10 bg-black max-h-40">
                        <img src={imagePreview} alt="Preview" className="w-full h-full object-contain max-h-40" />
                      </div>
                    )}
                  </div>
                )}

                {/* Audio input */}
                {primaryInput === "audio" && (
                  <>
                    <div>
                      <label className="text-gray-500 text-xs mb-1.5 block flex items-center gap-1">
                        <Mic size={12} /> 音频来源
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={audioUrl}
                          onChange={(e) => setAudioUrl(e.target.value)}
                          className="flex-1 px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-cyan-500/30 transition-colors font-mono"
                          placeholder="https://example.com/audio.mp3"
                        />
                        <label className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-gray-300 text-sm hover:bg-white/[0.07] hover:text-white transition-colors cursor-pointer shrink-0">
                          <FileUp size={14} />
                          <span>上传</span>
                          <input
                            type="file"
                            accept="audio/*"
                            onChange={handleAudioFileChange}
                            className="hidden"
                          />
                        </label>
                        <button
                          onClick={isRecording ? stopRecording : startRecording}
                          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm transition-colors shrink-0 ${
                            isRecording
                              ? "border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20"
                              : "border-white/10 bg-white/5 text-gray-300 hover:bg-white/[0.07] hover:text-white"
                          }`}
                        >
                          <Mic size={14} className={isRecording ? "animate-pulse" : ""} />
                          <span>{isRecording ? `停止 (${recordingTime}s)` : "录制"}</span>
                        </button>
                      </div>
                      {audioUrl && audioUrl.startsWith("data:") && (
                        <audio src={audioUrl} controls className="w-full mt-2 rounded-lg" />
                      )}
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
                {(selectedModel.id === "yolo26" || selectedModel.id === "yolov8-pose" || selectedModel.id === "detr" || selectedModel.id === "grounding-dino") && (
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

                {/* Category multi-select for YOLO */}
                {selectedModel.id === "yolo26" && (
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-gray-500 text-xs">检测类别</label>
                      <span className="text-cyan-400 text-xs" style={{ fontWeight: 600 }}>
                        {selectedClasses.length === 0 ? "全部" : `${selectedClasses.length} 项`}
                      </span>
                    </div>
                    <div className="max-h-32 overflow-y-auto rounded-lg border border-white/10 bg-white/5 p-2 space-y-1">
                      {COCO_CLASSES.map((cls) => (
                        <label key={cls} className="flex items-center gap-2 cursor-pointer text-xs text-gray-400 hover:text-white">
                          <input
                            type="checkbox"
                            checked={selectedClasses.includes(cls)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedClasses((prev) => [...prev, cls]);
                              } else {
                                setSelectedClasses((prev) => prev.filter((c) => c !== cls));
                              }
                            }}
                            className="rounded border-white/10 bg-white/5 accent-cyan-400 shrink-0"
                          />
                          <span>{cls}</span>
                        </label>
                      ))}
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
              {mode === "model" ? (
                <>
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
                </>
              ) : (
                <>
                  <button
                    onClick={handleSseStart}
                    disabled={sseConnected || selectedModel.status !== "online"}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                      background: sseConnected ? "#1a2030" : `linear-gradient(135deg, ${selectedModel.color}, ${selectedModel.color}99)`,
                      fontWeight: 600,
                    }}
                  >
                    {sseConnected ? (
                      <><Loader2 size={16} className="animate-spin" /><span>订阅中...</span></>
                    ) : (
                      <><Activity size={16} /><span>开始 SSE 订阅</span></>
                    )}
                  </button>
                  <button
                    onClick={handleSseStop}
                    disabled={!sseConnected}
                    className="p-3 rounded-xl border border-white/10 text-gray-400 hover:text-white hover:bg-white/5 transition-all disabled:opacity-30"
                  >
                    <AlertCircle size={16} />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Right panel - Results */}
          <div className="lg:col-span-3 space-y-5">
            {mode === "sse" ? (
              <>
                {/* SSE Connection status */}
                <div className="rounded-2xl border border-white/5 bg-[#0d1117] overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-white/[0.02]">
                    <div className="flex items-center gap-2">
                      <Activity size={13} className={sseConnected ? "text-green-400 animate-pulse" : "text-gray-500"} />
                      <span className="text-gray-400 text-xs" style={{ fontWeight: 500 }}>SSE 连接状态</span>
                    </div>
                    <div className={`text-xs px-2 py-0.5 rounded-full ${
                      sseConnected
                        ? "text-green-400 bg-green-400/10 border border-green-400/20"
                        : "text-gray-500 bg-white/5 border border-white/10"
                    }`}>
                      {sseConnected ? "已连接" : "未连接"}
                    </div>
                  </div>
                  <div className="p-4">
                    <div className="text-xs font-mono text-gray-500">
                      {sseConnected
                        ? "正在订阅事件流..."
                        : sseEvents.length > 0
                        ? "连接已关闭"
                        : "点击「开始 SSE 订阅」以启动流式推理"}
                    </div>
                  </div>
                </div>

                {/* SSE Event log */}
                {sseEvents.length > 0 && (
                  <div className="rounded-2xl border border-white/5 bg-[#0d1117] overflow-hidden">
                    <div className="px-4 py-3 border-b border-white/5 bg-white/[0.02] flex items-center justify-between">
                      <span className="text-gray-400 text-xs" style={{ fontWeight: 500 }}>事件流</span>
                      <span className="text-gray-600 text-xs">{sseEvents.length} 个事件</span>
                    </div>
                    <div className="p-4 space-y-2 max-h-96 overflow-y-auto">
                      {sseEvents.map((evt, i) => (
                        <div key={i} className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                              evt.event === "progress"
                                ? "bg-cyan-500/10 text-cyan-400"
                                : evt.event === "result"
                                ? "bg-green-500/10 text-green-400"
                                : evt.event === "error"
                                ? "bg-red-500/10 text-red-400"
                                : "bg-gray-500/10 text-gray-400"
                            }`}>
                              {evt.event}
                            </span>
                            <span className="text-gray-600 text-[10px] font-mono">{evt.time}</span>
                          </div>
                          <pre className="text-[11px] font-mono text-gray-400 leading-relaxed whitespace-pre-wrap overflow-x-auto">
                            {JSON.stringify(evt.data, null, 2)}
                          </pre>
                        </div>
                      ))}
                      {sseConnected && (
                        <div className="flex items-center gap-2">
                          <Loader2 size={12} className="text-cyan-400 animate-spin" />
                          <span className="text-gray-600 text-xs font-mono">等待下一事件...</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* SSE Final result */}
                {sseResult && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-2xl border border-white/5 bg-[#0d1117] overflow-hidden"
                  >
                    <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5 bg-white/[0.02]">
                      <CheckCircle size={13} className="text-green-400" />
                      <span className="text-gray-400 text-xs" style={{ fontWeight: 500 }}>最终结果</span>
                    </div>
                    <div className="p-4">
                      <pre className="text-xs font-mono text-gray-300 leading-relaxed whitespace-pre-wrap max-h-80 overflow-y-auto">
                        {JSON.stringify(sseResult, null, 2)}
                      </pre>
                    </div>
                  </motion.div>
                )}

                {/* SSE Empty state */}
                {sseEvents.length === 0 && !sseConnected && (
                  <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.01] flex flex-col items-center justify-center py-16 text-center">
                    <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
                      <Activity size={20} className="text-gray-600" />
                    </div>
                    <p className="text-gray-500 text-sm">配置参数后点击「开始 SSE 订阅」</p>
                    <p className="text-gray-600 text-xs mt-1">实时事件将在此处展示</p>
                  </div>
                )}
              </>
            ) : (
              <>
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
                    className={`rounded-2xl border overflow-hidden ${
                      useMockFallback
                        ? "border-amber-500/40 bg-amber-950/10"
                        : "border-white/5 bg-[#0d1117]"
                    }`}
                  >
                    {useMockFallback && (
                      <div className="px-4 py-2 border-b border-amber-500/20 bg-amber-500/10 flex items-center gap-2">
                        <AlertCircle size={14} className="text-amber-400 shrink-0" />
                        <span className="text-amber-300 text-xs" style={{ fontWeight: 600 }}>
                          当前展示的是 Mock 数据，真实后端不可用或请求失败
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-white/[0.02]">
                      <div className="flex items-center gap-2">
                        <CheckCircle size={13} className={useMockFallback ? "text-amber-400" : "text-green-400"} />
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
                    <div className="p-4 space-y-4">
                      {/* Detection visualization */}
                      {(() => {
                        const res = result as Record<string, unknown>;
                        const detections =
                          (res.result as Record<string, unknown> | undefined)?.detections ||
                          (res.result as Record<string, unknown> | undefined)?.persons ||
                          (res as Record<string, unknown>).detections;
                        const hasDetections = Array.isArray(detections) && detections.length > 0;
                        const imgSrc = imagePreview || imageUrl;
                        if (hasDetections && imgSrc) {
                          return (
                            <DetectionOverlay
                              imageSrc={imgSrc}
                              detections={detections as Array<Record<string, unknown>>}
                            />
                          );
                        }
                        return null;
                      })()}
                      <pre className="text-xs font-mono text-gray-300 leading-relaxed whitespace-pre-wrap max-h-80 overflow-y-auto">
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
              </>
            )}
          </div>
        </div>
        )}
      </div>
    </div>
  );
}
