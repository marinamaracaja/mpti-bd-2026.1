-- ============================================================
-- Aula 05 — Schema completo (referência para uso no pgAdmin)
-- Equivalente ao que setup_schema.py executa programaticamente
-- ============================================================

-- ── Extensões ────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS vector;    -- pgvector (pré-instalado na imagem)
CREATE EXTENSION IF NOT EXISTS pg_trgm;   -- trigram similarity

-- ── Demo 1: JSONB ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS eventos (
    id         SERIAL PRIMARY KEY,
    tipo       VARCHAR(50)  NOT NULL,
    payload    JSONB        NOT NULL,
    created_at TIMESTAMPTZ  DEFAULT now()
);

-- GIN index: operadores @>, ?, ?&, ?| em O(log n)
CREATE INDEX IF NOT EXISTS idx_eventos_payload
    ON eventos USING GIN (payload);

CREATE INDEX IF NOT EXISTS idx_eventos_tipo
    ON eventos (tipo);

-- ── Demo 2 & 3: pgvector + FTS ───────────────────────────────
CREATE TABLE IF NOT EXISTS artigos (
    id        SERIAL PRIMARY KEY,
    titulo    TEXT NOT NULL,
    area      TEXT NOT NULL,
    resumo    TEXT NOT NULL,
    ano       INT,
    -- vetor 384 dims — modelo all-MiniLM-L6-v2
    embedding vector(384),
    -- coluna computed STORED — atualizada automaticamente em INSERT/UPDATE
    tsv       TSVECTOR GENERATED ALWAYS AS (
                  to_tsvector('portuguese', titulo || ' ' || resumo)
              ) STORED
);

-- Índice HNSW para busca vetorial aproximada
--   m=16         : conexões por nó no grafo (↑m = ↑recall, ↑memória)
--   ef_construction=64 : tamanho da lista de candidatos na construção
CREATE INDEX IF NOT EXISTS idx_artigos_hnsw
    ON artigos
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- Índice GIN para Full-Text Search
CREATE INDEX IF NOT EXISTS idx_artigos_tsv
    ON artigos USING GIN (tsv);
