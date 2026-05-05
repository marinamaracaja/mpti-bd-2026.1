// Operadores de query do MongoDB
// Uso: docker exec -i aula07-mongo mongosh < scripts/03-operadores.js

const db = db.getSiblingDB("cinema");

print("\n=== $gte / $lte — faixa de rating ===");
db.movies.find(
  { imdbRating: { $gte: 8.5 } },
  { title: 1, imdbRating: 1, _id: 0 }
).sort({ imdbRating: -1 }).forEach(d => printjson(d));

print("\n=== $in — qualquer valor da lista ===");
db.movies.find(
  { "director.country": { $in: ["Brazil", "Japan"] } },
  { title: 1, "director.country": 1, _id: 0 }
).forEach(d => printjson(d));

print("\n=== $all — array contém TODOS os valores ===");
db.movies.find(
  { category: { $all: ["sci-fi", "drama"] } },
  { title: 1, category: 1, _id: 0 }
).forEach(d => printjson(d));

print("\n=== Regex — título começa com 'The' ===");
db.movies.find(
  { title: /^The/ },
  { title: 1, _id: 0 }
).forEach(d => printjson(d));

print("\n=== $exists — filmes que têm prêmios ===");
db.movies.find(
  { awards: { $exists: true } },
  { title: 1, awards: 1, _id: 0 }
).forEach(d => printjson(d));

print("\n=== $or — alta nota OU baixo orçamento ===");
db.movies.find(
  { $or: [
      { imdbRating: { $gte: 9 } },
      { budget: { $lte: 5 } }
  ]},
  { title: 1, imdbRating: 1, budget: 1, _id: 0 }
).forEach(d => printjson(d));

print("\n=== $and (implícito) — sci-fi recente ===");
db.movies.find(
  { category: "sci-fi", year: { $gte: 2020 } },
  { title: 1, year: 1, _id: 0 }
).forEach(d => printjson(d));

print("\n=== Agregação simples — média de rating por país ===");
db.movies.aggregate([
  { $group: {
      _id: "$director.country",
      total: { $sum: 1 },
      avgRating: { $avg: "$imdbRating" }
  }},
  { $sort: { avgRating: -1 } }
]).forEach(d => printjson(d));
