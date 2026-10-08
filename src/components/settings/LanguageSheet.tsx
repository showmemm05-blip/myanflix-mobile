import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import Svg, { Path, Polygon, Rect } from "react-native-svg";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { ThemedText } from "@/components/ui/ThemedText";
import { SheetHeader } from "@/components/profile/AccountKit";
import { useLanguage } from "@/localization/LanguageProvider";
import { theme, withAlpha } from "@/theme";
import type { Language } from "@/localization/translations";

// Language names are deliberately NOT translated — each shown in its own
// script always, same reasoning as the web app's switcher. Exported so the
// Profile row can show the current one without a second copy of this list.
// `flag` stays for that row; this sheet draws the flags instead (Marquee
// draws no emoji).
export const LANGUAGE_OPTIONS: { code: Language; label: string; flag: string }[] = [
  { code: "mm", label: "မြန်မာ", flag: "🇲🇲" },
  { code: "en", label: "English", flag: "🇬🇧" },
];

/** BCP-47 tag for each label, so VoiceOver reads it in its own language. */
const SPOKEN_LANGUAGE: Record<Language, string> = { mm: "my", en: "en" };

interface Props {
  visible: boolean;
  onClose: () => void;
}

/** The two flags as drawn on Language.dc.html (36×24 artwork, shown 48×32). */
function Flag({ code }: { code: Language }) {
  return (
    <View style={styles.flag} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      <Svg width={48} height={32} viewBox="0 0 36 24">
        {code === "mm" ? (
          <>
            <Rect width={36} height={8} fill="#FECB00" />
            <Rect y={8} width={36} height={8} fill="#34B233" />
            <Rect y={16} width={36} height={8} fill="#EA2839" />
            <Polygon
              points="18,4 20,9.75 26.08,9.87 21.23,13.55 23,19.38 18,15.9 13,19.38 14.77,13.55 9.92,9.87 16,9.75"
              fill="#FFFFFF"
            />
          </>
        ) : (
          <>
            <Rect width={36} height={24} fill="#012169" />
            <Path d="M0 0L36 24M36 0L0 24" stroke="#FFFFFF" strokeWidth={5} />
            <Path d="M0 0L36 24M36 0L0 24" stroke="#C8102E" strokeWidth={1.6} />
            <Path d="M18 0V24M0 12H36" stroke="#FFFFFF" strokeWidth={8} />
            <Path d="M18 0V24M0 12H36" stroke="#C8102E" strokeWidth={4.6} />
          </>
        )}
      </Svg>
    </View>
  );
}

/**
 * The language switcher as a bottom sheet, replacing the pushed
 * LanguageSettings screen: Profile's other entries (Account, Support) all open
 * sheets, and a two-row choice never needed a whole screen. Picking a language
 * applies it at once and closes the sheet — there is nothing to confirm.
 *
 * Marquee: Language.dc.html — two 76pt radio rows, the picked one on a crimson
 * tint with a 2pt crimson ring and a filled crimson tick.
 */
export function LanguageSheet({ visible, onClose }: Props) {
  const { t, language, setLanguage } = useLanguage();
  const reduceMotion = useReducedMotion();
  const { fontScale } = useWindowDimensions();
  // 300pt fits both rows at 1×; larger text grows the sheet with it (the
  // BottomSheet caps it at 92% of the window, and the list scrolls past that).
  const snapHeight = Math.round(300 + 160 * Math.max(0, fontScale - 1));

  const choose = (code: Language) => {
    setLanguage(code);
    onClose();
  };

  const header = (
    <SheetHeader onClose={onClose} closeLabel={t.common.close}>
      <ThemedText variant="title" accessibilityRole="header">
        {t.settings.languageScreenTitle}
      </ThemedText>
    </SheetHeader>
  );

  return (
    <BottomSheet visible={visible} onClose={onClose} snapHeight={snapHeight} header={header}>
      <ScrollView showsVerticalScrollIndicator={false} bounces={false} overScrollMode="never">
        <View style={styles.list} accessibilityRole="radiogroup" accessibilityLabel={t.settings.language}>
          {LANGUAGE_OPTIONS.map((option) => {
            const active = option.code === language;
            return (
              <Pressable
                key={option.code}
                onPress={() => choose(option.code)}
                accessibilityRole="radio"
                accessibilityLabel={option.label}
                accessibilityLanguage={SPOKEN_LANGUAGE[option.code]}
                accessibilityState={{ checked: active }}
                style={({ pressed }) => [
                  styles.row,
                  active && styles.rowActive,
                  pressed && (reduceMotion ? styles.pressedStill : styles.pressed),
                ]}
              >
                <Flag code={option.code} />
                <ThemedText weight="bold" style={styles.label}>
                  {option.label}
                </ThemedText>
                <View style={[styles.mark, active && styles.markActive]}>
                  {active ? <Ionicons name="checkmark" size={16} color={theme.colors.onPrimary} /> : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  list: { gap: 10, paddingTop: theme.spacing.md, paddingBottom: theme.spacing.sm },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    minHeight: 76,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "transparent",
    backgroundColor: theme.colors.surfaceElevated,
  },
  rowActive: { borderColor: theme.colors.primary, backgroundColor: withAlpha(theme.colors.primary, 0.14) },
  pressed: { transform: [{ scale: 0.96 }] },
  pressedStill: { opacity: 0.8 },
  flag: {
    width: 48,
    height: 32,
    borderRadius: 6,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  label: { flex: 1, fontSize: 17 },
  mark: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: withAlpha(theme.colors.text, 0.3),
    alignItems: "center",
    justifyContent: "center",
  },
  markActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
});
