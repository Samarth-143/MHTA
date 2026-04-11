import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/router";

import Navbar from "../components/Navbar";
import SidePanel from "../components/SidePanel";
import { getAffirmationForDate } from "../lib/affirmations";
import { analyzeSentimentEntries } from "../lib/sentimentAnalysis";
import { supabase } from "../lib/supabaseClient";
import { fetchHistory } from "../lib/api";
import { deleteDiaryEntryFile } from "../lib/supabaseStorage";

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year, month) {
  return new Date(year, month, 1).getDay();
}

const EMOTION_COLORS = {
  neutral: "bg-slate-500/30 border-slate-400",
  calm: "bg-blue-500/30 border-blue-400",
  happy: "bg-yellow-400/30 border-yellow-300",
  sad: "bg-red-500/30 border-red-400",
  angry: "bg-orange-500/30 border-orange-400",
  fear: "bg-purple-500/30 border-purple-400",
  disgust: "bg-green-500/30 border-green-400",
  surprise: "bg-cyan-500/30 border-cyan-400",
};

const EMOTION_EMOJI = {
  neutral: "😐",
  calm: "😌",
  happy: "😊",
  sad: "😢",
  angry: "😠",
  fear: "😨",
  disgust: "🤢",
  surprise: "😲",
};

const BUCKET_NAME = process.env.NEXT_PUBLIC_SUPABASE_BUCKET || "mhva-user-data";

function sanitizeSegment(value) {
  return (value || "user")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "user";
}

function getUserFolder(user) {
  const userName = user?.user_metadata?.username || user?.email?.split("@")[0] || user?.id || "user";
  return sanitizeSegment(userName);
}

