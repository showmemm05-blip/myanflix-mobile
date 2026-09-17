/**
 * Subtitle FILE parsing — the app draws captions itself, so it has to read the
 * cue file itself too.
 *
 * expo-video exposes no cue events of any kind (its player surfaces only
 * `subtitleTrack` / `availableSubtitleTracks`), so there is no way to learn
 * what the native renderer is about to paint. The stream response hands over a
 * signed link to the UPLOADED SOURCE file for every subtitle row, which is the
 * only text we can actually get hold of — this module turns one of those files
 * into cues the overlay can render.
 *
 * Everything here is pure: no React, no network, no time source. The project
 * has no test runner, so "testable" means exactly that — every function takes
 * a string (or an array) and returns a value, and can be exercised from a
 * plain node script if one is ever added.
 */

export interface SubtitleCue {
  /** Seconds from the start of the video, matching expo-video's currentTime. */
  start: number;
  end: number;
  /** Display-ready plain text; may contain newlines the author put there. */
  text: string;
}

/** WebVTT inline markup — `<i>`, `<c.yellow>`, `<00:00:01.000>`, `<v Bob>`. */
const MARKUP = /<[^>]+>/g;
/** ASS/SSA style overrides: `{\an8}`, `{\i1}`, `{\pos(320,400)}`. */
const ASS_OVERRIDE = /\{\\[^}]*\}/g;
/** Spaces and tabs but NOT newlines — a cue's own line breaks are meaningful. */
const HORIZONTAL_WHITESPACE = /[^\S\n]+/g;

const ENTITY: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
};

/**
 * The browser's own WebVTT parser decodes these before the website ever sees
 * `cue.text`, so decoding here is what keeps the two clients showing the same
 * sentence rather than a stray `&amp;`.
 */
