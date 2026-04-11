import { motion } from "framer-motion";
import { Sparkles, Calendar } from "lucide-react";
import Link from "next/link";

export default function Navbar({ username, onSignOut }) {
  return (
    <motion.header
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: "easeOut" }}
      className="sticky top-0 z-40 border-b border-white/10 bg-ink-950/55 backdrop-blur-xl"
    >
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/8 shadow-glow ring-1 ring-white/10">
            <Sparkles className="h-5 w-5 text-accent-cyan" />
          </div>
          <div>
            <p className="text-sm font-semibold tracking-[0.22em] text-white/80 uppercase">
              MindWave
            </p>
            <p className="text-xs text-white/45">Mental health trend analysis</p>
          </div>
        </div>

        <div className="hidden items-center gap-3 sm:flex">
          <div className="items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-white/70 md:flex">
            <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_14px_rgba(74,222,128,0.8)]" />
            Backend connected to 127.0.0.1:8000
          </div>

          {username ? (
            <>
              <Link href="/calendar">
                <button
                  type="button"
                  className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-white/80 transition hover:bg-white/10"
                >
                  <Calendar size={14} />
                  <span>Calendar</span>
                </button>
              </Link>
              <div className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/75">
                @{username}
              </div>
              <button
                type="button"
                onClick={onSignOut}
                className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-white/80 transition hover:bg-white/10"
              >
                Sign out
              </button>
            </>
          ) : null}
        </div>
      </div>
    </motion.header>
  );
}