// Configura sharding em coleção e insere dados
// Uso: docker exec -it aula06-mongos mongosh --port 27020 < scripts/04-shard-setup.js

print("=== Status do cluster ===");
sh.status();

print("\n=== Habilitando sharding no DB 'loja' ===");
sh.enableSharding("loja");

print("\n=== Sharding com hash em _id (coleção pedidos) ===");
sh.shardCollection("loja.pedidos", { _id: "hashed" });

print("\n=== Sharding com chave composta (coleção eventos) ===");
sh.shardCollection("loja.eventos", { tenant_id: 1, ts: 1 });

print("\n=== Configuração concluída ===");
sh.status();
