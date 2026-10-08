import { StyleSheet, type StyleProp, type TextStyle } from "react-native";
import { ThemedText } from "@/components/ui/ThemedText";
import { isFreeGame } from "@/data/arcade";
import { formatKyat, type Game } from "@/data/games";
import { useLanguage } from "@/localization/LanguageProvider";
import { theme } from "@/theme";

/** "12,800 Ks", "Free", or null for an unreleased (unpriced, not free) game. */
export function priceLabel(game: Game, free: string): string | null {
  if (isFreeGame(game)) return free;
  return game.priceMMK !== null ? formatKyat(game.priceMMK) : null;
}

interface Props {
  game: Game;
  /** `md` 14/20 (featured), `sm` 13/18 (discover), `lg` 15/20 (spotlight). */
  size?: "sm" | "md" | "lg";
  style?: StyleProp<TextStyle>;
}

/**
 * A game's price as the board writes it: extra-bold tabular figures in white,
 * or "Free" in green words. A Coming Soon game is unpriced, not free, so it
 * renders nothing.
 */
export function ArcadePrice({ game, size = "md", style }: Props) {
  const { t } = useLanguage();
  const label = priceLabel(game, t.arcade.price.free);
  if (label === null) return null;

  return (
    <ThemedText
      variant={size === "sm" ? "caption" : "muted"}
      weight="extrabold"
      tabular
      color={isFreeGame(game) ? theme.colors.finance : theme.colors.text}
      style={[size === "lg" && styles.lg, style]}
    >
      {label}
    </ThemedText>
  );
}

const styles = StyleSheet.create({
  lg: { fontSize: 15 },
});
