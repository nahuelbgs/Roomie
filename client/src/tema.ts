import type { Juego } from "./types";

export interface TemaJuego {
  bg: string;
  fg: string;
  ctaBg: string;
  ctaFg: string;
  nombre: string;
  label: string;
  descripcion: string;
  articulo: string;
  sustantivo: string;
}

export const TEMA_JUEGO: Record<Juego, TemaJuego> = {
  numeros: {
    bg: "bg-gold",
    fg: "text-smoky",
    ctaBg: "bg-smoky",
    ctaFg: "text-fantasy",
    nombre: "Números",
    label: "Adiviná tu número",
    descripcion: "del 1 al 100",
    articulo: "tu propio",
    sustantivo: "número",
  },
  famosos: {
    bg: "bg-blossom",
    fg: "text-smoky",
    ctaBg: "bg-smoky",
    ctaFg: "text-fantasy",
    nombre: "Famosos",
    label: "Adiviná el famoso",
    descripcion: "deportistas, música, cine y más",
    articulo: "tu propio",
    sustantivo: "famoso",
  },
  categorias: {
    bg: "bg-malibu",
    fg: "text-smoky",
    ctaBg: "bg-smoky",
    ctaFg: "text-fantasy",
    nombre: "Categoría",
    label: "Adiviná la categoría",
    descripcion: "fútbol: historia, selección y clubes",
    articulo: "tu propia",
    sustantivo: "categoría",
  },
  plata: {
    bg: "bg-teal",
    fg: "text-fantasy",
    ctaBg: "bg-fantasy",
    ctaFg: "text-smoky",
    nombre: "Plata",
    label: "Adiviná la plata",
    descripcion: "del $100 al $10 millones",
    articulo: "tu propio",
    sustantivo: "monto",
  },
};
