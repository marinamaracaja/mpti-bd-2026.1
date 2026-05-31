// Atividade MongoDB - Parte 2.2
// (a) Livros com nome/cidade da editora via $lookup + $unwind + $project
// (b) Livros com nomes dos autores via segundo $lookup
// Uso (PowerShell):
// Get-Content -Raw .\scripts\10-atividade-parte2-22-lookup.js | docker exec -i aula08-mongo mongosh

const db = db.getSiblingDB("livraria");

print("\n========== PARTE 2.2(a) - LOOKUP BASICO EDITORA ==========");
const q22a = [
  {
    $lookup: {
      from: "editora",
      localField: "editora",
      foreignField: "_id",
      as: "ed"
    }
  },
  { $unwind: "$ed" },
  {
    $project: {
      _id: 0,
      title: 1,
      editora: "$ed.nome",
      cidade: "$ed.cidade"
    }
  },
  { $sort: { title: 1 } }
];
print("Pipeline 2.2(a):");
printjson(q22a);
print("Resultado 2.2(a):");
printjson(db.livro.aggregate(q22a).toArray());

print("\n========== PARTE 2.2(b) - LOOKUP AUTORES (N:N) ==========");
const q22b = [
  {
    $lookup: {
      from: "autor",
      localField: "autores",
      foreignField: "_id",
      as: "autores_doc"
    }
  },
  {
    $project: {
      _id: 0,
      title: 1,
      autores: "$autores_doc.nome"
    }
  },
  { $sort: { title: 1 } }
];
print("Pipeline 2.2(b):");
printjson(q22b);
print("Resultado 2.2(b):");
printjson(db.livro.aggregate(q22b).toArray());
