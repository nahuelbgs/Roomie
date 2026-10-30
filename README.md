# Roomie

Juegos en grupo para jugar en persona o por llamada (video, teléfono). Ver [`CONTEXT.md`](./CONTEXT.md) para la especificación completa del producto.

## Juegos

- **Adiviná tu número** — números 1-100
- **Adiviná el famoso** — ~32 famosos del pool (música, cine, deporte, historia…)
- **Adiviná la plata** — montos "lindos" de $100 a $10.000.000
- **Adiviná la categoría** — ~150 categorías de fútbol

En todos: cada jugador ve el dato de los demás menos el suyo, y lo adivina haciendo preguntas al resto.

## Features

- Salas con código corto (4 chars) + link para compartir
- Realtime vía Socket.IO
- Reconexión por `sessionStorage` (F5 no te echa de la partida)
- Rotación de anfitrión automática
- Cambio de juego sin salir de la sala
- Votaciones (famosos/categoría): cambiar al azar o proponer uno específico, con 50% de votos para aprobar

## Stack

- **client/** — Vite + React + TypeScript + Tailwind + socket.io-client (mobile-first)
- **server/** — Node + Express + Socket.IO + better-sqlite3 (TypeScript)
- Monorepo con npm workspaces.

## Dev local

```bash
npm install
npm run dev
```

- Client: http://localhost:5173
- Server: http://localhost:3001 (Socket.IO + health check en `/health`)

Vite proxyea `/socket.io` al server en desarrollo.

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` | Levanta client y server en paralelo |
| `npm run dev:client` | Solo el client |
| `npm run dev:server` | Solo el server |
| `npm run build` | Build de producción de ambos |
| `npm run start:server` | Server compilado (producción) |

## Deploy

**No podés deployar todo en Vercel.** El server necesita WebSockets persistentes + proceso long-running, cosa que las funciones serverless de Vercel no soportan. Dividí en dos:

### Client → Vercel

- Root directory: `client`
- Build command: `npm install && npm run build`
- Output directory: `dist`
- Env var: `VITE_SOCKET_URL=https://TU-SERVER.onrender.com` (apuntando al server deployado)

### Server → Render / Railway / Fly.io

Para **Render** (free tier funciona para probar; se duerme a los 15min idle):

- Root directory: `server`
- Build command: `npm install && npm run build`
- Start command: `npm run start`
- Env vars:
  - `CLIENT_ORIGIN=https://TU-APP.vercel.app` (para CORS)
  - `PORT` lo setea Render automáticamente
  - `DB_PATH=/opt/render/project/src/data/juegos.sqlite` (o similar; si usás free tier, el disco es efímero y el SQLite se re-seeded en cada boot — fine para este proyecto porque las salas viven en memoria igual)

Si usás tier con disco persistente, cualquier path local sirve.

## Estructura

```
roomie/
├── CONTEXT.md          # Especificación del producto
├── client/             # Frontend (Vite)
│   ├── .env.example
│   └── src/
│       ├── components/ # VoteBanner, ActionSheet
│       ├── screens/    # Inicio, Nombre, SalaEspera, Partida
│       ├── tema.ts     # Colores por juego
│       └── types.ts
└── server/             # Backend (Socket.IO + Express)
    ├── scripts/        # Tests e2e (socket.io-client)
    ├── seed/           # famosos.json, categorias.json
    └── src/
        ├── db.ts
        ├── index.ts
        ├── rooms.ts
        └── types.ts
```
