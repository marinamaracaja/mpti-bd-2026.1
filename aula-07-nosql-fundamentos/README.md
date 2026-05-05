# Aula 07: Bancos NoSQL — Fundamentos e Modelos

> **Tese central:** NoSQL nunca foi um produto, foi uma reação. Esta demo
> materializa os **4 paradigmas** com bancos representativos, lado a lado,
> destacando para que cada um foi pensado.

---

## Stack completa por paradigma

| Paradigma | Sistema | Container | Porta | UI Web |
|---|---|---|---|---|
| **Chave-valor** | Redis 7 | `aula07-redis` | 6379 | RedisInsight (`:5540`) |
| **Documento** | MongoDB 7 | `aula07-mongo` | 27017 | Mongo Express (`:8081`) |
| **Coluna (wide-column)** | Cassandra 5 | `aula07-cassandra` | 9042 | (cqlsh CLI) |
| **Grafo** | Neo4j 5 | `aula07-neo4j` | 7474 / 7687 | Neo4j Browser (`:7474`) |

Cada banco roda em **profile separado** do Docker Compose — você só sobe
o que precisa, economizando RAM em sala.

---

## Conceitos demonstrados

### Por paradigma
- **Redis (KV):** `SET`/`GET`, `INCR`, `EXPIRE` (TTL), Hash, List, Sorted Set (leaderboard)
- **MongoDB (doc):** BSON, ObjectID, schema flexível, CRUD completo, operadores `$gt`/`$in`/`$all`/regex/`$exists`/`$or`, agregação `$group`, índices (single/compound/multikey/text), `explain()`
- **Cassandra (col):** keyspace, partition key vs clustering key, query eficiente vs `ALLOW FILTERING`, time-series IoT
- **Neo4j (grafo):** Cypher, multi-hop traversal, `shortestPath`, recomendação por gênero+diretor

### Transversais
- **Comparativo lado a lado** Redis × MongoDB para a mesma operação
- **Trade-offs** explícitos no final de cada demo (✓ pontos fortes, ✗ limitações)

---

## Arquitetura

```text
                 STACK NoSQL — 4 PARADIGMAS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

       ┌──────────────────────────────────────────────────┐
       │  docker-compose.yml  (profiles: kv|doc|col|graph)│
       └──────────────┬───────────────────────────────────┘
                      │
   ┌──────────────┬───┴────────┬───────────────┬───────────────┐
   ▼              ▼            ▼               ▼               ▼
 ┌────┐       ┌──────┐    ┌──────────┐    ┌──────────┐    ┌──────┐
 │REDIS│      │MONGO │    │CASSANDRA │    │  NEO4J   │    │ UIs  │
 │:6379│      │:27017│    │  :9042   │    │ :7474    │    │ web  │
 └─────┘      └──────┘    └──────────┘    └──────────┘    └──────┘
   │            │              │                │
   ▼            ▼              ▼                ▼
 INCR         CRUD/Find     Time-series     Multi-hop
 HSET         operadores    partition        traversal
 ZADD         índices       key                            
 EXPIRE       agregação                                    

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Pré-requisitos

- Docker e Docker Compose (v2)
- Portas livres: **27017**, **6379**, **9042**, **7474**, **7687**, **8081**, **5540**
- RAM:
  - Profile único (`doc` ou `kv`): ~1 GB
  - `col` (Cassandra): ~1.5 GB
  - `graph` (Neo4j): ~1 GB
  - `all`: ~6 GB recomendado

---

## Subindo os bancos por profile

> **Profiles permitem subir só o que você precisa.** Sem profile, nada sobe.

```bash
cd exemplos/aula-07-nosql-fundamentos

# Apenas Redis (chave-valor)
docker compose --profile kv up -d

# Apenas MongoDB + UI (documento)
docker compose --profile doc up -d

# Apenas Cassandra (coluna)
docker compose --profile col up -d
# Cassandra demora ~60s para inicializar — aguarde

# Apenas Neo4j (grafo)
docker compose --profile graph up -d
# Neo4j: ~30s para inicializar

# Tudo (tour completo em sala)
docker compose --profile all up -d
```

Status:
```bash
docker compose ps
```

---

## Demos por paradigma

### 🔑 Redis (chave-valor)

```bash
# Comparativo Redis × MongoDB lado a lado
bash scripts/05-redis-comparativo.sh
```

Demonstra: `SET`/`GET`, `INCR` atômico, `EXPIRE` (TTL), Hash, List (fila),
Sorted Set (leaderboard) — e a mesma operação no MongoDB para comparar.

UI: http://localhost:5540 (RedisInsight)

---

### 📄 MongoDB (documento)

```bash
# 1. Carregar dataset (~30 filmes)
docker exec -i aula07-mongo mongosh < scripts/01-load-movies.js

# 2. CRUD básico — insertOne, $set, $inc, $push, deleteOne
docker exec -i aula07-mongo mongosh < scripts/02-crud-basico.js

# 3. Operadores de query — $gte, $in, $all, regex, $exists, $or, agregação
docker exec -i aula07-mongo mongosh < scripts/03-operadores.js

