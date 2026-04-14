from pathlib import Path
import os

import numpy as np
import requests
from tensorflow.keras.models import load_model
from .features import extract_features

EMOTIONS = ["neutral", "calm", "happy", "sad", "angry", "fear", "disgust", "surprise"]
NEGATIVE_EMOTIONS = {"sad", "angry", "fear", "disgust"}
BASE_DIR = Path(__file__).resolve().parent.parent
MODEL_PATH = BASE_DIR / "models" / "emotion_model.h5"

model = None


def _ensure_model_file():
    if MODEL_PATH.exists():
        return True

    model_url = os.getenv("MODEL_URL", "").strip()
    if not model_url:
        return False

    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    response = requests.get(model_url, timeout=60)
    response.raise_for_status()
    MODEL_PATH.write_bytes(response.content)
    return True

def load_emotion_model():
    global model
    if _ensure_model_file() and MODEL_PATH.exists():
        model = load_model(MODEL_PATH)
    else:
        print(
            f"Warning: Model file not found at {MODEL_PATH}. "
            "Set MODEL_URL to a downloadable .h5 model file for deployment."
        )

def predict_emotion(file_path):
    if model is None:
        raise RuntimeError("Model not loaded. Train the model first using train_model.py")

    min_confidence = float(os.getenv("MIN_CONFIDENCE", "0.45"))
    features = extract_features(file_path)
    features = np.expand_dims(features, axis=0)
    prediction = model.predict(features, verbose=0)[0]

    top_index = int(np.argmax(prediction))
    top_confidence = float(prediction[top_index])
    raw_emotion = EMOTIONS[top_index]
    emotion = raw_emotion
    uncertain = top_confidence < min_confidence

    distress_score = 0.0
    for idx, label in enumerate(EMOTIONS):
        if label in NEGATIVE_EMOTIONS:
            distress_score += float(prediction[idx])

    calm_masking_risk = raw_emotion in {"calm", "neutral"} and distress_score >= 0.35

    if uncertain:
        emotion = "neutral"

    return {
        "emotion": emotion,
        "raw_emotion": raw_emotion,
        "confidence": round(top_confidence, 4),
        "uncertain": uncertain,
        "distress_score": round(distress_score, 4),
        "calm_masking_risk": calm_masking_risk,
    }