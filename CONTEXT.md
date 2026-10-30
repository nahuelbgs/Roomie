# Roomie — Especificación

## 1. Descripción general

Web para jugar en grupo, pensada para usarse **en persona o por llamada**. La página no gestiona la conversación ni las preguntas entre jugadores: solo arma las salas, reparte la información de cada partida y permite volver a jugar.

La web tendrá varios juegos. En esta primera versión se incluyen dos:

1. **Adiviná tu número**
2. **Adiviná el famoso**

Ambos comparten la misma mecánica base: **cada jugador ve la información de todos los demás, menos la suya**, y tiene que deducirla haciendo preguntas al resto.

---

## 2. Conceptos comunes

### 2.1 Salas

- Un jugador crea una sala eligiendo el juego. Se genera un **código de sala** corto (ej. `K7QX`) y un link para compartir.
- Los demás entran con el código o el link e ingresan su **nombre**.
- El creador de la sala es el **anfitrión**: es quien inicia la partida y quien puede tocar "Volver a jugar".
- Mientras la partida no empieza, todos ven la **lista de jugadores conectados** en tiempo real.
- Mínimo de jugadores para iniciar: **2** (configurable).

### 2.2 Regla principal de visibilidad

> Cada jugador recibe el nombre y el dato (número o famoso) de **todos los demás jugadores**, nunca el suyo.

Esta regla se tiene que aplicar **en el servidor**: el servidor le envía a cada jugador solo los datos de los otros. Nunca se manda la lista completa al navegador para filtrarla ahí, porque cualquiera podría ver su propio dato desde las herramientas del navegador.

### 2.3 Volver a jugar

- Botón **"Volver a jugar"** visible al terminar o durante la partida.
- Al tocarlo se genera una nueva asignación para todos los jugadores que sigan en la sala, sin tener que salir ni volver a entrar.
- Si entraron jugadores nuevos mientras tanto, se suman a la siguiente ronda.

### 2.4 Estados de la sala

| Estado | Descripción |
|---|---|
| `esperando` | Sala creada, los jugadores se van uniendo |
| `en_juego` | Partida iniciada, cada uno ve los datos de los demás |
| `finalizada` | (Opcional) Ronda terminada, se puede volver a jugar |

---

## 3. Juego 1 — Adiviná tu número

### 3.1 Mecánica

1. Los jugadores entran a la sala.
2. El anfitrión inicia la partida.
3. El servidor asigna un **número aleatorio** a cada jugador.
4. Cada jugador ve en pantalla el **nombre y número de los demás**.
5. Mediante preguntas (en persona o por llamada) cada uno intenta adivinar su propio número.
6. Cuando quieran, tocan **"Volver a jugar"** y se reparten números nuevos.

### 3.2 Ejemplo

Sala con 5 jugadores: Ana, Bruno, Caro, Dani y Eli.

Lo que ve **Ana**:

| Jugador | Número |
|---|---|
| Bruno | 42 |
| Caro | 7 |
| Dani | 88 |
| Eli | 15 |

Ana no ve su propio número.

### 3.3 Reglas de asignación

- Rango por defecto: **1 a 100** (configurable por el anfitrión al crear la sala).
- Los números **no se repiten** dentro de una misma ronda.
- El rango tiene que ser mayor o igual a la cantidad de jugadores.

### 3.4 Pantalla de juego

- Título del juego y código de sala.
- Lista de los otros jugadores con su número (tarjetas grandes, fáciles de leer en celular).
- Botón **"Volver a jugar"** (solo habilitado para el anfitrión, o para todos si se decide así).

---

## 4. Juego 2 — Adiviná el famoso

### 4.1 Mecánica

1. Los jugadores entran a la sala.
2. El anfitrión inicia la partida.
3. El servidor elige un **famoso al azar desde la base de datos** para cada jugador.
4. Cada jugador ve el **nombre y el famoso de los demás**.
5. Mediante preguntas (ej. "¿Soy actor?", "¿Estoy vivo?") cada uno intenta adivinar su famoso.
6. Al tocar **"Volver a jugar"** se asignan famosos nuevos.

### 4.2 Ejemplo

Lo que ve **Ana**:

