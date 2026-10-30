const KEY = "roomie:sala";

export interface DatosSala {
  codigo: string;
  jugadorId: string;
  token: string;
}

export function leerSesion(): DatosSala | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const r = JSON.parse(raw);
    if (
      typeof r?.codigo === "string" &&
      typeof r?.jugadorId === "string" &&
      typeof r?.token === "string"
    ) {
      return r;
    }
    return null;
  } catch {
    return null;
  }
}

export function guardarSesion(datos: DatosSala): void {
  sessionStorage.setItem(KEY, JSON.stringify(datos));
}

export function borrarSesion(): void {
  sessionStorage.removeItem(KEY);
}
