import { memo, useCallback, useEffect, useRef, useState } from "react";
import { Linking, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image, type ImageLoadEventData } from "expo-image";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import { ThemedText } from "@/components/ui/ThemedText";
import { PlayerGlyph } from "@/components/player/PlayerGlyph";
import { useLanguage } from "@/localization/LanguageProvider";
import { theme } from "@/theme";

interface Props {
  imageUrl: string;
  /** The picture's own size from the API — the box's shape before the file has loaded. */
  imageWidth: number;
  imageHeight: number;
  title: string;
  /** A checked http(s) link, or null for a picture that is only seen. */
  linkUrl: string | null;
  closable: boolean;
  /** The Player's gate: playing, controls down, no buffering, no ad, no sheet, not the last minutes. */
  visible: boolean;
  isFullscreen: boolean;
  stageWidth: number;
  stageHeight: number;
  /** A tap on the linked picture, just before the link is handed to the OS. */
  onOpen: () => void;
  /** ✕ — gone for the rest of the viewing. */
  onClose: () => void;
  /** Every time it comes on screen with the picture painted; the Player decides what that is worth. */
  onVisibleLoaded: () => void;
  /** The picture could not be loaded. */
  onError: () => void;
}

/** The box the picture is fitted into, as a share of the stage and an absolute cap (pt). */
const WIDTH_SHARE = 0.3;
const HEIGHT_SHARE = 0.2;
const MAX_WIDTH = 240;
const MAX_HEIGHT = 72;
const FADE_MS = 300;
/** The ✕ disc; hitSlop brings its touch area up to 36pt without covering more of the picture. */
const CLOSE_SIZE = 20;

/**
 * CORNER AD (2026-11-04): the advertiser's small picture in the stage's
 * top-right corner while the film plays. The Player owns the schedule
 * (`@/video/corner`) and mounts this only for a showing; `visible` then fades
 * it in and out as the gate opens and closes — the controls coming up, a
 * rebuffer, a pause — without remounting, so the picture is fetched once per
 * showing (from the disk cache after the first).
 *
 * It fits the picture's own shape into at most 30% of the stage's width and
 * 20% of its height (240 × 72 pt at most), animates a GIF / animated WebP only
 * while it is on screen, carries an "Ad" badge, a ✕ when the ad may be closed,
 * and, when the ad has a link, opens it in the browser (the Player pauses the
 * film first). Nothing is shown until the picture has painted, so a slow file
 * never puts an empty frame over the film.
 *
 * Memoised: the Player re-renders four times a second off the film's tick,
 * and every prop here is state, a primitive or a stable callback.
 */
export const CornerAd = memo(function CornerAd({
  imageUrl,
  imageWidth,
  imageHeight,
  title,
  linkUrl,
  closable,
  visible,
  isFullscreen,
  stageWidth,
  stageHeight,
  onOpen,
  onClose,
  onVisibleLoaded,
  onError,
}: Props) {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const imageRef = useRef<Image>(null);
  const [loaded, setLoaded] = useState(false);
  /** The file's own size once it has loaded; the API's figure until then. */
  const [intrinsic, setIntrinsic] = useState({ width: imageWidth, height: imageHeight });
  const shown = visible && loaded;
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = reduceMotion ? (shown ? 1 : 0) : withTiming(shown ? 1 : 0, { duration: FADE_MS });
  }, [shown, reduceMotion, opacity]);
  const fadeStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  // An animated picture plays only while it can be seen. It autoplays on
  // load, so a showing that loads behind the controls is stopped here too.
  useEffect(() => {
    if (!loaded) return;
    const image = imageRef.current;
    if (!image) return;
    (shown ? image.startAnimating() : image.stopAnimating()).catch(() => {});
  }, [shown, loaded]);

  useEffect(() => {
    if (shown) onVisibleLoaded();
  }, [shown, onVisibleLoaded]);

  const handleLoad = useCallback((event: ImageLoadEventData) => {
    const { width, height } = event.source;
    if (width > 0 && height > 0) {
      setIntrinsic((current) => (current.width === width && current.height === height ? current : { width, height }));
    }
    setLoaded(true);
  }, []);

  const handleOpen = useCallback(() => {
    if (!linkUrl) return;
    onOpen();
    Linking.openURL(linkUrl).catch(() => {});
  }, [linkUrl, onOpen]);

  const maxWidth = Math.min(stageWidth * WIDTH_SHARE, MAX_WIDTH);
  const maxHeight = Math.min(stageHeight * HEIGHT_SHARE, MAX_HEIGHT);
  const aspect = intrinsic.width > 0 && intrinsic.height > 0 ? intrinsic.width / intrinsic.height : 1;
  const width = Math.max(0, Math.min(maxWidth, maxHeight * aspect));
  const height = width / aspect;

  // PlayerControls' insets: fullscreen is edge-to-edge, so the corner clears
  // the cutout; portrait sits inside the stage already.
  const top = isFullscreen ? 14 + insets.top : 8;
  const right = isFullscreen ? Math.max(36, insets.right) : 8;

  const picture = (
    <Image
      ref={imageRef}
      source={{ uri: imageUrl }}
      style={StyleSheet.absoluteFill}
      contentFit="contain"
      accessible={false}
      onLoad={handleLoad}
      onError={onError}
    />
  );

  return (
    <Animated.View
      style={[styles.root, { top, right, width, height }, fadeStyle]}
      pointerEvents={shown ? "box-none" : "none"}
      accessibilityElementsHidden={!shown}
      importantForAccessibility={shown ? "auto" : "no-hide-descendants"}
    >
      {linkUrl ? (
        <Pressable
          onPress={handleOpen}
          accessibilityRole="link"
          accessibilityLabel={t.player.openAd.replace("{title}", title)}
          style={({ pressed }) => [StyleSheet.absoluteFill, pressed && styles.pressed]}
        >
          {picture}
        </Pressable>
      ) : (
        <View style={StyleSheet.absoluteFill} accessible accessibilityRole="image" accessibilityLabel={title}>
          {picture}
        </View>
      )}

      <View style={styles.tag} pointerEvents="none">
        <ThemedText weight="extrabold" color={theme.colors.onPrimary} maxFontSizeMultiplier={1.3} style={styles.tagText}>
          {t.player.adTag}
        </ThemedText>
      </View>

      {closable && (
        <Pressable
          onPress={onClose}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t.player.closeAd}
          style={({ pressed }) => [styles.close, pressed && styles.pressed]}
        >
          <PlayerGlyph name="close" size={12} />
        </Pressable>
      )}
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  root: { position: "absolute" },
  // The pre-roll's crimson badge, a size down: it rides on a small picture.
  tag: {
    position: "absolute",
    left: 3,
    top: 3,
    minHeight: 16,
    paddingHorizontal: 4,
    borderRadius: 3,
    justifyContent: "center",
    backgroundColor: theme.colors.primary,
  },
  // Room for Burmese marks above and below the line; never letter-spaced (ThemedText's rule).
  tagText: { fontSize: 9, lineHeight: 16, textTransform: "uppercase" },
  close: {
    position: "absolute",
    right: 2,
    top: 2,
    width: CLOSE_SIZE,
    height: CLOSE_SIZE,
    borderRadius: CLOSE_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.artBadge,
  },
  pressed: { opacity: 0.8 },
});
