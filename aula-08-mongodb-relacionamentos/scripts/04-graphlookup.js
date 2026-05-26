// $graphLookup — travessia recursiva (o "WITH RECURSIVE" do MongoDB)
// Seed proprio (independente do 01). Database: rh
// Uso: docker exec -i aula08-mongo mongosh < scripts/04-graphlookup.js

const db = db.getSiblingDB("rh");
db.employees.drop();
db.categorias.drop();

print("\n=== Seed: cadeia de gerencia (cada funcionario reportsTo outro) ===");
const ceo  = db.employees.insertOne({ nome: "Carla (CEO)" }).insertedId;
const cto  = db.employees.insertOne({ nome: "Bruno (CTO)", reportsTo: ceo }).insertedId;
const lead = db.employees.insertOne({ nome: "Diego (Lead)", reportsTo: cto }).insertedId;
db.employees.insertOne({ nome: "Alice (Dev)", reportsTo: lead });
db.employees.insertOne({ nome: "Bia (Dev)",   reportsTo: lead });

print("\n=== Cadeia SUPERIOR de Alice (sobe ate o CEO) — maxDepth controla os hops ===");
printjson(db.employees.aggregate([
  { $match: { nome: "Alice (Dev)" } },
  { $graphLookup: {
      from: "employees",
      startWith: "$reportsTo",        // de onde parte a busca
      connectFromField: "reportsTo",  // campo seguido a cada hop
      connectToField: "_id",          // campo que casa o proximo no
      as: "cadeiaSuperior",
      maxDepth: 5,
      depthField: "nivel"             // anota a distancia de cada no
  } },
  { $project: { _id: 0, nome: 1,
                "cadeiaSuperior.nome": 1, "cadeiaSuperior.nivel": 1 } }
]).toArray());

print("\n=== Sentido inverso: toda a EQUIPE abaixo do Lead ===");
printjson(db.employees.aggregate([
  { $match: { nome: "Diego (Lead)" } },
  { $graphLookup: {
      from: "employees",
      startWith: "$_id",
      connectFromField: "_id",
      connectToField: "reportsTo",    // quem aponta para mim
      as: "subordinados"
  } },
  { $project: { _id: 0, nome: 1, "subordinados.nome": 1 } }
]).toArray());

print("\n=== Arvore de categorias (Tree Pattern + $graphLookup) ===");
const eletr = db.categorias.insertOne({ nome: "Eletronicos" }).insertedId;
const comp  = db.categorias.insertOne({ nome: "Computadores", pai: eletr }).insertedId;
db.categorias.insertOne({ nome: "Notebooks", pai: comp });
db.categorias.insertOne({ nome: "Perifericos", pai: comp });

printjson(db.categorias.aggregate([
  { $match: { nome: "Notebooks" } },
  { $graphLookup: {
      from: "categorias", startWith: "$pai",
      connectFromField: "pai", connectToField: "_id",
      as: "ancestrais", depthField: "nivel"
  } },
  { $project: { _id: 0, nome: 1, "ancestrais.nome": 1, "ancestrais.nivel": 1 } }
]).toArray());
