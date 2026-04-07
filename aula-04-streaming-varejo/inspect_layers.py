"""
Inspeção das camadas Bronze / Silver / Gold com DuckDB.

Uso durante a demonstração:
    python inspect_layers.py            # executa todas as consultas
    python inspect_layers.py bronze     # só a camada Bronze
    python inspect_layers.py silver     # só a camada Silver
    python inspect_layers.py gold       # só a camada Gold
    python inspect_layers.py compare    # mesmo evento nas 3 camadas
"""

from __future__ import annotations

import sys

import duckdb

from common import BRONZE_DIR, GOLD_DIR, SILVER_DIR

BRONZE = str(BRONZE_DIR / "events.jsonl")
SILVER = str(SILVER_DIR / "events_normalized.jsonl")
GOLD = str(GOLD_DIR / "metrics_snapshot.json")

SEP = "-" * 60


def section(title: str) -> None:
    print(f"\n{SEP}")
    print(f"  {title}")
    print(SEP)


# ---------------------------------------------------------------------------
# Bronze
# ---------------------------------------------------------------------------

def show_bronze() -> None:
    section("BRONZE — eventos crus (últimos 5)")
    duckdb.sql(f"""
        SELECT event_type, event_time, payload
        FROM '{BRONZE}'
        ORDER BY event_time DESC
        LIMIT 5
    """).show()

    section("BRONZE — contagem por tipo de evento")
    duckdb.sql(f"""
        SELECT event_type, COUNT(*) AS total
        FROM '{BRONZE}'
        GROUP BY event_type
        ORDER BY total DESC
    """).show()


# ---------------------------------------------------------------------------
# Silver
# ---------------------------------------------------------------------------

def show_silver() -> None:
    section("SILVER — eventos normalizados (últimos 5)")
    duckdb.sql(f"""
        SELECT event_type, order_id, store_id, channel, amount, status
        FROM '{SILVER}'
        ORDER BY event_time DESC
        LIMIT 5
    """).show()

    section("SILVER — ticket médio por canal (order_created)")
    duckdb.sql(f"""
        SELECT channel, COUNT(*) AS pedidos, ROUND(AVG(amount), 2) AS ticket_medio
        FROM '{SILVER}'
        WHERE event_type = 'order_created'
          AND channel IS NOT NULL
        GROUP BY channel
        ORDER BY ticket_medio DESC
    """).show()

    section("SILVER — pagamentos aprovados vs negados")
    duckdb.sql(f"""
        SELECT status, COUNT(*) AS total, ROUND(SUM(amount), 2) AS valor_total
        FROM '{SILVER}'
        WHERE event_type = 'payment_authorized'
        GROUP BY status
    """).show()

    section("SILVER — itens com estoque crítico (quantity_after <= 10)")
    duckdb.sql(f"""
        SELECT store_id, sku, delta, quantity_after
        FROM '{SILVER}'
        WHERE event_type = 'inventory_updated'
          AND quantity_after <= 10
        ORDER BY quantity_after
    """).show()


# ---------------------------------------------------------------------------
# Gold
# ---------------------------------------------------------------------------

def show_gold() -> None:
    section("GOLD — snapshot de métricas agregadas")
    duckdb.sql(f"""
        SELECT
            generated_at,
            total_orders,
            payments_approved,
            payments_denied,
            approval_rate_percent,
            approved_revenue
        FROM '{GOLD}'
    """).show()

    section("GOLD — receita aprovada por loja")
    duckdb.sql(f"""
        SELECT
            unnest(map_keys(approved_revenue_per_store))              AS store_id,
            ROUND(unnest(map_values(approved_revenue_per_store)), 2)  AS receita_aprovada
        FROM read_json('{GOLD}', columns={{
            'approved_revenue_per_store': 'MAP(VARCHAR, DOUBLE)'
        }})
        ORDER BY receita_aprovada DESC
    """).show()

    section("GOLD — pedidos por canal")
    duckdb.sql(f"""
        SELECT
            unnest(map_keys(orders_per_channel))   AS canal,
            unnest(map_values(orders_per_channel)) AS pedidos
        FROM read_json('{GOLD}', columns={{
            'orders_per_channel': 'MAP(VARCHAR, BIGINT)'
        }})
        ORDER BY pedidos DESC
    """).show()


# ---------------------------------------------------------------------------
# Comparação — mesmo evento_id nas 3 camadas
# ---------------------------------------------------------------------------

def show_compare() -> None:
    section("COMPARE — mesmo event_id nas camadas Bronze e Silver")

    first_id = duckdb.sql(f"""
        SELECT event_id FROM '{BRONZE}' LIMIT 1
    """).fetchone()[0]

    print(f"\n  event_id: {first_id}\n")

    print("  >> Bronze (cru):")
    duckdb.sql(f"""
        SELECT * FROM '{BRONZE}'
        WHERE event_id = '{first_id}'
    """).show()

    print("  >> Silver (normalizado):")
    duckdb.sql(f"""
        SELECT event_id, event_type, order_id, store_id, amount, status, processed_at
        FROM '{SILVER}'
        WHERE event_id = '{first_id}'
    """).show()

    print("  >> Gold (snapshot gerado após este e todos os eventos anteriores):")
    duckdb.sql(f"""
        SELECT total_orders, approved_revenue, approval_rate_percent
        FROM '{GOLD}'
    """).show()


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

SECTIONS = {
    "bronze": show_bronze,
    "silver": show_silver,
    "gold": show_gold,
    "compare": show_compare,
}

if __name__ == "__main__":
    target = sys.argv[1].lower() if len(sys.argv) > 1 else "all"

    if target == "all":
        for fn in SECTIONS.values():
            fn()
    elif target in SECTIONS:
        SECTIONS[target]()
    else:
        print(f"Argumento inválido: {target!r}")
        print(f"Opções: all, {', '.join(SECTIONS)}")
        sys.exit(1)
