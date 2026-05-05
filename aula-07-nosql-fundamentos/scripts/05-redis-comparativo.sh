#!/usr/bin/env bash
# Demonstra Redis (key-value) lado a lado com MongoDB (document)
# Uso: bash scripts/05-redis-comparativo.sh

set -e

echo "============================================================"
echo " REDIS — Modelo Chave-valor"
echo "============================================================"

echo ""
echo "[Redis] SET / GET simples"
docker exec aula07-redis redis-cli SET "user:42" "Alice"
docker exec aula07-redis redis-cli GET "user:42"

echo ""
echo "[Redis] INCR — contador atômico"
docker exec aula07-redis redis-cli SET "views:home" 0
docker exec aula07-redis redis-cli INCR "views:home"
docker exec aula07-redis redis-cli INCR "views:home"
docker exec aula07-redis redis-cli INCR "views:home"
echo "Total views:"
docker exec aula07-redis redis-cli GET "views:home"

echo ""
echo "[Redis] EXPIRE — TTL"
docker exec aula07-redis redis-cli SET "session:abc" "user_42_token" EX 60
echo "TTL restante (segundos):"
docker exec aula07-redis redis-cli TTL "session:abc"

echo ""
echo "[Redis] Hash — múltiplos campos por chave"
docker exec aula07-redis redis-cli HSET "movie:inception" title "Inception" rating "8.8" year "2010"
echo "Recuperar hash inteiro:"
docker exec aula07-redis redis-cli HGETALL "movie:inception"
echo "Recuperar único campo:"
docker exec aula07-redis redis-cli HGET "movie:inception" rating

echo ""
echo "[Redis] Lista — fila simples"
docker exec aula07-redis redis-cli RPUSH "queue:notif" "n1"
docker exec aula07-redis redis-cli RPUSH "queue:notif" "n2"
docker exec aula07-redis redis-cli RPUSH "queue:notif" "n3"
echo "Tamanho:"
docker exec aula07-redis redis-cli LLEN "queue:notif"
echo "Pop primeiro:"
docker exec aula07-redis redis-cli LPOP "queue:notif"

echo ""
echo "[Redis] Sorted set — leaderboard"
docker exec aula07-redis redis-cli ZADD "leaderboard" 100 "alice" 250 "bob" 175 "carol"
echo "Top 3:"
docker exec aula07-redis redis-cli ZREVRANGE "leaderboard" 0 -1 WITHSCORES

echo ""
echo "============================================================"
echo " MONGODB — Modelo Documento"
echo "============================================================"

echo ""
echo "[Mongo] insertOne"
docker exec aula07-mongo mongosh --quiet --eval '
  db = db.getSiblingDB("comparativo");
  db.users.deleteMany({});
  db.users.insertOne({ _id: 42, name: "Alice", email: "alice@x.com" });
'

echo ""
echo "[Mongo] find (com projeção)"
docker exec aula07-mongo mongosh --quiet --eval '
  db = db.getSiblingDB("comparativo");
  printjson(db.users.findOne({ _id: 42 }));
'

echo ""
echo "[Mongo] $inc — equivalente ao Redis INCR"
docker exec aula07-mongo mongosh --quiet --eval '
  db = db.getSiblingDB("comparativo");
  db.metrics.updateOne(
    { _id: "views:home" },
    { $inc: { count: 1 } },
    { upsert: true }
  );
  db.metrics.updateOne({ _id: "views:home" }, { $inc: { count: 1 } });
  db.metrics.updateOne({ _id: "views:home" }, { $inc: { count: 1 } });
  printjson(db.metrics.findOne({ _id: "views:home" }));
'

echo ""
echo "============================================================"
echo " OBSERVAÇÃO — TRADE-OFFS"
echo "============================================================"
echo "  Redis:   ultra-rápido, mas só recupera por chave conhecida."
echo "  MongoDB: queries por qualquer campo, índices, agregação."
echo "           Redis é cache; Mongo é banco primário."
echo ""
echo "  Para a mesma operação 'ler usuário por id':"
echo "    Redis:  ~0.1ms (RAM)"
echo "    Mongo:  ~1-5ms (disco com índice)"
echo "  Diferença = 1-2 ordens de magnitude para CASO CONHECIDO."
echo "  Para queries não-triviais, Redis exige modelar você mesmo."
