"""Download configured OCR and speech models into the persistent model volume."""

import os
import re
import sys
from pathlib import Path

if __name__ == "__main__":
    model_name = os.environ.get("WHISPER_MODEL", "base")
    safe_model_name = re.sub(r"[^A-Za-z0-9._-]", "_", model_name)
    model_dir = Path(os.environ.get("RECOGNITION_MODEL_DIR", "/models"))
    model_dir.mkdir(parents=True, exist_ok=True)
    ready_marker = model_dir / f".recognition-ready-{safe_model_name}"
    if "--check" in sys.argv:
        raise SystemExit(0 if ready_marker.is_file() else 1)

    from rapidocr_onnxruntime import RapidOCR
    from faster_whisper import WhisperModel

    RapidOCR()
    WhisperModel(
        model_name,
        device=os.environ.get("WHISPER_DEVICE", "cpu"),
        compute_type=os.environ.get("WHISPER_COMPUTE_TYPE", "int8"),
        download_root=str(model_dir / "whisper"),
    )
    ready_marker.touch()
    print(f"Recognition models are ready in {model_dir}")
