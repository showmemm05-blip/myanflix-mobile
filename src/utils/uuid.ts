/**
 * A v4 uuid for an idempotency key (the Lottery's purchases). The runtime's
 * own `crypto.randomUUID` when the platform offers one; otherwise sixteen
 * bytes from `crypto.getRandomValues` or, failing that, Math.random — a
 * purchase key only has to be unique per customer, not unguessable, so the
 * app takes no dependency for it (expo-crypto is not installed).
 */
interface MaybeCrypto {
  randomUUID?: () => string;
  getRandomValues?: (array: Uint8Array) => Uint8Array;
}

export function uuidV4(): string {
  const c = (globalThis as { crypto?: MaybeCrypto }).crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  const bytes = new Uint8Array(16);
  if (c && typeof c.getRandomValues === "function") c.getRandomValues(bytes);
  else for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  // Version 4, variant 10xx.
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
