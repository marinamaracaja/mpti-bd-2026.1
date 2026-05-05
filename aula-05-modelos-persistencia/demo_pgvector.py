"""
demo_pgvector.py
────────────────
Demo 2: pgvector — busca semântica por similaridade de embeddings.

Demonstra:
  - Geração de embeddings com sentence-transformers (all-MiniLM-L6-v2, 384 dims)
  - Inserção de vetores no PostgreSQL via pgvector
  - Operadores <=> (cosine), <-> (L2), <#> (inner product)
  - Top-k nearest neighbor com ORDER BY ... LIMIT
  - Combinação de busca vetorial + filtros SQL na mesma query
  - Diferença entre HNSW (produção) e busca exata (referência)

Referências:
  Malkov & Yashunin (2020). HNSW. IEEE TPAMI.
  Johnson et al. (2021). Faiss. IEEE Big Data.
"""

from __future__ import annotations

import time

import numpy as np
import psycopg2.extras
from sentence_transformers import SentenceTransformer

from common import get_conn, write_results

# ──────────────────────────────────────────────────
# Corpus de artigos simulados — área de BD e sistemas
# ──────────────────────────────────────────────────
ARTIGOS = [
    {
        "titulo": "Spanner: Google's Globally-Distributed Database",
        "area": "newsql",
        "resumo": (
            "Spanner é o banco de dados distribuído globalmente do Google. "
            "Apresenta consistência externa usando TrueTime, clocks atômicos e GPS. "
            "Suporta transações ACID distribuídas com SQL completo."
        ),
        "ano": 2012,
    },
    {
        "titulo": "Dynamo: Amazon's Highly Available Key-value Store",
        "area": "nosql",
        "resumo": (
            "Dynamo é um sistema de armazenamento chave-valor altamente disponível "
            "da Amazon. Utiliza consistent hashing, eventual consistency e BASE. "
            "Inspirou o movimento NoSQL e sistemas como Cassandra."
        ),
        "ano": 2007,
    },
    {
        "titulo": "Bigtable: A Distributed Storage System for Structured Data",
        "area": "nosql",
        "resumo": (
            "Bigtable é um sistema de armazenamento distribuído para dados estruturados "
            "do Google. Usa um modelo de dados esparso, distribuído e persistente. "
            "Influenciou HBase e Cassandra."
        ),
        "ano": 2006,
    },
    {
        "titulo": "What's Really New with NewSQL?",
        "area": "newsql",
        "resumo": (
            "Análise crítica do movimento NewSQL que combina SQL completo e ACID "
            "com escalabilidade horizontal. Categoriza sistemas como CockroachDB, "
            "TiDB e VoltDB. Compara trade-offs com bancos relacionais tradicionais."
        ),
        "ano": 2016,
    },
    {
        "titulo": "DuckDB: an Embeddable Analytical Database",
        "area": "olap",
        "resumo": (
            "DuckDB é um banco OLAP embarcado de alta performance. "
            "Executa queries analíticas diretamente sobre arquivos Parquet e CSV. "
            "Alternativa ao SQLite para cargas analíticas, sem servidor externo."
        ),
        "ano": 2019,
    },
    {
        "titulo": "pgvector: Open-Source Vector Similarity Search for Postgres",
        "area": "vetorial",
        "resumo": (
            "pgvector é uma extensão do PostgreSQL para busca por similaridade vetorial. "
            "Suporta índices HNSW e IVFFlat para busca aproximada eficiente. "
            "Permite combinar busca vetorial com queries SQL relacionais."
        ),
        "ano": 2021,
    },
    {
        "titulo": "Lakehouse: A New Generation of Open Platforms",
        "area": "arquitetura",
        "resumo": (
            "Lakehouse combina flexibilidade de data lakes com performance de warehouses. "
            "Delta Lake e Apache Iceberg implementam ACID sobre object storage. "
            "Unifica cargas OLTP, OLAP e ML numa única plataforma."
        ),
        "ano": 2021,
    },
    {
        "titulo": "Efficient and Robust Approximate Nearest Neighbor Search Using HNSW",
        "area": "vetorial",
        "resumo": (
            "HNSW é um algoritmo de busca aproximada por vizinhos mais próximos "
            "baseado em grafos navegáveis hierárquicos. "
            "Oferece melhor trade-off entre recall e latência que IVFFlat. "
            "Amplamente adotado em bancos vetoriais como pgvector, Qdrant e FAISS."
        ),
        "ano": 2020,
    },
    {
        "titulo": "MongoDB: The Definitive Guide to Document Databases",
        "area": "nosql",
        "resumo": (
            "MongoDB é um banco de dados orientado a documentos. "
            "Armazena dados em formato BSON (JSON binário). "
            "A partir da versão 4.0 suporta transações ACID multi-documento."
        ),
        "ano": 2019,
    },
    {
        "titulo": "CockroachDB: The Resilient Geo-Distributed SQL Database",
        "area": "newsql",
        "resumo": (
            "CockroachDB é um banco SQL distribuído geo-replicado. "
            "Usa Raft consensus por range de dados e isolamento serializável por padrão. "
            "Projetado para sobreviver a falhas de datacenter inteiras."
        ),
        "ano": 2020,
    },
    {
        "titulo": "Hybrid Search Combining BM25 and Dense Retrieval",
        "area": "busca",
        "resumo": (
            "Busca híbrida combina recuperação lexical BM25 com modelos densos de embedding. "
            "Reciprocal Rank Fusion agrega os rankings de forma simples e eficaz. "
            "Supera ambas as abordagens isoladas em benchmarks de retrieval."
        ),
        "ano": 2021,
    },
    {
        "titulo": "Retrieval-Augmented Generation for Knowledge-Intensive NLP",
        "area": "ia",
        "resumo": (
            "RAG combina recuperação de documentos com geração de texto por LLMs. "
            "O componente de recuperação pode usar busca densa com embeddings. "
            "Reduz alucinações ao fundamentar respostas em documentos reais."
        ),
        "ano": 2020,
    },
]


