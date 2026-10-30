import "dotenv/config";
import express from "express";
import cors from "cors";
import { createServer } from "node:http";
import { Server, type Socket } from "socket.io";
import { db } from "./db.js";
import {
  agregarJugador,
  asignarCategorias,
  asignarFamosos,
  asignarNumeros,
  asignarPlata,
  cambiarJuegoDe,
  cancelarVotacion,
  cerrarVotacionAprobada,
  crearSala,
  evaluarVotacion,
  getSala,
  iniciarVotacion,
  manejarDesconexion,
  partidaParaJugador,
  reconectar,
  registrarVoto,
  resetearRonda,
  salaDelSocket,
  salirExplicito,
  vista,
  votacionVista,
} from "./rooms.js";
import type { ConfigSala, Juego, Sala } from "./types.js";

const PORT = Number(process.env.PORT ?? 3001);
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN ?? "http://localhost:5173";

const app = express();
app.use(cors({ origin: CLIENT_ORIGIN }));
app.use(express.json());

app.get("/health", (_req, res) => {
  const { n } = db.prepare("SELECT COUNT(*) AS n FROM famosos").get() as { n: number };
  res.json({ ok: true, famosos: n });
});

const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: CLIENT_ORIGIN } });

interface JoinAckOk {
  ok: true;
  codigo: string;
  jugadorId: string;
  token: string;
  esAnfitrion: boolean;
}
interface AckError {
  ok: false;
  error: string;
}
type JoinAck = (res: JoinAckOk | AckError) => void;
type SimpleAck = (res: { ok: true } | AckError) => void;

interface CrearSalaPayload {
  juego: Juego;
  nombre: string;
  config?: Partial<ConfigSala>;
}
interface UnirseSalaPayload {
  codigo: string;
  nombre: string;
}
interface ReconectarPayload {
  codigo: string;
  jugadorId: string;
  token: string;
}

function configPorDefecto(partial?: Partial<ConfigSala>): ConfigSala {
  return {
    rangoMin: partial?.rangoMin ?? 1,
    rangoMax: partial?.rangoMax ?? 100,
    categorias: partial?.categorias ?? [],
  };
}

function broadcastPartida(sala: Sala) {
  for (const j of sala.jugadores) {
    if (!j.socketId) continue;
    io.to(j.socketId).emit("partida_iniciada", partidaParaJugador(sala, j.id));
  }
}

function broadcastSala(sala: Sala) {
  io.to(sala.codigo).emit("jugadores_actualizados", vista(sala));
}

function broadcastVotacion(sala: Sala) {
  if (!sala.votacionActiva) {
    io.to(sala.codigo).emit("votacion_actualizada", null);
    return;
  }
  for (const j of sala.jugadores) {
    if (!j.socketId) continue;
    io.to(j.socketId).emit("votacion_actualizada", votacionVista(sala, j.id));
  }
}

function evaluarYCerrar(sala: Sala): "aprobada" | "rechazada" | null {
  const r = evaluarVotacion(sala);
  if (r === "aprobada") {
    cerrarVotacionAprobada(sala);
    io.to(sala.codigo).emit("votacion_cerrada", { resultado: "aprobada" });
    broadcastVotacion(sala);
    broadcastPartida(sala);
    return "aprobada";
  }
  if (r === "rechazada") {
    cancelarVotacion(sala);
    io.to(sala.codigo).emit("votacion_cerrada", { resultado: "rechazada" });
    broadcastVotacion(sala);
    return "rechazada";
  }
  return null;
}