# 4. Índices e plano de execução com explain()
docker exec -i aula07-mongo mongosh < scripts/04-indexes.js
```

UI: http://localhost:8081 (Mongo Express, login `admin`/`admin`)

---

### 📊 Cassandra (coluna)

```bash
# Demo time-series IoT — 5 etapas
bash scripts/06-cassandra-demo.sh
```

Cobre: keyspace, tabela com **partition key + clustering key**, queries
eficientes (com partition key) vs ineficientes (`ALLOW FILTERING`).

CLI interativo:
```bash
docker exec -it aula07-cassandra cqlsh
```

---

### 🕸 Neo4j (grafo)

```bash
# Demo recomendação multi-hop com Cypher
bash scripts/07-neo4j-demo.sh
```

Cobre: criação de nós/arestas, traversal multi-hop ("atores que trabalharam
com X"), `shortestPath`, recomendação por gênero+diretor, estatísticas.

Browser interativo: http://localhost:7474
(login: `neo4j` / `aula07pass`)

---

## Tour completo (modo aula)

Para apresentação em sala — passa pelos 4 paradigmas em sequência, com
pausa entre eles para discussão:

```bash
docker compose --profile all up -d
# aguarde ~90s pelo Cassandra/Neo4j inicializarem
bash scripts/00-tour-completo.sh
```

---

## Mapa: conceito da aula → arquivo

| Conceito | Demonstrado em |
|---|---|
| **Schema flexível (documento)** | `01-load-movies.js` |
| **CRUD MongoDB** | `02-crud-basico.js` |
| **Operadores de query** | `03-operadores.js` |
| **Agregação `$group`** | `03-operadores.js` (média por país) |
| **Índices e `explain()`** | `04-indexes.js` |
| **Chave-valor** | `05-redis-comparativo.sh` |
| **Comparativo modelos** | `05-redis-comparativo.sh` |
| **Wide-column / time-series** | `06-cassandra-demo.sh` |
| **Partition key vs clustering** | `06-cassandra-demo.sh` |
| **Grafo / Cypher / multi-hop** | `07-neo4j-demo.sh` |
| **Tour pedagógico em sala** | `00-tour-completo.sh` |

---

## Discussão guiada

### 🔑 Sobre Redis

1. **Por que Redis bate qualquer SQL em latência?** RAM-only, single-thread, network-bound.
2. **Como modelar uma "tabela" de usuários no Redis?** Hash por user, ou JSON em string?
3. **Quando Redis vira gargalo?** Working set não cabe em RAM, ou throughput além de ~100k ops/s/core.

### 📄 Sobre MongoDB

1. **Schema flexível é virtude ou armadilha?** Em produção, todo doc acaba com schema implícito.
2. **Embedding vs referência?** Tema da aula 08 — vale a discussão prévia.
3. **Quando uma agregação `$lookup` indica que você devia ter usado SQL?**

### 📊 Sobre Cassandra

1. **Por que "modelar para queries" é o oposto da modelagem relacional?**
2. **Uma shard key mal escolhida em sharding (aula 06) é o mesmo erro que uma partition key errada aqui?**
3. **Onde Cassandra perde para Postgres + TimescaleDB?**

### 🕸 Sobre Neo4j

1. **Por que multi-hop em SQL precisa de N JOINs aninhados?** E o que isso custa?
2. **Limites de Neo4j em escala**: 10⁹ arestas é viável, 10¹⁰ exige sharding manual. Por quê?
3. **GraphRAG** (Microsoft 2024) usa LLMs + grafos. Que problema isso resolve sobre RAG vetorial puro?

### Sobre escolha (transversal)

1. **Polyglot vs colapsar:** quando 3 bancos compensam vs 1 PostgreSQL multimodelo?
2. **Quanta lógica fica do lado da aplicação (NoSQL) vs do banco (SQL)?**
3. **Em 2026, NoSQL ainda faz sentido? Para quais casos especificamente?**

---

## Encerrar

```bash
docker compose --profile all down -v   # apaga TODOS os volumes
# ou por profile:
docker compose --profile col down -v
docker compose --profile graph down -v
```

---

## Para explorar além

| Tópico | Sugestão prática |
|---|---|
| **ScyllaDB** | Drop-in Cassandra-compat C++. `docker run scylladb/scylla` |
| **Couchbase** | Documento + cache + busca. Atlas competitor |
| **DynamoDB Local** | `amazon/dynamodb-local` — para testar API DynamoDB sem AWS |
| **TigerGraph** | Grafo comercial com performance superior em multi-hop |
| **Replica Set Mongo** | `exemplos/aula-06-bigdata-distribuidos/docker-compose.replica.yml` |
| **Sharding Mongo** | `exemplos/aula-06-bigdata-distribuidos/docker-compose.shard.yml` |
| **Atlas Vector Search** | Atlas free tier + `db.<col>.createSearchIndex` |

---

## Referências científicas

| Referência | Relevância |
|---|---|
| Strozzi, C. (1998). *NoSQL: A Relational Database Management System*. | Origem informal do termo |
| Stonebraker, M. (2010). *SQL Databases v. NoSQL Databases*. CACM | Crítica honesta |
| Cattell, R. (2011). *Scalable SQL and NoSQL Data Stores*. SIGMOD Record | Survey |
| Chang et al. (2006). *Bigtable*. OSDI | Wide-column |
| DeCandia et al. (2007). *Dynamo*. SOSP | Key-value distribuído |
| Lakshman & Malik (2010). *Cassandra*. SIGOPS | Cassandra design |
| Banker et al. (2016). *MongoDB in Action*. Manning | MongoDB referência |
| Sadalage & Fowler (2012). *NoSQL Distilled*. Addison-Wesley | Polyglot persistence |
| Robinson, Webber & Eifrem (2015). *Graph Databases*. O'Reilly | Grafos |
| Edge et al. (2024). *From Local to Global: GraphRAG*. Microsoft | Pesquisa atual |
