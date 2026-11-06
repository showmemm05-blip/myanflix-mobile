import { memo } from "react";
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { LtText } from "@/lottery/components/LtText";
import { LT } from "@/lottery/theme/tokens";

/**
 * An inline text link (lt-base `.lt-link`): indigo, semibold, underlined —
 * indigo is the Lottery's link colour, never seal. It sits in running copy
 * (a note, the details list), so the text stays 14/20 while the target is
 * 44pt tall, as the boards' `min-height: 44px` links are.
 */
export const TextLink = memo(function TextLink({
  label,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  style,
}: {
  label: string;
  onPress: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      hitSlop={{ left: 4, right: 4 }}
      style={({ pressed }) => [styles.link, pressed && styles.pressed, style]}
    >
      <LtText role="metaB" color={LT.indigo} tabular style={styles.text}>
        {label}
      </LtText>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  link: { minHeight: 44, justifyContent: "center", alignSelf: "flex-start" },
  pressed: { opacity: 0.7 },
  text: { textDecorationLine: "underline", textDecorationColor: LT.indigo },
});
