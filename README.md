# Roomie 🏠✨

> Web interactiva en tiempo real para jugar en grupo (en persona o por llamada). La premisa es simple: **todos ven tu información menos vos, y tenés que adivinarla haciendo preguntas al resto.**

---

## 🎮 Juegos Incluidos

1. **Adiviná tu número:** El servidor asigna un número aleatorio secreto a cada jugador dentro de un rango configurable (por defecto del 1 al 100). Tenés que adivinar el tuyo viendo los números de los demás[cite: 1].
2. **Adiviná el famoso:** El servidor le asigna un personaje célebre al azar a cada participante desde una base de datos. Mediante preguntas (ej. *"¿Soy actor?"*, *"¿Estoy vivo?"*), cada uno intenta deducir quién es[cite: 1].

---

## 🚀 Características Principales

* **Salas en tiempo real:** Creación de salas mediante un código corto único (ej. `K7QX`) y enlace directo para compartir[cite: 1].
* **Seguridad desde el backend:** La regla de visibilidad se procesa estrictamente en el servidor. Cada jugador recibe únicamente los datos de los demás, evitando trampas desde las herramientas de desarrollo del navegador[cite: 1].
* **Dinámica fluida ("Volver a jugar"):** Permite reiniciar la partida y repartir nuevos datos al instante para todos los miembros actuales de la sala sin necesidad de reconectarse[cite: 1].
* **Mobile-First:** Diseñado con tarjetas grandes y claras para usarse cómodamente desde el celular durante juntadas o videollamadas[cite: 1].

---

## 🛠️ Stack Tecnológico

* **Frontend:** React (o Next.js) + Tailwind CSS[cite: 1]
* **Backend:** Node.js + Express + Socket.IO[cite: 1]
* **Base de datos:** SQLite / PostgreSQL (Supabase) para la gestión persistente de los famosos[cite: 1]
* **Hosting sugerido:** Render, Railway o Fly.io (compatibles con WebSockets)[cite: 1]

---

## 📋 Arquitectura y Comunicación

El proyecto utiliza **WebSockets (Socket.IO)** para la sincronización instantánea de eventos entre los clientes y el servidor[cite: 1]:
* `crear_sala` / `unirse_sala`: Gestión de ingreso a la sala de espera[cite: 1].
* `partida_iniciada`: Evento enviado de forma individualizada a cada socket para garantizar que nadie reciba su propio dato[cite: 1].
* `volver_a_jugar`: Reseteo de asignaciones en caliente[cite: 1].

