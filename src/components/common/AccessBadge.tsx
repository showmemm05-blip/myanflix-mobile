import { View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ThemedText } from "@/components/ui/ThemedText";
import { useLanguage } from "@/localization/LanguageProvider";
import { theme } from "@/theme";
import type { AccessType } from "@/types/movie";

/**
 * The app's ONE access badge: FREE reads emerald (it costs nothing), everything
 * else reads gold with a diamond. Lives in common/ because MediaCard stamps it
 * on artwork and the detail/home/subscribe screens stamp it beside a title —
 * one implementation is what keeps those two from drifting apart.
 */
export function AccessBadge({ accessType }: { accessType: AccessType }) {
  const { t } = useLanguage();
  const isFree = accessType === "FREE";

  return (
    <View style={[styles.container, isFree ? styles.free : styles.premium]}>
      {!isFree && <Ionicons name="diamond" size={10} color={theme.colors.onPremium} />}
      <ThemedText variant="caption" weight="bold" style={isFree ? styles.freeText : styles.premiumText}>
        {isFree ? t.movie.free : t.movie.premium}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: "flex-start",
  },
  free: { backgroundColor: theme.colors.finance },
  premium: { backgroundColor: theme.colors.premium },
  freeText: { color: theme.colors.onFinance },
  premiumText: { color: theme.colors.onPremium },
});
