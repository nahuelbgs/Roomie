import { useState } from "react";
import { socket } from "../socket";
import { TEMA_JUEGO } from "../tema";
import type { Juego, VotacionVista } from "../types";

interface Props {
  votacion: VotacionVista;
  miId: string;
  juego: Juego;
}

export default function VoteBanner({ votacion, miId, juego }: Props) {
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const esTarget = votacion.targetId === miId;
  const tema = TEMA_JUEGO[juego];

  function votar(voto: boolean) {
    if (enviando) return;
    setEnviando(true);
    setError(null);
    socket.emit("votar", { voto }, (res: { ok: boolean; error?: string }) => {
      setEnviando(false);
      if (!res?.ok) setError(res?.error ?? "No se pudo votar");
    });
  }

  const titulo = votacion.tipo === "cambiar"
    ? `${votacion.iniciadorNombre} quiere cambiarle el ${tema.sustantivo} a ${votacion.targetNombre}`
    : esTarget
      ? `${votacion.iniciadorNombre} propuso cambiarte el ${tema.sustantivo}`
      : `${votacion.iniciadorNombre} propone para ${votacion.targetNombre}:`;

  return (
    <section className="rounded-3xl border-2 border-smoky bg-fantasy p-5 shadow-sm">
      <div className="text-[11px] font-bold uppercase tracking-widest text-smoky/50">
        Votación en curso
      </div>
      <p className="mt-2 text-sm font-semibold leading-snug">{titulo}</p>
      {votacion.tipo === "proponer" && votacion.propuesta && (
        <div
          className={`${tema.bg} ${tema.fg} mt-3 rounded-2xl px-4 py-3 text-base font-bold leading-tight`}
        >
          "{votacion.propuesta}"
        </div>
      )}
      <div className="mt-3 flex items-center justify-between text-xs font-semibold text-smoky/60">
        <span>
          {votacion.yes} <span className="text-smoky/40">sí</span> ·{" "}
          {votacion.no} <span className="text-smoky/40">no</span>
        </span>
        <span>umbral {votacion.threshold}</span>
      </div>

      {votacion.puedoVotar && (
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            onClick={() => votar(true)}
            disabled={enviando}
            className="rounded-full bg-smoky px-4 py-3 text-sm font-bold text-fantasy transition active:scale-[0.98] disabled:opacity-30"
          >
            Votar sí
          </button>
          <button
            onClick={() => votar(false)}
            disabled={enviando}
            className="rounded-full border-2 border-smoky px-4 py-3 text-sm font-bold text-smoky transition active:scale-[0.98] disabled:opacity-30"
          >
            Votar no
          </button>
        </div>
      )}
      {!votacion.puedoVotar && !esTarget && votacion.miVoto !== null && (
        <div className="mt-3 text-xs text-smoky/60">
          Ya votaste {votacion.miVoto ? "sí" : "no"}.
        </div>
      )}
      {esTarget && (
        <div className="mt-3 text-xs text-smoky/60">
          No podés votar sobre tu propio {tema.sustantivo}.
        </div>
      )}
      {error && <p className="mt-2 text-sm font-semibold text-coral">{error}</p>}
    </section>
  );
}
