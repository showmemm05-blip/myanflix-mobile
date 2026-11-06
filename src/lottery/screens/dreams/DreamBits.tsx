import { memo, useEffect, useRef, type ReactNode } from "react";
import {
  AccessibilityInfo,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { LtText } from "@/lottery/components/LtText";
import { LT } from "@/lottery/theme/tokens";

/**
 * A help line with its own glyph (lt-base `.lt-help`, 12/16 with a 16pt
 * icon): the Dream pages colour the icon with the book's accent ("Tap a
 * dream…", the tickets glyph) or use a drawing LtIcon does not have (the
 * moon), which LtHelp — a frozen foundation component — cannot take.
 * `center` centres the run (the "Load more" note). Read as its text.
 */
export const HintLine = memo(function HintLine({
  icon,
  text,
  color = LT.ink3,
  center = false,
  style,
}: {
  icon: ReactNode;
  text: string;
  /** The words' ink: ink-3 (plain help) or ink-2 (info help). */
  color?: string;
  center?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.line, center && styles.center, style]} accessible accessibilityLabel={text}>
      {icon}
      <LtText role="caption" color={color} style={center ? styles.textCenter : styles.text}>
        {text}
      </LtText>
    </View>
  );
});

/**
 * Announces `text` politely once it has been still for `delay` ms — the
 * board's `aria-live="polite"` count ("3 dreams match “cat”"). Debounced so
 * typing "elephant" is heard once, not eight times; never on the first render
 * (the page's own heading is read then). One path for both platforms: a
 * live region would double it on Android.
 */
export function useAnnounceWhenStill(text: string, delay = 700): void {
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const timer = setTimeout(() => AccessibilityInfo.announceForAccessibility(text), delay);
    return () => clearTimeout(timer);
  }, [text, delay]);
}

const styles = StyleSheet.create({
  line: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
  center: { justifyContent: "center" },
  text: { flex: 1 },
  textCenter: { flexShrink: 1, textAlign: "center" },
});
