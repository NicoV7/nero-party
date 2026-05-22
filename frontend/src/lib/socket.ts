import { io, Socket } from "socket.io-client";

import { API_URL } from "../constants/api";

export const socket: Socket = io(API_URL, {
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
