#!/usr/bin/env bash
# Demo Cassandra (wide-column) — IoT time-series
# Uso: bash scripts/06-cassandra-demo.sh
# Pré-requisito: docker compose --profile col up -d
#                (espere ~60s pelo Cassandra inicializar)

set -e

WAIT_SECS=60
echo "============================================================"
echo " CASSANDRA — Modelo Coluna (Wide-Column)"
echo "============================================================"
echo ""
echo "[wait] Aguardando Cassandra ficar pronto (até ${WAIT_SECS}s)..."
for i in $(seq 1 ${WAIT_SECS}); do
  if docker exec aula07-cassandra cqlsh -e 'describe cluster' > /dev/null 2>&1; then
    echo "[ok] Cassandra está pronto."
    break
  fi
  sleep 1
done

echo ""
echo "============================================================"
echo " 1. Criar keyspace (≈ database) com replicação configurada"
echo "============================================================"
docker exec -i aula07-cassandra cqlsh <<'EOF'
DROP KEYSPACE IF EXISTS iot;

CREATE KEYSPACE iot WITH replication = {
  'class': 'SimpleStrategy',
  'replication_factor': 1
};

USE iot;

-- Tabela de leituras de sensores:
--   partition key: device_id   (define onde o dado fica fisicamente)
--   clustering key: ts DESC    (ordena dentro da partição)
CREATE TABLE leituras (
    device_id   text,
    ts          timestamp,
    temperatura double,
    umidade     double,
    PRIMARY KEY ((device_id), ts)
) WITH CLUSTERING ORDER BY (ts DESC);

DESCRIBE TABLE leituras;
EOF

echo ""
echo "============================================================"
echo " 2. Inserir leituras (300 pontos, 3 dispositivos × 100)"
echo "============================================================"
docker exec -i aula07-cassandra cqlsh <<'EOF'
USE iot;
-- Inserts gerados via Bash teriam dezenas de linhas; aqui um conjunto demo
INSERT INTO leituras (device_id, ts, temperatura, umidade) VALUES ('s01', '2026-05-04 10:00:00', 28.5, 60.2);
INSERT INTO leituras (device_id, ts, temperatura, umidade) VALUES ('s01', '2026-05-04 10:01:00', 28.7, 60.5);
INSERT INTO leituras (device_id, ts, temperatura, umidade) VALUES ('s01', '2026-05-04 10:02:00', 28.9, 60.8);
INSERT INTO leituras (device_id, ts, temperatura, umidade) VALUES ('s01', '2026-05-04 10:03:00', 29.1, 61.0);
INSERT INTO leituras (device_id, ts, temperatura, umidade) VALUES ('s01', '2026-05-04 10:04:00', 29.3, 61.2);
INSERT INTO leituras (device_id, ts, temperatura, umidade) VALUES ('s02', '2026-05-04 10:00:00', 22.1, 45.0);
INSERT INTO leituras (device_id, ts, temperatura, umidade) VALUES ('s02', '2026-05-04 10:01:00', 22.3, 45.5);
INSERT INTO leituras (device_id, ts, temperatura, umidade) VALUES ('s02', '2026-05-04 10:02:00', 22.5, 46.1);
INSERT INTO leituras (device_id, ts, temperatura, umidade) VALUES ('s03', '2026-05-04 10:00:00', 35.8, 80.3);
INSERT INTO leituras (device_id, ts, temperatura, umidade) VALUES ('s03', '2026-05-04 10:01:00', 36.0, 80.5);
EOF

echo ""
echo "============================================================"
echo " 3. Query EFICIENTE — usa partition key (device_id)"
echo "============================================================"
docker exec -i aula07-cassandra cqlsh <<'EOF'
USE iot;
-- Pergunta: últimas leituras de um dispositivo específico
SELECT device_id, ts, temperatura, umidade
FROM leituras
WHERE device_id = 's01'
LIMIT 5;
EOF

echo ""
echo "============================================================"
echo " 4. Query EFICIENTE — partition + clustering range"
echo "============================================================"
docker exec -i aula07-cassandra cqlsh <<'EOF'
USE iot;
-- Pergunta: leituras de s01 nos primeiros 3 minutos
SELECT device_id, ts, temperatura
FROM leituras
WHERE device_id = 's01'
  AND ts >= '2026-05-04 10:00:00'
  AND ts <= '2026-05-04 10:02:00';
EOF

echo ""
echo "============================================================"
echo " 5. Query INEFICIENTE — sem partition key"
echo "============================================================"
echo "[esperado] Cassandra recusa porque seria scan global..."
docker exec -i aula07-cassandra cqlsh <<'EOF' || true
USE iot;
-- Esta query DEVE falhar:
SELECT * FROM leituras WHERE temperatura > 30;
EOF

echo ""
echo "[explicação] Para forçar, precisaria 'ALLOW FILTERING' — em produção isso"
echo "             é anti-pattern: lê todas as partições do cluster."
echo ""
docker exec -i aula07-cassandra cqlsh <<'EOF' || true
USE iot;
SELECT device_id, ts, temperatura FROM leituras WHERE temperatura > 30 ALLOW FILTERING;
EOF

echo ""
echo "============================================================"
echo " OBSERVAÇÃO — TRADE-OFFS DO MODELO COLUNA"
echo "============================================================"
echo "  ✓ Excelente para time-series com queries por chave de dispositivo"
echo "  ✓ Insert throughput extremo — milhões/s em cluster"
echo "  ✗ Queries ad-hoc por atributos arbitrários são caras"
echo "  ✗ Modelagem deve ser feita PARA AS QUERIES esperadas (denormalizar)"
echo ""
echo "  Regra: 'Não modele os dados, modele as queries'"
echo ""
echo "  Casos reais: Netflix (viewing history), Discord/Apple (mensagens),"
echo "               Instagram (feeds), Uber (geolocation)."
