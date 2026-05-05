// Índices no MongoDB e impacto em performance
// Uso: docker exec -i aula07-mongo mongosh < scripts/04-indexes.js

const db = db.getSiblingDB("cinema");

print("\n=== Sem índice ===");
let plan = db.movies.find({ title: "Inception" }).explain("executionStats");
print(`stage: ${plan.executionStats.executionStages.stage}`);
print(`docsExamined: ${plan.executionStats.totalDocsExamined}`);
print(`returned: ${plan.executionStats.nReturned}`);

print("\n=== Criar índice em title ===");
db.movies.createIndex({ title: 1 });

plan = db.movies.find({ title: "Inception" }).explain("executionStats");
print(`stage: ${plan.executionStats.executionStages.stage}`);
print(`docsExamined: ${plan.executionStats.totalDocsExamined}`);
print(`keysExamined: ${plan.executionStats.totalKeysExamined}`);
print(`returned: ${plan.executionStats.nReturned}`);

print("\n=== Compound index — country + ano ===");
db.movies.createIndex({ "director.country": 1, year: -1 });

plan = db.movies.find(
  { "director.country": "USA", year: { $gte: 2015 } }
).explain("executionStats");
print(`stage: ${plan.executionStats.executionStages.stage}`);
print(`indexes used: ${JSON.stringify(plan.queryPlanner.winningPlan.inputStage?.indexName || plan.queryPlanner.winningPlan.indexName || 'none')}`);

print("\n=== Multikey index sobre array (category) ===");
db.movies.createIndex({ category: 1 });
plan = db.movies.find({ category: "sci-fi" }).explain("executionStats");
print(`docsExamined: ${plan.executionStats.totalDocsExamined}`);

print("\n=== Text index para busca textual ===");
db.movies.createIndex({ title: "text" });
print("\nBusca por 'Dune':");
db.movies.find(
  { $text: { $search: "Dune" } },
  { score: { $meta: "textScore" }, title: 1, _id: 0 }
).sort({ score: { $meta: "textScore" } }).forEach(d => printjson(d));

print("\n=== Listar todos os índices da coleção ===");
db.movies.getIndexes().forEach(i => print(`  ${i.name} → ${JSON.stringify(i.key)}`));
