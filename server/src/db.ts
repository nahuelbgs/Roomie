import Database from "better-sqlite3";
import { mkdirSync, readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = resolve(process.env.DB_PATH ?? "./data/juegos.sqlite");

mkdirSync(dirname(dbPath), { recursive: true });

export const db = new Database(dbPath);
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS famosos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL UNIQUE,
    categoria TEXT NOT NULL,
    activo INTEGER NOT NULL DEFAULT 1
  );
  CREATE TABLE IF NOT EXISTS categorias_futbol (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    texto TEXT NOT NULL UNIQUE,
    activo INTEGER NOT NULL DEFAULT 1
  );
`);

{
  const seedPath = resolve(__dirname, "../seed/famosos.json");
  if (existsSync(seedPath)) {
    const seed = JSON.parse(readFileSync(seedPath, "utf-8")) as Array<{
      nombre: string;
      categoria: string;
    }>;
    const insert = db.prepare(
      "INSERT OR IGNORE INTO famosos (nombre, categoria) VALUES (?, ?)",
    );
    let agregados = 0;
    const tx = db.transaction((items: typeof seed) => {
      for (const f of items) {
        const r = insert.run(f.nombre, f.categoria);
        if (r.changes > 0) agregados++;
      }
    });
    tx(seed);
    if (agregados > 0) console.log(`[db] seed famosos: ${agregados} nuevos (${seed.length} en archivo)`);
  }
}

{
  const seedPath = resolve(__dirname, "../seed/categorias.json");
  if (existsSync(seedPath)) {
    const seed = JSON.parse(readFileSync(seedPath, "utf-8")) as Array<{ texto: string }>;
    const insert = db.prepare("INSERT OR IGNORE INTO categorias_futbol (texto) VALUES (?)");
    let agregados = 0;
    const tx = db.transaction((items: typeof seed) => {
      for (const c of items) {
        const r = insert.run(c.texto);
        if (r.changes > 0) agregados++;
      }
    });
    tx(seed);
    if (agregados > 0) console.log(`[db] seed categorías: ${agregados} nuevas (${seed.length} en archivo)`);
  }
}

export function categoriasFutbolActivas(): Array<{ texto: string }> {
  return db
    .prepare("SELECT texto FROM categorias_futbol WHERE activo = 1")
    .all() as Array<{ texto: string }>;
}

export function famososActivos(categorias?: string[]): Array<{ nombre: string }> {
  if (categorias && categorias.length > 0) {
    const placeholders = categorias.map(() => "?").join(",");
    return db
      .prepare(
        `SELECT nombre FROM famosos WHERE activo = 1 AND categoria IN (${placeholders})`,
      )
      .all(...categorias) as Array<{ nombre: string }>;
  }
  return db
    .prepare("SELECT nombre FROM famosos WHERE activo = 1")
    .all() as Array<{ nombre: string }>;
}
