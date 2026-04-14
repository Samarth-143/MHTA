from fastapi import FastAPI, UploadFile, File, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
import shutil
import os
import sqlite3
from pathlib import Path
import requests
from pydantic import BaseModel

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


def _chat_with_openai(payload: ChatPayload):
    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("OpenAI API key is missing on the server.")

    model = os.getenv("OPENAI_MODEL", "gpt-4o-mini").strip() or "gpt-4o-mini"
    body = {
        "model": model,
        "messages": _build_openai_messages(payload.history, payload.message),
        "temperature": 0.4,
        "max_tokens": 400,
    }
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    try:
        response = requests.post("https://api.openai.com/v1/chat/completions", headers=headers, json=body, timeout=45)
        payload_json = response.json()
    except Exception as exc:
        raise RuntimeError(f"OpenAI request failed: {exc}") from exc

    if response.status_code >= 400:
        detail = payload_json.get("error", {}).get("message", "OpenAI request failed")
        raise RuntimeError(detail)

    choices = payload_json.get("choices", [])
    if not choices:
        raise RuntimeError("OpenAI returned no response.")

    reply = str(choices[0].get("message", {}).get("content", "")).strip()
    if not reply:
        raise RuntimeError("OpenAI returned an empty response.")

    return {"reply": reply, "provider": "openai", "model": model}


@app.post("/chat/")
def chat_support(payload: ChatPayload):
    if not payload.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty.")

    try:
        return _chat_with_openai(payload)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"OpenAI: {exc}") from exc


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