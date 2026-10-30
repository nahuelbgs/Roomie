import { useState } from "react";
import { socket } from "../socket";
import { copiarAlPortapapeles } from "../clipboard";
import { TEMA_JUEGO } from "../tema";
import type { Juego, SalaVista } from "../types";

interface Props {
  sala: SalaVista;
  miId: string;
  onSalir: () => void;
}

type Copiado = "codigo" | "link" | null;

export default function SalaEspera({ sala, miId, onSalir }: Props) {
  const [copiado, setCopiado] = useState<Copiado>(null);
  const [iniciando, setIniciando] = useState(false);
  const [cambiando, setCambiando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const yo = sala.jugadores.find((j) => j.id === miId);
  const esAnfitrion = yo?.esAnfitrion ?? false;
  const puedeIniciar = sala.jugadores.length >= 2;
  const tema = TEMA_JUEGO[sala.juego];

  const link = `${window.location.origin}/#${sala.codigo}`;

  async function copiar(que: "codigo" | "link") {
    const texto = que === "codigo" ? sala.codigo : link;
    const ok = await copiarAlPortapapeles(texto);
    if (!ok) return;
    setCopiado(que);
    setTimeout(() => setCopiado((c) => (c === que ? null : c)), 1500);
  }

  function iniciarPartida() {
    if (!puedeIniciar || iniciando) return;
    setIniciando(true);
    setError(null);
    socket.emit(
      "iniciar_partida",
      {},
      (res: { ok: boolean; error?: string }) => {
        setIniciando(false);
        if (!res?.ok) setError(res?.error ?? "No se pudo iniciar");
      },
    );
  }

  function cambiarJuego(nuevo: Juego) {
    if (cambiando || nuevo === sala.juego) return;
    setCambiando(true);
    setError(null);
    socket.emit(
      "cambiar_juego",
      { juego: nuevo },
      (res: { ok: boolean; error?: string }) => {
        setCambiando(false);
        if (!res?.ok) setError(res?.error ?? "No se pudo cambiar el juego");
      },
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 p-6">
      <header className="flex flex-col items-center gap-3 pt-4 text-center">
        {esAnfitrion ? (
          <div className="inline-flex gap-1 rounded-full bg-smoky/5 p-1">
            {(["numeros", "famosos", "categorias", "plata"] as Juego[]).map((j) => {
              const seleccionado = j === sala.juego;
              return (
                <button
                  key={j}
                  onClick={() => cambiarJuego(j)}
                  disabled={cambiando}
                  className={`rounded-full px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wide transition ${
                    seleccionado
                      ? `${TEMA_JUEGO[j].bg} ${TEMA_JUEGO[j].fg} shadow-sm`
                      : "text-smoky/50 hover:text-smoky"
                  }`}
                >
                  {TEMA_JUEGO[j].nombre}
                </button>
              );
            })}
          </div>
        ) : (
          <div
            className={`${tema.bg} ${tema.fg} inline-block rounded-full px-4 py-1 text-xs font-bold uppercase tracking-wide`}
          >
            {tema.nombre}
          </div>
        )}
        <div>
          <button
            onClick={() => copiar("codigo")}
            className="inline-block text-6xl font-black tracking-widest transition active:scale-95"
          >
            {sala.codigo}
          </button>
          <div className="mt-1 h-5 text-xs text-smoky/50">
            {copiado === "codigo" ? "¡código copiado!" : "tocá para copiar"}
          </div>
          <button
            onClick={() => copiar("link")}
            className="mt-1 text-xs font-semibold text-smoky/60 underline underline-offset-4 hover:text-smoky"
          >
            {copiado === "link" ? "¡link copiado!" : "copiar link para compartir"}
          </button>
        </div>
      </header>

      <section className="flex-1">
        <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-smoky/50">
          Jugadores ({sala.jugadores.length})
        </h2>
        <ul className="flex flex-col gap-2">
          {sala.jugadores.map((j) => (
            <li
              key={j.id}
              className={`flex items-center justify-between rounded-2xl bg-white px-5 py-3 shadow-sm transition ${
                j.id === miId ? "ring-2 ring-smoky" : ""
              } ${!j.conectado ? "opacity-40" : ""}`}
            >
              <span className="font-semibold">
                {j.nombre}
                {j.id === miId && (
                  <span className="ml-2 text-xs font-normal text-smoky/50">(vos)</span>
                )}
                {!j.conectado && (
                  <span className="ml-2 text-xs font-normal text-smoky/40">
                    (desconectado)
                  </span>
                )}
              </span>
              {j.esAnfitrion && (
                <span
                  className={`${tema.bg} ${tema.fg} rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide`}
                >
                  anfitrión
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>

      <footer className="flex flex-col gap-3">
        {esAnfitrion ? (
          <button
            onClick={iniciarPartida}
            disabled={!puedeIniciar || iniciando}
            className="w-full rounded-full bg-smoky px-6 py-4 font-bold text-fantasy shadow-sm transition active:scale-[0.98] disabled:opacity-30"
          >
            {iniciando
              ? "Iniciando..."
              : puedeIniciar
                ? "Iniciar partida"
                : "Faltan jugadores (mínimo 2)"}
          </button>
        ) : (
          <p className="rounded-2xl bg-white px-4 py-4 text-center text-sm text-smoky/60 shadow-sm">
            Esperando que el anfitrión inicie...
          </p>
        )}
        {error && <p className="text-center text-sm font-semibold text-coral">{error}</p>}
        <button
          onClick={onSalir}
          className="text-xs text-smoky/50 underline underline-offset-4 hover:text-smoky"
        >
          Salir de la sala
        </button>
      </footer>
    </main>
  );
}
