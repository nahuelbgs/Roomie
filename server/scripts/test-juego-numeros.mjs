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

function esperar(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function assert(cond, msg) {
  if (cond) {
    console.log("  OK   ", msg);
    resumen.push({ ok: true, msg });
  } else {
    console.log("  FAIL ", msg);
    resumen.push({ ok: false, msg });
  }
}

const ana = cliente("ana");
const bruno = cliente("bruno");
const caro = cliente("caro");

await esperar(300);

// --- Crear sala y unir ---
console.log("\n[1] Crear sala + unirse");
const r1 = await new Promise((res) =>
  ana.emit("crear_sala", { juego: "numeros", nombre: "Ana" }, res),
);
ana.data.jugadorId = r1.jugadorId;
const codigo = r1.codigo;
assert(r1.ok && r1.esAnfitrion, `Ana crea sala ${codigo} y es anfitriona`);

const r2 = await new Promise((res) =>
  bruno.emit("unirse_sala", { codigo, nombre: "Bruno" }, res),
);
bruno.data.jugadorId = r2.jugadorId;
assert(r2.ok && !r2.esAnfitrion, "Bruno se une sin ser anfitrión");

const r3 = await new Promise((res) =>
  caro.emit("unirse_sala", { codigo, nombre: "Caro" }, res),
);
caro.data.jugadorId = r3.jugadorId;
assert(r3.ok, "Caro se une");

await esperar(100);
assert(ana.data.sala?.jugadores.length === 3, "Ana ve 3 jugadores");

// --- Iniciar partida (solo anfitrión) ---
console.log("\n[2] Iniciar partida");
const rBad = await new Promise((res) => bruno.emit("iniciar_partida", {}, res));
assert(!rBad.ok, `Bruno (no anfitrión) rechazado: "${rBad.error}"`);

const rInit = await new Promise((res) => ana.emit("iniciar_partida", {}, res));
assert(rInit.ok, "Ana (anfitrión) inicia partida");

await esperar(150);
assert(ana.data.partida && bruno.data.partida && caro.data.partida, "Los 3 reciben partida_iniciada");

// --- Visibilidad: cada uno ve a los otros 2, no a sí mismo ---
console.log("\n[3] Visibilidad por jugador");
for (const c of [ana, bruno, caro]) {
  const otros = c.data.partida.otros;
  const nombresVistos = otros.map((o) => o.nombre).sort();
  const propio = otros.find((o) => o.id === c.data.jugadorId);
  assert(otros.length === 2, `${c.data.nombre} ve exactamente 2 jugadores (${nombresVistos.join(", ")})`);
  assert(!propio, `${c.data.nombre} NO se ve a sí misma/o`);
  for (const o of otros) {
    assert(
      typeof o.asignacion === "number" && o.asignacion >= 1 && o.asignacion <= 100,
      `${c.data.nombre} ve número válido para ${o.nombre}: ${o.asignacion}`,
    );
  }
}

// --- Números únicos ---
console.log("\n[4] Números no se repiten");
const numeros = new Set();
for (const o of ana.data.partida.otros) numeros.add(o.asignacion);
// También incluimos el número de Ana vía la vista de Bruno
const numAna = bruno.data.partida.otros.find((o) => o.id === ana.data.jugadorId).asignacion;
numeros.add(numAna);
assert(numeros.size === 3, `3 números únicos: [${[...numeros].sort().join(", ")}]`);

// --- Volver a jugar (solo anfitrión) ---
console.log("\n[5] Volver a jugar");
const antesAna = numAna;
const rPermiso = await new Promise((res) => caro.emit("volver_a_jugar", {}, res));
assert(!rPermiso.ok, `Caro rechazado para volver a jugar: "${rPermiso.error}"`);

const rReset = await new Promise((res) => ana.emit("volver_a_jugar", {}, res));
assert(rReset.ok, "Ana vuelve a repartir");

await esperar(150);
const nuevoNumAna = bruno.data.partida.otros.find((o) => o.id === ana.data.jugadorId).asignacion;
assert(typeof nuevoNumAna === "number", `Ana tiene nuevo número: ${nuevoNumAna} (antes ${antesAna})`);

// --- Join a mitad de partida ---
console.log("\n[6] Join a mitad de partida");
const dani = cliente("dani");
await esperar(100);
const rJoin = await new Promise((res) =>
  dani.emit("unirse_sala", { codigo, nombre: "Dani" }, res),
);
dani.data.jugadorId = rJoin.jugadorId;
assert(rJoin.ok, "Dani se une durante en_juego");
await esperar(100);
assert(dani.data.sala?.estado === "en_juego" && !dani.data.partida, "Dani ve estado=en_juego sin partida (espera próxima ronda)");

// Repartir de nuevo → Dani debería recibir partida
const rReset2 = await new Promise((res) => ana.emit("volver_a_jugar", {}, res));
assert(rReset2.ok, "Ana reparte de nuevo");
await esperar(150);
assert(dani.data.partida && dani.data.partida.otros.length === 3, `Dani ya tiene partida con 3 otros`);

// --- Disconnect durante en_juego ---
console.log("\n[7] Desconexión durante en_juego");
bruno.disconnect();
await esperar(200);
const otrosDeAnaDespues = ana.data.partida.otros.map((o) => o.nombre).sort();
assert(
  !otrosDeAnaDespues.includes("Bruno"),
  `Ana ya no ve a Bruno (otros: ${otrosDeAnaDespues.join(", ")})`,
);
assert(
  ana.data.sala?.jugadores.find((j) => j.nombre === "Bruno")?.conectado === false,
  "Bruno aparece como desconectado en la vista de sala",
);

// --- Resumen ---
console.log("\n=== RESUMEN ===");
const okCount = resumen.filter((r) => r.ok).length;
const failCount = resumen.filter((r) => !r.ok).length;
console.log(`${okCount} OK, ${failCount} FAIL`);

ana.disconnect();
caro.disconnect();
dani.disconnect();
process.exit(failCount > 0 ? 1 : 0);
