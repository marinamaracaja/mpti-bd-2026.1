from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path

BOOTSTRAP_SERVERS = os.getenv("BOOTSTRAP_SERVERS", "localhost:19092")
TOPIC_NAME = os.getenv("TOPIC_NAME", "varejo.eventos")
BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
BRONZE_DIR = DATA_DIR / "bronze"
SILVER_DIR = DATA_DIR / "silver"
GOLD_DIR = DATA_DIR / "gold"


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def ensure_data_dirs() -> None:
    for directory in (BRONZE_DIR, SILVER_DIR, GOLD_DIR):
        directory.mkdir(parents=True, exist_ok=True)


def append_jsonl(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(payload, ensure_ascii=False) + "\n")


def write_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)
