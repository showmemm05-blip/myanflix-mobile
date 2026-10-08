import axios, { type AxiosRequestConfig, type AxiosResponse, isAxiosError, isCancel } from "axios";
import { tokenStore, notifyUnauthorized } from "@/services/token-store";
import { ApiError, type ApiErrorDetails } from "@/utils/errors";
import { classifyRefreshBody, classifyRefreshFailure, type RefreshOutcome } from "@/api/refreshOutcome";

/**
 * "localhost" resolves differently per target — see mobile/.env.example for
 * the iOS Simulator / Android Emulator / physical-device distinction.
 *
 * The localhost fallback is for DEVELOPMENT only (Expo Go / Metro). A release
 * build gets its address from its eas.json profile; one built without it
 * would silently talk to "localhost" on the user's own phone and every call
 * would fail, so it refuses to start instead (audit H-13). Keep the
 * `process.env.EXPO_PUBLIC_…` spelling exactly: Expo inlines only that form.
 */
const CONFIGURED_API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;
if (!CONFIGURED_API_BASE_URL && !__DEV__) {
  throw new Error(
    "EXPO_PUBLIC_API_BASE_URL is not set for this build. Set it in the build profile in mobile/eas.json.",
  );
}
export const API_BASE_URL = CONFIGURED_API_BASE_URL ?? "http://localhost:3001/api";

/**
 * Which client this is, in the backend's `ClientPlatform` vocabulary
 * (WEB | MOBILE | UNKNOWN).
 *
 * The server attributes comments, feedback, searches, watch time and sessions
 * to a platform, and a user-agent sniff cannot reliably tell an Expo app from
 * a browser — so every request says so outright. The socket handshake sends
 * the same value under `auth.platform` (see services/socket.ts); anything that
 * omits both is recorded as UNKNOWN rather than guessed at.
 */
export const CLIENT_PLATFORM = "MOBILE";

/**
 * Attached to the axios instance's defaults, so it rides on EVERY call made
 * through `apiClient` without each api module remembering it. The one request
 * that does not go through this instance — the refresh below, which must not
 * recurse through the 401 handler — sets it explicitly.
 */
const platformHeaders = { "X-Client-Platform": CLIENT_PLATFORM } as const;

/**
 * Axios defaults `timeout` to 0 — wait forever — and React Native's XHR
 * imposes none either, so without this a server that accepts the socket and
 * never answers pins that promise for the life of the process. That is a
 * permanent splash screen at boot: bootstrapAuth awaits GET /users/me before
 * finishBootstrapping(), and App.tsx paints nothing until isBootstrapping is
 * false. React Query's retry policy cannot rescue it either — a retry never
 * fires for a request that never settles.
 *
 * No new error handling is needed: a timeout surfaces as an AxiosError with
 * no `response`, which the catch in `request` below already turns into the
 * "Unable to reach the server" ApiError. Cancelled requests are checked
 * first, so aborted searches are unaffected.
 */
const REQUEST_TIMEOUT_MS = 15_000;

/** Uploads move real bytes over a phone connection and need a longer leash. */
const UPLOAD_TIMEOUT_MS = 60_000;

const http = axios.create({
  baseURL: API_BASE_URL,
  headers: platformHeaders,
  timeout: REQUEST_TIMEOUT_MS,
});

/**
 * Everything axios accepts except the bits this module owns. `performRequest`
 * spreads the whole thing into `http.request`, so a caller-supplied `signal`
 * reaches axios untouched — that is how React Query aborts a superseded search
 * (see `types/api.ts#RequestSignalOptions`).
 */
interface RequestOptions extends Omit<AxiosRequestConfig, "url" | "method"> {
  /** Skip attaching the access token / triggering refresh-on-401 (the four auth endpoints). */
  skipAuth?: boolean;
}

interface Envelope<T> {
  success: boolean;
  data?: T;
  message?: string;
  /** A coded refusal's stable code (see utils/errors.ts ApiErrorDetails). */
  code?: unknown;
  triesLeft?: unknown;
  lockedUntil?: unknown;
}

