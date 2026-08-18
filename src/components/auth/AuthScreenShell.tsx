import type { ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { AuroraBackdrop } from "@/components/common/AuroraBackdrop";
import { FadeInView } from "@/components/ui/FadeInView";
import { ThemedText } from "@/components/ui/ThemedText";
import { useLanguage } from "@/localization/LanguageProvider";
import { theme } from "@/theme";

interface Props {
  children: ReactNode;
}

/**
 * The cinematic shell every auth screen sits in: an aurora-washed artwork
 * panel (an abstract marquee of poster tiles, drawn purely from gradients so
 * it ships no assets and costs nothing to render), the crimson wordmark, and
 * a keyboard-aware scroller holding the focused form card underneath.
 *
 * Purely presentational — it owns no auth state and calls no service.
 */
export function AuthScreenShell({ children }: Props) {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const panelHeight = Math.round(Math.max(216, Math.min(300, height * 0.32)));

  return (
    <View style={styles.root}>
      <AuroraBackdrop tone="violet" height={panelHeight + 120} intensity={0.95} />

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: insets.top, paddingBottom: insets.bottom + theme.spacing.xl },
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          <FadeInView duration={420}>
            <AuthArtwork height={panelHeight} />
          </FadeInView>

          <View style={styles.body}>{children}</View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

/** The focused panel the form lives in — one shared surface across all three auth screens. */
export function AuthCard({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <FadeInView from="bottom" duration={380} delay={80}>
      <View style={[styles.card, style]}>{children}</View>
    </FadeInView>
  );
}

/* ------------------------------------------------------------------ */

interface TileSpec {
  colors: readonly [string, string];
  rotate: string;
  translateY: number;
  scale: number;
}

const { aurora } = theme.colors;

/** Five overlapping "posters" fanned out like a cinema marquee. */
const TILES: readonly TileSpec[] = [
  { colors: [aurora.violet, aurora.indigo], rotate: "-10deg", translateY: 18, scale: 0.84 },
  { colors: [aurora.indigo, aurora.emerald], rotate: "-5deg", translateY: 6, scale: 0.93 },
  { colors: [aurora.crimson, aurora.violet], rotate: "0deg", translateY: -6, scale: 1 },
  { colors: [aurora.gold, aurora.crimson], rotate: "5deg", translateY: 6, scale: 0.93 },
  { colors: [aurora.violet, aurora.gold], rotate: "10deg", translateY: 18, scale: 0.84 },
];

const TILE_WIDTH = 72;

function AuthArtwork({ height }: { height: number }) {
  const { t } = useLanguage();

  return (
    <View style={[styles.artwork, { height }]} pointerEvents="none">
      <View style={styles.tileRow}>
        {TILES.map((tile, index) => {
          const width = Math.round(TILE_WIDTH * tile.scale);
          return (
            <View
              key={index}
              style={[
                styles.tileShadow,
                {
                  transform: [{ rotate: tile.rotate }, { translateY: tile.translateY }],
                  zIndex: 10 - Math.abs(index - 2),
                },
              ]}
            >
              <View style={[styles.tile, { width, height: Math.round(width * 1.5) }]}>
                <LinearGradient
                  colors={tile.colors}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                <LinearGradient
                  colors={["transparent", theme.colors.scrim]}
                  locations={[0.45, 1]}
                  style={StyleSheet.absoluteFill}
                />
                <View style={styles.tileMeta}>
                  <View style={styles.tileBar} />
                  <View style={[styles.tileBar, styles.tileBarShort]} />
                </View>
              </View>
            </View>
          );
        })}
      </View>

      <LinearGradient
        colors={["transparent", theme.colors.background]}
        locations={[0.25, 1]}
        style={styles.artworkFade}
      />

      <View style={styles.wordmark}>
        <View style={styles.mark}>
          <Ionicons name="play" size={15} color={theme.colors.brand} style={styles.markGlyph} />
        </View>
        {/* Crimson is reserved for the wordmark alone — never for actions. */}
        <ThemedText variant="display" weight="bold" color={theme.colors.brand} style={styles.wordmarkText}>
          {t.common.appName}
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  body: { paddingHorizontal: theme.layout.screenPadding },

  /* ---- artwork panel ---- */
  artwork: { overflow: "hidden", justifyContent: "flex-start" },
  tileRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingTop: theme.spacing.sm,
  },
  tileShadow: { marginHorizontal: -7, ...theme.shadow.lg },
  tile: {
    borderRadius: theme.radius.md,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: theme.colors.ring,
    backgroundColor: theme.colors.surface,
    justifyContent: "flex-end",
  },
  tileMeta: { padding: 7, gap: 4 },
  tileBar: {
    height: 3,
    width: "72%",
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.text + "6B",
  },
  tileBarShort: { width: "44%", backgroundColor: theme.colors.text + "38" },
  artworkFade: { position: "absolute", left: 0, right: 0, bottom: 0, height: "62%" },
  wordmark: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: theme.spacing.xl,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.sm + 2,
  },
  mark: {
    width: 34,
    height: 34,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.brandSoft,
    borderWidth: 1,
    borderColor: theme.colors.brand + "59",
    alignItems: "center",
    justifyContent: "center",
  },
  markGlyph: { marginLeft: 2 },
  wordmarkText: { letterSpacing: -0.6 },

  /* ---- form card ---- */
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius["3xl"],
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
    ...theme.shadow.lg,
  },
});
