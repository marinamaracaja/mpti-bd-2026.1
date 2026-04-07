# Exemplo Aula 4: Streaming de Eventos de Varejo

Exemplo prático em Python para demonstrar conceitos da aula:

- `publisher` produz eventos de negócio
- `subscriber` consome os eventos
- processamento gera camadas inspiradas em `Bronze`, `Silver` e `Gold`
- `docker-compose` sobe a dependência de mensageria

## Arquitetura do Exemplo

```text
publisher.py -> Redpanda/Kafka -> subscriber.py -> data/bronze
                                            -> data/silver
                                            -> data/gold
```

## Eventos simulados

- `order_created`
- `payment_authorized`
- `inventory_updated`

## Pré-requisitos

- Docker e Docker Compose
- Python 3.10 a 3.12

`kafka-python==2.0.2` não funciona corretamente com Python 3.13 neste exemplo.
Se você criar a virtualenv com Python 3.13, o import do `subscriber.py` e do
`publisher.py` pode falhar com `ModuleNotFoundError: No module named 'kafka.vendor.six.moves'`.

## 1. Subir a dependência

```bash
cd exemplos/aula-04-streaming-varejo
docker compose up -d
```

O broker ficará disponível em `localhost:19092`.

O console web ficará disponível em `http://localhost:8080`.

## 2. Instalar dependências Python

```bash
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## 3. Rodar o subscriber

Em um terminal:

```bash
cd exemplos/aula-04-streaming-varejo
source .venv/bin/activate
python subscriber.py
```

## 4. Rodar o publisher

Em outro terminal:

```bash
cd exemplos/aula-04-streaming-varejo
source .venv/bin/activate
python publisher.py --messages 40 --interval 0.4
```

## Saídas produzidas

- `data/bronze/events.jsonl`
  - eventos crus como chegaram do broker
- `data/silver/events_normalized.jsonl`
  - eventos normalizados com schema comum
- `data/gold/metrics_snapshot.json`
  - agregados simples para análise

## Exemplos de uso em aula

### 1. Publisher e subscriber

Mostra o padrão básico de event streaming.

### 2. Bronze / Silver / Gold

Mostra que o dado consumido não precisa ir direto para dashboard.

### 3. Processamento em tempo quase real

Mostra atualização contínua de indicadores como:

- total de pedidos
- receita aprovada
- taxa de aprovação de pagamentos
- estoque crítico

## Limpar dados gerados

```bash
rm -rf data
mkdir -p data/bronze data/silver data/gold
```

## Encerrar serviços

```bash
docker compose down
```
