import os
import sqlite3
from datetime import datetime
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DATABASE_DIR = BASE_DIR / "database"
DB_PATH = DATABASE_DIR / "emotions.db"


def init_db():
    os.makedirs(DATABASE_DIR, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS emotions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            emotion TEXT,
            timestamp TEXT
        )
    ''')
    conn.commit()
    conn.close()

def insert_emotion(emotion):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("INSERT INTO emotions (emotion, timestamp) VALUES (?, ?)", 
              (emotion, datetime.now().isoformat()))
    conn.commit()
    conn.close()

def fetch_emotions():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("SELECT emotion, timestamp FROM emotions ORDER BY id ASC")
    data = c.fetchall()
    conn.close()
    return data
