# Aula 05: Evolução dos Modelos de Representação e Persistência

> **Tese central:** a fronteira entre SQL e NoSQL está se dissolvendo.
> O futuro não é escolher um ou outro — é um banco **multimodelo** que serve múltiplos paradigmas
> sob a mesma engine. O PostgreSQL é o melhor exemplo vivo disso.

---

## Arco Histórico

```text
                     EVOLUÇÃO DOS MODELOS DE PERSISTÊNCIA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  1970s           1990s          2005–2015       2015–hoje       Futuro
    │               │                │               │              │
    ▼               ▼                ▼               ▼              ▼
┌────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐   ┌──────────┐
│Relaci- │    │Objeto-   │    │  NoSQL   │    │ NewSQL + │   │Multimodel│
│onal    │───▶│Relacional│───▶│(BASE,    │───▶│Multimodel│──▶│+ AI-native│
│(ACID,  │    │(OR/M,    │    │eventual  │    │(Spanner, │   │(pgvector,│
│Codd)   │    │OODBMS)   │    │consist.) │    │CockroachDB│  │LLM+SQL)  │
└────────┘    └──────────┘    └──────────┘    └──────────┘   └──────────┘
     │               │               │               │
     │ PROBLEMA:     │ PROBLEMA:      │ PROBLEMA:     │
     │ escala web    │ impedance      │ sem JOINs,    │
     │ volume/vel.   │ mismatch       │ sem ACID      │
     └───────────────┴────────────────┴───────────────┘
                     Cada onda resolveu o problema da onda anterior,
                     mas criou novos trade-offs.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Arquitetura do Exemplo

```text
                    POSTGRESQL COMO PLATAFORMA MULTIMODELO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  demo_jsonb.py ──────────────────────────────────────┐
  demo_pgvector.py ──── psycopg2 ──► PostgreSQL 17    │
  demo_hybrid_search.py ──────────────────────────────┘
                                         │
                     ┌───────────────────┼───────────────────┐
                     │                   │                   │
              ┌──────▼──────┐   ┌────────▼───────┐  ┌───────▼──────┐
              │  JSONB +    │   │  pgvector +    │  │  FTS (tsv) + │
              │  GIN index  │   │  HNSW index    │  │  GIN index   │
              │  (NoSQL     │   │  (banco        │  │  Híbrido     │
              │   dentro    │   │   vetorial     │  │  RRF fusion  │
              │   do SQL)   │   │   embutido)    │  │              │
              └─────────────┘   └────────────────┘  └──────────────┘
                     │                   │                   │
              ┌──────▼───────────────────▼───────────────────▼──────┐
              │            MESMA ENGINE, MESMA CONEXÃO,             │
              │            MESMO BACKUP, MESMO ACID                 │
              └──────────────────────────────────────────────────────┘

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Conceitos demonstrados

- **JSONB** — dados semi-estruturados com índice GIN para queries flexíveis
- **pgvector** — embeddings vetoriais com busca por similaridade (cosine, L2, inner product)
- **HNSW vs IVFFlat** — trade-offs entre índices vetoriais aproximados
- **Full-Text Search (FTS)** — `tsvector`/`tsquery` com ranking nativo
- **Busca Híbrida (RRF)** — Reciprocal Rank Fusion combinando FTS + vetorial
- **NewSQL** — visão comparativa: CockroachDB, TiDB, Spanner

---

## Pré-requisitos

- Docker e Docker Compose
- Python 3.10 a 3.12
- ~4 GB de RAM disponível para o container

---

## 1. Subir a dependência

```bash
cd exemplos/aula-05-modelos-persistencia
docker compose up -d
```

Aguarde o PostgreSQL ficar saudável:

```bash
docker compose ps          # STATUS: healthy
docker compose logs -f db  # aguardar "database system is ready to accept connections"
```

Serviços disponíveis:

| Serviço      | Endereço                  |
|--------------|---------------------------|
| PostgreSQL   | `localhost:5432`          |
| pgAdmin 4    | `http://localhost:5050`   |

