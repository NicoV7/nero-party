import type { Socket } from "socket.io";
import { AppError, isAppError } from "../exceptions/appError.js";

export function socketError(message: string, code = "SOCKET_ERROR"): AppError {
  return new AppError(message, code);
}

export function emitSocketError(socket: Socket, message: string): void {
  socket.emit("error", { message });
}

export async function runSocketHandler(
  socket: Socket,
  eventName: string,
  fallbackMessage: string,
  handler: () => Promise<void>
): Promise<void> {
  try {
    await handler();
  } catch (error) {
    if (isAppError(error)) {
      emitSocketError(socket, error.message);
      return;
    }

    console.error(`Error in ${eventName}:`, error);
    emitSocketError(socket, fallbackMessage);
  }
}

