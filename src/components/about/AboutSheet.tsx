import { ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { ThemedText } from "@/components/ui/ThemedText";
import { SheetHeader } from "@/components/profile/AccountKit";
import { TMDB_CREDIT, TMDB_LOGO } from "@/components/about/tmdbCredit";
import { useLanguage } from "@/localization/LanguageProvider";
import { APP_VERSION } from "@/utils/appVersion";
import { theme } from "@/theme";

interface Props {
  visible: boolean;
  onClose: () => void;
}

/**
 * The logo's box: no taller than the wordmark's own line and narrower than
 * the word, so TMDB's mark is always the smaller of the two, as their terms
 * ask ("less prominent than your own"). The picture is fitted inside it,
 * whatever its shape, and kept to the left edge.
 */
const LOGO_WIDTH = 84;
const LOGO_HEIGHT = 28;

/**
 * What the sheet needs at 1× text on a 320pt phone above the tallest bottom
 * inset (48), where the sentence runs to three lines — without the logo row,
 * and with it (28 + its 10pt gap).
 */
const SNAP_HEIGHT = TMDB_LOGO === null ? 276 : 314;
/**
 * Extra height per whole step of text size. Generous on purpose: larger
 * letters also wrap the sentence onto more lines, so it grows faster than the
 * text size does.
 */
const SNAP_GROWTH = 250;

/**
 * "About" (About.dc.html, the phone frame): the app's name and version, then
 * the credit for where movie and series details come from — TMDB's logo when
 * the file is bundled, and their sentence, always.
 *
 * A bottom sheet, like Send feedback beside it, and deliberately NOT a link to
 * the website's /about page the way the Privacy row is: the credit must not
 * depend on the website, so a build with no website address (which hides the
 * Privacy row) still shows it.
 */
export function AboutSheet({ visible, onClose }: Props) {
  const { t } = useLanguage();
  const { fontScale } = useWindowDimensions();
  // Larger text grows the sheet with it (the BottomSheet caps it at 92% of
  // the window, and the body scrolls past that).
  const snapHeight = Math.round(SNAP_HEIGHT + SNAP_GROWTH * Math.max(0, fontScale - 1));

  // The app bar's wordmark — the 6×24 crimson bar and "MyanFlix" in 22/28
  // black — as the sheet's heading: the app's own mark, above TMDB's.
  const header = (
    <SheetHeader onClose={onClose} closeLabel={t.common.close}>
      <View style={styles.wordmark}>
        <View style={styles.wordmarkBar} />
        <ThemedText weight="black" accessibilityRole="header" style={styles.wordmarkText}>
          {t.common.appName}
        </ThemedText>
      </View>
    </SheetHeader>
  );

  return (
    <BottomSheet visible={visible} onClose={onClose} snapHeight={snapHeight} header={header}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        bounces={false}
        overScrollMode="never"
      >
        <ThemedText variant="caption" weight="regular" tabular color={theme.colors.textMuted}>
          {t.settings.aboutVersion.replace("{version}", APP_VERSION)}
        </ThemedText>

        <View style={styles.divider} />

        <View style={styles.credit}>
          <ThemedText variant="caption" weight="bold" color={theme.colors.textMuted} accessibilityRole="header">
            {t.settings.aboutMovieInfo}
          </ThemedText>
          {TMDB_LOGO !== null ? (
            <Image
              source={TMDB_LOGO}
              style={styles.logo}
              contentFit="contain"
              contentPosition="left"
              accessible
              accessibilityRole="image"
              accessibilityLabel="TMDB"
            />
          ) : null}
          {/* English in both app languages (tmdbCredit explains), so a screen
              reader is told to read it as English. */}
          <ThemedText variant="muted" color={theme.colors.textBody} accessibilityLanguage="en">
            {TMDB_CREDIT}
          </ThemedText>
        </View>
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  wordmark: { flexDirection: "row", alignItems: "center", gap: 10 },
  /** DesignSystem: 6×24, radius 2, crimson (AppTopBar's logoMark). */
  wordmarkBar: { width: 6, height: 24, borderRadius: 2, backgroundColor: theme.colors.brand },
  /** 22/28, black, tight — white; the crimson lives in the bar beside it. */
  wordmarkText: { flexShrink: 1, fontSize: 22, lineHeight: 28, letterSpacing: -0.66 },
  content: { paddingTop: theme.spacing.xs, paddingBottom: theme.spacing.sm },
  divider: { height: 1, marginVertical: theme.spacing.md, backgroundColor: theme.colors.border },
  credit: { gap: 10 },
  logo: { width: LOGO_WIDTH, height: LOGO_HEIGHT },
});
