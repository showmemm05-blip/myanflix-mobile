import { memo, useMemo, useState } from "react";
import { StyleSheet, Text, View, type LayoutChangeEvent, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
import { Image } from "expo-image";
import Animated, { useAnimatedStyle, useSharedValue, type SharedValue } from "react-native-reanimated";
import Svg, { Text as SvgText } from "react-native-svg";
import { LT_ART } from "@/lottery/assets";
import { COMPONENT_COPY } from "@/lottery/components/copy";
import { Barcode, QrCode } from "@/lottery/components/ticket/Barcode";
import {
  THAI_TEMPLATE,
  TICKET_ASPECT,
  type TicketBox,
  type TicketTextField,
} from "@/lottery/components/ticket/template";
import { DIGIT_WORDS, dateEn, dateLong, dateMy, group, ks, pad, ticketA11y } from "@/lottery/data/format";
import type { DrawInfo } from "@/lottery/data/sample";
import { ticketArt } from "@/lottery/data/ticketArt";
import { useLtFace } from "@/lottery/theme/fonts";
import { LT, LT_RADIUS, LT_SHADOW, TICKET_INK } from "@/lottery/theme/tokens";
import { theme } from "@/theme";

/** What the paper prints about its draw: the number, the date lines, the price, the picture and the frame. */
export type TicketDraw = Pick<DrawInfo, "no" | "dateIso" | "price" | "pictureUrl" | "frameUrl">;

export interface TicketPrint {
  /** 0 → 1: this ticket's own print (number, words, ticket ID, code, QR) fades in. */
  layers: SharedValue<number>;
  /** 0 → 1: the barcode wipes in left to right. */
  barcode: SharedValue<number>;
}

export interface TicketProps {
  draw: TicketDraw;
  /** Six digits as a string ("004821"). */
  number: string;
  /** MFL-24-000184. Without one the ticket is a preview (no ID, barcode, code or QR). */
  ticketId?: string;
  /** Points. Unset: the ticket fills its parent's width (measured). */
  width?: number;
  /**
   * full — every layer, read as one image · preview — what a draw prints
   * before buying (no ID, barcode, code, QR) · thumb — a picture only, hidden
   * from screen readers (the caller prints the number beside it). Under 240pt
   * wide a ticket is always a thumb (recipe rule).
   */
  mode?: "full" | "preview" | "thumb";
  /** Blanks the number and its words. */
  hideNumber?: boolean;
  /** Printed's reveal: drives this ticket's own layers and the barcode wipe. */
  print?: TicketPrint;
  /** Replaces the spoken label (a preview's wording belongs to its screen). */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

/** Under this a ticket is a picture only (recipe §5). */
const THUMB_BELOW = 240;
/** Under this the 600-wide frame is sharp enough (≤ 900 px at 3×). */
const SMALL_FRAME_BELOW = 300;

/**
 * The ticket box's own look — every ticket, and the one you type on (Draw's
 * ticket/TicketInput): always 1800 : 940, radius 2, the paper under the frame.
 */
export const TICKET_BOX: ViewStyle = {
  aspectRatio: TICKET_ASPECT,
  borderRadius: LT_RADIUS.ticket,
  overflow: "hidden",
  backgroundColor: LT.ticketPaper,
};

/**
 * THE TICKET — the approved Thai-style MyanFlix ticket (thai-ticket-recipe.md
 * + template-thai.json): the frame image, the draw's picture in its slot
 * (TicketPaper), then live layers in the template's order, the hollow
 * overprint last.
 *
 * Why it never crops or stretches: the box is ALWAYS 1800 : 940
 * (`aspectRatio`), the frame is drawn `contain` in it, and every layer is a
 * fraction of the box's own width W and height H — positions x·W, y·H, sizes
 * w·W, h·H, text sizeRel·W (useTicketGeometry). The OS text size is ignored
 * on these layers (`allowFontScaling={false}`): they are printed artwork, and
 * the number is always also spoken and written beside the ticket. Never scale
 * a ticket with a transform (it would blur the live text) — set `width`;
 * rotation is fine.
 *
 * Text is centred the way the browser centres `line-height: 1` text in a flex
 * box: no lineHeight and no font padding, so the font's own ascent + descent
 * box sits on the field's centre line, whatever the face.
 */
export const Ticket = memo(function Ticket({
  draw,
  number,
  ticketId,
  width,
  mode = "full",
  hideNumber = false,
  print,
  accessibilityLabel,
  style,
}: TicketProps) {
  const [measured, setMeasured] = useState(0);
  const W = width ?? measured;
  const thumb = mode === "thumb" || (W > 0 && W < THUMB_BELOW);
  const preview = mode === "preview" || !ticketId;

  const onLayout = (event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout.width;
    if (Math.abs(next - measured) > 0.5) setMeasured(next);
  };

  let label: string | undefined;
  if (!thumb) {
    if (accessibilityLabel) label = accessibilityLabel;
    else if (!preview && ticketId) label = ticketA11y(draw.no, draw.dateIso, ticketId, number);
    else {
      label = COMPONENT_COPY.ticket.previewA11y(hideNumber ? null : number, draw.no, dateLong(draw.dateIso), ks(draw.price));
    }
  }

  return (
    <View
      onLayout={width === undefined ? onLayout : undefined}
      style={[styles.box, { width: width ?? "100%" }, thumb ? styles.thumbShadow : styles.fullShadow, style]}
      accessible={!thumb}
      accessibilityRole={thumb ? undefined : "image"}
      accessibilityLabel={label}
      accessibilityElementsHidden={thumb}
      importantForAccessibility={thumb ? "no-hide-descendants" : "yes"}
    >
      {W > 0 ? (
        <TicketLayers
          W={W}
          draw={draw}
          number={number}
          ticketId={preview ? undefined : ticketId}
          hideNumber={hideNumber}
          print={print}
        />
      ) : null}
    </View>
  );
});

/** A layer's absolute frame — a plain object, so it styles a View and an Image alike. */
export interface Placed {
  position: "absolute";
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * The layer maths for a ticket W wide (recipe §2): H, `place` (a template box
 * at x·W, y·H, w·W, h·H) and `fontOf` (a text field's face, size sizeRel·W,
 * ink and tracking; the leading padding cancels the trailing letter-space so a
 * centred run sits truly centred).
 */
export function useTicketGeometry(W: number): {
  H: number;
  place: (box: TicketBox) => Placed;
  fontOf: (field: TicketTextField) => TextStyle;
} {
  const face = useLtFace();
  const H = W / TICKET_ASPECT;
  return {
    H,
    place: (box) => ({
      position: "absolute",
      left: box.x * W,
      top: box.y * H,
      width: box.w * W,
      height: box.h * H,
    }),
    fontOf: (field) => {
      const tracking = field.letterSpacingRel * W;
      return {
        fontFamily: field.face === "myanmar" ? theme.font.bold : face(field.face),
        fontSize: field.sizeRel * W,
        color: field.color,
        letterSpacing: tracking,
        paddingLeft: tracking,
      };
    },
  };
}

/**
 * The paper under the layers. The frame: the one the draw was sold with
 * (`frameUrl`, copied into the draw when it was created, so a ticket never
 * changes its look; expo-image, cached), else the built-in frame — for a
 * sample draw, a real draw with none, or a frame that will not load. Every
 * frame follows the same slot positions; only the background artwork differs.
 *
 * The draw's picture: the admin's upload (`pictureUrl`, expo-image, cached)
 * — nothing else (owner, 27 Oct 2026: the pictures we built the screens with
 * are no longer bundled). No upload, or one that will not load: the picture
 * slot stays empty paper. A remote image that fails is remembered per URL, so
 * it is not asked again.
 */
export function TicketPaper({ W, draw }: { W: number; draw: TicketDraw }) {
  const { place } = useTicketGeometry(W);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const remote = draw.pictureUrl && failedUrl !== draw.pictureUrl ? draw.pictureUrl : null;
  const [failedFrameUrl, setFailedFrameUrl] = useState<string | null>(null);
  const remoteFrame = draw.frameUrl && failedFrameUrl !== draw.frameUrl ? draw.frameUrl : null;
  return (
    <>
      {remoteFrame ? (
        // One size on the wire; expo-image decodes it down to the box, so a thumb costs no more than the bundled one.
        <Image
          source={{ uri: remoteFrame }}
          recyclingKey={remoteFrame}
          cachePolicy="memory-disk"
          onError={() => setFailedFrameUrl(remoteFrame)}
          style={StyleSheet.absoluteFill}
          contentFit="contain"
          accessible={false}
        />
      ) : (
        <Image
          source={W < SMALL_FRAME_BELOW ? LT_ART.frameThumb : LT_ART.frame}
          style={StyleSheet.absoluteFill}
          contentFit="contain"
          accessible={false}
        />
      )}
      {remote ? (
        <Image
          source={{ uri: remote }}
          recyclingKey={remote}
          cachePolicy="memory-disk"
          onError={() => setFailedUrl(remote)}
          style={place(THAI_TEMPLATE.picture)}
          contentFit="contain"
          accessible={false}
        />
      ) : null}
    </>
  );
}

/** The draw's own print, the same on every ticket of the draw: the Burmese and English dates, the draw number, the price. */
export function DrawPrint({ W, draw }: { W: number; draw: TicketDraw }) {
  const { place, fontOf } = useTicketGeometry(W);
  const fields = THAI_TEMPLATE.fields;
  return (
    <>
      <Field box={place(fields.dateMy)} text={dateMy(draw.dateIso)} style={fontOf(fields.dateMy)} />
      <Field box={place(fields.dateEn)} text={dateEn(draw.dateIso)} style={fontOf(fields.dateEn)} />
      <Field box={place(fields.drawNo)} text={String(draw.no)} style={fontOf(fields.drawNo)} />
      <Field box={place(fields.price)} text={group(draw.price)} style={fontOf(fields.price)} />
    </>
  );
}

/** The hollow stamped draw number, drawn LAST: the one allowed overlap (over the two dates). */
export function Overprint({ W, draw }: { W: number; draw: TicketDraw }) {
  const face = useLtFace();
  const { H, place } = useTicketGeometry(W);
  const ov = THAI_TEMPLATE.overprint;
  const ovSize = ov.sizeRel * W;
  return (
    <View style={[place(ov), { opacity: ov.opacity }]} pointerEvents="none">
      <Svg width={ov.w * W} height={ov.h * H}>
        <SvgText
          x={(ov.w * W) / 2}
          y={(ov.h * H) / 2 + 0.35 * ovSize}
          fontSize={ovSize}
          fontFamily={face(ov.face)}
          letterSpacing={ov.letterSpacingRel * W}
          textAnchor="middle"
          fill="none"
          stroke={ov.color}
          strokeWidth={Math.max(1, ov.strokeRel * W)}
        >
          {pad(draw.no, 2)}
        </SvgText>
      </Svg>
    </View>
  );
}

interface LayersProps {
  W: number;
  draw: TicketDraw;
  number: string;
  ticketId?: string;
  hideNumber: boolean;
  print?: TicketPrint;
}

/** Every layer, absolutely placed in a W × W/1.915 box. */
function TicketLayers({ W, draw, number, ticketId, hideNumber, print }: LayersProps) {
  const { H, place, fontOf } = useTicketGeometry(W);
  const art = useMemo(
    () => (ticketId ? ticketArt(draw.no, draw.dateIso, ticketId, number) : null),
    [draw.no, draw.dateIso, ticketId, number],
  );

  // Printed's reveal; without `print` both stay at 1 (fully printed).
  const one = useSharedValue(1);
  const layersValue = print?.layers ?? one;
  const barcodeValue = print?.barcode ?? one;
  const fields = THAI_TEMPLATE.fields;
  const barcodeWidth = THAI_TEMPLATE.barcode.w * W;
  const ownPrint = useAnimatedStyle(() => ({ opacity: layersValue.value }));
  const wipe = useAnimatedStyle(() => ({ width: barcodeWidth * barcodeValue.value }));

  const digits = hideNumber ? ["", "", "", "", "", ""] : number.split("");
  const words = digits.map((digit) => (digit ? DIGIT_WORDS[Number(digit)] : ""));

  return (
    <>
      <TicketPaper W={W} draw={draw} />

      <Animated.View style={[place(fields.number), styles.cells, ownPrint]}>
        <Cells values={digits} style={fontOf(fields.number)} />
      </Animated.View>
      <Animated.View style={[place(fields.digitWords), styles.cells, ownPrint]}>
        <Cells values={words} style={fontOf(fields.digitWords)} />
      </Animated.View>

      <DrawPrint W={W} draw={draw} />

      {art && ticketId ? (
        <>
          <Animated.View style={[place(fields.ticketId), styles.field, styles.right, ownPrint]}>
            <PrintedText text={ticketId} style={fontOf(fields.ticketId)} />
          </Animated.View>
          {/* The wipe: a clip that opens left to right over the full-width bars. */}
          <View style={place(THAI_TEMPLATE.barcode)}>
            <Animated.View style={[styles.wipe, wipe]}>
              <Barcode d={art.bars.d} viewWidth={art.bars.width} width={barcodeWidth} height={THAI_TEMPLATE.barcode.h * H} />
            </Animated.View>
          </View>
          <Animated.View style={[place(fields.barcodeText), styles.field, ownPrint]}>
            <PrintedText text={art.code} style={fontOf(fields.barcodeText)} />
          </Animated.View>
          <Animated.View style={[place(THAI_TEMPLATE.qr), styles.qr, ownPrint]}>
            <QrCode d={art.qr} size={THAI_TEMPLATE.qr.w * W} />
          </Animated.View>
        </>
      ) : null}

      <Overprint W={W} draw={draw} />
    </>
  );
}

/** One printed run, never wrapped, never scaled by the OS text size. */
export function PrintedText({ text, style }: { text: string; style: StyleProp<TextStyle> }) {
  return (
    <Text style={[styles.printed, style]} numberOfLines={1} ellipsizeMode="clip" allowFontScaling={false}>
      {text}
    </Text>
  );
}

/** One text field in its box, centred (or, the ticket ID, right-aligned). */
export function Field({
  box,
  text,
  style,
  align = "center",
}: {
  box: Placed;
  text: string;
  style: StyleProp<TextStyle>;
  align?: "center" | "right";
}) {
  return (
    <View style={[box, styles.field, align === "right" && styles.right]}>
      <PrintedText text={text} style={style} />
    </View>
  );
}

/** Six equal columns, one value centred in each (number and its words share them, so each word sits under its digit). */
function Cells({ values, style }: { values: string[]; style: TextStyle }) {
  return (
    <>
      {values.map((value, i) => (
        <View key={i} style={styles.cell}>
          <PrintedText text={value} style={style} />
        </View>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  box: { ...TICKET_BOX },
  fullShadow: { boxShadow: LT_SHADOW.ticket },
  thumbShadow: { boxShadow: LT_SHADOW.thumb },
  field: { flexDirection: "row", alignItems: "center", justifyContent: "center" },
  right: { justifyContent: "flex-end" },
  cells: { flexDirection: "row" },
  cell: { flex: 1, minWidth: 0, alignItems: "center", justifyContent: "center" },
  wipe: { height: "100%", overflow: "hidden" },
  qr: { backgroundColor: TICKET_INK.qrPaper },
  /** Android: no extra font padding, so the ascent + descent box is what gets centred (iOS has none to remove). */
  printed: { includeFontPadding: false },
});
