#!/usr/bin/env node
/**
 * Renders every brand PNG in mobile/assets/ from the two SVG sources in
 * mobile/assets/brand/ (which scripts/extract-wordmark.py generates from the
 * app's own typeface). Run from mobile/:
 *
 *     node scripts/brand-assets.mjs                 # rewrite the five PNGs
 *     node scripts/brand-assets.mjs --preview DIR   # ...and review renders into DIR
 *
 * It rasterises with the BACKEND's sharp (backend/node_modules/sharp, required
 * by absolute path) so the mobile package.json gains no native dependency.
 * Nothing here runs at app runtime; the PNGs are committed and only change
 * when the mark changes. The new icon and native splash only appear in a NEW
 * NATIVE BUILD (prebuild / EAS); a JS reload cannot show them.
 *
 * What each file is (all from mark.svg unless said otherwise):
 *   icon.png                      1024, the mark on #08080B, NO alpha channel —
 *                                 prebuild flattens a transparent iOS icon on
 *                                 WHITE, and Apple applies the rounded mask
 *                                 itself, so no corners are baked in.
 *   android-icon-foreground.png   1024, transparent, the mark scaled to 0.90 so
 *                                 its corners stay inside Android's 66 dp safe
 *                                 circle (626 px of the 108 dp = 1024 px canvas).
 *   android-icon-background.png   1024, solid #08080B.
 *   android-icon-monochrome.png   1024, transparent, the same geometry as the
 *                                 foreground with every fill white (one
 *                                 silhouette; Android tints it for themed icons).
 *   splash-icon.png               1200, transparent, ONLY the crimson bar: 6% x
 *                                 24% of the square, radius 1%, centred. The
 *                                 expo-splash-screen plugin draws it at
 *                                 `imageWidth` 200 pt/dp, so the bar renders
 *                                 12 x 48 pt centred on screen — the exact first
 *                                 frame of the JS splash. 1200 px so the largest
 *                                 Android drawable (xxxhdpi = 800 px) and every
 *                                 iOS scale (200/400/600) are downscales.
 */

import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const sharp = require("/Users/pc/Desktop/MyanFlix/backend/node_modules/sharp");

const MOBILE_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ASSETS = path.join(MOBILE_DIR, "assets");
const BRAND = path.join(ASSETS, "brand");

const GROUND = "#08080B";
const CRIMSON = "#E0181F";
const WHITE = "#FFFFFF";

/** Android adaptive icon: 108 dp canvas, 66 dp safe circle → 0.9 keeps the mark's corners inside it. */
const ANDROID_FOREGROUND_SCALE = 0.9;

/** The native splash image: the bar's share of the square (6% wide, 24% tall, radius 1%). */
const SPLASH_SIZE = 1200;
const SPLASH_BAR = { w: 0.06, h: 0.24, rx: 0.01 };

const ICON_SIZE = 1024;

async function loadMark() {
  const svg = await readFile(path.join(BRAND, "mark.svg"), "utf8");
  const match = svg.match(/<svg[^>]*viewBox="0 0 (\d+) (\d+)"[^>]*>([\s\S]*)<\/svg>/);
  if (!match || Number(match[1]) !== ICON_SIZE || Number(match[2]) !== ICON_SIZE) {
    throw new Error("assets/brand/mark.svg must be the generated 1024 x 1024 mark");
  }
  return match[3];
}

/**
 * Wraps the mark's inner elements in a fresh SVG: optional solid ground,
 * optional uniform scale about the centre, optional single-colour fills.
 */
function composeMark(inner, { size = ICON_SIZE, ground = null, scale = 1, fill = null } = {}) {
  const body = fill ? inner.replace(/fill="#[0-9A-Fa-f]{6}"/g, `fill="${fill}"`) : inner;
  const half = ICON_SIZE / 2;
  const group =
    scale === 1
      ? body
      : `<g transform="translate(${half} ${half}) scale(${scale}) translate(${-half} ${-half})">${body}</g>`;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${ICON_SIZE} ${ICON_SIZE}" width="${size}" height="${size}">` +
    (ground ? `<rect width="${ICON_SIZE}" height="${ICON_SIZE}" fill="${ground}"/>` : "") +
    group +
    `</svg>`
  );
}

