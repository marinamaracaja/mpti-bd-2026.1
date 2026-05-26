// Embedding vs Referenciamento — dot notation, arrays e $elemMatch
// Pre-requisito: scripts/01-seed-livraria.js
// Uso: docker exec -i aula08-mongo mongosh < scripts/02-embedding-vs-referencia.js

const db = db.getSiblingDB("livraria");

print("\n========== DOT NOTATION (subdocumento embutido) ==========");

print("\n=== Match do subdocumento INTEIRO (exige ordem e campos exatos) ===");
printjson(db.pessoa.find(
  { endereco: { rua: "JJ", num: 35, apto: 202 } },
  { nome: 1 }
).toArray());

print("\n=== Match por campo via dot notation (forma robusta) ===");
printjson(db.pessoa.find(
  { "endereco.rua": "JJ" },
  { nome: 1, "endereco.rua": 1 }
).toArray());

print("\n=== Filtro numerico dentro do subdocumento ===");
printjson(db.pessoa.find(
  { "endereco.num": { $gte: 100 } },
  { nome: 1, "endereco.num": 1 }
).toArray());

print("\n========== ARRAYS ==========");

print("\n=== Array contem TODOS (ordem livre) — $all ===");
printjson(db.pessoa.find(
  { hobbies: { $all: ["filmes", "volley"] } },
  { nome: 1, hobbies: 1 }
).toArray());

print("\n=== Tamanho exato do array — $size ===");
printjson(db.pessoa.find(
  { hobbies: { $size: 3 } },
  { nome: 1, hobbies: 1 }
).toArray());

print("\n=== Array de OBJETOS — $elemMatch (condicoes no MESMO elemento) ===");
printjson(db.pessoa.find(
  { telefones: { $elemMatch: { tipo: "cel", numero: /^9999/ } } },
  { nome: 1, telefones: 1 }
).toArray());

print("\n========== EMBEDDING vs REFERENCIA — a mesma pergunta ==========");

print("\n--- EMBUTIDO: 1 query traz livro + editora juntos ---");
printjson(db.livro_embed.find(
  {}, { title: 1, "editora.nome": 1, _id: 0 }
).toArray());

print("\n--- REFERENCIADO: o livro guarda so o _id da editora ---");
printjson(db.livro.find(
  {}, { title: 1, editora: 1, _id: 0 }
).toArray());

print("\n========== O CUSTO DA DUPLICACAO (embedding) ==========");
print("Quantos livro_embed repetem 'Manning'? (dado replicado):");
print("  " + db.livro_embed.countDocuments({ "editora.nome": "Manning" }));
print("Mudou o nome da editora? No embedding voce atualiza N docs:");
const r = db.livro_embed.updateMany(
  { "editora.nome": "Manning" },
  { $set: { "editora.nome": "Manning Publications" } }
);
print("  modificados: " + r.modifiedCount + "  (na referencia seria 1 doc na colecao editora)");
