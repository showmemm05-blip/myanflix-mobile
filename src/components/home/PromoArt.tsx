import { memo } from "react";
import { StyleSheet } from "react-native";
import Svg, { Circle, G, Path, Rect } from "react-native-svg";
import type { HomePromoArtPreset } from "@/types/home";

/**
 * The drawn scenes behind a Home promo that has no uploaded picture — the
 * admin "Home promos" page's art preset. PREMIUM, PAYMENT and GAMES are the
 * HomeMobile.dc.html hero scenes point for point (390 × 600 viewBox); GENERIC
 * is the same flat style in the brand crimson (a landscape card and a book
 * under a play mark), for a promo that is about nothing in particular.
 *
 * Artwork fills, not UI colours: like ArcadeArt and SubscribeArt, the scene
 * hues live here and nowhere else. Purely decorative — hidden from screen
 * readers; the slide's words carry the meaning.
 *
 * `frame`:
 * - "hero" — the whole 390 × 600 scene, sliced to fill the slide;
 * - "card" — the middle band (y 60–390) where the drawing sits, sliced to
 *   fill a coming-soon card or the spotlight.
 */
interface Props {
  preset: HomePromoArtPreset;
  frame?: "hero" | "card";
}

const VIEWBOX = { hero: "0 0 390 600", card: "0 60 390 330" } as const;

/** The crown from the board (24 × 24 path). */
const CROWN = "M3 18h18l1-11-5.5 4L12 4 7.5 11 2 7z";
/** The four-point sparkle from the board. */
const SPARKLE = "M12 3l1.8 4.7 4.7 1.8-4.7 1.8L12 16l-1.8-4.7-4.7-1.8 4.7-1.8z";

export const PromoArt = memo(function PromoArt({ preset, frame = "hero" }: Props) {
  return (
    <Svg
      width="100%"
      height="100%"
      viewBox={VIEWBOX[frame]}
      preserveAspectRatio="xMidYMid slice"
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
    >
      {preset === "PREMIUM" ? <PremiumScene /> : null}
      {preset === "PAYMENT" ? <PaymentScene /> : null}
      {preset === "GAMES" ? <GamesScene /> : null}
      {preset === "GENERIC" ? <GenericScene /> : null}
    </Svg>
  );
});

/** Gold: a crown over a poster, a tilted landscape card and a tilted book. */
function PremiumScene() {
  return (
    <G>
      <Rect width={390} height={600} fill="#1A1408" />
      <Circle cx={195} cy={240} r={180} fill="#F5C451" opacity={0.1} />
      <Circle cx={195} cy={240} r={96} fill="#F5C451" opacity={0.1} />
      <Circle cx={62} cy={120} r={4} fill="#F5C451" opacity={0.7} />
      <Circle cx={330} cy={150} r={5} fill="#F5C451" opacity={0.6} />
      <Circle cx={300} cy={90} r={3} fill="#F5C451" opacity={0.5} />
      <Circle cx={90} cy={330} r={3} fill="#F5C451" opacity={0.5} />
      <G transform="rotate(-12 110 250)">
        <Rect x={34} y={200} width={150} height={96} rx={10} fill="#2E2410" />
        <Rect x={34} y={200} width={150} height={96} rx={10} fill="none" stroke="#F5C451" strokeWidth={2} />
        <Path d="M34 270 L62 246 L82 258 L112 230 L142 254 L184 236 V296 H34 Z" fill="#F5C451" opacity={0.35} />
        <Path d="M98 232 l26 16 -26 16 z" fill="#F5C451" />
      </G>
      <G transform="rotate(12 300 250)">
        <Rect x={244} y={188} width={104} height={146} rx={8} fill="#2E2410" />
        <Rect x={244} y={188} width={104} height={146} rx={8} fill="none" stroke="#F5C451" strokeWidth={2} />
        <Rect x={244} y={188} width={14} height={146} rx={4} fill="#F5C451" opacity={0.55} />
        <Path
          d="M272 216 h56 M272 232 h44 M272 248 h56 M272 264 h36"
          stroke="#F5C451"
          strokeWidth={3}
          strokeLinecap="round"
          opacity={0.5}
        />
      </G>
      <Rect x={138} y={170} width={114} height={166} rx={10} fill="#3A2C10" />
      <Rect x={138} y={170} width={114} height={166} rx={10} fill="none" stroke="#F5C451" strokeWidth={2.5} />
      <Circle cx={214} cy={214} r={18} fill="#F5C451" />
      <Path d="M138 312 L166 282 L186 298 L216 266 L252 300 V336 H138 Z" fill="#F5C451" opacity={0.45} />
      <Path d={CROWN} transform="translate(152 94) scale(3.6)" fill="#F5C451" />
    </G>
  );
}

