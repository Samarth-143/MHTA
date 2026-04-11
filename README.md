# Mental Health Trend Analyzer

A full-stack app that analyzes emotion from voice, tracks mood trends over time, and combines diary sentiment for daily mental health insights.

## What it does

- Predicts emotion from uploaded or recorded audio
- Stores emotion history and shows trend direction
- Lets users write daily diary entries
- Computes diary sentiment (positive/neutral/negative)
- Shows calendar-based day view with affirmation + diary sentiment
- Supports user auth and per-user storage with Supabase

## Tech stack

- Frontend: Next.js (React), Tailwind, Framer Motion
- Backend: FastAPI, TensorFlow, Librosa
- Data: SQLite (emotion history)
- Storage/Auth: Supabase

## Project structure

- `app/` - FastAPI backend, model inference, trend logic, DB access
- `frontend-next/` - Next.js UI (Home, Diary, Calendar)
- `models/` - trained model assets used for inference
- `database/` - local SQLite database file(s)

## API endpoints

- `POST /predict/` - analyze audio and return emotion + trend
- `GET /history/` - fetch stored emotion history
- `DELETE /clear/` - clear stored emotion history

## Local setup

### 1) Backend

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python -m uvicorn app.main:app --reload
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

## Deployment (Vercel + Hugging Face)

### Backend on Hugging Face Spaces (Docker)

1. Create a new Space on Hugging Face with SDK set to Docker.
2. Push this repository to that Space (or mirror only backend files).
3. In Space settings, add `CORS_ORIGINS` with your frontend domain, for example:
	- `https://your-project.vercel.app`
4. Deploy. The app serves FastAPI with `Dockerfile` on port `7860`.

Backend URL format:
- `https://<space-name>.hf.space`

### Frontend on Vercel

1. Import this repo in Vercel.
2. Set Root Directory to `frontend-next`.
3. Add environment variables in Vercel project settings:
	- `NEXT_PUBLIC_API_BASE_URL=https://<space-name>.hf.space`
	- `NEXT_PUBLIC_SUPABASE_URL=your_supabase_url`
	- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key`
	- `NEXT_PUBLIC_SUPABASE_BUCKET=mhva-user-data`
4. Deploy.

### Post-deploy check

- Open frontend on Vercel
- Sign in
- Upload or record audio and confirm `/predict/` works
- Confirm diary save/read works from Supabase storage
