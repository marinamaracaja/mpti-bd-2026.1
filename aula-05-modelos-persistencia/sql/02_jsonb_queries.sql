-- ============================================================
-- Demo 1 — Queries JSONB para exploração no pgAdmin
-- Execute após rodar: python demo_jsonb.py
-- ============================================================

-- ── 1. Visão geral dos dados ─────────────────────────────────
SELECT id, tipo, created_at,
       jsonb_pretty(payload) AS payload_formatado
FROM   eventos
ORDER  BY id;

-- ── 2. Operador -> (retorna JSONB) vs ->> (retorna TEXT) ─────
SELECT
    payload->'device'    AS device_jsonb,    -- tipo: jsonb
    payload->>'device'   AS device_text,     -- tipo: text
    pg_typeof(payload->'device')  AS tipo_json,
    pg_typeof(payload->>'device') AS tipo_texto
FROM eventos
WHERE tipo = 'sensor_temp'
LIMIT 1;

-- ── 3. Filtro por campo numérico no JSON ─────────────────────
SELECT payload->>'device' AS device,
       (payload->>'temp')::float AS temperatura
FROM   eventos
WHERE  tipo = 'sensor_temp'
  AND  (payload->>'temp')::float > 20
ORDER  BY temperatura DESC;

-- ── 4. Containment @> — busca aninhada ───────────────────────
-- Encontra eventos onde metadata.browser = "firefox"
SELECT id, payload
FROM   eventos
WHERE  payload @> '{"metadata": {"browser": "firefox"}}';

-- ── 5. Operador #>> — caminho aninhado como array ────────────
SELECT
    payload #>> '{customer,name}' AS nome_cliente,
    payload #>> '{customer,tier}' AS tier,
    (payload->>'total')::numeric  AS total
FROM eventos
WHERE tipo = 'pedido';

-- ── 6. jsonb_array_elements — iterar array dentro do JSON ────
SELECT
    e.id                       AS pedido_id,
    item->>'sku'               AS sku,
    (item->>'qty')::int        AS quantidade,
    (item->>'price')::numeric  AS preco_unit
FROM   eventos e,
       jsonb_array_elements(e.payload->'items') AS item
WHERE  e.tipo = 'pedido';

-- ── 7. Agregação sobre campo JSON ────────────────────────────
SELECT
    payload->>'payment'              AS metodo_pagamento,
    COUNT(*)                         AS qtd_pedidos,
    SUM((payload->>'total')::numeric) AS receita_total
FROM   eventos
WHERE  tipo = 'pedido'
GROUP  BY payload->>'payment'
ORDER  BY receita_total DESC;

-- ── 8. EXPLAIN ANALYZE — confirmar uso do índice GIN ─────────
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT * FROM eventos
WHERE payload @> '{"metadata": {"browser": "firefox"}}';

-- ── 9. Chaves presentes (introspecção de schema) ─────────────
SELECT DISTINCT jsonb_object_keys(payload) AS chave
FROM   eventos
WHERE  tipo = 'pedido';

-- ── 10. UPDATE de campo específico no JSONB ──────────────────
-- Atualiza apenas um campo sem reescrever o documento inteiro
UPDATE eventos
SET    payload = jsonb_set(payload, '{payment}', '"boleto"')
WHERE  tipo = 'pedido'
  AND  payload->>'payment' = 'pix'
RETURNING id, payload->>'payment' AS novo_pagamento;
