import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useRouter } from "next/router";

import Navbar from "../components/Navbar";
import SidePanel from "../components/SidePanel";
import Diary from "../components/Diary";
import { supabase } from "../lib/supabaseClient";
import { saveDiaryEntry } from "../lib/supabaseStorage";

export default function DiaryPage() {
  const router = useRouter();
  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState(null);
  const [diaryEntry, setDiaryEntry] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    let mounted = true;

    async function initializeAuth() {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;

      setUser(data?.session?.user || null);
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
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function handleSaveDiary() {
    setStatus("");
    try {
      await saveDiaryEntry(user, diaryEntry, null);
      setDiaryEntry("");
      setStatus("Saved to Supabase diary folder.");
    } catch (error) {
      setStatus(error?.message || "Could not save entry.");
      throw error;
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/");
  }

  if (!authReady) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-hero-radial px-4 py-16 text-white sm:px-6 lg:px-8">
        <div className="mx-auto max-w-xl rounded-[2rem] border border-white/10 bg-white/6 p-8 text-center shadow-soft backdrop-blur-2xl">
          Loading diary...
        </div>
      </div>
    );
  }

  if (!user) {
    router.push("/");
    return null;
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
            activeSection="diary"
            onSectionChange={(section) => {
              if (section === "analyzer") router.push("/");
              if (section === "calendar") router.push("/calendar");
            }}
          />

          <section>
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="space-y-4"
            >
              <Diary value={diaryEntry} onChange={setDiaryEntry} onSave={handleSaveDiary} />
              {status ? (
                <p className="rounded-xl border border-white/10 bg-white/6 px-4 py-3 text-sm text-white/80">
                  {status}
                </p>
              ) : null}
            </motion.div>
          </section>
        </div>
      </main>
    </div>
  );
}
