import { io } from "socket.io-client";

const URL = "http://localhost:3001";
const resumen = [];

function cliente(nombre) {
  const s = io(URL, { transports: ["websocket"] });
  s.data = { nombre, jugadorId: null, partida: null, sala: null };
  s.on("jugadores_actualizados", (v) => (s.data.sala = v));
  s.on("partida_iniciada", (p) => (s.data.partida = p));
  return s;
}
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
function assert(cond, msg) {
  console.log(cond ? "  OK   " : "  FAIL ", msg);
  resumen.push({ ok: cond, msg });
}

const ana = cliente("ana");
const bruno = cliente("bruno");
await esperar(300);

const r1 = await new Promise((res) =>
  ana.emit("crear_sala", { juego: "numeros", nombre: "Ana" }, res),
);
ana.data.jugadorId = r1.jugadorId;
const codigo = r1.codigo;
await new Promise((res) => bruno.emit("unirse_sala", { codigo, nombre: "Bruno" }, res));
await esperar(100);

console.log("\n[1] Iniciar partida de números");
await new Promise((res) => ana.emit("iniciar_partida", {}, res));
await esperar(150);
assert(ana.data.sala?.estado === "en_juego", "estado=en_juego");
assert(ana.data.partida != null && bruno.data.partida != null, "ambos reciben partida_iniciada");

console.log("\n[2] Volver a jugar → vuelve a la sala (esperando)");
const rVolver = await new Promise((res) => ana.emit("volver_a_jugar", {}, res));
assert(rVolver.ok, "volver_a_jugar ok");
await esperar(150);
assert(ana.data.sala?.estado === "esperando", `estado=${ana.data.sala?.estado} (esperado: esperando)`);
assert(bruno.data.sala?.estado === "esperando", "Bruno también ve esperando");

console.log("\n[3] Cambiar juego a famosos (solo anfitrión)");
const rNoAnf = await new Promise((res) => bruno.emit("cambiar_juego", { juego: "famosos" }, res));
assert(!rNoAnf.ok, `Bruno rechazado: "${rNoAnf.error}"`);
assert(ana.data.sala?.juego === "numeros", "Juego sigue siendo números");

const rCambio = await new Promise((res) => ana.emit("cambiar_juego", { juego: "famosos" }, res));
assert(rCambio.ok, "Ana cambia a famosos");
await esperar(150);
assert(ana.data.sala?.juego === "famosos", `juego=${ana.data.sala?.juego}`);
assert(bruno.data.sala?.juego === "famosos", "Bruno ve el nuevo juego");

console.log("\n[4] Iniciar nueva partida (ahora con famosos)");
await new Promise((res) => ana.emit("iniciar_partida", {}, res));
await esperar(150);
const asignacion = bruno.data.partida.otros.find((o) => o.id === ana.data.jugadorId).asignacion;
assert(typeof asignacion === "string", `Ana tiene famoso string: "${asignacion}"`);

console.log("\n[5] Cambiar juego durante en_juego rechazado");
const rDurante = await new Promise((res) => ana.emit("cambiar_juego", { juego: "numeros" }, res));
assert(!rDurante.ok, `Rechazado durante en_juego: "${rDurante.error}"`);

console.log("\n[6] Volver a jugar durante esperando rechazado");
await new Promise((res) => ana.emit("volver_a_jugar", {}, res));
await esperar(100);
const rNoEnJuego = await new Promise((res) => ana.emit("volver_a_jugar", {}, res));
assert(!rNoEnJuego.ok, `Rechazado en esperando: "${rNoEnJuego.error}"`);

console.log("\n=== RESUMEN ===");
const ok = resumen.filter((r) => r.ok).length;
const fail = resumen.filter((r) => !r.ok).length;
console.log(`${ok} OK, ${fail} FAIL`);
ana.disconnect();
bruno.disconnect();
process.exit(fail > 0 ? 1 : 0);
