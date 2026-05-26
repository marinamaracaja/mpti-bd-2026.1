// $lookup — o "join" do MongoDB (left outer join no aggregation pipeline)
// Pre-requisito: scripts/01-seed-livraria.js
// Uso: docker exec -i aula08-mongo mongosh < scripts/03-lookup.js

const db = db.getSiblingDB("livraria");

print("\n========== OPCAO 1: application-side join (2 queries) ==========");
// Em muitos casos e mais barato que $lookup, sobretudo se o pai ja esta em memoria.
const livro = db.livro.findOne({ title: "MongoDB in Action" }, { editora: 1 });
print("1) livro.editora = " + livro.editora);
printjson(db.editora.find({ _id: { $in: [livro.editora] } }).toArray());

print("\n========== OPCAO 2: $lookup classico (localField/foreignField) ==========");
printjson(db.livro.aggregate([
  { $lookup: {
      from: "editora",
      localField: "editora",     // campo nesta colecao
      foreignField: "_id",       // campo na colecao alvo
      as: "editora_doc"          // resultado vem como ARRAY (mesmo em 1:1)
  } }
]).toArray());

print("\n========== $lookup + $unwind + $project (formato limpo) ==========");
printjson(db.livro.aggregate([
  { $lookup: { from: "editora", localField: "editora",
               foreignField: "_id", as: "ed" } },
  { $unwind: "$ed" },            // desfaz o array (1:1 -> objeto)
  { $project: { _id: 0, title: 1, editora: "$ed.nome", cidade: "$ed.cidade" } }
]).toArray());

print("\n========== N..N: resolver os AUTORES de cada livro ==========");
printjson(db.livro.aggregate([
  { $lookup: { from: "autor", localField: "autores",
               foreignField: "_id", as: "autores_doc" } },
  { $project: { _id: 0, title: 1, "autores_doc.nome": 1 } }
]).toArray());

print("\n========== $lookup com PIPELINE (let + $expr) — versao poderosa ==========");
// Permite filtrar/projetar do lado da juncao. Aqui: so editoras de Joao Pessoa.
printjson(db.livro.aggregate([
  { $lookup: {
      from: "editora",
      let: { editId: "$editora" },
      pipeline: [
        { $match: { $expr: { $and: [
            { $eq: ["$_id", "$$editId"] },
            { $eq: ["$cidade", "Joao Pessoa"] }
        ] } } },
        { $project: { _id: 0, nome: 1 } }
      ],
      as: "editora_jp"
  } },
  { $project: { _id: 0, title: 1, editora_jp: 1 } }
]).toArray());
