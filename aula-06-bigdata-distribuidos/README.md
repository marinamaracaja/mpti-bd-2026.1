# Aula 06: Big Data e Bancos de Dados Distribuídos

> **Tese central:** distribuir é uma decisão de trade-offs, não um destino.
> Esta demo materializa os dois mecanismos centrais de bancos distribuídos —
> **replicação** (tolerância a falhas) e **particionamento** (escala horizontal) —
> usando MongoDB como caso concreto.

---

## Arco da aula

```text
                  POR QUE BANCOS DISTRIBUÍDOS?
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Volume real        Throughput      Latência global    Regulatório
  (PB ativos)        (10⁵+ w/s)      (multi-DC)         (LGPD/GDPR)
       │                 │                │                  │
       └─────────────────┴────────┬───────┴──────────────────┘
                                  ▼
                    ┌──────────────────────────┐
                    │     SISTEMA DISTRIBUÍDO   │
                    │  ┌─────────┐ ┌─────────┐  │
                    │  │REPLICAÇÃO│ │SHARDING│  │
                    │  └─────────┘ └─────────┘  │
                    └──────────────────────────┘
                                  │
                    ┌─────────────┴─────────────┐
                    ▼                            ▼
            TOLERÂNCIA A FALHAS         ESCALA HORIZONTAL
            DISPONIBILIDADE             THROUGHPUT
            GEO-PROXIMIDADE             VOLUME

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Conceitos demonstrados

- **Replica Set** com 3 nós (MongoDB) — eleições, oplog, failover
- **Write concerns**: `w: 1` vs `w: "majority"`
- **Sharding** com 2 shards + config server + mongos
- **Hash sharding** vs **compound shard key**
- **Targeted query** vs **scatter-gather**
- Distribuição de chunks entre shards

---

## Pré-requisitos

- Docker e Docker Compose
- ~2 GB de RAM disponível para os containers
- Portas livres: 27017–27020, 27118, 27119, 27128

---

## 1. Demo de Replicação

```text
                    REPLICA SET rs0
              ┌─────────────────────────┐
              │    ┌─────────┐          │
              │    │ PRIMARY │ mongo1   │
              │    └────┬────┘          │
              │         │ oplog         │
              │   ┌─────┴─────┐         │
              │   ▼           ▼         │
              │ ┌──────┐   ┌──────┐    │
              │ │SECON.│   │SECON.│    │
              │ │mongo2│   │mongo3│    │
              │ └──────┘   └──────┘    │
              └─────────────────────────┘
```

### Subir o cluster

```bash
cd exemplos/aula-06-bigdata-distribuidos
docker compose -f docker-compose.replica.yml up -d
docker compose -f docker-compose.replica.yml logs rs-init
```

### Verificar o estado

```bash
docker exec -i aula06-mongo1 mongosh < scripts/01-replica-status.js
```

### Inserir com diferentes write concerns

```bash
docker exec -i aula06-mongo1 mongosh < scripts/02-replica-write-test.js
```

### Induzir failover automático

```bash
bash scripts/03-failover-demo.sh
```

O script para o primary, espera 15 segundos, mostra a eleição automática
de um novo primary e religa o nó original (que volta como SECONDARY).

### Testar leitura em secundário

```bash
docker exec -it aula06-mongo2 mongosh --eval '
  db.getMongo().setReadPref("secondary");
  db.getSiblingDB("loja").pedidos.find().limit(5);
'
```

### Encerrar

```bash
docker compose -f docker-compose.replica.yml down -v
```

---

## 2. Demo de Sharding

```text
                    CLUSTER SHARDED
                  ┌─────────────────┐
                  │      mongos     │  ← cliente conecta aqui
                  │  (query router) │
                  └────────┬────────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
       ┌──────────┐  ┌──────────┐ ┌──────────┐
       │ Shard A  │  │ Shard B  │ │ Config   │
       │(mongod)  │  │(mongod)  │ │ Server   │
       └──────────┘  └──────────┘ └──────────┘
       chunks 0..M    chunks M..N   metadata
