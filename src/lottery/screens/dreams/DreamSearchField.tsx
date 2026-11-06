import { memo, useState, type Ref } from "react";
import { Pressable, StyleSheet, TextInput, View, type TextInputInstance } from "react-native";
import { LtIcon } from "@/lottery/components/LtIcon";
import { LT_MYANMAR_FACE, useLtFace } from "@/lottery/theme/fonts";
import { MYANMAR_SCRIPT } from "@/lottery/theme/type";
import { LT, LT_RADIUS, LT_SHADOW } from "@/lottery/theme/tokens";

export interface DreamSearchFieldProps {
  value: string;
  onChange: (text: string) => void;
  /** Clears the query and keeps the keyboard up (focus stays in the field). */
  onClear: () => void;
  placeholder: string;
  clearLabel: string;
  /** The field's spoken name — the whole sentence, since the pill has no label or help line. */
  accessibilityLabel: string;
  inputRef?: Ref<TextInputInstance>;
}

/**
 * The dream book's search, one pill on the cream band (canvas "Dream detail,
 * simpler" › Book, the owner's pick of three on 3 Nov 2026): 54 tall, fully
 * round, white with the field border and a soft shadow, the magnifier inside
 * on the left and a 44pt clear button on the right once there is text. No
 * label and no help line — the placeholder is the only visible hint, and a
 * screen reader hears the full sentence as the field's name. Focused: the
 * lt-base 2pt indigo ring, 2pt outside the pill (always reserved, so focusing
 * never shifts the page).
 *
 * The keyboard's Search key just closes the keyboard: the list already
 * filters live. The Lottery dock steps aside while the keyboard is up by
 * itself (LotteryDock).
 *
 * Burmese: Libre Franklin has no Myanmar glyphs, so while the query — or,
 * when it is empty, the placeholder — holds Burmese the field draws in Noto
 * Sans Myanmar (one face per input).
 */
export const DreamSearchField = memo(function DreamSearchField({
  value,
  onChange,
  onClear,
  placeholder,
  clearLabel,
  accessibilityLabel,
  inputRef,
}: DreamSearchFieldProps) {
  const face = useLtFace();
  const [focused, setFocused] = useState(false);
  // The placeholder counts too: an empty Burmese field shows Burmese words.
  const myanmar = MYANMAR_SCRIPT.test(value || placeholder);

  return (
    <View style={[styles.ring, focused && styles.ringOn]}>
      <View style={styles.field}>
        <View style={styles.magnifier} pointerEvents="none">
          <LtIcon name="search" size={20} color={LT.ink3} />
        </View>
        <TextInput
          ref={inputRef}
          value={value}
          onChangeText={onChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          placeholderTextColor={LT.ink3}
          selectionColor={LT.indigo}
          cursorColor={LT.indigo}
          returnKeyType="search"
          submitBehavior="blurAndSubmit"
          autoCorrect={false}
          autoCapitalize="none"
          autoComplete="off"
          spellCheck={false}
          inputMode="search"
          maxFontSizeMultiplier={1.4}
          accessibilityLabel={accessibilityLabel}
          style={[
            styles.input,
            { fontFamily: myanmar ? LT_MYANMAR_FACE.franklin400 : face("franklin400") },
            value ? styles.inputWithClear : null,
          ]}
        />
        {value ? (
          <Pressable
            onPress={onClear}
            accessibilityRole="button"
            accessibilityLabel={clearLabel}
            style={({ pressed }) => [styles.clear, pressed && styles.clearPressed]}
          >
            <LtIcon name="close" size={20} color={LT.ink2} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  /** The focus ring's room: 2pt ring + 2pt gap on every side, cancelled by a negative margin so the pill sits exactly where the board draws it (16 under the heading, 20 above the band's edge). */
  ring: {
    margin: -4,
    padding: 2,
    borderWidth: 2,
    borderColor: "transparent",
    borderRadius: LT_RADIUS.round,
  },
  ringOn: { borderColor: LT.indigo },
  field: { justifyContent: "center" },
  /** Board `.lt-drpill > svg`: the 20 magnifier 18 in, centred in the 54 pill. */
  magnifier: { position: "absolute", left: 18, top: 17, zIndex: 1 },
  input: {
    height: 54,
    paddingLeft: 48,
    paddingRight: 14,
    paddingVertical: 0,
    backgroundColor: LT.white,
    borderWidth: 1,
    borderColor: LT.field,
    borderRadius: LT_RADIUS.round,
    boxShadow: LT_SHADOW.s1,
    fontSize: 17,
    color: LT.ink,
  },
  inputWithClear: { paddingRight: 52 },
  /** The 44 clear button sits 5 down and 6 in, centred in the pill's 54; round (not lt-base's 8), so its pressed fill never pokes past the pill's curve. */
  clear: {
    position: "absolute",
    top: 5,
    right: 6,
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: LT_RADIUS.round,
  },
  clearPressed: { backgroundColor: LT.cream2 },
});
