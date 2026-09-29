import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { SettingsScreen } from "@/screens/Settings/Settings";
import { stackScreenOptions } from "@/navigation/options";
import type { SettingsStackParamList } from "@/navigation/types";

const Stack = createNativeStackNavigator<SettingsStackParamList>();

export function SettingsStackNavigator() {
  return (
    <Stack.Navigator screenOptions={stackScreenOptions}>
      <Stack.Screen name="Settings" component={SettingsScreen} />
    </Stack.Navigator>
  );
}
