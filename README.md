---
title: MHTA Backend
emoji: "🧠"
colorFrom: blue
colorTo: green
sdk: docker
app_port: 7860
pinned: false
---

# Mental Health Trend Analyzer

A full-stack app that analyzes emotion from voice, tracks mood trends over time, and combines diary sentiment for daily mental health insights.

## What it does

- Predicts emotion from uploaded or recorded audio
- Stores emotion history and shows trend direction
- Lets users write daily diary entries
- Computes diary sentiment (positive/neutral/negative)
- Shows calendar-based day view with affirmation + diary sentiment
- Includes a support chatbot powered by NVIDIA API (GLM 4.7)
- Supports user auth and per-user storage with Supabase

## Tech stack

- Frontend: Next.js (React), Tailwind, Framer Motion
- Backend: FastAPI, TensorFlow, Librosa
- Data: SQLite (emotion history)
- Storage/Auth: Supabase

## Project structure

- `backend/` - FastAPI backend code, model files, local DB, and Python requirements
- `frontend-next/` - Next.js UI (Home, Diary, Calendar, Chat)

## API endpoints

- `POST /predict/` - analyze audio and return emotion + trend
- `GET /history/` - fetch stored emotion history
- `DELETE /clear/` - clear stored emotion history
- `POST /chat/` - send a support chat message (NVIDIA-backed)

## Local setup

### 1) Backend

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r backend/requirements.txt
python -m uvicorn backend.app.main:app --reload
```

Backend runs on `http://127.0.0.1:8000`.

### 2) Frontend

```bash
cd frontend-next
npm install
npm run dev
```

Frontend runs on `http://localhost:3000`.

## Environment variables (frontend)

Create `frontend-next/.env.local`:

```env
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
NEXT_PUBLIC_SUPABASE_BUCKET=mhva-user-data
```

## Notes

- The training dataset is not required at runtime once the model is trained.
- Keep only model files required for inference in production.
- For deployment, point `NEXT_PUBLIC_API_BASE_URL` to your hosted backend URL.

## Hugging Face Backend Variables

In your Hugging Face Space settings, add:

```env
CORS_ORIGINS=https://your-project.vercel.app
MODEL_URL=https://raw.githubusercontent.com/Samarth-143/MHTA/main/backend/models/emotion_model.h5
NVIDIA_API_KEY=your_nvidia_api_key
NVIDIA_MODEL=z-ai/glm4.7
```

Use `NVIDIA_API_KEY` under Secrets, and keep `NVIDIA_MODEL`, `CORS_ORIGINS`, and `MODEL_URL` under Variables.
Do not create the same name in both Variables and Secrets, or Hugging Face will raise a collision error.

