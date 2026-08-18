import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { WalletScreen } from "@/screens/Wallet/Wallet";
import { TransactionsScreen } from "@/screens/Wallet/Transactions";
import { stackScreenOptions } from "@/navigation/options";
import type { WalletStackParamList } from "@/navigation/types";

const Stack = createNativeStackNavigator<WalletStackParamList>();

export function WalletStackNavigator() {
  return (
    <Stack.Navigator screenOptions={stackScreenOptions}>
      <Stack.Screen name="Wallet" component={WalletScreen} />
      <Stack.Screen name="Transactions" component={TransactionsScreen} />
    </Stack.Navigator>
  );
}