Credenciais pgAdmin: `admin@aula05.local` / `admin`.
Servidor cadastrado automaticamente como `aula05-postgres`.

---

## 2. Instalar dependências Python

```bash
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

> `sentence-transformers` baixa o modelo `all-MiniLM-L6-v2` (~80 MB)
> na primeira execução. Isso é esperado.

---

## 3. Criar o schema no banco

```bash
cd exemplos/aula-05-modelos-persistencia
source .venv/bin/activate
python setup_schema.py
```

O script cria as extensões `vector` e `pg_trgm`, as tabelas e os índices.

---

## 4. Demo 1 — JSONB: o NoSQL dentro do relacional

```bash
python demo_jsonb.py
```

### O que demonstra

```text
  DADOS SEMI-ESTRUTURADOS COM SCHEMA FLEXÍVEL
  ─────────────────────────────────────────────────────────────
  Tabela: eventos
  ┌─────┬──────────────┬──────────────────────────────────────┐
  │ id  │ tipo         │ payload (JSONB)                      │
  ├─────┼──────────────┼──────────────────────────────────────┤
  │  1  │ sensor_temp  │ {"device":"s01","temp":28.5}         │
  │  2  │ user_action  │ {"user_id":42,"action":"click",...}  │
  │  3  │ pedido       │ {"items":[...],"total":199.90}       │
  └─────┴──────────────┴──────────────────────────────────────┘
         │                     │
         │ SELECT + WHERE       │ @> operador containment
         │ sobre campos JSON    │ (busca aninhada)
         ▼                     ▼
    GIN index — O(log n) para containment queries
```

Capacidades demonstradas:

- Inserção de eventos com schemas heterogêneos na mesma tabela
- Operadores `->`, `->>`, `@>`, `#>>` para navegar no JSON
- Índice GIN sobre `payload` para buscas eficientes
- JOIN entre tabela JSONB e tabela relacional convencional
- Diferença entre `json` (texto) e `jsonb` (binário indexável)

---

## 5. Demo 2 — pgvector: banco vetorial integrado

```bash
python demo_pgvector.py
```

### Índices vetoriais: HNSW vs IVFFlat

```text
  COMPARATIVO DE ÍNDICES VETORIAIS
  ───────────────────────────────────────────────────────────────
                  HNSW                      IVFFlat
              (Hierarchical              (Inverted File
           Navigable Small World)           Flat Index)
  ┌────────────────────────┐    ┌────────────────────────────┐
  │  Grafo de múltiplas    │    │  Clusters (Voronoi cells)  │
  │  camadas               │    │                            │
  │                        │    │  ┌───┐ ┌───┐ ┌───┐        │
  │  L3: ●─────────●       │    │  │ C1│ │ C2│ │ C3│        │
  │       │         │       │    │  └───┘ └───┘ └───┘        │
  │  L2: ●───●─────●─●     │    │   Busca nos top-k         │
  │       │   │    │  │     │    │   clusters mais próximos  │
  │  L1: ●─●─●─●──●─●─●   │    │                            │
  └────────────────────────┘    └────────────────────────────┘
  
  Build time:  mais lento          mais rápido
  Query time:  mais rápido         mais lento
  Memória:     mais alta           mais baixa
  Recall:      ≥ IVFFlat           bom mas variável
  Recomendado: produção/consulta   datasets grandes, indexação
  
  Parâmetro chave HNSW: m (conexões por nó), ef_construction
  Parâmetro chave IVFFlat: lists (nº de clusters), probes
  ───────────────────────────────────────────────────────────────
  Fonte: Malkov & Yashunin (2020), IEEE TPAMI
```

Capacidades demonstradas:

- Geração de embeddings com `sentence-transformers/all-MiniLM-L6-v2` (384 dims)
- Operadores `<=>` (cosine), `<->` (L2), `<#>` (inner product)
- Criação de índice HNSW com parâmetros configuráveis
- Top-k nearest neighbor com `ORDER BY ... LIMIT`
- Combinação de busca vetorial + filtros SQL na mesma query

---

## 6. Demo 3 — Busca Híbrida com Reciprocal Rank Fusion

