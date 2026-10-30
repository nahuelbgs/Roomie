import { customAlphabet, nanoid } from "nanoid";
import { categoriasFutbolActivas, famososActivos } from "./db.js";
import type {
  ConfigSala,
  Jugador,
  Juego,
  PartidaVista,
  Sala,
  SalaVista,
  TipoVotacion,
  VotacionVista,
} from "./types.js";

export type ResultadoVotacion = "pendiente" | "aprobada" | "rechazada";

const nuevoCodigo = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 4);
const salas = new Map<string, Sala>();

export const LIMPIEZA_MS = Number(process.env.LIMPIEZA_SALA_MS ?? 5 * 60 * 1000);

export function crearSala(juego: Juego, config: ConfigSala): Sala {
  let codigo = nuevoCodigo();
  while (salas.has(codigo)) codigo = nuevoCodigo();
  const sala: Sala = {
    codigo,
    juego,
    anfitrionId: "",
    estado: "esperando",
    config,
    jugadores: [],
    usados: [],
    votacionActiva: null,
    limpiezaProgramada: null,
  };
  salas.set(codigo, sala);
  return sala;
}

export function cancelarLimpieza(sala: Sala): void {
  if (sala.limpiezaProgramada) {
    clearTimeout(sala.limpiezaProgramada);
    sala.limpiezaProgramada = null;
  }
}

function programarLimpieza(sala: Sala): void {
  cancelarLimpieza(sala);
  sala.limpiezaProgramada = setTimeout(() => {
    salas.delete(sala.codigo);
    console.log(`[rooms] sala ${sala.codigo} eliminada por inactividad`);
  }, LIMPIEZA_MS);
}

export function getSala(codigo: string): Sala | undefined {
  return salas.get(codigo.toUpperCase());
}

export function salaDelSocket(socketId: string): Sala | null {
  for (const sala of salas.values()) {
    if (sala.jugadores.some((j) => j.socketId === socketId)) return sala;
  }
  return null;
}

export function agregarJugador(
  sala: Sala,
  nombreDeseado: string,
  socketId: string,
): Jugador {
  cancelarLimpieza(sala);
  const jugador: Jugador = {
    id: nanoid(),
    socketId,
    nombre: nombreUnico(sala, nombreDeseado),
    conectado: true,
    asignacion: null,
    token: nanoid(),
  };
  sala.jugadores.push(jugador);
  if (!sala.anfitrionId) sala.anfitrionId = jugador.id;
  return jugador;
}

export function reconectar(
  codigo: string,
  jugadorId: string,
  token: string,
  socketId: string,
): { ok: true; sala: Sala; jugador: Jugador; antiguoSocketId: string | null } | { ok: false; error: string } {
  const sala = getSala(codigo);
  if (!sala) return { ok: false, error: "Sala no encontrada" };
  const jugador = sala.jugadores.find((j) => j.id === jugadorId);
  if (!jugador) return { ok: false, error: "Jugador no encontrado" };
  if (jugador.token !== token) return { ok: false, error: "Token inválido" };
  const antiguoSocketId = jugador.conectado ? jugador.socketId : null;
  jugador.conectado = true;
  jugador.socketId = socketId;
  cancelarLimpieza(sala);
  return { ok: true, sala, jugador, antiguoSocketId };
}

function nombreUnico(sala: Sala, deseado: string): string {
  const base = deseado.trim().slice(0, 24) || "Jugador";
  const tomados = new Set(sala.jugadores.map((j) => j.nombre));
  if (!tomados.has(base)) return base;
  let i = 2;
  while (tomados.has(`${base} (${i})`)) i++;
  return `${base} (${i})`;
}

