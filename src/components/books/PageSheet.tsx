import { memo } from "react";
import { StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { ThemedText } from "@/components/ui/ThemedText";
import { theme, withAlpha } from "@/theme";

/** Height the folio strip adds under the scan — PageReader's offset maths import this. */
export const FOLIO_HEIGHT = 24;

export type PageRotation = 0 | 90 | 180 | 270;

interface Props {
  url: string;
  /** Exact display box of the SCAN — already the ROTATED aspect for 90/270. */
  width: number;
  height: number;
  pageNumber: number;
  /** Steps of the rotate control; the image turns inside the swapped box, the folio stays upright. */
  rotation?: PageRotation;
  /** Stage colour behind the sheet — on a white stage the outline strengthens so the sheet still reads. */
  stageColor?: string;
}

/**
 * One physical sheet of a PDF book: always white (the scan sits on paper
 * regardless of reader theme), hairline edge, soft shadow, and the page
 * number as a folio on the sheet's own bottom — not a floating badge.
 */
export const PageSheet = memo(function PageSheet({ url, width, height, pageNumber, rotation = 0, stageColor }: Props) {
  const quarter = rotation === 90 || rotation === 270;
  // The BOX is the rotated aspect; the IMAGE keeps its natural orientation and
  // turns inside it, so 90/270 swap the image's own width/height back.
  const imageWidth = quarter ? height : width;
  const imageHeight = quarter ? width : height;
  const whiteStage = stageColor?.toLowerCase() === "#ffffff" || stageColor?.toLowerCase() === "#fff";
  return (
    <View style={[styles.sheet, { width, height: height + FOLIO_HEIGHT }, whiteStage && styles.strongOutline]}>
      <View style={[styles.scanBox, { width, height }]}>
        <Image
          source={{ uri: url }}
          // The transform key must be ABSENT when unrotated, not undefined:
          // expo-image's style pipeline normalizes an explicit undefined to
          // null, and RN's _validateTransforms calls .forEach on it — a
          // render crash ("Cannot read property 'forEach' of null").
          style={[
            { width: imageWidth, height: imageHeight },
            rotation !== 0 && { transform: [{ rotate: `${rotation}deg` }] },
          ]}
          contentFit="contain"
          transition={160}
          accessibilityLabel={String(pageNumber)}
        />
      </View>
      <View style={styles.folio}>
        <ThemedText variant="caption" tabular style={styles.folioText}>
          {pageNumber}
        </ThemedText>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: "#ffffff",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: withAlpha("#000000", 0.12),
    ...theme.shadow.sm,
  },
  /** White-on-white needs more than a hairline to stay a sheet. */
  strongOutline: {
    borderWidth: 1,
    borderColor: withAlpha("#000000", 0.22),
  },
  scanBox: { alignItems: "center", justifyContent: "center", overflow: "hidden" },
  folio: { height: FOLIO_HEIGHT, alignItems: "center", justifyContent: "center" },
  folioText: { color: "#6B7185", fontSize: 11, lineHeight: 14 },
});
