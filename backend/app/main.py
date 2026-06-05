from fastapi import FastAPI, UploadFile, File, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
import shutil
import os
import sqlite3
from pathlib import Path
from pydantic import BaseModel
from openai import OpenAI

from .model import load_emotion_model, predict_emotion
from .transcription import transcribe_audio
from .database import DB_PATH, init_db, insert_emotion, fetch_emotions
from .trend import analyze_trend

app = FastAPI()

SUPPORT_SYSTEM_PROMPT = (
    "You are a calm, supportive mental wellness assistant. "
    "Listen empathetically, offer grounding suggestions, and avoid diagnosis. "
    "If the user expresses self-harm intent, strongly encourage immediate professional help and local emergency support. "
    "Return a single JSON object only, with no markdown fences or extra commentary. "
    "Use this schema: {\"summary\": string, \"paragraphs\": [string], \"bullets\": [string], \"closing_question\": string}. "
    "Keep summary to one sentence. Use 1 to 3 short paragraphs. Use bullets only when giving concrete steps or options. Keep language simple and empathetic."
)

NEGATIVE_TEXT_CUES = {
    "suicide", "kill myself", "want to die", "hopeless", "worthless", "depressed",
    "panic", "anxious", "can't cope", "hurt myself", "self harm", "alone", "empty",
}


def _build_allowed_origins():
    local_origins = [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:3002",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
        "http://127.0.0.1:3002",
    ]

    configured = os.getenv("CORS_ORIGINS", "")
    extra_origins = [origin.strip() for origin in configured.split(",") if origin.strip()]
    return local_origins + extra_origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=_build_allowed_origins(),
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

load_emotion_model()
init_db()

BASE_DIR = Path(__file__).resolve().parent.parent
TEMP_DIR = BASE_DIR / "temp"
os.makedirs(TEMP_DIR, exist_ok=True)


@app.get("/")
def root():
    return {"status": "ok", "service": "mhta-backend"}


@app.get("/health")
def health_check():
    return {"status": "healthy"}


def _analyze_text_risk(text):
    if not text:
        return {"score": 0.0, "matched": []}

    normalized = text.lower().strip()
    matched = [cue for cue in NEGATIVE_TEXT_CUES if cue in normalized]
    score = min(1.0, len(matched) / 3.0)
    return {"score": round(score, 4), "matched": matched}


class ChatPayload(BaseModel):
    message: str
    history: list[dict] = []


def _build_openai_messages(history, latest_message):
    messages = [{"role": "system", "content": SUPPORT_SYSTEM_PROMPT}]

    for item in (history or [])[-12:]:
        text = str(item.get("text", "")).strip()
        if not text:
            continue

        role = str(item.get("role", "user")).lower()
        openai_role = "assistant" if role == "assistant" else "user"
        messages.append({"role": openai_role, "content": text})

    messages.append({"role": "user", "content": latest_message.strip()})
    return messages


def _resolve_openrouter_base_url(base_url):
    cleaned = (base_url or "").strip().rstrip("/")
    if not cleaned:
        cleaned = "https://openrouter.ai/api/v1"

    if cleaned.endswith("/chat/completions"):
        cleaned = cleaned[: -len("/chat/completions")]

    if not cleaned.endswith("/v1"):
        cleaned = f"{cleaned}/v1"

    return cleaned


def _parse_bool_env(name, default=False):
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _extract_reply_text(message):
    if not message:
        return ""

    raw_content = getattr(message, "content", "")
    if isinstance(raw_content, str):
        text = raw_content.strip()
        if text:
            return text

    if isinstance(raw_content, list):
        parts = []
        for item in raw_content:
            if isinstance(item, dict):
                item_text = item.get("text") or item.get("content") or ""
                if isinstance(item_text, list):
                    item_text = "".join(str(x) for x in item_text)
                parts.append(str(item_text))
            else:
                item_text = getattr(item, "text", None)
                if item_text is None:
                    item_text = getattr(item, "content", "")
                parts.append(str(item_text or ""))
        text = "".join(parts).strip()
        if text:
            return text

    reasoning = getattr(message, "reasoning_content", "")
    return str(reasoning or "").strip()


def _strip_code_fences(text):
    value = (text or "").strip()
    if value.startswith("```"):
        lines = value.splitlines()
        if len(lines) >= 2:
            first = lines[0].strip().lower()
            if first.startswith("```json") or first == "```":
                if lines[-1].strip().startswith("```"):
                    return "\n".join(lines[1:-1]).strip()
    return value


