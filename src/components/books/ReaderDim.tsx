import { StyleSheet, View } from "react-native";

interface Props {
  /** 0.4–1.0 from readerPrefsStore; 1 renders nothing at all. */
  brightness: number;
}

/**
 * The in-reader "brightness" control — a black overlay that dims the WHOLE
 * screen, bars included, like a hardware dimmer. Rendered LAST in each reader
 * screen so it stacks above the chrome; pointerEvents none so every gesture
 * passes through. expo-brightness (the OS API) is a native module and is
 * parked — this stays JS-only by law.
 */
export function ReaderDim({ brightness }: Props) {
  const opacity = Math.min(0.6, (1 - brightness) * 0.85);
  if (opacity <= 0.001) return null;
  return <View pointerEvents="none" style={[styles.overlay, { opacity }]} />;
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000000",
    // Above ReaderTopBar/ReaderFooter (zIndex 10) — the dimmer owns the screen.
    zIndex: 50,
  },
});