/** Green: a phone holding the four payment chips, coins around it and a green tick. */
function PaymentScene() {
  return (
    <G>
      <Rect width={390} height={600} fill="#0B1F17" />
      <Circle cx={195} cy={230} r={180} fill="#2FD07E" opacity={0.1} />
      <Circle cx={195} cy={230} r={90} fill="#2FD07E" opacity={0.1} />
      <Circle cx={70} cy={140} r={14} fill="#F5C451" opacity={0.8} />
      <Circle cx={70} cy={140} r={7} fill="#0B1F17" opacity={0.6} />
      <Circle cx={320} cy={110} r={10} fill="#F5C451" opacity={0.7} />
      <Circle cx={320} cy={110} r={5} fill="#0B1F17" opacity={0.6} />
      <Circle cx={330} cy={330} r={12} fill="#F5C451" opacity={0.7} />
      <Circle cx={330} cy={330} r={6} fill="#0B1F17" opacity={0.6} />
      <Rect x={132} y={96} width={126} height={250} rx={24} fill="#121217" />
      <Rect x={132} y={96} width={126} height={250} rx={24} fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth={2} />
      <Rect x={170} y={108} width={50} height={6} rx={3} fill="#1C1C23" />
      <Rect x={148} y={134} width={94} height={34} rx={9} fill="#4DB3FF" />
      <Circle cx={166} cy={151} r={8} fill="#08080B" opacity={0.8} />
      <Rect x={182} y={147} width={46} height={8} rx={4} fill="#08080B" opacity={0.45} />
      <Rect x={148} y={178} width={94} height={34} rx={9} fill="#F5C451" />
      <Circle cx={166} cy={195} r={8} fill="#1F1600" opacity={0.8} />
      <Rect x={182} y={191} width={46} height={8} rx={4} fill="#1F1600" opacity={0.45} />
      <Rect x={148} y={222} width={94} height={34} rx={9} fill="#B3262C" />
      <Circle cx={166} cy={239} r={8} fill="#FFFFFF" opacity={0.9} />
      <Rect x={182} y={235} width={46} height={8} rx={4} fill="#FFFFFF" opacity={0.55} />
      <Rect x={148} y={266} width={94} height={34} rx={9} fill="#2FD07E" />
      <Circle cx={166} cy={283} r={8} fill="#052A17" opacity={0.8} />
      <Rect x={182} y={279} width={46} height={8} rx={4} fill="#052A17" opacity={0.45} />
      <Circle cx={262} cy={318} r={30} fill="#2FD07E" />
      <Circle cx={262} cy={318} r={30} fill="none" stroke="#0B1F17" strokeWidth={4} />
      <Path
        d="M248 318 l9 9 18 -18"
        fill="none"
        stroke="#052A17"
        strokeWidth={5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </G>
  );
}

/** Crimson: a drawn controller with gold sparkles. */
function GamesScene() {
  return (
    <G>
      <Rect width={390} height={600} fill="#180A0D" />
      <Circle cx={195} cy={240} r={180} fill="#E0181F" opacity={0.1} />
      <Circle cx={195} cy={240} r={90} fill="#E0181F" opacity={0.16} />
      <Circle cx={60} cy={110} r={3} fill="#FFFFFF" opacity={0.6} />
      <Circle cx={110} cy={80} r={2} fill="#FFFFFF" opacity={0.5} />
      <Circle cx={330} cy={120} r={3} fill="#FFFFFF" opacity={0.6} />
      <Circle cx={300} cy={60} r={2} fill="#FFFFFF" opacity={0.5} />
      <Circle cx={40} cy={330} r={2} fill="#FFFFFF" opacity={0.5} />
      <Circle cx={350} cy={320} r={3} fill="#FFFFFF" opacity={0.5} />
      <Path d={SPARKLE} transform="translate(286 150) scale(2.2)" fill="#F5C451" opacity={0.9} />
      <Path d={SPARKLE} transform="translate(60 180) scale(1.4)" fill="#2FD07E" opacity={0.8} />
      <Rect x={90} y={176} width={210} height={118} rx={52} fill="#2B1116" />
      <Rect x={90} y={176} width={210} height={118} rx={52} fill="none" stroke="#E0181F" strokeWidth={3} />
      <Rect x={136} y={214} width={16} height={46} rx={4} fill="#F5C451" />
      <Rect x={121} y={229} width={46} height={16} rx={4} fill="#F5C451" />
      <Circle cx={242} cy={218} r={9} fill="#FF4D55" />
      <Circle cx={262} cy={237} r={9} fill="#F5C451" />
      <Circle cx={222} cy={237} r={9} fill="#2FD07E" />
      <Circle cx={242} cy={256} r={9} fill="#4DB3FF" />
      <Rect x={183} y={206} width={24} height={8} rx={4} fill="#8C8C99" />
      <Rect x={150} y={300} width={90} height={22} rx={11} fill="#E0181F" opacity={0.35} />
    </G>
  );
}

/** Neutral crimson: a landscape card with a play mark and a book beside it, the same flat style. */
function GenericScene() {
  return (
    <G>
      <Rect width={390} height={600} fill="#121217" />
      <Circle cx={195} cy={240} r={180} fill="#E0181F" opacity={0.08} />
      <Circle cx={195} cy={240} r={96} fill="#E0181F" opacity={0.1} />
      <Circle cx={64} cy={120} r={3} fill="#FFFFFF" opacity={0.5} />
      <Circle cx={326} cy={140} r={4} fill="#FFFFFF" opacity={0.4} />
      <Circle cx={92} cy={340} r={3} fill="#FFFFFF" opacity={0.4} />
      <Path d={SPARKLE} transform="translate(292 96) scale(1.8)" fill="#F5C451" opacity={0.8} />
      <G transform="rotate(10 300 260)">
        <Rect x={250} y={196} width={96} height={134} rx={8} fill="#1C1C23" />
        <Rect x={250} y={196} width={13} height={134} rx={4} fill="#FF4D55" opacity={0.6} />
        <Path
          d="M276 224 h52 M276 240 h40 M276 256 h52"
          stroke="#B3B3BD"
          strokeWidth={3}
          strokeLinecap="round"
          opacity={0.45}
        />
      </G>
      <Rect x={60} y={180} width={210} height={128} rx={12} fill="#2A1215" />
      <Rect x={60} y={180} width={210} height={128} rx={12} fill="none" stroke="#E0181F" strokeWidth={2.5} />
      <Circle cx={218} cy={216} r={16} fill="#F2A65A" opacity={0.85} />
      <Path d="M60 280 L96 248 L124 266 L164 228 L204 262 L270 238 V308 H60 Z" fill="#E0181F" opacity={0.35} />
      <Circle cx={165} cy={244} r={28} fill="#E0181F" />
      <Path d="M157 230 l22 14 -22 14 z" fill="#FFFFFF" />
    </G>
  );
}
