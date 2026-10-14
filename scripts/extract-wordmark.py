#!/usr/bin/env python3
"""
Generates the MyanFlix wordmark/mark sources from the app's own typeface.

    WHAT IT WRITES (all three are generated files — never edit them by hand)
    - src/components/splash/wordmarkPaths.ts  the 8 letters of "MyanFlix" as
                                              SVG path data + metrics (TS data)
    - assets/brand/wordmark.svg               the whole word, as paths
    - assets/brand/mark.svg                   the app mark: crimson bar + "M"
                                              on a 1024 x 1024 canvas (the icon)

    WHY: the animated splash draws the wordmark with react-native-svg <Path>s
    instead of <Text>, so it never waits for expo-font and never flashes a
    fallback face. The icon's "M" is the very same outline.

    SOURCE FONT: Noto Sans Myanmar Black (900) — the face `theme.font.black`
    names — read from the package the app already ships:
        node_modules/@expo-google-fonts/noto-sans-myanmar/900Black/NotoSansMyanmar_900Black.ttf

    HOW TO RUN (from mobile/; needs fontTools — a throwaway venv is enough):
        python3 -m venv /tmp/wordmark-venv && /tmp/wordmark-venv/bin/pip install fonttools
        /tmp/wordmark-venv/bin/python scripts/extract-wordmark.py
    then `node scripts/brand-assets.mjs` to re-render the PNGs.

    GEOMETRY: outlines are in font units (1000/em) flipped into SVG space
    (y grows DOWN, the baseline is y = 0, ink above it is negative). Letters
    are placed by their advance widths plus GPOS pair kerning (the `kern`
    feature the font registers for the `latn` script). For "MyanFlix" every
    pair kerns 0, so the offsets are plain cumulative advances — the script
    still reads the table so a font update is picked up.
"""

from __future__ import annotations

import os
import sys
from dataclasses import dataclass

from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

MOBILE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONT_PATH = os.path.join(
    MOBILE_DIR,
    "node_modules/@expo-google-fonts/noto-sans-myanmar/900Black/NotoSansMyanmar_900Black.ttf",
)
FONT_PATH_SHORT = "node_modules/@expo-google-fonts/noto-sans-myanmar/900Black/NotoSansMyanmar_900Black.ttf"
TS_OUT = os.path.join(MOBILE_DIR, "src/components/splash/wordmarkPaths.ts")
WORDMARK_SVG_OUT = os.path.join(MOBILE_DIR, "assets/brand/wordmark.svg")
MARK_SVG_OUT = os.path.join(MOBILE_DIR, "assets/brand/mark.svg")

WORD = "MyanFlix"
CRIMSON = "#E0181F"
WHITE = "#FFFFFF"

# ---- the mark (icon) composition, in a 1024 x 1024 canvas -------------------
# The app bar's bar is 6 x 24 pt with radius 2 (components/layout/AppTopBar).
# Same proportions here: width = 9% of the canvas, height = 4 x width,
# radius = width / 3. The M is set at an em of 47% of the canvas; the gap from
# the bar's right edge to the M's ink is 7%. The pair is centred by its INK box.
ICON = 1024
BAR_W = round(ICON * 0.09)  # 92
BAR_H = BAR_W * 4  # 368
BAR_RX = round(BAR_W / 3)  # 31
M_EM = round(ICON * 0.47)  # 481
GAP = round(ICON * 0.07)  # 72


class ExplicitSVGPathPen(SVGPathPen):
    """
    fontTools' pen leaves the first line after a move-to implicit ("M1 2 3 4").
    That is valid SVG, but react-native-svg parses paths in native code, so the
    data spells every line-to out ("M1 2L3 4") rather than lean on that rule.
    """

    def _lineTo(self, pt):
        if self._lastCommand == "M":
            self._lastCommand = None
        super()._lineTo(pt)


@dataclass(frozen=True)
class Letter:
    char: str
    glyph: str
    d: str
    advance: int
    kern: int  # kerning applied BEFORE this letter (0 for the first)
    x: int  # pen position of this letter's origin
    x_min: int
    y_min: int  # SVG space (negative = above the baseline)
    x_max: int
    y_max: int


