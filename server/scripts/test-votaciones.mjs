import { io } from "socket.io-client";

const URL = "http://localhost:3001";
const resumen = [];

function cliente() {
  const s = io(URL, { transports: ["websocket"] });
  s.data = { jugadorId: null, token: null, partida: null, sala: null, votacion: null, cerrada: null };
  s.on("jugadores_actualizados", (v) => (s.data.sala = v));
  s.on("partida_iniciada", (p) => (s.data.partida = p));
  s.on("votacion_actualizada", (v) => (s.data.votacion = v));
  s.on("votacion_cerrada", (c) => (s.data.cerrada = c));
  return s;
}
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
function assert(cond, msg) {
  console.log(cond ? "  OK   " : "  FAIL ", msg);
  resumen.push({ ok: cond, msg });
}
const emit = (s, ev, payload) => new Promise((res) => s.emit(ev, payload, res));

// 5 jugadores: Ana (host), Bruno, Caro, Dani, Eli
const [ana, bruno, caro, dani, eli] = [cliente(), cliente(), cliente(), cliente(), cliente()];
await esperar(300);

console.log("\n[Setup] Sala famosos + 5 jugadores + iniciar");
const r1 = await emit(ana, "crear_sala", { juego: "famosos", nombre: "Ana" });
ana.data.jugadorId = r1.jugadorId;
const codigo = r1.codigo;
const r2 = await emit(bruno, "unirse_sala", { codigo, nombre: "Bruno" });
bruno.data.jugadorId = r2.jugadorId;
const r3 = await emit(caro, "unirse_sala", { codigo, nombre: "Caro" });
caro.data.jugadorId = r3.jugadorId;
const r4 = await emit(dani, "unirse_sala", { codigo, nombre: "Dani" });
dani.data.jugadorId = r4.jugadorId;
const r5 = await emit(eli, "unirse_sala", { codigo, nombre: "Eli" });
eli.data.jugadorId = r5.jugadorId;
await emit(ana, "iniciar_partida", {});
await esperar(150);
const brunoFamosoOriginal = ana.data.partida.otros.find((o) => o.id === bruno.data.jugadorId).asignacion;
console.log(`  Bruno tiene famoso: "${brunoFamosoOriginal}"`);

console.log("\n[1] Votación CAMBIAR iniciada por Ana sobre Bruno");
const rStart = await emit(ana, "iniciar_votacion_cambiar", { targetId: bruno.data.jugadorId });
assert(rStart.ok, "Ana inicia votación");
await esperar(100);

// Threshold: ceil(5/2) = 3. Ana ya votó YES automático → 1
assert(ana.data.votacion?.yes === 1, `yes=${ana.data.votacion?.yes}, esperado 1`);
assert(ana.data.votacion?.threshold === 3, `threshold=${ana.data.votacion?.threshold}, esperado 3`);
assert(ana.data.votacion?.puedoVotar === false, "Ana no puede votar de nuevo");
assert(bruno.data.votacion?.puedoVotar === false, "Bruno (target) no puede votar");
assert(bruno.data.votacion?.propuesta === null, "Bruno no ve propuesta (es cambiar)");
assert(caro.data.votacion?.puedoVotar === true, "Caro puede votar");

console.log("\n[2] Votación concurrente rechazada");
const rConcurrente = await emit(caro, "iniciar_votacion_cambiar", { targetId: dani.data.jugadorId });
assert(!rConcurrente.ok, `Rechazado: "${rConcurrente.error}"`);

console.log("\n[3] Target no puede votar");
const rTargetVota = await emit(bruno, "votar", { voto: false });
assert(!rTargetVota.ok, `Bruno (target) rechazado: "${rTargetVota.error}"`);

console.log("\n[4] Caro vota SÍ, Dani vota SÍ → aprueba (3/5 YES)");
await emit(caro, "votar", { voto: true });
await esperar(100);
assert(ana.data.votacion?.yes === 2, `yes=2 después de Caro`);
assert(ana.data.cerrada === null, "aún no cerrada");

await emit(dani, "votar", { voto: true });
await esperar(100);
assert(ana.data.cerrada?.resultado === "aprobada", `cerrada=${ana.data.cerrada?.resultado}`);
assert(ana.data.votacion === null, "votacion limpiada");

