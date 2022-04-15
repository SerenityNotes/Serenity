import {
  NavigationContainer,
  DefaultTheme,
  DarkTheme,
} from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ColorSchemeName } from "react-native";

import NotFoundScreen from "../screens/NotFoundScreen";
import EditorScreen from "../screens/EditorScreen";
import { RootStackParamList } from "../types";
import LinkingConfiguration from "./linkingConfiguration";
import DashboardScreen from "../screens/DashboardScreen";
import TestEditorScreen from "../screens/TestEditorScreen";
import LibsodiumTestScreen from "../screens/LibsodiumTestScreen";
import RegisterScreen from "../screens/RegisterScreen";
import LoginScreen from "../screens/LoginScreen";
import DesignSystemScreen from "../screens/DesignSystemScreen";

export default function Navigation({
  colorScheme,
}: {
  colorScheme: ColorSchemeName;
}) {
  return (
    <NavigationContainer
      linking={LinkingConfiguration}
      theme={colorScheme === "dark" ? DarkTheme : DefaultTheme}
    >
      <RootNavigator />
    </NavigationContainer>
  );
}

/**
 * A root stack navigator is often used for displaying modals on top of all other content.
 * https://reactnavigation.org/docs/modal
 */
const Stack = createNativeStackNavigator<RootStackParamList>();

function RootNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="dashboard"
        component={DashboardScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen name="design-system" component={DesignSystemScreen} />
      <Stack.Screen name="editor" component={EditorScreen} />
      <Stack.Screen name="test-editor" component={TestEditorScreen} />
      <Stack.Screen name="test-libsodium" component={LibsodiumTestScreen} />
      <Stack.Screen name="register" component={RegisterScreen} />
      <Stack.Screen name="login" component={LoginScreen} />
      <Stack.Screen
        name="notFound"
        component={NotFoundScreen}
        options={{ title: "Oops!" }}
      />
    </Stack.Navigator>
  );
}