def pair_kerning(font: TTFont, first: str, second: str) -> int:
    """
    XAdvance adjustment the font's GPOS `kern` feature gives the pair, for the
    `latn` script's default language system. Mirrors a shaper's PairPos walk:
    subtables in order, first one that covers `first` AND holds the pair wins
    (format 2 class tables always hold the pair — class 0 is the catch-all).
    """
    if "GPOS" not in font:
        return 0
    gpos = font["GPOS"].table
    latn = next((s.Script for s in gpos.ScriptList.ScriptRecord if s.ScriptTag == "latn"), None)
    if latn is None or latn.DefaultLangSys is None:
        return 0
    lookup_indices: list[int] = []
    for feature_index in latn.DefaultLangSys.FeatureIndex:
        record = gpos.FeatureList.FeatureRecord[feature_index]
        if record.FeatureTag == "kern":
            lookup_indices.extend(record.Feature.LookupListIndex)
    for lookup_index in lookup_indices:
        lookup = gpos.LookupList.Lookup[lookup_index]
        subtables = lookup.SubTable
        if lookup.LookupType == 9:  # extension lookups wrap the real subtable
            subtables = [st.ExtSubTable for st in subtables]
        for st in subtables:
            if getattr(st, "LookupType", 2) != 2 and lookup.LookupType != 2:
                continue
            coverage = st.Coverage.glyphs
            if first not in coverage:
                continue
            if st.Format == 1:
                for record in st.PairSet[coverage.index(first)].PairValueRecord:
                    if record.SecondGlyph == second:
                        return int(getattr(record.Value1, "XAdvance", 0) or 0)
            elif st.Format == 2:
                class1 = st.ClassDef1.classDefs.get(first, 0)
                class2 = st.ClassDef2.classDefs.get(second, 0)
                value = st.Class1Record[class1].Class2Record[class2].Value1
                return int(getattr(value, "XAdvance", 0) or 0) if value else 0
    return 0


def extract(font: TTFont) -> list[Letter]:
    glyph_set = font.getGlyphSet()
    cmap = font.getBestCmap()
    hmtx = font["hmtx"]
    letters: list[Letter] = []
    pen_x = 0
    previous: str | None = None
    for char in WORD:
        glyph = cmap[ord(char)]
        svg_pen = ExplicitSVGPathPen(glyph_set, ntos=lambda v: str(int(v)) if float(v).is_integer() else repr(v))
        # Flip y: font space is y-up, SVG (and react-native-svg) is y-down.
        glyph_set[glyph].draw(TransformPen(svg_pen, (1, 0, 0, -1, 0, 0)))
        bounds_pen = BoundsPen(glyph_set)
        glyph_set[glyph].draw(bounds_pen)
        x_min, y_min_font, x_max, y_max_font = (int(v) for v in bounds_pen.bounds)
        kern = pair_kerning(font, previous, glyph) if previous else 0
        pen_x += kern
        letters.append(
            Letter(
                char=char,
                glyph=glyph,
                d=svg_pen.getCommands(),
                advance=int(hmtx[glyph][0]),
                kern=kern,
                x=pen_x,
                x_min=x_min,
                y_min=-y_max_font,
                x_max=x_max,
                y_max=-y_min_font,
            )
        )
        pen_x += int(hmtx[glyph][0])
        previous = glyph
    return letters


def ts_string(value: str) -> str:
    return '"' + value.replace("\\", "\\\\").replace('"', '\\"') + '"'