| Jugador | Famoso |
|---|---|
| Bruno | Lionel Messi |
| Caro | Shakira |
| Dani | Albert Einstein |
| Eli | Mirtha Legrand |

### 4.3 Reglas de asignación

- Los famosos **no se repiten** dentro de una misma ronda.
- Idealmente tampoco se repiten entre rondas de la misma sala (se lleva un registro de los ya usados hasta agotar la lista).
- (Opcional) El anfitrión puede elegir una o más **categorías** al crear la sala: deportistas, músicos, actores, personajes históricos, personajes de ficción, argentinos, etc.

### 4.4 Base de datos de famosos

Tabla `famosos`:

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | entero / UUID | Identificador |
| `nombre` | texto | Nombre a mostrar |
| `categoria` | texto | Categoría (deporte, música, cine, etc.) |
| `activo` | booleano | Permite desactivar sin borrar |

Carga inicial mediante un script o un archivo seed (JSON/CSV). A futuro se puede agregar un panel simple para dar de alta famosos.

---

## 5. Modelo de datos

Las salas y partidas pueden vivir **en memoria** del servidor (son efímeras). Solo los famosos necesitan base de datos persistente.

```
Sala
- codigo: string
- juego: "numeros" | "famosos"
- anfitrionId: string
- estado: "esperando" | "en_juego" | "finalizada"
- config: { rangoMin, rangoMax, categorias[] }
- jugadores: Jugador[]
- usados: string[]        // famosos ya asignados en la sala

Jugador
- id: string
- nombre: string
- conectado: boolean
- asignacion: number | string   // número o famoso (solo lo conoce el servidor)
```

---

## 6. Comunicación en tiempo real

Se usa **WebSockets** (ej. Socket.IO) para que todos vean los cambios al instante.

| Evento | Dirección | Descripción |
|---|---|---|
| `crear_sala` | cliente → servidor | Crea la sala con el juego y la config |
| `unirse_sala` | cliente → servidor | Entra con código y nombre |
| `jugadores_actualizados` | servidor → todos | Lista de jugadores en la sala |
| `iniciar_partida` | anfitrión → servidor | Arranca la ronda |
| `partida_iniciada` | servidor → cada jugador | Envía **solo** los datos de los otros jugadores |
| `volver_a_jugar` | anfitrión → servidor | Genera nueva asignación |
| `salir_sala` | cliente → servidor | El jugador abandona la sala |

El evento `partida_iniciada` se envía **individualmente a cada socket**, con un payload distinto para cada jugador.

---

## 7. Stack sugerido

- **Frontend:** React (o Next.js) + Tailwind, pensado mobile-first.
- **Backend:** Node.js + Express + Socket.IO.
- **Base de datos:** SQLite o PostgreSQL para los famosos (Supabase si se quiere algo administrado).
- **Deploy:** Render, Railway o Fly.io (soportan WebSockets). Vercel sirve para el frontend, pero el servidor de sockets conviene tenerlo aparte.

---

## 8. Pantallas

1. **Inicio:** elegir juego → crear sala, o ingresar código para unirse.
2. **Ingreso de nombre.**
3. **Sala de espera:** código, link para compartir, lista de jugadores, botón "Iniciar" (anfitrión).
4. **Partida:** tarjetas con nombre + dato de los demás, botón "Volver a jugar".

---

## 9. Casos borde

- **Nombre repetido:** pedir otro nombre o agregar un sufijo (`Ana (2)`).
- **Jugador se desconecta:** se lo marca como desconectado; si vuelve con el mismo dispositivo (id guardado en `sessionStorage`/cookie) recupera su lugar.
- **El anfitrión se va:** el rol pasa al siguiente jugador conectado.
- **Alguien entra con la partida en curso:** espera a la próxima ronda (o se le asigna un dato y se notifica al resto).
- **Sala vacía:** se elimina después de unos minutos sin jugadores.
- **No alcanzan los famosos de la categoría:** avisar al anfitrión o completar con otras categorías.

---

## 10. Ideas a futuro

- Botón "Me rindo / Revelar" para que cada jugador vea su propio dato.
- Marcar quién ya adivinó.
- Temporizador opcional por ronda.
- Más juegos con la misma mecánica (adiviná el animal, el objeto, la película, etc.).
- Más juegos de grupo con otras mecánicas (impostor, palabras, etc.).
