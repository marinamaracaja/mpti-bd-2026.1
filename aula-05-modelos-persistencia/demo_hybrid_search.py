"""
demo_hybrid_search.py
─────────────────────
Demo 3: Busca Híbrida com Reciprocal Rank Fusion (RRF).

Combina busca lexical (FTS nativa do PostgreSQL) com busca semântica
(pgvector) usando Reciprocal Rank Fusion para fundir os rankings.

Demonstra:
  - tsvector gerado como coluna computed STORED
  - ts_rank() para pontuação lexical
  - ts_headline() para highlight de trechos
  - Busca vetorial com cosine distance
  - RRF em pure SQL via CTEs
  - Comparativo: FTS apenas vs vetorial apenas vs híbrido

Referências:
  Cormack, Clarke & Buettcher (2009).
    "Reciprocal Rank Fusion outperforms Condorcet and individual
     rank learning methods." SIGIR '09.

  Ma et al. (2022).
    "Hybrid Dense-Sparse Retrieval for Question Answering." ACL.
"""

from __future__ import annotations

import psycopg2.extras
from sentence_transformers import SentenceTransformer

from common import get_conn, write_results

# Queries de teste — cobrindo casos onde FTS e vetorial diferem
QUERIES = [
    {
        "texto": "banco de dados distribuído com consistência global",
        "descricao": "conceito técnico específico",
    },
    {
        "texto": "HNSW índice vetorial aproximado",
        "descricao": "termos exatos + conceito",
    },
    {
        "texto": "recuperação de informação para sistemas de IA",
        "descricao": "conceito sem terminologia exata no corpus",
    },
    {
        "texto": "escalabilidade horizontal replicação",
        "descricao": "termos técnicos distribuídos",
    },
]

RRF_K = 60  # constante de suavização — Cormack et al. (2009) recomenda 60


def _sep(title: str) -> None:
    print(f"\n{'─' * 60}")
    print(f"  {title}")
    print("─" * 60)


def busca_fts(cur, query_text: str, limit: int = 10) -> list[dict]:
    """Busca lexical com ts_rank e ts_headline."""
    cur.execute(
        """
        SELECT id,
               titulo,
               area,
               ts_rank(tsv, plainto_tsquery('portuguese', %s))  AS score,
               ts_headline('portuguese', resumo,
                           plainto_tsquery('portuguese', %s),
                           'MaxWords=15, MinWords=5, StartSel=«, StopSel=»') AS trecho
        FROM   artigos
        WHERE  tsv @@ plainto_tsquery('portuguese', %s)
        ORDER  BY score DESC
        LIMIT  %s
        """,
        (query_text, query_text, query_text, limit),
    )
    return [dict(r) for r in cur.fetchall()]


def busca_vetorial(cur, query_emb: list[float], limit: int = 10) -> list[dict]:
    """Busca semântica por similaridade de cosseno."""
    cur.execute(
        """
        SELECT id,
               titulo,
               area,
               1 - (embedding <=> %s::vector) AS score
        FROM   artigos
        ORDER  BY embedding <=> %s::vector
        LIMIT  %s
        """,
        (query_emb, query_emb, limit),
    )
    return [dict(r) for r in cur.fetchall()]


