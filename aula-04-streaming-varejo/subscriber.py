from __future__ import annotations

import json
from collections import defaultdict

from kafka_compat import patch_kafka_vendor_six

patch_kafka_vendor_six()

from kafka import KafkaConsumer

from common import (
    BOOTSTRAP_SERVERS,
    BRONZE_DIR,
    GOLD_DIR,
    SILVER_DIR,
    TOPIC_NAME,
    append_jsonl,
    ensure_data_dirs,
    utc_now_iso,
    write_json,
)


def normalize_event(event: dict) -> dict:
    event_type = event["event_type"]
    payload = event["payload"]

    normalized = {
        "event_id": event["event_id"],
        "event_type": event_type,
        "event_time": event["event_time"],
        "processed_at": utc_now_iso(),
    }

    if event_type == "order_created":
        normalized.update(
            {
                "order_id": payload["order_id"],
                "store_id": payload["store_id"],
                "customer_id": payload["customer_id"],
                "channel": payload["channel"],
                "amount": payload["total_amount"],
                "sku": None,
                "status": "created",
            }
        )
    elif event_type == "payment_authorized":
        normalized.update(
            {
                "order_id": payload["order_id"],
                "store_id": None,
                "customer_id": None,
                "channel": None,
                "amount": payload["amount"],
                "sku": None,
                "status": payload["status"],
                "payment_method": payload["payment_method"],
            }
        )
    elif event_type == "inventory_updated":
        normalized.update(
            {
                "order_id": None,
                "store_id": payload["store_id"],
                "customer_id": None,
                "channel": None,
                "amount": None,
                "sku": payload["sku"],
                "status": "inventory_changed",
                "quantity_after": payload["quantity_after"],
                "delta": payload["delta"],
            }
        )
    else:
        normalized["status"] = "unknown"

    return normalized


def metrics_snapshot(state: dict) -> dict:
    approvals = state["payments_approved"]
    denials = state["payments_denied"]
    total_payments = approvals + denials
    approval_rate = round((approvals / total_payments) * 100, 2) if total_payments else 0.0

    return {
        "generated_at": utc_now_iso(),
        "total_orders": state["total_orders"],
        "payments_approved": approvals,
        "payments_denied": denials,
        "approval_rate_percent": approval_rate,
        "approved_revenue": round(state["approved_revenue"], 2),
        "orders_per_channel": dict(state["orders_per_channel"]),
        "approved_revenue_per_store": dict(state["approved_revenue_per_store"]),
        "critical_inventory": sorted(state["critical_inventory"]),
    }


def main() -> None:
    ensure_data_dirs()

    consumer = KafkaConsumer(
        TOPIC_NAME,
        bootstrap_servers=BOOTSTRAP_SERVERS,
        auto_offset_reset="earliest",
        enable_auto_commit=True,
        group_id="aula04-subscriber",
        value_deserializer=lambda value: json.loads(value.decode("utf-8")),
    )

    order_store_map: dict[str, str] = {}
    state = {
        "total_orders": 0,
        "payments_approved": 0,
        "payments_denied": 0,
        "approved_revenue": 0.0,
        "orders_per_channel": defaultdict(int),
        "approved_revenue_per_store": defaultdict(float),
        "critical_inventory": set(),
    }

    bronze_path = BRONZE_DIR / "events.jsonl"
    silver_path = SILVER_DIR / "events_normalized.jsonl"
    gold_path = GOLD_DIR / "metrics_snapshot.json"

    print(f"Consumindo tópico '{TOPIC_NAME}' em {BOOTSTRAP_SERVERS}")
    print(f"Bronze: {bronze_path}")
    print(f"Silver: {silver_path}")
    print(f"Gold:   {gold_path}")

    for message in consumer:
        event = message.value
        append_jsonl(bronze_path, event)

        normalized = normalize_event(event)
        append_jsonl(silver_path, normalized)

        event_type = event["event_type"]
        payload = event["payload"]

        if event_type == "order_created":
            state["total_orders"] += 1
            state["orders_per_channel"][payload["channel"]] += 1
            order_store_map[payload["order_id"]] = payload["store_id"]

        elif event_type == "payment_authorized":
            if payload["status"] == "approved":
                state["payments_approved"] += 1
                state["approved_revenue"] += payload["amount"]
                store_id = order_store_map.get(payload["order_id"], "UNKNOWN")
                state["approved_revenue_per_store"][store_id] += payload["amount"]
            else:
                state["payments_denied"] += 1

        elif event_type == "inventory_updated":
            inventory_key = f"{payload['store_id']}:{payload['sku']}"
            if payload["quantity_after"] <= 10:
                state["critical_inventory"].add(inventory_key)
            else:
                state["critical_inventory"].discard(inventory_key)

        snapshot = metrics_snapshot(state)
        write_json(gold_path, snapshot)

        print(
            f"[offset={message.offset}] {event_type} | "
            f"orders={snapshot['total_orders']} | "
            f"approved={snapshot['payments_approved']} | "
            f"revenue={snapshot['approved_revenue']:.2f}"
        )


if __name__ == "__main__":
    main()
