#!/usr/bin/env bash
# Demo Neo4j (grafo) — recomendação multi-hop
# Uso: bash scripts/07-neo4j-demo.sh
# Pré-requisito: docker compose --profile graph up -d
#                (espere ~30s pelo Neo4j inicializar)
# Browser: http://localhost:7474   (login: neo4j / aula07pass)

set -e

WAIT_SECS=45
echo "============================================================"
echo " NEO4J — Modelo Grafo (Cypher)"
echo "============================================================"
echo ""
echo "[wait] Aguardando Neo4j ficar pronto (até ${WAIT_SECS}s)..."
for i in $(seq 1 ${WAIT_SECS}); do
  if docker exec aula07-neo4j cypher-shell -u neo4j -p aula07pass 'RETURN 1' > /dev/null 2>&1; then
    echo "[ok] Neo4j está pronto."
    break
  fi
  sleep 1
done

# Helper que executa Cypher
run_cypher() {
  docker exec -i aula07-neo4j cypher-shell -u neo4j -p aula07pass --format plain
}

echo ""
echo "============================================================"
echo " 1. Limpar grafo e criar nós (filmes, atores, gêneros)"
echo "============================================================"
run_cypher <<'EOF'
MATCH (n) DETACH DELETE n;

CREATE (m1:Filme {titulo: 'Inception', ano: 2010, rating: 8.8})
CREATE (m2:Filme {titulo: 'The Dark Knight', ano: 2008, rating: 9.0})
CREATE (m3:Filme {titulo: 'Interstellar', ano: 2014, rating: 8.6})
CREATE (m4:Filme {titulo: 'Oppenheimer', ano: 2023, rating: 8.5})
CREATE (m5:Filme {titulo: 'Tenet', ano: 2020, rating: 7.4})

CREATE (a1:Ator {nome: 'Leonardo DiCaprio'})
CREATE (a2:Ator {nome: 'Christian Bale'})
CREATE (a3:Ator {nome: 'Cillian Murphy'})
CREATE (a4:Ator {nome: 'Matthew McConaughey'})
CREATE (a5:Ator {nome: 'John David Washington'})

CREATE (d1:Diretor {nome: 'Christopher Nolan', pais: 'UK'})

CREATE (g1:Genero {nome: 'sci-fi'})
CREATE (g2:Genero {nome: 'action'})
CREATE (g3:Genero {nome: 'drama'})

// Relacionamentos: dirigiu
CREATE (d1)-[:DIRIGIU]->(m1)
CREATE (d1)-[:DIRIGIU]->(m2)
CREATE (d1)-[:DIRIGIU]->(m3)
CREATE (d1)-[:DIRIGIU]->(m4)
CREATE (d1)-[:DIRIGIU]->(m5)

// Relacionamentos: atuou
CREATE (a1)-[:ATUOU_EM {papel: 'Cobb'}]->(m1)
CREATE (a3)-[:ATUOU_EM {papel: 'Fischer'}]->(m1)
CREATE (a2)-[:ATUOU_EM {papel: 'Bruce Wayne'}]->(m2)
CREATE (a3)-[:ATUOU_EM {papel: 'Scarecrow'}]->(m2)
CREATE (a2)-[:ATUOU_EM {papel: 'Cooper Bro'}]->(m3)
CREATE (a4)-[:ATUOU_EM {papel: 'Cooper'}]->(m3)
CREATE (a3)-[:ATUOU_EM {papel: 'Oppenheimer'}]->(m4)
CREATE (a5)-[:ATUOU_EM {papel: 'Protagonist'}]->(m5)

// Gêneros
CREATE (m1)-[:E_DO_GENERO]->(g1)
CREATE (m1)-[:E_DO_GENERO]->(g2)
CREATE (m2)-[:E_DO_GENERO]->(g2)
CREATE (m2)-[:E_DO_GENERO]->(g3)
CREATE (m3)-[:E_DO_GENERO]->(g1)
CREATE (m3)-[:E_DO_GENERO]->(g3)
CREATE (m4)-[:E_DO_GENERO]->(g3)
CREATE (m5)-[:E_DO_GENERO]->(g1)
CREATE (m5)-[:E_DO_GENERO]->(g2)

RETURN '[ok] Grafo criado' AS msg;
EOF

echo ""
echo "============================================================"
echo " 2. Query simples — todos os filmes do Nolan"
echo "============================================================"
run_cypher <<'EOF'
MATCH (d:Diretor {nome: 'Christopher Nolan'})-[:DIRIGIU]->(m:Filme)
RETURN m.titulo, m.ano, m.rating
ORDER BY m.rating DESC;
EOF

echo ""
echo "============================================================"
echo " 3. Multi-hop: 'atores que trabalharam com Christian Bale'"
echo "    (Bale → filme → outro ator)"
echo "============================================================"
run_cypher <<'EOF'
MATCH (a1:Ator {nome: 'Christian Bale'})
      -[:ATUOU_EM]->(m:Filme)<-[:ATUOU_EM]-(a2:Ator)
WHERE a2.nome <> a1.nome
RETURN DISTINCT a2.nome AS coatuou_com_bale, collect(m.titulo) AS filmes;
EOF

echo ""
echo "============================================================"
echo " 4. Recomendação: 'filmes parecidos com Inception'"
echo "    (mesmo gênero + mesmo diretor)"
echo "============================================================"
run_cypher <<'EOF'
MATCH (target:Filme {titulo: 'Inception'})
MATCH (target)-[:E_DO_GENERO]->(g)<-[:E_DO_GENERO]-(similar:Filme)
WHERE similar.titulo <> target.titulo
WITH similar, count(g) AS generos_em_comum
MATCH (d:Diretor)-[:DIRIGIU]->(target)
MATCH (d)-[:DIRIGIU]->(similar)
RETURN similar.titulo AS recomendacao, similar.rating, generos_em_comum
ORDER BY generos_em_comum DESC, similar.rating DESC
LIMIT 5;
EOF

echo ""
echo "============================================================"
echo " 5. Caminho mais curto entre 2 atores"
echo "    'Como DiCaprio se conecta a Cillian Murphy?'"
echo "============================================================"
run_cypher <<'EOF'
MATCH p = shortestPath(
  (a1:Ator {nome: 'Leonardo DiCaprio'})-[*..6]-(a2:Ator {nome: 'Cillian Murphy'})
)
RETURN [n IN nodes(p) | coalesce(n.titulo, n.nome)] AS caminho,
       length(p) AS distancia;
EOF

echo ""
echo "============================================================"
echo " 6. Estatísticas: ator com mais filmes"
echo "============================================================"
run_cypher <<'EOF'
MATCH (a:Ator)-[:ATUOU_EM]->(m:Filme)
RETURN a.nome, count(m) AS total_filmes
ORDER BY total_filmes DESC
LIMIT 5;
EOF

echo ""
echo "============================================================"
echo " OBSERVAÇÃO — TRADE-OFFS DO MODELO GRAFO"
echo "============================================================"
echo "  ✓ Multi-hop traversals em milissegundos"
echo "  ✓ Modelagem natural de relacionamentos complexos"
echo "  ✓ Cypher é declarativo e legível"
echo "  ✗ Volume além de 10⁹ arestas vira problema"
echo "  ✗ Sem padrão de query universal (cada DB tem dialeto)"
echo ""
echo "  Casos reais: LinkedIn (você pode conhecer), fraud detection,"
echo "               knowledge graphs (Wikidata), supply chain,"
echo "               GraphRAG (LLMs + grafos, 2024–2026)."
echo ""
echo "  Browser interativo: http://localhost:7474"
echo "  (login: neo4j / aula07pass)"