function splashSvg(size = SPLASH_SIZE) {
  const w = SPLASH_SIZE * SPLASH_BAR.w;
  const h = SPLASH_SIZE * SPLASH_BAR.h;
  const rx = SPLASH_SIZE * SPLASH_BAR.rx;
  const x = (SPLASH_SIZE - w) / 2;
  const y = (SPLASH_SIZE - h) / 2;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SPLASH_SIZE} ${SPLASH_SIZE}" width="${size}" height="${size}">` +
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${CRIMSON}"/>` +
    `</svg>`
  );
}

const png = (svg) => sharp(Buffer.from(svg)).png({ compressionLevel: 9 });

async function writeAssets(inner) {
  const out = (name) => path.join(ASSETS, name);
  // iOS: opaque. `flatten` composites onto the ground, `removeAlpha` drops the channel entirely.
  await png(composeMark(inner, { ground: GROUND })).flatten({ background: GROUND }).removeAlpha().toFile(out("icon.png"));
  await png(composeMark(inner, { scale: ANDROID_FOREGROUND_SCALE })).toFile(out("android-icon-foreground.png"));
  await png(composeMark("", { ground: GROUND })).flatten({ background: GROUND }).removeAlpha().toFile(out("android-icon-background.png"));
  await png(composeMark(inner, { scale: ANDROID_FOREGROUND_SCALE, fill: WHITE })).toFile(out("android-icon-monochrome.png"));
  await png(splashSvg()).toFile(out("splash-icon.png"));
}

/**
 * Review renders (not shipped): the icon at 180 px under an iOS-style mask, the
 * iOS first frame at 390 x 844 pt, the Android 12 splash (the 200 dp image in
 * its 288 dp icon area, masked by the 192 dp circle) and the finished splash
 * frame with the wordmark at 40 pt beside the bar.
 */
