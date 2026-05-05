#!/usr/bin/env bash
# Tour rápido pelos 4 paradigmas (modo aula)
# Uso: bash scripts/00-tour-completo.sh
#
# Pré-requisito: docker compose --profile all up -d  (espere ~90s)

set -e

cd "$(dirname "$0")/.."

cat <<'BANNER'

╔══════════════════════════════════════════════════════════════╗
║       TOUR DOS 4 PARADIGMAS NoSQL — Aula 07 IFPB             ║
║                                                              ║
║   1. Chave-valor   → Redis                                   ║
║   2. Documento     → MongoDB                                 ║
║   3. Coluna        → Cassandra                               ║
║   4. Grafo         → Neo4j                                   ║
║                                                              ║
║   Cada bloco roda em sequência. Pause com Enter entre eles.  ║
╚══════════════════════════════════════════════════════════════╝

BANNER

read -p "Pressione Enter para começar com REDIS (chave-valor)..." _
bash scripts/05-redis-comparativo.sh

echo ""
read -p "Pressione Enter para MONGODB (documento) — load + CRUD + operadores..." _
docker exec -i aula07-mongo mongosh --quiet < scripts/01-load-movies.js
docker exec -i aula07-mongo mongosh --quiet < scripts/02-crud-basico.js
docker exec -i aula07-mongo mongosh --quiet < scripts/03-operadores.js

echo ""
read -p "Pressione Enter para CASSANDRA (coluna)..." _
bash scripts/06-cassandra-demo.sh

echo ""
read -p "Pressione Enter para NEO4J (grafo)..." _
bash scripts/07-neo4j-demo.sh

cat <<'BANNER'

╔══════════════════════════════════════════════════════════════╗
║                       FIM DO TOUR                            ║
║                                                              ║
║   UIs disponíveis:                                           ║
║     MongoDB Express:  http://localhost:8081                  ║
║     RedisInsight:     http://localhost:5540                  ║
║     Neo4j Browser:    http://localhost:7474                  ║
║                                                              ║
║   Para encerrar tudo:                                        ║
║     docker compose --profile all down -v                     ║
╚══════════════════════════════════════════════════════════════╝

BANNER
