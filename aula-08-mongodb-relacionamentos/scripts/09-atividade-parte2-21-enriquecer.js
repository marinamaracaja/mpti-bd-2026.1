// Atividade MongoDB - Parte 2.1
// Enriquecer dataset livraria com mais 4 livros referenciando editora/autor por _id.
// Uso (PowerShell):
// Get-Content -Raw .\scripts\09-atividade-parte2-21-enriquecer.js | docker exec -i aula08-mongo mongosh

const db = db.getSiblingDB("livraria");

print("\n========== PARTE 2.1 - ENRIQUECER DATASET ==========");

const edManning = db.editora.findOne({ nome: "Manning" }, { _id: 1 });
const edMagica = db.editora.findOne({ nome: "Magica" }, { _id: 1 });
const edOreilly = db.editora.findOne({ nome: "O'Reilly" }, { _id: 1 });

const auKyle = db.autor.findOne({ nome: "Kyle Banker" }, { _id: 1 });
const auShannon = db.autor.findOne({ nome: "Shannon Bradshaw" }, { _id: 1 });
const auKristina = db.autor.findOne({ nome: "Kristina Chodorow" }, { _id: 1 });

if (!edManning || !edMagica || !edOreilly || !auKyle || !auShannon || !auKristina) {
  throw new Error("Dataset base nao encontrado. Execute antes: scripts/01-seed-livraria.js");
}

const novosTitulos = [
  "MongoDB Performance Tuning",
  "Guia Pratico de Agregacoes",
  "Modelagem NoSQL no Brasil",
  "Data Pipelines com MongoDB"
];

// Idempotencia: remove apenas os 4 livros desta atividade antes de inserir novamente.
db.livro.deleteMany({ title: { $in: novosTitulos } });

const r = db.livro.insertMany([
  {
    title: "MongoDB Performance Tuning",
    url: "http://exemplo.com/perf-mongo",
    editora: edManning._id,
    autores: [auKyle._id, auShannon._id] // 2 autores
  },
  {
    title: "Guia Pratico de Agregacoes",
    url: "http://exemplo.com/agregacoes",
    editora: edManning._id, // mesma editora do livro anterior
    autores: [auKristina._id]
  },
  {
    title: "Modelagem NoSQL no Brasil",
    url: "http://exemplo.com/nosql-br",
    editora: edMagica._id,
    autores: [auKyle._id]
  },
  {
    title: "Data Pipelines com MongoDB",
    url: "http://exemplo.com/pipelines",
    editora: edOreilly._id,
    autores: [auShannon._id, auKristina._id]
  }
]);

print("Inseridos: " + Object.keys(r.insertedIds).length + " livros");
print("\nLivros inseridos (title, editora, qtd_autores):");
printjson(db.livro.aggregate([
  { $match: { title: { $in: novosTitulos } } },
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
      qtd_autores: { $size: "$autores" }
    }
  },
  { $sort: { title: 1 } }
]).toArray());

print("\nCheck dos criterios:");
print("- Livro com 2+ autores: " + db.livro.countDocuments({
  title: { $in: novosTitulos },
  $expr: { $gte: [{ $size: "$autores" }, 2] }
}));
print("- Livros da editora Manning entre os novos: " + db.livro.aggregate([
  { $match: { title: { $in: novosTitulos } } },
  {
    $lookup: {
      from: "editora",
      localField: "editora",
      foreignField: "_id",
      as: "ed"
    }
  },
  { $unwind: "$ed" },
  { $match: { "ed.nome": "Manning" } },
  { $count: "total" }
]).toArray().map(x => x.total)[0]);