async function writePreviews(inner, dir) {
  await mkdir(dir, { recursive: true });
  const out = (name) => path.join(dir, name);

  // 1. icon at 180 px, on black, with Apple's ~22.4% corner radius for the look.
  const icon180 = await png(composeMark(inner, { size: 180, ground: GROUND })).toBuffer();
  const iosMask = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180"><rect width="180" height="180" rx="40.3" fill="#fff"/></svg>`,
  );
  const masked = await sharp(icon180).composite([{ input: iosMask, blend: "dest-in" }]).png().toBuffer();
  await sharp({ create: { width: 260, height: 260, channels: 4, background: "#000000" } })
    .composite([{ input: masked, left: 40, top: 40 }])
    .png()
    .toFile(out("icon-180.png"));

  // 1b. The Android launcher: background + foreground, the visible 72 dp of the
  //     108 dp canvas under a circular mask; and the themed look, the monochrome
  //     silhouette tinted dark on a light disc the way Android 13+ draws it.
  const visible = Math.round((ICON_SIZE * 72) / 108); // 683 px
  const crop = { left: Math.round((ICON_SIZE - visible) / 2), top: Math.round((ICON_SIZE - visible) / 2), width: visible, height: visible };
  const circle = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180"><circle cx="90" cy="90" r="90" fill="#fff"/></svg>`,
  );
  const launcher = await sharp(await png(composeMark(inner, { ground: GROUND, scale: ANDROID_FOREGROUND_SCALE })).toBuffer())
    .extract(crop).resize(180, 180).png().toBuffer();
  const launcherMasked = await sharp(launcher).composite([{ input: circle, blend: "dest-in" }]).png().toBuffer();
  const themed = await sharp(await png(composeMark(inner, { ground: "#DDE3EA", scale: ANDROID_FOREGROUND_SCALE, fill: "#1C1C24" })).toBuffer())
    .extract(crop).resize(180, 180).png().toBuffer();
  const themedMasked = await sharp(themed).composite([{ input: circle, blend: "dest-in" }]).png().toBuffer();
  await sharp({ create: { width: 480, height: 260, channels: 4, background: "#000000" } })
    .composite([
      { input: launcherMasked, left: 40, top: 40 },
      { input: themedMasked, left: 260, top: 40 },
    ])
    .png()
    .toFile(out("android-launcher-180.png"));

  // 2. iOS first frame: 390 x 844 pt at 2x, the 200 pt image centred → bar 12 x 48 pt.
  const SCALE = 2;
  const W = 390, H = 844;
  const splash200 = await png(splashSvg(200 * SCALE)).toBuffer();
  await sharp({ create: { width: W * SCALE, height: H * SCALE, channels: 4, background: GROUND } })
    .composite([{ input: splash200, left: ((W - 200) / 2) * SCALE, top: ((H - 200) / 2) * SCALE }])
    .png()
    .toFile(out("ios-first-frame-390x844@2x.png"));

  // 3. Android 12 splash: 288 dp icon area (plugin canvas) holding the 200 dp image,
  //    masked by the OS to a 192 dp circle; the thin ring shows where the mask falls.
  const ring = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W * SCALE}" height="${H * SCALE}">` +
      `<circle cx="${(W / 2) * SCALE}" cy="${(H / 2) * SCALE}" r="${96 * SCALE}" fill="none" stroke="#2A2A33" stroke-width="2"/>` +
      `</svg>`,
  );
  await sharp({ create: { width: W * SCALE, height: H * SCALE, channels: 4, background: GROUND } })
    .composite([
      { input: ring },
      { input: splash200, left: ((W - 200) / 2) * SCALE, top: ((H - 200) / 2) * SCALE },
    ])
    .png()
    .toFile(out("android-splash-390x844@2x.png"));

  // 4. The finished splash frame: bar 12 x 48 (radius 2) + "MyanFlix" at 40 pt,
  //    gap 14, the pair centred by ink on a 390 x 844 screen.
  const wordmark = await readFile(path.join(BRAND, "wordmark.svg"), "utf8");
  const paths = wordmark.match(/<g fill="#FFFFFF">([\s\S]*?)<\/g>/)?.[1] ?? "";
  const ts = await readFile(path.join(MOBILE_DIR, "src/components/splash/wordmarkPaths.ts"), "utf8");
  const num = (key) => Number(ts.match(new RegExp(`${key}: (-?\\d+)`))[1]);
  const upm = num("unitsPerEm"), cap = num("capHeight");
  const inkLeft = num("left"), inkRight = num("right");
  const FONT_PT = 40, BAR_W = 12, BAR_H = 48, GAP = 14;
  const s = FONT_PT / upm;
  const inkW = (inkRight - inkLeft) * s;
  const groupW = BAR_W + GAP + inkW;
  const left = (W - groupW) / 2;
  const barY = (H - BAR_H) / 2;
  const baseline = H / 2 + (cap * s) / 2;
  const tx = left + BAR_W + GAP - inkLeft * s;
  const finished =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W * SCALE}" height="${H * SCALE}">` +
    `<rect width="${W}" height="${H}" fill="${GROUND}"/>` +
    `<rect x="${left}" y="${barY}" width="${BAR_W}" height="${BAR_H}" rx="2" fill="${CRIMSON}"/>` +
    `<g fill="${WHITE}" transform="translate(${tx} ${baseline}) scale(${s})">${paths}</g>` +
    `</svg>`;
  await png(finished).toFile(out("splash-finished-390x844@2x.png"));
  console.log(
    `finished frame @40pt: ink ${inkW.toFixed(2)} pt, group ${groupW.toFixed(2)} pt, bar x ${left.toFixed(2)}..${(left + BAR_W).toFixed(2)}, ` +
      `baseline y ${baseline.toFixed(2)}, word origin x ${tx.toFixed(2)}`,
  );
}

async function main() {
  const inner = await loadMark();
  await writeAssets(inner);
  for (const name of ["icon", "android-icon-foreground", "android-icon-background", "android-icon-monochrome", "splash-icon"]) {
    const meta = await sharp(path.join(ASSETS, `${name}.png`)).metadata();
    console.log(`${name}.png  ${meta.width}x${meta.height}  channels ${meta.channels}  alpha ${meta.hasAlpha}`);
  }
  const previewIndex = process.argv.indexOf("--preview");
  if (previewIndex !== -1) {
    const dir = process.argv[previewIndex + 1];
    if (!dir) throw new Error("--preview needs a directory");
    await writePreviews(inner, path.resolve(dir));
    console.log(`previews in ${path.resolve(dir)}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
