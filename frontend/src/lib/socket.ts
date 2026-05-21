import { io, Socket } from "socket.io-client";

import { API_URL } from "./api";

const SOCKET_URL = API_URL;

export const socket: Socket = io(SOCKET_URL, {
  autoConnect: false,
});

export function connectSocket() {
  if (!socket.connected) {
    socket.connect();
  }
}

export function disconnectSocket() {
  if (socket.connected) {
    socket.disconnect();
  }
}
