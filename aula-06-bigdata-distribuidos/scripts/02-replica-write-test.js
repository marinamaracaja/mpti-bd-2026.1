// Demonstra write concerns e leitura em secundários
// Uso: docker exec -it aula06-mongo1 mongosh < scripts/02-replica-write-test.js

const db = db.getSiblingDB("loja");

print("=== Insert com w:1 (rápido, perda possível em failover) ===");
let r1 = db.pedidos.insertOne(
  { id: "P-001", valor: 199.90, ts: new Date() },
  { writeConcern: { w: 1 } }
);
print("ack: " + JSON.stringify(r1));

print("\n=== Insert com w:'majority' (durável) ===");
let r2 = db.pedidos.insertOne(
  { id: "P-002", valor: 89.50, ts: new Date() },
  { writeConcern: { w: "majority", wtimeout: 5000 } }
);
print("ack: " + JSON.stringify(r2));

print("\n=== Insert em lote ===");
let docs = [];
for (let i = 0; i < 1000; i++) {
  docs.push({ id: "P-" + i.toString().padStart(4, "0"),
              valor: Math.random() * 1000,
              ts: new Date() });
}
let bulk = db.pedidos.insertMany(docs, { writeConcern: { w: "majority" } });
print("inserted: " + bulk.insertedIds ? Object.keys(bulk.insertedIds).length : "?");

print("\n=== Total de documentos ===");
print(db.pedidos.countDocuments());
