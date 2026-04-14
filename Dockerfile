FROM python:3.11-slim

WORKDIR /code

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PORT=7860
ENV TRANSCRIPTION_MODEL=small
ENV TRANSCRIPTION_COMPUTE_TYPE=int8
ENV WHISPER_DOWNLOAD_ROOT=/opt/whisper-cache
ENV TRANSCRIPTION_LOCAL_FILES_ONLY=true

RUN apt-get update \
	&& apt-get install -y --no-install-recommends ffmpeg \
	&& rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

RUN python -c "from faster_whisper import WhisperModel; WhisperModel('small', device='cpu', compute_type='int8', download_root='/opt/whisper-cache', local_files_only=False)"

COPY backend ./backend

EXPOSE 7860

CMD ["sh", "-c", "uvicorn backend.app.main:app --host 0.0.0.0 --port ${PORT}"]
