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
    id: "yolov8",
    name: "YOLOv8",
    version: "8.3.0",
    category: "目标检测",
    description: "实时目标检测与分割，支持80+类别识别，毫秒级推理速度",
    longDescription:
      "YOLOv8 是 Ultralytics 推出的最新一代目标检测模型，在速度和精度上均达到 SOTA 水平。支持目标检测、实例分割、关键点检测、分类等多种任务。通过 MCP 协议调用可直接处理图片URL、Base64或本地路径。",
    tags: ["COCO", "实时", "多任务", "ONNX"],
    status: "online",
    latency: "12ms",
    throughput: "83 FPS",
    inputType: ["image/jpeg", "image/png", "video/mp4"],
    outputType: ["application/json"],
    color: "#00d4ff",
    icon: "🎯",
    mcpTool: "yolov8_detect",
    params: "43M",
    framework: "PyTorch / ONNX",
    license: "AGPL-3.0",
    useCases: ["安防监控", "自动驾驶", "工业质检", "人流统计"],
    mcpExample: `{
  "tool": "yolov8_detect",
  "arguments": {
    "image": "https://example.com/image.jpg",
    "confidence": 0.5,
    "classes": ["person", "car", "bicycle"],
    "model_size": "m"
  }
}`,
  },
  {
    id: "detr",
    name: "DETR",
    version: "1.2.0",
    category: "目标检测",
    description: "基于Transformer的端到端目标检测，无需NMS后处理",
    longDescription:
      "DETR (Detection Transformer) 是 Facebook AI 提出的革命性目标检测模型，使用 Transformer 架构直接预测检测结果，无需手工设计锚框和NMS。ResNet-50 骨干网络，在 COCO 数据集上达到 42.0 AP。",
    tags: ["Transformer", "端到端", "COCO", "ResNet"],
    status: "online",
    latency: "38ms",
    throughput: "26 FPS",
    inputType: ["image/jpeg", "image/png"],
    outputType: ["application/json"],
    color: "#7c3aed",
    icon: "🔲",
    mcpTool: "detr_detect",
    params: "41M",
    framework: "PyTorch",
    license: "Apache-2.0",
    useCases: ["精准检测", "全景分割", "场景理解", "图像标注"],
    mcpExample: `{
  "tool": "detr_detect",
  "arguments": {
    "image": "base64://...",
    "threshold": 0.7,
    "return_masks": false
  }
}`,
  },
  {
    id: "paddleocr",
    name: "PaddleOCR",
    version: "2.8.0",
    category: "文字识别",
    description: "支持80+语言的高精度OCR，包含文本检测、方向分类、识别全流水线",
    longDescription:
      "PaddleOCR 是百度开源的超轻量OCR系统，基于PaddlePaddle框架开发。支持中文、英文、日文等80+语言，包含PP-OCRv4超轻量模型，在CPU上也能快速运行。支持表格识别、版面分析等高级功能。",
    tags: ["多语言", "中文", "表格", "轻量"],
    status: "online",
    latency: "45ms",
    throughput: "22 FPS",
    inputType: ["image/jpeg", "image/png", "image/tiff"],
    outputType: ["application/json"],
    color: "#00ff88",
    icon: "📝",
    mcpTool: "paddleocr_recognize",
    params: "12M",
    framework: "PaddlePaddle",
    license: "Apache-2.0",
    useCases: ["文档数字化", "票据识别", "车牌识别", "标签提取"],
    mcpExample: `{
  "tool": "paddleocr_recognize",
  "arguments": {
    "image": "https://example.com/doc.png",
    "lang": "ch",
    "use_angle_cls": true,
    "det": true,
    "rec": true
  }
}`,
  },
  {
    id: "sam2",
    name: "SAM 2",
    version: "2.1.0",
    category: "图像分割",
    description: "Segment Anything Model 2，支持图像和视频的零样本分割",
    longDescription:
      "SAM 2 是 Meta AI 发布的第二代 Segment Anything Model，在图像和视频分割任务上均达到 SOTA。支持点、框、掩码等多种提示方式，实现零样本精准分割。视频分割速度高达 44 FPS。",
    tags: ["零样本", "视频", "交互式", "多模态"],
    status: "online",
    latency: "23ms",
    throughput: "44 FPS",
    inputType: ["image/jpeg", "image/png", "video/mp4"],
    outputType: ["image/png", "application/json"],
    color: "#f59e0b",
    icon: "✂️",
    mcpTool: "sam2_segment",
    params: "224M",
    framework: "PyTorch",
    license: "Apache-2.0",
    useCases: ["图像编辑", "医学影像", "遥感分析", "视频剪辑"],
    mcpExample: `{
  "tool": "sam2_segment",
  "arguments": {
    "image": "https://example.com/photo.jpg",
    "prompts": {
      "points": [[320, 240]],
      "labels": [1]
    },
    "multimask_output": true
  }
}`,
  },
  {
    id: "clip",
    name: "CLIP",
    version: "ViT-L/14",
    category: "多模态",
    description: "OpenAI图文对比学习模型，支持零样本图像分类与图文检索",
    longDescription:
      "CLIP (Contrastive Language-Image Pre-training) 是 OpenAI 开发的多模态模型，通过对比学习将图像和文本映射到统一向量空间。支持零样本分类、图文检索、语义相似度计算等任务。",
    tags: ["零样本", "图文", "Embedding", "检索"],
    status: "online",
    latency: "18ms",
    throughput: "55 FPS",
    inputType: ["image/jpeg", "image/png", "text/plain"],
    outputType: ["application/json"],
    color: "#ec4899",
    icon: "🔗",
    mcpTool: "clip_encode",
    params: "307M",
    framework: "PyTorch",
    license: "MIT",
    useCases: ["图像搜索", "内容审核", "相似度排序", "标签生成"],
    mcpExample: `{
  "tool": "clip_encode",
  "arguments": {
    "image": "https://example.com/cat.jpg",
    "texts": ["a cat", "a dog", "a bird"],
    "mode": "classify"
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
  {
    id: "depth-anything",
    name: "Depth Anything V2",
    version: "2.0.0",
    category: "深度估计",
    description: "单目深度估计SOTA模型，生成高质量深度图，支持室内外场景",
    longDescription:
      "Depth Anything V2 是港大发布的单目深度估计模型，在精度和泛化能力上超越前代。Large模型在 DA-2K 评测中取得 SOTA，支持从普通相机单张照片估计场景深度，可用于三维重建、SLAM等任务。",
    tags: ["单目", "SLAM", "三维重建", "室内外"],
    status: "online",
    latency: "35ms",
    throughput: "28 FPS",
    inputType: ["image/jpeg", "image/png"],
    outputType: ["image/png", "application/json"],
    color: "#10b981",
    icon: "📐",
    mcpTool: "depth_estimate",
    params: "335M",
    framework: "PyTorch",
    license: "Apache-2.0",
    useCases: ["三维重建", "AR增强", "机器人导航", "自动驾驶"],
    mcpExample: `{
  "tool": "depth_estimate",
  "arguments": {
    "image": "https://example.com/scene.jpg",
    "model_size": "large",
    "output_format": "colormap",
    "normalize": true
  }
}`,
  },
  {
    id: "dinov2",
    name: "DINOv2",
    version: "2.0.0",
    category: "视觉特征",
    description: "Meta自监督视觉基础模型，提取通用视觉特征用于下游任务",
    longDescription:
      "DINOv2 是 Meta 提出的自监督视觉基础模型，无需标注数据即可学习强大的视觉特征表示。ViT-L/14 模型提取的特征在图像分类、语义分割、深度估计等任务上均超越有监督预训练。",
    tags: ["自监督", "特征提取", "ViT", "基础模型"],
    status: "loading",
    latency: "28ms",
    throughput: "35 FPS",
    inputType: ["image/jpeg", "image/png"],
    outputType: ["application/json"],
    color: "#8b5cf6",
    icon: "🧠",
    mcpTool: "dinov2_embed",
    params: "307M",
    framework: "PyTorch",
    license: "Apache-2.0",
    useCases: ["图像检索", "少样本学习", "异常检测", "聚类分析"],
    mcpExample: `{
  "tool": "dinov2_embed",
  "arguments": {
    "image": "https://example.com/img.jpg",
    "model": "vitl14",
    "return_patch_tokens": false
  }
}`,
  },
  {
    id: "yolov8-pose",
    name: "YOLOv8-Pose",
    version: "8.3.0",
    category: "姿态估计",
    description: "17关键点人体姿态估计，支持多人实时检测，精度业界领先",
    longDescription:
      "YOLOv8-Pose 专为人体姿态估计设计，可同时检测图像中多个人物的17个关键点（COCO格式）。提供关节坐标、置信度，支持骨架可视化输出，广泛用于运动分析和人机交互。",
    tags: ["关键点", "多人", "骨架", "COCO"],
    status: "online",
    latency: "15ms",
    throughput: "66 FPS",
    inputType: ["image/jpeg", "image/png", "video/mp4"],
    outputType: ["application/json", "image/jpeg"],
    color: "#f97316",
    icon: "🏃",
    mcpTool: "pose_estimate",
    params: "26M",
    framework: "PyTorch / ONNX",
    license: "AGPL-3.0",
    useCases: ["运动分析", "健身指导", "行为识别", "人机交互"],
    mcpExample: `{
  "tool": "pose_estimate",
  "arguments": {
    "image": "https://example.com/people.jpg",
    "confidence": 0.5,
    "visualize": true,
    "format": "coco"
  }
}`,
  },
  {
    id: "grounding-dino",
    name: "Grounding DINO",
    version: "1.5.0",
    category: "开放词汇",
    description: "开放词汇目标检测，通过文本描述检测任意类别，无需预定义类别",
    longDescription:
      "Grounding DINO 将 DINO 检测器与文本编码器结合，实现开放词汇的目标检测。用户只需输入文本描述（如 \"red car\" 或 \"person wearing hat\"），模型即可定位到对应目标，无需重新训练。",
    tags: ["开放词汇", "文本引导", "零样本", "DINO"],
    status: "online",
    latency: "55ms",
    throughput: "18 FPS",
    inputType: ["image/jpeg", "image/png"],
    outputType: ["application/json"],
    color: "#ef4444",
    icon: "🔍",
    mcpTool: "grounding_dino_detect",
    params: "172M",
    framework: "PyTorch",
    license: "Apache-2.0",
    useCases: ["开放域检测", "机器人视觉", "VQA", "内容理解"],
    mcpExample: `{
  "tool": "grounding_dino_detect",
  "arguments": {
    "image": "https://example.com/scene.jpg",
    "text_prompt": "red apple . green bottle . wooden table",
    "box_threshold": 0.35,
    "text_threshold": 0.25
  }
}`,
  },
];

export const categories = [
  "全部",
  "目标检测",
  "图像分割",
  "文字识别",
  "多模态",
  "语音识别",
  "深度估计",
  "视觉特征",
  "姿态估计",
  "开放词汇",
];
