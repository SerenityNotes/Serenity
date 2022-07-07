import React, { useState } from "react";
import {
  Text,
  View,
  Box,
  tw,
  Button,
  LabeledInput,
  InfoMessage,
} from "@serenity-tools/ui";
import { RootStackScreenProps } from "../../types/navigation";
import {
  useCreateDeviceMutation,
  useVerifyRegistrationMutation,
} from "../../generated/graphql";
import {
  isUsernamePasswordStored,
  getStoredUsername,
  getStoredPassword,
  deleteStoredUsernamePassword,
} from "../../utils/authentication/registrationMemoryStore";
import {
  useStartLoginMutation,
  useFinishLoginMutation,
  MainDeviceQuery,
  MainDeviceDocument,
} from "../../generated/graphql";
import { useAuthentication } from "../../context/AuthenticationContext";
import {
  login,
  fetchMainDevice,
  navigateToNextAuthenticatedPage,
  createSetAndRegisterDevice,
} from "../../utils/authentication/loginHelper";
import { useClient } from "urql";
import { Platform } from "react-native";
import { detect } from "detect-browser";
import { createAndSetDevice } from "../../utils/device/deviceStore";
const browser = detect();

export default function RegistrationVerificationScreen(
  props: RootStackScreenProps<"RegistrationVerification">
) {
  const [, verifyRegistrationMutation] = useVerifyRegistrationMutation();
  const [verificationCode, setVerificationCode] = useState(
    props.route.params.verification || ""
  );
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const { updateAuthentication } = useAuthentication();
  const [, startLoginMutation] = useStartLoginMutation();
  const [, finishLoginMutation] = useFinishLoginMutation();
  const [, createDeviceMutation] = useCreateDeviceMutation();
  const urqlClient = useClient();

  const navigateToLoginScreen = () => {
    props.navigation.push("Login", {});
  };

  const registerNewDevice = async () => {
    if (Platform.OS == "ios") {
      const newDeviceInfo = await createSetAndRegisterDevice();
      await createDeviceMutation({
        input: newDeviceInfo,
      });
    }
  };

  const loginWithStoredUsernamePassword = async () => {
    const username = getStoredUsername();
    const password = getStoredPassword();
    deleteStoredUsernamePassword();
    if (!username || !password) {
      navigateToLoginScreen();
      return;
    }
    try {
      setErrorMessage("");
      setIsLoggingIn(true);
      const loginResult = await login({
        username,
        password,
        startLoginMutation,
        finishLoginMutation,
        updateAuthentication,
      });
      await fetchMainDevice({ urqlClient, exportKey: loginResult.exportKey });
      setIsLoggingIn(false);
      navigateToNextAuthenticatedPage(props.navigation);
    } catch (error) {
      console.error(error);
      setErrorMessage("Failed to login.");
      setIsLoggingIn(false);
    }
  };

  const onSubmit = async () => {
    if (!props.route.params.username) {
      setErrorMessage("Something went wrong. Email is missing.");
      return;
    }
    try {
      const verifyRegistrationResult = await verifyRegistrationMutation({
        input: {
          username: props.route.params.username,
          verificationCode,
        },
      });
      if (!verifyRegistrationResult.data?.verifyRegistration) {
        setErrorMessage("Verification failed.");
        return;
      }
      if (isUsernamePasswordStored()) {
        await loginWithStoredUsernamePassword();
      } else {
        await registerNewDevice();
        navigateToLoginScreen();
      }
    } catch (err) {
      setErrorMessage("Verification failed.");
    }
  };

  return (
    <View
      style={tw`bg-white xs:bg-primary-900 justify-center items-center flex-auto`}
    >
      <Box>
        <View>
          <Text variant="large" bold style={tw`text-center`}>
            Verify your Email
          </Text>
          <Text muted style={tw`text-center`}>
            Please enter the verification code{"\n"}sent to you via Email.
          </Text>
        </View>

        {errorMessage ? (
          <InfoMessage variant="error" icon>
            <Text>{errorMessage}</Text>
          </InfoMessage>
        ) : null}

        <LabeledInput
          label={"Verification Code"}
          value={verificationCode}
          onChangeText={(verificationCode: string) => {
            setVerificationCode(verificationCode);
          }}
          placeholder="Enter the verification code …"
        />

        <InfoMessage>
          Note: The verification code is prefilled on staging.
        </InfoMessage>

        <Button onPress={onSubmit} size="large">
          Register
        </Button>
      </Box>
    </View>
  );
}
