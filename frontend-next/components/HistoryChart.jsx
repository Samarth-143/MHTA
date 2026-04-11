import { motion } from "framer-motion";
import { useMemo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { emotionToScore, smoothSeries } from "../lib/api";

const EMOTION_LABELS = {
  "2.5": "😊 Very Happy",
  "2": "😌 Happy",
  "1.5": "😐 Calm",
  "1": "😐 Neutral",
  "0": "😕 Sad",
  "-1": "😔 Very Sad",
};

const EMOTION_TICKS = [2, 1, 0, -1];

function buildChartData(history) {
  const emotions = history.map((item) => item?.[0] ?? item?.emotion ?? "neutral");
  const rawScores = emotions.map((emotion) => emotionToScore(emotion));
  const smoothScores = smoothSeries(rawScores, 4);

  return rawScores.map((value, index) => ({
    entry: index + 1,
    mood: index < smoothScores.length ? smoothScores[index] : null,
  }));
}

export default function HistoryChart({ history, loading }) {
  const chartData = useMemo(() => buildChartData(history), [history]);

  return (
    <motion.section
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.65, ease: "easeOut", delay: 0.08 }}
      className="rounded-[2rem] border border-white/10 bg-white/6 p-6 shadow-soft backdrop-blur-2xl"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium tracking-[0.2em] text-white/45 uppercase">Your Mood Journey</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">How your mood has changed</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/58">
            Watch your emotional trend as you record more voice samples.
          </p>
        </div>
      </div>

      <div className="mt-6 h-[320px] rounded-[1.75rem] border border-white/10 bg-ink-950/35 p-4">
        {loading ? (
          <div className="flex h-full items-center justify-center text-sm text-white/50">
            Loading mood history...
          </div>
        ) : chartData.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-white/50">
            No history yet. Analyze a clip to populate the graph.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 24, bottom: 8, left: 0 }}>
              <defs>
                <linearGradient id="moodLine" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#7ee0c0" stopOpacity={0.85} />
                  <stop offset="100%" stopColor="#7de7ff" stopOpacity={0.95} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
              <XAxis
                dataKey="entry"
                label={{ value: "Analysis Number", position: "insideBottomRight", offset: -5, fill: "rgba(255,255,255,0.45)", fontSize: 11 }}
                tick={{ fill: "rgba(255,255,255,0.55)", fontSize: 12 }}
                axisLine={{ stroke: "rgba(255,255,255,0.12)" }}
                tickLine={false}
              />
              <YAxis
                ticks={EMOTION_TICKS}
                tickFormatter={(value) => EMOTION_LABELS[value] || ""}
                tick={{ fill: "rgba(255,255,255,0.55)", fontSize: 11 }}
                axisLine={{ stroke: "rgba(255,255,255,0.12)" }}
                tickLine={false}
                domain={[-1.5, 2.5]}
                width={120}
              />
              <Tooltip
                contentStyle={{
                  background: "rgba(7,12,28,0.95)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 16,
                  color: "#fff",
                  padding: "12px 16px",
                }}
                labelStyle={{ color: "rgba(255,255,255,0.65)" }}
                formatter={(value) => {
                  if (value === null || value === undefined) return "";
                  const closestLabel = Object.keys(EMOTION_LABELS)
                    .map(Number)
                    .reduce((prev, curr) => Math.abs(curr - value) < Math.abs(prev - value) ? curr : prev);
                  return EMOTION_LABELS[String(closestLabel)] || value.toFixed(1);
                }}
              />
              <Line
                type="monotone"
                dataKey="mood"
                stroke="url(#moodLine)"
                strokeWidth={4}
                dot={{ r: 5, strokeWidth: 2, fill: "#0d1c2d", stroke: "#7ee0c0" }}
                activeDot={{ r: 7, stroke: "#fff", strokeWidth: 2 }}
                isAnimationActive
                animationDuration={900}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-white/60">
        <div className="rounded-lg bg-white/5 p-3">
          <p className="font-medium">📈 Trending Up?</p>
          <p className="mt-1 text-white/50">Your mood is improving</p>
        </div>
        <div className="rounded-lg bg-white/5 p-3">
          <p className="font-medium">📉 Trending Down?</p>
          <p className="mt-1 text-white/50">You might need support</p>
        </div>
      </div>
    </motion.section>
  );
}