import { useEffect, useRef, useState } from "react";
import { socket } from "./socket";
import Inicio from "./screens/Inicio";
import Nombre from "./screens/Nombre";
import SalaEspera from "./screens/SalaEspera";
import Partida from "./screens/Partida";
import { borrarSesion, guardarSesion, leerSesion } from "./sessionSala";
import type { Intencion, PartidaVista, SalaVista, VotacionVista } from "./types";

type Pantalla =
  | { kind: "inicio" }
  | { kind: "nombre"; intencion: Intencion }
  | { kind: "en-sala"; jugadorId: string };

interface ReconnectAck {
  ok: boolean;
  codigo?: string;
  jugadorId?: string;
  token?: string;
  error?: string;
}

function codigoDesdeHash(): string {
  const hash = window.location.hash.slice(1).trim().toUpperCase();
  return /^[A-Z0-9]{4}$/.test(hash) ? hash : "";
}

export default function App() {
  const [pantalla, setPantalla] = useState<Pantalla>(() =>
    leerSesion() ? { kind: "inicio" } : { kind: "inicio" },
  );
  const [sala, setSala] = useState<SalaVista | null>(null);
  const [partida, setPartida] = useState<PartidaVista | null>(null);
  const [votacion, setVotacion] = useState<VotacionVista | null>(null);
  const [connected, setConnected] = useState(false);
  const [reconectando, setReconectando] = useState<boolean>(() => !!leerSesion());
  const [codigoDeLink] = useState(codigoDesdeHash);
  const intentoReconexionRef = useRef(false);

  useEffect(() => {
    socket.connect();
    const onConnect = () => {
      setConnected(true);
      if (intentoReconexionRef.current) return;
      const r = leerSesion();
      if (!r) return;
      intentoReconexionRef.current = true;
      socket.emit("reconectar_sala", r, (ack: ReconnectAck) => {
        if (ack?.ok && ack.codigo && ack.jugadorId && ack.token) {
          guardarSesion({ codigo: ack.codigo, jugadorId: ack.jugadorId, token: ack.token });
          setPantalla({ kind: "en-sala", jugadorId: ack.jugadorId });
        } else {
          borrarSesion();
        }
        setReconectando(false);
      });
    };
    const onDisconnect = () => setConnected(false);
    const onJugadores = (v: SalaVista) => {
      setSala(v);
      if (v.estado === "esperando") setPartida(null);
    };
    const onPartida = (p: PartidaVista) => setPartida(p);
    const onVotacion = (v: VotacionVista | null) => setVotacion(v);
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("jugadores_actualizados", onJugadores);
    socket.on("partida_iniciada", onPartida);
    socket.on("votacion_actualizada", onVotacion);
    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("jugadores_actualizados", onJugadores);
      socket.off("partida_iniciada", onPartida);
      socket.off("votacion_actualizada", onVotacion);
      socket.disconnect();
    };
  }, []);

  function entrarEnSala(datos: { codigo: string; jugadorId: string; token: string }) {
    guardarSesion(datos);
    setPantalla({ kind: "en-sala", jugadorId: datos.jugadorId });
  }

  function volverAlInicio() {
    socket.emit("salir_sala");
    borrarSesion();
    setSala(null);
    setPartida(null);
    setVotacion(null);
    setPantalla({ kind: "inicio" });
    history.replaceState(null, "", window.location.pathname);
  }

  if (reconectando) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6 text-sm text-smoky/60">
        Reconectando a la sala...
      </main>
    );
  }

  if (pantalla.kind === "inicio") {
    return (
      <Inicio
        codigoInicial={codigoDeLink}
        onSiguiente={(intencion) => setPantalla({ kind: "nombre", intencion })}
      />
    );
  }

  if (pantalla.kind === "nombre") {
    return (
      <Nombre
        intencion={pantalla.intencion}
        connected={connected}
        onConfirmado={entrarEnSala}
        onVolver={() => setPantalla({ kind: "inicio" })}
      />
    );
  }

  if (!sala) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6 text-sm text-smoky/60">
        Cargando sala...
      </main>
    );
  }

  if (sala.estado === "en_juego") {
    if (!partida) {
      return (
        <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
          <h1 className="text-3xl font-extrabold leading-tight">Partida en curso</h1>
          <p className="text-smoky/60">
            Esperá a que el anfitrión vuelva a repartir y te sumás a la próxima ronda.
          </p>
          <button
            onClick={volverAlInicio}
            className="mt-2 text-sm text-smoky/60 underline underline-offset-4 hover:text-smoky"
          >
            Salir de la sala
          </button>
        </main>
      );
    }
    return (
      <Partida
        partida={partida}
        votacion={votacion}
        miId={pantalla.jugadorId}
        onVolverAlInicio={volverAlInicio}
      />
    );
  }

  return <SalaEspera sala={sala} miId={pantalla.jugadorId} onSalir={volverAlInicio} />;
}