```

### Subir o cluster sharded

```bash
docker compose -f docker-compose.shard.yml up -d
docker compose -f docker-compose.shard.yml logs shards-init
```

### Configurar sharding

```bash
docker exec -i aula06-mongos mongosh --port 27020 < scripts/04-shard-setup.js
```

### Carregar dados e inspecionar distribuição

```bash
docker exec -i aula06-mongos mongosh --port 27020 < scripts/05-shard-load.js
```

Os comandos finais do script mostram:
- Distribuição de chunks entre shards
- Query *targeted* (1 shard) com `tenant_id` específico
- Query *scatter-gather* (todos shards) sem shard key

### Encerrar

```bash
docker compose -f docker-compose.shard.yml down -v
```

---

## 3. Discussão guiada

### Replicação — perguntas para os alunos

1. **Write concern em produção:** quando vale `w:1` mesmo com risco de perda?
   *Dica: caches, métricas, eventos sem custo crítico.*

2. **Read preference:** quando ler de secundário é seguro?
   *Cuidado com replication lag e leituras stale.*

3. **3 nós ou 5 nós:** que ganho de disponibilidade um quinto nó adiciona?
   *Tolerância a 2 falhas simultâneas vs 1.*

### Sharding — perguntas para os alunos

1. **Shard key escolhida cedo demais:** que sintomas indicam má escolha?
   *Hot shard, scatter-gather frequente, latência crescente.*

2. **Hash vs ranged:** quando a perda de localidade do hash é aceitável?
   *Quando range queries não são padrão dominante.*

3. **Re-sharding em produção:** o quão caro é refazer? Quando vale a pena?

---

## Observações importantes

- **Os `docker-compose.shard.yml` e `docker-compose.replica.yml` não devem ser usados juntos** — usam containers e portas diferentes mas compartilham
  recursos. Subir um, descer, subir o outro.
- O config server e cada shard rodam como replica set de **1 nó** apenas para
  fins didáticos. Em produção, cada shard é um replica set de 3+ nós.
- O write concern padrão do MongoDB 5.0+ é `{ w: "majority" }`. Em versões
  anteriores era `{ w: 1 }` — checar antes de migrar.

---

## Conexão com a teoria

| Conceito da aula | Demonstrado em |
|---|---|
| **Replicação** | `docker-compose.replica.yml` + `01-replica-status.js` |
| **Eleições / Raft** | `03-failover-demo.sh` (induz eleição) |
| **Quóruns / write concerns** | `02-replica-write-test.js` |
| **Sharding hash** | `04-shard-setup.js` (linha `_id: "hashed"`) |
| **Compound shard key** | `04-shard-setup.js` (linha `tenant_id, ts`) |
| **Targeted vs scatter-gather** | `05-shard-load.js` (queries finais) |

---

## Para explorar além

| Tema | Sugestão prática |
|---|---|
| **Open Table Formats** | Subir Iceberg + Trino com `tabulario/iceberg-rest` + DuckDB |
| **Lakehouse** | Databricks Community Edition (gratuito) com Delta |
| **Modern OLAP** | `clickhouse/clickhouse-server` para comparar com MongoDB sharded |
| **Streaming** | Kafka + Flink SQL com sink Iceberg |
| **Single-node renaissance** | DuckDB lendo Parquet de S3 público, mesmo dataset |

---

## Referências científicas

| Referência | Relevância |
|---|---|
| Brewer, E. (2000). *Towards Robust Distributed Systems*. PODC keynote | CAP conjecture |
| Gilbert & Lynch (2002). *Brewer's Conjecture and the Feasibility of CAP*. SIGACT News | Prova formal CAP |
| Abadi, D. (2012). *Consistency Tradeoffs in Modern Distributed Database System Design*. IEEE Computer | PACELC |
| Lamport, L. (1998). *The Part-Time Parliament*. ACM TOCS | Paxos |
| Ongaro & Ousterhout (2014). *In Search of an Understandable Consensus Algorithm*. USENIX ATC | Raft |
| DeCandia et al. (2007). *Dynamo: Amazon's Highly Available Key-value Store*. SOSP | Quóruns, leaderless |
| Shapiro et al. (2011). *Conflict-free Replicated Data Types*. SSS | CRDTs |
| Dean & Ghemawat (2008). *MapReduce: Simplified Data Processing on Large Clusters*. CACM | Fundação Big Data |
| Melnik et al. (2010). *Dremel: Interactive Analysis of Web-Scale Datasets*. VLDB | Base do BigQuery |
| Dageville et al. (2016). *The Snowflake Elastic Data Warehouse*. SIGMOD | Disaggregated warehouse |
| Verbitski et al. (2017). *Amazon Aurora: Design Considerations*. SIGMOD | Storage compartilhado |
| Armbrust et al. (2020). *Delta Lake: High-Performance ACID Table Storage*. VLDB | Delta Lake |
| Armbrust et al. (2021). *Lakehouse: A New Generation of Open Platforms*. CIDR | Lakehouse |
| Carbone et al. (2015). *Apache Flink: Stream and Batch Processing in a Single Engine*. IEEE Bull. | Flink streaming |
| Kreps, Narkhede, Rao (2011). *Kafka: A Distributed Messaging System for Log Processing*. NetDB | Kafka log |
| Tigani, J. (2023). *Big Data is Dead*. MotherDuck | Debate single-node |
| Raasveldt & Mühleisen (2019). *DuckDB: an Embeddable Analytical Database*. SIGMOD | OLAP single-node |
