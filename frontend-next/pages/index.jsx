import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { BotMessageSquare, CheckCircle2, RefreshCcw } from "lucide-react";
import { useRouter } from "next/router";

import Navbar from "../components/Navbar";
import Hero from "../components/Hero";
import SidePanel from "../components/SidePanel";
import UploadCard from "../components/UploadCard";
import ResultCard from "../components/ResultCard";
import HistoryChart from "../components/HistoryChart";
import ConfirmModal from "../components/ConfirmModal";
import { clearHistory, fetchHistory, predictEmotion } from "../lib/api";
import { getAffirmationForDate } from "../lib/affirmations";
import { supabase } from "../lib/supabaseClient";
import { clearVoiceAnalysisFiles, uploadVoiceAnalysis } from "../lib/supabaseStorage";

function AuthGate({ onAuthenticated }) {
  const [mode, setMode] = useState("signin");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      if (mode === "signup") {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              username: username.trim(),
            },
          },
        });

        if (signUpError) {
          throw signUpError;
        }

        if (data.session?.user) {
          onAuthenticated(data.session.user);
        } else {
          setError("Signup successful. Verify your email if confirmation is enabled, then sign in.");
          setMode("signin");
        }
      } else {
        const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });

        if (signInError) {
          throw signInError;
        }

        if (data.user) {
          onAuthenticated(data.user);
        }
      }
    } catch (authError) {
      setError(authError.message || "Authentication failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-hero-radial px-4 py-16 text-white sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-xl rounded-[2rem] border border-white/10 bg-white/6 p-8 shadow-soft backdrop-blur-2xl">
        <p className="text-sm font-medium tracking-[0.2em] text-white/45 uppercase">Supabase Authorization</p>
        <h1 className="mt-3 text-3xl font-semibold text-white">
          {mode === "signup" ? "Create your account" : "Sign in to your workspace"}
        </h1>
        <p className="mt-2 text-sm text-white/58">
          Each user gets separate diary and voice-analysis folders in Supabase Storage.
        </p>

        <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
          {mode === "signup" ? (
            <div>
              <label className="mb-2 block text-xs uppercase tracking-[0.18em] text-white/50">Username</label>
              <input
                type="text"
                required
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-cyan-300/45"
                placeholder="samarth"
              />
            </div>
          ) : null}

          <div>
            <label className="mb-2 block text-xs uppercase tracking-[0.18em] text-white/50">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-cyan-300/45"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="mb-2 block text-xs uppercase tracking-[0.18em] text-white/50">Password</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-cyan-300/45"
              placeholder="••••••••"
            />
          </div>

          {error ? <p className="text-sm text-amber-200">{error}</p> : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-white px-5 py-3 text-sm font-semibold text-ink-950 transition hover:bg-mist-100 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? "Please wait..." : mode === "signup" ? "Create account" : "Sign in"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            setMode((prevMode) => (prevMode === "signup" ? "signin" : "signup"));
            setError("");
          }}
          className="mt-4 text-sm text-cyan-200 transition hover:text-cyan-100"
        >
          {mode === "signup" ? "Already have an account? Sign in" : "New here? Create account"}
        </button>
      </div>
    </div>
  );
}

