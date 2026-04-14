from functools import lru_cache
import json
import os
from pathlib import Path
import subprocess
import wave

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
def _get_transcription_model(language):
    if Model is None:
        return None

    model_path = _get_model_path(language)
    if not model_path:
        return None

    return Model(model_path)


def transcribe_audio(file_path, language="en"):
    if KaldiRecognizer is None:
        return ""

    model = _get_transcription_model(language)
    if model is None:
        return ""

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

        return " ".join(chunks).strip()
    finally:
        if converted.exists():
            converted.unlink()