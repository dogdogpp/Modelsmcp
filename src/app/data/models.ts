export interface ModelInfo {
  id: string;
  name: string;
  version: string;
  category: string;
  description: string;
  longDescription: string;
  tags: string[];
  status: "online" | "loading" | "offline";
  latency: string;
  throughput: string;
  inputType: string[];
  outputType: string[];
  color: string;
  icon: string;
  mcpTool: string;
  params: string;
  framework: string;
  license: string;
  useCases: string[];
  mcpExample: string;
}

export const models: ModelInfo[] = [
  {
    id: "yolo26",
    name: "YOLO2026",
    version: "8.3.0",
    category: "目标检测",
    description: "实时目标检测与分割，支持80+类别识别，毫秒级推理速度",
    longDescription:
      "YOLO2026 是 Ultralytics 推出的最新一代目标检测模型，在速度和精度上均达到 SOTA 水平。支持目标检测、实例分割、关键点检测、分类等多种任务。通过 MCP 协议调用可直接处理图片URL、Base64或本地路径。",
    tags: ["COCO", "实时", "多任务", "ONNX"],
    status: "online",
    latency: "12ms",
    throughput: "83 FPS",
    inputType: ["image/jpeg", "image/png", "video/mp4"],
    outputType: ["application/json"],
    color: "#00d4ff",
    icon: "🎯",
    mcpTool: "yolo26_detect",
    params: "43M",
    framework: "PyTorch / ONNX",
    license: "AGPL-3.0",
    useCases: ["安防监控", "自动驾驶", "工业质检", "人流统计"],
    mcpExample: `{
  "tool": "yolo26_detect",
  "arguments": {
    "image": "https://example.com/image.jpg",
    "confidence": 0.5,
    "classes": ["person", "car", "bicycle"],
    "model_size": "m"
  }
}`,
  },
  {
    id: "whisper",
    name: "Whisper",
    version: "large-v3",
    category: "语音识别",
    description: "OpenAI多语言语音识别，支持99种语言的转录与翻译",
    longDescription:
      "Whisper 是 OpenAI 开源的自动语音识别系统，在多语言语音识别和翻译任务上表现卓越。large-v3 模型支持99种语言，可直接进行语音转录和语音翻译，适合多种音频格式。",
    tags: ["多语言", "翻译", "转录", "噪声鲁棒"],
    status: "online",
    latency: "320ms",
    throughput: "实时",
    inputType: ["audio/wav", "audio/mp3", "audio/flac", "audio/m4a"],
    outputType: ["application/json", "text/plain"],
    color: "#06b6d4",
    icon: "🎙️",
    mcpTool: "whisper_transcribe",
    params: "1.5B",
    framework: "PyTorch",
    license: "MIT",
    useCases: ["会议记录", "字幕生成", "语音翻译", "播客转录"],
    mcpExample: `{
  "tool": "whisper_transcribe",
  "arguments": {
    "audio": "https://example.com/speech.mp3",
    "language": "zh",
    "task": "transcribe",
    "word_timestamps": true
  }
}`,
  },
];

export const categories = ["全部", ...new Set(models.map((m) => m.category))];
