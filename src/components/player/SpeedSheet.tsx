import { ScrollView, useWindowDimensions } from "react-native";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { MenuRow, menuListStyle, menuSnapHeight } from "@/components/player/MenuRow";
import { useLanguage } from "@/localization/LanguageProvider";

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

interface Props {
  visible: boolean;
  value: number;
  onSelect: (speed: number) => void;
  onClose: () => void;
}

/**
 * Playback-rate picker as a bottom sheet — the selected rate is filled violet.
 *
 * IT SCROLLS AND IT CAPS ITS HEIGHT, for the place it is most used: FULLSCREEN.
 * There the screen is locked landscape, so the window is only as tall as the
 * phone is wide — around 390dp — while six rows ask for about 360dp plus the
 * grabber header and padding. Asking for more height than the window has does
 * not shrink the sheet, it pushes the bottom rows past the screen edge where
 * nothing can reach them: 2x and 1.5x, the two anyone opens this for. Capping
 * at 80% of the window and letting the list scroll turns that clip into a
 * scroll; in portrait the six rows still fit in one screenful and never move.
 * That cap now lives in `menuSnapHeight`, shared with the other two sheets.
 */
export function SpeedSheet({ visible, value, onSelect, onClose }: Props) {
  const { t } = useLanguage();
  const { height } = useWindowDimensions();

  const snapHeight = menuSnapHeight(SPEEDS.length, height);

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={t.movie.speed}
      showClose
      snapHeight={snapHeight}
    >
      <ScrollView contentContainerStyle={menuListStyle} showsVerticalScrollIndicator={false}>
        {SPEEDS.map((speed) => (
          <MenuRow
            key={speed}
            label={`${speed}x`}
            selected={speed === value}
            onPress={() => {
              onSelect(speed);
              onClose();
            }}
            tabular
          />
        ))}
      </ScrollView>
    </BottomSheet>
  );
}
