import type { ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import { Button } from "@/components/ui/Button";
import { FadeInView } from "@/components/ui/FadeInView";
import { ThemedText } from "@/components/ui/ThemedText";
import { theme, withAlpha } from "@/theme";

/**
 * The page-level empty / error block the library boards draw (Favorites,
 * WatchHistory, Notifications, Downloads): an illustration, a heading, an
 * optional line of body copy and an optional WHITE action. Rises in once
 * (a plain fade under reduce motion). Everything wraps — a Burmese heading at
 * font scale 2 grows the block, it never ellipsizes.
 */
export function StateBlock({
  art,
  title,
  size = "large",
  body,
  actionLabel,
  onAction,
  alert,
  style,
}: {
  art?: ReactNode;
  title: string;
  /** "large" = 24/30 (an empty page), "section" = 19/26 (an error, the bell's empty feed). */
  size?: "large" | "section";
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
  /** Announces itself (role alert) — the error variant. */
  alert?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <FadeInView from="bottom" style={[styles.block, style]}>
      <View style={styles.inner} accessibilityRole={alert ? "alert" : undefined} accessible={alert ? true : undefined}>
        {art}
        <ThemedText
          variant={size === "large" ? "title" : "section"}
          style={[styles.center, art ? (size === "large" ? styles.titleAfterArt : styles.sectionAfterArt) : null]}
        >
          {title}
        </ThemedText>
        {body ? (
          <ThemedText variant="body" color={theme.colors.textMuted} style={[styles.center, styles.body]}>
            {body}
          </ThemedText>
        ) : null}
        {actionLabel && onAction ? (
          <Button title={actionLabel} onPress={onAction} variant="play" style={styles.action} />
        ) : null}
      </View>
    </FadeInView>
  );
}

/** Empty page art: an 88pt #121217 disc with a faint 10pt halo and a muted glyph. */
export function HaloIcon({ icon }: { icon: keyof typeof Ionicons.glyphMap }) {
  return (
    <View style={styles.halo}>
      <View style={styles.haloDisc}>
        <Ionicons name={icon} size={36} color={theme.colors.textMuted} />
      </View>
    </View>
  );
}

/** Error art: a 64pt danger-tinted disc with the alert glyph. */
export function ErrorDisc() {
  return (
    <View style={styles.errorDisc}>
      <Ionicons name="alert-circle-outline" size={28} color={theme.colors.danger} />
    </View>
  );
}

/** The one "Something went wrong" page block — no Retry, as on today's screens. */
export function ErrorBlock({ message, style }: { message: string; style?: StyleProp<ViewStyle> }) {
  return <StateBlock art={<ErrorDisc />} title={message} size="section" alert style={style} />;
}

/** Favorites' empty art: two ghost posters fanned behind a raised one with a heart. */
export function PosterStackArt() {
  return (
    <View style={styles.stack}>
      <View style={[styles.ghostPoster, styles.ghostLeft]} />
      <View style={[styles.ghostPoster, styles.ghostRight]} />
      <View style={styles.frontPoster}>
        <Ionicons name="heart" size={26} color={theme.colors.link} />
      </View>
    </View>
  );
}

/** Downloads' placeholder art: two stacked screens and a muted cloud-offline disc. */
export function ScreenStackArt() {
  return (
    <View style={styles.screens}>
      <View style={styles.screenBack} />
      <View style={styles.screenFront} />
      <View style={styles.screenDisc}>
        <Ionicons name="cloud-offline-outline" size={26} color={theme.colors.textMuted} />
      </View>
    </View>
  );
}

const HALO_DISC = 88;
const HALO = 10;

const styles = StyleSheet.create({
  block: { alignItems: "stretch", paddingHorizontal: theme.spacing.xl },
  inner: { alignItems: "center" },
  center: { textAlign: "center" },
  titleAfterArt: { marginTop: theme.spacing.lg },
  sectionAfterArt: { marginTop: 18 },
  body: { marginTop: theme.spacing.sm, maxWidth: 340 },
  action: { marginTop: 22, alignSelf: "center" },
  halo: {
    width: HALO_DISC + HALO * 2,
    height: HALO_DISC + HALO * 2,
    borderRadius: (HALO_DISC + HALO * 2) / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: withAlpha(theme.colors.text, 0.03),
    marginVertical: -HALO,
  },
  haloDisc: {
    width: HALO_DISC,
    height: HALO_DISC,
    borderRadius: HALO_DISC / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.surface,
  },
  errorDisc: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: withAlpha(theme.colors.danger, 0.12),
  },
  stack: { width: 168, height: 128 },
  ghostPoster: {
    position: "absolute",
    top: 18,
    width: 64,
    height: 96,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: theme.colors.ring,
    backgroundColor: withAlpha(theme.colors.text, 0.04),
  },
  ghostLeft: { left: 10, transform: [{ rotate: "-10deg" }] },
  ghostRight: { right: 10, transform: [{ rotate: "10deg" }] },
  frontPoster: {
    position: "absolute",
    left: 50,
    top: 4,
    width: 68,
    height: 102,
    borderRadius: 9,
    backgroundColor: theme.colors.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
    ...theme.shadow.lg,
  },
  screens: { width: 240, height: 150 },
  screenBack: {
    position: "absolute",
    left: 40,
    top: 0,
    width: 160,
    height: 90,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    backgroundColor: withAlpha(theme.colors.text, 0.03),
  },
  screenFront: {
    position: "absolute",
    left: 20,
    top: 22,
    width: 200,
    height: 112,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: theme.colors.ring,
    backgroundColor: theme.colors.surface,
    ...theme.shadow.lg,
  },
  screenDisc: {
    position: "absolute",
    left: 92,
    top: 50,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.tonalSoft,
  },
});
