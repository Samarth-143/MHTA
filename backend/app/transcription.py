from functools import lru_cache
import json
import os
from pathlib import Path
import subprocess
import wave

try:
    from faster_whisper import WhisperModel
except ModuleNotFoundError:
    WhisperModel = None

try:
    from vosk import KaldiRecognizer, Model
except ModuleNotFoundError:
    KaldiRecognizer = None
    Model = None


def _get_model_path(language):
    lang = (language or "en").strip().lower()
    by_lang_key = f"VOSK_MODEL_PATH_{lang.upper()}"
    configured = os.getenv(by_lang_key, "").strip() or os.getenv("VOSK_MODEL_PATH", "").strip()

    if configured and Path(configured).exists():
        return configured

    return ""


@lru_cache(maxsize=4)
def _get_vosk_model(language):
    if Model is None:
        return None

    model_path = _get_model_path(language)
    if not model_path:
        return None

    return Model(model_path)


@lru_cache(maxsize=4)
def _get_whisper_model(language):
    if WhisperModel is None:
        return None

    lang = (language or "en").strip().lower()
    default_model = "small.en" if lang == "en" else "small"
    model_name = os.getenv("TRANSCRIPTION_MODEL", default_model).strip() or default_model
    compute_type = os.getenv("TRANSCRIPTION_COMPUTE_TYPE", "int8").strip() or "int8"
    return WhisperModel(model_name, device="cpu", compute_type=compute_type)


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


def _transcribe_with_vosk(file_path, language):
    if KaldiRecognizer is None:
        return {"text": "", "status": "missing_dependency", "source": "vosk"}

    model = _get_vosk_model(language)
    if model is None:
        return {"text": "", "status": "missing_model", "source": "vosk"}

    source = Path(file_path)
    converted = source.with_suffix(".vosk.wav")

    try:
        subprocess.run(
            [
                "ffmpeg",
                "-y",
                "-i",
                str(source),
                "-ar",
                "16000",
                "-ac",
                "1",
                "-f",
                "wav",
                str(converted),
            ],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )

        with wave.open(str(converted), "rb") as wav_file:
            recognizer = KaldiRecognizer(model, wav_file.getframerate())
            recognizer.SetWords(False)

            chunks = []
            while True:
                data = wav_file.readframes(4000)
                if not data:
                    break

                if recognizer.AcceptWaveform(data):
                    part = json.loads(recognizer.Result()).get("text", "").strip()
                    if part:
                        chunks.append(part)

            final_part = json.loads(recognizer.FinalResult()).get("text", "").strip()
            if final_part:
                chunks.append(final_part)

        transcript = " ".join(chunks).strip()
        if not transcript:
            return {"text": "", "status": "no_speech_detected", "source": "vosk"}

        return {"text": transcript, "status": "ok", "source": "vosk"}
    finally:
        if converted.exists():
            converted.unlink()


def transcribe_audio(file_path, language="en"):
    engine = os.getenv("STT_ENGINE", "hybrid").strip().lower()

    if engine in {"whisper", "hybrid"}:
        try:
            whisper_result = _transcribe_with_whisper(file_path, language)
            if whisper_result.get("status") == "ok" or engine == "whisper":
                return whisper_result
        except Exception:
            if engine == "whisper":
                return {"text": "", "status": "whisper_error", "source": "whisper"}

    try:
        return _transcribe_with_vosk(file_path, language)
    except Exception:
        return {"text": "", "status": "vosk_error", "source": "vosk"}
