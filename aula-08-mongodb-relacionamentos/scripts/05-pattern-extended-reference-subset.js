// Patterns: Extended Reference e Subset
// Pre-requisito: scripts/01-seed-livraria.js (para a parte Extended Reference)
// Uso: docker exec -i aula08-mongo mongosh < scripts/05-pattern-extended-reference-subset.js

const db = db.getSiblingDB("livraria");

print("\n========== PATTERN: EXTENDED REFERENCE ==========");
// Problema: mostrar a editora junto do livro exige $lookup toda vez,
// mas 90% das telas so precisam do NOME. Solucao: duplicar campos estaveis.

print("\n--- Antes: livro guarda so o _id da editora ---");
printjson(db.livro.find({}, { _id: 0, title: 1, editora: 1 }).toArray());

print("\n--- Copiando nome+cidade da editora para dentro do livro ---");
db.editora.find().forEach(e => {
  db.livro.updateMany(
    { editora: e._id },
    { $set: { editora_nome: e.nome, editora_cidade: e.cidade } }
  );
});

print("\n--- Depois: leitura comum sem $lookup (campos duplicados) ---");
printjson(db.livro.find(
  {}, { _id: 0, title: 1, editora_nome: 1, editora_cidade: 1 }
).toArray());

print("\n[!] Trade-off: se o nome da editora mudar, voce precisa propagar");
print("    a alteracao para todas as copias. Use so para campos estaveis.");

print("\n========== PATTERN: SUBSET ==========");
// Problema: um produto tem 1000 reviews; embutir todas estoura o documento.
// Solucao: embutir so as N mais recentes (hot path) + colecao separada com o resto.
const sub = db.getSiblingDB("loja");
sub.produtos.drop();
sub.reviews.drop();

print("\n--- Produto carrega so os 2 reviews 'quentes' + um contador ---");
sub.produtos.insertOne({
  _id: "P1", nome: "Camera X",
  reviews_top: [
    { user: "Ana", nota: 5, texto: "Excelente" },
    { user: "Bob", nota: 4, texto: "Boa, mas cara" }
  ],
  reviews_count: 1000
});

print("--- Colecao 'reviews' guarda TODAS (paginavel) ---");
const bulk = [];
for (let i = 1; i <= 1000; i++) {
  bulk.push({ produto: "P1", user: "u" + i, nota: (i % 5) + 1, ts: new Date() });
}
sub.reviews.insertMany(bulk);

print("\nPagina do produto = 1 doc (top reviews ja vem junto):");
printjson(sub.produtos.findOne({ _id: "P1" }));
print('"Ver todas" = 2a query paginada na colecao reviews:');
printjson(sub.reviews.find({ produto: "P1" }).sort({ ts: -1 }).limit(3).toArray());
print("Total de reviews na colecao dedicada: " + sub.reviews.countDocuments({ produto: "P1" }));