io.on("connection", (socket: Socket) => {
  console.log(`[io] conectado ${socket.id}`);

  socket.on("crear_sala", (payload: CrearSalaPayload, ack?: JoinAck) => {
    if (
      !payload ||
      (payload.juego !== "numeros" &&
        payload.juego !== "famosos" &&
        payload.juego !== "categorias" &&
        payload.juego !== "plata")
    ) {
      return ack?.({ ok: false, error: "Juego inválido" });
    }
    if (!payload.nombre?.trim()) {
      return ack?.({ ok: false, error: "Nombre requerido" });
    }
    const sala = crearSala(payload.juego, configPorDefecto(payload.config));
    const jugador = agregarJugador(sala, payload.nombre, socket.id);
    socket.join(sala.codigo);
    ack?.({
      ok: true,
      codigo: sala.codigo,
      jugadorId: jugador.id,
      token: jugador.token,
      esAnfitrion: true,
    });
    broadcastSala(sala);
  });

  socket.on("unirse_sala", (payload: UnirseSalaPayload, ack?: JoinAck) => {
    if (!payload?.codigo || !payload.nombre?.trim()) {
      return ack?.({ ok: false, error: "Código y nombre requeridos" });
    }
    const sala = getSala(payload.codigo);
    if (!sala) return ack?.({ ok: false, error: "Sala no encontrada" });
    if (sala.estado === "finalizada") {
      return ack?.({ ok: false, error: "La sala ya terminó" });
    }
    const jugador = agregarJugador(sala, payload.nombre, socket.id);
    socket.join(sala.codigo);
    ack?.({
      ok: true,
      codigo: sala.codigo,
      jugadorId: jugador.id,
      token: jugador.token,
      esAnfitrion: sala.anfitrionId === jugador.id,
    });
    broadcastSala(sala);
  });

  socket.on("reconectar_sala", (payload: ReconectarPayload, ack?: JoinAck) => {
    if (!payload?.codigo || !payload.jugadorId || !payload.token) {
      return ack?.({ ok: false, error: "Faltan datos de reconexión" });
    }
    const res = reconectar(payload.codigo, payload.jugadorId, payload.token, socket.id);
    if (!res.ok) return ack?.({ ok: false, error: res.error });
    const { sala, jugador, antiguoSocketId } = res;
    socket.join(sala.codigo);
    if (antiguoSocketId && antiguoSocketId !== socket.id) {
      io.sockets.sockets.get(antiguoSocketId)?.disconnect();
    }
    ack?.({
      ok: true,
      codigo: sala.codigo,
      jugadorId: jugador.id,
      token: jugador.token,
      esAnfitrion: sala.anfitrionId === jugador.id,
    });
    broadcastSala(sala);
    if (sala.estado === "en_juego") broadcastPartida(sala);
  });

  socket.on("iniciar_partida", (_payload: unknown, ack?: SimpleAck) => {
    const sala = salaDelSocket(socket.id);
    if (!sala) return ack?.({ ok: false, error: "No estás en una sala" });
    const yo = sala.jugadores.find((j) => j.socketId === socket.id);
    if (!yo || sala.anfitrionId !== yo.id) {
      return ack?.({ ok: false, error: "Solo el anfitrión puede iniciar" });
    }
    if (sala.estado !== "esperando") {
      return ack?.({ ok: false, error: "La partida ya empezó" });
    }
    try {
      if (sala.juego === "numeros") asignarNumeros(sala);
      else if (sala.juego === "plata") asignarPlata(sala);
      else if (sala.juego === "categorias") asignarCategorias(sala);
      else asignarFamosos(sala);
    } catch (e) {
      return ack?.({ ok: false, error: (e as Error).message });
    }
    sala.estado = "en_juego";
    ack?.({ ok: true });
    broadcastSala(sala);
    broadcastPartida(sala);
  });

  socket.on("volver_a_jugar", (_payload: unknown, ack?: SimpleAck) => {
    const sala = salaDelSocket(socket.id);
    if (!sala) return ack?.({ ok: false, error: "No estás en una sala" });
    const yo = sala.jugadores.find((j) => j.socketId === socket.id);
    if (!yo || sala.anfitrionId !== yo.id) {
      return ack?.({ ok: false, error: "Solo el anfitrión puede volver a la sala" });
    }
    if (sala.estado !== "en_juego") {
      return ack?.({ ok: false, error: "La partida no está en curso" });
    }
    resetearRonda(sala);
    ack?.({ ok: true });
    broadcastSala(sala);
  });

  socket.on(
    "cambiar_juego",
    (payload: { juego: Juego }, ack?: SimpleAck) => {
      const sala = salaDelSocket(socket.id);
      if (!sala) return ack?.({ ok: false, error: "No estás en una sala" });
      const yo = sala.jugadores.find((j) => j.socketId === socket.id);
      if (!yo || sala.anfitrionId !== yo.id) {
        return ack?.({ ok: false, error: "Solo el anfitrión puede cambiar el juego" });
      }
      if (sala.estado !== "esperando") {
        return ack?.({ ok: false, error: "No se puede cambiar el juego durante la partida" });
      }
      if (
        payload?.juego !== "numeros" &&
        payload?.juego !== "famosos" &&
        payload?.juego !== "categorias" &&
        payload?.juego !== "plata"
      ) {
        return ack?.({ ok: false, error: "Juego inválido" });
      }
      if (payload.juego !== sala.juego) {
        cambiarJuegoDe(sala, payload.juego);
        broadcastSala(sala);
      }
      ack?.({ ok: true });
    },
  );

  socket.on(
    "iniciar_votacion_cambiar",
    (payload: { targetId: string }, ack?: SimpleAck) => {
      const sala = salaDelSocket(socket.id);
      if (!sala) return ack?.({ ok: false, error: "No estás en una sala" });
      const yo = sala.jugadores.find((j) => j.socketId === socket.id);
      if (!yo) return ack?.({ ok: false, error: "Jugador no encontrado" });
      const res = iniciarVotacion(sala, yo.id, {
        tipo: "cambiar",
        targetId: payload?.targetId,
      });
      if (!res.ok) return ack?.(res);
      ack?.({ ok: true });
      broadcastVotacion(sala);
      evaluarYCerrar(sala);
    },
  );

  socket.on(
    "iniciar_votacion_proponer",
    (payload: { targetId: string; propuesta: string }, ack?: SimpleAck) => {
      const sala = salaDelSocket(socket.id);
      if (!sala) return ack?.({ ok: false, error: "No estás en una sala" });
      const yo = sala.jugadores.find((j) => j.socketId === socket.id);
      if (!yo) return ack?.({ ok: false, error: "Jugador no encontrado" });
      const res = iniciarVotacion(sala, yo.id, {
        tipo: "proponer",
        targetId: payload?.targetId,
        propuesta: payload?.propuesta,
      });
      if (!res.ok) return ack?.(res);
      ack?.({ ok: true });
      broadcastVotacion(sala);
      evaluarYCerrar(sala);
    },
  );

  socket.on("votar", (payload: { voto: boolean }, ack?: SimpleAck) => {
    const sala = salaDelSocket(socket.id);
    if (!sala) return ack?.({ ok: false, error: "No estás en una sala" });
    const yo = sala.jugadores.find((j) => j.socketId === socket.id);
    if (!yo) return ack?.({ ok: false, error: "Jugador no encontrado" });
    const res = registrarVoto(sala, yo.id, !!payload?.voto);
    if (!res.ok) return ack?.(res);
    ack?.({ ok: true });
    broadcastVotacion(sala);
    evaluarYCerrar(sala);
  });

  socket.on("salir_sala", () => {
    const res = salirExplicito(socket.id);
    if (!res) return;
    socket.leave(res.sala.codigo);
    if (!getSala(res.sala.codigo)) return;
    if (res.sala.votacionActiva) {
      if (res.sala.votacionActiva.targetId === res.jugador.id) {
        cancelarVotacion(res.sala);
        io.to(res.sala.codigo).emit("votacion_cerrada", { resultado: "cancelada" });
        broadcastVotacion(res.sala);
      } else {
        evaluarYCerrar(res.sala);
      }
    }
    broadcastSala(res.sala);
    if (res.sala.estado === "en_juego") broadcastPartida(res.sala);
  });

  socket.on("disconnect", (reason) => {
    console.log(`[io] desconectado ${socket.id} (${reason})`);
    const res = manejarDesconexion(socket.id);
    if (!res || !getSala(res.sala.codigo)) return;
    const { sala, jugador } = res;
    if (sala.votacionActiva) {
      if (sala.votacionActiva.targetId === jugador.id) {
        cancelarVotacion(sala);
        io.to(sala.codigo).emit("votacion_cerrada", { resultado: "cancelada" });
        broadcastVotacion(sala);
      } else {
        evaluarYCerrar(sala);
      }
    }
    broadcastSala(sala);
    if (sala.estado === "en_juego") broadcastPartida(sala);
  });
});

httpServer.listen(PORT, () => {
  console.log(`[server] escuchando en http://localhost:${PORT}`);
});
