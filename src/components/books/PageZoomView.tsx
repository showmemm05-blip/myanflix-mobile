import { useEffect, useState, type ReactNode } from "react";
import { StyleSheet } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

/** Pinch range over the FITTED size — matches readerBookViewStore's clamp. */
export const PAGE_ZOOM_MIN = 1;
export const PAGE_ZOOM_MAX = 3;
/** Double-tap toggles between rest and this. */
const DOUBLE_TAP_ZOOM = 2;
const SETTLE_MS = 160;

interface Props {
  /** The visible stage box (one horizontal-list item). */
  boxWidth: number;
  boxHeight: number;
  /** Un-zoomed size of the child (sheet or spread, folio included). */
  contentWidth: number;
  contentHeight: number;
  /** Committed zoom owned by PageReader (settings buttons / view memory drive it too). */
  zoom: number;
  /** Fired ONCE per settled gesture (pinch end / double-tap), never per frame. */
  onZoomCommit: (zoom: number) => void;
  /** Chrome toggle — a tap here must not double-fire through a parent Pressable. */
  onSingleTap?: () => void;
  children: ReactNode;
}

function clampW(value: number, min: number, max: number): number {
  "worklet";
  return Math.min(max, Math.max(min, value));
}

/**
 * The paged reader's zoom surface: pinch + pan + double-tap (1x ↔ 2x) with
 * reanimated transforms, clamped 1–3 with a soft spring-back past the edges.
 * Worklets only — no state writes per frame; the committed zoom surfaces once
 * per gesture via onZoomCommit so PageReader can persist it to book view
 * memory. Page swipes win at scale 1: PageReader disables the horizontal
 * list only when zoom > 1, and the pan here claims vertical-only drags while
 * un-zoomed (content taller than the box), failing fast on horizontal ones.
 */
export function PageZoomView({
  boxWidth,
  boxHeight,
  contentWidth,
  contentHeight,
  zoom,
  onZoomCommit,
  onSingleTap,
  children,
}: Props) {
  const reduceMotion = useReducedMotion();

  const scale = useSharedValue(zoom);
  const savedScale = useSharedValue(zoom);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const savedTx = useSharedValue(0);
  const savedTy = useSharedValue(0);

  const zoomed = zoom > 1.001;
  // Un-zoomed, the pan exists only to reach content taller/wider than the box
  // (fit-width portrait scans); zoomed, it roams freely (the list is disabled).
  const overflowPan = !zoomed && (contentHeight > boxHeight + 1 || contentWidth > boxWidth + 1);
  const [panEnabled, setPanEnabled] = useState(zoomed || overflowPan);
  useEffect(() => setPanEnabled(zoomed || overflowPan), [zoomed, overflowPan]);

  // External zoom (settings ± / reset, restored memory) drives the transform.
  useEffect(() => {
    const maxX = Math.max(0, (contentWidth * zoom - boxWidth) / 2);
    const maxY = Math.max(0, (contentHeight * zoom - boxHeight) / 2);
    const nextTx = Math.min(maxX, Math.max(-maxX, savedTx.value));
    const nextTy = Math.min(maxY, Math.max(-maxY, savedTy.value));
    savedScale.value = zoom;
    savedTx.value = nextTx;
    savedTy.value = nextTy;
    if (reduceMotion) {
      scale.value = zoom;
      tx.value = nextTx;
      ty.value = nextTy;
    } else {
      scale.value = withTiming(zoom, { duration: SETTLE_MS });
      tx.value = withTiming(nextTx, { duration: SETTLE_MS });
      ty.value = withTiming(nextTy, { duration: SETTLE_MS });
    }
  }, [zoom, contentWidth, contentHeight, boxWidth, boxHeight, reduceMotion, scale, tx, ty, savedScale, savedTx, savedTy]);

  const commit = (value: number) => onZoomCommit(Math.round(value * 100) / 100);
  const fireSingleTap = () => onSingleTap?.();

  const pinch = Gesture.Pinch()
    .onStart(() => {
      savedScale.value = scale.value;
    })
    .onUpdate((event) => {
      // Soft over-range while the fingers are down; the end snaps back.
      scale.value = clampW(savedScale.value * event.scale, PAGE_ZOOM_MIN * 0.8, PAGE_ZOOM_MAX * 1.15);
    })
    .onEnd(() => {
      const settled = clampW(scale.value, PAGE_ZOOM_MIN, PAGE_ZOOM_MAX);
      const maxX = Math.max(0, (contentWidth * settled - boxWidth) / 2);
      const maxY = Math.max(0, (contentHeight * settled - boxHeight) / 2);
      const nextTx = clampW(tx.value, -maxX, maxX);
      const nextTy = clampW(ty.value, -maxY, maxY);
      savedScale.value = settled;
      savedTx.value = nextTx;
      savedTy.value = nextTy;
      if (reduceMotion) {
        scale.value = settled;
        tx.value = nextTx;
        ty.value = nextTy;
      } else {
        scale.value = withTiming(settled, { duration: SETTLE_MS });
        tx.value = withTiming(nextTx, { duration: SETTLE_MS });
        ty.value = withTiming(nextTy, { duration: SETTLE_MS });
      }
      runOnJS(commit)(settled);
    });

  const pan = Gesture.Pan()
    .enabled(panEnabled)
    .onStart(() => {
      savedTx.value = tx.value;
      savedTy.value = ty.value;
    })
    .onUpdate((event) => {
      const maxX = Math.max(0, (contentWidth * scale.value - boxWidth) / 2);
      const maxY = Math.max(0, (contentHeight * scale.value - boxHeight) / 2);
      tx.value = clampW(savedTx.value + event.translationX, -maxX, maxX);
      ty.value = clampW(savedTy.value + event.translationY, -maxY, maxY);
    })
    .onEnd(() => {
      savedTx.value = tx.value;
      savedTy.value = ty.value;
    });
  if (overflowPan) {
    // Scale 1: claim vertical drags only — horizontal ones stay the list's page swipe.
    pan.activeOffsetY([-12, 12]).failOffsetX([-16, 16]);
  }

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd((_event, success) => {
      if (!success) return;
      const next = savedScale.value > 1.5 ? PAGE_ZOOM_MIN : DOUBLE_TAP_ZOOM;
      savedScale.value = next;
      savedTx.value = 0;
      savedTy.value = 0;
      if (reduceMotion) {
        scale.value = next;
        tx.value = 0;
        ty.value = 0;
      } else {
        scale.value = withTiming(next, { duration: SETTLE_MS });
        tx.value = withTiming(0, { duration: SETTLE_MS });
        ty.value = withTiming(0, { duration: SETTLE_MS });
      }
      runOnJS(commit)(next);
    });

  const singleTap = Gesture.Tap()
    .numberOfTaps(1)
    .onEnd((_event, success) => {
      if (success) runOnJS(fireSingleTap)();
    });

  const composed = Gesture.Simultaneous(pinch, pan, Gesture.Exclusive(doubleTap, singleTap));

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
  }));

  return (
    <GestureDetector gesture={composed}>
      <Animated.View style={[styles.box, { width: boxWidth }]} collapsable={false}>
        <Animated.View style={animatedStyle}>{children}</Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  box: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
});
