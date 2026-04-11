from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
import shutil
import os
import sqlite3

from app.model import load_emotion_model, predict_emotion
from app.database import DB_PATH, init_db, insert_emotion, fetch_emotions
from app.trend import analyze_trend

app = FastAPI()


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

TEMP_DIR = "temp"
os.makedirs(TEMP_DIR, exist_ok=True)


@app.post("/predict/")
async def predict(file: UploadFile = File(...)):
    file_location = os.path.join(TEMP_DIR, file.filename)

    with open(file_location, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    emotion = predict_emotion(file_location)
    insert_emotion(emotion)

    history = fetch_emotions()
    emotions_only = [e[0] for e in history]

    trend = analyze_trend(emotions_only)

    return {
        "emotion": emotion,
        "trend": trend,
        "message": f"Your recent emotional pattern suggests: {trend}",
    }


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