"""Download configured OCR and speech models into the persistent model volume."""

import os
import re
import sys
from pathlib import Path

from rapidocr_onnxruntime import RapidOCR
from faster_whisper import WhisperModel


if __name__ == "__main__":
    model_name = os.environ.get("WHISPER_MODEL", "base")
    safe_model_name = re.sub(r"[^A-Za-z0-9._-]", "_", model_name)
    ready_marker = Path("/models") / f".recognition-ready-{safe_model_name}"
    if "--check" in sys.argv:
        raise SystemExit(0 if ready_marker.is_file() else 1)

    RapidOCR()
    WhisperModel(
        model_name,
        device=os.environ.get("WHISPER_DEVICE", "cpu"),
        compute_type=os.environ.get("WHISPER_COMPUTE_TYPE", "int8"),
        download_root="/models/whisper",
    )
    ready_marker.touch()
    print("Recognition models are ready in /models")