export default function CalendarPage() {
  const router = useRouter();
  const today = new Date();
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [history, setHistory] = useState([]);
  const [selectedDate, setSelectedDate] = useState(() => today.getDate());
  const [selectedEmotions, setSelectedEmotions] = useState([]);
  const [selectedAffirmation, setSelectedAffirmation] = useState("");
  const [selectedDiaryEntries, setSelectedDiaryEntries] = useState([]);
  const [selectedDiarySentiment, setSelectedDiarySentiment] = useState(null);
  const [isDiaryLoading, setIsDiaryLoading] = useState(false);
  const [deletingDiaryFile, setDeletingDiaryFile] = useState("");
  const [loading, setLoading] = useState(true);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  function isFutureDay(day) {
    const candidate = new Date(year, month, day);
    const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
    return candidate.getTime() > endOfToday.getTime();
  }

  // Auth setup
  useEffect(() => {
    async function checkAuth() {
      const { data } = await supabase.auth.getSession();
      setUser(data?.session?.user || null);
      setAuthReady(true);
    }

    checkAuth();

    const { data: authListener } = supabase.auth.onAuthStateChange(() => {
      checkAuth();
    });

    return () => authListener?.subscription.unsubscribe();
  }, []);

  // Load mood history
  useEffect(() => {
    async function loadHistory() {
      if (!user) return;
      setLoading(true);
      try {
        const data = await fetchHistory();
        // Ensure data is an array
        const historyData = Array.isArray(data) ? data : (data?.data ? (Array.isArray(data.data) ? data.data : []) : []);
        setHistory(historyData);
      } catch (error) {
        console.error("Error loading history:", error);
        setHistory([]);
      } finally {
        setLoading(false);
      }
    }

    if (authReady && user) {
      loadHistory();
    }
  }, [user, authReady]);

  useEffect(() => {
    if (!selectedDate) {
      setSelectedAffirmation("");
      return;
    }

    if (isFutureDay(selectedDate)) {
      setSelectedAffirmation("");
      return;
    }

    const dateString = `${year}-${String(month + 1).padStart(2, "0")}-${String(selectedDate).padStart(2, "0")}`;

    try {
      const data = getAffirmationForDate(dateString);
      setSelectedAffirmation(data.affirmation || "");
    } catch {
      setSelectedAffirmation("");
    }
  }, [selectedDate, month, year]);

  // Group emotions by date
  const emotionsByDate = useMemo(() => {
    const grouped = {};
    
    // Ensure history is an array
    const historyArray = Array.isArray(history) ? history : [];
    
    historyArray.forEach((emotion) => {
      if (!emotion) return;
      const emotionName = (emotion[0] || emotion.emotion || "neutral").toLowerCase();
      const today = new Date().toISOString().split("T")[0];
      const dateKey = today; // In a real app, you'd store timestamps with emotions

      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(emotionName);
    });
    return grouped;
  }, [history]);

  useEffect(() => {
    if (!selectedDate) {
      setSelectedEmotions([]);
      return;
    }

    if (isFutureDay(selectedDate)) {
      setSelectedEmotions([]);
      return;
    }

    const dateString = `${year}-${String(month + 1).padStart(2, "0")}-${String(selectedDate).padStart(2, "0")}`;
    setSelectedEmotions(emotionsByDate[dateString] || []);
  }, [selectedDate, month, year, emotionsByDate]);

  useEffect(() => {
    if (!user || !selectedDate || isFutureDay(selectedDate)) {
      setSelectedDiaryEntries([]);
      setSelectedDiarySentiment(null);
      return;
    }

    const dateString = `${year}-${String(month + 1).padStart(2, "0")}-${String(selectedDate).padStart(2, "0")}`;

    async function loadDiaryForDate() {
      setIsDiaryLoading(true);

      try {
        const userFolder = getUserFolder(user);
        const diaryFolder = `${userFolder}/diary`;

        const { data: fileList, error: listError } = await supabase.storage
          .from(BUCKET_NAME)
          .list(diaryFolder, { limit: 200, sortBy: { column: "name", order: "desc" } });

        if (listError) {
          throw listError;
        }

        const dayFiles = (fileList || []).filter((file) => file?.name?.startsWith(dateString));

        if (!dayFiles.length) {
          setSelectedDiaryEntries([]);
          setSelectedDiarySentiment(null);
          return;
        }

        const downloads = await Promise.all(
          dayFiles.map(async (file) => {
            const path = `${diaryFolder}/${file.name}`;
            const { data: blob, error: downloadError } = await supabase.storage.from(BUCKET_NAME).download(path);

            if (downloadError || !blob) {
              return null;
            }

            try {
              const raw = await blob.text();
              if (file.name.toLowerCase().endsWith(".txt")) {
                const text = raw.trim();
                return text ? { fileName: file.name, text } : null;
              }

              const parsed = JSON.parse(raw);
              const parsedText = typeof parsed?.entry === "string" ? parsed.entry.trim() : raw.trim();
              return parsedText ? { fileName: file.name, text: parsedText } : null;
            } catch {
              return null;
            }
          }),
        );

        const entries = downloads.filter(Boolean);
        setSelectedDiaryEntries(entries);
        setSelectedDiarySentiment(entries.length ? analyzeSentimentEntries(entries.map((entry) => entry.text)) : null);
      } catch {
        setSelectedDiaryEntries([]);
        setSelectedDiarySentiment(null);
      } finally {
        setIsDiaryLoading(false);
      }
    }

    loadDiaryForDate();
  }, [user, selectedDate, month, year]);

  // Calendar rendering logic
  const daysInMonth = getDaysInMonth(year, month);
  const firstDayOfMonth = getFirstDayOfMonth(year, month);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const emptyDays = Array.from({ length: firstDayOfMonth }, (_, i) => null);

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
    setSelectedDate(null);
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
    setSelectedDate(null);
  };

  const handleDateClick = (day) => {
    if (isFutureDay(day)) {
      return;
    }

    setSelectedDate(day);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  async function handleDeleteDiaryEntry(fileName) {
    if (!fileName || !user) {
      return;
    }

    setDeletingDiaryFile(fileName);
    try {
      await deleteDiaryEntryFile(user, fileName);
      setSelectedDiaryEntries((previous) => {
        const next = previous.filter((entry) => entry.fileName !== fileName);
        setSelectedDiarySentiment(next.length ? analyzeSentimentEntries(next.map((entry) => entry.text)) : null);
        return next;
      });
    } finally {
      setDeletingDiaryFile("");
    }
  }

  if (!authReady) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-hero-radial px-4 py-16 text-white sm:px-6 lg:px-8">
        <div className="mx-auto max-w-xl rounded-[2rem] border border-white/10 bg-white/6 p-8 text-center shadow-soft backdrop-blur-2xl">
          Loading...
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-hero-radial px-4 py-16 text-white sm:px-6 lg:px-8">
        <div className="mx-auto max-w-xl rounded-[2rem] border border-white/10 bg-white/6 p-8 text-center shadow-soft backdrop-blur-2xl">
          <p className="text-white/75">Please sign in to view your mood calendar.</p>
          <Link href="/">
            <button className="mt-6 rounded-full bg-white px-6 py-3 font-semibold text-ink-950 transition hover:bg-white/90">
              Back to Home
            </button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-hero-radial text-white">
      <div className="pointer-events-none absolute inset-0 opacity-70">
        <div className="absolute left-[-4rem] top-[-4rem] h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl animate-floatSlow" />
        <div className="absolute right-[-6rem] top-40 h-80 w-80 rounded-full bg-violet-500/12 blur-3xl animate-floatSlow [animation-delay:1.2s]" />
      </div>

      <Navbar username={user?.user_metadata?.username} onSignOut={handleSignOut} />

      <main className="relative z-10">
        <div className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[auto_1fr] lg:px-8">
          <SidePanel
            activeSection="calendar"
            onSectionChange={(section) => {
              if (section === "analyzer") {
                router.push("/");
              }
              if (section === "diary") {
                router.push("/diary");
              }
            }}
          />

          <section>
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="rounded-[2rem] border border-white/10 bg-white/6 p-8 shadow-soft backdrop-blur-2xl"
            >
            {/* Header */}
            <div className="mb-8 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Link href="/">
                  <button className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-white/75 transition hover:bg-white/10">
                    <ArrowLeft size={18} />
                    <span>Back</span>
                  </button>
                </Link>
                <div>
                  <p className="text-sm font-medium tracking-[0.2em] text-white/45 uppercase">Mood Calendar</p>
                  <h1 className="mt-1 text-3xl font-semibold text-white">See your emotional journey</h1>
                </div>
              </div>
            </div>

            {/* Calendar Grid */}
            <div className="grid gap-8 lg:grid-cols-[2fr_1fr]">
              {/* Calendar */}
              <div className="rounded-[1.5rem] border border-white/10 bg-ink-950/35 p-6">
                {/* Month/Year Navigation */}
                <div className="mb-6 flex items-center justify-between">
                  <button
                    onClick={handlePrevMonth}
                    className="rounded-full border border-white/10 p-2 transition hover:bg-white/10"
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <h2 className="text-xl font-semibold">
                    {currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                  </h2>
                  <button
                    onClick={handleNextMonth}
                    className="rounded-full border border-white/10 p-2 transition hover:bg-white/10"
                  >
                    <ChevronRight size={20} />
                  </button>
                </div>

                {/* Weekday Headers */}
                <div className="mb-4 grid grid-cols-7 gap-2 text-center text-sm font-medium text-white/60">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                    <div key={day}>{day}</div>
                  ))}
                </div>

                {/* Calendar Days */}
                <div className="grid grid-cols-7 gap-2">
                  {emptyDays.map((_, i) => (
                    <div key={`empty-${i}`} />
                  ))}
                  {days.map((day) => {
                    const dateString = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                    const hasData = emotionsByDate[dateString];
                    const isSelected = selectedDate === day;
                    const isFuture = isFutureDay(day);

                    return (
                      <motion.button
                        key={day}
                        onClick={() => handleDateClick(day)}
                        disabled={isFuture}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className={`aspect-square rounded-lg border-2 transition ${
                          isSelected
                            ? "border-white bg-white/20"
                            : isFuture
                              ? "cursor-not-allowed border-white/5 bg-white/[0.03] text-white/25"
                            : hasData
                              ? "border-emerald-400/50 bg-emerald-500/20 hover:bg-emerald-500/30"
                              : "border-white/10 bg-white/5 hover:bg-white/10"
                        }`}
                      >
                        <div className="flex h-full flex-col items-center justify-center">
                          <span className="text-sm font-medium">{day}</span>
                          {hasData && (
                            <span className="mt-1 text-xs text-emerald-300">
                              {hasData.length} {hasData.length === 1 ? "mood" : "moods"}
                            </span>
                          )}
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              </div>

              {/* Details Panel */}
              <div className="rounded-[1.5rem] border border-white/10 bg-ink-950/35 p-6">
                {selectedDate ? (
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <h3 className="mb-4 text-lg font-semibold">
                      {new Date(year, month, selectedDate).toLocaleDateString("en-US", {
                        weekday: "long",
                        month: "long",
                        day: "numeric",
                      })}
                    </h3>

                    {selectedEmotions.length > 0 ? (
                      <div className="space-y-3">
                        <p className="text-sm text-white/60">Emotions recorded:</p>
                        {selectedEmotions.map((emotion, idx) => (
                          <motion.div
                            key={idx}
                            initial={{ opacity: 0, x: -12 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.1 }}
                            className={`flex items-center gap-3 rounded-lg border-2 p-4 ${EMOTION_COLORS[emotion] || "bg-white/5 border-white/10"}`}
                          >
                            <span className="text-2xl">{EMOTION_EMOJI[emotion] || "😐"}</span>
                            <span className="font-medium capitalize">{emotion}</span>
                          </motion.div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <p className="text-center text-sm text-white/50">
                          No mood data recorded on this date.
                        </p>
                      </div>
                    )}

                    {selectedAffirmation ? (
                      <div className="mt-5 rounded-xl border border-emerald-300/25 bg-emerald-400/10 p-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-emerald-100/70">Affirmation</p>
                        <p className="mt-2 text-sm leading-6 text-emerald-50">{selectedAffirmation}</p>
                      </div>
                    ) : null}

                    <div className="mt-5 rounded-xl border border-cyan-300/20 bg-cyan-400/10 p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-cyan-100/70">Diary</p>

                      {isDiaryLoading ? (
                        <p className="mt-2 text-sm text-white/65">Loading diary entries...</p>
                      ) : selectedDiaryEntries.length ? (
                        <div className="mt-3 space-y-3">
                          {selectedDiaryEntries.map((entry) => (
                            <div key={entry.fileName} className="rounded-lg border border-white/10 bg-white/5 p-3">
                              <div className="mb-2 flex items-center justify-end">
                                <button
                                  type="button"
                                  onClick={() => handleDeleteDiaryEntry(entry.fileName)}
                                  disabled={deletingDiaryFile === entry.fileName}
                                  className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-xs text-rose-200 transition hover:bg-rose-400/15 disabled:cursor-not-allowed disabled:opacity-55"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  {deletingDiaryFile === entry.fileName ? "Deleting..." : "Delete"}
                                </button>
                              </div>
                              <p className="text-sm leading-6 text-white/90">{entry.text}</p>
                            </div>
                          ))}

                          {selectedDiarySentiment ? (
                            <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                              <p className="text-xs uppercase tracking-[0.16em] text-white/55">Sentiment</p>
                              <p className={`mt-1 text-sm font-semibold ${selectedDiarySentiment.tone}`}>
                                {selectedDiarySentiment.label}
                              </p>
                              <p className="mt-1 text-xs text-white/65">{selectedDiarySentiment.detail}</p>
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <p className="mt-2 text-sm text-white/65">No diary entry saved for this date.</p>
                      )}
                    </div>
                  </motion.div>
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <p className="text-center text-sm text-white/50">
                      Click on a date to see that day's mood data and affirmation.
                    </p>
                  </div>
                )}
              </div>
            </div>
            </motion.div>
          </section>
        </div>
      </main>
    </div>
  );
}
