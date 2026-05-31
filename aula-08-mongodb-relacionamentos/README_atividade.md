
---

## Atividade MongoDB — Relacionamentos e Schema Design

Esta seção entrega a **Parte 1** da atividade pedida (modelagem da rede social
de leitura), com decisões de schema guiadas por padrão de acesso.

### Parte 1.1 — Decisões embed x referência

#### Coleções propostas

- `usuarios`
- `livros`
- `resenhas`
- `seguidores` (coleção de ligação para follow)

Observação: os estados de estante (`lido`, `lendo`, `quero_ler`) ficam embutidos
em `usuarios` como arrays de IDs de livros, porque são dados muito consultados em
perfil e biblioteca pessoal.

### Coleções no Mongo:
![alt text](aula-08-mongodb-relacionamentos\images\image.png)

#### Documento de exemplo por coleção

`usuarios`:

```json
{
   "_id": { "$oid": "6845a4f11111111111111111" },
   "nome": "Ana Costa",
   "email": "ana@redeleitura.com",
   "perfil": {
      "bio": "Leio fantasia e ficcao cientifica.",
      "foto_url": "https://cdn.redeleitura.com/users/ana.jpg",
      "preferencias": {
         "privacidade": "publico",
         "idioma": "pt-BR"
      }
   },
   "cadastrado_em": { "$date": "2026-05-31T14:30:00Z" },
   "estantes": {
      "lido": [
         { "$oid": "6845a4f12222222222222221" },
         { "$oid": "6845a4f12222222222222222" }
      ],
      "lendo": [{ "$oid": "6845a4f12222222222222223" }],
      "quero_ler": [{ "$oid": "6845a4f12222222222222224" }]
   }
}
```

`livros`:

```json
{
   "_id": { "$oid": "6845a4f12222222222222221" },
   "titulo": "Arquitetura de Dados Moderna",
   "autores": [
      { "nome": "Diego Pereira", "autor_id": { "$oid": "6845a4f13333333333333331" } }
   ],
   "editora": "IFPB Press",
   "ano": 2024,
   "generos": ["Tecnologia", "Banco de Dados"],
   "isbn": "978-65-00000-01-2",
   "sinopse": "Guia pratico de modelagem relacional e NoSQL.",
   "resumo_resenhas": {
      "media_nota": 4.6,
      "total_resenhas": 128,
      "ultima_atualizacao": { "$date": "2026-05-31T14:30:00Z" }
   }
}
```

`resenhas`:

```json
{
   "_id": { "$oid": "6845a4f14444444444444441" },
   "livro_id": { "$oid": "6845a4f12222222222222221" },
   "usuario": {
      "usuario_id": { "$oid": "6845a4f11111111111111111" },
      "nome": "Ana Costa",
      "foto_url": "https://cdn.redeleitura.com/users/ana.jpg"
   },
   "nota": 5,
   "texto": "Livro excelente para quem quer unir teoria e pratica.",
   "data": { "$date": "2026-05-31T14:30:00Z" },
   "curtidas": 14,
   "comentarios": [
      {
         "comentario_id": { "$oid": "6845a4f15555555555555551" },
         "usuario_id": { "$oid": "6845a4f11111111111111112" },
         "usuario_nome": "Bruno Lima",
         "texto": "Concordo, capitulo 4 e muito bom.",
         "data": { "$date": "2026-05-31T16:00:00Z" }
      }
   ]
}
```

`seguidores`:

```json
{
   "_id": { "$oid": "6845a4f16666666666666661" },
   "seguidor_id": { "$oid": "6845a4f11111111111111111" },
   "seguido_id": { "$oid": "6845a4f11111111111111112" },
   "desde": { "$date": "2026-05-31T14:30:00Z" }
}
```

#### Justificativas por relacionamento

**(a) Usuário ↔ foto/perfil/configurações: embedding**

Perfil e configurações são 1:1 e quase sempre lidos juntos na tela de perfil.
Manter embutido evita join e simplifica updates atômicos do próprio usuário.
O volume é pequeno e estável, sem risco relevante para o limite de 16 MB.

**(b) Resenha ↔ comentários: embedding com controle de outlier**

