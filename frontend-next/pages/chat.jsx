import { motion } from "framer-motion";
import { SendHorizontal } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";

import Navbar from "../components/Navbar";
import SidePanel from "../components/SidePanel";
import { supabase } from "../lib/supabaseClient";
import { sendSupportMessage } from "../lib/api";

export default function ChatPage() {
  const router = useRouter();
  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);

  const username = useMemo(
    () => user?.user_metadata?.username || user?.email?.split("@")[0] || "user",
    [user],
  );

  useEffect(() => {
    let mounted = true;

    async function initializeAuth() {
      const { data } = await supabase.auth.getSession();
      if (!mounted) {
        return;
      }
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

  useEffect(() => {
    if (!messages.length) {
      setMessages([
        {
          role: "assistant",
          text: "Hi, I am here to support you. You can share how you are feeling, and we can work through it together.",
        },
      ]);
    }
  }, [messages.length]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/");
  }

  async function handleSend() {
    const text = input.trim();
    if (!text || isSending) {
      return;
    }

    const nextMessages = [...messages, { role: "user", text }];
    setMessages(nextMessages);
    setInput("");
    setIsSending(true);

    try {
      const history = nextMessages
        .slice(-12)
        .filter((msg) => msg.role === "user" || msg.role === "assistant")
        .map((msg) => ({ role: msg.role, text: msg.text }));

      const response = await sendSupportMessage(text, history);
      setMessages((prev) => [...prev, { role: "assistant", text: response.reply }]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: error.message || "I could not respond right now. Please try again in a moment.",
        },
      ]);
    } finally {
      setIsSending(false);
    }
  }

  if (!authReady) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-hero-radial px-4 py-16 text-white sm:px-6 lg:px-8">
        <div className="mx-auto max-w-xl rounded-[2rem] border border-white/10 bg-white/6 p-8 text-center shadow-soft backdrop-blur-2xl">
          Loading support chat...
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

      <Navbar username={username} onSignOut={handleSignOut} />

      <main className="relative z-10">
        <div className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[auto_1fr] lg:px-8">
          <SidePanel
            activeSection="chat"
            onSectionChange={(section) => {
              if (section === "analyzer") router.push("/");
              if (section === "diary") router.push("/diary");
              if (section === "calendar") router.push("/calendar");
            }}
          />

          <section className="rounded-[2rem] border border-white/10 bg-white/6 p-6 shadow-soft backdrop-blur-2xl">
            <p className="text-sm font-medium tracking-[0.2em] text-white/45 uppercase">Support Chat</p>
            <h1 className="mt-2 text-3xl font-semibold text-white">Talk with a support assistant</h1>
            <p className="mt-2 text-sm text-white/60">
              This chat is supportive guidance, not medical diagnosis. For emergencies, contact local emergency services.
            </p>

            <div className="mt-6 h-[55vh] overflow-y-auto rounded-2xl border border-white/10 bg-ink-950/35 p-4">
              <div className="space-y-3">
                {messages.map((msg, idx) => (
                  <motion.div
                    key={`${msg.role}-${idx}`}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-6 ${
                      msg.role === "user"
                        ? "ml-auto border border-cyan-300/35 bg-cyan-300/20 text-cyan-50"
                        : "border border-white/10 bg-white/10 text-white/90"
                    }`}
                  >
                    {msg.text}
                  </motion.div>
                ))}
              </div>
            </div>

            <div className="mt-4 flex items-end gap-3">
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Share what you are feeling..."
                className="min-h-24 w-full resize-y rounded-2xl border border-white/10 bg-ink-950/35 px-4 py-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-cyan-300/45"
              />

              <button
                type="button"
                onClick={handleSend}
                disabled={isSending || !input.trim()}
                className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-ink-950 transition hover:bg-mist-100 disabled:cursor-not-allowed disabled:opacity-70"
              >
                <SendHorizontal className="h-4 w-4" />
                {isSending ? "Sending..." : "Send"}
              </button>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}