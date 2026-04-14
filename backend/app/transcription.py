from functools import lru_cache
import os

from faster_whisper import WhisperModel


@lru_cache(maxsize=1)
def _get_transcription_model():
    model_name = os.getenv("TRANSCRIPTION_MODEL", "base").strip() or "base"
    compute_type = os.getenv("TRANSCRIPTION_COMPUTE_TYPE", "int8").strip() or "int8"
    return WhisperModel(model_name, device="cpu", compute_type=compute_type)


def transcribe_audio(file_path):
    model = _get_transcription_model()
    segments, _info = model.transcribe(file_path, vad_filter=True)
    transcript = " ".join(segment.text.strip() for segment in segments if segment.text.strip())
    return transcript.strip()