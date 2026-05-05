// Inspeção do estado do replica set
// Uso: docker exec -it aula06-mongo1 mongosh < scripts/01-replica-status.js

print("=== rs.status() ===");
const status = rs.status();
printjson({
  set: status.set,
  date: status.date,
  myState: status.myState,
  members: status.members.map(m => ({
    name: m.name,
    state: m.stateStr,
    health: m.health,
    syncSourceHost: m.syncSourceHost,
    optimeDate: m.optimeDate
  }))
});

print("\n=== rs.conf() ===");
printjson(rs.conf());

print("\n=== rs.printSecondaryReplicationInfo() ===");
rs.printSecondaryReplicationInfo();
