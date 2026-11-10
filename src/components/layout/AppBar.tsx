import type { ReactNode } from "react";
import { Pressable, StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useReducedMotion } from "react-native-reanimated";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import { ThemedText } from "@/components/ui/ThemedText";
import { GlassFace } from "@/components/layout/GlassFace";
import { useLanguage } from "@/localization/LanguageProvider";
import { theme, withAlpha } from "@/theme";

export type AppBarVariant = "large" | "compact" | "transparent";

interface Props {
  /** Large variant renders this under the control row; compact centres it in the row. */
  title?: string;
  subtitle?: string;
  /** Small uppercase line above a large title. */
  eyebrow?: string;
  onBack?: () => void;
  /** Spoken name of the back button. Defaults to the localized "Back". */
  backAccessibilityLabel?: string;
  /** Replaces the back button (e.g. the MyanFlix wordmark on root screens). */
  leading?: ReactNode;
  /** Right-hand controls. */
  trailing?: ReactNode;
  variant?: AppBarVariant;
  /** Extra row pinned below the bar — search fields, segmented controls, chips. */
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  /**
   * The bar's whole box (safe-area inset, control row and `children`). A
   * transparent bar is absolutely positioned, so a screen that lays content
   * under it can only learn how much it covers from here.
   */
  onLayout?: (event: LayoutChangeEvent) => void;
  /**
   * Transparent or floating bar only: its empty space lets touches through to
   * what is under it — only the controls (and whatever `children` draw) take
   * one — so a swipe that starts under the bar still turns a hero pager or
   * scrolls the page. Off by default. The glass bars (GlassBar) keep it on at
   * every offset, as the Media root does.
   */
  touchThrough?: boolean;
  /**
   * Lays the bar OVER the page instead of in the layout flow, in its own
   * posture (`compact` or `large`): absolutely positioned, clear, zIndex 1 —
   * so the page scrolls up under it and the scroll-edge fade
   * (components/layout/GlassBar) comes in behind it. The screen pads its
   * content down by the bar's measured height (`onLayout`). No scrim: the
   * `transparent` bar's hangs below the bar to keep a hero's art legible, but
   * on a page's ground it would only dim the first rows (and the Profile
   * glow) at rest — the glass buttons and the fade are what carry a floating
   * bar. Ignored with `transparent`.
   */
  floating?: boolean;
}

/**
 * The top scrim behind a transparent bar (MovieDetail.dc.html: the ground at
 * 70% fading to clear). It is held at full strength across the safe-area inset
 * — the board has no status bar — so the fade starts where the controls do
 * and does not spend itself behind the clock. The fade then runs 96pt below
 * the inset, which puts ~48% behind the 44pt control row (the board: ~55%).
 * Shorter than the board's 140pt on purpose: there the scrim belongs to the
 * hero and scrolls away with it; this bar stays pinned over the page, so a
 * long tail would dim body text scrolled up under it.
 */
const SCRIM_ALPHA = 0.7;
const SCRIM_FADE = 96;
const TOP_SCRIM = [
  withAlpha(theme.colors.background, SCRIM_ALPHA),
  withAlpha(theme.colors.background, SCRIM_ALPHA),
  withAlpha(theme.colors.background, 0),
] as const;

/**
 * The ONE app-bar system. Every screen header in the app is this component —
 * `large` for tab roots, `compact` for pushed screens, `transparent` for
 * cinematic screens whose artwork runs under the status bar. Do not introduce
 * a second header primitive. `floating` lays a compact or large bar over a
 * page that scrolls under it; with GlassBarBackground behind it, every bar
 * gets the same scroll-edge fade (components/layout/GlassBar).
 *
 * Liquid Glass (owner, 2026-11-10; canvas page "Top bar"): the bar itself is
 * clear — no band, no fill — and every control in it is its own glass button
 * (AppBarAction: a 44pt glass circle). The 44pt control row sits 8pt under
 * the top inset with its controls 16pt in from the sides and 8pt apart. A
 * centred 17/24 extra-bold title on pushed screens and a 34pt black page
 * title under the row on large ones stay plain text. Over art the bar keeps
 * a soft top scrim.
 */
