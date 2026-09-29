import { io, type Socket } from "socket.io-client";
import { API_BASE_URL, CLIENT_PLATFORM, refreshSession } from "@/api/client";
import type { RefreshOutcome } from "@/api/refreshOutcome";
import { notifyUnauthorized, tokenStore } from "@/services/token-store";

// Socket.IO is attached to the same Nest HTTP server as the REST API, but at
// its origin (no /api path prefix) — strip that suffix off API_BASE_URL.
const SOCKET_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, "");

/**
 * Singleton Socket.IO client shared across the app, mirroring the web app's
 * lib/socket.ts — connected/disconnected reactively by useRealtimeWallet
 * based on auth state; components attach/detach
 * their own listeners.
 */
let socket: Socket | null = null;
let socketToken: string | null = null;

/**
 * Recovery state for a socket the server closed (see `attachRecoveryHandlers`).
 * Two flags, so that no way out of a recovery can leave realtime dead:
 *
 * - `refreshing`: a refresh is in flight. Cleared on every way out of it.
 * - `unsettled`: the last recovery reconnected, but that connection has not
 *   yet stayed up for RECOVERY_SETTLE_MS. A server close inside that window
 *   means the fresh token was refused too, so the next try waits for the
 *   backoff timer (`scheduleRetry`) instead of refreshing at once: a refused
 *   retry cannot spin into a refresh/reconnect loop, yet the timer always
 *   tries again. Cleared once a connection has stayed up for that moment.
 */
let refreshing = false;
let unsettled = false;
let settleTimer: ReturnType<typeof setTimeout> | null = null;
/** A later try after a refresh that got no answer, or an unsettled recovery — see `scheduleRetry`. */
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let retryDelayMs = 0;

const RECOVERY_SETTLE_MS = 5_000;
const RETRY_FIRST_MS = 15_000;
const RETRY_MAX_MS = 5 * 60_000;

function clearTimers(): void {
  if (settleTimer) clearTimeout(settleTimer);
  if (retryTimer) clearTimeout(retryTimer);
  settleTimer = null;
  retryTimer = null;
}

/**
 * The refresh got no answer (offline, timeout, a 5xx mid-deploy), which says
 * nothing about the session — nothing is cleared. Unlike the website, no
 * token change re-handshakes this socket later (a REST refresh only writes
 * tokenStore), and socket.io itself never reconnects after a server-side
 * close, so try again on a timer: 15 s, doubling up to 5 minutes. A recovery
 * the server closed again before it settled waits on the same timer.
 */
function scheduleRetry(instance: Socket): void {
  retryDelayMs = retryDelayMs ? Math.min(retryDelayMs * 2, RETRY_MAX_MS) : RETRY_FIRST_MS;
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = setTimeout(() => {
    retryTimer = null;
    if (socket === instance && !instance.connected) void recoverFromServerDisconnect(instance);
  }, retryDelayMs);
}

async function recoverFromServerDisconnect(instance: Socket): Promise<void> {
  if (refreshing) return;
  refreshing = true;

  // Goes through api/client.ts's single-flight refresh, so this and a 401'd
  // REST call racing each other still spend the refresh token only once.
  let outcome: RefreshOutcome;
  try {
    outcome = await refreshSession();
  } catch {
    // SecureStore could not read the refresh token — no verdict either.
    outcome = { kind: "unreachable" };
  }

  // Torn down (logout) or replaced while we waited: nothing left to recover.
  // disconnectSocket() already reset the flags, and a newer socket may own
  // them by now, so leave them alone.
  if (socket !== instance) return;
  refreshing = false;

  if (outcome.kind === "unreachable") {
    scheduleRetry(instance);
    return;
  }

  if (outcome.kind === "rejected") {
    // The server REFUSED the refresh token: the session is over, exactly as
    // when a REST call's refresh is refused. Signing out flips
    // isAuthenticated, and useRealtimeWallet then tears this socket down.
    await tokenStore.clear().catch(() => {});
    notifyUnauthorized();
    return;
  }

  // Re-handshake the SAME instance: useRealtimeWallet attached its listeners
  // to this object, and a new one would silently orphan them.
  socketToken = outcome.accessToken;
  instance.auth = { token: outcome.accessToken, platform: CLIENT_PLATFORM };
  unsettled = true;
  instance.connect();
}

function attachRecoveryHandlers(instance: Socket): void {
  instance.on("connect", () => {
    if (settleTimer) clearTimeout(settleTimer);
    settleTimer = setTimeout(() => {
      settleTimer = null;
      unsettled = false;
      retryDelayMs = 0;
    }, RECOVERY_SETTLE_MS);
  });

  // The gateway verifies the JWT in handleConnection and, on failure, calls
  // client.disconnect(true) — and it closes every socket of an account when
  // its sessions are revoked (password change or reset, suspension, role
  // change, account closed). The client sees disconnect("io server
  // disconnect"), after which socket.io will NOT reconnect on its own. The
  // access token it held is the likely cause (expired, or revoked with the
  // sessions), so: refresh once, reconnect once.
  instance.on("disconnect", (reason) => {
    if (settleTimer) {
      clearTimeout(settleTimer);
      settleTimer = null;
    }
    if (reason !== "io server disconnect") return;
    // Closed again before the last recovery settled: the new token did not
    // help either (e.g. the gateway fails every handshake during a DB blip
    // mid-deploy). Wait for the backoff timer rather than trying at once.
    if (unsettled) {
      scheduleRetry(instance);
      return;
    }
    void recoverFromServerDisconnect(instance);
  });
}

export function connectSocket(token: string): Socket {
  if (socket?.connected && socketToken === token) return socket;

  disconnectSocket();
  socketToken = token;
  socket = io(SOCKET_ORIGIN, {
    // `platform` is the socket-side twin of the X-Client-Platform header the
    // REST client sends: the gateway records presence per platform, and a
    // handshake without it would land in the admin's live list as UNKNOWN.
    auth: { token, platform: CLIENT_PLATFORM },
    transports: ["websocket"],
  });
  attachRecoveryHandlers(socket);
  return socket;
}


export function disconnectSocket(): void {
  clearTimers();
  refreshing = false;
  unsettled = false;
  retryDelayMs = 0;
  socket?.disconnect();
  socket = null;
  socketToken = null;
}
