import React, { useEffect, useState } from "react";
import {
  Button,
  LabeledInput,
  Text,
  View,
  Link,
  tw,
  Checkbox,
} from "@serenity-tools/ui";
import { Platform, useWindowDimensions } from "react-native";
import { VStack } from "native-base";
import {
  useStartLoginMutation,
  useFinishLoginMutation,
  useCreateDeviceMutation,
} from "../../generated/graphql";
import { useAuthentication } from "../../context/AuthenticationContext";
import { login, fetchMainDevice } from "../../utils/login/loginHelper";
import { createAndEncryptWebDevice } from "../../utils/webDevice/createAndEncryptWebDevice";
import { useClient } from "urql";

type Props = {
  defaultEmail?: string;
  onLoginSuccess: () => void;
  onLoginFail?: () => void;
  onEmailChangeText?: (username: string) => void;
  onFormFilled?: () => void;
};

export function LoginForm(props: Props) {
  useWindowDimensions(); // needed to ensure tw-breakpoints are triggered when resizing
  const [username, _setUsername] = useState("");
  const [password, _setPassword] = useState("");
  const [useExtendedLogin, setUseExtendedLogin] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [gqlErrorMessage, setGqlErrorMessage] = useState("");

  const { updateAuthentication } = useAuthentication();
  const [, startLoginMutation] = useStartLoginMutation();
  const [, finishLoginMutation] = useFinishLoginMutation();
  const [, createDeviceMutation] = useCreateDeviceMutation();
  const urqlClient = useClient();

  const onFormFilled = (username: string, password: string) => {
    if (props.onFormFilled) {
      props.onFormFilled();
    }
  };

  const setUsername = (username: string) => {
    _setUsername(username);
    if (props.onEmailChangeText) {
      props.onEmailChangeText(username);
    }
    onFormFilled(username, password);
  };

  const setPassword = (password: string) => {
    _setPassword(password);
  };

  const onLoginPress = async () => {
    try {
      setGqlErrorMessage("");
      setIsLoggingIn(true);
      const loginResult = await login({
        username,
        password,
        startLoginMutation,
        finishLoginMutation,
        updateAuthentication,
      });
      setPassword("");
      setUsername("");
      const exportKey = loginResult.exportKey;
      await fetchMainDevice({ urqlClient, exportKey });
      // reset the password in case the user ends up on this screen again
      if (Platform.OS === "web" && useExtendedLogin) {
        const {
          signingPrivateKey,
          encryptionPrivateKey,
          encryptionKeySalt,
          ciphertext,
          nonce,
          ...webDevice
        } = await createAndEncryptWebDevice(exportKey);
        await createDeviceMutation({
          input: webDevice,
        });
      }
      setIsLoggingIn(false);
      props.onLoginSuccess();
    } catch (error) {
      console.error(error);
      setGqlErrorMessage("Failed to login.");
      setIsLoggingIn(false);
      if (props.onLoginFail) {
        props.onLoginFail();
      }
    }
  };

  return (
    <VStack space="5">
      {gqlErrorMessage !== "" && (
        <View>
          <Text>{gqlErrorMessage}</Text>
        </View>
      )}
      <LabeledInput
        label={"Email"}
        keyboardType="email-address"
        value={username}
        onChangeText={(username: string) => {
          setUsername(username);
        }}
        placeholder="Enter your email …"
        autoCapitalize="none"
      />

      <LabeledInput
        label={"Password"}
        secureTextEntry
        value={password}
        onChangeText={(password: string) => {
          setPassword(password);
        }}
        placeholder="Enter your password …"
      />
      {Platform.OS === "web" && (
        <Checkbox
          value={"useExtendedLogin"}
          isChecked={useExtendedLogin}
          onChange={setUseExtendedLogin}
          accessibilityLabel="This is a remember-my login checkbox"
        >
          <Text variant="xs" muted>
            Stay logged in for 30 days
          </Text>
        </Checkbox>
      )}
      <Button onPress={onLoginPress} size="large" disabled={isLoggingIn}>
        Log in
      </Button>
      <View style={tw`text-center`}>
        <Text variant="xs" muted>
          Don't have an account?{" "}
        </Text>
        <Text variant="xs">
          <Link to={{ screen: "Register" }}>Register here</Link>
        </Text>
      </View>
    </VStack>
  );
}
