import { useState } from "react";
import { TEMA_JUEGO } from "../tema";
import type { Intencion, Juego } from "../types";

interface Props {
  onSiguiente: (intencion: Intencion) => void;
  codigoInicial?: string;
}

const DECORACION: Record<Juego, string> = {
  numeros: "77",
  famosos: "★",
  categorias: "⚽",
  plata: "$",
};

export default function Inicio({ onSiguiente, codigoInicial = "" }: Props) {
  const [codigo, setCodigo] = useState(codigoInicial);
  const codigoNormalizado = codigo.trim().toUpperCase();
  const codigoValido = /^[A-Z0-9]{4}$/.test(codigoNormalizado);
  const juegos: Juego[] = ["numeros", "famosos", "categorias", "plata"];

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 p-6 pt-10">
      <header className="flex items-start justify-between">
        <div>
          <div className="inline-block rounded-full bg-smoky px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-fantasy">
            Roomie
          </div>
          <h1 className="mt-4 text-4xl font-extrabold leading-[1.05]">
            Elegí un juego<br />para jugar.
          </h1>
        </div>
        <div className="flex -space-x-2">
          <div className="h-9 w-9 rounded-full bg-gold ring-4 ring-fantasy" />
          <div className="h-9 w-9 rounded-full bg-blossom ring-4 ring-fantasy" />
          <div className="h-9 w-9 rounded-full bg-malibu ring-4 ring-fantasy" />
          <div className="h-9 w-9 rounded-full bg-teal ring-4 ring-fantasy" />
        </div>
      </header>

      <section className="flex flex-col gap-3">
        {juegos.map((j) => {
          const t = TEMA_JUEGO[j];
          return (
            <button
              key={j}
              onClick={() => onSiguiente({ kind: "crear", juego: j })}
              className={`${t.bg} ${t.fg} relative overflow-hidden rounded-3xl p-6 text-left shadow-sm transition active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-smoky`}
            >
              <div className="pointer-events-none absolute -right-4 -top-2 select-none text-[7rem] font-black leading-none opacity-10">
                {DECORACION[j]}
              </div>
              <div className="relative">
                <div className="text-[11px] font-bold uppercase tracking-widest opacity-60">
                  Juego · {t.descripcion}
                </div>
                <div className="mt-3 text-3xl font-extrabold leading-[1.1]">
                  {t.label}
                </div>
                <div
                  className={`${t.ctaBg} ${t.ctaFg} mt-5 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold`}
                >
                  Crear sala →
                </div>
              </div>
            </button>
          );
        })}
      </section>

      <div className="flex items-center gap-3 text-[11px] font-bold uppercase tracking-widest text-smoky/40">
        <div className="h-px flex-1 bg-smoky/15" />
        <span>o entrá a una sala</span>
        <div className="h-px flex-1 bg-smoky/15" />
      </div>

      <section className="rounded-3xl bg-lavender p-5 shadow-sm">
        <div className="text-[11px] font-bold uppercase tracking-widest text-smoky/70">
          Ya tenés un código
        </div>
        <input
          value={codigo}
          onChange={(e) => setCodigo(e.target.value)}
          placeholder="ABCD"
          maxLength={4}
          className="mt-3 w-full rounded-2xl bg-fantasy px-4 py-4 text-center text-2xl font-black uppercase tracking-widest outline-none transition placeholder:text-smoky/30 focus:ring-2 focus:ring-smoky/30"
        />
        <button
          disabled={!codigoValido}
          onClick={() => onSiguiente({ kind: "unirse", codigo: codigoNormalizado })}
          className="mt-3 w-full rounded-full bg-smoky px-6 py-3.5 font-bold text-fantasy shadow-sm transition active:scale-[0.98] disabled:opacity-30"
        >
          Unirse
        </button>
      </section>
    </main>
  );
}
