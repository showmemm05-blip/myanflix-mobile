import { memo, useState } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { Image } from "expo-image";
import { useReducedMotion } from "react-native-reanimated";
import { LtText } from "@/lottery/components/LtText";
import { LT } from "@/lottery/theme/tokens";

/** The picture fades in over this long (expo-image's own cross-fade; 0 under reduced motion). */
const FADE_MS = 200;

/**
 * One dream's picture: a round `size` window showing the admin's upload
 * (expo-image, cached on disk and in memory, faded in), or — while there is
 * no picture, or the one there is will not load — the placeholder tile: the
 * number window's cream paper with the dream's number on it in Literata.
 * Decorative: the dream's names and number are always written beside it.
 */
export const DreamPicture = memo(function DreamPicture({
  pictureUrl,
  number,
  size,
  style,
}: {
  pictureUrl: string | null;
  /** "027" / "07" — what the placeholder tile shows. */
  number: string;
  size: number;
  style?: StyleProp<ViewStyle>;
}) {
  const reduceMotion = useReducedMotion();
  // Remembered per URL, so a new picture for the same tile gets its own try.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const picture = pictureUrl && failedUrl !== pictureUrl ? pictureUrl : null;
  // Three digits sit a little smaller than two, so both fill the tile the same way.
  const fontSize = Math.max(11, Math.round(size * (number.length > 2 ? 0.3 : 0.36)));

  return (
    <View
      style={[styles.tile, { width: size, height: size, borderRadius: size / 2 }, style]}
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {picture ? (
        <Image
          source={{ uri: picture }}
          recyclingKey={picture}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={reduceMotion ? 0 : FADE_MS}
          onError={() => setFailedUrl(picture)}
          style={StyleSheet.absoluteFill}
        />
      ) : (
        <LtText
          role="num"
          maxFontSizeMultiplier={1}
          // Cancels the trailing letter-space so the digits sit truly centred (DreamCard does the same).
          style={{ fontSize, lineHeight: Math.round(fontSize * 1.25), paddingLeft: fontSize * 0.06 }}
        >
          {number}
        </LtText>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  /** The placeholder's paper is the ground, so a picture with a clear edge sits on cream, like the number window. */
  tile: {
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: LT.cream1,
    borderWidth: 1,
    borderColor: LT.line,
  },
});
