from functools import lru_cache
import os

try:
    from faster_whisper import WhisperModel
except ModuleNotFoundError:
    WhisperModel = None

@lru_cache(maxsize=4)
def _get_whisper_model(language):
    if WhisperModel is None:
        return None

    model_name = os.getenv("TRANSCRIPTION_MODEL", "small").strip() or "small"
    compute_type = os.getenv("TRANSCRIPTION_COMPUTE_TYPE", "int8").strip() or "int8"
    download_root = os.getenv("WHISPER_DOWNLOAD_ROOT", "/opt/whisper-cache").strip() or "/opt/whisper-cache"
    local_files_only = os.getenv("TRANSCRIPTION_LOCAL_FILES_ONLY", "true").strip().lower() == "true"
    return WhisperModel(
        model_name,
        device="cpu",
        compute_type=compute_type,
        download_root=download_root,
        local_files_only=local_files_only,
    )


def _transcribe_with_whisper(file_path, language):
    model = _get_whisper_model(language)
    if model is None:
        return {"text": "", "status": "missing_whisper", "source": "whisper"}

    lang = (language or "en").strip().lower()
    whisper_lang = None if lang in {"", "auto"} else lang

    segments, _ = model.transcribe(file_path, language=whisper_lang, vad_filter=True, beam_size=1)
    transcript = " ".join(segment.text.strip() for segment in segments if segment.text.strip()).strip()
    if not transcript:
        return {"text": "", "status": "no_speech_detected", "source": "whisper"}

    return {"text": transcript, "status": "ok", "source": "whisper"}


def transcribe_audio(file_path, language="en"):
    try:
        whisper_result = _transcribe_with_whisper(file_path, language)
        if whisper_result.get("status") == "ok":
            return whisper_result
        return whisper_result
    except Exception:
        return {"text": "", "status": "whisper_error", "source": "whisper"}
