// Indice no campo de juncao + explain(): COLLSCAN vs IXSCAN
// Pre-requisito: scripts/01-seed-livraria.js
// Uso: docker exec -i aula08-mongo mongosh < scripts/07-indices-explain.js
//
// Nota: cada explain fica em UMA linha. Quebrar a cadeia com ".explain()" na
// linha seguinte faz o mongosh (modo pipe) executar a query antes do explain.

const db = db.getSiblingDB("livraria");

// Quais estagios aparecem no plano vencedor (robusto a mudancas de forma).
// Arrow function em const para o mongosh nao ecoar a declaracao.
const estagios = (plan) => {
  const j = JSON.stringify(plan.queryPlanner.winningPlan);
  return ["COLLSCAN", "IXSCAN", "FETCH", "SORT"].filter(s => j.includes('"' + s + '"'));
};

print("\n=== Inflando a colecao livro com 5000 docs sinteticos ===");
db.livro.deleteMany({ title: /^Filler / });   // idempotente entre re-execucoes
const ed = db.editora.findOne({ nome: "Manning" })._id;
const bulk = [];
for (let i = 0; i < 5000; i++) bulk.push({ title: "Filler " + i, editora: ed });
const ins = db.livro.insertMany(bulk);   // const evita o eco dos 5000 _id no shell
print("Total de livros agora: " + db.livro.countDocuments());

print("\n=== SEM indice no campo de juncao: espera-se COLLSCAN ===");
db.livro.dropIndexes();
const planScan = db.livro.find({ editora: ed }).explain("executionStats");
print("estagios       : " + estagios(planScan).join(" -> "));
print("docsExaminados : " + planScan.executionStats.totalDocsExamined);
print("retornados     : " + planScan.executionStats.nReturned);

print("\n=== Criando indice no campo de referencia (acelera find e $lookup) ===");
db.livro.createIndex({ editora: 1 });

print("\n=== COM indice: espera-se IXSCAN (+ FETCH) ===");
const planIdx = db.livro.find({ editora: ed }).explain("executionStats");
print("estagios       : " + estagios(planIdx).join(" -> "));
print("docsExaminados : " + planIdx.executionStats.totalDocsExamined);
print("keysExaminadas : " + planIdx.executionStats.totalKeysExamined);
print("retornados     : " + planIdx.executionStats.nReturned);

print("\n=== Indice composto e regra ESR (Equality, Sort, Range) ===");
// Equality em 'editora' + Sort por 'title' -> o indice atende filtro E ordenacao
db.livro.createIndex({ editora: 1, title: 1 });
const planSort = db.livro.find({ editora: ed }).sort({ title: 1 }).explain("executionStats");
print("estagios       : " + estagios(planSort).join(" -> "));
print("SORT em memoria? " + estagios(planSort).includes("SORT") + "  (false = ordenacao veio do indice)");

print("\n=== Indices existentes na colecao livro ===");
db.livro.getIndexes().forEach(ix => print("  " + ix.name + " -> " + JSON.stringify(ix.key)));