export function manejarDesconexion(
  socketId: string,
): { sala: Sala; jugador: Jugador } | null {
  for (const sala of salas.values()) {
    const idx = sala.jugadores.findIndex((j) => j.socketId === socketId);
    if (idx === -1) continue;
    const jugador = sala.jugadores[idx];
    if (sala.estado === "esperando") {
      sala.jugadores.splice(idx, 1);
      if (sala.jugadores.length === 0) {
        salas.delete(sala.codigo);
      } else if (sala.anfitrionId === jugador.id) {
        sala.anfitrionId = sala.jugadores[0].id;
      }
    } else {
      jugador.conectado = false;
      jugador.socketId = null;
      if (sala.anfitrionId === jugador.id) {
        const nuevo = sala.jugadores.find((j) => j.conectado);
        if (nuevo) sala.anfitrionId = nuevo.id;
      }
      if (!sala.jugadores.some((j) => j.conectado)) {
        programarLimpieza(sala);
      }
    }
    return { sala, jugador };
  }
  return null;
}

export function salirExplicito(
  socketId: string,
): { sala: Sala; jugador: Jugador } | null {
  for (const sala of salas.values()) {
    const idx = sala.jugadores.findIndex((j) => j.socketId === socketId);
    if (idx === -1) continue;
    const [jugador] = sala.jugadores.splice(idx, 1);
    if (sala.jugadores.length === 0) {
      salas.delete(sala.codigo);
    } else if (sala.anfitrionId === jugador.id) {
      const nuevo = sala.jugadores.find((j) => j.conectado) ?? sala.jugadores[0];
      sala.anfitrionId = nuevo.id;
    }
    return { sala, jugador };
  }
  return null;
}

function shuffleInPlace<T>(xs: T[]): void {
  for (let i = xs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [xs[i], xs[j]] = [xs[j], xs[i]];
  }
}

export function resetearRonda(sala: Sala): void {
  sala.estado = "esperando";
  sala.votacionActiva = null;
  for (const j of sala.jugadores) j.asignacion = null;
}

export function cambiarJuegoDe(sala: Sala, juego: Juego): void {
  sala.juego = juego;
  sala.usados = [];
  sala.votacionActiva = null;
  for (const j of sala.jugadores) j.asignacion = null;
}

export function asignarNumeros(sala: Sala): void {
  const { rangoMin, rangoMax } = sala.config;
  const total = rangoMax - rangoMin + 1;
  const activos = sala.jugadores.filter((j) => j.conectado);
  if (activos.length < 2) throw new Error("Mínimo 2 jugadores conectados");
  if (activos.length > total) {
    throw new Error(
      `El rango (${rangoMin}-${rangoMax}) no alcanza para ${activos.length} jugadores`,
    );
  }
  const pool = Array.from({ length: total }, (_, i) => i + rangoMin);
  shuffleInPlace(pool);
  for (const j of sala.jugadores) j.asignacion = null;
  activos.forEach((jug, i) => {
    jug.asignacion = pool[i];
  });
}

function generarPoolPlata(): number[] {
  const pool: number[] = [];
  for (let x = 100; x < 1000; x += 100) pool.push(x);
  for (let x = 1000; x < 10000; x += 1000) pool.push(x);
  for (let x = 10000; x < 100000; x += 10000) pool.push(x);
  for (let x = 100000; x < 1000000; x += 100000) pool.push(x);
  for (let x = 1000000; x <= 5000000; x += 500000) pool.push(x);
  for (let x = 6000000; x <= 10000000; x += 1000000) pool.push(x);
  return pool;
}

export function asignarPlata(sala: Sala): void {
  const activos = sala.jugadores.filter((j) => j.conectado);
  if (activos.length < 2) throw new Error("Mínimo 2 jugadores conectados");
  const pool = generarPoolPlata();
  if (activos.length > pool.length) {
    throw new Error(`No alcanzan los valores para ${activos.length} jugadores`);
  }
  shuffleInPlace(pool);
  for (const j of sala.jugadores) j.asignacion = null;
  activos.forEach((jug, i) => {
    jug.asignacion = pool[i];
  });
}

