import { useCallback, useState, type ReactNode } from "react";
import { StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from "react-native";
import { ThemedText } from "@/components/ui/ThemedText";
import { theme, withAlpha } from "@/theme";

interface Props {
  /** The row's name: 17/24 extra-bold, spoken as a header, centred as described below. */
  title: string;
  /** The left column, at the row's left edge. */
  leading?: ReactNode;
  /** The right column, at the row's right edge. */
  trailing?: ReactNode;
  /**
   * Over a page (a hero): the row's empty space lets touches through to what
   * is under it — only the two columns' controls take one. See AppBar's
   * `touchThrough`.
   */
  touchThrough?: boolean;
  /** The row's margin, for the bar that hosts it. */
  style?: StyleProp<ViewStyle>;
}

/** The row's own inset (the boards' 16) and the gap it keeps between a column and the title. */
const ROW_SIDE_PADDING = theme.layout.screenPadding;
const ROW_GAP = theme.spacing.xs;

/**
 * A 44pt row in three columns — a left control, a title, a right control —
 * with the title centred on the SCREEN rather than between the two columns
 * (the boards' `1fr auto 1fr` grid): the Media section page's "‹ Media |
 * Movies | Categories ▾" row (Main.dc.html, 2026-10-22), hosted under the
 * root bar as AppTopBar's `children`.
 *
 * Two columns of different widths — a "‹ Media" chip against a results view's
 * "✕ · Drama ▾" — would pull a flex-centred title off-centre, so the columns
 * are measured and the title is laid at the row's centre, capped to the room
 * they leave, so it never runs under either. When the title is wider than
 * that room (Burmese section names on a 360dp phone) it is centred between
 * the two columns instead — a little off the screen's centre, but whole — and
 * ellipsizes only when even that lane cannot hold it. Its natural width is
 * measured by an invisible off-flow copy (TabBar's DockItem recipe); nothing
 * is known until the first layout, so the first frame has no cap at all.
 * (This was AppBar's `centerTitle` until 2026-10-22.)
 */
export function CenteredTitleRow({ title, leading, trailing, touchThrough = false, style }: Props) {
  const passThrough = touchThrough ? "box-none" : "auto";

  /** The row's and the two columns' widths — set once per layout; an unchanged width sets nothing. */
  const [rowWidth, setRowWidth] = useState(0);
  const [sideWidths, setSideWidths] = useState({ left: 0, right: 0 });
  const onRowLayout = useCallback((event: LayoutChangeEvent) => {
    const width = Math.round(event.nativeEvent.layout.width);
    setRowWidth((current) => (current === width ? current : width));
  }, []);
  const onLeftLayout = useCallback((event: LayoutChangeEvent) => {
    const width = Math.round(event.nativeEvent.layout.width);
    setSideWidths((current) => (current.left === width ? current : { ...current, left: width }));
  }, []);
  const onRightLayout = useCallback((event: LayoutChangeEvent) => {
    const width = Math.round(event.nativeEvent.layout.width);
    setSideWidths((current) => (current.right === width ? current : { ...current, right: width }));
  }, []);
  /** The title's natural one-line width, measured off-flow — 0 until the first layout. */
  const [naturalTitleWidth, setNaturalTitleWidth] = useState(0);
  const onTitleMeasure = useCallback((event: LayoutChangeEvent) => {
    const width = Math.ceil(event.nativeEvent.layout.width);
    setNaturalTitleWidth((current) => (current === width ? current : width));
  }, []);

  /**
   * Where the title may go. Each column's lane is the column itself plus the
   * row's padding and gap. `symmetricWidth` is the widest the title can be
   * while centred on the SCREEN without running under the wider column (both
   * halves kept clear). A title that fits takes that; one that does not is
   * centred between the two lanes instead, whole, and ellipsizes only when
   * even that is too narrow.
   */
  const laneLeft = sideWidths.left + ROW_SIDE_PADDING + ROW_GAP;
  const laneRight = sideWidths.right + ROW_SIDE_PADDING + ROW_GAP;
  const symmetricWidth = Math.max(0, rowWidth - 2 * Math.max(laneLeft, laneRight));
  const measured = rowWidth > 0 && naturalTitleWidth > 0;
  const onScreenCentre = !measured || naturalTitleWidth <= symmetricWidth;
  const titleLane = measured && !onScreenCentre ? { left: laneLeft, right: laneRight } : undefined;
  const titleMaxWidth = !measured
    ? undefined
    : onScreenCentre
      ? symmetricWidth
      : Math.max(0, rowWidth - laneLeft - laneRight);

  return (
    <View style={[styles.row, style]} pointerEvents={passThrough} onLayout={onRowLayout}>
      <View style={styles.side} pointerEvents={passThrough} onLayout={onLeftLayout}>
        {leading}
      </View>
      <View style={styles.spacer} pointerEvents={passThrough} />
      <View style={[styles.side, styles.sideRight]} pointerEvents={passThrough} onLayout={onRightLayout}>
        {trailing}
      </View>

      {/* The title: over the row at its true centre (or, when that room is too
          small, between the two columns), never a touch target, capped so it
          ellipsizes before it reaches a column. */}
      <View style={[styles.titleBox, titleLane]} pointerEvents="none">
        {/* The measuring copy: invisible, outside the flow and inside a box far
            wider than any title, so onLayout reports its natural width rather
            than the capped one. */}
        <View
          style={styles.titleMeasure}
          pointerEvents="none"
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
        >
          <ThemedText weight="extrabold" numberOfLines={1} style={styles.title} onLayout={onTitleMeasure}>
            {title}
          </ThemedText>
        </View>
        <ThemedText
          weight="extrabold"
          numberOfLines={1}
          accessibilityRole="header"
          style={[styles.title, { maxWidth: titleMaxWidth }]}
        >
          {title}
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  /** The boards: 44pt, 16pt from the sides; at 2× text a column grows the row rather than clipping. */
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: ROW_GAP,
    paddingHorizontal: ROW_SIDE_PADDING,
    minHeight: theme.layout.minTouch,
  },
  /** A column is at least one 44pt target wide; 4pt between neighbouring targets. */
  side: { flexDirection: "row", alignItems: "center", gap: theme.spacing.xs, minWidth: theme.layout.minTouch },
  /** The right column gives way first (its rail then scrolls — MediaCategoriesRow), never the left. */
  sideRight: { justifyContent: "flex-end", flexShrink: 1 },
  spacer: { flex: 1 },
  /** The title's own lane over the whole row, as tall as the row. */
  titleBox: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  /**
   * Marquee: 17/24, weight 800, with the boards' soft shadow (`text-shadow:
   * 0 1px 10px rgba(8,8,11,0.7)`) so it stays legible over a bright hero
   * frame. A shadow is not part of layout, so the measuring copy's width is
   * unchanged.
   */
  title: {
    fontSize: 17,
    textAlign: "center",
    textShadowColor: withAlpha(theme.colors.background, 0.7),
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 10,
  },
  /** The off-flow copy that measures the title (see `onTitleMeasure`). */
  titleMeasure: { position: "absolute", left: 0, top: 0, width: 600, flexDirection: "row", opacity: 0 },
});
