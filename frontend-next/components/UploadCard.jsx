import { motion } from "framer-motion";
import { AudioLines, FileAudio2, LoaderCircle, Mic, Square, UploadCloud, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

function isAudioFile(file) {
  return file && (file.type.startsWith("audio/") || /\.(wav|mp3|m4a|ogg|flac)$/i.test(file.name));
}

export default function UploadCard({
  file,
  previewUrl,
  isLoading,
  onFileChange,
  onRemoveFile,
  onAnalyze,
}) {
  const inputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingError, setRecordingError] = useState("");

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  function getSupportedMimeType() {
    const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
    return candidates.find((type) => window.MediaRecorder?.isTypeSupported?.(type)) || "";
  }

  function inferExtension(mimeType) {
    if (mimeType.includes("ogg")) return "ogg";
    if (mimeType.includes("mp4")) return "m4a";
    return "webm";
  }

  async function startRecording() {
    setRecordingError("");

    if (!navigator.mediaDevices?.getUserMedia || typeof window.MediaRecorder === "undefined") {
      setRecordingError("Audio recording is not supported in this browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const mimeType = getSupportedMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data?.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const activeMimeType = recorder.mimeType || mimeType || "audio/webm";
        const ext = inferExtension(activeMimeType);
        const blob = new Blob(chunksRef.current, { type: activeMimeType });
        const recordedFile = new File([blob], `recording-${Date.now()}.${ext}`, { type: activeMimeType });
        onFileChange(recordedFile);

        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }
      };

      recorder.start();
      setIsRecording(true);
    } catch {
      setRecordingError("Could not access microphone. Please allow mic permission and try again.");
      setIsRecording(false);
    }
  }

  function stopRecording() {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
    setIsRecording(false);
  }

  const handleDrop = (event) => {
    event.preventDefault();
    setIsDragging(false);
    const droppedFile = event.dataTransfer.files?.[0];

    if (isAudioFile(droppedFile)) {
      onFileChange(droppedFile);
    }
  };

  return (
    <motion.section
      id="analysis"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="rounded-[2rem] border border-white/10 bg-white/6 p-6 shadow-soft backdrop-blur-2xl"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium tracking-[0.2em] text-white/45 uppercase">Audio Analysis</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">Upload a voice clip</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-white/58">
            Drag and drop a WAV or MP3 file, then analyze the emotional tone with the backend model.
          </p>
        </div>

        <div className="hidden rounded-2xl border border-white/10 bg-white/5 p-3 text-white/50 md:block">
          <AudioLines className="h-5 w-5" />
        </div>
      </div>

      <motion.div
        whileHover={{ scale: 1.01 }}
        transition={{ type: "spring", stiffness: 260, damping: 22 }}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`mt-6 rounded-[1.75rem] border border-dashed p-6 transition ${
          isDragging
            ? "border-cyan-300/60 bg-cyan-300/10"
            : "border-white/12 bg-ink-950/35 hover:border-cyan-300/30 hover:bg-white/7"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="audio/*,.wav,.mp3,.m4a,.ogg,.flac"
          className="hidden"
          onChange={(event) => {
            const selectedFile = event.target.files?.[0];
            if (selectedFile && isAudioFile(selectedFile)) {
              onFileChange(selectedFile);
            }
          }}
        />

        {!file ? (
          <div className="flex flex-col items-center justify-center gap-4 py-8 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-3xl border border-white/10 bg-white/7 text-accent-cyan shadow-glow">
              <UploadCloud className="h-7 w-7" />
            </div>
            <div>
              <p className="text-lg font-medium text-white">Drop audio here</p>
              <p className="mt-1 text-sm text-white/48">or browse files from your device</p>
            </div>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="rounded-full border border-white/10 bg-white px-5 py-2.5 text-sm font-medium text-ink-950 transition hover:bg-mist-100"
            >
              Browse files
            </button>

            {isRecording ? (
              <button
                type="button"
                onClick={stopRecording}
                className="inline-flex items-center gap-2 rounded-full border border-rose-300/40 bg-rose-400/20 px-5 py-2.5 text-sm font-medium text-rose-100 transition hover:bg-rose-400/30"
              >
                <Square className="h-4 w-4" />
                Stop recording
              </button>
            ) : (
              <button
                type="button"
                onClick={startRecording}
                className="inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-300/12 px-5 py-2.5 text-sm font-medium text-cyan-100 transition hover:bg-cyan-300/20"
              >
                <Mic className="h-4 w-4" />
                Record audio
              </button>
            )}

            {recordingError ? <p className="text-sm text-rose-200">{recordingError}</p> : null}
            {isRecording ? <p className="text-xs text-cyan-100/85">Recording in progress...</p> : null}
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex items-start justify-between gap-4 rounded-3xl border border-white/10 bg-white/6 p-4">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-300/10 text-cyan-200">
                  <FileAudio2 className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{file.name}</p>
                  <p className="mt-1 text-xs text-white/45">{Math.round(file.size / 1024)} KB</p>
                </div>
              </div>

              <button
                type="button"
                onClick={onRemoveFile}
                className="rounded-full border border-white/10 p-2 text-white/55 transition hover:border-white/20 hover:text-white"
                aria-label="Remove file"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {previewUrl ? (
              <audio controls className="w-full rounded-2xl">
                <source src={previewUrl} />
              </audio>
            ) : null}

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="rounded-full border border-white/10 bg-white/6 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-white/10"
              >
                Change file
              </button>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="button"
                onClick={onAnalyze}
                disabled={isLoading}
                className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-ink-950 transition disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isLoading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
                {isLoading ? "Analyzing..." : "Analyze voice"}
              </motion.button>
            </div>
          </div>
        )}
      </motion.div>
    </motion.section>
  );
}