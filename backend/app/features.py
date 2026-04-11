import librosa
import numpy as np


def extract_features(file_path):
    audio, sample_rate = librosa.load(file_path, duration=3, offset=0.5, mono=True)
    audio, _ = librosa.effects.trim(audio, top_db=25)

    if audio.size == 0:
        raise ValueError("No valid speech segment found in the audio clip.")

    peak = np.max(np.abs(audio))
    if peak > 0:
        audio = audio / peak

    mfccs = np.mean(librosa.feature.mfcc(y=audio, sr=sample_rate, n_mfcc=40).T, axis=0)
    return mfccs
