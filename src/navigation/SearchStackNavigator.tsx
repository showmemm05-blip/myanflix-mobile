import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { SearchScreen } from "@/screens/Search/Search";
import { stackScreenOptions } from "@/navigation/options";
import type { SearchStackParamList } from "@/navigation/types";

const Stack = createNativeStackNavigator<SearchStackParamList>();

export function SearchStackNavigator() {
  return (
    <Stack.Navigator screenOptions={stackScreenOptions}>
      <Stack.Screen name="Search" component={SearchScreen} />
    </Stack.Navigator>
  );
}