export function AppBar({
  title,
  subtitle,
  eyebrow,
  onBack,
  backAccessibilityLabel,
  leading,
  trailing,
  variant = "compact",
  children,
  style,
  onLayout,
  touchThrough = false,
  floating = false,
}: Props) {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const transparent = variant === "transparent";
  const large = variant === "large";
  /** Laid over the page (a hero, or a page that scrolls under the glass) rather than in the layout flow. */
  const overlaid = transparent || floating;

  // See `touchThrough`: every box of the bar's own layout steps aside, so a
  // touch only stops on a control. A solid bar is in the layout flow, with
  // nothing under it, so it never needs this.
  const passThrough = overlaid && touchThrough ? "box-none" : "auto";

  const compactTitle = !large && !!title;

  const content = (
    <SafeAreaView
      edges={["top"]}
      style={overlaid ? styles.transparentSafeArea : undefined}
      pointerEvents={passThrough}
    >
      <View style={styles.row} pointerEvents={passThrough}>
        <View style={styles.side} pointerEvents={passThrough}>
          {leading ??
            (onBack ? (
              <AppBarAction
                icon="chevron-back"
                onPress={onBack}
                accessibilityLabel={backAccessibilityLabel ?? t.common.back}
              />
            ) : null)}
        </View>

        {compactTitle ? (
          <ThemedText weight="extrabold" numberOfLines={1} accessibilityRole="header" style={styles.compactTitle}>
            {title}
          </ThemedText>
        ) : (
          <View style={styles.titleSpacer} pointerEvents={passThrough} />
        )}

        <View style={[styles.side, styles.sideRight]} pointerEvents={passThrough}>
          {trailing}
        </View>
      </View>

      {large && (title || subtitle || eyebrow) && (
        <View style={styles.largeBlock} pointerEvents={passThrough}>
          {eyebrow && <ThemedText variant="overline">{eyebrow.toUpperCase()}</ThemedText>}
          {title && (
            <ThemedText variant="display" numberOfLines={2} accessibilityRole="header">
              {title}
            </ThemedText>
          )}
          {subtitle && (
            <ThemedText variant="caption" numberOfLines={2}>
              {subtitle}
            </ThemedText>
          )}
        </View>
      )}

      {children}
    </SafeAreaView>
  );

  if (overlaid) {
    const scrimHeight = insets.top + SCRIM_FADE;
    return (
      <View style={[styles.transparentContainer, style]} onLayout={onLayout} pointerEvents={passThrough}>
        {/* Over a hero only: taller than the bar on purpose — it hangs below it
            over the art. A floating bar has none (see `floating`). */}
        {transparent ? (
          <LinearGradient
            colors={TOP_SCRIM}
            locations={[0, insets.top / scrimHeight, 1]}
            style={[styles.scrim, { height: scrimHeight }]}
            pointerEvents="none"
          />
        ) : null}
        {content}
      </View>
    );
  }

  return (
    <View style={[styles.solidContainer, style]} onLayout={onLayout}>
      {content}
    </View>
  );
}

interface ActionProps {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  accessibilityLabel?: string;
  /**
   * Accepted and ignored since the Liquid Glass top bars (2026-11-10): the
   * glass circle reads the same over art and over the ground, so there is no
   * separate "over art" disc any more. Kept so older callers still compile.
   */
  overlay?: boolean;
  /**
   * Accepted and ignored since 2026-11-10: every top-bar control is a glass
   * circle now, the root bar's bell included (the "Top bar" board), so there
   * is no bare glyph any more. Kept so older callers still compile.
   */
  bare?: boolean;
  /** Unread / attention dot. */
  badge?: boolean;
  color?: string;
  /**
   * The control names the page already on screen (the search button on the
   * search screen): spoken as selected, and drawn as the PICKED glass — tinted
   * red, the board's rule for "this is the one you are on".
   */
  selected?: boolean;
}

/** The glass circle IS the 44pt touch target: fully round. */
const ACTION_RADIUS = theme.layout.minTouch / 2;

/**
 * The 44pt round control used in every app bar — back, search, the bell,
 * share. A 44pt Liquid Glass circle (GlassFace) with a 22pt glyph; pressed, it
 * shrinks to 96% (Reduce Motion: it stays put and lights up instead).
 * Pressed never dims it: an iOS blur under a parent with alpha < 1 renders
 * broken.
 */
export function AppBarAction({ icon, onPress, accessibilityLabel, badge, color, selected }: ActionProps) {
  const reduceMotion = useReducedMotion();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.action, pressed && !reduceMotion && styles.actionPressed]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={selected === undefined ? undefined : { selected }}
    >
      {({ pressed }) => (
        <>
          <GlassFace radius={ACTION_RADIUS} picked={selected} pressed={reduceMotion && pressed} />
          <Ionicons name={icon} size={22} color={color ?? theme.colors.text} />
          {badge && <View style={styles.badge} />}
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  solidContainer: { backgroundColor: theme.colors.background },
  transparentContainer: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 1 },
  transparentSafeArea: { backgroundColor: "transparent" },
  scrim: { position: "absolute", top: 0, left: 0, right: 0 },
  /** The "Top bar" board: controls 16pt in from the sides, the row 8pt under the inset. */
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.xs,
    paddingHorizontal: theme.layout.screenPadding,
    paddingTop: theme.spacing.sm,
    minHeight: theme.spacing.sm + theme.layout.minTouch,
  },
  /** 8pt between neighbouring 44pt glass circles (the board's "8pt apart"). */
  side: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm, minWidth: theme.layout.minTouch },
  sideRight: { justifyContent: "flex-end" },
  /** Design: 17/24, weight 800, centred between the two 44pt sides. */
  compactTitle: { flex: 1, textAlign: "center", fontSize: 17 },
  titleSpacer: { flex: 1 },
  largeBlock: {
    paddingHorizontal: theme.layout.screenPadding,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.sm,
    gap: 2,
  },
  action: {
    width: theme.layout.minTouch,
    height: theme.layout.minTouch,
    alignItems: "center",
    justifyContent: "center",
  },
  actionPressed: { transform: [{ scale: 0.96 }] },
  /**
   * The board: an 8pt crimson dot at top 10 / right 11, with a 2pt ring OUTSIDE
   * it in the solid glass colour (`box-shadow: 0 0 0 2px #1A1A20`), so it
   * stands clear of the glyph. A spread-only outset shadow is that ring.
   */
  badge: {
    position: "absolute",
    top: 10,
    right: 11,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.primary,
    boxShadow: "0 0 0 2px #1A1A20",
  },
});