function decodeEntities(text: string): string {
  return text.replace(/&(?:amp|lt|gt|quot|apos|nbsp|#39);/g, (match) => ENTITY[match] ?? match);
}

/**
 * Raw cue payload → what the overlay paints, mirroring the website's
 * `activeCueLines`: markup is STRIPPED, never rendered, because the overlay
 * draws one flat string.
 *
 * The whitespace pass has no counterpart on the web because CSS
 * `white-space: pre-line` does it in the renderer — runs of spaces collapse to
 * one and leading/trailing spaces on a line disappear. React Native has no
 * such mode, so the same collapsing happens here instead.
 */
function cleanCueText(raw: string, isAss: boolean): string {
  let text = raw.replace(/\r\n?/g, "\n");
  if (isAss) {
    // ASS carries its own escapes: `\N` is a hard break, `\n` a soft one
    // (identical outside a wrapped box), `\h` a non-breaking space.
    text = text.replace(ASS_OVERRIDE, "").replace(/\\[Nn]/g, "\n").replace(/\\h/g, " ");
  }
  text = decodeEntities(text.replace(MARKUP, ""));
  return text
    .split("\n")
    .map((line) => line.replace(HORIZONTAL_WHITESPACE, " ").trim())
    .join("\n")
    .trim();
}

/**
 * `(HH:)?MM:SS[.,]mmm` for SRT/VTT and `H:MM:SS.cc` for ASS in one reader: the
 * fraction is parsed as a decimal rather than as milliseconds, so ASS's
 * two-digit centiseconds and VTT's three-digit milliseconds both land on the
 * right number of seconds without a separate branch.
 *
 * The fraction is OPTIONAL and its separator is only `.` or `,`. Whole-second
 * stamps (`00:00:01 --> 00:00:04`) are written by several conversion tools and
 * every desktop player accepts them; rejecting them would drop the whole cue.
 * A colon must NOT be read as the fraction separator — `00:00:01` would then
 * parse as MM:SS:ff, putting a cue at 1 minute instead of 1 second.
 */
function parseTimestamp(value: string): number | null {
  const match = value.trim().match(/^(?:(\d+):)?(\d{1,2}):(\d{2})(?:[.,](\d{1,3}))?/);
  if (!match) return null;
  const hours = match[1] ? Number(match[1]) : 0;
  const fraction = match[4] ? Number(`0.${match[4]}`) : 0;
  return hours * 3600 + Number(match[2]) * 60 + Number(match[3]) + fraction;
}

/** The `[Events]` column order every ASS file declares; used if `Format:` is missing. */
const ASS_EVENT_FIELDS = [
  "layer",
  "start",
  "end",
  "style",
  "name",
  "marginl",
  "marginr",
  "marginv",
  "effect",
  "text",
];

/**
 * Splits a `Dialogue:` row into exactly `count` fields. A plain `split(",")`
 * cannot be used: the final Text field routinely contains commas, and it must
 * keep every one of them.
 */
function splitEventFields(value: string, count: number): string[] {
  const fields: string[] = [];
  let rest = value;
  for (let i = 0; i < count - 1; i += 1) {
    const comma = rest.indexOf(",");
    if (comma === -1) break;
    fields.push(rest.slice(0, comma));
    rest = rest.slice(comma + 1);
  }
  fields.push(rest);
  return fields;
}

/**
 * ASS/SSA: only the `[Events]` section's `Dialogue:` rows carry timed text.
 * Styles, positioning, karaoke and drawing commands are deliberately ignored —
 * the overlay is one centred text block, the same as the website's, so an ASS
 * file renders as its dialogue and nothing else.
 */
function parseAssCues(source: string): SubtitleCue[] {
  const cues: SubtitleCue[] = [];
  let inEvents = false;
  let fields = ASS_EVENT_FIELDS;

  for (const rawLine of source.split("\n")) {
    const line = rawLine.trim();
    if (line.startsWith("[")) {
      inEvents = /^\[events\]$/i.test(line);
      continue;
    }
    if (!inEvents || !line) continue;

    const colon = line.indexOf(":");
    if (colon === -1) continue;
    const descriptor = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1);

    if (descriptor === "format") {
      fields = value.split(",").map((field) => field.trim().toLowerCase());
      continue;
    }
    if (descriptor !== "dialogue") continue;

    const values = splitEventFields(value, fields.length);
    const start = parseTimestamp(values[fields.indexOf("start")] ?? "");
    const end = parseTimestamp(values[fields.indexOf("end")] ?? "");
    const text = cleanCueText(values[fields.indexOf("text")] ?? "", true);
    if (start === null || end === null || end <= start || !text) continue;
    cues.push({ start, end, text });
  }

  return cues;
}

/** Blocks that are metadata rather than a cue, even when one contains "-->". */
const VTT_KEYWORD = /^(?:WEBVTT|NOTE|STYLE|REGION)\b/;

/**
 * SRT and WebVTT share one shape — blank-line-separated blocks whose first
 * `-->` line carries the timings — so one reader covers both. Whatever sits
 * before that line (an SRT index, a VTT cue identifier) is dropped; everything
 * after it is the cue text.
 */
function parseBlockCues(source: string): SubtitleCue[] {
  const cues: SubtitleCue[] = [];

  // A "blank" separator line often carries a stray space or tab — a routine
  // artefact of editors and format converters. Splitting on `\n{2,}` alone
  // would treat such a file as ONE block, so only its first cue would survive.
  for (const block of source.split(/\n[ \t]*(?:\n[ \t]*)+/)) {
    const lines = block.split("\n");
    if (VTT_KEYWORD.test(lines[0]?.trim() ?? "")) continue;

    const arrowIndex = lines.findIndex((line) => line.includes("-->"));
    if (arrowIndex === -1) continue;

    const timing = lines[arrowIndex] as string;
    const arrow = timing.indexOf("-->");
    const start = parseTimestamp(timing.slice(0, arrow));
    // Cue settings ride the same line after the end stamp ("line:90% align:middle");
    // parseTimestamp reads the prefix and ignores the rest.
    const end = parseTimestamp(timing.slice(arrow + 3));
    const text = cleanCueText(lines.slice(arrowIndex + 1).join("\n"), false);
    if (start === null || end === null || end <= start || !text) continue;
    cues.push({ start, end, text });
  }

  return cues;
}

/**
 * Parses whichever of the three formats the backend stored (SRT, VTT, ASS).
 *
 * The format is sniffed from the content rather than taken from the row's
 * `format` column: the column records what the uploader's file was CALLED, and
 * a mislabelled file that still parses is better than a blank caption track.
 *
 * Cues come back sorted by start time, so `cueLinesAt` can trust the order.
 */
export function parseSubtitleCues(source: string): SubtitleCue[] {
  const normalised = source.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const isAss = /^\s*\[script info\]/i.test(normalised) || /^\s*dialogue\s*:/im.test(normalised);
  const cues = isAss ? parseAssCues(normalised) : parseBlockCues(normalised);
  return cues.sort((a, b) => a.start - b.start);
}

/**
 * The cues showing at `seconds`, one entry per cue — the same array shape the
 * website builds from `track.activeCues`, so simultaneous cues stack as
 * separate lines instead of running together.
 */
export function cueLinesAt(cues: SubtitleCue[], seconds: number): string[] {
  const active: string[] = [];
  for (const cue of cues) {
    // Sorted by start, so once a cue begins after now, nothing later can be active.
    if (cue.start > seconds) break;
    if (seconds < cue.end) active.push(cue.text);
  }
  return active;
}
