export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/**
 * The message to SHOW a user. Only an ApiError carries a string written for
 * them (api/client.ts phrases the network and session cases itself, and the
 * server's own body carries the rest); every other throw is a programming or
 * platform failure whose message is English, untranslated and meaningless
 * here — those get the caller's localized fallback. This is the rule the
 * sheets already apply inline; spelling it once keeps the auth flow, which is
 * this helper's only caller, from being the one screen that leaks a raw
 * JavaScript message into its error line.
 */
export function errorMessage(err: unknown, fallback = "Something went wrong"): string {
  return err instanceof ApiError ? err.message : fallback;
}