export function asignarCategorias(sala: Sala): void {
  const activos = sala.jugadores.filter((j) => j.conectado);
  if (activos.length < 2) throw new Error("Mínimo 2 jugadores conectados");

  const todas = categoriasFutbolActivas().map((c) => c.texto);
  if (todas.length < activos.length) {
    throw new Error(
      `No alcanzan las categorías (${todas.length}) para ${activos.length} jugadores`,
    );
  }
  const sinUsar = todas.filter((t) => !sala.usados.includes(t));
  let pool: string[];
  if (sinUsar.length >= activos.length) {
    pool = sinUsar;
  } else {
    sala.usados = [];
    pool = todas.slice();
  }
  shuffleInPlace(pool);
  for (const j of sala.jugadores) j.asignacion = null;
  activos.forEach((jug, i) => {
    jug.asignacion = pool[i];
    sala.usados.push(pool[i]);
  });
}

export function asignarFamosos(sala: Sala): void {
  const activos = sala.jugadores.filter((j) => j.conectado);
  if (activos.length < 2) throw new Error("Mínimo 2 jugadores conectados");

  const todos = famososActivos(sala.config.categorias).map((f) => f.nombre);
  if (todos.length < activos.length) {
    throw new Error(
      `No alcanzan los famosos (${todos.length}) para ${activos.length} jugadores`,
    );
  }
  const sinUsar = todos.filter((n) => !sala.usados.includes(n));
  let pool: string[];
  if (sinUsar.length >= activos.length) {
    pool = sinUsar;
  } else {
    // Reciclar: el ciclo se agotó, arrancamos de nuevo con todos
    sala.usados = [];
    pool = todos.slice();
  }
  shuffleInPlace(pool);
  for (const j of sala.jugadores) j.asignacion = null;
  activos.forEach((jug, i) => {
    jug.asignacion = pool[i];
    sala.usados.push(pool[i]);
  });
}

export function partidaParaJugador(sala: Sala, miId: string): PartidaVista {
  return {
    codigo: sala.codigo,
    juego: sala.juego,
    esAnfitrion: sala.anfitrionId === miId,
    otros: sala.jugadores
      .filter((j) => j.id !== miId && j.conectado && j.asignacion !== null)
      .map((j) => ({
        id: j.id,
        nombre: j.nombre,
        asignacion: j.asignacion as number | string,
      })),
  };
}

export function iniciarVotacion(
  sala: Sala,
  iniciadorId: string,
  payload: { tipo: TipoVotacion; targetId: string; propuesta?: string },
): { ok: true } | { ok: false; error: string } {
  if (sala.estado !== "en_juego") {
    return { ok: false, error: "La partida no está en curso" };
  }
  if (sala.juego !== "famosos" && sala.juego !== "categorias") {
    return { ok: false, error: "Esta función no aplica a este juego" };
  }
  if (sala.votacionActiva) {
    return { ok: false, error: "Ya hay una votación en curso" };
  }
  const target = sala.jugadores.find((j) => j.id === payload.targetId);
  if (!target || !target.conectado) {
    return { ok: false, error: "Jugador no encontrado o desconectado" };
  }
  if (iniciadorId === payload.targetId) {
    return { ok: false, error: "No podés votarte a vos mismo" };
  }

  let propuesta: string | null = null;
  if (payload.tipo === "proponer") {
    const texto = (payload.propuesta ?? "").trim();
    if (!texto) return { ok: false, error: "La propuesta no puede estar vacía" };
    if (texto.length > 120) return { ok: false, error: "Propuesta muy larga (máx 120)" };
    for (const j of sala.jugadores) {
      if (j.id !== target.id && j.conectado && j.asignacion === texto) {
        return { ok: false, error: `Ya se la asignaron a ${j.nombre}` };
      }
    }
    propuesta = texto;
  }

  const elegiblesIds = sala.jugadores
    .filter((j) => j.conectado && j.id !== target.id)
    .map((j) => j.id);
  const jugadoresAlInicio = sala.jugadores.filter((j) => j.conectado).length;

  sala.votacionActiva = {
    tipo: payload.tipo,
    targetId: target.id,
    iniciadorId,
    propuesta,
    jugadoresAlInicio,
    elegiblesIds,
    votos: { [iniciadorId]: true },
  };
  return { ok: true };
}

