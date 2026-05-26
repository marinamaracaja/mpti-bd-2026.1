// Patterns: Bucket, Computed, Schema Versioning e Outlier
// Seed proprio. Database: patterns
// Uso: docker exec -i aula08-mongo mongosh < scripts/06-pattern-bucket-computed-versioning-outlier.js

const db = db.getSiblingDB("patterns");
["leituras", "cliente_resumo", "pedidos", "pessoas", "posts", "likes_extras"].forEach(c => db[c].drop());

print("\n========== PATTERN: BUCKET (time-series / logs) ==========");
// Problema: 1 leitura/seg => 86.400 docs/dia/sensor. Solucao: agrupar por janela de tempo.
print("\n--- 1 bucket = 1 hora de leituras (array cresce com limite) ---");
db.leituras.insertOne({
  _id: "s42:2026-05-23T14",
  sensor: "s42",
  hora_inicio: ISODate("2026-05-23T14:00:00Z"),
  leituras_count: 3,
  leituras: [
    { ts: ISODate("2026-05-23T14:00:01Z"), v: 28.5 },
    { ts: ISODate("2026-05-23T14:00:02Z"), v: 28.6 },
    { ts: ISODate("2026-05-23T14:00:03Z"), v: 28.4 }
  ]
});
// Nova leitura: anexa ao bucket da hora corrente ($push + $inc), sem criar doc novo
db.leituras.updateOne(
  { _id: "s42:2026-05-23T14" },
  { $push: { leituras: { ts: ISODate("2026-05-23T14:00:04Z"), v: 28.7 } },
    $inc:  { leituras_count: 1 } }
);
printjson(db.leituras.findOne());
print("[i] Em projetos novos prefira Time-Series Collections nativas (MongoDB 5.0+).");

print("\n========== PATTERN: COMPUTED (leitura O(1)) ==========");
// Problema: somar faturamento por mes em milhoes de pedidos a cada dashboard = lento.
// Solucao: manter o agregado no write-time com $inc.
db.cliente_resumo.insertOne({ _id: "C1", total_2026_05: 0, total_2026_04: 8430.50 });

function registrarPedido(cliente, valor, campoMes) {
  db.pedidos.insertOne({ cliente, valor, ts: new Date() });
  db.cliente_resumo.updateOne(
    { _id: cliente },
    { $inc: { [campoMes]: valor }, $set: { ultimo_update: new Date() } },
    { upsert: true }
  );
}
registrarPedido("C1", 250, "total_2026_05");
registrarPedido("C1", 100, "total_2026_05");
print("\nResumo pre-calculado (read super rapido, sem aggregate):");
printjson(db.cliente_resumo.findOne({ _id: "C1" }));

print("\n========== PATTERN: SCHEMA VERSIONING ==========");
// Problema: schema evoluiu. Docs antigos tem endereco string; novos, objeto.
db.pessoas.insertMany([
  { schema_version: 1, nome: "Ana", endereco: "Rua X, 123" },
  { schema_version: 2, nome: "Bia", endereco: { rua: "Y", num: "45" } }
]);
function lerPessoa(doc) {
  if (doc.schema_version === 1) {
    const [rua, num] = doc.endereco.split(",");
    return { ...doc, endereco: { rua: rua.trim(), num: (num || "").trim() } };
  }
  return doc;
}
print("\nAplicacao adapta v1 -> formato v2 na leitura (migracao preguicosa):");
db.pessoas.find().forEach(d => printjson(lerPessoa(d)));

print("\n========== PATTERN: OUTLIER ==========");
// Problema: 99% dos posts tem poucos likes; 1% (viral) tem milhoes.
db.posts.insertOne({ _id: "P1", texto: "post comum",
  likes_users: ["u1", "u2", "u3"] });

const virais = [];
for (let i = 1; i <= 1000; i++) virais.push("u" + i);
db.posts.insertOne({ _id: "P9", texto: "post viral",
  likes_users: virais, has_extras: true });        // marcador
db.likes_extras.insertMany(
  Array.from({ length: 5 }, (_, i) => ({ post: "P9", user: "extra" + i, ts: new Date() }))
);

print("\nPost comum: likes embutidos resolvem (sem custo extra):");
printjson(db.posts.findOne({ _id: "P1" }, { texto: 1, likes_users: 1 }));
const viral = db.posts.findOne({ _id: "P9" }, { texto: 1, has_extras: 1 });
print("\nPost viral marcado com has_extras=" + viral.has_extras +
      " -> app busca o restante na colecao dedicada:");
print("  likes_extras: " + db.likes_extras.countDocuments({ post: "P9" }) + " docs");
