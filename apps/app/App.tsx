import "expo-dev-client";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";

import useCachedResources from "./hooks/useCachedResources";
import { tw } from "@serenity-tools/ui";
import Navigation from "./navigation/Navigation";
import { useDeviceContext, useAppColorScheme } from "twrnc";
import {
  createClient,
  makeOperation,
  Provider,
  fetchExchange,
  dedupExchange,
} from "urql";
import { cacheExchange } from "@urql/exchange-graphcache";
import { NativeBaseProvider, extendTheme } from "native-base";
import { authExchange } from "@urql/exchange-auth";
import {
  useFonts,
  // Inter options can be found here https://github.com/expo/google-fonts/tree/master/font-packages/inter
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";
import { Platform } from "react-native";
import { AuthenticationProvider } from "./context/AuthenticationContext";
import { useCallback, useMemo, useState } from "react";
import { devtoolsExchange } from "@urql/devtools";
import { theme } from "../../tailwind.config";
import { OpaqueBridge } from "@serenity-tools/opaque";

type AuthState = {
  deviceSigningPublicKey: string;
};

const unauthenticatedOperation = [
  "startRegistration",
  "finishRegistration",
  "startLogin",
  "finishLogin",
];

const exchanges = [
  dedupExchange,
  cacheExchange({}),
  authExchange<AuthState>({
    // if it fails it will run getAuth again and see if the client already logged in in the meantime
    willAuthError: ({ operation, authState }) => {
      if (!authState) {
        // detect the unauthenticated mutations and let this operations through
        return !(
          operation.kind === "mutation" &&
          operation.query.definitions.some((definition) => {
            return (
              definition.kind === "OperationDefinition" &&
              definition.selectionSet.selections.some((node) => {
                return (
                  node.kind === "Field" &&
                  unauthenticatedOperation.includes(node.name.value)
                );
              })
            );
          })
        );
      }

      return false;
    },
    getAuth: async ({ authState }) => {
      if (!authState) {
        const deviceSigningPublicKey =
          Platform.OS === "web"
            ? localStorage.getItem("deviceSigningPublicKey")
            : "mockedForMobile";

        if (deviceSigningPublicKey) {
          return { deviceSigningPublicKey };
        }
        return null;
      }

      return null;
    },
    addAuthToOperation: ({ authState, operation }) => {
      if (!authState || !authState.deviceSigningPublicKey) {
        return operation;
      }

      const fetchOptions =
        typeof operation.context.fetchOptions === "function"
          ? operation.context.fetchOptions()
          : operation.context.fetchOptions || {};

      return makeOperation(operation.kind, operation, {
        ...operation.context,
        fetchOptions: {
          ...fetchOptions,
          headers: {
            ...fetchOptions.headers,
            Authorization: authState.deviceSigningPublicKey,
          },
        },
      });
    },
  }),
  fetchExchange,
];

export default function App() {
  const [deviceSigningPublicKey, setDeviceSigningPublicKey] = useState(() => {
    // to mocked for the mobile dev
    if (Platform.OS === "ios") {
      return "mockedForMobile";
    }
    return localStorage.getItem("deviceSigningPublicKey");
  });
  const updateAuthentication = useCallback(
    (deviceSigningPublicKey: string | null) => {
      if (deviceSigningPublicKey) {
        localStorage.setItem("deviceSigningPublicKey", deviceSigningPublicKey);
        setDeviceSigningPublicKey(deviceSigningPublicKey);
      } else {
        localStorage.removeItem("deviceSigningPublicKey");
        setDeviceSigningPublicKey(null);
      }
    },
    [setDeviceSigningPublicKey]
  );

  const isLoadingComplete = useCachedResources();
  const [isFontLoadingComplete] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  useDeviceContext(tw);
  const [colorScheme] = useAppColorScheme(tw);
  const rnTheme = extendTheme({
    colors: {
      ...theme.colors,
    },
  });

  // recreate client and especially the internal cache every time the authentication state changes
  const client = useMemo(() => {
    return createClient({
      url:
        process.env.NODE_ENV === "development"
          ? "http://localhost:4000/graphql"
          : "https://serenity-staging-api.herokuapp.com/graphql",
      requestPolicy: "cache-and-network",
      exchanges:
        process.env.NODE_ENV === "development"
          ? [devtoolsExchange, ...exchanges]
          : exchanges,
    });
  }, [deviceSigningPublicKey]);

  if (!isLoadingComplete || !isFontLoadingComplete) {
    return null;
  } else {
    return (
      <AuthenticationProvider
        value={{
          updateAuthentication,
          deviceSigningPublicKey,
        }}
      >
        <Provider value={client}>
          <SafeAreaProvider>
            <NativeBaseProvider theme={rnTheme}>
              <Navigation colorScheme={colorScheme} />
              <StatusBar />
              <OpaqueBridge />
            </NativeBaseProvider>
          </SafeAreaProvider>
        </Provider>
      </AuthenticationProvider>
    );
  }
}
