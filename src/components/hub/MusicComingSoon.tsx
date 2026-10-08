import { memo, useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { useAnimatedRef, useScrollOffset, type SharedValue } from "react-native-reanimated";
import Svg, { Circle, Path } from "react-native-svg";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import { FadeInView } from "@/components/ui/FadeInView";
import { ThemedText } from "@/components/ui/ThemedText";
import { HUB_TOP_GAP, useHubChromeHeight, useHubHeroMinHeight } from "@/components/hub/hubLayout";
import { useDockClearance } from "@/hooks/useDockClearance";
import { useLanguage } from "@/localization/LanguageProvider";
import { theme, withAlpha } from "@/theme";

interface Props {
  /** Driven by this page's own scroll — the Media screen fades its bar in from it, as it does for the hubs. */
  scrollY: SharedValue<number>;
}

/**
 * The MediaMusic board's scene — a night sky, a sun drawn as a record, a hill
 * and an equaliser skyline — on the hero's 390 × 640 stage. Decorative
 * artwork data, like HubFallbackArt's palettes: not UI colour, so it lives
 * here rather than in the theme.
 */
const ART = {
  sky: "#170F26",
  sun: "#F07A5A",
  hill: "#2A1C40",
  skyline: "#0C0714",
} as const;
const HILL_PATH = "M0 430 C100 400 200 418 300 390 C340 380 370 384 390 380 V640 H0 Z";
const SKYLINE_PATH =
  "M0 640 V560 H0 V498 H12 V560 H15 V520 H27 V560 H30 V464 H42 V560 H45 V502 H57 V560 H60 V440 H72 V560 H75 V476 H87 V560 H90 V508 H102 V560 H105 V490 H117 V560 H120 V428 H132 V560 H135 V470 H147 V560 H150 V500 H162 V560 H165 V456 H177 V560 H180 V486 H192 V560 H195 V512 H207 V560 H210 V472 H222 V560 H225 V444 H237 V560 H240 V494 H252 V560 H255 V506 H267 V560 H270 V462 H282 V560 H285 V488 H297 V560 H300 V516 H312 V560 H315 V480 H327 V560 H330 V450 H342 V560 H345 V498 H357 V560 H360 V510 H372 V560 H375 V484 H387 V560 H390 V640 Z";

/** The boards' scrims: the ground at 78% fading to clear at the top, clear → 82% → solid at the foot. */
const TOP_SCRIM = [withAlpha(theme.colors.background, 0.78), withAlpha(theme.colors.background, 0)] as const;
const FOOT_SCRIM = [
  withAlpha(theme.colors.background, 0),
  withAlpha(theme.colors.background, 0.82),
  theme.colors.background,
] as const;
/** Below the pinned chrome, the top scrim runs on this far (the board's chips end at 104 of its 180). */
const TOP_SCRIM_TAIL = 76;
/** The board's 56pt glass disc around the note glyph. */
const DISC = 56;
/** The copy sits 40pt off the stage's foot. */
const COPY_BOTTOM = 40;
/** At 2× text a 34pt title would be 68pt: it stops growing at 1.5×, like the hubs' hero titles. */
const TITLE_MAX_SCALE = 1.5;

/**
 * The Music chip (MediaMusic.dc.html): Music has no catalogue yet, so the
 * hero stage says so — "Music is coming soon / Songs and albums will play
 * right here." — over a drawn scene, with nothing to tap. Full-bleed under
 * the Media bar and its chips like the hubs' heroes, and a scroll of its own
 * so a 2× text size never pushes the copy under them or behind the dock.
 */
export const MusicComingSoon = memo(function MusicComingSoon({ scrollY }: Props) {
  const { t } = useLanguage();
  const chromeHeight = useHubChromeHeight();
  const minHeight = useHubHeroMinHeight("poster");
  const dockClearance = useDockClearance();
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  useScrollOffset(scrollRef, scrollY);
  // A fresh page starts at the top without a scroll event; so does one that goes away.
  useEffect(() => {
    scrollY.value = 0;
    return () => {
      scrollY.value = 0;
    };
  }, [scrollY]);

  return (
    <Animated.ScrollView
      ref={scrollRef}
      style={styles.page}
      contentContainerStyle={{ paddingBottom: dockClearance }}
      showsVerticalScrollIndicator={false}
      scrollEventThrottle={16}
    >
      <View style={[styles.stage, { minHeight }]}>
        <View
          style={styles.art}
          pointerEvents="none"
          accessible={false}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Svg style={StyleSheet.absoluteFill} viewBox="0 0 390 640" preserveAspectRatio="xMidYMid slice">
            <Circle cx={268} cy={236} r={140} fill={ART.sun} opacity={0.14} />
            <Circle cx={268} cy={236} r={66} fill={ART.sun} />
            {[52, 40, 28].map((r) => (
              <Circle key={r} cx={268} cy={236} r={r} fill="none" stroke={ART.sky} strokeOpacity={0.35} strokeWidth={2} />
            ))}
            <Circle cx={268} cy={236} r={9} fill={ART.sky} />
            <Path d={HILL_PATH} fill={ART.hill} />
            <Path d={SKYLINE_PATH} fill={ART.skyline} />
          </Svg>
          <LinearGradient
            colors={TOP_SCRIM}
            locations={[0, 1]}
            style={[styles.topScrim, { height: chromeHeight + TOP_SCRIM_TAIL }]}
          />
          <LinearGradient colors={FOOT_SCRIM} locations={[0, 0.52, 1]} style={styles.footScrim} />
        </View>

        <FadeInView
          from="bottom"
          duration={500}
          style={[styles.copy, { paddingTop: chromeHeight + HUB_TOP_GAP }]}
        >
          <View style={styles.disc}>
            <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
            <View style={[StyleSheet.absoluteFill, styles.discFill]} />
            <Ionicons name="musical-notes-outline" size={26} color={theme.colors.text} />
          </View>
          <ThemedText
            variant="display"
            accessibilityRole="header"
            maxFontSizeMultiplier={TITLE_MAX_SCALE}
            style={styles.title}
          >
            {t.hub.musicSoonTitle}
          </ThemedText>
          <ThemedText variant="body" color={theme.colors.textMuted} style={styles.body}>
            {t.hub.musicSoonBody}
          </ThemedText>
        </FadeInView>
      </View>
    </Animated.ScrollView>
  );
});

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.colors.background },
  stage: { overflow: "hidden", backgroundColor: ART.sky, justifyContent: "flex-end" },
  art: { ...StyleSheet.absoluteFill, overflow: "hidden" },
  topScrim: { position: "absolute", top: 0, left: 0, right: 0 },
  /** Board: 380 of 640 — kept as a share so a taller stage keeps its copy on the dark. */
  footScrim: { position: "absolute", left: 0, right: 0, bottom: 0, height: "60%" },
  copy: {
    alignItems: "center",
    paddingHorizontal: theme.layout.screenPadding,
    paddingBottom: COPY_BOTTOM,
  },
  disc: {
    width: DISC,
    height: DISC,
    borderRadius: DISC / 2,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  discFill: { backgroundColor: theme.colors.tonal },
  title: { marginTop: 18, textAlign: "center", maxWidth: 560 },
  body: { marginTop: 10, textAlign: "center", maxWidth: 560 },
});
