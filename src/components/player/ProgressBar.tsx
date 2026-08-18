import { useEffect, useRef, useState } from "react";
import { PanResponder, View, StyleSheet, type LayoutChangeEvent } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { ThemedText } from "@/components/ui/ThemedText";
import { theme } from "@/theme";

interface Props {
  durationSeconds: number;
  positionSeconds: number;
  bufferedSeconds: number;
  onSeek: (seconds: number) => void;
}

const TRACK_HEIGHT = 5;
const THUMB_SIZE = 16;
/** Vertical slack around the 5pt track so the bar is a comfortable drag target. */
const TOUCH_PADDING = 16;

function formatTime(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/**
 * Played / buffered / unplayed scrub bar. Buffered comes straight from
 * expo-video's own timeUpdate event (bufferedPosition) — no custom
 * segment cache to drive this, unlike the web player.
 *
 * Drag maths are unchanged from the first version: the PanResponder is frozen
 * on first render and reads duration/onSeek through refs.
 */
export function ProgressBar({ durationSeconds, positionSeconds, bufferedSeconds, onSeek }: Props) {
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
    thumbScale.value = withSpring(dragging ? 1.7 : 1, { damping: 14, stiffness: 260 });
    bubbleOpacity.value = withTiming(dragging ? 1 : 0, { duration: 140 });
  }, [dragPosition, thumbScale, bubbleOpacity]);

  const thumbAnimatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: thumbScale.value }] }));
  const bubbleAnimatedStyle = useAnimatedStyle(() => ({ opacity: bubbleOpacity.value }));

  const handleLayout = (e: LayoutChangeEvent) => {
    trackWidthRef.current = e.nativeEvent.layout.width;
    setTrackWidth(e.nativeEvent.layout.width);
  };

  const positionFromTouchX = (x: number) => {
    const clampedX = Math.min(Math.max(x, 0), trackWidthRef.current);
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

  return (
    <View style={styles.hitArea} onLayout={handleLayout} {...panResponder.panHandlers}>
      <Animated.View
        style={[styles.bubble, { transform: [{ translateX: bubbleLeft }] }, bubbleAnimatedStyle]}
        pointerEvents="none"
      >
        <ThemedText variant="caption" weight="bold" tabular>
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
    backgroundColor: "rgba(255,255,255,0.22)",
    overflow: "visible",
  },
  fill: { position: "absolute", top: 0, bottom: 0, borderRadius: TRACK_HEIGHT / 2 },
  buffered: { backgroundColor: "rgba(255,255,255,0.42)" },
  played: { backgroundColor: theme.colors.primary },
  thumb: {
    position: "absolute",
    top: TRACK_HEIGHT / 2 - THUMB_SIZE / 2,
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: theme.colors.primary,
    marginLeft: -THUMB_SIZE / 2,
    borderWidth: 2,
    borderColor: theme.colors.onPrimary,
  },
  bubble: {
    position: "absolute",
    top: 0,
    left: -26,
    minWidth: 52,
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.scrim,
    borderWidth: 1,
    borderColor: theme.colors.ring,
  },
});
