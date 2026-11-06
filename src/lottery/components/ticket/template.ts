import { TICKET_INK } from "@/lottery/theme/tokens";
import type { LtFace } from "@/lottery/theme/fonts";

/**
 * The Thai-style ticket template — docs/lottery-design-2026-10-13/app/art/thai/
 * template-thai.json as a typed const (SAMPLE template "tpl-thai-style" v1).
 *
 * Units (the JSON's own): x, y, w, h are fractions of the FRAME's width and
 * height; `sizeRel`, `letterSpacingRel` and `strokeRel` are fractions of the
 * frame's WIDTH. A layer is therefore placed at x·W, y·H, w·W, h·H and its
 * text set at sizeRel·W, where W × H is the ticket box (always 1800 : 940),
 * so everything scales with the ticket and nothing is ever cropped or
 * stretched. Change a number here only by changing the JSON first.
 */
export const TICKET_FRAME = { width: 1800, height: 940 } as const;
/** width ÷ height — the ticket box's only allowed aspect ratio. */
export const TICKET_ASPECT = TICKET_FRAME.width / TICKET_FRAME.height;

export interface TicketBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface TicketTextField extends TicketBox {
  /** "myanmar" = Noto Sans Myanmar 700 (the app face), never a Latin face. */
  face: LtFace | "myanmar";
  sizeRel: number;
  letterSpacingRel: number;
  color: string;
  align: "center" | "right";
  /** Six equal cells, one character group per cell (number and its spelled digits share them). */
  cells?: true;
}

export const THAI_TEMPLATE = {
  id: "tpl-thai-style",
  version: 1,
  /** Changes each draw (admin): the picture slot. */
  picture: { x: 0.0356, y: 0.2723, w: 0.3556, h: 0.5191 } satisfies TicketBox,
  fields: {
    /** Each ticket: the six digits, numbering-machine spacing. */
    number: {
      x: 0.5089, y: 0.0617, w: 0.3778, h: 0.1149,
      face: "courier700", sizeRel: 0.08333, letterSpacingRel: 0, color: TICKET_INK.number, align: "center", cells: true,
    },
    /** Each ticket: one three-letter word per digit, under its digit. */
    digitWords: {
      x: 0.5089, y: 0.1766, w: 0.3778, h: 0.0426,
      face: "courier700", sizeRel: 0.02222, letterSpacingRel: 0, color: TICKET_INK.number, align: "center", cells: true,
    },
    /** Each draw: ၂၀၂၆ ခုနှစ် အောက်တိုဘာလ ၃၁ ရက် */
    dateMy: {
      x: 0.5089, y: 0.2255, w: 0.3778, h: 0.0723,
      face: "myanmar", sizeRel: 0.02222, letterSpacingRel: 0, color: TICKET_INK.pink, align: "center",
    },
    /** Each draw: 31 OCTOBER 2026 */
    dateEn: {
      x: 0.5089, y: 0.3, w: 0.3778, h: 0.0468,
      face: "archivo700", sizeRel: 0.02222, letterSpacingRel: 0.00067, color: TICKET_INK.blue, align: "center",
    },
    /** Each draw: the draw number, no padding (24). */
    drawNo: {
      x: 0.5133, y: 0.4426, w: 0.0944, h: 0.0702,
      face: "archivo900", sizeRel: 0.03333, letterSpacingRel: 0, color: TICKET_INK.pink, align: "center",
    },
    /** Each draw: #,##0 (the unit ကျပ် is printed under it in the frame). */
    price: {
      x: 0.0322, y: 0.8021, w: 0.1711, h: 0.0894,
      face: "archivo900", sizeRel: 0.04444, letterSpacingRel: 0, color: TICKET_INK.red, align: "center",
    },
    /** Each ticket: MFL-24-000184, right-aligned. */
    ticketId: {
      x: 0.6389, y: 0.4468, w: 0.2444, h: 0.0574,
      face: "courier700", sizeRel: 0.02556, letterSpacingRel: 0.00111, color: TICKET_INK.orange, align: "right",
    },
    /** Each ticket: the human-readable code under the barcode. */
    barcodeText: {
      x: 0.5089, y: 0.6617, w: 0.3778, h: 0.0468,
      face: "courier700", sizeRel: 0.02, letterSpacingRel: 0.00111, color: TICKET_INK.number, align: "center",
    },
  } satisfies Record<string, TicketTextField>,
  /** Each ticket: the bars fill the field edge to edge (the frame keeps the quiet zone). */
  barcode: { x: 0.5333, y: 0.5319, w: 0.3289, h: 0.1191 } satisfies TicketBox,
  /** Each ticket: a square in pixels (144 × 144 at 1800 wide) on its own white. */
  qr: { x: 0.4044, y: 0.2723, w: 0.08, h: 0.1532 } satisfies TicketBox,
  /**
   * Each draw: the hollow "stamped" draw number over the two dates — the only
   * allowed overlap, so it is drawn LAST.
   */
  overprint: {
    x: 0.5833, y: 0.2553, w: 0.2, h: 0.1404,
    face: "archivo900" as LtFace, sizeRel: 0.09333, letterSpacingRel: 0.00222, strokeRel: 0.00167, opacity: 0.75,
    color: TICKET_INK.stamp,
  },
  /** Bottom to top (template-thai.json `layerOrder`); the frame image sits under all of them. */
  layerOrder: [
    "picture",
    "number",
    "digitWords",
    "dateMy",
    "dateEn",
    "drawNo",
    "price",
    "ticketId",
    "barcode",
    "barcodeText",
    "qr",
    "overprint",
  ],
} as const;
