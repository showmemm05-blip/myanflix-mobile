import { ScrollView, useWindowDimensions } from "react-native";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { MenuRow, menuListStyle, menuSnapHeight } from "@/components/player/MenuRow";
import { useLanguage } from "@/localization/LanguageProvider";
import type { StreamQuality } from "@/types/video";

interface Props {
  visible: boolean;
  /** The title's ladder, best-first — ordered by the backend, never re-sorted here. */
  options: StreamQuality[];
  /** The label currently pinned, or `null` for the Auto row. */
  value: string | null;
  onSelect: (label: string | null) => void;
  onClose: () => void;
}

/**
 * Quality picker as a bottom sheet — the shared `MenuRow` idiom, with the
 * selected row filled violet.
 *
 * "Auto" leads because it is the default and the only row that adapts to the
 * connection — leaving it is the choice worth making deliberately. The rungs
 * below carry their stored label verbatim ("720p"): numerals plus a letter,
 * translated in neither client, exactly like the speed rows' "1.5x".
 *
 * IT SCROLLS, and the reason is the one place this sheet is most used:
 * FULLSCREEN. There the screen is locked landscape, so the window is only as
 * tall as the phone is wide — around 390dp — and BottomSheet caps itself at 92%
 * of that, leaving roughly 270dp of body once the grabber header and the bottom
 * padding are paid for. Auto plus a full five-rung ladder asks for about 356dp
 * of rows, so the bottom of the list simply would not be reachable: the rungs
 * that fall off are the LOW ones, and a viewer on a weak connection reaching for
 * 240p is exactly who opened this. `menuSnapHeight` keeps the tall case a scroll
 * rather than a clip; a short ladder still fits in one screenful and never
 * scrolls at all.
 */
export function QualitySheet({ visible, options, value, onSelect, onClose }: Props) {
  const { t } = useLanguage();
  const { height } = useWindowDimensions();

  // + 1 for the Auto row.
  const snapHeight = menuSnapHeight(options.length + 1, height);

  const choose = (label: string | null) => {
    onSelect(label);
    onClose();
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={t.player.quality}
      showClose
      snapHeight={snapHeight}
    >
      <ScrollView contentContainerStyle={menuListStyle} showsVerticalScrollIndicator={false}>
        <MenuRow label={t.player.qualityAuto} selected={value === null} onPress={() => choose(null)} tabular />
        {options.map((option) => (
          <MenuRow
            key={option.label}
            label={option.label}
            selected={option.label === value}
            onPress={() => choose(option.label)}
            tabular
          />
        ))}
      </ScrollView>
    </BottomSheet>
  );
}
