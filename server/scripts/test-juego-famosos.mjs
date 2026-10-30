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
const caro = cliente("caro");
await esperar(300);

console.log("\n[1] Crear sala de FAMOSOS + unirse");
const r1 = await new Promise((res) =>
  ana.emit("crear_sala", { juego: "famosos", nombre: "Ana" }, res),
);
ana.data.jugadorId = r1.jugadorId;
const codigo = r1.codigo;
assert(r1.ok, `Ana crea sala famosos ${codigo}`);

const r2 = await new Promise((res) =>
  bruno.emit("unirse_sala", { codigo, nombre: "Bruno" }, res),
);
bruno.data.jugadorId = r2.jugadorId;
const r3 = await new Promise((res) =>
  caro.emit("unirse_sala", { codigo, nombre: "Caro" }, res),
);
caro.data.jugadorId = r3.jugadorId;
assert(r2.ok && r3.ok, "Bruno y Caro se unen");

console.log("\n[2] Iniciar partida y verificar asignación");
const rInit = await new Promise((res) => ana.emit("iniciar_partida", {}, res));
assert(rInit.ok, "Ana inicia");
await esperar(150);

// Visibilidad y tipo string
for (const c of [ana, bruno, caro]) {
  const otros = c.data.partida.otros;
  assert(otros.length === 2, `${c.data.nombre} ve 2 otros`);
  assert(!otros.find((o) => o.id === c.data.jugadorId), `${c.data.nombre} NO se ve a sí mismo`);
  for (const o of otros) {
    assert(
      typeof o.asignacion === "string" && o.asignacion.length > 0,
      `${c.data.nombre} ve famoso válido para ${o.nombre}: "${o.asignacion}"`,
    );
  }
}

// Unicidad dentro de la ronda
const famosos1 = new Set();
famosos1.add(bruno.data.partida.otros.find((o) => o.id === ana.data.jugadorId).asignacion);
famosos1.add(ana.data.partida.otros.find((o) => o.id === bruno.data.jugadorId).asignacion);
famosos1.add(ana.data.partida.otros.find((o) => o.id === caro.data.jugadorId).asignacion);
assert(famosos1.size === 3, `Ronda 1: 3 famosos únicos → ${[...famosos1].join(", ")}`);

console.log("\n[3] Volver a jugar — no debería repetir");
const rReset = await new Promise((res) => ana.emit("volver_a_jugar", {}, res));
assert(rReset.ok, "Ana reparte de nuevo");
await esperar(150);

const famosos2 = new Set();
famosos2.add(bruno.data.partida.otros.find((o) => o.id === ana.data.jugadorId).asignacion);
famosos2.add(ana.data.partida.otros.find((o) => o.id === bruno.data.jugadorId).asignacion);
famosos2.add(ana.data.partida.otros.find((o) => o.id === caro.data.jugadorId).asignacion);
assert(famosos2.size === 3, `Ronda 2: 3 famosos únicos → ${[...famosos2].join(", ")}`);

const interseccion = [...famosos1].filter((f) => famosos2.has(f));
assert(interseccion.length === 0, `Ronda 2 no repite famosos de ronda 1 (intersección: ${interseccion.length})`);

console.log("\n[4] Agotamiento del pool (3 jugadores × 11 rondas con 32 famosos → recicla)");
let cicloReciclado = false;
let acumulados = new Set([...famosos1, ...famosos2]);
for (let i = 3; i <= 12; i++) {
  await new Promise((res) => ana.emit("volver_a_jugar", {}, res));
  await esperar(100);
  const ronda = new Set();
  ronda.add(bruno.data.partida.otros.find((o) => o.id === ana.data.jugadorId).asignacion);
  ronda.add(ana.data.partida.otros.find((o) => o.id === bruno.data.jugadorId).asignacion);
  ronda.add(ana.data.partida.otros.find((o) => o.id === caro.data.jugadorId).asignacion);
  const nuevos = [...ronda].filter((f) => !acumulados.has(f));
  if (nuevos.length === 0 && !cicloReciclado) {
    cicloReciclado = true;
    console.log(`  (reciclado detectado en ronda ${i}: ${[...ronda].join(", ")})`);
  }
  for (const f of ronda) acumulados.add(f);
}
assert(cicloReciclado, `El pool se recicló después de usar todo (acumulados: ${acumulados.size})`);

console.log("\n=== RESUMEN ===");
const ok = resumen.filter((r) => r.ok).length;
const fail = resumen.filter((r) => !r.ok).length;
console.log(`${ok} OK, ${fail} FAIL`);

ana.disconnect();
bruno.disconnect();
caro.disconnect();
process.exit(fail > 0 ? 1 : 0);
