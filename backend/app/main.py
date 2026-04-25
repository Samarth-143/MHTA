from fastapi import FastAPI, UploadFile, File, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
import shutil
import os
import sqlite3
from pathlib import Path
from pydantic import BaseModel
from openai import OpenAI

from .model import load_emotion_model, predict_emotion
from .transcription import transcribe_audio
from .database import DB_PATH, init_db, insert_emotion, fetch_emotions
from .trend import analyze_trend

app = FastAPI()

SUPPORT_SYSTEM_PROMPT = (
    "You are a calm, supportive mental wellness assistant. "
    "Listen empathetically, offer grounding suggestions, and avoid diagnosis. "
    "If the user expresses self-harm intent, strongly encourage immediate professional help and local emergency support."
)

NEGATIVE_TEXT_CUES = {
    "suicide", "kill myself", "want to die", "hopeless", "worthless", "depressed",
    "panic", "anxious", "can't cope", "hurt myself", "self harm", "alone", "empty",
}


def _build_allowed_origins():
    local_origins = [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:3002",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
        "http://127.0.0.1:3002",
    ]

    configured = os.getenv("CORS_ORIGINS", "")
    extra_origins = [origin.strip() for origin in configured.split(",") if origin.strip()]
    return local_origins + extra_origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=_build_allowed_origins(),
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

load_emotion_model()
init_db()

BASE_DIR = Path(__file__).resolve().parent.parent
TEMP_DIR = BASE_DIR / "temp"
os.makedirs(TEMP_DIR, exist_ok=True)


@app.get("/")
def root():
    return {"status": "ok", "service": "mhta-backend"}


@app.get("/health")
def health_check():
    return {"status": "healthy"}


def _analyze_text_risk(text):
    if not text:
        return {"score": 0.0, "matched": []}

    normalized = text.lower().strip()
    matched = [cue for cue in NEGATIVE_TEXT_CUES if cue in normalized]
    score = min(1.0, len(matched) / 3.0)
    return {"score": round(score, 4), "matched": matched}


class ChatPayload(BaseModel):
    message: str
    history: list[dict] = []


def _build_openai_messages(history, latest_message):
    messages = [{"role": "system", "content": SUPPORT_SYSTEM_PROMPT}]

    for item in (history or [])[-12:]:
        text = str(item.get("text", "")).strip()
        if not text:
            continue

        role = str(item.get("role", "user")).lower()
        openai_role = "assistant" if role == "assistant" else "user"
        messages.append({"role": openai_role, "content": text})

    messages.append({"role": "user", "content": latest_message.strip()})
    return messages


def _resolve_nvidia_base_url(base_url):
    cleaned = (base_url or "").strip().rstrip("/")
    if not cleaned:
        cleaned = "https://integrate.api.nvidia.com"

    if cleaned.endswith("/chat/completions"):
        cleaned = cleaned[: -len("/chat/completions")]

    if not cleaned.endswith("/v1"):
        cleaned = f"{cleaned}/v1"

    return cleaned


def _parse_bool_env(name, default=False):
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _extract_reply_text(message):
    if not message:
        return ""

    raw_content = getattr(message, "content", "")
    if isinstance(raw_content, str):
        text = raw_content.strip()
        if text:
            return text

    if isinstance(raw_content, list):
        parts = []
        for item in raw_content:
            if isinstance(item, dict):
                item_text = item.get("text") or item.get("content") or ""
                if isinstance(item_text, list):
                    item_text = "".join(str(x) for x in item_text)
                parts.append(str(item_text))
            else:
                item_text = getattr(item, "text", None)
                if item_text is None:
                    item_text = getattr(item, "content", "")
                parts.append(str(item_text or ""))
        text = "".join(parts).strip()
        if text:
            return text

    reasoning = getattr(message, "reasoning_content", "")
    return str(reasoning or "").strip()


def _resolve_model_candidates(primary_model):
    extras = os.getenv("NVIDIA_FALLBACK_MODELS", "").strip()
    candidates = [primary_model]

    if extras:
        candidates.extend(m.strip() for m in extras.split(",") if m.strip())

    unique = []
    for model in candidates:
        if model not in unique:
            unique.append(model)
    return unique