def write_ts(font: TTFont, letters: list[Letter]) -> None:
    head, os2 = font["head"], font["OS/2"]
    version = font["name"].getDebugName(5)
    total = letters[-1].x + letters[-1].advance
    ink_left = letters[0].x + letters[0].x_min
    ink_right = letters[-1].x + letters[-1].x_max
    ink_top = min(l.y_min for l in letters)
    ink_bottom = max(l.y_max for l in letters)
    kerned_pairs = sum(1 for l in letters if l.kern)
    lines = [
        "/**",
        ' * The "MyanFlix" wordmark as SVG path data — GENERATED, do not edit by hand.',
        " *",
        f" * Font: {font['name'].getDebugName(4)} ({version}), the face `theme.font.black` names,",
        f" * read from {FONT_PATH_SHORT}.",
        " * Generator: mobile/scripts/extract-wordmark.py (fontTools; see its header",
        " * for how to re-run it). The same run writes assets/brand/wordmark.svg and",
        " * assets/brand/mark.svg, and `scripts/brand-assets.mjs` renders the PNGs.",
        " *",
        " * Why paths and not <Text>: the animated splash is on screen BEFORE expo-font",
        " * has resolved, so drawing the word with react-native-svg <Path>s means it",
        " * never waits for the font and never flashes a fallback face. The icon's",
        " * \"M\" is the very same outline (WORDMARK_LETTERS[0]).",
        " *",
        " * Coordinates: font units (`unitsPerEm` per em), already flipped into SVG",
        " * space — y grows DOWN, the baseline is y = 0, ink above it is negative.",
        " * Draw a letter with `<Path d={d} transform={`translate(${x} 0)`} />` and",
        " * scale the whole group by `fontSizePt / unitsPerEm` to set it at a point",
        " * size (cap height in pt = fontSizePt * capHeight / unitsPerEm).",
        " *",
        f" * Placement: `x` = cumulative advance widths plus GPOS pair kerning (the",
        f" * font's `kern` feature for `latn`). The table was read: {kerned_pairs} of the",
        f" * {len(letters) - 1} pairs in this word kern (every pair is 0), so `x` equals the",
        " * plain running sum of `advance`. No tracking is baked in; the app bar sets",
        " * its wordmark at -0.03 em, the approved splash preview at -0.01 em — add",
        " * `index * trackingEm * unitsPerEm` to `x` if the splash wants either.",
        " */",
        "",
        "export interface WordmarkLetter {",
        "  /** The character this outline draws. */",
        "  readonly char: string;",
        "  /** The glyph's name inside the font. */",
        "  readonly glyph: string;",
        "  /** SVG path data in font units, y-down, origin at this letter's pen position. */",
        "  readonly d: string;",
        "  /** Horizontal advance in font units. */",
        "  readonly advance: number;",
        "  /** GPOS pair-kerning applied before this letter (font units; 0 for the first). */",
        "  readonly kern: number;",
        "  /** This letter's origin on the x axis, in font units from the word's origin. */",
        "  readonly x: number;",
        "  /** Ink box of this letter's outline (font units, y-down), relative to its origin. */",
        "  readonly bounds: { readonly xMin: number; readonly yMin: number; readonly xMax: number; readonly yMax: number };",
        "}",
        "",
        "/** The font's vertical metrics, in font units (y-UP here, as the font states them). */",
        "export const WORDMARK_FONT = {",
        f"  family: {ts_string(font['name'].getDebugName(4))},",
        f"  file: {ts_string(FONT_PATH_SHORT)},",
        f"  version: {ts_string(version)},",
        f"  unitsPerEm: {head.unitsPerEm},",
        f"  ascender: {font['hhea'].ascent},",
        f"  descender: {font['hhea'].descent},",
        f"  capHeight: {os2.sCapHeight},",
        f"  xHeight: {os2.sxHeight},",
        "} as const;",
        "",
        f"/** The word, in order. `WORDMARK_LETTERS[0]` is the icon's \"M\". */",
        "export const WORDMARK_LETTERS: readonly WordmarkLetter[] = [",
    ]
    for letter in letters:
        lines += [
            "  {",
            f"    char: {ts_string(letter.char)},",
            f"    glyph: {ts_string(letter.glyph)},",
            f"    advance: {letter.advance},",
            f"    kern: {letter.kern},",
            f"    x: {letter.x},",
            f"    bounds: {{ xMin: {letter.x_min}, yMin: {letter.y_min}, xMax: {letter.x_max}, yMax: {letter.y_max} }},",
            f"    d: {ts_string(letter.d)},",
            "  },",
        ]
    lines += [
        "];",
        "",
        "/** Sum of the advances (+ kerning): where the pen rests after the last letter, font units. */",
        f"export const WORDMARK_ADVANCE_WIDTH = {total};",
        "",
        "/**",
        " * The ink box of the whole word in font units, y-down from the baseline:",
        " * `left`/`right` from the word's origin, `top` the tallest ascender/dot,",
        " * `bottom` the deepest descender. Centre the word by THIS box, not by the",
        " * advance width — the first and last side bearings are not symmetric.",
        " */",
        "export const WORDMARK_INK = {",
        f"  left: {ink_left},",
        f"  right: {ink_right},",
        f"  top: {ink_top},",
        f"  bottom: {ink_bottom},",
        f"  width: {ink_right - ink_left},",
        f"  height: {ink_bottom - ink_top},",
        "} as const;",
        "",
    ]
    with open(TS_OUT, "w", encoding="utf-8") as fh:
        fh.write("\n".join(lines))