def busca_hibrida_rrf(
    cur,
    query_text: str,
    query_emb: list[float],
    limit: int = 5,
    k: int = RRF_K,
) -> list[dict]:
    """
    Busca híbrida via Reciprocal Rank Fusion em pure SQL.

    RRF(d) = Σ_i  1 / (k + rank_i(d))

    Documentos que aparecem em ambas as listas recebem pontuação
    combinada — promovendo resultados com boa cobertura semântica E lexical.
    """
    cur.execute(
        """
        WITH fts AS (
            SELECT id,
                   ROW_NUMBER() OVER (ORDER BY ts_rank(tsv, q) DESC) AS rank
            FROM   artigos,
                   plainto_tsquery('portuguese', %(query)s) q
            WHERE  tsv @@ q
        ),
        vec AS (
            SELECT id,
                   ROW_NUMBER() OVER (ORDER BY embedding <=> %(emb)s::vector) AS rank
            FROM   artigos
            ORDER  BY embedding <=> %(emb)s::vector
            LIMIT  20
        ),
        rrf AS (
            SELECT COALESCE(fts.id, vec.id) AS id,
                   1.0 / (%(k)s + COALESCE(fts.rank, 1000)) +
                   1.0 / (%(k)s + COALESCE(vec.rank, 1000)) AS rrf_score,
                   COALESCE(fts.rank, 9999) AS fts_rank,
                   COALESCE(vec.rank, 9999) AS vec_rank
            FROM   fts
            FULL OUTER JOIN vec ON fts.id = vec.id
        )
        SELECT a.id,
               a.titulo,
               a.area,
               r.rrf_score,
               r.fts_rank,
               r.vec_rank
        FROM   rrf r
        JOIN   artigos a ON a.id = r.id
        ORDER  BY r.rrf_score DESC
        LIMIT  %(limit)s
        """,
        {"query": query_text, "emb": query_emb, "k": k, "limit": limit},
    )
    return [dict(r) for r in cur.fetchall()]


def _print_results(label: str, results: list[dict]) -> None:
    if not results:
        print(f"  {label}: (sem resultados)")
        return
    print(f"  {label}:")
    for i, r in enumerate(results, 1):
        score = r.get("rrf_score") or r.get("score") or 0
        rank_info = ""
        if "fts_rank" in r:
            rank_info = f"  fts_rank={r['fts_rank']}  vec_rank={r['vec_rank']}"
        print(f"    {i}. [{r['area']}] {r['titulo'][:55]}  score={float(score):.4f}{rank_info}")


def main() -> None:
    _sep("Carregando modelo para gerar embeddings das queries")
    model = SentenceTransformer("all-MiniLM-L6-v2")
    print("  Modelo carregado.")

    conn = get_conn()
    all_results = {}

    for q in QUERIES:
        query_text = q["texto"]
        _sep(f"Query: '{query_text}'  ({q['descricao']})")

        q_emb = model.encode([query_text], normalize_embeddings=True)[0].tolist()

        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            fts_res = busca_fts(cur, query_text, limit=5)
            vec_res = busca_vetorial(cur, q_emb, limit=5)
            rrf_res = busca_hibrida_rrf(cur, query_text, q_emb, limit=5)

        _print_results("FTS (léxico) ", fts_res)
        _print_results("Vetorial     ", vec_res)
        _print_results("Híbrido RRF  ", rrf_res)

        # Mostrar highlight do FTS quando disponível
        if fts_res and fts_res[0].get("trecho"):
            print(f"\n  Trecho destacado (FTS top-1):")
            print(f"    {fts_res[0]['trecho']}")

        all_results[query_text] = {
            "fts": fts_res,
            "vetorial": vec_res,
            "hibrido_rrf": rrf_res,
        }

    # ── Análise de cobertura ───────────────────────────────
    _sep("Análise de cobertura por método")
    print("  Quantidade de queries com pelo menos 1 resultado:")
    for label, key in [("FTS", "fts"), ("Vetorial", "vetorial"), ("Híbrido RRF", "hibrido_rrf")]:
        covered = sum(1 for r in all_results.values() if r[key])
        total = len(QUERIES)
        print(f"    {label:12s}: {covered}/{total}")
    print()
    print("  Nota: FTS falha quando a query usa termos diferentes dos documentos.")
    print("  Vetorial encontra documentos semanticamente similares mesmo sem match exato.")
    print("  RRF combina o melhor dos dois mundos.")

    # ── Salvar resultados ─────────────────────────────────
    path = write_results("hybrid_search_results.json", all_results)
    print(f"\n  Resultados salvos em: {path}")

    conn.close()


if __name__ == "__main__":
    main()
