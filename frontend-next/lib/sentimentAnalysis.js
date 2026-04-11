import Sentiment from "sentiment";

const analyzer = new Sentiment();

function buildResult(score, comparative, emptyMessage) {
  if (score > 1 || comparative > 0.15) {
    return {
      label: "Positive",
      tone: "text-emerald-200",
      detail: "Your writing sounds optimistic and steady.",
      score,
      comparative,
    };
  }

  if (score < -1 || comparative < -0.15) {
    return {
      label: "Needs Support",
      tone: "text-rose-200",
      detail: "Your writing suggests emotional strain today.",
      score,
      comparative,
    };
  }

  return {
    label: "Neutral",
    tone: "text-amber-100",
    detail: emptyMessage || "Your writing appears balanced overall.",
    score,
    comparative,
  };
}

export function analyzeSentimentText(text, options = {}) {
  const normalized = (text || "").trim();
  if (!normalized) {
    return {
      label: "No sentiment yet",
      tone: "text-white/60",
      detail: options.emptyDetail || "Start writing to see sentiment.",
      score: 0,
      comparative: 0,
    };
  }

  const result = analyzer.analyze(normalized);
  return buildResult(result.score, result.comparative, "Your writing appears balanced overall.");
}

export function analyzeSentimentEntries(entries) {
  const combined = (entries || []).filter(Boolean).join(" ").trim();
  if (!combined) {
    return null;
  }

  const result = analyzer.analyze(combined);
  return buildResult(result.score, result.comparative, "Your writing appears balanced overall.");
}
