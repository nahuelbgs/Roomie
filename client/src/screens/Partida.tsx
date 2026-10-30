import { useState } from "react";
import { socket } from "../socket";
import { copiarAlPortapapeles } from "../clipboard";
import { TEMA_JUEGO } from "../tema";
import ActionSheet from "../components/ActionSheet";
import VoteBanner from "../components/VoteBanner";
import type { JugadorEnPartida, PartidaVista, VotacionVista } from "../types";

interface Props {
  partida: PartidaVista;
  votacion: VotacionVista | null;
  miId: string;
  onVolverAlInicio: () => void;
}

export default function Partida({ partida, votacion, miId, onVolverAlInicio }: Props) {
  const [recargando, setRecargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [actionTarget, setActionTarget] = useState<JugadorEnPartida | null>(null);

  const tema = TEMA_JUEGO[partida.juego];
  const esNumeros = partida.juego === "numeros";
  const soportaVotacion = partida.juego === "famosos" || partida.juego === "categorias";
  const cardsTocables = soportaVotacion && !votacion;

  const fmtPlata = new Intl.NumberFormat("es-AR");
  function mostrar(valor: number | string): string {
    if (partida.juego === "plata" && typeof valor === "number") {
      return `$ ${fmtPlata.format(valor)}`;
    }
    return String(valor);
  }

  async function copiarCodigo() {
    const ok = await copiarAlPortapapeles(partida.codigo);
    if (!ok) return;
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1500);
  }

  function volverAJugar() {
    if (recargando) return;
    setRecargando(true);
    setError(null);
    socket.emit(
      "volver_a_jugar",
      {},
      (res: { ok: boolean; error?: string }) => {
        setRecargando(false);
        if (!res?.ok) setError(res?.error ?? "No se pudo volver a la sala");
      },
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 p-6">
      <header className="text-center pt-4">
        <div className="text-xs font-semibold uppercase tracking-widest text-smoky/50">
          {tema.label}
        </div>
        <button
          onClick={copiarCodigo}
          className="mt-1 text-xs font-semibold text-smoky/60 underline underline-offset-4 hover:text-smoky"
        >
          Sala {partida.codigo} · {copiado ? "¡copiado!" : "copiar"}
        </button>
      </header>

      {votacion && (
        <VoteBanner votacion={votacion} miId={miId} juego={partida.juego} />
      )}

      <section className="flex-1">
        <p className="mb-4 text-center text-sm text-smoky/70">
          Preguntales al resto para adivinar{" "}
          <span className="font-bold text-smoky">{tema.articulo}</span> {tema.sustantivo}.
          {cardsTocables && (
            <span className="mt-1 block text-xs text-smoky/50">
              (tocá una card para pedir cambio)
            </span>
          )}
        </p>
        <ul className="flex flex-col gap-3">
          {partida.otros.length === 0 ? (
            <li className="rounded-2xl bg-white px-4 py-6 text-center text-sm text-smoky/60 shadow-sm">
              No hay otros jugadores conectados.
            </li>
          ) : (
            partida.otros.map((j) => {
              const tocable = cardsTocables;
              const onTap = tocable ? () => setActionTarget(j) : undefined;
              const cls = tocable
                ? "cursor-pointer transition active:scale-[0.98]"
                : "";
              return esNumeros ? (
                <li
                  key={j.id}
                  onClick={onTap}
                  className={`${tema.bg} ${tema.fg} flex items-center justify-between gap-3 rounded-2xl px-5 py-5 shadow-sm ${cls}`}
                >
                  <span className="min-w-0 flex-1 truncate text-base font-semibold">
                    {j.nombre}
                  </span>
                  <span className="text-4xl font-black tracking-tight">
                    {j.asignacion}
                  </span>
                </li>
              ) : (
                <li
                  key={j.id}
                  onClick={onTap}
                  className={`${tema.bg} ${tema.fg} rounded-2xl px-5 py-4 shadow-sm ${cls}`}
                >
                  <div className="text-[11px] font-semibold uppercase tracking-widest opacity-60">
                    {j.nombre}
                  </div>
                  <div
                    className={`mt-1 font-extrabold leading-tight ${
                      partida.juego === "categorias" ? "text-lg" : "text-2xl"
                    }`}
                  >
                    {mostrar(j.asignacion)}
                  </div>
                </li>
              );
            })
          )}
        </ul>
      </section>

      <footer className="flex flex-col gap-3">
        {partida.esAnfitrion && (
          <button
            onClick={volverAJugar}
            disabled={recargando}
            className="w-full rounded-full bg-smoky px-6 py-4 font-bold text-fantasy shadow-sm transition active:scale-[0.98] disabled:opacity-30"
          >
            {recargando ? "Volviendo..." : "Volver a la sala"}
          </button>
        )}
        {error && <p className="text-center text-sm font-semibold text-coral">{error}</p>}
        <button
          onClick={onVolverAlInicio}
          className="text-xs text-smoky/50 underline underline-offset-4 hover:text-smoky"
        >
          Salir de la sala
        </button>
      </footer>

      {actionTarget && (
        <ActionSheet
          targetId={actionTarget.id}
          targetNombre={actionTarget.nombre}
          juego={partida.juego}
          onCerrar={() => setActionTarget(null)}
        />
      )}
    </main>
  );
}
