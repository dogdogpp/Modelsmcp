import os
import base64
import tempfile
from typing import Dict, Any
from urllib.parse import urlparse
import urllib.request

import whisper

from . import register


class WhisperHandler:
    name = "Whisper"
    tool = "whisper_transcribe"
    model_id = "whisper"
    description = "OpenAI Whisper 多语言语音识别"
    device = "CPU"
    parameters = {
        "type": "object",
        "properties": {
            "audio": {"type": "string", "description": "音频 URL、Base64 或本地路径"},
            "language": {"type": "string", "default": "zh"},
            "task": {"type": "string", "enum": ["transcribe", "translate"], "default": "transcribe"},
            "word_timestamps": {"type": "boolean", "default": False},
        },
        "required": ["audio"],
    }

    def __init__(self):
        self._models: Dict[str, whisper.Whisper] = {}
        self._default_model = "base"

    def _load_model(self, model_name: str = "base"):
        if model_name not in self._models:
            # whisper.load_model auto-downloads weights on first use
            self._models[model_name] = whisper.load_model(model_name)
        return self._models[model_name]

    def _resolve_audio(self, audio: str) -> str:
        if audio.startswith("http://") or audio.startswith("https://"):
            ext = ".mp3"
            parsed = urlparse(audio)
            if parsed.path:
                _, ext = os.path.splitext(parsed.path)
                if not ext:
                    ext = ".mp3"
            fd, path = tempfile.mkstemp(suffix=ext)
            urllib.request.urlretrieve(audio, path)
            os.close(fd)
            return path

        if audio.startswith("data:"):
            # Handle data URI: data:{mime};base64,{data}
            header, _, data = audio.partition(",")
            mime = "application/octet-stream"
            if ";" in header:
                mime = header[len("data:"):].split(";")[0]
            ext = ".mp3"
            if "wav" in mime:
                ext = ".wav"
            elif "flac" in mime:
                ext = ".flac"
            elif "m4a" in mime or "mp4" in mime:
                ext = ".m4a"
            fd, path = tempfile.mkstemp(suffix=ext)
            with os.fdopen(fd, "wb") as f:
                f.write(base64.b64decode(data))
            return path

        if audio.startswith("base64://"):
            data = audio[len("base64://"):]
            fd, path = tempfile.mkstemp(suffix=".mp3")
            with os.fdopen(fd, "wb") as f:
                f.write(base64.b64decode(data))
            return path

        if audio.startswith("file://"):
            return audio[len("file://"):]

        if os.path.exists(audio):
            return audio

        raise ValueError(f"Unsupported audio source: {audio[:50]}...")

    def infer(self, arguments: Dict[str, Any]) -> Dict[str, Any]:
        audio_src = arguments.get("audio")
        language = arguments.get("language", "zh")
        task = arguments.get("task", "transcribe")
        word_timestamps = arguments.get("word_timestamps", False)

        audio_path = self._resolve_audio(audio_src)
        model = self._load_model(self._default_model)

        options = {
            "language": language if language != "auto" else None,
            "task": task,
            "verbose": False,
            "word_timestamps": word_timestamps,
        }

        result = model.transcribe(audio_path, **options)

        segments = []
        for seg in result.get("segments", []):
            item = {
                "start": round(seg["start"], 2),
                "end": round(seg["end"], 2),
                "text": seg["text"].strip(),
            }
            if word_timestamps and "words" in seg:
                item["words"] = [
                    {"word": w["word"], "start": round(w["start"], 2), "end": round(w["end"], 2)}
                    for w in seg["words"]
                ]
            segments.append(item)

        full_text = result.get("text", "").strip()

        # Clean up temp files
        if audio_path != audio_src and audio_path.startswith(tempfile.gettempdir()):
            try:
                os.remove(audio_path)
            except Exception:
                pass

        return {
            "language": language,
            "task": task,
            "segments": segments,
            "text": full_text,
        }


register(WhisperHandler())
