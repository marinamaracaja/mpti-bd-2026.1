-- ============================================================
-- Demo 3 — Busca Híbrida (FTS + pgvector) com RRF
-- Execute após rodar: python demo_pgvector.py
--
-- Reciprocal Rank Fusion (RRF):
--   RRF(d) = Σ_i  1 / (k + rank_i(d))    k=60 recomendado
--   Cormack et al. (2009) SIGIR
-- ============================================================

-- ── 1. Conferir a coluna tsvector gerada ─────────────────────
SELECT id, titulo,
       tsv
FROM   artigos
LIMIT  3;

-- ── 2. Full-Text Search puro — ts_rank + ts_headline ─────────
SELECT titulo, area,
       ts_rank(tsv, plainto_tsquery('portuguese', 'banco distribuído consistência')) AS score,
       ts_headline('portuguese', resumo,
                   plainto_tsquery('portuguese', 'banco distribuído consistência'),
                   'MaxWords=20, MinWords=5, StartSel=«, StopSel=»') AS trecho
FROM   artigos
WHERE  tsv @@ plainto_tsquery('portuguese', 'banco distribuído consistência')
ORDER  BY score DESC;

-- ── 3. Busca vetorial pura (referência) ───────────────────────
-- Substitua o vetor pela query de interesse (gerado pelo Python)
-- Aqui usamos o embedding do artigo Spanner como proxy de "banco distribuído"
SELECT titulo, area,
       1 - (embedding <=> (SELECT embedding FROM artigos WHERE titulo LIKE '%Spanner%' LIMIT 1)) AS sim
FROM   artigos
ORDER  BY embedding <=> (SELECT embedding FROM artigos WHERE titulo LIKE '%Spanner%' LIMIT 1)
LIMIT  5;

-- ── 4. Busca híbrida RRF — implementação completa ─────────────
-- Substitua plainto_tsquery e o subquery de embedding pela sua query real
WITH query_emb AS (
    -- Embedding da query de busca (aqui: proxy pelo artigo Spanner)
    SELECT embedding AS vec
    FROM   artigos
    WHERE  titulo LIKE '%Spanner%'
    LIMIT  1
),
fts AS (
    SELECT id,
           ROW_NUMBER() OVER (
               ORDER BY ts_rank(tsv, plainto_tsquery('portuguese', 'banco distribuído ACID')) DESC
           ) AS rank
    FROM   artigos
    WHERE  tsv @@ plainto_tsquery('portuguese', 'banco distribuído ACID')
),
vec AS (
    SELECT id,
           ROW_NUMBER() OVER (
               ORDER BY embedding <=> (SELECT vec FROM query_emb)
           ) AS rank
    FROM   artigos
    ORDER  BY embedding <=> (SELECT vec FROM query_emb)
    LIMIT  20
),
rrf AS (
    SELECT
        COALESCE(fts.id, vec.id)                     AS id,
        1.0 / (60 + COALESCE(fts.rank, 1000)) +
        1.0 / (60 + COALESCE(vec.rank, 1000))        AS rrf_score,
        COALESCE(fts.rank, 9999)                     AS fts_rank,
        COALESCE(vec.rank, 9999)                     AS vec_rank
    FROM  fts
    FULL  OUTER JOIN vec ON fts.id = vec.id
)
SELECT a.titulo,
       a.area,
       a.ano,
       r.rrf_score,
       r.fts_rank,
       r.vec_rank
FROM   rrf r
JOIN   artigos a ON a.id = r.id
ORDER  BY r.rrf_score DESC
LIMIT  5;

-- ── 5. Análise: quais artigos aparecem só no FTS, só no vetorial ──
WITH query_emb AS (
    SELECT embedding AS vec FROM artigos WHERE titulo LIKE '%Spanner%' LIMIT 1
),
fts_ids AS (
    SELECT id FROM artigos
    WHERE tsv @@ plainto_tsquery('portuguese', 'banco distribuído')
),
vec_ids AS (
    SELECT id FROM artigos
    ORDER BY embedding <=> (SELECT vec FROM query_emb)
    LIMIT 5
)
SELECT a.titulo, a.area,
       CASE
           WHEN a.id IN (SELECT id FROM fts_ids) AND a.id IN (SELECT id FROM vec_ids) THEN 'ambos'
           WHEN a.id IN (SELECT id FROM fts_ids) THEN 'só FTS'
           WHEN a.id IN (SELECT id FROM vec_ids) THEN 'só vetorial'
       END AS aparece_em
FROM   artigos a
WHERE  a.id IN (SELECT id FROM fts_ids)
    OR a.id IN (SELECT id FROM vec_ids)
ORDER  BY aparece_em, a.titulo;

-- ── 6. Ajuste de peso FTS vs vetorial no RRF ──────────────────
-- Variar o parâmetro k: valores menores = maior influência dos top-1
-- k=10: top-1 domina  |  k=60: fusão mais suave  |  k=100: quase média
WITH query_emb AS (
    SELECT embedding AS vec FROM artigos WHERE titulo LIKE '%Spanner%' LIMIT 1
),
fts AS (
    SELECT id,
           ROW_NUMBER() OVER (ORDER BY ts_rank(tsv, plainto_tsquery('portuguese', 'banco')) DESC) AS rank
    FROM artigos WHERE tsv @@ plainto_tsquery('portuguese', 'banco')
),
vec AS (
    SELECT id,
           ROW_NUMBER() OVER (ORDER BY embedding <=> (SELECT vec FROM query_emb)) AS rank
    FROM artigos ORDER BY embedding <=> (SELECT vec FROM query_emb) LIMIT 20
)
SELECT a.titulo,
       -- k=10
       1.0/(10 + COALESCE(f.rank,1000)) + 1.0/(10 + COALESCE(v.rank,1000)) AS rrf_k10,
       -- k=60 (recomendado)
       1.0/(60 + COALESCE(f.rank,1000)) + 1.0/(60 + COALESCE(v.rank,1000)) AS rrf_k60,
       -- k=100
       1.0/(100+ COALESCE(f.rank,1000)) + 1.0/(100+ COALESCE(v.rank,1000)) AS rrf_k100
FROM artigos a
LEFT JOIN fts f ON a.id = f.id
LEFT JOIN vec v ON a.id = v.id
WHERE f.id IS NOT NULL OR v.id IS NOT NULL
ORDER BY rrf_k60 DESC
LIMIT 5;
