#!/usr/bin/env bash
# Induz failover parando o primary e mostra eleição automática
# Uso: bash scripts/03-failover-demo.sh

set -e

echo "=== Estado inicial do replica set ==="
docker exec aula06-mongo1 mongosh --quiet --eval '
  const s = rs.status();
  s.members.forEach(m => print(m.name + " -> " + m.stateStr));
'

echo ""
echo "=== Identificando o primary ==="
PRIMARY=$(docker exec aula06-mongo1 mongosh --quiet --eval '
  const s = rs.status();
  const p = s.members.find(m => m.stateStr === "PRIMARY");
  print(p ? p.name.split(":")[0] : "NONE");
' | tail -1)

echo "Primary atual: $PRIMARY"

if [ "$PRIMARY" = "NONE" ]; then
  echo "Nenhum primary encontrado. Aguardando..."
  exit 1
fi

echo ""
echo "=== Parando o primary ($PRIMARY) ==="
docker stop "aula06-$PRIMARY"

echo ""
echo "=== Aguardando eleição (15s) ==="
sleep 15

echo ""
echo "=== Estado após failover ==="
# Conecta a um secundário (mongo2 ou mongo3) que ainda esteja vivo
SURVIVOR="mongo2"
[ "$PRIMARY" = "mongo2" ] && SURVIVOR="mongo3"

docker exec "aula06-$SURVIVOR" mongosh --quiet --eval '
  const s = rs.status();
  s.members.forEach(m => print(m.name + " -> " + m.stateStr + " (health=" + m.health + ")"));
'

echo ""
echo "=== Religando o nó parado ==="
docker start "aula06-$PRIMARY"
sleep 10

echo ""
echo "=== Estado final (nó voltou como SECONDARY) ==="
docker exec "aula06-$SURVIVOR" mongosh --quiet --eval '
  const s = rs.status();
  s.members.forEach(m => print(m.name + " -> " + m.stateStr));
'
