import type { StyleProp, ViewStyle } from "react-native";
import { ArcadeChip, ChipLabel } from "@/components/arcade/ArcadeBadge";
import { theme } from "@/theme";
import { useLanguage } from "@/localization/LanguageProvider";

interface Props {
  style?: StyleProp<ViewStyle>;
}

/**
 * "Free" as a chip — the 22pt green tint the board puts on the free-to-play
 * spotlight. Literally ArcadeBadge's chip, so the two can never drift apart
 * when they sit in one row. (Where a free game's PRICE would sit, the board
 * uses plain green words instead — see ArcadePrice.)
 */
export function FreeTag({ style }: Props) {
  const { t } = useLanguage();

  return (
    <ArcadeChip tone={theme.colors.finance} surface="tint" compact style={style}>
      <ChipLabel color={theme.colors.finance}>{t.arcade.price.free}</ChipLabel>
    </ArcadeChip>
  );
}
