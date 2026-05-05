from __future__ import annotations

import json
import os
from pathlib import Path

import psycopg2
import psycopg2.extras

DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = int(os.getenv("DB_PORT", "5432"))
DB_NAME = os.getenv("DB_NAME", "aula05")
DB_USER = os.getenv("DB_USER", "aula05")
DB_PASS = os.getenv("DB_PASS", "aula05")

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"


def get_conn() -> psycopg2.extensions.connection:
    return psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        dbname=DB_NAME,
        user=DB_USER,
        password=DB_PASS,
    )


def write_results(filename: str, payload: object) -> Path:
    DATA_DIR.mkdir(exist_ok=True)
    path = DATA_DIR / filename
    with path.open("w", encoding="utf-8") as fh:
        json.dump(payload, fh, ensure_ascii=False, indent=2, default=str)
    return path
