#!/usr/bin/env bash
# Tour da aula 08 — Relacionamentos e Schema Design no MongoDB (modo aula)
# Uso: bash scripts/00-tour-completo.sh
#
# Pre-requisito: docker compose --profile doc up -d  (espere o healthcheck)

set -e
cd "$(dirname "$0")/.."

MONGO="docker exec -i aula08-mongo mongosh --quiet"

cat <<'BANNER'

╔══════════════════════════════════════════════════════════════╗
║   RELACIONAMENTOS NO MONGODB — Aula 08 IFPB                  ║
║                                                              ║
║   1. Seed do dominio livraria                                ║
║   2. Embedding vs Referencia (dot notation, $elemMatch)      ║
║   3. $lookup (join no aggregation pipeline)                  ║
║   4. $graphLookup (travessia recursiva)                      ║
║   5. Patterns: Extended Reference + Subset                   ║
║   6. Patterns: Bucket, Computed, Versioning, Outlier         ║
║   7. Indices + explain() (COLLSCAN vs IXSCAN)                ║
║                                                              ║
║   Pause com Enter entre os blocos para discussao.            ║
╚══════════════════════════════════════════════════════════════╝

BANNER

read -p "Enter para [1] SEED do dominio livraria..." _
$MONGO < scripts/01-seed-livraria.js

echo ""; read -p "Enter para [2] EMBEDDING vs REFERENCIA..." _
$MONGO < scripts/02-embedding-vs-referencia.js

echo ""; read -p "Enter para [3] \$lookup..." _
$MONGO < scripts/03-lookup.js

echo ""; read -p "Enter para [4] \$graphLookup..." _
$MONGO < scripts/04-graphlookup.js

echo ""; read -p "Enter para [5] Patterns: Extended Reference + Subset..." _
$MONGO < scripts/05-pattern-extended-reference-subset.js

echo ""; read -p "Enter para [6] Patterns: Bucket/Computed/Versioning/Outlier..." _
$MONGO < scripts/06-pattern-bucket-computed-versioning-outlier.js

echo ""; read -p "Enter para [7] Indices + explain()..." _
$MONGO < scripts/07-indices-explain.js

cat <<'BANNER'

╔══════════════════════════════════════════════════════════════╗
║                       FIM DO TOUR                            ║
║                                                              ║
║   UI Mongo Express:  http://localhost:8081  (admin/admin)    ║
║   Bancos criados: livraria, loja, rh, patterns               ║
║                                                              ║
║   Encerrar:  docker compose --profile doc down -v            ║
╚══════════════════════════════════════════════════════════════╝

BANNER
