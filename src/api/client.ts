import axios, { type AxiosRequestConfig, type AxiosResponse, isAxiosError, isCancel } from "axios";
import { tokenStore, notifyUnauthorized } from "@/services/token-store";
import { ApiError } from "@/utils/errors";

/**
 * "localhost" resolves differently per target — see mobile/.env.example for
 * the iOS Simulator / Android Emulator / physical-device distinction.
 */
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:3001/api";

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

const http = axios.create({ baseURL: API_BASE_URL, headers: platformHeaders });

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
}

// Single-flight refresh: every concurrent 401 awaits the SAME promise instead
// of each firing its own /auth/refresh call. This matters more here than on
// the web — refresh tokens are single-use with rotation server-side, so two
// concurrent refresh attempts would race to consume the same soon-to-be-
// revoked token and one would always fail.
let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = await tokenStore.getRefreshToken();
  if (!refreshToken) return null;

  try {
    const response = await axios.post<Envelope<{ accessToken: string; refreshToken: string }>>(
      `${API_BASE_URL}/auth/refresh`,
      { refreshToken },
      { headers: platformHeaders },
    );
    if (!response.data.success || !response.data.data) return null;

    const { accessToken, refreshToken: nextRefreshToken } = response.data.data;
    if (!accessToken || !nextRefreshToken) return null;

    // Always persist the pair together — the old refresh token is revoked
    // the instant this call succeeds, so never store the new access token
    // without also storing the new refresh token that replaces it.
    await tokenStore.setTokens(accessToken, nextRefreshToken);
    return accessToken;
  } catch {
    return null;
  }
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
      refreshPromise ??= refreshAccessToken().finally(() => {
        refreshPromise = null;
      });
      const newToken = await refreshPromise;

      if (newToken) {
        response = await performRequest<T>(path, options, newToken);
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
      throw new ApiError(body?.message ?? `Request to ${path} failed`, response.status);
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
      throw new ApiError("Unable to reach the server. Check your connection.", 0);
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
  put: <T>(path: string, data?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "PUT", data }),
  patch: <T>(path: string, data?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "PATCH", data }),
  delete: <T>(path: string, options?: RequestOptions) => request<T>(path, { ...options, method: "DELETE" }),
};
