import { useEffect, useRef, useState } from "react";
import { PanResponder, View, StyleSheet, type AccessibilityActionEvent, type LayoutChangeEvent } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { ThemedText } from "@/components/ui/ThemedText";
import { useLanguage } from "@/localization/LanguageProvider";
import { theme } from "@/theme";
import { clamp, formatTime } from "@/utils/format";

interface Props {
  durationSeconds: number;
  positionSeconds: number;
  bufferedSeconds: number;
  onSeek: (seconds: number) => void;
}

/** Marquee seek line: a 4pt track, crimson played, white-at-45% buffered. */
const TRACK_HEIGHT = 4;
/** The white thumb at rest; it swells while dragged. */
const THUMB_SIZE = 14;
/**
 * Vertical slack around the 4pt track, so the bar is a full 44pt drag target
 * (4 + 20 + 20) even where the boards draw its row shorter.
 */
const TOUCH_PADDING = 20;
/** What a screen reader's swipe up/down moves — the same 10s the skip buttons use. */
const A11Y_STEP_SECONDS = 10;

/**
 * Played / buffered / unplayed scrub bar. Buffered comes straight from
 * expo-video's own timeUpdate event (bufferedPosition) — no custom
 * segment cache to drive this, unlike the web player.
 *
 * Drag maths are unchanged from the first version: the PanResponder is frozen
 * on first render and reads duration/onSeek through refs.
 */
