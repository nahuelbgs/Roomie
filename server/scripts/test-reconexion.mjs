import { io } from "socket.io-client";

const URL = "http://localhost:3001";
const resumen = [];

function cliente(nombre) {
  const s = io(URL, { transports: ["websocket"], reconnection: false });
  s.data = { nombre, jugadorId: null, token: null, partida: null, sala: null };
  s.on("jugadores_actualizados", (v) => (s.data.sala = v));
  s.on("partida_iniciada", (p) => (s.data.partida = p));
  return s;
}
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
function assert(cond, msg) {
  console.log(cond ? "  OK   " : "  FAIL ", msg);
  resumen.push({ ok: cond, msg });
}

// --- Setup: Ana crea sala números, Bruno se une, iniciar partida ---
const ana = cliente("ana");
const bruno = cliente("bruno");
await esperar(300);

const r1 = await new Promise((res) =>
  ana.emit("crear_sala", { juego: "numeros", nombre: "Ana" }, res),
);
ana.data.jugadorId = r1.jugadorId;
ana.data.token = r1.token;
const codigo = r1.codigo;
assert(r1.ok && typeof r1.token === "string" && r1.token.length > 0, `crear_sala devuelve token (${r1.token?.slice(0, 6)}...)`);

const r2 = await new Promise((res) =>
  bruno.emit("unirse_sala", { codigo, nombre: "Bruno" }, res),
);
bruno.data.jugadorId = r2.jugadorId;
bruno.data.token = r2.token;
assert(r2.ok && typeof r2.token === "string", "unirse_sala devuelve token");

await new Promise((res) => ana.emit("iniciar_partida", {}, res));
await esperar(150);

const asignacionAna = bruno.data.partida.otros.find((o) => o.id === ana.data.jugadorId).asignacion;
console.log(`\n[contexto] Ana tiene número ${asignacionAna} (visto por Bruno)`);

// --- 1. Reconexión preserva asignación ---
console.log("\n[1] Reconexión preserva asignación");
ana.disconnect();
await esperar(200);
assert(
  bruno.data.sala?.jugadores.find((j) => j.nombre === "Ana")?.conectado === false,
  "Bruno ve a Ana como desconectada",
);

const ana2 = cliente("ana");
await esperar(200);
const rec = await new Promise((res) =>
  ana2.emit("reconectar_sala", { codigo, jugadorId: ana.data.jugadorId, token: ana.data.token }, res),
);
assert(rec.ok, `Ana2 reconecta con token válido`);
assert(rec.jugadorId === ana.data.jugadorId, "jugadorId preservado");
await esperar(200);
assert(
  ana2.data.partida != null,
  "Ana2 recibe partida_iniciada tras reconectar",
);
const nuevoAna = bruno.data.partida.otros.find((o) => o.id === ana.data.jugadorId).asignacion;
assert(nuevoAna === asignacionAna, `Asignación preservada: ${nuevoAna} === ${asignacionAna}`);
assert(
  bruno.data.sala?.jugadores.find((j) => j.nombre === "Ana")?.conectado === true,
  "Bruno ve a Ana como conectada de nuevo",
);

// --- 2. Token inválido ---
console.log("\n[2] Token inválido es rechazado");
const malo = cliente("malo");
await esperar(100);
const r3 = await new Promise((res) =>
  malo.emit("reconectar_sala", { codigo, jugadorId: ana.data.jugadorId, token: "token-fake" }, res),
);
assert(!r3.ok && /token/i.test(r3.error), `Rechazado: "${r3.error}"`);

// --- 3. Jugador inexistente ---
const r4 = await new Promise((res) =>
  malo.emit("reconectar_sala", { codigo, jugadorId: "fake-id", token: "x" }, res),
);
assert(!r4.ok && /jugador/i.test(r4.error), `Rechazado: "${r4.error}"`);
malo.disconnect();

// --- 4. Sala inexistente ---
const r5 = await new Promise((res) =>
  ana2.emit("reconectar_sala", { codigo: "XXXX", jugadorId: "x", token: "x" }, res),
);
assert(!r5.ok && /sala/i.test(r5.error), `Rechazado: "${r5.error}"`);

// --- 5. Cleanup timeout (configurado en 300ms via env) ---
console.log("\n[5] Timeout de sala vacía");
ana2.disconnect();
bruno.disconnect();
await esperar(500); // > LIMPIEZA_SALA_MS

const zombie = cliente("zombie");
await esperar(200);
const r6 = await new Promise((res) =>
  zombie.emit("reconectar_sala", { codigo, jugadorId: ana.data.jugadorId, token: ana.data.token }, res),
);
assert(!r6.ok && /sala/i.test(r6.error), `Después del timeout, sala eliminada: "${r6.error}"`);
zombie.disconnect();

// --- Resumen ---
console.log("\n=== RESUMEN ===");
const ok = resumen.filter((r) => r.ok).length;
const fail = resumen.filter((r) => !r.ok).length;
console.log(`${ok} OK, ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
