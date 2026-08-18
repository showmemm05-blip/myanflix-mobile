import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { AuthNavigator } from "@/navigation/AuthNavigator";
import { MainTabNavigator } from "@/navigation/MainTabNavigator";
import { PlayerScreen } from "@/screens/Player/Player";
import { NotificationsScreen } from "@/screens/Notifications/Notifications";
import { ProfileOverviewScreen } from "@/screens/Profile/ProfileOverview";
import { useAuth } from "@/hooks/useAuth";
import { useRealtimeWallet } from "@/hooks/useRealtimeWallet";
import { stackScreenOptions } from "@/navigation/options";
import type { RootStackParamList } from "@/navigation/types";

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const { isAuthenticated } = useAuth();
  useRealtimeWallet();

  return (
    <Stack.Navigator screenOptions={stackScreenOptions}>
      {isAuthenticated ? (
        <>
          <Stack.Screen name="Main" component={MainTabNavigator} />
          <Stack.Screen name="Player" component={PlayerScreen} options={{ presentation: "fullScreenModal" }} />
          <Stack.Screen name="Notifications" component={NotificationsScreen} />
          <Stack.Screen name="Profile" component={ProfileOverviewScreen} />
        </>
      ) : (
        <Stack.Screen name="Auth" component={AuthNavigator} />
      )}
    </Stack.Navigator>
  );
}
