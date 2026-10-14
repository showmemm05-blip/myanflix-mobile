# MyanFlix brand sources

The two SVGs here are the source of every PNG in `mobile/assets/` and of the
splash wordmark's path data. They are **generated** — rerun the scripts
instead of editing them.

| File | What it is |
|---|---|
| `mark.svg` | The app mark on a transparent 1024 x 1024 canvas: the app bar's crimson bar (`#E0181F`, 92 x 368, radius 31 — the 6 x 24 / radius 2 bar of `components/layout/AppTopBar` scaled) beside the white "M" of the wordmark at 481 px/em (cap height 343 px), gap 72, the pair centred by its ink box (555 x 368 px). |
| `wordmark.svg` | "MyanFlix" as eight `<path>`s, in font units (1000/em, baseline at y = 0), placed by advance width + GPOS pair kerning (every pair in this word kerns 0). |

## How they were made

1. `python3 scripts/extract-wordmark.py` (from `mobile/`; needs
   [fontTools](https://pypi.org/project/fonttools/), e.g.
   `python3 -m venv /tmp/wordmark-venv && /tmp/wordmark-venv/bin/pip install fonttools`).
   It reads the app's own face, **Noto Sans Myanmar Black (900)** from
   `node_modules/@expo-google-fonts/noto-sans-myanmar/900Black/NotoSansMyanmar_900Black.ttf`
   (the file `theme.font.black` loads), flips each glyph's outline into SVG
   space (y down) and writes:
   - `src/components/splash/wordmarkPaths.ts` — per letter: `d`, `advance`,
     `kern`, `x`, ink `bounds`; plus `WORDMARK_FONT` (unitsPerEm 1000,
     ascender 1324, descender -860, capHeight 714, xHeight 536),
     `WORDMARK_ADVANCE_WIDTH` (4687) and `WORDMARK_INK` (77..4682 wide,
     -776..240 tall).
   - `wordmark.svg` and `mark.svg` here.
2. `node scripts/brand-assets.mjs [--preview DIR]` renders the PNGs with the
   backend's sharp (`backend/node_modules/sharp`, required by absolute path so
   the mobile package gains no native dependency):

   | PNG | Size | Alpha | Content |
   |---|---|---|---|
   | `icon.png` | 1024 | none | the mark on `#08080B`; no corners baked in (Apple masks it; prebuild would flatten alpha on WHITE) |
   | `android-icon-foreground.png` | 1024 | yes | the mark at 0.90 so its corners stay inside Android's 66 dp safe circle (626 px of the 108 dp canvas; farthest ink is 293 px from centre) |
   | `android-icon-background.png` | 1024 | none | solid `#08080B` |
   | `android-icon-monochrome.png` | 1024 | yes | the foreground's geometry, every fill white (Android tints it for themed icons) |
   | `splash-icon.png` | 1200 | yes | ONLY the bar: 72 x 288, radius 12, centred (6% x 24% of the square, radius 1%) |

## Why the splash image is just the bar

`app.json` draws `splash-icon.png` at `imageWidth` 200, so the bar renders
**12 x 48 pt/dp, radius 2, centred on the screen** on both platforms — the
exact first frame of the JS splash (`components/splash/`), which then animates
from it without a visible handoff. On Android 12+ the system shows the image
inside its 288 dp icon area masked to a 192 dp circle; the bar's far corner is
25 dp from the centre, nowhere near the mask.

The icon, the native splash and `app.json`'s plugin entry only take effect in
a **new native build** (`npx expo prebuild` / EAS); a JS reload cannot show
them.