/**
 * The coded-error fields of an error body, kept only when they have the
 * shape the contract promises — the body is the server's, so nothing in it
 * is trusted to be the right type.
 */
function errorDetails(body: Envelope<unknown> | undefined): ApiErrorDetails {
  if (!body) return {};
  return {
    code: typeof body.code === "string" ? body.code : undefined,
    triesLeft: typeof body.triesLeft === "number" && Number.isFinite(body.triesLeft) ? body.triesLeft : undefined,
    lockedUntil: typeof body.lockedUntil === "string" ? body.lockedUntil : undefined,
  };
}

// Single-flight refresh: every concurrent 401 awaits the SAME promise instead
// of each firing its own /auth/refresh call. This matters more here than on
// the web — refresh tokens are single-use with rotation server-side, so two
// concurrent refresh attempts would race to consume the same soon-to-be-
// revoked token and one would always fail.
let refreshPromise: Promise<RefreshOutcome> | null = null;

/**
 * The one way into /auth/refresh, shared by the 401 path in `request` below
 * and by services/socket.ts when the gateway closes the socket — so a closed
 * socket and a 401'd request racing each other still spend the refresh token
 * once. A "refreshed" outcome has already been written to tokenStore.
 */
export function refreshSession(): Promise<RefreshOutcome> {
  refreshPromise ??= refreshAccessToken().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

/** The one message for "the request could not get an answer" — see `request`. */
const UNREACHABLE_MESSAGE = "Unable to reach the server. Check your connection.";

/**
 * Tells "the server refused the refresh token" apart from "the refresh could
 * not get an answer" (see api/refreshOutcome.ts). Only the first may end the
 * session; the second keeps both tokens so the next attempt can still succeed.
 */
async function refreshAccessToken(): Promise<RefreshOutcome> {
  const refreshToken = await tokenStore.getRefreshToken();
  // Nothing to refresh with: the session is gone, not unreachable.
  if (!refreshToken) return { kind: "rejected" };

  let outcome: RefreshOutcome;
  try {
    const response = await axios.post<Envelope<{ accessToken: string; refreshToken: string }>>(
      `${API_BASE_URL}/auth/refresh`,
      { refreshToken },
      // The timeout has to be repeated here. This call deliberately uses the
      // bare `axios` rather than `http` so a 401 on the refresh itself cannot
      // recurse back through the interceptor — but bypassing the instance also
      // bypasses its timeout, and axios then waits forever. This path runs at
      // BOOT (bootstrapAuth → getProfile → 401 → refresh), so without it a
      // dead network here is the very hang the instance timeout was added to
      // end, just one call further along.
      { headers: platformHeaders, timeout: REQUEST_TIMEOUT_MS },
    );
    outcome = classifyRefreshBody(response.data);
  } catch (err) {
    // Bare axios throws on every non-2xx: `err.response` is there when the
    // server answered (400/401/403 = rejected, 5xx/429 = keep trying), absent
    // when nothing came back at all (timeout, no network, DNS).
    outcome = classifyRefreshFailure(isAxiosError(err) ? (err.response?.status ?? null) : null);
  }

  if (outcome.kind === "refreshed") {
    // Always persist the pair together — the old refresh token is revoked
    // the instant this call succeeds, so never store the new access token
    // without also storing the new refresh token that replaces it. A failed
    // keystore write still leaves the new access token in memory
    // (token-store caches it first), so this run keeps working.
    await tokenStore.setTokens(outcome.accessToken, outcome.refreshToken).catch(() => {});
  }
  return outcome;
}

async function performRequest<T>(
  path: string,
  options: RequestOptions & Pick<AxiosRequestConfig, "method">,
  accessToken: string | null,
): Promise<AxiosResponse<Envelope<T>>> {
  const { skipAuth: _skipAuth, headers, ...rest } = options;
  return http.request<Envelope<T>>({
    url: path,
    ...rest,
    headers: {
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...headers,
    },
    // Handle the {success:false} envelope ourselves instead of letting axios
    // throw on 4xx/5xx — we need the body even on error responses.
    validateStatus: () => true,
  });
}

async function request<T>(
  path: string,
  options: RequestOptions & Pick<AxiosRequestConfig, "method"> = {},
): Promise<T> {
  try {
    const token = options.skipAuth ? null : await tokenStore.getAccessToken();
    let response = await performRequest<T>(path, options, token);

    if (response.status === 401 && !options.skipAuth) {
      const outcome = await refreshSession();

      if (outcome.kind === "refreshed") {
        response = await performRequest<T>(path, options, outcome.accessToken);
      } else if (outcome.kind === "unreachable") {
        // H-20: a refresh that got no answer (or a 5xx) says nothing about the
        // session. Keep the tokens, fail THIS request as offline (status 0,
        // which React Query retries), and let a later request refresh again.
        throw new ApiError(UNREACHABLE_MESSAGE, 0);
      } else {
        await tokenStore.clear();
        notifyUnauthorized();
        throw new ApiError("Your session has expired. Please log in again.", 401);
      }
    }

    // A 204 (e.g. mark-all-read) has no envelope to unwrap — some servers
    // omit the body entirely for this status, so don't try to parse one.
    if (response.status === 204) {
      return undefined as T;
    }

    const body = response.data;
    if (!body || body.success === false || body.data === undefined) {
      throw new ApiError(body?.message ?? `Request to ${path} failed`, response.status, errorDetails(body));
    }
    return body.data;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    // An aborted request is not a failure — React Query cancels the signal of a
    // superseded search before its response lands. A CanceledError is also
    // response-less, so this MUST come before the network-error branch below,
    // or every cancelled keystroke would surface as "check your connection".
    // Rethrown as-is so `axios.isCancel` still recognises it upstream.
    if (isCancel(err)) throw err;
    if (isAxiosError(err) && !err.response) {
      throw new ApiError(UNREACHABLE_MESSAGE, 0);
    }
    throw err;
  }
}

/**
 * Canonical wire format for catalog queries: array params travel as CSV
 * ("genres=Action,Drama"), never as axios's repeated/bracketed forms — the
 * backend accepts all three, but every client speaks CSV so deep links,
 * logs and caches agree on one spelling. Empty arrays and undefined values
 * are dropped entirely instead of sending "genres=".
 */
export function csvParams(query: object): Record<string, string | number | boolean> {
  const params: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      if (value.length === 0) continue;
      params[key] = value.map(String).join(",");
    } else {
      params[key] = value as string | number | boolean;
    }
  }
  return params;
}

