import { supabase } from "./supabaseClient";

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

function makeTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

export async function uploadVoiceAnalysis(user, file, analysisResult) {
  if (!user || !file) {
    throw new Error("User and audio file are required.");
  }

  const folder = getUserFolder(user);
  const safeName = sanitizeSegment(file.name.replace(/\.[^/.]+$/, ""));
  const ext = (file.name.split(".").pop() || "wav").toLowerCase();
  const voicePath = `${folder}/voice-analysis/${makeTimestamp()}-${safeName}.${ext}`;
  const metaPath = `${folder}/voice-analysis/${makeTimestamp()}-${safeName}.json`;

  const uploadAudio = await supabase.storage.from(BUCKET_NAME).upload(voicePath, file, {
    contentType: file.type || "audio/wav",
    upsert: false,
  });

  if (uploadAudio.error) {
    throw new Error(uploadAudio.error.message);
  }

  const metadataBlob = new Blob(
    [
      JSON.stringify(
        {
          user_id: user.id,
          username: user.user_metadata?.username || null,
          email: user.email,
          uploaded_at: new Date().toISOString(),
          file_path: voicePath,
          result: analysisResult,
        },
        null,
        2,
      ),
    ],
    { type: "application/json" },
  );

  const uploadMeta = await supabase.storage.from(BUCKET_NAME).upload(metaPath, metadataBlob, {
    contentType: "application/json",
    upsert: false,
  });

  if (uploadMeta.error) {
    throw new Error(uploadMeta.error.message);
  }
}

export async function saveDiaryEntry(user, diaryText, latestResult) {
  if (!user) {
    throw new Error("User is required.");
  }

  const content = (diaryText || "").trim();
  if (!content) {
    throw new Error("Diary entry is empty.");
  }

  const folder = getUserFolder(user);
  const entryPath = `${folder}/diary/${makeTimestamp()}.txt`;

  const fileBlob = new Blob([content], {
    type: "text/plain",
  });

  const upload = await supabase.storage.from(BUCKET_NAME).upload(entryPath, fileBlob, {
    contentType: "text/plain",
    upsert: false,
  });

  if (upload.error) {
    throw new Error(upload.error.message);
  }
}

export async function deleteDiaryEntryFile(user, fileName) {
  if (!user) {
    throw new Error("User is required.");
  }

  if (!fileName) {
    throw new Error("Diary file name is required.");
  }

  const folder = getUserFolder(user);
  const path = `${folder}/diary/${fileName}`;
  const { error } = await supabase.storage.from(BUCKET_NAME).remove([path]);

  if (error) {
    throw new Error(error.message);
  }
}

export async function clearVoiceAnalysisFiles(user) {
  if (!user) {
    throw new Error("User is required.");
  }

  const folder = getUserFolder(user);
  const voiceFolder = `${folder}/voice-analysis`;

  const { data: files, error: listError } = await supabase.storage
    .from(BUCKET_NAME)
    .list(voiceFolder, { limit: 1000, sortBy: { column: "name", order: "asc" } });

  if (listError) {
    throw new Error(listError.message);
  }

  const paths = (files || [])
    .map((file) => file?.name)
    .filter(Boolean)
    .map((name) => `${voiceFolder}/${name}`);

  if (!paths.length) {
    return 0;
  }

  const { error: removeError } = await supabase.storage.from(BUCKET_NAME).remove(paths);
  if (removeError) {
    throw new Error(removeError.message);
  }

  return paths.length;
}
