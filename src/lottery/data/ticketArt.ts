/**
 * SAMPLE — design only, no API.
 *
 * The ticket's barcode and QR STAND-INS (spec/thai-ticket-recipe.md §4,
 * verbatim in TypeScript). They look like Code 128 and a QR code and are NOT
 * scannable: the real build uses a real Code 128 encoder and a real QR, which
 * is a decision for when tickets exist. Pure and deterministic — the same
 * ticket always draws the same bars — and cached per ticket, because a
 * ticket list re-renders far more often than its tickets change.
 */
import { pad, ymd } from "@/lottery/data/format";

const C128 = (
  "212222 222122 222221 121223 121322 131222 122213 122312 132212 221213 221312 231212 112232 122132 122231 113222 " +
  "123122 123221 223211 221132 221231 213212 223112 312131 311222 321122 321221 312212 322112 322211 212123 212321 " +
  "232121 111323 131123 131321 112313 132113 132311 211313 231113 231311 112133 112331 132131 113123 113321 133121"
).split(" ");

/**
 * The human-readable line under the barcode: YYMMDD of the draw + the draw
 * number (2 digits) + the six-digit number + "-" + the ticket's 6-digit
 * sequence → "26103124372694-000184".
 */
export function barcodeCode(drawNo: number, drawIso: string, ticketId: string, number: string): string {
  const [y, m, d] = ymd(drawIso);
  const sequence = ticketId.split("-").pop() ?? "";
  return `${String(y).slice(2)}${pad(m, 2)}${pad(d, 2)}${pad(drawNo, 2)}${number}-${sequence}`;
}

/** One SVG path of bars for viewBox `0 0 {width} 40`. */
export function barcodePath(code: string): { d: string; width: number } {
  const seq = ["211214"];
  let sum = 104;
  for (let i = 0; i < code.length; i++) {
    const v = code.charCodeAt(i) - 32;
    seq.push(C128[(v * 7 + i * 3) % 48]);
    sum += v * (i + 1);
  }
  seq.push(C128[sum % 48]);
  seq.push("2331112");
  const widths = seq.join("").split("").map(Number);
  let x = 0;
  let d = "";
  for (let i = 0; i < widths.length; i++) {
    if (i % 2 === 0) d += `M${x} 0h${widths[i]}v40h-${widths[i]}z`;
    x += widths[i];
  }
  return { d, width: x };
}

/**
 * QR stand-in: 25 × 25 modules seeded by the ticket ID, three finder squares,
 * timing lines and one alignment square, with a 2-module quiet zone → one
 * path for viewBox `0 0 29 29`.
 */
export function qrPath(id: string): string {
  const n = 25;
  let s = 2166136261;
  for (let i = 0; i < id.length; i++) s = Math.imul(s ^ id.charCodeAt(i), 16777619);
  s >>>= 0;
  const rnd = () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const m: number[][] = [];
  const fixed: boolean[][] = [];
  for (let r = 0; r < n; r++) {
    m.push(new Array<number>(n).fill(0));
    fixed.push(new Array<boolean>(n).fill(false));
  }
  const finder = (r0: number, c0: number) => {
    for (let a = -1; a <= 7; a++) {
      for (let b = -1; b <= 7; b++) {
        const rr = r0 + a;
        const cc = c0 + b;
        if (rr < 0 || cc < 0 || rr >= n || cc >= n) continue;
        const ring = a === 0 || a === 6 || b === 0 || b === 6;
        const core = a >= 2 && a <= 4 && b >= 2 && b <= 4;
        m[rr][cc] = a >= 0 && a <= 6 && b >= 0 && b <= 6 && (ring || core) ? 1 : 0;
        fixed[rr][cc] = true;
      }
    }
  };
  finder(0, 0);
  finder(0, n - 7);
  finder(n - 7, 0);
  for (let i = 8; i < n - 8; i++) {
    m[6][i] = m[i][6] = i % 2 ? 0 : 1;
    fixed[6][i] = fixed[i][6] = true;
  }
  for (let r = -2; r <= 2; r++) {
    for (let c = -2; c <= 2; c++) {
      m[18 + r][18 + c] = Math.max(Math.abs(r), Math.abs(c)) === 1 ? 0 : 1;
      fixed[18 + r][18 + c] = true;
    }
  }
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) if (!fixed[r][c]) m[r][c] = rnd() < 0.48 ? 1 : 0;
  }
  let d = "";
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) if (m[r][c]) d += `M${c + 2} ${r + 2}h1v1h-1z`;
  }
  return d;
}

export interface TicketArt {
  code: string;
  bars: { d: string; width: number };
  qr: string;
}

/** Worked out once per ticket (keyed by its code, which carries the draw, number and sequence). */
const cache = new Map<string, TicketArt>();

export function ticketArt(drawNo: number, drawIso: string, ticketId: string, number: string): TicketArt {
  const code = barcodeCode(drawNo, drawIso, ticketId, number);
  let art = cache.get(code);
  if (!art) {
    art = { code, bars: barcodePath(code), qr: qrPath(ticketId) };
    cache.set(code, art);
  }
  return art;
}
