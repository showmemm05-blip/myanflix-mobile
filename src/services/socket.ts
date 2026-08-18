import { io, type Socket } from "socket.io-client";
import { API_BASE_URL } from "@/api/client";

// Socket.IO is attached to the same Nest HTTP server as the REST API, but at
// its origin (no /api path prefix) — strip that suffix off API_BASE_URL.
const SOCKET_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, "");

/**
 * Singleton Socket.IO client shared across the app, mirroring the web app's
 * lib/socket.ts — connected/disconnected reactively by useRealtimeWallet
 * based on auth state; components just call getSocket() and attach/detach
 * their own listeners.
 */
let socket: Socket | null = null;
let socketToken: string | null = null;

export function connectSocket(token: string): Socket {
  if (socket?.connected && socketToken === token) return socket;

  socket?.disconnect();
  socketToken = token;
  socket = io(SOCKET_ORIGIN, {
    auth: { token },
    transports: ["websocket"],
  });
  return socket;
}

export function getSocket(): Socket | null {
  return socket;
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
  socketToken = null;
}
