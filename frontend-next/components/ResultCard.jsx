import { motion } from "framer-motion";
import { BadgeCheck, Brain, CircleAlert, LoaderCircle } from "lucide-react";
import { getTrendTone } from "../lib/api";

const trendStyles = {
  positive: "border-emerald-400/20 bg-emerald-400/10 text-emerald-200",
  negative: "border-rose-400/20 bg-rose-400/10 text-rose-200",
  neutral: "border-amber-300/20 bg-amber-300/10 text-amber-100",
};

const trendIcons = {
  positive: BadgeCheck,
  negative: CircleAlert,
  neutral: Brain,
};

export default function ResultCard({ result, loading }) {
  const tone = result ? getTrendTone(result.trend) : "neutral";
  const TrendIcon = trendIcons[tone];

  return (
    <motion.section
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut", delay: 0.05 }}
      className="rounded-[2rem] border border-white/10 bg-white/6 p-6 shadow-soft backdrop-blur-2xl"
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium tracking-[0.2em] text-white/45 uppercase">Result</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">Emotion summary</h2>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/65">
            <LoaderCircle className="h-4 w-4 animate-spin text-cyan-200" />
            Processing
          </div>
        ) : null}
      </div>

      {!result ? (
        <div className="mt-6 rounded-[1.75rem] border border-white/10 bg-ink-950/35 p-6 text-sm text-white/58">
          Analyze an audio file to see the predicted emotion and mood trend here.
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
          className="mt-6 space-y-5"
        >
          <div className="rounded-[1.75rem] border border-white/10 bg-ink-950/30 p-6">
            <p className="text-xs uppercase tracking-[0.25em] text-white/38">Emotion</p>
            <p className="mt-3 text-4xl font-semibold text-white sm:text-5xl">{result.emotion}</p>
          </div>

          <div className={`flex items-start gap-4 rounded-[1.75rem] border p-5 ${trendStyles[tone]}`}>
            <div className="mt-0.5 rounded-2xl bg-white/10 p-3">
              <TrendIcon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.2em] opacity-80">Trend</p>
              <p className="mt-2 text-xl font-semibold">{result.trend}</p>
              <p className="mt-2 text-sm leading-6 opacity-85">{result.message}</p>
            </div>
          </div>
        </motion.div>
      )}
    </motion.section>
  );
}