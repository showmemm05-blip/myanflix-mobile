import { StyleSheet, View } from "react-native";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import { ThemedText } from "@/components/ui/ThemedText";
import { Button } from "@/components/ui/Button";
import { AuroraBackdrop } from "@/components/common/AuroraBackdrop";
import { useLanguage } from "@/localization/LanguageProvider";
import { theme } from "@/theme";

interface Props {
  onSubscribe: () => void;
}

/** The premium gate shown instead of the player when the stream is forbidden. */
export function LockedOverlay({ onSubscribe }: Props) {
  const { t } = useLanguage();

  return (
    <View style={styles.container} pointerEvents="box-none">
      <AuroraBackdrop tone="gold" height={420} intensity={0.85} />

      <View style={styles.content}>
        <View style={styles.iconTile}>
          <Ionicons name="lock-closed" size={30} color={theme.colors.premium} />
        </View>
        <ThemedText variant="title" style={styles.text}>
          {t.movie.subscriptionLocked}
        </ThemedText>
        <ThemedText variant="caption" style={styles.text}>
          {t.subscription.subtitle}
        </ThemedText>
        <Button
          title={t.movie.subscribeButton}
          icon="diamond"
          size="lg"
          color={theme.colors.premium}
          onPress={onSubscribe}
          style={styles.button}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    padding: theme.spacing.lg,
  },
  content: { alignItems: "center", gap: theme.spacing.md, maxWidth: 380 },
  iconTile: {
    width: 76,
    height: 76,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.premiumSoft,
    borderWidth: 1,
    borderColor: theme.colors.premium + "3D",
    alignItems: "center",
    justifyContent: "center",
  },
  text: { textAlign: "center" },
  button: { minWidth: 200, marginTop: theme.spacing.xs },
});
