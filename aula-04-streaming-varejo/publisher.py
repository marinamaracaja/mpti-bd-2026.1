from __future__ import annotations

import argparse
import json
import random
import time
import uuid

from kafka_compat import patch_kafka_vendor_six

patch_kafka_vendor_six()

from kafka import KafkaProducer

from common import BOOTSTRAP_SERVERS, TOPIC_NAME, utc_now_iso

CHANNELS = ["ecommerce", "app", "loja_fisica"]
PAYMENT_METHODS = ["pix", "credito", "debito", "boleto"]
STORE_IDS = ["JP-CENTRO", "JP-SUL", "CG-01"]
SKUS = ["SKU-ARROZ", "SKU-CAFE", "SKU-NOTEBOOK", "SKU-FONE", "SKU-LIVRO"]


def make_order_created() -> dict:
    order_id = str(uuid.uuid4())
    items_count = random.randint(1, 4)
    items = []
    total = 0.0

    for _ in range(items_count):
        quantity = random.randint(1, 3)
        unit_price = round(random.uniform(15, 350), 2)
        total += quantity * unit_price
        items.append(
            {
                "sku": random.choice(SKUS),
                "quantity": quantity,
                "unit_price": unit_price,
            }
        )

    return {
        "event_id": str(uuid.uuid4()),
        "event_type": "order_created",
        "event_time": utc_now_iso(),
        "payload": {
            "order_id": order_id,
            "customer_id": f"CUST-{random.randint(1000, 9999)}",
            "store_id": random.choice(STORE_IDS),
            "channel": random.choice(CHANNELS),
            "items": items,
            "total_amount": round(total, 2),
        },
    }


def make_payment_authorized(existing_order_ids: list[str]) -> dict:
    order_id = random.choice(existing_order_ids) if existing_order_ids else str(uuid.uuid4())
    amount = round(random.uniform(20, 700), 2)
    status = random.choices(["approved", "denied"], weights=[0.85, 0.15], k=1)[0]
    return {
        "event_id": str(uuid.uuid4()),
        "event_type": "payment_authorized",
        "event_time": utc_now_iso(),
        "payload": {
            "order_id": order_id,
            "payment_method": random.choice(PAYMENT_METHODS),
            "amount": amount,
            "status": status,
        },
    }


def make_inventory_updated() -> dict:
    delta = random.randint(-6, 12)
    return {
        "event_id": str(uuid.uuid4()),
        "event_type": "inventory_updated",
        "event_time": utc_now_iso(),
        "payload": {
            "sku": random.choice(SKUS),
            "store_id": random.choice(STORE_IDS),
            "delta": delta,
            "quantity_after": random.randint(0, 80),
        },
    }


def build_event(existing_order_ids: list[str]) -> dict:
    event_type = random.choices(
        ["order_created", "payment_authorized", "inventory_updated"],
        weights=[0.5, 0.3, 0.2],
        k=1,
    )[0]

    if event_type == "order_created":
        event = make_order_created()
        existing_order_ids.append(event["payload"]["order_id"])
        return event
    if event_type == "payment_authorized":
        return make_payment_authorized(existing_order_ids)
    return make_inventory_updated()


def main() -> None:
    parser = argparse.ArgumentParser(description="Publica eventos simulados de varejo em um tópico Kafka.")
    parser.add_argument("--messages", type=int, default=25, help="Quantidade de mensagens a publicar.")
    parser.add_argument("--interval", type=float, default=0.5, help="Intervalo entre mensagens em segundos.")
    args = parser.parse_args()

    producer = KafkaProducer(
        bootstrap_servers=BOOTSTRAP_SERVERS,
        value_serializer=lambda value: json.dumps(value).encode("utf-8"),
    )

    known_order_ids: list[str] = []

    print(f"Conectando em {BOOTSTRAP_SERVERS} e publicando em '{TOPIC_NAME}'")
    for index in range(1, args.messages + 1):
        event = build_event(known_order_ids)
        producer.send(TOPIC_NAME, value=event)
        producer.flush()
        print(f"[{index:03d}] {event['event_type']} -> {json.dumps(event['payload'], ensure_ascii=False)}")
        time.sleep(args.interval)

    print("Publicação concluída.")


if __name__ == "__main__":
    main()