```bash
python demo_hybrid_search.py
```

### Pipeline de Busca Híbrida

```text
  RECIPROCAL RANK FUSION (RRF)
  ─────────────────────────────────────────────────────────────────
  
  Query do usuário: "lakehouse arquitetura delta"
         │
         ├──────────────────────┬────────────────────────
         │                      │
         ▼                      ▼
  ┌─────────────┐         ┌───────────────┐
  │ FTS (léxico)│         │ Vetorial      │
  │ ts_rank()   │         │ embedding <=> │
  │ tsvector @@  │         │ cosine dist.  │
  │ tsquery      │         │ HNSW index   │
  └──────┬──────┘         └──────┬────────┘
         │                        │
         ▼                        ▼
  doc_A: rank 1             doc_C: rank 1
  doc_C: rank 2             doc_A: rank 3
  doc_B: rank 4             doc_B: rank 2
         │                        │
         └──────────┬─────────────┘
                    ▼
         RRF(d) = Σ  1 / (k + rank_i(d))
                 i       k = 60 (constante de suavização)
                    │
                    ▼
         doc_A: 1/(60+1) + 1/(60+3) = 0.0164 + 0.0154 = 0.0318
         doc_C: 1/(60+2) + 1/(60+1) = 0.0161 + 0.0164 = 0.0325 ← winner
         doc_B: 1/(60+4) + 1/(60+2) = 0.0156 + 0.0161 = 0.0317
  
  Referência: Cormack et al. (2009) — SIGIR
  ─────────────────────────────────────────────────────────────────
```

Capacidades demonstradas:

- `tsvector` gerado como coluna computed/stored
- Índice GIN sobre `tsvector`
- `ts_rank()` e `ts_headline()` para ranking e highlight
- RRF em pure SQL via CTEs (sem extensão extra)
- Comparativo: FTS apenas vs vetorial apenas vs híbrido

---

## NewSQL: convergência distribuída

```text
  COMPARATIVO NEWSSQL
  ─────────────────────────────────────────────────────────────────
  
               PostgreSQL        CockroachDB         TiDB
               (referência)      (Spanner-like)      (HTAP)
  ┌──────────┬───────────────┬───────────────────┬──────────────┐
  │ SQL      │ completo      │ completo          │ MySQL compat │
  │ ACID     │ sim           │ serializable      │ sim          │
  │ Escala   │ vertical      │ horizontal auto   │ horiz.(HTAP) │
  │ Consensus│ n/a           │ Raft por range    │ Raft (TiKV)  │
  │ Sharding │ manual/Citus  │ automático        │ automático   │
  │ OLAP     │ extensões     │ limitado          │ TiFlash col. │
  │ Latência │ < 1ms local   │ 5–50ms (Raft)     │ 5–20ms       │
  │ Uso ideal│ maioria dos   │ multi-region,     │ cargas mistas│
  │          │ workloads     │ alta disponib.    │ OLTP+OLAP    │
  └──────────┴───────────────┴───────────────────┴──────────────┘
  
  ⚠  Para a maioria das dissertações e sistemas reais:
     um PostgreSQL bem configurado + read replicas supera
     a complexidade operacional de qualquer NewSQL.
  ─────────────────────────────────────────────────────────────────
```

---

## Convergência multimodelo (panorama 2024–2025)

```text
  CADA BANCO ABSORVENDO PARADIGMAS DOS OUTROS
  ─────────────────────────────────────────────────────────────────
  
  PostgreSQL ──► relacional + JSONB + vetorial + FTS + geoespacial
                              + séries temporais (TimescaleDB)
  
  MongoDB    ──► documentos + ACID multi-doc (v4.0+)
                            + Atlas Search + Atlas Vector Search
  
  Redis      ──► cache + RedisJSON + RediSearch + RedisGraph
                       + RedisTimeSeries + RedisAI
  
  DuckDB     ──► OLAP embarcado + SQL + Parquet/CSV/JSON nativos
                 "o SQLite para analytics" (Raasveldt & Mühleisen, 2019)
  
  Snowflake  ──► warehouse + VARIANT(JSON) + Cortex (vetorial+LLM)
  
                      ┌─────────────────────────────┐
                      │  A especialização ainda tem  │
                      │  lugar para cargas extremas: │
                      │  Qdrant/Pinecone (vetorial)  │
                      │  Neo4j (grafos complexos)    │
                      │  InfluxDB (IoT time-series)  │
                      │  Mas o custo de manutenção   │
                      │  de 3 bancos vs 1 importa.   │
                      └─────────────────────────────┘
  ─────────────────────────────────────────────────────────────────
```