def _chat_with_nvidia(payload: ChatPayload):
    api_key = os.getenv("NVIDIA_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("NVIDIA API key is missing on the server.")

    model = os.getenv("NVIDIA_MODEL", "z-ai/glm4.7").strip() or "z-ai/glm4.7"
    model_candidates = _resolve_model_candidates(model)
    base_url = os.getenv("NVIDIA_BASE_URL", "https://integrate.api.nvidia.com").strip().rstrip("/")
    resolved_base_url = _resolve_nvidia_base_url(base_url)
    timeout_seconds = float(os.getenv("NVIDIA_TIMEOUT_SECONDS", "25"))
    retry_timeout_seconds = float(os.getenv("NVIDIA_TIMEOUT_RETRY_SECONDS", str(max(timeout_seconds + 20, 45))))
    max_tokens = int(os.getenv("NVIDIA_MAX_TOKENS", "300"))
    retry_max_tokens = int(os.getenv("NVIDIA_RETRY_MAX_TOKENS", str(min(max_tokens, 180))))
    enable_thinking = _parse_bool_env("NVIDIA_ENABLE_THINKING", default=False)
    base_messages = _build_openai_messages(payload.history, payload.message)

    last_error = None
    for candidate_model in model_candidates:
        request_template = {
            "model": candidate_model,
            "messages": base_messages,
            "temperature": 0.4,
            "stream": False,
        }
        if enable_thinking:
            request_template["extra_body"] = {"chat_template_kwargs": {"enable_thinking": True, "clear_thinking": False}}

        attempt_configs = [
            {"timeout": timeout_seconds, "max_tokens": max_tokens, "temperature": 0.4},
            {"timeout": retry_timeout_seconds, "max_tokens": retry_max_tokens, "temperature": 0.3},
        ]

        for idx, cfg in enumerate(attempt_configs, start=1):
            request_body = dict(request_template)
            request_body["max_tokens"] = cfg["max_tokens"]
            request_body["temperature"] = cfg["temperature"]

            client = OpenAI(base_url=resolved_base_url, api_key=api_key, timeout=cfg["timeout"], max_retries=1)

            try:
                response = client.chat.completions.create(**request_body)
                choices = getattr(response, "choices", []) or []
                if not choices:
                    last_error = f"{candidate_model} attempt {idx}: NVIDIA returned no response."
                    continue

                message = getattr(choices[0], "message", None)
                reply = _extract_reply_text(message)
                if not reply:
                    last_error = f"{candidate_model} attempt {idx}: NVIDIA returned an empty response."
                    continue

                return {"reply": reply, "provider": "nvidia", "model": candidate_model}
            except Exception as exc:
                last_error = f"{candidate_model} attempt {idx}: {exc}"

    raise RuntimeError(f"NVIDIA request failed: {last_error} (base_url: {resolved_base_url})")


@app.post("/chat/")
def chat_support(payload: ChatPayload):
    if not payload.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty.")

    try:
        return _chat_with_nvidia(payload)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"NVIDIA: {exc}") from exc


@app.post("/predict/")
async def predict(file: UploadFile = File(...), language: str = Form(default="auto")):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file received.")

    file_location = os.path.join(str(TEMP_DIR), file.filename)

    with open(file_location, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    try:
        prediction = predict_emotion(file_location)
        transcript = ""
        transcript_source = "unavailable"
        transcript_status = "unavailable"

        try:
            stt_result = transcribe_audio(file_location, language=language)
            transcript = stt_result.get("text", "")
            transcript_status = stt_result.get("status", "unavailable")
            transcript_source = stt_result.get("source", "unavailable")
        except Exception:
            transcript = ""
            transcript_source = "unavailable"
            transcript_status = "error"

        text_risk = _analyze_text_risk(transcript)

        emotion = prediction["emotion"]
        flagged = prediction["calm_masking_risk"] or text_risk["score"] >= 0.34
        flag_reason = ""

        if text_risk["score"] >= 0.34 and emotion in {"calm", "neutral"}:
            emotion = "sad"
            flag_reason = "Distressing language detected in transcript/text."
        elif prediction["calm_masking_risk"]:
            flag_reason = "Tone appears calm but model still shows elevated negative affect probability."

        insert_emotion(emotion)

        history = fetch_emotions()
        emotions_only = [e[0] for e in history]
        trend = analyze_trend(emotions_only)

        return {
            "emotion": emotion,
            "raw_emotion": prediction["raw_emotion"],
            "confidence": prediction["confidence"],
            "uncertain": prediction["uncertain"],
            "distress_score": prediction["distress_score"],
            "content_risk": text_risk["score"],
            "content_matches": text_risk["matched"],
            "transcript": transcript,
            "transcript_source": transcript_source,
            "transcript_language": language,
            "transcript_status": transcript_status,
            "flagged": flagged,
            "flag_reason": flag_reason,
            "trend": trend,
            "message": f"Your recent emotional pattern suggests: {trend}",
        }
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Audio processing failed: {exc}") from exc
    finally:
        if os.path.exists(file_location):
            os.remove(file_location)


@app.get("/history/")
def get_history():
    history = fetch_emotions()
    return {"history": history}


@app.delete("/clear/")
def clear_history():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("DELETE FROM emotions")
    conn.commit()
    conn.close()

    return {"message": "History cleared"}