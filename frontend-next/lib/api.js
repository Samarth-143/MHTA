const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

async function parseResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json") ? await response.json() : await response.text();

  if (!response.ok) {
    const message = typeof payload === "string" ? payload : payload?.detail || payload?.message || "Request failed";
    throw new Error(message);
  }

  return payload;
}

export async function predictEmotion(file) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_BASE_URL}/predict/`, {
    method: "POST",
    body: formData,
  });

  return parseResponse(response);
}

export async function fetchHistory() {
  const response = await fetch(`${API_BASE_URL}/history/`, {
    method: "GET",
  });

  return parseResponse(response);
}

export async function clearHistory() {
  const response = await fetch(`${API_BASE_URL}/clear/`, {
    method: "DELETE",
  });

  return parseResponse(response);
}

export function emotionToScore(emotion) {
  const scores = {
    happy: 2,
    calm: 1,
    neutral: 0,
    surprise: 0.5,
    sad: -1,
    angry: -2,
    fear: -2,
    disgust: -2,
  };

  return scores[emotion] ?? 0;
}

export function smoothSeries(values, windowSize = 4) {
  if (values.length < windowSize) {
    return values;
  }

  const smoothed = [];

  for (let index = 0; index <= values.length - windowSize; index += 1) {
    const windowValues = values.slice(index, index + windowSize);
    const average = windowValues.reduce((sum, value) => sum + value, 0) / windowValues.length;
    smoothed.push(Number(average.toFixed(2)));
  }

  return smoothed;
}

export function getTrendTone(trend) {
  const toneMap = {
    "Mood improving": "positive",
    "Mood declining": "negative",
    Stable: "neutral",
    "Not enough data": "neutral",
  };

  return toneMap[trend] || "neutral";
}