import { useNavigation, type CompositeNavigationProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import type { MainTabParamList, RootStackParamList, SearchStackParamList } from "@/navigation/types";

/**
 * The navigation a hub sees. The three hubs are the bodies of the Media tab's
 * Movies / Series / Books chips, rendered INSIDE the tab's root screen (the
 * route still called "Search"), so they push onto the Media tab's own stack
 * (details, the filters page, the people and author lists, Browse) — back
 * returns to the hub — and reach the root stack above the tabs for the
 * Player and the book reader.
 */
export type MediaTabNavigation = CompositeNavigationProp<
  NativeStackNavigationProp<SearchStackParamList, "Search">,
  CompositeNavigationProp<BottomTabNavigationProp<MainTabParamList>, NativeStackNavigationProp<RootStackParamList>>
>;

export function useMediaTabNavigation(): MediaTabNavigation {
  return useNavigation<MediaTabNavigation>();
}