function Toast({ toast }) {
  return (
    <AnimatePresence>
      {toast ? (
        <motion.div
          initial={{ opacity: 0, y: 18, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.98 }}
          className={`fixed bottom-5 right-5 z-50 max-w-sm rounded-3xl border px-4 py-3 shadow-soft backdrop-blur-xl ${
            toast.type === "error"
              ? "border-rose-400/20 bg-rose-500/15 text-rose-100"
              : "border-emerald-400/20 bg-emerald-500/15 text-emerald-50"
          }`}
        >
          <div className="flex items-start gap-3">
            {toast.type === "error" ? <BotMessageSquare className="mt-0.5 h-5 w-5" /> : <CheckCircle2 className="mt-0.5 h-5 w-5" />}
            <div>
              <p className="text-sm font-semibold">{toast.title}</p>
              <p className="mt-1 text-sm leading-5 opacity-90">{toast.message}</p>
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export default function HomePage() {
  const router = useRouter();
  const analysisRef = useRef(null);
  const toastTimerRef = useRef(null);
  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [todayAffirmation, setTodayAffirmation] = useState("");

  const username = user?.user_metadata?.username || user?.email?.split("@")[0] || "user";

  const trendCounts = useMemo(() => {
    const counts = { positive: 0, negative: 0, neutral: 0 };

    history.forEach((entry) => {
      const emotion = entry?.[0] ?? entry?.emotion ?? "neutral";
      if (["happy", "calm", "surprise"].includes(emotion)) counts.positive += 1;
      else if (["sad", "angry", "fear", "disgust"].includes(emotion)) counts.negative += 1;
      else counts.neutral += 1;
    });

    return counts;
  }, [history]);

  useEffect(() => {
    let isMounted = true;

    async function initializeAuth() {
      const { data } = await supabase.auth.getSession();
      if (!isMounted) {
        return;
      }

      setUser(data.session?.user || null);
      setAuthReady(true);
    }

    initializeAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
      setAuthReady(true);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
      window.clearTimeout(toastTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (user) {
      loadHistory();
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      return;
    }

    try {
      const data = getAffirmationForDate();
      setTodayAffirmation(data.affirmation || "");
    } catch {
      setTodayAffirmation("");
    }
  }, [user]);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  async function loadHistory() {
    setIsHistoryLoading(true);
    try {
      const response = await fetchHistory();
      setHistory(response.history || []);
    } catch (error) {
      setToast({
        type: "error",
        title: "History unavailable",
        message: error.message,
      });
    } finally {
      setIsHistoryLoading(false);
    }
  }

  function showToast(type, title, message) {
    setToast({ type, title, message });
    window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 3200);
  }

  function handleFileChange(file) {
    if (!file) {
      return;
    }

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setResult(null);
  }

  function handleRemoveFile() {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setSelectedFile(null);
    setPreviewUrl("");
  }

  async function handleAnalyze() {
    if (!selectedFile) {
      showToast("error", "No file selected", "Upload an audio file before starting analysis.");
      return;
    }

    setIsAnalyzing(true);

    try {
      const response = await predictEmotion(selectedFile);
      setResult(response);

      try {
        await uploadVoiceAnalysis(user, selectedFile, response);
      } catch (uploadError) {
        showToast("error", "Storage upload failed", uploadError.message);
      }

      await loadHistory();
      showToast("success", "Analysis complete", "Emotion and trend updated successfully.");
    } catch (error) {
      showToast("error", "Analysis failed", error.message);
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function handleClearHistory() {
    try {
      await clearHistory();
      await clearVoiceAnalysisFiles(user);
      setHistory([]);
      setResult(null);
      setIsClearModalOpen(false);
      showToast("success", "History cleared", "Mood history and saved analysis files were removed.");
    } catch (error) {
      setIsClearModalOpen(false);
      showToast("error", "Could not clear history", error.message);
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    setResult(null);
    setHistory([]);
    setSelectedFile(null);
    showToast("success", "Signed out", "You have been signed out.");
  }

  function scrollToAnalysis() {
    analysisRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (!authReady) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-hero-radial px-4 py-16 text-white sm:px-6 lg:px-8">
        <div className="mx-auto max-w-xl rounded-[2rem] border border-white/10 bg-white/6 p-8 text-center shadow-soft backdrop-blur-2xl">
          Loading authentication...
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthGate onAuthenticated={setUser} />;
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-hero-radial text-white">
      <div className="pointer-events-none absolute inset-0 opacity-70">
        <div className="absolute left-[-4rem] top-[-4rem] h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl animate-floatSlow" />
        <div className="absolute right-[-6rem] top-40 h-80 w-80 rounded-full bg-violet-500/12 blur-3xl animate-floatSlow [animation-delay:1.2s]" />
        <div className="absolute bottom-[-5rem] left-1/3 h-80 w-80 rounded-full bg-emerald-400/8 blur-3xl animate-pulseSoft" />
      </div>

      <Navbar username={username} onSignOut={handleSignOut} />

      <main className="relative z-10">
        <div className="mx-auto grid w-full max-w-7xl gap-6 px-4 pt-6 sm:px-6 lg:grid-cols-[auto_1fr] lg:px-8">
          <SidePanel
            activeSection="analyzer"
            includeDiary={true}
            includeCalendar={true}
            onSectionChange={(section) => {
              if (section === "analyzer") {
                scrollToAnalysis();
              }
              if (section === "diary") {
                router.push("/diary");
              }
              if (section === "calendar") {
                router.push("/calendar");
              }
            }}
          />

          <div>
            {todayAffirmation ? (
              <section className="pb-4">
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.55, ease: "easeOut", delay: 0.05 }}
                  className="rounded-[2rem] border border-emerald-300/25 bg-emerald-400/10 p-6 shadow-soft backdrop-blur-2xl"
                >
                  <p className="text-xs uppercase tracking-[0.22em] text-emerald-100/70">Affirmation of the day</p>
                  <p className="mt-3 text-lg font-medium leading-8 text-emerald-50">{todayAffirmation}</p>
                </motion.div>
              </section>
            ) : null}

            <Hero onStartAnalysis={scrollToAnalysis} />

            <section ref={analysisRef} className="grid gap-6 pb-6 lg:grid-cols-[1.05fr_0.95fr]">
              <div className="space-y-6">
                <UploadCard
                  file={selectedFile}
                  previewUrl={previewUrl}
                  isLoading={isAnalyzing}
                  onFileChange={handleFileChange}
                  onRemoveFile={handleRemoveFile}
                  onAnalyze={handleAnalyze}
                />

                <ResultCard result={result} loading={isAnalyzing} />
              </div>

              <div className="space-y-6">
                <HistoryChart history={history} loading={isHistoryLoading} />

                <motion.section
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, ease: "easeOut", delay: 0.12 }}
                  className="rounded-[2rem] border border-white/10 bg-white/6 p-6 shadow-soft backdrop-blur-2xl"
                >
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium tracking-[0.2em] text-white/45 uppercase">History actions</p>
                      <h2 className="mt-2 text-2xl font-semibold text-white">Manage mood records</h2>
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsClearModalOpen(true)}
                      className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-white/10"
                    >
                      <RefreshCcw className="h-4 w-4" />
                      Clear History
                    </button>
                  </div>

                  <div className="mt-6 grid gap-4 sm:grid-cols-3">
                    <div className="rounded-3xl border border-white/10 bg-ink-950/35 p-4">
                      <p className="text-xs uppercase tracking-[0.22em] text-white/35">Positive</p>
                      <p className="mt-3 text-3xl font-semibold text-emerald-200">{trendCounts.positive}</p>
                    </div>
                    <div className="rounded-3xl border border-white/10 bg-ink-950/35 p-4">
                      <p className="text-xs uppercase tracking-[0.22em] text-white/35">Neutral</p>
                      <p className="mt-3 text-3xl font-semibold text-amber-100">{trendCounts.neutral}</p>
                    </div>
                    <div className="rounded-3xl border border-white/10 bg-ink-950/35 p-4">
                      <p className="text-xs uppercase tracking-[0.22em] text-white/35">Negative</p>
                      <p className="mt-3 text-3xl font-semibold text-rose-200">{trendCounts.negative}</p>
                    </div>
                  </div>
                </motion.section>
                </div>
            </section>
          </div>
        </div>
      </main>

      <div className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
        <motion.footer
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, ease: "easeOut", delay: 0.25 }}
          className="flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-6 text-sm text-white/48"
        >
          <p>Built for calming voice analytics.</p>
          <p>Connected to FastAPI backend at 127.0.0.1:8000</p>
        </motion.footer>
      </div>

      <ConfirmModal
        open={isClearModalOpen}
        title="Clear mood history?"
        description="This will permanently remove all stored emotional records from the local database."
        confirmLabel="Yes, clear history"
        onCancel={() => setIsClearModalOpen(false)}
        onConfirm={handleClearHistory}
      />

      <Toast toast={toast} />
    </div>
  );
}