export function ProgressBar({ durationSeconds, positionSeconds, bufferedSeconds, onSeek }: Props) {
  const { t } = useLanguage();
  const reduceMotion = useReducedMotion();
  const [trackWidth, setTrackWidth] = useState(0);
  const [dragPosition, setDragPosition] = useState<number | null>(null);
  const trackWidthRef = useRef(0);
  // PanResponder.create() below runs once (frozen via useRef) and its
  // handlers close over whatever these were on that first call — durable
  // refs, kept fresh every render, so a PanResponder created before the
  // player reports its real duration (e.g. this component's first-ever
  // mount, or any later remount that races the load) doesn't stay permanently
  // stuck computing every touch against durationSeconds=0.
  const durationRef = useRef(durationSeconds);
  const onSeekRef = useRef(onSeek);
  const thumbScale = useSharedValue(1);
  const bubbleOpacity = useSharedValue(0);

  useEffect(() => {
    durationRef.current = durationSeconds;
  }, [durationSeconds]);

  useEffect(() => {
    onSeekRef.current = onSeek;
  }, [onSeek]);

  useEffect(() => {
    const dragging = dragPosition !== null;
    // Reduce motion: the thumb still grows and the bubble still shows — they
    // say "you are scrubbing" — they just arrive without travelling.
    thumbScale.value = reduceMotion
      ? dragging
        ? 1.7
        : 1
      : withSpring(dragging ? 1.7 : 1, { damping: 14, stiffness: 260 });
    bubbleOpacity.value = reduceMotion ? (dragging ? 1 : 0) : withTiming(dragging ? 1 : 0, { duration: 140 });
  }, [dragPosition, thumbScale, bubbleOpacity, reduceMotion]);

  const thumbAnimatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: thumbScale.value }] }));
  const bubbleAnimatedStyle = useAnimatedStyle(() => ({ opacity: bubbleOpacity.value }));

  const handleLayout = (e: LayoutChangeEvent) => {
    trackWidthRef.current = e.nativeEvent.layout.width;
    setTrackWidth(e.nativeEvent.layout.width);
  };

  const positionFromTouchX = (x: number) => {
    const clampedX = clamp(x, 0, trackWidthRef.current);
    const ratio = trackWidthRef.current > 0 ? clampedX / trackWidthRef.current : 0;
    return ratio * durationRef.current;
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => setDragPosition(positionFromTouchX(e.nativeEvent.locationX)),
      onPanResponderMove: (e) => setDragPosition(positionFromTouchX(e.nativeEvent.locationX)),
      onPanResponderRelease: (e) => {
        const seconds = positionFromTouchX(e.nativeEvent.locationX);
        setDragPosition(null);
        onSeekRef.current(seconds);
      },
    }),
  ).current;

  const displayedPosition = dragPosition ?? positionSeconds;
  const pct = (seconds: number) => (durationSeconds > 0 ? Math.min(100, (seconds / durationSeconds) * 100) : 0);
  const bubbleLeft = trackWidth > 0 ? (pct(displayedPosition) / 100) * trackWidth : 0;

  /**
   * The SPOKEN position, held on the same 10s grid a screen-reader swipe moves
   * by. This bar re-renders four times a second off the playback tick; a value
   * that changed every second made TalkBack re-read "18:41 of 46:12",
   * "18:42 of 46:12"… for as long as the seek line had focus. On the grid it
   * changes at most once per 10s of playback, and every swipe still lands on a
   * new value, so the step the viewer took is always heard.
   */
  const spokenSeconds = Math.floor(Math.max(0, positionSeconds) / A11Y_STEP_SECONDS) * A11Y_STEP_SECONDS;

  /** Swipe up / down with a screen reader: the same seek a drag ends in. */
  const handleAccessibilityAction = (event: AccessibilityActionEvent) => {
    if (durationSeconds <= 0) return;
    const delta = event.nativeEvent.actionName === "increment" ? A11Y_STEP_SECONDS : -A11Y_STEP_SECONDS;
    onSeek(clamp(positionSeconds + delta, 0, durationSeconds));
  };

  return (
    <View
      style={styles.hitArea}
      onLayout={handleLayout}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={t.player.seek}
      accessibilityValue={{
        min: 0,
        max: Math.max(0, Math.round(durationSeconds)),
        now: spokenSeconds,
        text: t.player.seekValue
          .replace("{position}", formatTime(spokenSeconds))
          .replace("{duration}", formatTime(durationSeconds)),
      }}
      accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
      onAccessibilityAction={handleAccessibilityAction}
      {...panResponder.panHandlers}
    >
      <Animated.View
        style={[styles.bubble, { transform: [{ translateX: bubbleLeft }] }, bubbleAnimatedStyle]}
        pointerEvents="none"
      >
        <ThemedText variant="caption" weight="extrabold" tabular color={theme.colors.text} maxFontSizeMultiplier={1.6}>
          {formatTime(displayedPosition)}
        </ThemedText>
      </Animated.View>

      {/* The whole track is decoration: `locationX` is measured against the
          deepest view the touch actually landed on, so if the thumb (or a
          fill) could receive the touch, grabbing the thumb would report an
          x of ~0 and the scrub would jump to the start. Making every child
          transparent to touches keeps `hitArea` the target for the entire
          gesture, which is the coordinate space the maths below assumes. */}
      <View style={styles.track} pointerEvents="none">
        <View style={[styles.fill, styles.buffered, { width: `${pct(bufferedSeconds)}%` }]} />
        <View style={[styles.fill, styles.played, { width: `${pct(displayedPosition)}%` }]} />
        <Animated.View style={[styles.thumb, { left: `${pct(displayedPosition)}%` }, thumbAnimatedStyle]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hitArea: { justifyContent: "center", paddingVertical: TOUCH_PADDING },
  track: {
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    backgroundColor: "rgba(255,255,255,0.24)",
    overflow: "visible",
  },
  fill: { position: "absolute", top: 0, bottom: 0, borderRadius: TRACK_HEIGHT / 2 },
  buffered: { backgroundColor: "rgba(255,255,255,0.45)" },
  played: { backgroundColor: theme.colors.primary },
  thumb: {
    position: "absolute",
    top: TRACK_HEIGHT / 2 - THUMB_SIZE / 2,
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: theme.colors.play,
    marginLeft: -THUMB_SIZE / 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 3,
    elevation: 3,
  },
  // Above the touch slack, so the bubble never sits on the line it describes.
  bubble: {
    position: "absolute",
    top: -6,
    left: -28,
    minWidth: 56,
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.artBadge,
  },
});
