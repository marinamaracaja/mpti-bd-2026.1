"""
setup_schema.py
───────────────
Cria as extensões, tabelas e índices necessários para os três demos.
Execute uma vez antes de rodar os demos.
"""

from __future__ import annotations

from common import get_conn

DDL = """
-- ──────────────────────────────────────────────────
-- Extensões
-- ──────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS vector;     -- pgvector
CREATE EXTENSION IF NOT EXISTS pg_trgm;    -- trigram para FTS avançado

-- ──────────────────────────────────────────────────
-- Demo 1 — JSONB
-- ──────────────────────────────────────────────────
DROP TABLE IF EXISTS eventos CASCADE;

CREATE TABLE eventos (
    id          SERIAL PRIMARY KEY,
    tipo        VARCHAR(50)  NOT NULL,
    payload     JSONB        NOT NULL,
    created_at  TIMESTAMPTZ  DEFAULT now()
);

-- GIN index: habilita @>, ?, ?&, ?| em O(log n)
CREATE INDEX idx_eventos_payload ON eventos USING GIN (payload);
CREATE INDEX idx_eventos_tipo    ON eventos (tipo);

-- ──────────────────────────────────────────────────
-- Demo 2 & 3 — pgvector + FTS (mesma tabela)
-- ──────────────────────────────────────────────────
DROP TABLE IF EXISTS artigos CASCADE;

CREATE TABLE artigos (
    id        SERIAL PRIMARY KEY,
    titulo    TEXT NOT NULL,
    area      TEXT NOT NULL,
    resumo    TEXT NOT NULL,
    ano       INT,
    -- vetor de 384 dims (all-MiniLM-L6-v2)
    embedding vector(384),
    -- coluna computed para FTS em português
    tsv       TSVECTOR GENERATED ALWAYS AS (
                  to_tsvector('portuguese', titulo || ' ' || resumo)
              ) STORED
);

-- Índice HNSW para busca vetorial aproximada
-- m=16: conexões por nó; ef_construction=64: qualidade de construção
CREATE INDEX idx_artigos_hnsw ON artigos
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- Índice GIN para FTS
CREATE INDEX idx_artigos_tsv ON artigos USING GIN (tsv);
"""


def main() -> None:
    print("Conectando ao PostgreSQL...")
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(DDL)
        conn.commit()
    print("Schema criado com sucesso.")
    print("  extensões : vector, pg_trgm")
    print("  tabelas   : eventos, artigos")
    print("  índices   : GIN (payload), GIN (tsv), HNSW (embedding)")


if __name__ == "__main__":
    main()
