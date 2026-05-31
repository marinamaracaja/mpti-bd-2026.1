// Atividade MongoDB - Parte 3: Schema Design Patterns
// Dominio: rede social de leitura
// Entrega pratica: exemplos de documentos resultantes e operacoes associadas.
// Uso (PowerShell):
// Get-Content -Raw .\scripts\11-atividade-parte3-patterns.js | docker exec -i aula08-mongo mongosh

const db = db.getSiblingDB("rede_leitura_patterns");

print("\n========== RESET ==========");
db.dropDatabase();

print("\n========== BASE MINIMA ==========");
const usuarioId = new ObjectId();
const livroId = new ObjectId();

// Colecoes usadas na parte 3
["usuarios", "livros", "resenhas", "seguidores", "seguidores_outliers"].forEach(c => db.createCollection(c));

db.usuarios.insertOne({
  _id: usuarioId,
  nome: "Ana Costa",
  email: "ana@redeleitura.com",
  bio: "Leitora assidua",
  foto_url: "https://cdn.redeleitura.com/users/ana.jpg"
});

db.livros.insertOne({
  _id: livroId,
  title: "Arquitetura de Dados Moderna",
  editora: "IFPB Press",
  ano: 2024,
  subtotal_resenhas: {
    media_nota: 4.0,
    total_resenhas: 2,
    soma_notas: 8
  },
  subset_resenhas_recentes: [],
  total_resenhas: 2
});

// algumas resenhas para demonstrar subset (3 mais recentes)
db.resenhas.insertMany([
  {
    _id: new ObjectId(),
    livro_id: livroId,
    usuario_id: usuarioId,
    nota: 4,
    texto: "Boa introducao.",
    data: new Date("2026-05-25T10:00:00Z")
  },
  {
    _id: new ObjectId(),
    livro_id: livroId,
    usuario_id: usuarioId,
    nota: 5,
    texto: "Excelente cobertura pratica.",
    data: new Date("2026-05-27T12:00:00Z")
  },
  {
    _id: new ObjectId(),
    livro_id: livroId,
    usuario_id: usuarioId,
    nota: 5,
    texto: "Capitulo de agregacao muito bom.",
    data: new Date("2026-05-29T13:30:00Z")
  },
  {
    _id: new ObjectId(),
    livro_id: livroId,
    usuario_id: usuarioId,
    nota: 4,
    texto: "Gostei dos exemplos de lookup.",
    data: new Date("2026-05-30T18:00:00Z")
  },
  {
    _id: new ObjectId(),
    livro_id: livroId,
    usuario_id: usuarioId,
    nota: 5,
    texto: "Leitura recomendada para a disciplina.",
    data: new Date("2026-05-31T08:45:00Z")
  }
]);

print("\n========== 3.1 EXTENDED REFERENCE ==========");
const resenhaExt = {
  _id: new ObjectId(),
  livro_id: livroId,
  livro_title: "Arquitetura de Dados Moderna", // campo duplicado estavel para leitura sem lookup
  usuario_id: usuarioId,
  usuario_nome: "Ana Costa", // campo duplicado estavel para feed/listas
  nota: 5,
  texto: "Livro excelente para quem quer unir teoria e pratica.",
  curtidas: 14,
  data: new Date("2026-05-31T14:30:00Z")
};
db.resenhas.insertOne(resenhaExt);
print("Documento exemplo (resenha com extended reference):");
printjson(db.resenhas.findOne({ _id: resenhaExt._id }));

print("\n========== 3.2 SUBSET ==========");
const subset3 = db.resenhas.find({ livro_id: livroId }, { _id: 1, usuario_id: 1, nota: 1, texto: 1, data: 1 }).sort({ data: -1 }).limit(3).toArray();

const total = db.resenhas.countDocuments({ livro_id: livroId });

db.livros.updateOne(
  { _id: livroId },
  {
    $set: {
      subset_resenhas_recentes: subset3,
      total_resenhas: total
    }
  }
);

print("Documento livro com subset (3 resenhas mais recentes + contador):");
printjson(db.livros.findOne(
  { _id: livroId },
  { _id: 1, title: 1, subset_resenhas_recentes: 1, total_resenhas: 1 }
));

print("\n========== 3.3 COMPUTED ==========");
// Supondo uma nova resenha chegando com nota 5.
const notaNova = 5;

// updateOne com $inc em tempo de escrita para manter agregados incrementais.
db.livros.updateOne(
  { _id: livroId },
  {
    $inc: {
      "subtotal_resenhas.total_resenhas": 1,
      "subtotal_resenhas.soma_notas": notaNova
    }
  }
);

const d = db.livros.findOne({ _id: livroId }, { subtotal_resenhas: 1 });
const mediaAtualizada = d.subtotal_resenhas.soma_notas / d.subtotal_resenhas.total_resenhas;
db.livros.updateOne(
  { _id: livroId },
  { $set: { "subtotal_resenhas.media_nota": NumberDecimal(mediaAtualizada.toFixed(2)) } }
);

print("Documento livro apos computed write-time:");
printjson(db.livros.findOne({ _id: livroId }, { _id: 1, title: 1, subtotal_resenhas: 1 }));

print("Exemplo de updateOne com $inc por nova resenha:");
printjson({
  updateOne: {
    filter: { _id: livroId },
    update: {
      $inc: {
        "subtotal_resenhas.total_resenhas": 1,
        "subtotal_resenhas.soma_notas": notaNova
      }
    }
  }
});

print("\n========== 3.4 OUTLIER (escolha livre) ==========");
const userOutlierId = new ObjectId();
db.usuarios.insertOne({
  _id: userOutlierId,
  nome: "Influencer Literario",
  seguidores_count: 2500000,
  top_followers_ids: [new ObjectId(), new ObjectId(), new ObjectId()],
  has_outlier_followers: true
});

// Excedente de seguidores vai para colecao separada
db.seguidores_outliers.insertMany([
  { _id: new ObjectId(), seguido_id: userOutlierId, seguidor_id: new ObjectId(), desde: new Date("2026-05-20T10:00:00Z") },
  { _id: new ObjectId(), seguido_id: userOutlierId, seguidor_id: new ObjectId(), desde: new Date("2026-05-20T10:05:00Z") }
]);

print("Documento de usuario outlier:");
printjson(db.usuarios.findOne({ _id: userOutlierId }));
print("Exemplo de documentos na colecao de outlier:");
printjson(db.seguidores_outliers.find({ seguido_id: userOutlierId }).toArray());

print("\nConcluido: Parte 3 materializada em 'rede_leitura_patterns'.");