def write_wordmark_svg(letters: list[Letter]) -> None:
    total = letters[-1].x + letters[-1].advance
    top = min(l.y_min for l in letters)
    bottom = max(l.y_max for l in letters)
    parts = [
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 %d %d %d" width="%d" height="%d">'
        % (top, total, bottom - top, total, bottom - top),
        "  <!-- MyanFlix wordmark, Noto Sans Myanmar Black — GENERATED by",
        "       mobile/scripts/extract-wordmark.py, do not edit by hand. Font units",
        "       (1000/em), baseline at y = 0; the viewBox is the advance width by the",
        "       word's ink height. -->",
        f'  <g fill="{WHITE}">',
    ]
    for letter in letters:
        parts.append(
            f'    <path id="letter-{letter.char}" transform="translate({letter.x} 0)" d="{letter.d}"/>'
        )
    parts += ["  </g>", "</svg>", ""]
    with open(WORDMARK_SVG_OUT, "w", encoding="utf-8") as fh:
        fh.write("\n".join(parts))


def write_mark_svg(font: TTFont, letters: list[Letter]) -> None:
    m = letters[0]
    upm = font["head"].unitsPerEm
    cap = font["OS/2"].sCapHeight
    scale = M_EM / upm
    m_ink_w = (m.x_max - m.x_min) * scale
    cap_px = cap * scale
    group_w = BAR_W + GAP + m_ink_w
    left = (ICON - group_w) / 2
    bar_x = left
    bar_y = (ICON - BAR_H) / 2
    # The M's cap-height midline sits on the canvas centre line, like the bar.
    baseline = ICON / 2 + cap_px / 2
    m_tx = left + BAR_W + GAP - m.x_min * scale
    f = lambda v: f"{v:.2f}".rstrip("0").rstrip(".")
    f4 = lambda v: f"{v:.4f}".rstrip("0").rstrip(".")
    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {ICON} {ICON}" width="{ICON}" height="{ICON}">',
        "  <!-- MyanFlix mark (the app icon): the app bar's 6 x 24 crimson bar beside the",
        '       "M" of the wordmark. GENERATED by mobile/scripts/extract-wordmark.py, do',
        "       not edit by hand. Transparent canvas; scripts/brand-assets.mjs puts it on",
        "       the #08080B ground, scales it into the Android safe zone and makes the",
        f"       monochrome variant. Bar {BAR_W} x {BAR_H}, radius {BAR_RX}; M at {M_EM} px/em",
        f"       (cap height {f(cap_px)} px); gap {GAP}; the pair centred by its ink box",
        f"       ({f(group_w)} x {BAR_H} px). -->",
        f'  <rect id="bar" x="{f(bar_x)}" y="{f(bar_y)}" width="{BAR_W}" height="{BAR_H}" rx="{BAR_RX}" fill="{CRIMSON}"/>',
        f'  <path id="m" fill="{WHITE}" transform="translate({f(m_tx)} {f(baseline)}) scale({f4(scale)})" d="{m.d}"/>',
        "</svg>",
        "",
    ]
    with open(MARK_SVG_OUT, "w", encoding="utf-8") as fh:
        fh.write("\n".join(parts))
    print(
        f"mark.svg: bar {BAR_W}x{BAR_H} rx{BAR_RX} at ({f(bar_x)}, {f(bar_y)}); "
        f"M em {M_EM} (cap {f(cap_px)}, ink {f(m_ink_w)} wide) origin ({f(m_tx)}, {f(baseline)}); "
        f"group {f(group_w)}x{BAR_H} centred"
    )


def main() -> int:
    if not os.path.exists(FONT_PATH):
        print(f"font not found: {FONT_PATH}", file=sys.stderr)
        return 1
    font = TTFont(FONT_PATH)
    letters = extract(font)
    os.makedirs(os.path.dirname(TS_OUT), exist_ok=True)
    os.makedirs(os.path.dirname(MARK_SVG_OUT), exist_ok=True)
    write_ts(font, letters)
    write_wordmark_svg(letters)
    write_mark_svg(font, letters)
    for letter in letters:
        print(f"{letter.char}: glyph {letter.glyph} advance {letter.advance} kern {letter.kern} x {letter.x} "
              f"ink x {letter.x_min}..{letter.x_max} y {letter.y_min}..{letter.y_max}")
    print(f"advance width {letters[-1].x + letters[-1].advance} units")
    print(f"wrote {os.path.relpath(TS_OUT, MOBILE_DIR)}, {os.path.relpath(WORDMARK_SVG_OUT, MOBILE_DIR)}, "
          f"{os.path.relpath(MARK_SVG_OUT, MOBILE_DIR)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
