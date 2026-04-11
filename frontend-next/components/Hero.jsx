import { motion } from "framer-motion";
import { ArrowDownRight, HeartPulse, Mic2, Sparkles } from "lucide-react";

export default function Hero({ onStartAnalysis }) {
  return (
    <section className="relative overflow-hidden px-4 pb-10 pt-14 sm:px-6 lg:px-8 lg:pb-14 lg:pt-20">
      <div className="mx-auto grid w-full max-w-7xl gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="relative z-10 max-w-3xl"
        >
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/6 px-4 py-2 text-sm text-white/75 shadow-soft">
            <HeartPulse className="h-4 w-4 text-accent-cyan" />
            Private, calming, voice-based mood tracking
          </div>

          <h1 className="max-w-none text-5xl font-semibold tracking-tight text-white sm:text-6xl lg:text-6xl lg:whitespace-nowrap xl:text-7xl">
            Mental Health Trend Analyzer
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-white/68 sm:text-xl">
            Understand your emotional patterns through voice
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-4">
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.98 }}
              onClick={onStartAnalysis}
              className="inline-flex items-center gap-3 rounded-full bg-white px-6 py-3.5 text-sm font-semibold text-ink-950 shadow-lg shadow-cyan-500/10 transition hover:bg-mist-100"
            >
              Start Analysis
              <ArrowDownRight className="h-4 w-4" />
            </motion.button>

            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70">
              <Mic2 className="h-4 w-4 text-accent-violet" />
              Audio upload, mood insight, trend history
            </div>
          </div>

          <div className="mt-10 flex items-center gap-3 text-sm text-white/55">
            <Sparkles className="h-4 w-4 text-accent-cyan" />
            
          </div>
        </motion.div>

      </div>
    </section>
  );
}