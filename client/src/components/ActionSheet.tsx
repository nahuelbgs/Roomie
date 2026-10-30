import { useState } from "react";
import { socket } from "../socket";
import { TEMA_JUEGO } from "../tema";
import type { Juego } from "../types";

interface Props {
  targetId: string;
  targetNombre: string;
  juego: Juego;
  onCerrar: () => void;
}

type Modo = "opciones" | "proponer";

export default function ActionSheet({ targetId, targetNombre, juego, onCerrar }: Props) {
  const [modo, setModo] = useState<Modo>("opciones");
  const [propuesta, setPropuesta] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tema = TEMA_JUEGO[juego];

  function cambiar() {
    if (enviando) return;
    setEnviando(true);
    setError(null);
    socket.emit(
      "iniciar_votacion_cambiar",
      { targetId },
      (res: { ok: boolean; error?: string }) => {
        setEnviando(false);
        if (!res?.ok) {
          setError(res?.error ?? "No se pudo iniciar la votación");
          return;
        }
        onCerrar();
      },
    );
  }

  function proponer() {
    if (enviando || !propuesta.trim()) return;
    setEnviando(true);
    setError(null);
    socket.emit(
      "iniciar_votacion_proponer",
      { targetId, propuesta: propuesta.trim() },
      (res: { ok: boolean; error?: string }) => {
        setEnviando(false);
        if (!res?.ok) {
          setError(res?.error ?? "No se pudo proponer");
          return;
        }
        onCerrar();
      },
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div
        className="absolute inset-0 bg-smoky/50"
        onClick={onCerrar}
        aria-hidden
      />
      <div className="relative w-full max-w-md rounded-t-3xl bg-fantasy p-6 shadow-2xl">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-smoky/20" />

        {modo === "opciones" && (
          <>
            <h2 className="text-xs font-bold uppercase tracking-widest text-smoky/50">
              Cambiarle el {tema.sustantivo} a
            </h2>
            <p className="mt-1 text-2xl font-extrabold leading-tight">
              {targetNombre}
            </p>
            <p className="mt-2 text-xs text-smoky/60">
              Necesita el 50% de los jugadores conectados para aprobar.
            </p>

            <div className="mt-5 flex flex-col gap-2">
              <button
                onClick={cambiar}
                disabled={enviando}
                className={`${tema.bg} ${tema.fg} rounded-2xl p-4 text-left shadow-sm transition active:scale-[0.98] disabled:opacity-40`}
              >
                <div className="text-xs font-bold uppercase tracking-widest opacity-70">
                  al azar
                </div>
                <div className="mt-1 text-base font-extrabold">
                  Cambiarle al azar
                </div>
              </button>
              <button
                onClick={() => setModo("proponer")}
                disabled={enviando}
                className="rounded-2xl border-2 border-smoky p-4 text-left transition active:scale-[0.98] disabled:opacity-40"
              >
                <div className="text-xs font-bold uppercase tracking-widest text-smoky/60">
                  específico
                </div>
                <div className="mt-1 text-base font-extrabold">
                  Proponer uno nuevo
                </div>
              </button>
            </div>

            {error && <p className="mt-3 text-sm font-semibold text-coral">{error}</p>}

            <button
              onClick={onCerrar}
              className="mt-4 w-full text-xs text-smoky/60 underline underline-offset-4"
            >
              Cancelar
            </button>
          </>
        )}

        {modo === "proponer" && (
          <>
            <h2 className="text-xs font-bold uppercase tracking-widest text-smoky/50">
              Proponerle un {tema.sustantivo} a
            </h2>
            <p className="mt-1 text-2xl font-extrabold leading-tight">
              {targetNombre}
            </p>
            <input
              autoFocus
              value={propuesta}
              onChange={(e) => setPropuesta(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && proponer()}
              placeholder={
                juego === "famosos"
                  ? "Ej: Lionel Messi, Mirtha Legrand..."
                  : "Ej: Jugadores sudamericanos del Real Madrid..."
              }
              maxLength={120}
              className="mt-4 w-full rounded-2xl border border-smoky/15 bg-white px-4 py-3 outline-none focus:border-smoky/40"
            />
            <button
              onClick={proponer}
              disabled={enviando || !propuesta.trim()}
              className="mt-3 w-full rounded-full bg-smoky px-6 py-3.5 font-bold text-fantasy shadow-sm transition active:scale-[0.98] disabled:opacity-30"
            >
              {enviando ? "Enviando..." : "Enviar propuesta"}
            </button>
            {error && <p className="mt-2 text-sm font-semibold text-coral">{error}</p>}
            <button
              onClick={() => setModo("opciones")}
              className="mt-3 w-full text-xs text-smoky/60 underline underline-offset-4"
            >
              ← atrás
            </button>
          </>
        )}
      </div>
    </div>
  );
}
