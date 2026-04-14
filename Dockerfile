FROM python:3.11-slim

WORKDIR /code

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PORT=7860

RUN apt-get update \
	&& apt-get install -y --no-install-recommends ffmpeg wget unzip \
	&& rm -rf /var/lib/apt/lists/*

ENV VOSK_MODEL_PATH=/opt/vosk-model-small-en-us-0.15

RUN wget -q https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip -O /tmp/vosk-model.zip \
	&& unzip -q /tmp/vosk-model.zip -d /opt \
	&& rm -f /tmp/vosk-model.zip

COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

COPY backend ./backend

EXPOSE 7860

CMD ["sh", "-c", "uvicorn backend.app.main:app --host 0.0.0.0 --port ${PORT}"]
