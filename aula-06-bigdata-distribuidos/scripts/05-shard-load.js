// Insere dados em coleções sharded e mostra distribuição
// Uso: docker exec -it aula06-mongos mongosh --port 27020 < scripts/05-shard-load.js

const db = db.getSiblingDB("loja");

print("=== Inserindo 50.000 pedidos (hash sharding em _id) ===");
let docs = [];
for (let i = 0; i < 50000; i++) {
  docs.push({
    valor: Math.random() * 1000,
    cliente: "C" + (Math.floor(Math.random() * 1000)),
    ts: new Date()
  });
  if (docs.length === 5000) {
    db.pedidos.insertMany(docs);
    docs = [];
  }
}
if (docs.length) db.pedidos.insertMany(docs);

print("\n=== Distribuição de pedidos entre shards ===");
db.pedidos.getShardDistribution();

print("\n=== Inserindo 50.000 eventos (compound shard key) ===");
docs = [];
const tenants = ["t1", "t2", "t3", "t4"];
for (let i = 0; i < 50000; i++) {
  docs.push({
    tenant_id: tenants[i % 4],
    ts: new Date(Date.now() - Math.random() * 86400000),
    tipo: "click",
    payload: { user: "u" + i }
  });
  if (docs.length === 5000) {
    db.eventos.insertMany(docs);
    docs = [];
  }
}
if (docs.length) db.eventos.insertMany(docs);

print("\n=== Distribuição de eventos entre shards ===");
db.eventos.getShardDistribution();

print("\n=== Query targeted (1 shard) - tenant_id específico ===");
let plan1 = db.eventos.find({ tenant_id: "t1" }).explain();
print("shards consultados: " + (plan1.queryPlanner.winningPlan.shards
  ? plan1.queryPlanner.winningPlan.shards.length
  : "single"));

print("\n=== Query scatter-gather (todos shards) - sem shard key ===");
let plan2 = db.eventos.find({ tipo: "click" }).explain();
print("shards consultados: " + (plan2.queryPlanner.winningPlan.shards
  ? plan2.queryPlanner.winningPlan.shards.length
  : "single"));
