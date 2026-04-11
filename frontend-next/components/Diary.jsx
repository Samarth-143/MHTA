import { motion } from "framer-motion";
import { useState } from "react";
import { analyzeSentimentText } from "../lib/sentimentAnalysis";

export default function Diary({ value, onChange, onSave }) {
  const [savedSentiment, setSavedSentiment] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  async function handleSaveClick() {
    const currentText = (value || "").trim();
    if (!currentText) {
      return;
    }

    const sentimentSnapshot = analyzeSentimentText(currentText, {
      emptyDetail: "Start writing to see sentiment.",
    });
    setIsSaving(true);

    try {
      await Promise.resolve(onSave?.());
      setSavedSentiment(sentimentSnapshot);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut", delay: 0.12 }}
      className="rounded-[2rem] border border-white/10 bg-white/6 p-6 shadow-soft backdrop-blur-2xl"
    >
      <div className="rounded-[1.75rem] border border-white/10 bg-ink-950/35 p-4">
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Welcome back! How are you feeling today? Want to jot down some thoughts or feelings?"
          className="mt-4 min-h-[180px] w-full resize-none rounded-3xl border border-white/10 bg-white/5 px-4 py-4 text-sm leading-6 text-white outline-none placeholder:text-white/28 focus:border-cyan-300/40 focus:ring-2 focus:ring-cyan-300/15"
        />

        {savedSentiment ? (
          <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-white/55">Sentiment (last saved entry)</p>
            <p className={`mt-2 text-sm font-semibold ${savedSentiment.tone}`}>{savedSentiment.label}</p>
            <p className="mt-1 text-sm text-white/70">{savedSentiment.detail}</p>
          </div>
        ) : null}

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={handleSaveClick}
            disabled={isSaving || !(value || "").trim()}
            className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-ink-950 transition hover:bg-mist-100 disabled:cursor-not-allowed disabled:opacity-65"
          >
            {isSaving ? "Saving..." : "Save Entry"}
          </button>
        </div>
      </div>
    </motion.section>
  );
}