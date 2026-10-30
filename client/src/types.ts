export type Juego = "numeros" | "famosos" | "categorias" | "plata";
export type EstadoSala = "esperando" | "en_juego" | "finalizada";

export interface JugadorPublico {
  id: string;
  nombre: string;
  conectado: boolean;
  esAnfitrion: boolean;
}

export interface SalaVista {
  codigo: string;
  juego: Juego;
  estado: EstadoSala;
  jugadores: JugadorPublico[];
}

export interface JugadorEnPartida {
  id: string;
  nombre: string;
  asignacion: number | string;
}

export interface PartidaVista {
  codigo: string;
  juego: Juego;
  esAnfitrion: boolean;
  otros: JugadorEnPartida[];
}

export type Intencion =
  | { kind: "crear"; juego: Juego }
  | { kind: "unirse"; codigo: string };

export type TipoVotacion = "cambiar" | "proponer";

export interface VotacionVista {
  tipo: TipoVotacion;
  targetId: string;
  targetNombre: string;
  iniciadorId: string;
  iniciadorNombre: string;
  propuesta: string | null;
  threshold: number;
  yes: number;
  no: number;
  puedoVotar: boolean;
  miVoto: boolean | null;
}
