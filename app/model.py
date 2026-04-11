from pathlib import Path

import numpy as np
from tensorflow.keras.models import load_model
from app.features import extract_features

EMOTIONS = ["neutral", "calm", "happy", "sad", "angry", "fear", "disgust", "surprise"]
BASE_DIR = Path(__file__).resolve().parent.parent
MODEL_PATH = BASE_DIR / "models" / "emotion_model.h5"

model = None

def load_emotion_model():
    global model
    if MODEL_PATH.exists():
        model = load_model(MODEL_PATH)
    else:
        print(f"Warning: Model file not found at {MODEL_PATH}. Train the model first using train_model.py")

def predict_emotion(file_path):
    if model is None:
        raise RuntimeError("Model not loaded. Train the model first using train_model.py")
    features = extract_features(file_path)
    features = np.expand_dims(features, axis=0)
    prediction = model.predict(features)
    return EMOTIONS[np.argmax(prediction)]