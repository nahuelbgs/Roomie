import { io } from "socket.io-client";

const URL = "http://localhost:3001";
const resumen = [];

function cliente() {
  const s = io(URL, { transports: ["websocket"] });
  s.data = { jugadorId: null, partida: null, sala: null };
  s.on("jugadores_actualizados", (v) => (s.data.sala = v));
  s.on("partida_iniciada", (p) => (s.data.partida = p));
  return s;
}
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
function assert(cond, msg) {
  console.log(cond ? "  OK   " : "  FAIL ", msg);
  resumen.push({ ok: cond, msg });
}

const ana = cliente();
const bruno = cliente();
const caro = cliente();
await esperar(300);

console.log("\n[1] Crear sala categorias + unirse");
const r1 = await new Promise((res) =>
  ana.emit("crear_sala", { juego: "categorias", nombre: "Ana" }, res),
);
ana.data.jugadorId = r1.jugadorId;
assert(r1.ok, `crear_sala categorias → ${r1.codigo}`);
const codigo = r1.codigo;

const r2 = await new Promise((res) => bruno.emit("unirse_sala", { codigo, nombre: "Bruno" }, res));
bruno.data.jugadorId = r2.jugadorId;
const r3 = await new Promise((res) => caro.emit("unirse_sala", { codigo, nombre: "Caro" }, res));
caro.data.jugadorId = r3.jugadorId;
await esperar(100);

console.log("\n[2] Iniciar partida");
const rInit = await new Promise((res) => ana.emit("iniciar_partida", {}, res));
assert(rInit.ok, "Ana inicia");
await esperar(150);

const r1_valores = new Set();
for (const [nombre, c] of [["ana", ana], ["bruno", bruno], ["caro", caro]]) {
  const otros = c.data.partida.otros;
  assert(otros.length === 2, `${nombre} ve 2 otros`);
  assert(!otros.find((o) => o.id === c.data.jugadorId), `${nombre} NO se ve a sí mismo`);
  for (const o of otros) {
    assert(
      typeof o.asignacion === "string" && o.asignacion.length > 10,
      `${nombre} ve categoría válida para ${o.nombre}: "${o.asignacion}"`,
    );
    r1_valores.add(o.asignacion);
  }
}
assert(r1_valores.size === 3, `3 categorías únicas en ronda 1`);

console.log("\n[3] Volver + nueva ronda → no repite");
await new Promise((res) => ana.emit("volver_a_jugar", {}, res));
await esperar(100);
await new Promise((res) => ana.emit("iniciar_partida", {}, res));
await esperar(150);

const r2_valores = new Set();
r2_valores.add(bruno.data.partida.otros.find((o) => o.id === ana.data.jugadorId).asignacion);
r2_valores.add(ana.data.partida.otros.find((o) => o.id === bruno.data.jugadorId).asignacion);
r2_valores.add(ana.data.partida.otros.find((o) => o.id === caro.data.jugadorId).asignacion);
const interseccion = [...r1_valores].filter((v) => r2_valores.has(v));
assert(interseccion.length === 0, `Ronda 2 no repite categorías de ronda 1 (intersección: ${interseccion.length})`);
assert(r2_valores.size === 3, "3 categorías únicas en ronda 2");

console.log("\n=== RESUMEN ===");
const ok = resumen.filter((r) => r.ok).length;
const fail = resumen.filter((r) => !r.ok).length;
console.log(`${ok} OK, ${fail} FAIL`);
ana.disconnect();
bruno.disconnect();
caro.disconnect();
process.exit(fail > 0 ? 1 : 0);
