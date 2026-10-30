import { useState } from "react";
import { socket } from "../socket";
import { TEMA_JUEGO } from "../tema";
import type { Intencion } from "../types";

interface Props {
  intencion: Intencion;
  connected: boolean;
  onConfirmado: (datos: { codigo: string; jugadorId: string; token: string }) => void;
  onVolver: () => void;
}

interface AckOk {
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
type Ack = AckOk | AckError;

export default function Nombre({ intencion, connected, onConfirmado, onVolver }: Props) {
  const [nombre, setNombre] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const colorBg =
    intencion.kind === "crear" ? TEMA_JUEGO[intencion.juego].bg : "bg-white";
  const titulo =
    intencion.kind === "crear"
      ? TEMA_JUEGO[intencion.juego].label
      : `Entrar a sala ${intencion.codigo}`;
  const subtitulo = intencion.kind === "crear" ? "Vas a crear una sala nueva." : "";

  function enviar() {
    if (!nombre.trim() || enviando || !connected) return;
    setEnviando(true);
    setError(null);
    const evento = intencion.kind === "crear" ? "crear_sala" : "unirse_sala";
    const payload =
      intencion.kind === "crear"
        ? { juego: intencion.juego, nombre }
        : { codigo: intencion.codigo, nombre };
    socket.emit(evento, payload, (res: Ack) => {
      setEnviando(false);
      if (!res?.ok) {
        setError(res?.error ?? "Error desconocido");
        return;
      }
      onConfirmado({ codigo: res.codigo, jugadorId: res.jugadorId, token: res.token });
    });
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-between gap-6 p-6">
      <header className="pt-2">
        <button
          onClick={onVolver}
          className="text-sm font-semibold text-smoky/60 hover:text-smoky"
        >
          ← Volver
        </button>
      </header>

      <section className={`${colorBg} rounded-3xl p-8 shadow-sm`}>
        <h1 className="text-3xl font-extrabold leading-tight">{titulo}</h1>
        {subtitulo && <p className="mt-2 text-sm text-smoky/70">{subtitulo}</p>}
        <p className="mt-6 text-sm font-semibold text-smoky/70">
          ¿Con qué nombre entrás?
        </p>
        <input
          autoFocus
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && enviar()}
          placeholder="Tu nombre"
          maxLength={24}
          className="mt-2 w-full rounded-2xl bg-fantasy/80 px-4 py-4 text-lg outline-none placeholder:text-smoky/40 focus:ring-2 focus:ring-smoky/30"
        />
        {error && <p className="mt-3 text-sm font-semibold text-coral">{error}</p>}
        {!connected && !error && (
          <p className="mt-3 text-sm text-smoky/60">Conectando al server...</p>
        )}
      </section>

      <section>
        <button
          onClick={enviar}
          disabled={!nombre.trim() || enviando || !connected}
          className="w-full rounded-full bg-smoky px-6 py-4 font-bold text-fantasy shadow-sm transition active:scale-[0.98] disabled:opacity-30"
        >
          {enviando ? "Entrando..." : "Entrar"}
        </button>
      </section>
    </main>
  );
}
