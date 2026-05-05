"""
demo_jsonb.py
─────────────
Demo 1: JSONB — o NoSQL dentro do relacional.

Demonstra:
  - Inserção de eventos com schemas heterogêneos na mesma tabela
  - Operadores ->, ->>, @>, #>> para navegar no JSON
  - Índice GIN para buscas eficientes em JSONB
  - JOIN entre tabela JSONB e tabela relacional convencional

Referência conceitual:
  Stonebraker, M. (2015). "The land sharks are on the squawk box."
  ACM Queue — PostgreSQL JSONB e o fim do NoSQL como alternativa obrigatória.
"""

from __future__ import annotations

import json
import textwrap
from datetime import datetime, timezone

import psycopg2.extras

from common import get_conn, write_results

# ──────────────────────────────────────────────────
# Dados de exemplo — schemas intencionalmente diferentes
# ──────────────────────────────────────────────────
EVENTOS = [
    {
        "tipo": "sensor_temp",
        "payload": {"device": "s01", "location": "sala-A", "temp": 28.5, "unit": "C"},
    },
    {
        "tipo": "sensor_temp",
        "payload": {"device": "s02", "location": "sala-B", "temp": 21.0, "unit": "C"},
    },
    {
        "tipo": "sensor_temp",
        "payload": {"device": "s03", "location": "CPD", "temp": 18.3, "unit": "C"},
    },
    {
        "tipo": "user_action",
        "payload": {
            "user_id": 42,
            "action": "click",
            "page": "/home",
            "metadata": {"browser": "firefox", "os": "linux"},
        },
    },
    {
        "tipo": "user_action",
        "payload": {
            "user_id": 99,
            "action": "purchase",
            "page": "/checkout",
            "items": ["SKU-001", "SKU-042"],
            "total": 199.90,
        },
    },
    {
        "tipo": "pedido",
        "payload": {
            "order_id": "ORD-001",
            "customer": {"name": "Maria Silva", "tier": "gold"},
            "items": [
                {"sku": "SKU-001", "qty": 2, "price": 49.90},
                {"sku": "SKU-042", "qty": 1, "price": 100.10},
            ],
            "total": 199.90,
            "payment": "pix",
        },
    },
    {
        "tipo": "pedido",
        "payload": {
            "order_id": "ORD-002",
            "customer": {"name": "João Ferreira", "tier": "silver"},
            "items": [{"sku": "SKU-007", "qty": 3, "price": 15.00}],
            "total": 45.00,
            "payment": "credito",
        },
    },
]


def _sep(title: str) -> None:
    print(f"\n{'─' * 60}")
    print(f"  {title}")
    print("─" * 60)


def main() -> None:
    conn = get_conn()

    with conn.cursor() as cur:
        # ── Inserção ──────────────────────────────────────────
        _sep("Inserindo eventos com schemas heterogêneos")
        cur.execute("TRUNCATE eventos RESTART IDENTITY")
        for ev in EVENTOS:
            cur.execute(
                "INSERT INTO eventos (tipo, payload) VALUES (%s, %s)",
                (ev["tipo"], json.dumps(ev["payload"])),
            )
        conn.commit()
        print(f"  {len(EVENTOS)} eventos inseridos.")

        # ── Query 1: operador ->> (extrai como texto) ─────────
        _sep("Query 1 — sensores com temperatura > 20°C  (operador ->>)")
        cur.execute(
            """
            SELECT id,
                   payload->>'device'   AS device,
                   payload->>'location' AS location,
                   (payload->>'temp')::float AS temp_c
            FROM   eventos
            WHERE  tipo = 'sensor_temp'
              AND  (payload->>'temp')::float > 20
            ORDER  BY temp_c DESC
            """,
        )
        rows = cur.fetchall()
        for row in rows:
            print(f"  id={row[0]}  device={row[1]}  loc={row[2]}  temp={row[3]}°C")

        # ── Query 2: @> containment (busca aninhada) ──────────
        _sep("Query 2 — usuários com browser 'firefox'  (operador @>)")
        cur.execute(
            """
            SELECT id, payload->>'user_id' AS user_id, payload->>'page' AS page
            FROM   eventos
            WHERE  tipo = 'user_action'
              AND  payload @> '{"metadata": {"browser": "firefox"}}'
            """,
        )
        rows = cur.fetchall()
        for row in rows:
            print(f"  id={row[0]}  user_id={row[1]}  page={row[2]}")

        # ── Query 3: campo aninhado #>> ────────────────────────
        _sep("Query 3 — tier de clientes de pedidos  (operador #>>)")
        cur.execute(
            """
            SELECT id,
                   payload #>> '{customer,name}' AS nome,
                   payload #>> '{customer,tier}' AS tier,
                   (payload->>'total')::numeric   AS total
            FROM   eventos
            WHERE  tipo = 'pedido'
            ORDER  BY total DESC
            """,
        )
        rows = cur.fetchall()
        for row in rows:
            print(f"  id={row[0]}  nome={row[1]}  tier={row[2]}  total=R${row[3]:.2f}")

        # ── Query 4: EXPLAIN mostra uso do índice GIN ─────────
        _sep("Query 4 — EXPLAIN: o índice GIN é usado na busca @>")
        cur.execute(
            """
            EXPLAIN (FORMAT TEXT, COSTS OFF)
            SELECT * FROM eventos
            WHERE payload @> '{"metadata": {"browser": "firefox"}}'
            """,
        )
        plan = cur.fetchall()
        for line in plan:
            print(f"  {line[0]}")

        # ── Query 5: agregação sobre campo JSON ───────────────
        _sep("Query 5 — receita total por método de pagamento (jsonb + GROUP BY)")
        cur.execute(
            """
            SELECT payload->>'payment'       AS metodo,
                   COUNT(*)                  AS qtd_pedidos,
                   SUM((payload->>'total')::numeric) AS receita
            FROM   eventos
            WHERE  tipo = 'pedido'
            GROUP  BY payload->>'payment'
            ORDER  BY receita DESC
            """,
        )
        rows = cur.fetchall()
        for row in rows:
            print(f"  método={row[0]}  pedidos={row[1]}  receita=R${row[2]:.2f}")

        # ── Query 6: jsonb_array_elements (unnest de array JSON) ──
        _sep("Query 6 — itens de todos os pedidos (jsonb_array_elements)")
        cur.execute(
            """
            SELECT e.id,
                   item->>'sku'           AS sku,
                   (item->>'qty')::int    AS qty,
                   (item->>'price')::numeric AS unit_price
            FROM   eventos e,
                   jsonb_array_elements(e.payload->'items') AS item
            WHERE  e.tipo = 'pedido'
            ORDER  BY e.id, sku
            """,
        )
        rows = cur.fetchall()
        for row in rows:
            print(f"  pedido_id={row[0]}  sku={row[1]}  qty={row[2]}  preço=R${row[3]:.2f}")

        # ── Salvar resultado ──────────────────────────────────
        cur.execute(
            """
            SELECT id, tipo,
                   payload,
                   created_at
            FROM   eventos
            ORDER  BY id
            """,
        )
        all_rows = cur.fetchall()

    results = [
        {"id": r[0], "tipo": r[1], "payload": r[2], "created_at": r[3]}
        for r in all_rows
    ]
    path = write_results("jsonb_results.json", results)
    print(f"\n  Resultados salvos em: {path}")
    print("\n  Ponto-chave: tudo isso em SQL puro — sem driver de documento,")
    print("  sem segundo banco, JOIN com tabelas relacionais na mesma query.")

    conn.close()


if __name__ == "__main__":
    main()