export function registrarVoto(
  sala: Sala,
  jugadorId: string,
  voto: boolean,
): { ok: true } | { ok: false; error: string } {
  if (!sala.votacionActiva) return { ok: false, error: "No hay votación activa" };
  const v = sala.votacionActiva;
  if (!v.elegiblesIds.includes(jugadorId)) {
    return { ok: false, error: "No podés votar en esta votación" };
  }
  if (jugadorId in v.votos) {
    return { ok: false, error: "Ya votaste" };
  }
  v.votos[jugadorId] = voto;
  return { ok: true };
}

export function evaluarVotacion(sala: Sala): ResultadoVotacion {
  const v = sala.votacionActiva;
  if (!v) return "pendiente";
  const threshold = Math.ceil(v.jugadoresAlInicio / 2);
  const yes = Object.values(v.votos).filter((x) => x).length;
  if (yes >= threshold) return "aprobada";
  const porVotar = v.elegiblesIds.filter((id) => {
    const j = sala.jugadores.find((x) => x.id === id);
    return j?.conectado && !(id in v.votos);
  });
  if (porVotar.length === 0) return "rechazada";
  return "pendiente";
}

function sortearNuevo(sala: Sala, targetId: string): string | null {
  const todas =
    sala.juego === "famosos"
      ? famososActivos().map((f) => f.nombre)
      : categoriasFutbolActivas().map((c) => c.texto);
  const ocupadas = new Set<string>();
  for (const j of sala.jugadores) {
    if (typeof j.asignacion === "string") ocupadas.add(j.asignacion);
  }
  const disponibles = todas.filter((t) => !ocupadas.has(t));
  if (disponibles.length === 0) return null;
  void targetId;
  return disponibles[Math.floor(Math.random() * disponibles.length)];
}

export function cerrarVotacionAprobada(sala: Sala): void {
  const v = sala.votacionActiva;
  if (!v) return;
  const target = sala.jugadores.find((j) => j.id === v.targetId);
  if (!target) {
    sala.votacionActiva = null;
    return;
  }
  const nuevo = v.tipo === "proponer" ? v.propuesta : sortearNuevo(sala, target.id);
  if (nuevo) {
    target.asignacion = nuevo;
    if (!sala.usados.includes(nuevo)) sala.usados.push(nuevo);
  }
  sala.votacionActiva = null;
}

export function cancelarVotacion(sala: Sala): void {
  sala.votacionActiva = null;
}

export function votacionVista(sala: Sala, viewerId: string): VotacionVista | null {
  const v = sala.votacionActiva;
  if (!v) return null;
  const target = sala.jugadores.find((j) => j.id === v.targetId);
  const iniciador = sala.jugadores.find((j) => j.id === v.iniciadorId);
  const esTarget = viewerId === v.targetId;
  const puedoVotar = v.elegiblesIds.includes(viewerId) && !(viewerId in v.votos);
  const miVoto = viewerId in v.votos ? v.votos[viewerId] : null;
  return {
    tipo: v.tipo,
    targetId: v.targetId,
    targetNombre: target?.nombre ?? "",
    iniciadorId: v.iniciadorId,
    iniciadorNombre: iniciador?.nombre ?? "",
    propuesta: esTarget ? null : v.propuesta,
    threshold: Math.ceil(v.jugadoresAlInicio / 2),
    yes: Object.values(v.votos).filter((x) => x).length,
    no: Object.values(v.votos).filter((x) => !x).length,
    puedoVotar,
    miVoto,
  };
}

export function vista(sala: Sala): SalaVista {
  return {
    codigo: sala.codigo,
    juego: sala.juego,
    estado: sala.estado,
    jugadores: sala.jugadores.map((j) => ({
      id: j.id,
      nombre: j.nombre,
      conectado: j.conectado,
      esAnfitrion: j.id === sala.anfitrionId,
    })),
  };
}