export const apiClient = {
  get: <T>(path: string, options?: RequestOptions) => request<T>(path, { ...options, method: "GET" }),
  post: <T>(path: string, data?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "POST", data }),
  /**
   * File upload. Goes through the same `request` as everything else, so it
   * inherits the token, the single-flight refresh-on-401 and the envelope; the
   * retry after a refresh re-sends the SAME FormData, which is safe because
   * React Native's FormData holds `{uri,name,type}` descriptors rather than a
   * consumed stream.
   *
   * Content-Type is deliberately NOT set here and must not be added: axios
   * leaves a FormData body alone, so React Native's XHR writes
   * `multipart/form-data` WITH its boundary. Setting it by hand omits the
   * boundary, the server then parses zero parts, and the upload fails as "no
   * file received" — which looks nothing like a header problem.
   */
  postMultipart: <T>(path: string, form: FormData, options?: RequestOptions) =>
    // The longer timeout goes FIRST so a caller can still override it; the
    // instance-wide 15 s is too short for an image leaving a phone.
    request<T>(path, { timeout: UPLOAD_TIMEOUT_MS, ...options, method: "POST", data: form }),
  put: <T>(path: string, data?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "PUT", data }),
  patch: <T>(path: string, data?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "PATCH", data }),
  delete: <T>(path: string, options?: RequestOptions) => request<T>(path, { ...options, method: "DELETE" }),
};