def _parse_structured_reply(text):
    raw_text = _strip_code_fences(text)
    if not raw_text:
        return None

    try:
        import json

        data = json.loads(raw_text)
        if not isinstance(data, dict):
            return None

        summary = str(data.get("summary", "") or "").strip()
        paragraphs = data.get("paragraphs", []) or []
        bullets = data.get("bullets", []) or []
        closing_question = str(data.get("closing_question", "") or "").strip()

        normalized_paragraphs = [str(item).strip() for item in paragraphs if str(item).strip()]
        normalized_bullets = [str(item).strip() for item in bullets if str(item).strip()]

        if not summary and normalized_paragraphs:
            summary = normalized_paragraphs[0]

        return {
            "summary": summary,
            "paragraphs": normalized_paragraphs,
            "bullets": normalized_bullets,
            "closing_question": closing_question,
        }
    except Exception:
        return None


def _render_structured_reply(reply_blocks):
    sections = []

    summary = (reply_blocks or {}).get("summary", "").strip()
    if summary:
        sections.append(summary)

    for paragraph in (reply_blocks or {}).get("paragraphs", []):
        paragraph_text = str(paragraph).strip()
        if paragraph_text:
            sections.append(paragraph_text)

    bullets = [str(item).strip() for item in (reply_blocks or {}).get("bullets", []) if str(item).strip()]
    if bullets:
        sections.append("\n".join(f"- {item}" for item in bullets))

    closing_question = (reply_blocks or {}).get("closing_question", "").strip()
    if closing_question:
        sections.append(closing_question)

    return "\n\n".join(sections).strip()


def _build_reply_payload(raw_reply, provider, model, extra=None):
    reply_blocks = _parse_structured_reply(raw_reply)
    if reply_blocks:
        rendered_reply = _render_structured_reply(reply_blocks) or str(raw_reply or "").strip()
    else:
        rendered_reply = str(raw_reply or "").strip()

    payload = {
        "reply": rendered_reply,
        "reply_blocks": reply_blocks,
        "provider": provider,
        "model": model,
    }
    if extra:
        payload.update(extra)
    return payload


def _looks_truncated(text, min_length=120):
    """Return True if `text` appears to end abruptly and is likely truncated.

    Heuristics:
    - must be at least `min_length` characters to avoid short replies
    - if it does not end with terminal punctuation or a closing quote/paren, consider it truncated
    - if it ends with obvious truncation markers (ellipsis, em-dash, colon, header markers), consider truncated
    """
    if not text:
        return False

    s = str(text).strip()
    if len(s) < min_length:
        return False

    # Characters that usually indicate a finished sentence
    finished_chars = {'.', '!', '?', '…', '"', "'", '”', '’', ')', '}'}
    if s[-1] in finished_chars:
        return False

    # Obvious truncation markers
    trunc_markers = ('...', '..', '—', '–', ':', '###')
    for m in trunc_markers:
        if s.endswith(m):
            return True

    # If it doesn't end in a terminal punctuation and is reasonably long, assume truncated
    return True


def _resolve_model_candidates(primary_model):
    extras = os.getenv("OPENROUTER_FALLBACK_MODELS", "").strip()
    candidates = [(primary_model or "").strip()]

    if extras:
        candidates.extend(m.strip() for m in extras.split(",") if m.strip())

    unique = []
    for model in candidates:
        if model not in unique:
            unique.append(model)
    return unique


def _is_gateway_error(exc):
    msg = str(exc).lower()
    return "502" in msg or "bad gateway" in msg or "gateway" in msg


def _build_local_support_reply(user_message):
    text = (user_message or "").lower()
    high_risk = any(cue in text for cue in NEGATIVE_TEXT_CUES)
    if high_risk:
        return (
            "I hear that you are going through a lot right now. You deserve immediate support. "
            "If you might hurt yourself, please contact local emergency services or a crisis helpline right away. "
            "If you can, reach out to a trusted person and stay with someone until support is available."
        )

    return (
        "I am here with you. I may be having a temporary connection issue, but you are not alone. "
        "Tell me one thing that feels hardest right now, and we can break it into a small next step together."
    )