Comentários são acessados junto da resenha na maior parte das leituras, então
embutir reduz roundtrips e simplifica a ordenação da conversa local.
Como algumas resenhas podem explodir em volume, o design precisa de fallback:
quando passar de um limiar, mover excedentes para coleção separada (Outlier Pattern).

**(c) Livro ↔ resenhas: referência**

Resenhas crescem sem limite prático e podem levar um livro popular ao estouro de
documento se forem embutidas no livro. O acesso mais comum é paginar resenhas por
livro com filtros e ordenação, o que funciona melhor com coleção própria e índices.

**(d) Usuário ↔ livros nas estantes (N:N): referência em arrays no usuário**

Cada usuário consulta frequentemente as próprias estantes, então guardar arrays de
`livro_id` no documento do usuario torna leitura de perfil muito barata.
Como é N:N, o lado livro não replica lista de usuários para evitar crescimento
descontrolado; consultas inversas usam a coleção `usuarios` com índice multikey.

**(e) Usuário ↔ usuários (seguir, N:N): coleção de ligação (`seguidores`)**

Follow é um grafo com outliers severos (contas com milhões de seguidores), então
array dentro de usuário não escala bem para escrita e tamanho de documento.
A coleção de ligação permite índices dedicados para "quem eu sigo" e "quem me segue",
além de evitar sincronização dupla de arrays nos dois lados.

### Parte 1.2 — Cardinalidade que muda a decisão (Livro ↔ resenhas)

Para livro comum (dezenas de resenhas), ainda é possível embutir um subconjunto
pequeno (por exemplo, últimas 3) para leitura rápida da página do livro.

Para best-seller (centenas de milhares), a estratégia obrigatória é manter
resenhas referenciadas em coleção própria, com paginação e índices por
`livro_id` e `data`/`curtidas`.

O pattern que resolve o caso de best-seller é **Subset Pattern** combinado com
**Computed Pattern**: o livro guarda apenas um resumo (média, total e talvez
ultimas resenhas) enquanto o corpo completo fica fora, reduzindo payload e
evitando crescimento sem controle no documento principal.

### Parte 1.3 — N:N (seguir): de que lado guardar?

A escolha principal é **coleção de ligação `seguidores`** com um documento por aresta.
Para consulta "quem eu sigo", índice em `seguidor_id`; para "quem me segue", índice
em `seguido_id`, sem duplicar estado.

Com usuários outliers (milhões de seguidores), arrays em `usuarios` crescem demais,
pressionam o limite de 16 MB e tornam updates concorrentes mais caros.
Guardar em ambos os lados só melhora leitura local, mas introduz custo operacional
alto para manter consistência bidirecional (escritas duplicadas, reconciliação).

Se necessário, pode-se materializar contadores denormalizados (`seguindo_count`,
`seguidores_count`) no documento de usuario via Computed Pattern.

### Script executável da atividade

Arquivo: `scripts/08-atividade-schema-social-leitura.js`

Executar no **PowerShell**:

```powershell
Get-Content -Raw .\scripts\08-atividade-schema-social-leitura.js | docker exec -i aula08-mongo mongosh
```

### Parte 2 — `$lookup` e agregação

Dataset usado: `livraria` (carregado por `scripts/01-seed-livraria.js`).

#### 2.1 — Enriquecer o dataset

Script: `scripts/09-atividade-parte2-21-enriquecer.js`

Executar:

```powershell
Get-Content -Raw .\scripts\09-atividade-parte2-21-enriquecer.js | docker exec -i aula08-mongo mongosh
```

Inserções realizadas (4 livros novos com FK manual para `editora` e `autor`):