---

## Perguntas para discussão em aula

1. **Trade-off de especialização**: quando vale manter Pinecone separado do PostgreSQL para busca vetorial? Qual é o ponto de inflexão de volume?
2. **Impedance mismatch 2.0**: os ORMs resolveram o mismatch objeto-relacional. Como lidar com o mismatch entre modelos vetoriais e relacionais?
3. **Benchmarking justo**: como comparar PostgreSQL+pgvector vs Qdrant de forma metodologicamente correta? (ver ANN Benchmarks — Aumuller et al., 2020)
4. **Hybrid search ótimo**: o peso ideal entre FTS e vetorial é universal ou domain-specific? Como medir?

---

## Saídas produzidas

```text
data/
├── jsonb_results.json        # resultados das queries JSONB
├── vector_search_results.json # top-k por similaridade semântica
└── hybrid_search_results.json # resultados fusão RRF
```

---

## Exemplos de uso em aula

### 1. JSONB vs coluna relacional

Mostra quando normalizar (dado estável, queries previsíveis) vs usar JSONB (schema evolui, dados heterogêneos).

### 2. pgvector para RAG

Mostra o padrão Retrieval-Augmented Generation sem precisar de Pinecone ou Qdrant — tudo dentro do PostgreSQL.

### 3. Busca híbrida RRF

Demonstra que busca léxica e semântica são complementares. Usuário digita "banco de dados distribuído" — FTS acha a palavra exata, vetorial acha o conceito mesmo com termos diferentes.

### 4. Convergência multimodelo

Discute quando adicionar um banco especializado justifica o custo operacional.

---

## Limpar dados gerados

```bash
rm -rf data
mkdir -p data
```

Para resetar o banco:

```bash
docker compose down -v
docker compose up -d
python setup_schema.py
```

---

## Encerrar serviços

```bash
docker compose down
```

---

## Referências científicas

| Referência | Relevância |
|---|---|
| Codd, E.F. (1970). *A Relational Model of Data for Large Shared Data Banks*. CACM. | Fundação do modelo relacional |
| Chang et al. (2006). *Bigtable: A Distributed Storage System*. OSDI. | Primeira grande ruptura NoSQL |
| DeCandia et al. (2007). *Dynamo: Amazon's Highly Available Key-value Store*. SOSP. | BASE e eventual consistency |
| Corbett et al. (2012). *Spanner: Google's Globally-Distributed Database*. OSDI. | TrueTime, NewSQL distribuído |
| Pavlo & Aslett (2016). *What's Really New with NewSQL?* SIGMOD Record. | Taxonomia definitiva do NewSQL |
| Malkov & Yashunin (2020). *Efficient and Robust Approximate Nearest Neighbor Search Using HNSW*. IEEE TPAMI. | Fundação do índice HNSW |
| Cormack, Clarke & Buettcher (2009). *Reciprocal Rank Fusion outperforms Condorcet and individual rank learning methods*. SIGIR. | Base do RRF para hybrid search |
| Aumuller et al. (2020). *ANN-Benchmarks: A Benchmarking Tool for Approximate Nearest Neighbor Algorithms*. IS Journal. | Metodologia de benchmark vetorial |
| Raasveldt & Mühleisen (2019). *DuckDB: an Embeddable Analytical Database*. SIGMOD. | OLAP embarcado |
| Johnson et al. (2021). *Billion-scale similarity search with GPUs (Faiss)*. IEEE Big Data. | Índices vetoriais em escala |
