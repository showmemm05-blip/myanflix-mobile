import { memo } from "react";
import Svg, { Path } from "react-native-svg";
import { TICKET_INK } from "@/lottery/theme/tokens";

/**
 * The barcode STAND-IN (data/ticketArt.ts): one path of bars stretched to its
 * field edge to edge (`preserveAspectRatio="none"`, like the recipe's SVG).
 * Not scannable — the real build uses a real Code 128. `color` greys it into
 * a ghost on the ticket you type on (before buying).
 */
export const Barcode = memo(function Barcode({
  d,
  viewWidth,
  width,
  height,
  color = TICKET_INK.bars,
}: {
  d: string;
  /** The path's own width (its viewBox is `0 0 viewWidth 40`). */
  viewWidth: number;
  width: number;
  height: number;
  color?: string;
}) {
  return (
    <Svg width={width} height={height} viewBox={`0 0 ${viewWidth} 40`} preserveAspectRatio="none">
      <Path d={d} fill={color} />
    </Svg>
  );
});

/** The QR STAND-IN: 25 × 25 modules + a 2-module quiet zone on a white square. Not scannable. */
export const QrCode = memo(function QrCode({
  d,
  size,
  color = TICKET_INK.bars,
}: {
  d: string;
  size: number;
  color?: string;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 29 29">
      <Path d={d} fill={color} />
    </Svg>
  );
});
