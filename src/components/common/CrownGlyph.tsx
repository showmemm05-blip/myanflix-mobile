import { memo } from "react";
import Svg, { Path } from "react-native-svg";

/**
 * The premium crown on locked titles — badges, poster cells, shelves, rails
 * and the hub hero.
 *
 * Drawn with react-native-svg (like player/PlayerGlyph.tsx) instead of the
 * Material Community Icons font: every use of that font in the app was this one
 * glyph, and it cost a 1.3 MB TTF in every build and update, plus a font load
 * the first time a premium badge rendered.
 *
 * The path is the same Material Design Icons "crown" (24×24, Apache-2.0) the
 * font drew — read back from the font file that used to ship, so the
 * shape and its place in the size×size box are unchanged.
 */
const CROWN_PATH = "M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm14 3c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1v-1h14v1z";

interface Props {
  /** Box size in pt — the same number the font icon's `size` was. */
  size: number;
  color: string;
}

export const CrownGlyph = memo(function CrownGlyph({ size, color }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" pointerEvents="none">
      <Path d={CROWN_PATH} fill={color} />
    </Svg>
  );
});
