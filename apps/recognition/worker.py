"""Optional self-hosted OCR and speech recognition worker."""

import base64
import binascii
import hmac
import os
import tempfile
import threading
from functools import lru_cache
from pathlib import Path
from typing import Literal

import numpy as np
from fastapi import FastAPI, Header, HTTPException
from PIL import Image, UnidentifiedImageError
from pydantic import BaseModel, Field

app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)
MODEL_LOCK = threading.Lock()
API_KEY = os.environ.get("RECOGNITION_API_KEY", "")
MODEL_DIR = Path(os.environ.get("RECOGNITION_MODEL_DIR", "/models"))
MAX_BYTES = int(os.environ.get("MAX_MEDIA_SIZE_MB", "10")) * 1024 * 1024
MAX_AUDIO_SECONDS = int(os.environ.get("MAX_AUDIO_SECONDS", "60"))
ALLOWED_TYPES = {
    "ocr": {"image/jpeg", "image/png", "image/webp"},
    "transcribe": {
        "audio/webm", "audio/ogg", "audio/wav", "audio/x-wav",
        "audio/mpeg", "audio/mp4", "audio/aac",
    },
}


class MediaRequest(BaseModel):
    content: str = Field(min_length=1)
    mimeType: str


def require_key(provided: str | None) -> None:
    if len(API_KEY) < 32 or not provided or not hmac.compare_digest(API_KEY, provided):
        raise HTTPException(status_code=401, detail="Unauthorized")


def decode_media(payload: MediaRequest, kind: Literal["ocr", "transcribe"]) -> bytes:
    if payload.mimeType not in ALLOWED_TYPES[kind]:
        raise HTTPException(status_code=415, detail="Unsupported media type")
    max_encoded = ((MAX_BYTES + 2) // 3) * 4
    if len(payload.content) > max_encoded:
        raise HTTPException(status_code=413, detail="Media too large")
    try:
        media = base64.b64decode(payload.content, validate=True)
    except (ValueError, binascii.Error):
        raise HTTPException(status_code=400, detail="Invalid media") from None
    if not media or len(media) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="Media too large")
    return media


@lru_cache(maxsize=1)
def get_ocr_engine():
    from rapidocr_onnxruntime import RapidOCR

    return RapidOCR()


@lru_cache(maxsize=1)
def get_whisper_model():
    from faster_whisper import WhisperModel

    return WhisperModel(
        os.environ.get("WHISPER_MODEL", "base"),
        device=os.environ.get("WHISPER_DEVICE", "cpu"),
        compute_type=os.environ.get("WHISPER_COMPUTE_TYPE", "int8"),
        download_root=str(MODEL_DIR / "whisper"),
    )


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/ocr")
def ocr(payload: MediaRequest, x_recognition_key: str | None = Header(default=None)):
    require_key(x_recognition_key)
    data = decode_media(payload, "ocr")
    try:
        import io

        with Image.open(io.BytesIO(data)) as image:
            image.verify()
        with Image.open(io.BytesIO(data)) as image:
            if image.width * image.height > 25_000_000:
                raise HTTPException(status_code=413, detail="Image dimensions too large")
            image_array = np.asarray(image.convert("RGB"))
        if not MODEL_LOCK.acquire(blocking=False):
            raise HTTPException(status_code=429, detail="Recognition worker is busy")
        try:
            result, _ = get_ocr_engine()(image_array)
        finally:
            MODEL_LOCK.release()
        texts = [str(item[1]).strip() for item in (result or []) if len(item) > 1 and str(item[1]).strip()]
        return {"text": "\n".join(texts)}
    except HTTPException:
        raise
    except (UnidentifiedImageError, OSError, ValueError):
        raise HTTPException(status_code=400, detail="Invalid image") from None
    except Exception:
        raise HTTPException(status_code=422, detail="Image recognition failed") from None


def audio_duration(file_path: str) -> float:
    try:
        import av

        with av.open(file_path) as media:
            if media.duration is None:
                raise ValueError("Audio duration is missing")
            return media.duration / av.time_base
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid audio") from None


@app.post("/transcribe")
def transcribe(payload: MediaRequest, x_recognition_key: str | None = Header(default=None)):
    require_key(x_recognition_key)
    data = decode_media(payload, "transcribe")
    suffix = {
        "audio/webm": ".webm", "audio/ogg": ".ogg", "audio/wav": ".wav",
        "audio/x-wav": ".wav", "audio/mpeg": ".mp3", "audio/mp4": ".m4a",
        "audio/aac": ".aac",
    }[payload.mimeType]
    path: str | None = None
    try:
        with tempfile.NamedTemporaryFile(prefix="medical-recognition-", suffix=suffix, delete=False) as temp:
            temp.write(data)
            path = temp.name
        if audio_duration(path) > MAX_AUDIO_SECONDS:
            raise HTTPException(status_code=413, detail=f"Audio exceeds {MAX_AUDIO_SECONDS} seconds")
        if not MODEL_LOCK.acquire(blocking=False):
            raise HTTPException(status_code=429, detail="Recognition worker is busy")
        try:
            segments, _ = get_whisper_model().transcribe(
                path,
                language="zh",
                beam_size=5,
                vad_filter=True,
            )
            text = "".join(segment.text for segment in segments).strip()
        finally:
            MODEL_LOCK.release()
        return {"text": text}
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=422, detail="Audio transcription failed") from None
    finally:
        if path:
            try:
                Path(path).unlink(missing_ok=True)
            except OSError:
                pass