def _sep(title: str) -> None:
    print(f"\n{'─' * 60}")
    print(f"  {title}")
    print("─" * 60)


def main() -> None:
    _sep("Carregando modelo all-MiniLM-L6-v2 (384 dims)")
    model = SentenceTransformer("all-MiniLM-L6-v2")
    print("  Modelo carregado.")

    # ── Gerar embeddings ──────────────────────────────────
    _sep("Gerando embeddings para o corpus")
    textos = [f"{a['titulo']} {a['resumo']}" for a in ARTIGOS]
    embeddings = model.encode(textos, normalize_embeddings=True)
    print(f"  {len(embeddings)} embeddings gerados, shape={embeddings.shape}")

    # ── Inserir no banco ──────────────────────────────────
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute("TRUNCATE artigos RESTART IDENTITY")
        for artigo, emb in zip(ARTIGOS, embeddings):
            cur.execute(
                """
                INSERT INTO artigos (titulo, area, resumo, ano, embedding)
                VALUES (%s, %s, %s, %s, %s)
                """,
                (
                    artigo["titulo"],
                    artigo["area"],
                    artigo["resumo"],
                    artigo["ano"],
                    emb.tolist(),
                ),
            )
        conn.commit()
    print(f"  {len(ARTIGOS)} artigos inseridos com embeddings.")

    # ── Queries de busca por similaridade ─────────────────
    queries = [
        ("bancos distribuídos com ACID e SQL", None),
        ("busca semântica com vetores e embeddings", None),
        ("arquitetura de dados analíticos", None),
        ("busca vetorial em bancos relacionais", "vetorial"),  # filtro por área
    ]

    all_results = {}

    for query_text, area_filter in queries:
        _sep(f"Busca: '{query_text}'" + (f"  [área={area_filter}]" if area_filter else ""))
        q_emb = model.encode([query_text], normalize_embeddings=True)[0]

        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            if area_filter:
                cur.execute(
                    """
                    SELECT titulo, area, ano,
                           1 - (embedding <=> %s::vector) AS similaridade
                    FROM   artigos
                    WHERE  area = %s
                    ORDER  BY embedding <=> %s::vector
                    LIMIT  3
                    """,
                    (q_emb.tolist(), area_filter, q_emb.tolist()),
                )
            else:
                cur.execute(
                    """
                    SELECT titulo, area, ano,
                           1 - (embedding <=> %s::vector) AS similaridade
                    FROM   artigos
                    ORDER  BY embedding <=> %s::vector
                    LIMIT  5
                    """,
                    (q_emb.tolist(), q_emb.tolist()),
                )
            rows = cur.fetchall()

        for i, row in enumerate(rows, 1):
            sim_pct = float(row["similaridade"]) * 100
            print(f"  {i}. [{row['area']}] {row['titulo']} ({row['ano']})  sim={sim_pct:.1f}%")

        all_results[query_text] = [dict(r) for r in rows]

    # ── Comparativo exato vs HNSW ─────────────────────────
    _sep("Comparativo: busca exata vs HNSW (latência)")
    q_text = "bancos de dados para inteligência artificial"
    q_emb = model.encode([q_text], normalize_embeddings=True)[0]

    with conn.cursor() as cur:
        # Desliga o índice para forçar busca exata (sequential scan)
        cur.execute("SET enable_indexscan = off; SET enable_bitmapscan = off;")
        t0 = time.perf_counter()
        cur.execute(
            "SELECT titulo FROM artigos ORDER BY embedding <=> %s::vector LIMIT 3",
            (q_emb.tolist(),),
        )
        cur.fetchall()
        exact_ms = (time.perf_counter() - t0) * 1000

        # Religa os índices
        cur.execute("SET enable_indexscan = on; SET enable_bitmapscan = on;")
        t0 = time.perf_counter()
        cur.execute(
            "SELECT titulo FROM artigos ORDER BY embedding <=> %s::vector LIMIT 3",
            (q_emb.tolist(),),
        )
        cur.fetchall()
        hnsw_ms = (time.perf_counter() - t0) * 1000
        conn.commit()

    print(f"  Corpus: {len(ARTIGOS)} artigos (pequeno — diferença cresce com escala)")
    print(f"  Busca exata (seqscan) : {exact_ms:.2f} ms")
    print(f"  HNSW (aproximado)     : {hnsw_ms:.2f} ms")
    print("  Nota: em corpora > 100k vetores o HNSW ganha de 10–100x.")

    # ── Salvar resultados ─────────────────────────────────
    path = write_results("vector_search_results.json", all_results)
    print(f"\n  Resultados salvos em: {path}")

    conn.close()


if __name__ == "__main__":
    main()
