"""Download configured OCR and speech models into the persistent model volume."""

import os

from rapidocr_onnxruntime import RapidOCR
from faster_whisper import WhisperModel


if __name__ == "__main__":
    RapidOCR()
    WhisperModel(
        os.environ.get("WHISPER_MODEL", "base"),
        device=os.environ.get("WHISPER_DEVICE", "cpu"),
        compute_type=os.environ.get("WHISPER_COMPUTE_TYPE", "int8"),
        download_root="/models/whisper",
    )
    print("Recognition models are ready in /models")
