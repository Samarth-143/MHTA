export async function analyzeDiarySentiment(text) {
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

  const res = await fetch(`${backendUrl}/sentiment/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });

  if (!res.ok) {
    const maybe = await res.json().catch(() => ({}));
    throw new Error(maybe?.detail || `Sentiment request failed: ${res.status}`);
  }

  return res.json();
}

