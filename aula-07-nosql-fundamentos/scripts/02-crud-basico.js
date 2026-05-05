// Exemplos básicos de CRUD em MongoDB
// Uso: docker exec -i aula07-mongo mongosh < scripts/02-crud-basico.js

const db = db.getSiblingDB("cinema");

print("\n=== READ — find sem filtro (top 3) ===");
db.movies.find().limit(3).forEach(d => printjson(d));

print("\n=== READ — find com filtro ===");
print("Filmes do Christopher Nolan:");
db.movies.find(
  { "director.name": "Christopher Nolan" },
  { title: 1, year: 1, _id: 0 }
).forEach(d => printjson(d));

print("\n=== CREATE — insertOne ===");
const r1 = db.movies.insertOne({
  title: "Filme Demo",
  category: ["demo"],
  imdbRating: 5.0,
  year: 2026,
  director: { name: "Aluno", country: "Brazil" }
});
print(`insertedId: ${r1.insertedId}`);

print("\n=== UPDATE — updateOne com $set ===");
db.movies.updateOne(
  { title: "Filme Demo" },
  { $set: { imdbRating: 7.0 } }
);
print("Após update:");
printjson(db.movies.findOne({ title: "Filme Demo" }));

print("\n=== UPDATE — $inc para incrementar ===");
db.movies.updateOne(
  { title: "Filme Demo" },
  { $inc: { imdbRating: 0.5 } }
);
print("Após $inc 0.5:");
printjson(db.movies.findOne({ title: "Filme Demo" }, { title: 1, imdbRating: 1, _id: 0 }));

print("\n=== UPDATE — $push em array ===");
db.movies.updateOne(
  { title: "Filme Demo" },
  { $push: { category: "experimental" } }
);
print("Após $push:");
printjson(db.movies.findOne({ title: "Filme Demo" }, { category: 1, _id: 0 }));

print("\n=== DELETE — deleteOne ===");
const r2 = db.movies.deleteOne({ title: "Filme Demo" });
print(`deleted: ${r2.deletedCount}`);

print(`\nTotal final: ${db.movies.countDocuments()}`);
