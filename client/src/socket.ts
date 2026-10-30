import { io, type Socket } from "socket.io-client";

const url = import.meta.env.VITE_SOCKET_URL as string | undefined;

export const socket: Socket = url
  ? io(url, { autoConnect: false, transports: ["websocket"] })
  : io({ autoConnect: false, transports: ["websocket"] });
