import type { ReactNode } from "react";
import { Pressable, StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { useReducedMotion } from "react-native-reanimated";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import { ThemedText } from "@/components/ui/ThemedText";
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
   * posture (`compact` or `large`) and with its ground controls: absolutely
   * positioned, clear, zIndex 1 — so the page scrolls up under it and the
   * frosted glass (components/layout/GlassBar) fades in behind it. The screen
   * pads its content down by the bar's measured height (`onLayout`). No
   * scrim: the `transparent` bar's hangs below the bar to keep a hero's art
   * legible, but on a page's ground it would only dim the first rows (and
   * the Profile glow) at rest — the glass is what carries a floating bar.
   * Ignored with `transparent`.
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
 * gets the same frosted glass (components/layout/GlassBar).
 *
 * Marquee: a 44pt control row (8pt from the top and sides), a centred 17/24
 * extra-bold title on pushed screens, and a 34pt black page title under the
 * row on large ones. Over art the bar is clear with a soft top scrim.
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
                overlay={transparent}
              />
            ) : null)}
        </View>

        {!large && title ? (
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
  /** Over artwork: a blurred dark disc so the control stays legible on any image. */
  overlay?: boolean;
  /**
   * No disc at all — the bare 44pt glyph (the bell beside the avatar on a root
   * bar). Wins over `overlay`: the root bar's bell stays bare even over a hero
   * (Main.dc.html, Wallet.dc.html), legible on the bar's own top scrim. Back
   * buttons on art pass `overlay` alone and keep their dark disc.
   */
  bare?: boolean;
  /** Unread / attention dot. */
  badge?: boolean;
  color?: string;
  /**
   * The control names the page already on screen (the search button on the
   * search screen): spoken as selected, its ground disc a step brighter.
   */
  selected?: boolean;
}

/** Marquee: the visible disc is 40pt inside the 44pt target. */
const DISC = 40;

/**
 * The 44pt round control used in every app bar — back, notifications, filters.
 * On the ground it is a 40pt white-at-8% disc; over art (`overlay`) a 40pt
 * dark-glass disc under a blur; `bare` drops the disc in either case.
 */
export function AppBarAction({ icon, onPress, accessibilityLabel, overlay, bare, badge, color, selected }: ActionProps) {
  const reduceMotion = useReducedMotion();
  const showDisc = !bare;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.action, pressed && (reduceMotion ? styles.actionPressedStill : styles.actionPressed)]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={selected === undefined ? undefined : { selected }}
    >
      {showDisc && (
        <View
          style={[styles.disc, overlay ? styles.discOverlay : selected ? styles.discSelected : styles.discGround]}
          pointerEvents="none"
        >
          {overlay && (
            <>
              <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
              <View style={[StyleSheet.absoluteFill, styles.discOverlayFill]} />
            </>
          )}
        </View>
      )}
      <Ionicons name={icon} size={22} color={color ?? theme.colors.text} />
      {badge && <View style={styles.badge} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  solidContainer: { backgroundColor: theme.colors.background },
  transparentContainer: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 1 },
  transparentSafeArea: { backgroundColor: "transparent" },
  scrim: { position: "absolute", top: 0, left: 0, right: 0 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
    paddingTop: theme.spacing.sm,
    minHeight: theme.spacing.sm + theme.layout.minTouch,
  },
  /** 4pt between neighbouring 44pt targets, so two 40pt discs never touch. */
  side: { flexDirection: "row", alignItems: "center", gap: theme.spacing.xs, minWidth: theme.layout.minTouch },
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
  disc: {
    position: "absolute",
    width: DISC,
    height: DISC,
    borderRadius: DISC / 2,
    overflow: "hidden",
  },
  discGround: { backgroundColor: theme.colors.tonalSoft },
  discSelected: { backgroundColor: theme.colors.tonal },
  discOverlay: { backgroundColor: "transparent" },
  discOverlayFill: { backgroundColor: theme.colors.onArt },
  actionPressed: { transform: [{ scale: 0.96 }], opacity: 0.85 },
  actionPressedStill: { opacity: 0.6 },
  /** Design: 8pt crimson dot at top 10 / right 11, ringed in the ground colour. */
  badge: {
    position: "absolute",
    top: 10,
    right: 11,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.primary,
    borderWidth: 2,
    borderColor: theme.colors.background,
  },
});
