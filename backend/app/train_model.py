from pathlib import Path

import librosa
import numpy as np
from sklearn.model_selection import train_test_split
from tensorflow.keras.layers import Dense, Dropout
from tensorflow.keras.models import Sequential
from tensorflow.keras.utils import to_categorical

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_PATH = BASE_DIR / "radvess" / "audio_speech_actors_01-24"
MODEL_PATH = BASE_DIR / "models" / "emotion_model.h5"

print("Current working directory:", Path.cwd())
print("Looking for dataset at:", DATA_PATH)
print("Exists?", DATA_PATH.exists())

EMOTIONS_MAP = {
    "01": "neutral",
    "02": "calm",
    "03": "happy",
    "04": "sad",
    "05": "angry",
    "06": "fear",
    "07": "disgust",
    "08": "surprise"
}

EMOTIONS = list(EMOTIONS_MAP.values())


def extract_features(file_path):
    audio, sr = librosa.load(file_path, duration=3, offset=0.5)
    mfcc = np.mean(librosa.feature.mfcc(y=audio, sr=sr, n_mfcc=40).T, axis=0)
    return mfcc


X, y = [], []

if not DATA_PATH.exists():
    raise FileNotFoundError(f"Dataset folder not found: {DATA_PATH}")

for file_path in DATA_PATH.rglob("*.wav"):
    file_name = file_path.name
    parts = file_name.split("-")
    if len(parts) < 3:
        continue

    emotion_code = parts[2]
    if emotion_code not in EMOTIONS_MAP:
        continue

    features = extract_features(str(file_path))

    X.append(features)
    y.append(EMOTIONS.index(EMOTIONS_MAP[emotion_code]))

if not X:
    raise ValueError(f"No audio samples found in {DATA_PATH}")

X = np.array(X)
y = to_categorical(y, num_classes=len(EMOTIONS))
print("Total samples:", len(X))

# Split
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2)

# Model
model = Sequential([
    Dense(256, activation='relu', input_shape=(40,)),
    Dropout(0.3),
    Dense(128, activation='relu'),
    Dropout(0.3),
    Dense(len(EMOTIONS), activation='softmax')
])

model.compile(loss='categorical_crossentropy', optimizer='adam', metrics=['accuracy'])

# Train
model.fit(X_train, y_train, epochs=50, batch_size=32, validation_data=(X_test, y_test))

# Save
MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
model.save(MODEL_PATH)

print("Model saved successfully!")