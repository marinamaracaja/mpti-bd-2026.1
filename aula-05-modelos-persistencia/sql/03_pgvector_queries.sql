-- ============================================================
-- Demo 2 — Queries pgvector para exploração no pgAdmin
-- Execute após rodar: python demo_pgvector.py
-- ============================================================

-- ── 1. Verificar extensão e dimensão dos vetores ─────────────
SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';

SELECT id, titulo, area, ano,
       vector_dims(embedding)  AS dims,
       vector_norm(embedding)  AS norma
FROM   artigos
ORDER  BY id;

-- ── 2. Busca por similaridade de cosseno (<=> operator) ───────
-- Nota: substitua o vetor de exemplo por um real gerado pelo Python
-- Este exemplo usa um vetor de 384 dims inicializado com zeros (placeholder)
-- Na prática, use: python demo_pgvector.py para gerar vetores reais

-- Top-5 artigos mais próximos de "artigos de NewSQL" (simulado)
SELECT titulo, area, ano,
       1 - (embedding <=> (SELECT embedding FROM artigos WHERE titulo LIKE '%Spanner%' LIMIT 1)) AS similaridade
FROM   artigos
WHERE  titulo NOT LIKE '%Spanner%'
ORDER  BY similaridade DESC
LIMIT  5;

-- ── 3. Comparativo de operadores de distância ────────────────
SELECT
    a.titulo,
    -- Distância de cosseno: 0 = idêntico, 2 = oposto
    (a.embedding <=> b.embedding)  AS dist_cosine,
    -- Distância Euclidiana (L2)
    (a.embedding <-> b.embedding)  AS dist_l2,
    -- Produto interno negativo (para vetores normalizados = equivale a cosine)
    (a.embedding <#> b.embedding)  AS neg_inner_product
FROM   artigos a
CROSS  JOIN artigos b
WHERE  b.titulo LIKE '%Spanner%'
  AND  a.titulo != b.titulo
ORDER  BY dist_cosine
LIMIT  5;

-- ── 4. Busca vetorial + filtro SQL combinados ────────────────
-- Encontrar artigos similares a Spanner, mas apenas da área 'newsql'
SELECT titulo, area, ano,
       1 - (embedding <=> (SELECT embedding FROM artigos WHERE titulo LIKE '%Spanner%' LIMIT 1)) AS sim
FROM   artigos
WHERE  area = 'newsql'
  AND  titulo NOT LIKE '%Spanner%'
ORDER  BY embedding <=> (SELECT embedding FROM artigos WHERE titulo LIKE '%Spanner%' LIMIT 1)
LIMIT  3;

-- ── 5. EXPLAIN para verificar uso do índice HNSW ─────────────
EXPLAIN (ANALYZE, BUFFERS)
SELECT titulo
FROM   artigos
ORDER  BY embedding <=> (SELECT embedding FROM artigos WHERE titulo LIKE '%Spanner%' LIMIT 1)
LIMIT  5;

-- ── 6. Comparativo: HNSW vs varredura sequencial ─────────────
-- Forçar seq scan (desabilitar índices)
SET enable_indexscan = off;
SET enable_bitmapscan = off;

EXPLAIN (ANALYZE)
SELECT titulo
FROM   artigos
ORDER  BY embedding <=> (SELECT embedding FROM artigos WHERE titulo LIKE '%HNSW%' LIMIT 1)
LIMIT  3;

-- Reabilitar
SET enable_indexscan = on;
SET enable_bitmapscan = on;

-- ── 7. Parâmetro ef_search — controla recall vs latência ─────
-- Valores maiores = mais candidatos examinados = maior recall, maior latência
SET hnsw.ef_search = 40;   -- padrão = 40; aumente para mais recall

EXPLAIN (ANALYZE)
SELECT titulo
FROM   artigos
ORDER  BY embedding <=> (SELECT embedding FROM artigos WHERE titulo LIKE '%HNSW%' LIMIT 1)
LIMIT  3;

-- ── 8. Aritmética vetorial — média de embeddings ─────────────
-- Centroide da área 'nosql' (representa o "tema médio" da área)
SELECT area,
       AVG(embedding)  AS centroide
FROM   artigos
GROUP  BY area;

-- Artigos mais próximos do centroide 'nosql'
SELECT titulo, area,
       1 - (embedding <=> (
           SELECT AVG(embedding) FROM artigos WHERE area = 'nosql'
       )) AS dist_centroide
FROM   artigos
WHERE  area = 'nosql'
ORDER  BY dist_centroide DESC;
