# Aula 08: MongoDB — Relacionamentos e Schema Design

> **Tese central:** schema flexível não é ausência de schema — é uma decisão
> de design **por documento**, guiada pelo *padrão de acesso* (e não pela forma
> normal). Esta demo materializa, em scripts rodáveis, as duas estratégias
> fundamentais (embutir × referenciar), os operadores de junção (`$lookup`,
> `$graphLookup`) e os **Schema Design Patterns** que aparecem nos slides.

---

## Stack

| Serviço | Imagem | Container | Porta | UI Web |
|---|---|---|---|---|
| **MongoDB** | mongo:8.0 | `aula08-mongo` | 27017 | — |
| **Mongo Express** | mongo-express:1.0 | `aula08-mongo-ui` | 8081 | http://localhost:8081 (`admin`/`admin`) |

Um único profile (`doc`) — leve, ~1 GB de RAM.

---

## Pré-requisitos

- Docker e Docker Compose (v2)
- Portas livres: **27017** e **8081**

---

## Subindo o MongoDB

```bash
cd exemplos/aula-08-mongodb-relacionamentos
docker compose --profile doc up -d

# acompanhe o healthcheck até "healthy"
docker compose ps
```

CLI interativo (mongosh):
```bash
docker exec -it aula08-mongo mongosh
```

---

## Demos — rode em ordem

Cada script é independente quando indicado; os que dependem do dataset base
exigem o `01-seed-livraria.js` antes.

```bash
# 1. Seed do domínio livraria (editora, autor, livro, livro_embed, pessoa)
docker exec -i aula08-mongo mongosh < scripts/01-seed-livraria.js

# 2. Embedding vs Referência — dot notation, $all, $size, $elemMatch, custo da duplicação
docker exec -i aula08-mongo mongosh < scripts/02-embedding-vs-referencia.js

# 3. $lookup — application-side join, lookup clássico, $unwind, N:N, pipeline (let/$expr)
docker exec -i aula08-mongo mongosh < scripts/03-lookup.js

# 4. $graphLookup — cadeia de gerência (asc/desc) e árvore de categorias  [seed próprio]
docker exec -i aula08-mongo mongosh < scripts/04-graphlookup.js

# 5. Patterns Extended Reference + Subset (produto com 1000 reviews)
docker exec -i aula08-mongo mongosh < scripts/05-pattern-extended-reference-subset.js

# 6. Patterns Bucket + Computed + Schema Versioning + Outlier  [seed próprio]
docker exec -i aula08-mongo mongosh < scripts/06-pattern-bucket-computed-versioning-outlier.js

# 7. Índices + explain() — COLLSCAN vs IXSCAN, índice composto e regra ESR
docker exec -i aula08-mongo mongosh < scripts/07-indices-explain.js
```

UI para inspecionar visualmente os documentos: http://localhost:8081

---

## Tour completo (modo aula)

Passa pelos 7 blocos em sequência, com pausa (Enter) entre eles para discussão:

```bash
docker compose --profile doc up -d
bash scripts/00-tour-completo.sh
```

---

## Bancos e coleções criados

| Database | Coleções | Demonstra |
|---|---|---|
| `livraria` | editora, autor, livro, livro_embed, pessoa, carro | embedding × referência, `$lookup`, índices |
| `loja` | produtos, reviews | Subset Pattern |
| `rh` | employees, categorias | `$graphLookup` (hierarquia / árvore) |
| `patterns` | leituras, cliente_resumo, pedidos, pessoas, posts, likes_extras | Bucket, Computed, Versioning, Outlier |

---

## Mapa: conceito da aula → arquivo

| Conceito (slide) | Demonstrado em |
|---|---|
| **Dot notation / subdocumento** | `02-embedding-vs-referencia.js` |
| **Arrays: `$all`, `$size`, `$elemMatch`** | `02-embedding-vs-referencia.js` |
| **Embedding × Referência + custo da duplicação** | `02-embedding-vs-referencia.js` |
| **Application-side join (2 queries)** | `03-lookup.js` |
| **`$lookup` clássico + `$unwind`** | `03-lookup.js` |
| **`$lookup` N:N (autores)** | `03-lookup.js` |
| **`$lookup` com pipeline (`let`/`$expr`)** | `03-lookup.js` |
| **`$graphLookup` (recursivo, `maxDepth`, `depthField`)** | `04-graphlookup.js` |
| **Tree Pattern (categorias)** | `04-graphlookup.js` |
| **Extended Reference Pattern** | `05-pattern-extended-reference-subset.js` |
| **Subset Pattern** | `05-pattern-extended-reference-subset.js` |
| **Bucket Pattern** | `06-pattern-bucket-computed-versioning-outlier.js` |
| **Computed Pattern (`$inc` write-time)** | `06-pattern-bucket-computed-versioning-outlier.js` |
| **Schema Versioning Pattern** | `06-pattern-bucket-computed-versioning-outlier.js` |
| **Outlier Pattern** | `06-pattern-bucket-computed-versioning-outlier.js` |
| **Índices, `explain()`, COLLSCAN×IXSCAN, ESR** | `07-indices-explain.js` |

---

## Discussão guiada

1. **Quando embutir e quando referenciar?** No esquema "Aluno ↔ Disciplinas ↔ Notas",
   o que justifica cada escolha pelo padrão de acesso?
2. **Extended Reference × `$lookup`:** quando a duplicação compensa? Como saber se o
   campo duplicado é "estável o suficiente"? (compare com a `updateMany` do script 02)
3. **`$lookup` em escala:** o script 07 mostra COLLSCAN → IXSCAN. Que outras práticas
   evitam que o `$lookup` vire gargalo? (projeção, `$match` antes do lookup, alinhamento de sharding)
4. **`$graphLookup` × banco de grafo dedicado:** a partir de que escala/profundidade
   migrar para Neo4j (visto na aula 07)?
5. **Bucket manual × Time-Series Collections (5.0+):** quando ainda faz sentido bucketar na mão?
6. **MongoDB 8 × PostgreSQL 17 (JSONB + pgvector):** para um app novo em 2026, qual escolher?

---

## Encerrar

```bash
docker compose --profile doc down -v   # remove containers + volume de dados
```

---

## Referências

| Referência | Relevância |
|---|---|
| Coupal, D. (2019). *6 Rules of Thumb for MongoDB Schema Design*. MongoDB Blog | Heurísticas de embedding × referência |
| Coupal, D. & Alger, K. (2019). *Building with Patterns: A Summary*. MongoDB Blog | Os 12 Schema Design Patterns |
| Bradshaw, Brazil & Chodorow (2019). *MongoDB: The Definitive Guide* (3rd ed.). O'Reilly | Cap. 9, Application Design |
| Banker et al. (2016). *MongoDB in Action* (2nd ed.). Manning | Modelagem de documentos |
| MongoDB Manual — *Data Modeling*, *$lookup*, *$graphLookup*, *Time Series Collections* | Documentação oficial |
| Schwartz, B. (2024). *What's New in MongoDB 8.0*. MongoDB Blog | Novidades 8.0 |
