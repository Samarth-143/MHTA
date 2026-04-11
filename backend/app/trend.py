from collections import Counter

EMOTION_SCORES = {
    "happy": 2,
    "calm": 1,
    "neutral": 0,
    "sad": -1,
    "angry": -2,
    "fear": -2,
    "disgust": -2,
    "surprise": 0
}

WINDOW_SIZE = 5

def analyze_trend(emotions):
    if len(emotions) < 3:
        return "Not enough data"

    recent = emotions[-WINDOW_SIZE:]
    baseline = emotions[:-WINDOW_SIZE] if len(emotions) > WINDOW_SIZE else emotions

    recent_score = sum([EMOTION_SCORES[e] for e in recent]) / len(recent)
    baseline_score = sum([EMOTION_SCORES[e] for e in baseline]) / len(baseline)

    delta = recent_score - baseline_score

    if delta < -0.5:
        return "Mood declining"
    elif delta > 0.5:
        return "Mood improving"
    else:
        return "Stable"