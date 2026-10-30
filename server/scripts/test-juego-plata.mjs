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

// Set esperado de valores "lindos" del pool
const POOL_ESPERADO = new Set();
for (let x = 100; x < 1000; x += 100) POOL_ESPERADO.add(x);
for (let x = 1000; x < 10000; x += 1000) POOL_ESPERADO.add(x);
for (let x = 10000; x < 100000; x += 10000) POOL_ESPERADO.add(x);
for (let x = 100000; x < 1000000; x += 100000) POOL_ESPERADO.add(x);
for (let x = 1000000; x <= 5000000; x += 500000) POOL_ESPERADO.add(x);
for (let x = 6000000; x <= 10000000; x += 1000000) POOL_ESPERADO.add(x);
console.log(`Pool esperado: ${POOL_ESPERADO.size} valores`);

const ana = cliente("ana");
const bruno = cliente("bruno");
const caro = cliente("caro");
await esperar(300);

console.log("\n[1] Crear sala de PLATA");
const r1 = await new Promise((res) =>
  ana.emit("crear_sala", { juego: "plata", nombre: "Ana" }, res),
);
ana.data.jugadorId = r1.jugadorId;
const codigo = r1.codigo;
assert(r1.ok, `Ana crea sala plata ${codigo}`);

const r2 = await new Promise((res) => bruno.emit("unirse_sala", { codigo, nombre: "Bruno" }, res));
bruno.data.jugadorId = r2.jugadorId;
const r3 = await new Promise((res) => caro.emit("unirse_sala", { codigo, nombre: "Caro" }, res));
caro.data.jugadorId = r3.jugadorId;
await esperar(100);

console.log("\n[2] Iniciar partida");
const rInit = await new Promise((res) => ana.emit("iniciar_partida", {}, res));
assert(rInit.ok, "Ana inicia");
await esperar(150);

const valoresTotales = new Set();
for (const c of [ana, bruno, caro]) {
  const otros = c.data.partida.otros;
  assert(otros.length === 2, `${c.data.nombre} ve 2 otros`);
  assert(!otros.find((o) => o.id === c.data.jugadorId), `${c.data.nombre} NO se ve a sí mismo`);
  for (const o of otros) {
    const v = o.asignacion;
    assert(typeof v === "number", `${c.data.nombre} ve número para ${o.nombre}: ${v}`);
    assert(POOL_ESPERADO.has(v), `  ↳ ${v} está en el pool "lindo"`);
    assert(v >= 100 && v <= 10000000, `  ↳ ${v} dentro del rango [100, 10M]`);
    valoresTotales.add(v);
  }
}

console.log("\n[3] Unicidad por ronda");
// Nos quedamos con los tres valores asignados (visto desde Ana + número de Ana desde Bruno)
const anotados = new Set();
anotados.add(bruno.data.partida.otros.find((o) => o.id === ana.data.jugadorId).asignacion);
anotados.add(ana.data.partida.otros.find((o) => o.id === bruno.data.jugadorId).asignacion);
anotados.add(ana.data.partida.otros.find((o) => o.id === caro.data.jugadorId).asignacion);
assert(anotados.size === 3, `3 valores únicos: [${[...anotados].sort((a, b) => a - b).join(", ")}]`);

console.log("\n[4] Volver a la sala → cambiar a plata vuelve a correr sin fallar");
await new Promise((res) => ana.emit("volver_a_jugar", {}, res));
await esperar(100);
assert(ana.data.sala?.estado === "esperando", "estado=esperando");

const rInit2 = await new Promise((res) => ana.emit("iniciar_partida", {}, res));
assert(rInit2.ok, "Ana inicia 2a ronda");
await esperar(150);
const nuevo = bruno.data.partida.otros.find((o) => o.id === ana.data.jugadorId).asignacion;
assert(POOL_ESPERADO.has(nuevo), `Nueva asignación de Ana (${nuevo}) también en pool lindo`);

console.log("\n[5] Cambiar juego de plata a numeros y de vuelta");
await new Promise((res) => ana.emit("volver_a_jugar", {}, res));
await esperar(100);
await new Promise((res) => ana.emit("cambiar_juego", { juego: "numeros" }, res));
await esperar(100);
assert(ana.data.sala?.juego === "numeros", "cambió a numeros");
await new Promise((res) => ana.emit("cambiar_juego", { juego: "plata" }, res));
await esperar(100);
assert(ana.data.sala?.juego === "plata", "volvió a plata");

console.log("\n=== RESUMEN ===");
const ok = resumen.filter((r) => r.ok).length;
const fail = resumen.filter((r) => !r.ok).length;
console.log(`${ok} OK, ${fail} FAIL`);
ana.disconnect();
bruno.disconnect();
caro.disconnect();
process.exit(fail > 0 ? 1 : 0);
