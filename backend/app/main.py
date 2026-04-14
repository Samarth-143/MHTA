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


def _build_gemini_contents(history, latest_message):
    contents = []

    for item in (history or [])[-12:]:
        text = str(item.get("text", "")).strip()
        if not text:
            continue

        role = str(item.get("role", "user")).lower()
        gemini_role = "model" if role == "assistant" else "user"
        contents.append({"role": gemini_role, "parts": [{"text": text}]})

    contents.append({"role": "user", "parts": [{"text": latest_message.strip()}]})
    return contents


@app.post("/chat/")
def chat_support(payload: ChatPayload):
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        raise HTTPException(status_code=503, detail="Gemini API key is missing on the server.")

    if not payload.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty.")

    configured_model = os.getenv("GEMINI_MODEL", "gemini-1.5-flash-latest").strip() or "gemini-1.5-flash-latest"
    configured_model = configured_model.removeprefix("models/")
    model_candidates = [
        configured_model,
        "gemini-1.5-flash-latest",
        "gemini-1.5-flash",
        "gemini-2.0-flash",
    ]

    body = {
        "system_instruction": {"parts": [{"text": SUPPORT_SYSTEM_PROMPT}]},
        "contents": _build_gemini_contents(payload.history, payload.message),
        "generationConfig": {
            "temperature": 0.4,
            "maxOutputTokens": 400,
        },
    }

    response = None
    payload_json = {}
    selected_model = None

    for model in dict.fromkeys(model_candidates):
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
        try:
            response = requests.post(url, json=body, timeout=45)
            payload_json = response.json()
        except Exception:
            continue

        if response.status_code < 400:
            selected_model = model
            break

        error_message = payload_json.get("error", {}).get("message", "")
        if "not found" in error_message.lower() or "not supported" in error_message.lower():
            continue

        raise HTTPException(status_code=502, detail=error_message or "Gemini request failed")

    if response is None or response.status_code >= 400:
        detail = payload_json.get("error", {}).get("message", "Gemini request failed")
        raise HTTPException(status_code=502, detail=detail)

    candidates = payload_json.get("candidates", [])
    if not candidates:
        raise HTTPException(status_code=502, detail="Chat service returned no response.")

    parts = candidates[0].get("content", {}).get("parts", [])
    reply = " ".join(str(part.get("text", "")).strip() for part in parts if part.get("text", "")).strip()

    if not reply:
        raise HTTPException(status_code=502, detail="Chat service returned an empty response.")

    return {"reply": reply, "model": selected_model or configured_model}


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