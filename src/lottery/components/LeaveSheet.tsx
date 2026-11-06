import { Pressable, StyleSheet, View } from "react-native";
import { LtButton } from "@/lottery/components/LtButton";
import { LtIcon, type LtIconName } from "@/lottery/components/LtIcon";
import { LtSheet } from "@/lottery/components/LtSheet";
import { LtText } from "@/lottery/components/LtText";
import { LT_COPY } from "@/lottery/copy";
import { useExitLottery, useExitToMyanFlix } from "@/lottery/navigation/useExitLottery";
import { useOpenWallet } from "@/lottery/navigation/useOpenWallet";
import { ltComma } from "@/lottery/i18n";
import { LT, LT_RADIUS } from "@/lottery/theme/tokens";

/**
 * "LEAVE THE LOTTERY?" — the emblem chip's sheet (Main and Draw boards
 * `.lt-leave`; owner, 23 Oct 2026: users tapped the old bare "‹" by accident
 * and lost their place in the lottery, so leaving is a choice now). An
 * LtSheet with three 64pt rows in the menu-item style — an icon on a 40pt
 * cream disc, the place, one small line of what is there — and one
 * ghost "Stay here" (the plain 48pt button, stretched) across the foot, with no
 * hairline over it.
 *
 * The head carries the title alone (the board draws no X here: "Stay here" is
 * the close, and the scrim, the drag and the phone's back key close it too,
 * all through LtSheet). Lottery games → the dark Lottery hub
 * (useExitLottery); Back to MyanFlix → the main Home tab (useExitToMyanFlix);
 * Wallet → the MyanFlix wallet page (useOpenWallet; owner, 27 Oct 2026 — it
 * replaced the balance chip's sheet). Each closes the sheet first. Guests can
 * leave too: nothing here needs an account. Motion and reduced motion are
 * LtSheet's.
 */
export function LeaveSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const toHub = useExitLottery();
  const toMyanFlix = useExitToMyanFlix();
  const openWallet = useOpenWallet();
  const games = () => {
    onClose();
    toHub();
  };
  const myanflix = () => {
    onClose();
    toMyanFlix();
  };
  const wallet = () => {
    onClose();
    openWallet();
  };

  return (
    <LtSheet
      visible={visible}
      onClose={onClose}
      title={LT_COPY.leave.title}
      closeLabel={LT_COPY.leave.closeA11y}
      header={
        <View style={styles.head}>
          <LtText role="title" accessibilityRole="header" numberOfLines={2}>
            {LT_COPY.leave.title}
          </LtText>
        </View>
      }
      bodyStyle={styles.list}
      footerDivider={false}
      footer={<LtButton variant="ghost" label={LT_COPY.leave.stay} onPress={onClose} style={styles.stay} />}
    >
      <LeaveRow icon="tickets" label={LT_COPY.leave.games} sub={LT_COPY.leave.gamesSub} onPress={games} />
      <LeaveRow icon="film" label={LT_COPY.leave.myanflix} sub={LT_COPY.leave.myanflixSub} onPress={myanflix} />
      <LeaveRow icon="wallet" label={LT_COPY.leave.wallet} sub={LT_COPY.leave.walletSub} onPress={wallet} />
    </LtSheet>
  );
}

/** One place to go (board `.lt-menu__item.lt-leave__item`): the disc, the name, the sub-line; pressed = cream-2. */
function LeaveRow({ icon, label, sub, onPress }: { icon: LtIconName; label: string; sub: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}${ltComma()} ${sub}`}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <View style={styles.disc}>
        <LtIcon name={icon} size={20} color={LT.ink2} />
      </View>
      <View style={styles.text}>
        <LtText role="metaB" numberOfLines={1}>
          {label}
        </LtText>
        <LtText role="caption" numberOfLines={2}>
          {sub}
        </LtText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  /** LtSheet's own head without the X: 60 tall, the title on the left (board `.lt-sheet__head`). */
  head: { justifyContent: "center", minHeight: 60, paddingVertical: 4, paddingHorizontal: 16 },
  /** Board `.lt-leave__list`: 0 8 4, so the rows' own 10 brings their text to the 16 gutter + 2. */
  list: { paddingTop: 0, paddingHorizontal: 8, paddingBottom: 4 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 64,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: LT_RADIUS.input,
  },
  rowPressed: { backgroundColor: LT.cream2 },
  disc: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: LT.cream,
    borderWidth: 1,
    borderColor: LT.line,
  },
  text: { flex: 1, minWidth: 0 },
  /** Board `.lt-sheet__foot .lt-btn`: the plain 48 button stretched across the foot (the foot is a row, so flex: 1 is the width). */
  stay: { flex: 1, paddingHorizontal: 12 },
});