const brunoFamosoNuevo = ana.data.partida.otros.find((o) => o.id === bruno.data.jugadorId).asignacion;
assert(brunoFamosoNuevo !== brunoFamosoOriginal, `Famoso de Bruno cambió: "${brunoFamosoOriginal}" → "${brunoFamosoNuevo}"`);

console.log("\n[5] Votación PROPONER con texto específico");
// Reset cerrada state
ana.data.cerrada = null;
bruno.data.cerrada = null;
caro.data.cerrada = null;
const rProp = await emit(
  caro,
  "iniciar_votacion_proponer",
  { targetId: ana.data.jugadorId, propuesta: "Juanito Testeador" },
);
assert(rProp.ok, `Caro propone (${rProp.error ?? "ok"})`);
await esperar(100);
assert(ana.data.votacion?.propuesta === null, "Ana (target) NO ve la propuesta");
assert(bruno.data.votacion?.propuesta === "Juanito Testeador", `Bruno ve propuesta: "${bruno.data.votacion?.propuesta}"`);
assert(caro.data.votacion?.puedoVotar === false, "Caro ya votó (iniciadora)");

console.log("\n[6] Bruno NO, Dani NO, Eli NO → rechazada");
await emit(bruno, "votar", { voto: false });
await esperar(80);
await emit(dani, "votar", { voto: false });
await esperar(80);
await emit(eli, "votar", { voto: false });
await esperar(100);
// 1 YES (Caro) vs 3 NO. threshold=3. Al votar los 4 elegibles conectados, cierra.
assert(ana.data.cerrada?.resultado === "rechazada", `cerrada=${ana.data.cerrada?.resultado}`);
const anaFamoso = bruno.data.partida.otros.find((o) => o.id === ana.data.jugadorId).asignacion;
assert(anaFamoso !== "Juanito Testeador", `Ana sigue con "${anaFamoso}" (NO cambió a Juanito)`);

console.log("\n[7] Votación PROPONER aprobada → asignación nueva");
ana.data.cerrada = null;
const rProp2 = await emit(
  caro,
  "iniciar_votacion_proponer",
  { targetId: ana.data.jugadorId, propuesta: "Pelusa Malvinas" },
);
assert(rProp2.ok, "Caro propone de nuevo");
await esperar(100);
await emit(bruno, "votar", { voto: true });
await esperar(80);
await emit(dani, "votar", { voto: true });
await esperar(150);
// 1 (Caro) + 2 = 3 YES >= threshold=3 → aprueba
assert(ana.data.cerrada?.resultado === "aprobada", `cerrada=${ana.data.cerrada?.resultado}`);
const anaFamosoNuevo = bruno.data.partida.otros.find((o) => o.id === ana.data.jugadorId).asignacion;
assert(anaFamosoNuevo === "Pelusa Malvinas", `Ana ahora tiene: "${anaFamosoNuevo}"`);

console.log("\n[8] Propuesta vacía rechazada");
const rVacia = await emit(bruno, "iniciar_votacion_proponer", { targetId: ana.data.jugadorId, propuesta: "   " });
assert(!rVacia.ok, `Rechazado: "${rVacia.error}"`);

console.log("\n[9] En juego numeros, votaciones no permitidas");
await emit(ana, "volver_a_jugar", {});
await esperar(100);
await emit(ana, "cambiar_juego", { juego: "numeros" });
await esperar(100);
await emit(ana, "iniciar_partida", {});
await esperar(150);
const rNoAplica = await emit(ana, "iniciar_votacion_cambiar", { targetId: bruno.data.jugadorId });
assert(!rNoAplica.ok, `Rechazado en numeros: "${rNoAplica.error}"`);

console.log("\n=== RESUMEN ===");
const ok = resumen.filter((r) => r.ok).length;
const fail = resumen.filter((r) => !r.ok).length;
console.log(`${ok} OK, ${fail} FAIL`);
[ana, bruno, caro, dani, eli].forEach((s) => s.disconnect());
process.exit(fail > 0 ? 1 : 0);
