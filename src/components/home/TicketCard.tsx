import { useState, type ReactNode } from "react";
import { StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from "react-native";
import { GlassCard } from "@/components/ui/GlassCard";
import { theme } from "@/theme";

interface Props {
  /** The offer itself — badge, headline, body. */
  children: ReactNode;
  /** The torn-off half: the money line and its single action. */
  stub: ReactNode;
  /**
   * What the punched notches are filled with. Must match whatever the ticket is
   * sitting on, or the punch reads as a floating dot — which is why a
   * TicketCard may never be placed inside EditorialWell's sunken band.
   */
  surroundColor?: string;
  /** Tablets tear the ticket along the other axis: body left, stub right. */
  orientation?: "horizontal" | "vertical";
  /**
   * The frame's role colour. Gold by default because a ticket is normally an
   * offer — pass something else when the contents stop being one, rather than
   * leaving gold around a block with nothing premium in it.
   */
  tint?: string;
  style?: StyleProp<ViewStyle>;
}

/** Notch diameter — half of it hangs outside each edge of the card. */
const NOTCH = 16;
/** Generous enough to span the widest clamped ticket; the row clips the rest. */
const DASH_COUNT = 72;
const DASH_LENGTH = 6;
const DASH_GAP = 5;

/**
 * The page's signature object: a perforated gold ticket. Used EXACTLY TWICE —
 * the offer near the top and the close at the bottom. Scarcity is the whole
 * point; a third one would make it wallpaper.
 *
 * The perforation is drawn as an explicit run of dashes rather than
 * `borderStyle: "dashed"`, which renders inconsistently at 1pt on Android. Same
 * look, no platform lottery.
 */
export function TicketCard({
  children,
  stub,
  surroundColor = theme.colors.background,
  orientation = "horizontal",
  tint = theme.colors.premium,
  style,
}: Props) {
  const vertical = orientation === "vertical";
  /** Offset of the perforation inside the card, measured once at layout. */
  const [seam, setSeam] = useState<number | null>(null);

  const onSeamLayout = (event: LayoutChangeEvent) => {
    const { x, y } = event.nativeEvent.layout;
    setSeam(vertical ? x : y);
  };

  const notchStyle = {
    width: NOTCH,
    height: NOTCH,
    borderRadius: NOTCH / 2,
    backgroundColor: surroundColor,
    borderWidth: 1,
    borderColor: theme.colors.ring,
  };

  return (
    <View style={[styles.wrapper, style]}>
      <GlassCard intensity={40} tint={tint} padded={false} style={styles.card}>
        <View style={vertical ? styles.rowLayout : styles.columnLayout}>
          <View style={[styles.section, vertical && styles.sectionFlex]}>{children}</View>

          <View
            onLayout={onSeamLayout}
            style={vertical ? styles.seamVertical : styles.seamHorizontal}
            pointerEvents="none"
          >
            {Array.from({ length: DASH_COUNT }).map((_, index) => (
              <View key={index} style={vertical ? styles.dashVertical : styles.dashHorizontal} />
            ))}
          </View>

          <View style={[styles.section, vertical && styles.sectionFlex]}>{stub}</View>
        </View>
      </GlassCard>

      {seam !== null &&
        (vertical ? (
          <>
            <View style={[styles.notch, notchStyle, { left: seam - NOTCH / 2, top: -NOTCH / 2 }]} pointerEvents="none" />
            <View
              style={[styles.notch, notchStyle, { left: seam - NOTCH / 2, bottom: -NOTCH / 2 }]}
              pointerEvents="none"
            />
          </>
        ) : (
          <>
            <View style={[styles.notch, notchStyle, { top: seam - NOTCH / 2, left: -NOTCH / 2 }]} pointerEvents="none" />
            <View
              style={[styles.notch, notchStyle, { top: seam - NOTCH / 2, right: -NOTCH / 2 }]}
              pointerEvents="none"
            />
          </>
        ))}
    </View>
  );
}

const styles = StyleSheet.create({
  /** Never clips — the notches deliberately hang outside the card's edges. */
  wrapper: { position: "relative" },
  card: { borderRadius: theme.radius["2xl"], ...theme.shadow.md },
  columnLayout: { flexDirection: "column" },
  rowLayout: { flexDirection: "row", alignItems: "stretch" },
  section: { padding: theme.spacing.md, gap: theme.spacing.sm },
  sectionFlex: { flex: 1, justifyContent: "center" },
  seamHorizontal: {
    height: 1,
    flexDirection: "row",
    overflow: "hidden",
    marginHorizontal: 14,
  },
  seamVertical: {
    width: 1,
    flexDirection: "column",
    overflow: "hidden",
    marginVertical: 14,
  },
  dashHorizontal: {
    width: DASH_LENGTH,
    height: 1,
    marginRight: DASH_GAP,
    backgroundColor: theme.colors.borderStrong,
  },
  dashVertical: {
    height: DASH_LENGTH,
    width: 1,
    marginBottom: DASH_GAP,
    backgroundColor: theme.colors.borderStrong,
  },
  notch: { position: "absolute" },
});
