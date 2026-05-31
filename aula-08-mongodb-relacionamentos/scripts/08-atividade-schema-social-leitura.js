// Atividade MongoDB - Parte 1 (Rede social de leitura)
// Objetivo: materializar uma proposta de schema com embedding x referencia.
// Uso (PowerShell):
// Get-Content -Raw .\scripts\08-atividade-schema-social-leitura.js | docker exec -i aula08-mongo mongosh

const dbAtv = db.getSiblingDB("rede_leitura");

print("\n========== RESET ==========");
dbAtv.dropDatabase();

print("\n========== COLECOES ==========");
dbAtv.createCollection("usuarios");
dbAtv.createCollection("livros");
dbAtv.createCollection("resenhas");
dbAtv.createCollection("seguidores");

const usuarioAnaId = new ObjectId();
const usuarioBrunoId = new ObjectId();
const livro1Id = new ObjectId();
const livro2Id = new ObjectId();
const livro3Id = new ObjectId();

print("\n========== INSERT: USUARIOS (perfil embutido + estantes com referencias) ==========");
dbAtv.usuarios.insertMany([
  {
    _id: usuarioAnaId,
    nome: "Ana Costa",
    email: "ana@redeleitura.com",
    perfil: {
      bio: "Leio fantasia e ficcao cientifica.",
      foto_url: "https://cdn.redeleitura.com/users/ana.jpg",
      preferencias: {
        privacidade: "publico",
        idioma: "pt-BR"
      }
    },
    cadastrado_em: new Date("2026-05-31T14:30:00Z"),
    estantes: {
      lido: [livro1Id],
      lendo: [livro2Id],
      quero_ler: [livro3Id]
    },
    seguidores_count: 1,
    seguindo_count: 1
  },
  {
    _id: usuarioBrunoId,
    nome: "Bruno Lima",
    email: "bruno@redeleitura.com",
    perfil: {
      bio: "Gosto de nao ficcao e historia.",
      foto_url: "https://cdn.redeleitura.com/users/bruno.jpg",
      preferencias: {
        privacidade: "publico",
        idioma: "pt-BR"
      }
    },
    cadastrado_em: new Date("2026-05-25T10:00:00Z"),
    estantes: {
      lido: [livro2Id],
      lendo: [],
      quero_ler: [livro1Id, livro3Id]
    },
    seguidores_count: 1,
    seguindo_count: 1
  }
]);

print("\n========== INSERT: LIVROS (resumo computado, sem embed de todas as resenhas) ==========");
dbAtv.livros.insertMany([
  {
    _id: livro1Id,
    titulo: "Arquitetura de Dados Moderna",
    autores: [{ nome: "Diego Pereira", autor_id: new ObjectId() }],
    editora: "IFPB Press",
    ano: 2024,
    generos: ["Tecnologia", "Banco de Dados"],
    isbn: "978-65-00000-01-2",
    sinopse: "Guia pratico de modelagem relacional e NoSQL.",
    resumo_resenhas: {
      media_nota: 4.6,
      total_resenhas: 128,
      ultima_atualizacao: new Date("2026-05-31T14:30:00Z")
    },
    ultimas_resenhas_subset: []
  },
  {
    _id: livro2Id,
    titulo: "Sistemas Distribuidos na Pratica",
    autores: [{ nome: "Marina Alves", autor_id: new ObjectId() }],
    editora: "Tech Books",
    ano: 2025,
    generos: ["Computacao"],
    isbn: "978-65-00000-02-9",
    sinopse: "Padroes para sistemas escalaveis.",
    resumo_resenhas: {
      media_nota: 4.2,
      total_resenhas: 47,
      ultima_atualizacao: new Date("2026-05-31T14:30:00Z")
    },
    ultimas_resenhas_subset: []
  },
  {
    _id: livro3Id,
    titulo: "Introducao a Modelagem NoSQL",
    autores: [{ nome: "Carla Nunes", autor_id: new ObjectId() }],
    editora: "Dados Abertos",
    ano: 2023,
    generos: ["Banco de Dados"],
    isbn: "978-65-00000-03-6",
    sinopse: "Fundamentos de modelagem orientada a documentos.",
    resumo_resenhas: {
      media_nota: 4.0,
      total_resenhas: 12,
      ultima_atualizacao: new Date("2026-05-31T14:30:00Z")
    },
    ultimas_resenhas_subset: []
  }
]);

const resenha1Id = new ObjectId();

print("\n========== INSERT: RESENHAS (comentarios embutidos) ==========");
dbAtv.resenhas.insertOne({
  _id: resenha1Id,
  livro_id: livro1Id,
  usuario: {
    usuario_id: usuarioAnaId,
    nome: "Ana Costa",
    foto_url: "https://cdn.redeleitura.com/users/ana.jpg"
  },
  nota: 5,
  texto: "Livro excelente para quem quer unir teoria e pratica.",
  data: new Date("2026-05-31T14:30:00Z"),
  curtidas: 14,
  comentarios: [
    {
      comentario_id: new ObjectId(),
      usuario_id: usuarioBrunoId,
      usuario_nome: "Bruno Lima",
      texto: "Concordo, capitulo 4 e muito bom.",
      data: new Date("2026-05-31T16:00:00Z")
    }
  ]
});

print("\n========== INSERT: FOLLOW (colecao de ligacao) ==========");
dbAtv.seguidores.insertMany([
  {
    _id: new ObjectId(),
    seguidor_id: usuarioAnaId,
    seguido_id: usuarioBrunoId,
    desde: new Date("2026-05-31T14:30:00Z")
  },
  {
    _id: new ObjectId(),
    seguidor_id: usuarioBrunoId,
    seguido_id: usuarioAnaId,
    desde: new Date("2026-05-31T15:00:00Z")
  }
]);

print("\n========== INDICES ==========");
dbAtv.usuarios.createIndex({ email: 1 }, { unique: true });
dbAtv.usuarios.createIndex({ "estantes.lido": 1 });
dbAtv.usuarios.createIndex({ "estantes.lendo": 1 });
dbAtv.usuarios.createIndex({ "estantes.quero_ler": 1 });
dbAtv.livros.createIndex({ isbn: 1 }, { unique: true });
dbAtv.livros.createIndex({ titulo: "text", "autores.nome": "text" });
dbAtv.resenhas.createIndex({ livro_id: 1, data: -1 });
dbAtv.resenhas.createIndex({ "usuario.usuario_id": 1, data: -1 });
dbAtv.seguidores.createIndex({ seguidor_id: 1, seguido_id: 1 }, { unique: true });
dbAtv.seguidores.createIndex({ seguido_id: 1 });

print("\n========== CHECK RAPIDO ==========");
print("usuarios:   " + dbAtv.usuarios.countDocuments());
print("livros:     " + dbAtv.livros.countDocuments());
print("resenhas:   " + dbAtv.resenhas.countDocuments());
print("seguidores: " + dbAtv.seguidores.countDocuments());

print("\nExemplo: quem Ana segue?");
printjson(dbAtv.seguidores.aggregate([
  { $match: { seguidor_id: usuarioAnaId } },
  {
    $lookup: {
      from: "usuarios",
      localField: "seguido_id",
      foreignField: "_id",
      as: "seguido"
    }
  },
  { $unwind: "$seguido" },
  { $project: { _id: 0, seguido_id: 1, seguido_nome: "$seguido.nome" } }
]).toArray());

print("\nConcluido: schema base da atividade criado em db 'rede_leitura'.");