def _chat_with_openrouter(payload: ChatPayload):
    api_key = os.getenv("OPENROUTER_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("OpenRouter API key is missing on the server.")

    model = os.getenv("OPENROUTER_MODEL", "nvidia/nemotron-3-super").strip() or "nvidia/nemotron-3-super"
    model_candidates = _resolve_model_candidates(model)
    base_url = os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1").strip().rstrip("/")
    resolved_base_url = _resolve_openrouter_base_url(base_url)
    timeout_seconds = float(os.getenv("OPENROUTER_TIMEOUT_SECONDS", "25"))
    retry_timeout_seconds = float(os.getenv("OPENROUTER_TIMEOUT_RETRY_SECONDS", str(max(timeout_seconds + 20, 45))))
    max_tokens = int(os.getenv("OPENROUTER_MAX_TOKENS", "300"))
    retry_max_tokens = int(os.getenv("OPENROUTER_RETRY_MAX_TOKENS", str(min(max_tokens, 180))))
    base_messages = _build_openai_messages(payload.history, payload.message)
    default_headers = {}

    site_url = os.getenv("OPENROUTER_SITE_URL", "").strip()
    app_name = os.getenv("OPENROUTER_APP_NAME", "").strip()
    if site_url:
        default_headers["HTTP-Referer"] = site_url
    if app_name:
        default_headers["X-OpenRouter-Title"] = app_name

    last_error = None
    for candidate_model in model_candidates:
        request_template = {
            "model": candidate_model,
            "messages": base_messages,
            "temperature": 0.4,
            "stream": False,
        }

        attempt_configs = [
            {"timeout": timeout_seconds, "max_tokens": max_tokens, "temperature": 0.4},
            {"timeout": retry_timeout_seconds, "max_tokens": retry_max_tokens, "temperature": 0.3},
        ]

        for idx, cfg in enumerate(attempt_configs, start=1):
            request_body = dict(request_template)
            request_body["max_tokens"] = cfg["max_tokens"]
            request_body["temperature"] = cfg["temperature"]

            client = OpenAI(
                base_url=resolved_base_url,
                api_key=api_key,
                timeout=cfg["timeout"],
                max_retries=1,
                default_headers=default_headers or None,
            )

            try:
                response = client.chat.completions.create(**request_body)
                choices = getattr(response, "choices", []) or []
                if not choices:
                    last_error = f"{candidate_model} attempt {idx}: NVIDIA returned no response."
                    continue

                message = getattr(choices[0], "message", None)
                reply = _extract_reply_text(message)
                # If the model returned an empty reply, treat as error and continue
                if not reply:
                    last_error = f"{candidate_model} attempt {idx}: NVIDIA returned an empty response."
                    continue

                # Detect if the provider stopped due to token/length limits or looks truncated and try to continue
                finish_reason = getattr(choices[0], "finish_reason", None)
                should_continue = False
                if finish_reason and str(finish_reason).lower() in {"length", "max_tokens", "token_limit"}:
                    should_continue = True
                else:
                    # Also use heuristics when provider doesn't set a finish_reason
                    try:
                        should_continue = _looks_truncated(reply, min_length=int(os.getenv("OPENROUTER_CONTINUE_MIN_LENGTH", "120")))
                    except Exception:
                        should_continue = _looks_truncated(reply)

                if should_continue:
                    try:
                        cont_max_tokens = int(os.getenv("OPENROUTER_CONTINUE_MAX_TOKENS", str(min(max_tokens * 2, 800))))
                    except Exception:
                        cont_max_tokens = min(max_tokens * 2, 800)

                    cont_messages = list(base_messages)
                    cont_messages.append({
                        "role": "user",
                        "content": (
                            "Your previous JSON response was cut off. Return the same answer again as one complete JSON object only, "
                            "using the schema {\"summary\": string, \"paragraphs\": [string], \"bullets\": [string], \"closing_question\": string}. "
                            "Do not add markdown fences or any extra commentary."
                        ),
                    })

                    cont_body = {
                        "model": candidate_model,
                        "messages": cont_messages,
                        "max_tokens": cont_max_tokens,
                        "temperature": cfg["temperature"],
                        "stream": False,
                    }

                    try:
                        cont_resp = client.chat.completions.create(**cont_body)
                        cont_choices = getattr(cont_resp, "choices", []) or []
                        if cont_choices:
                            cont_msg = getattr(cont_choices[0], "message", None)
                            cont_text = _extract_reply_text(cont_msg)
                            if cont_text:
                                return _build_reply_payload(cont_text, "nvidia", candidate_model)
                    except Exception as exc2:
                        last_error = f"{candidate_model} continuation attempt failed: {exc2}"

                # Normal successful reply (not truncated or continuation failed)
                return _build_reply_payload(reply, "nvidia", candidate_model)
            except Exception as exc:
                last_error = f"{candidate_model} attempt {idx}: {exc}"
                # Gateway failures are usually transient service-side errors; move to next model quickly.
                if _is_gateway_error(exc):
                    break

    raise RuntimeError(f"OpenRouter request failed: {last_error} (base_url: {resolved_base_url})")


@app.post("/chat/")
def chat_support(payload: ChatPayload):
    if not payload.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty.")

    try:
        return _chat_with_openrouter(payload)
    except Exception as exc:
        if _parse_bool_env("CHAT_LOCAL_FALLBACK", default=True):
            return _build_reply_payload(
                _build_local_support_reply(payload.message),
                "local-fallback",
                "support-template",
                extra={"upstream_error": f"OpenRouter: {exc}"},
            )
        raise HTTPException(status_code=502, detail=f"OpenRouter: {exc}") from exc


# ---- Diary sentiment (OpenRouter) ----

class SentimentPayload(BaseModel):
    text: str


SENTIMENT_SYSTEM_PROMPT = (
    "You are a mental-wellness sentiment classifier for diary entries. "
    "Return a single JSON object only (no markdown fences, no extra text). "
    "Use this schema: "
    "{\"label\": string, \"tone\": string, \"detail\": string, \"score\": number, \"comparative\": number}. "
    "\nRules: "
    "- label must be one of: 'Positive', 'Neutral', 'Needs Support'. "
    "- tone must be a Tailwind text color class: 'text-emerald-200', 'text-amber-100', or 'text-rose-200'. "
    "- score and comparative are numbers (use any reasonable scale, but keep them consistent). "
    "- detail should be 1 short supportive sentence describing the detected sentiment. "
)


def _build_sentiment_prompt(text: str) -> str:
    return (
        "Classify the sentiment of this diary entry and return the JSON schema. "
        "Diary entry:\n"
        f"{text}"
    )


def _sentiment_with_openrouter(text: str):
    api_key = os.getenv("OPENROUTER_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("OpenRouter API key is missing on the server.")

    model = os.getenv("OPENROUTER_SENTIMENT_MODEL", "anthropic/claude-3").strip() or "anthropic/claude-3"
    model_candidates = _resolve_model_candidates(model)

    base_url = os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1").strip().rstrip("/")
    resolved_base_url = _resolve_openrouter_base_url(base_url)

    timeout_seconds = float(os.getenv("OPENROUTER_TIMEOUT_SECONDS", "25"))
    max_tokens = int(os.getenv("OPENROUTER_MAX_TOKENS", "300"))

    site_url = os.getenv("OPENROUTER_SITE_URL", "").strip()
    app_name = os.getenv("OPENROUTER_APP_NAME", "").strip()

    default_headers = {}
    if site_url:
        default_headers["HTTP-Referer"] = site_url
    if app_name:
        default_headers["X-OpenRouter-Title"] = app_name

    messages = [
        {"role": "system", "content": SENTIMENT_SYSTEM_PROMPT},
        {"role": "user", "content": _build_sentiment_prompt(text)},
    ]

    last_error = None
    for candidate_model in model_candidates:
        for idx, cfg in enumerate(
            [
                {"timeout": timeout_seconds, "max_tokens": max_tokens, "temperature": 0.2},
                {"timeout": max(timeout_seconds + 10, 35), "max_tokens": max(min(max_tokens, 220), 150), "temperature": 0.1},
            ],
            start=1,
        ):
            try:
                client = OpenAI(
                    base_url=resolved_base_url,
                    api_key=api_key,
                    timeout=cfg["timeout"],
                    max_retries=1,
                    default_headers=default_headers or None,
                )

                request_body = {
                    "model": candidate_model,
                    "messages": messages,
                    "temperature": cfg["temperature"],
                    "max_tokens": cfg["max_tokens"],
                    "stream": False,
                }

                response = client.chat.completions.create(**request_body)
                choices = getattr(response, "choices", []) or []
                if not choices:
                    last_error = f"{candidate_model} attempt {idx}: NVIDIA returned no response."
                    continue

                message = getattr(choices[0], "message", None)
                reply = _extract_reply_text(message)
                if not reply:
                    last_error = f"{candidate_model} attempt {idx}: NVIDIA returned empty response."
                    continue

                parsed = _parse_structured_reply(reply)
                if not parsed:
                    # Fallback: attempt parsing raw JSON without schema enforcement
                    parsed = None

                # If parsing fails, try to coerce a minimal response
                if not parsed:
                    # Return safe defaults rather than failing the endpoint
                    return {
                        "label": "Neutral",
                        "tone": "text-amber-100",
                        "detail": "Your writing appears balanced overall.",
                        "score": 0,
                        "comparative": 0,
                    }

                # Map model JSON keys to frontend expectations
                label = parsed.get("label") or "Neutral"
                tone = parsed.get("tone") or (
                    "text-emerald-200" if label == "Positive" else ("text-rose-200" if label == "Needs Support" else "text-amber-100")
                )
                detail = parsed.get("detail") or "Your writing appears balanced overall."

                score = parsed.get("score") if parsed.get("score") is not None else 0
                comparative = parsed.get("comparative") if parsed.get("comparative") is not None else 0

                return {
                    "label": label,
                    "tone": tone,
                    "detail": detail,
                    "score": score,
                    "comparative": comparative,
                }

            except Exception as exc:
                last_error = f"{candidate_model} attempt {idx}: {exc}"

    raise RuntimeError(f"OpenRouter sentiment request failed: {last_error}")




@app.post("/sentiment/")
def sentiment_diary(payload: SentimentPayload):
    text = (payload.text or "").strip()

    if not text:
        raise HTTPException(status_code=400, detail="Text cannot be empty.")

    try:
        return _sentiment_with_openrouter(text)
    except Exception as exc:
        # Keep diary UX functional
        return {
            "label": "Neutral",
            "tone": "text-amber-100",
            "detail": "Your writing appears balanced overall.",
            "score": 0,
            "comparative": 0,
            "upstream_error": str(exc),
        }



@app.post("/predict/")
async def predict(file: UploadFile = File(...), language: str = Form(default="auto")):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file received.")

    file_location = os.path.join(str(TEMP_DIR), file.filename)

    with open(file_location, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    try:
        prediction = predict_emotion(file_location)
        transcript = ""
        transcript_source = "unavailable"
        transcript_status = "unavailable"

        try:
            stt_result = transcribe_audio(file_location, language=language)
            transcript = stt_result.get("text", "")
            transcript_status = stt_result.get("status", "unavailable")
            transcript_source = stt_result.get("source", "unavailable")
        except Exception:
            transcript = ""
            transcript_source = "unavailable"
            transcript_status = "error"

        text_risk = _analyze_text_risk(transcript)

        emotion = prediction["emotion"]
        flagged = prediction["calm_masking_risk"] or text_risk["score"] >= 0.34
        flag_reason = ""

        if text_risk["score"] >= 0.34 and emotion in {"calm", "neutral"}:
            emotion = "sad"
            flag_reason = "Distressing language detected in transcript/text."
        elif prediction["calm_masking_risk"]:
            flag_reason = "Tone appears calm but model still shows elevated negative affect probability."

        insert_emotion(emotion)

        history = fetch_emotions()
        emotions_only = [e[0] for e in history]
        trend = analyze_trend(emotions_only)

        return {
            "emotion": emotion,
            "raw_emotion": prediction["raw_emotion"],
            "confidence": prediction["confidence"],
            "uncertain": prediction["uncertain"],
            "distress_score": prediction["distress_score"],
            "content_risk": text_risk["score"],
            "content_matches": text_risk["matched"],
            "transcript": transcript,
            "transcript_source": transcript_source,
            "transcript_language": language,
            "transcript_status": transcript_status,
            "flagged": flagged,
            "flag_reason": flag_reason,
            "trend": trend,
            "message": f"Your recent emotional pattern suggests: {trend}",
        }
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Audio processing failed: {exc}") from exc
    finally:
        if os.path.exists(file_location):
            os.remove(file_location)


@app.get("/history/")
def get_history():
    history = fetch_emotions()
    return {"history": history}


@app.delete("/clear/")
def clear_history():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("DELETE FROM emotions")
    conn.commit()
    conn.close()

    return {"message": "History cleared"}