- `MongoDB Performance Tuning` (Manning, 2 autores)
- `Guia Prático de Agregações` (Manning, 1 autor)
- `Modelagem NoSQL no Brasil` (Magica, 1 autor)
- `Data Pipelines com MongoDB` (O'Reilly, 2 autores)

Resultado obtido na execução:

```javascript
Inseridos: 4 livros

Livros inseridos (title, editora, qtd_autores):
[
   { title: 'Data Pipelines com MongoDB', editora: "O'Reilly", qtd_autores: 2 },
   { title: 'Guia Prático de Agregações', editora: 'Manning', qtd_autores: 1 },
   { title: 'Modelagem NoSQL no Brasil', editora: 'Magica', qtd_autores: 1 },
   { title: 'MongoDB Performance Tuning', editora: 'Manning', qtd_autores: 2 }
]

Check dos critérios:
- Livro com 2+ autores: 2
- Livros da editora Manning entre os novos: 2
```

#### 2.2 — `$lookup` básico

Script: `scripts/10-atividade-parte2-22-lookup.js`

Executar:

```powershell
Get-Content -Raw .\scripts\10-atividade-parte2-22-lookup.js | docker exec -i aula08-mongo mongosh
```

##### 2.2(a) Livros com nome/cidade da editora

Pipeline completo:

```javascript
[
   {
      $lookup: {
         from: "editora",
         localField: "editora",
         foreignField: "_id",
         as: "ed"
      }
   },
   { $unwind: "$ed" },
   {
      $project: {
         _id: 0,
         title: 1,
         editora: "$ed.nome",
         cidade: "$ed.cidade"
      }
   },
   { $sort: { title: 1 } }
]
```

Resultado obtido:

```javascript
[
   { title: 'Contos da Paraiba', editora: 'Magica', cidade: 'Joao Pessoa' },
   { title: 'Data Pipelines com MongoDB', editora: "O'Reilly", cidade: 'Sebastopol' },
   { title: 'Guia Prático de Agregações', editora: 'Manning', cidade: 'Shelter Island' },
   { title: 'Modelagem NoSQL no Brasil', editora: 'Magica', cidade: 'Joao Pessoa' },
   { title: 'MongoDB Performance Tuning', editora: 'Manning', cidade: 'Shelter Island' },
   { title: 'MongoDB in Action', editora: 'Manning', cidade: 'Shelter Island' },
   { title: 'MongoDB: The Definitive Guide', editora: "O'Reilly", cidade: 'Sebastopol' }
]
```

##### 2.2(b) Livros com nomes dos autores (N:N)

Pipeline completo:

```javascript
[
   {
      $lookup: {
         from: "autor",
         localField: "autores",
         foreignField: "_id",
         as: "autores_doc"
      }
   },
   {
      $project: {
         _id: 0,
         title: 1,
         autores: "$autores_doc.nome"
      }
   },
   { $sort: { title: 1 } }
]
```

Resultado obtido:

```javascript
[
   { title: 'Contos da Paraiba', autores: [] },
   { title: 'Data Pipelines com MongoDB', autores: ['Shannon Bradshaw', 'Kristina Chodorow'] },
   { title: 'Guia Prático de Agregações', autores: ['Kristina Chodorow'] },
   { title: 'Modelagem NoSQL no Brasil', autores: ['Kyle Banker'] },
   { title: 'MongoDB Performance Tuning', autores: ['Kyle Banker', 'Shannon Bradshaw'] },
   { title: 'MongoDB in Action', autores: ['Kyle Banker'] },
   { title: 'MongoDB: The Definitive Guide', autores: ['Shannon Bradshaw', 'Kristina Chodorow'] }
]
```

### Parte 3 — Schema Design Patterns

Script executável da Parte 3: `scripts/11-atividade-parte3-patterns.js`

Executar:

```powershell
Get-Content -Raw .\scripts\11-atividade-parte3-patterns.js | docker exec -i aula08-mongo mongosh
```

#### 3.1 — Extended Reference

Documento JSON resultante (resenha enriquecida sem `$lookup` na leitura comum):

```json
{
   "_id": { "$oid": "6a1c91e0be45c40fc79df8aa" },
   "livro_id": { "$oid": "6a1c91e0be45c40fc79df8a4" },
   "livro_title": "Arquitetura de Dados Moderna",
   "usuario_id": { "$oid": "6a1c91e0be45c40fc79df8a3" },
   "usuario_nome": "Ana Costa",
   "nota": 5,
   "texto": "Livro excelente para quem quer unir teoria e pratica.",
   "curtidas": 14,
   "data": { "$date": "2026-05-31T14:30:00.000Z" }
}
```

Justificativa: dupliquei `livro_title` e `usuario_nome` porque são campos pequenos,
de baixa volatilidade relativa e muito usados em feed/listagem de resenhas.
Isso elimina `$lookup` nas leituras mais frequentes e reduz latência.
Não duplicaria `bio` do usuário (nem `sinopse` completa do livro), pois mudam mais,
podem crescer e gerariam alto custo de propagação.

#### 3.2 — Subset

Documento JSON resultante (`livro` com as 3 resenhas mais recentes + contador):

```json
{
   "_id": { "$oid": "6a1c91e0be45c40fc79df8a4" },
   "title": "Arquitetura de Dados Moderna",
   "subset_resenhas_recentes": [
      {
         "_id": { "$oid": "6a1c91e0be45c40fc79df8aa" },
         "usuario_id": { "$oid": "6a1c91e0be45c40fc79df8a3" },
         "nota": 5,
         "texto": "Livro excelente para quem quer unir teoria e pratica.",
         "data": { "$date": "2026-05-31T14:30:00.000Z" }
      },
      {
         "_id": { "$oid": "6a1c91e0be45c40fc79df8a9" },
         "usuario_id": { "$oid": "6a1c91e0be45c40fc79df8a3" },
         "nota": 5,
         "texto": "Leitura recomendada para a disciplina.",
         "data": { "$date": "2026-05-31T08:45:00.000Z" }
      },
      {
         "_id": { "$oid": "6a1c91e0be45c40fc79df8a8" },
         "usuario_id": { "$oid": "6a1c91e0be45c40fc79df8a3" },
         "nota": 4,
         "texto": "Gostei dos exemplos de lookup.",
         "data": { "$date": "2026-05-30T18:00:00.000Z" }
      }
   ],
   "total_resenhas": 6
}
```

Como a tela "ver todas as resenhas" funciona: a página do livro usa
`subset_resenhas_recentes` para renderização imediata. Ao clicar em "ver todas",
o frontend pagina na coleção `resenhas` por `livro_id`, sem carregar tudo no documento do livro.

#### 3.3 — Computed

Documento JSON resultante (agregado mantido em write-time):

```json
{
   "_id": { "$oid": "6a1c91e0be45c40fc79df8a4" },
   "title": "Arquitetura de Dados Moderna",
   "subtotal_resenhas": {
      "media_nota": { "$numberDecimal": "4.33" },
      "total_resenhas": 3,
      "soma_notas": 13
   }
}
```

`updateOne` com `$inc` executado a cada nova resenha:

```javascript
db.livros.updateOne(
   { _id: livroId },
   {
      $inc: {
         "subtotal_resenhas.total_resenhas": 1,
         "subtotal_resenhas.soma_notas": notaNova
      }
   }
);
```

Justificativa: o custo de agregação sai da leitura e vai para escrita, o que
melhora listagens e telas de detalhe muito acessadas. Em seguida, a média é
recalculada e persistida no documento para consulta direta.

#### 3.4 — Escolha livre: Outlier

Documento JSON resultante (usuário outlier):

```json
{
   "_id": { "$oid": "6a1c91e1be45c40fc79df8ab" },
   "nome": "Influencer Literario",
   "seguidores_count": 2500000,
   "top_followers_ids": [
      { "$oid": "6a1c91e1be45c40fc79df8ac" },
      { "$oid": "6a1c91e1be45c40fc79df8ad" },
      { "$oid": "6a1c91e1be45c40fc79df8ae" }
   ],
   "has_outlier_followers": true
}
```

Documentos JSON resultantes em coleção auxiliar de outliers:

```json
[
   {
      "_id": { "$oid": "6a1c91e1be45c40fc79df8af" },
      "seguido_id": { "$oid": "6a1c91e1be45c40fc79df8ab" },
      "seguidor_id": { "$oid": "6a1c91e1be45c40fc79df8b0" },
      "desde": { "$date": "2026-05-20T10:00:00.000Z" }
   },
   {
      "_id": { "$oid": "6a1c91e1be45c40fc79df8b1" },
      "seguido_id": { "$oid": "6a1c91e1be45c40fc79df8ab" },
      "seguidor_id": { "$oid": "6a1c91e1be45c40fc79df8b2" },
      "desde": { "$date": "2026-05-20T10:05:00.000Z" }
   }
]
```

Justificativa: perfis com milhões de seguidores são exceção, e esse crescimento
assimétrico pode estourar tamanho/utilidade de arrays no documento principal.
Com Outlier Pattern, mantemos uma amostra útil no documento do usuário e empurramos
o excedente para coleção dedicada, preservando performance para a maioria dos casos.
