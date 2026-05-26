// Seed do domínio "livraria" — base para os exemplos de relacionamento
// Modela o esquema dos slides: Livro *..1 Editora, Livro N..N Autor
// Uso: docker exec -i aula08-mongo mongosh < scripts/01-seed-livraria.js

const db = db.getSiblingDB("livraria");

// Idempotente: limpa execuções anteriores
["editora", "autor", "livro", "livro_embed", "pessoa", "carro"].forEach(c => db[c].drop());

print("\n=== 1. Editoras — geram _id que os livros vão referenciar ===");
const ed = db.editora.insertMany([
  { nome: "Manning",  cidade: "Shelter Island" },
  { nome: "Magica",   cidade: "Joao Pessoa" },
  { nome: "O'Reilly", cidade: "Sebastopol" }
]).insertedIds;
printjson(ed);

print("\n=== 2. Autores (N..N com livros) ===");
const au = db.autor.insertMany([
  { nome: "Kyle Banker" },
  { nome: "Shannon Bradshaw" },
  { nome: "Kristina Chodorow" }
]).insertedIds;
printjson(au);

print("\n=== 3. Livros REFERENCIANDO editora e autores pelo _id (FK manual) ===");
db.livro.insertMany([
  { title: "MongoDB in Action",            url: "http://mongodbexpert.com",
    editora: ed[0], autores: [au[0]] },
  { title: "MongoDB: The Definitive Guide", url: "http://oreilly.com/mongo",
    editora: ed[2], autores: [au[1], au[2]] },
  { title: "Contos da Paraiba",             url: "http://magica.com.br",
    editora: ed[1], autores: [] }
]);
printjson(db.livro.find({}, { title: 1, editora: 1 }).toArray());

print("\n=== 4. Livro com editora EMBUTIDA (mesma info, outra estrategia) ===");
db.livro_embed.insertMany([
  { title: "MongoDB in Action",
    editora: { nome: "Manning", cidade: "Shelter Island" } },
  { title: "Padroes de Schema",
    editora: { nome: "Manning", cidade: "Shelter Island" } }  // nome duplicado de proposito
]);
printjson(db.livro_embed.find().toArray());

print("\n=== 5. Pessoas — arrays, subdocumentos e carro embutido (dot notation) ===");
db.pessoa.insertMany([
  { _id: "76052657278", nome: "Sidartha", idade: 33,
    hobbies: ["volley", "filmes"],
    endereco: { rua: "XX", num: 305, apto: 502 },
    telefones: [ { tipo: "cel", numero: "999957211" },
                 { tipo: "fixo", numero: "988081046" } ],
    carro: { modelo: "fiesta 2012", preco: 15000 } },
  { _id: "11122233344", nome: "Alana", idade: 27,
    hobbies: ["filmes", "corrida", "leitura"],
    endereco: { rua: "JJ", num: 35, apto: 202 },
    telefones: [ { tipo: "cel", numero: "988887777" } ],
    carro: { modelo: "gol 2015", preco: 28000 } }
]);

// Uma pessoa que REFERENCIA o carro (vida propria) em vez de embutir
const carro = db.carro.insertOne({ modelo: "civic 2020", preco: 95000 }).insertedId;
db.pessoa.insertOne(
  { _id: "88456707830", nome: "Webber", idade: 41,
    hobbies: ["xadrez"], endereco: { rua: "ZZ", num: 10 },
    telefones: [], carro_ref: carro }   // guarda so o _id
);

print("\nResumo do banco 'livraria':");
["editora", "autor", "livro", "livro_embed", "pessoa", "carro"].forEach(c =>
  print("  " + c + ": " + db[c].countDocuments() + " docs")
);
print("\nSeed concluido. Rode os proximos scripts (02..07).");
