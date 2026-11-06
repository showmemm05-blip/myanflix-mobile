import { StyleSheet, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator, type NativeStackNavigationOptions } from "@react-navigation/native-stack";
import { stackScreenOptions } from "@/navigation/options";
import { LotteryDock } from "@/lottery/components/LotteryDock";
import { LtToastProvider } from "@/lottery/components/LtToast";
import { useLotteryPresence } from "@/lottery/hooks/useLotteryPresence";
import type {
  LotteryDrawStackParamList,
  LotteryHomeStackParamList,
  LotteryResultsStackParamList,
  LotteryTabParamList,
  LotteryTicketsStackParamList,
} from "@/lottery/navigation/types";
import { LotteryCheckTicketsScreen } from "@/lottery/screens/checktickets/LotteryCheckTicketsScreen";
import { LotteryDreamBookScreen } from "@/lottery/screens/dreams/LotteryDreamBookScreen";
import { LotteryDreamTicketsScreen } from "@/lottery/screens/dreams/LotteryDreamTicketsScreen";
import { LotteryDrawScreen } from "@/lottery/screens/draw/LotteryDrawScreen";
import { LotteryPrintedScreen } from "@/lottery/screens/draw/LotteryPrintedScreen";
import { LotteryHistoryScreen } from "@/lottery/screens/history/LotteryHistoryScreen";
import { LotteryHomeScreen } from "@/lottery/screens/home/LotteryHomeScreen";
import { LotteryResultsScreen } from "@/lottery/screens/results/LotteryResultsScreen";
import { LotteryTicketViewScreen } from "@/lottery/screens/tickets/LotteryTicketViewScreen";
import { LotteryTicketsScreen } from "@/lottery/screens/tickets/LotteryTicketsScreen";
import { LtFontsContext, useLotteryFonts } from "@/lottery/theme/fonts";
import { useLanguageStore } from "@/store/languageStore";
import { LT } from "@/lottery/theme/tokens";

const Tab = createBottomTabNavigator<LotteryTabParamList>();
const HomeStack = createNativeStackNavigator<LotteryHomeStackParamList>();
const DrawStack = createNativeStackNavigator<LotteryDrawStackParamList>();
const TicketsStack = createNativeStackNavigator<LotteryTicketsStackParamList>();
const ResultsStack = createNativeStackNavigator<LotteryResultsStackParamList>();

/** The app's push (iPhone-style slide, no headers) on warm paper, so a push never flashes the dark ground. */
const ltStackOptions: NativeStackNavigationOptions = {
  ...stackScreenOptions,
  contentStyle: { backgroundColor: LT.paper },
};

function LotteryHomeStack() {
  return (
    <HomeStack.Navigator screenOptions={ltStackOptions}>
      <HomeStack.Screen name="LotteryHome" component={LotteryHomeScreen} />
      <HomeStack.Screen name="LotteryDreamBook" component={LotteryDreamBookScreen} />
      <HomeStack.Screen name="LotteryDreamTickets" component={LotteryDreamTicketsScreen} />
    </HomeStack.Navigator>
  );
}

function LotteryDrawStack() {
  return (
    <DrawStack.Navigator screenOptions={ltStackOptions}>
      <DrawStack.Screen name="LotteryDraw" component={LotteryDrawScreen} />
      <DrawStack.Screen name="LotteryPrinted" component={LotteryPrintedScreen} />
    </DrawStack.Navigator>
  );
}

/** Results + Check my tickets (round 2): the reveal is pushed here, so the dock keeps Results current and Back returns to it. */
function LotteryResultsStack() {
  return (
    <ResultsStack.Navigator screenOptions={ltStackOptions}>
      <ResultsStack.Screen name="LotteryResults" component={LotteryResultsScreen} />
      <ResultsStack.Screen name="CheckTickets" component={LotteryCheckTicketsScreen} />
    </ResultsStack.Navigator>
  );
}

function LotteryTicketsStack() {
  return (
    <TicketsStack.Navigator screenOptions={ltStackOptions}>
      <TicketsStack.Screen name="LotteryTickets" component={LotteryTicketsScreen} />
      <TicketsStack.Screen name="LotteryTicketView" component={LotteryTicketViewScreen} />
    </TicketsStack.Navigator>
  );
}

/**
 * THE THAI LOTTERY APP — the root "Lottery" screen (RootNavigator), so the
 * main MyanFlix dock is never on screen inside it. Since phase 2 (2026-10-19)
 * the dreams, draws, purchases, tickets and the wallet are the API's; Results
 * and Check my tickets are still the sample set (src/lottery/data).
 *
 * In order: the fonts gate (a plain paper view until the eight faces are in or
 * have failed — never the dark ground, never a flash of system type), the
 * fonts flag, the Lottery's own toast host, five tabs with the Ivory dock,
 * and a DARK status bar for the white app (App.tsx's light one returns by
 * itself when this unmounts: status bars stack, the last mounted wins).
 *
 * Tabs: Home, Draw, Results and Tickets have their own stacks — the Dream
 * pages are Home's, Printed is Draw's, Check my tickets is Results', TicketView
 * is Tickets' — so the dock keeps its current tab on every page, as on the
 * boards. `history`: the phone's back
 * key returns to the tab you came from, then leaves the Lottery.
 *
 * `useLotteryPresence` is mounted here and nowhere else: a signed-in visitor
 * is reported to POST /lottery/activity for as long as this navigator lives.
 */
export function LotteryNavigator() {
  const { loaded, failed } = useLotteryFonts();
  // The Lottery speaks the app's language (lottery/i18n.ts). Switching it
  // remounts the tabs, so memoised rows and cached strings start over in the
  // new language; the reader lands on the Lottery's Home again.
  const language = useLanguageStore((s) => s.language);
  // The presence ping (analytics): once for the whole Lottery, so every tab and page counts.
  useLotteryPresence();

  if (!loaded && !failed) {
    return (
      <View style={styles.root}>
        <StatusBar style="dark" />
      </View>
    );
  }

  return (
    <LtFontsContext.Provider value={failed}>
      {/* The toast host is drawn last inside this view, over the tabs and the dock. */}
      <View style={styles.root}>
        <LtToastProvider>
          <Tab.Navigator
            key={language}
            backBehavior="history"
            screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: LT.paper } }}
            tabBar={(props) => <LotteryDock {...props} />}
          >
            <Tab.Screen name="LotteryHomeTab" component={LotteryHomeStack} />
            <Tab.Screen name="LotteryDrawTab" component={LotteryDrawStack} />
            <Tab.Screen name="LotteryResultsTab" component={LotteryResultsStack} />
            <Tab.Screen name="LotteryTicketsTab" component={LotteryTicketsStack} />
            <Tab.Screen name="LotteryHistoryTab" component={LotteryHistoryScreen} />
          </Tab.Navigator>
        </LtToastProvider>
      </View>
      <StatusBar style="dark" />
    </LtFontsContext.Provider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: LT.paper },
});
