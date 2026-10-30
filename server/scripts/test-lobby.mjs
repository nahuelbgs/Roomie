import { io } from "socket.io-client";

const URL = "http://localhost:3001";
const log = (tag, ...a) => console.log(`[${tag}]`, ...a);

function cliente(nombre) {
  const s = io(URL, { transports: ["websocket"] });
  s.on("connect", () => log(nombre, "conectado", s.id));
  s.on("jugadores_actualizados", (v) =>
    log(nombre, "jugadores_actualizados:", {
      codigo: v.codigo,
      estado: v.estado,
      jugadores: v.jugadores.map((j) => `${j.nombre}${j.esAnfitrion ? "*" : ""}`),
    }),
  );
  s.on("disconnect", () => log(nombre, "desconectado"));
  return s;
}

const ana = cliente("ana");
const bruno = cliente("bruno");
const caro = cliente("caro");

await new Promise((r) => setTimeout(r, 300));

const crearRes = await new Promise((resolve) =>
  ana.emit("crear_sala", { juego: "numeros", nombre: "Ana" }, resolve),
);
log("ana", "crear_sala ack:", crearRes);
if (!crearRes.ok) process.exit(1);
const codigo = crearRes.codigo;

const unirseB = await new Promise((resolve) =>
  bruno.emit("unirse_sala", { codigo, nombre: "Bruno" }, resolve),
);
log("bruno", "unirse_sala ack:", unirseB);

// Nombre duplicado — debería devolver "Ana (2)"
const unirseC = await new Promise((resolve) =>
  caro.emit("unirse_sala", { codigo, nombre: "Ana" }, resolve),
);
log("caro", "unirse_sala (nombre repetido) ack:", unirseC);

// Código inválido
const malRes = await new Promise((resolve) =>
  bruno.emit("unirse_sala", { codigo: "XXXX", nombre: "X" }, resolve),
);
log("test", "unirse a código inexistente:", malRes);

await new Promise((r) => setTimeout(r, 200));

// Ana sale → bruno pasa a ser anfitrión
log("test", "Ana sale (disconnect)");
ana.disconnect();

await new Promise((r) => setTimeout(r, 400));

log("test", "fin");
bruno.disconnect();
caro.disconnect();
process.exit(0);
