import {
  Button,
  Checkbox,
  FormWrapper,
  InfoMessage,
  Input,
  Text,
} from "@serenity-tools/ui";
import { useState } from "react";
import { Platform, useWindowDimensions } from "react-native";
import { useClient } from "urql";
import { useAppContext } from "../../context/AppContext";
import {
  useFinishLoginMutation,
  useStartLoginMutation,
} from "../../generated/graphql";
import { clearDeviceAndSessionStorage } from "../../utils/authentication/clearDeviceAndSessionStorage";
import { createDeviceWithInfo } from "../../utils/authentication/createDeviceWithInfo";
import { fetchMainDevice, login } from "../../utils/authentication/loginHelper";
import { setDevice } from "../../utils/device/deviceStore";
import {
  removeWebDevice,
  setWebDevice,
} from "../../utils/device/webDeviceStore";
import { attachDeviceToWorkspaces } from "../../utils/workspace/attachDeviceToWorkspaces";

type Props = {
  defaultEmail?: string;
  onLoginSuccess?: () => void;
  onLoginFail?: () => void;
  onEmailChangeText?: (username: string) => void;
  onFormFilled?: () => void;
};

export function LoginForm(props: Props) {
  useWindowDimensions(); // needed to ensure tw-breakpoints are triggered when resizing
  let defaultUseExtendedLogin = true;
  if (Platform.OS === "ios") {
    defaultUseExtendedLogin = true;
  }
  const [username, _setUsername] = useState("");
  const [password, _setPassword] = useState("");
  const [useExtendedLogin, setUseExtendedLogin] = useState(
    defaultUseExtendedLogin
  );
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [gqlErrorMessage, setGqlErrorMessage] = useState("");

  const { updateAuthentication, updateActiveDevice } = useAppContext();
  const [, startLoginMutation] = useStartLoginMutation();
  const [, finishLoginMutation] = useFinishLoginMutation();
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
      await clearDeviceAndSessionStorage();

      const unsafedDevice = await createDeviceWithInfo();

      const loginResult = await login({
        username,
        password,
        startLoginMutation,
        finishLoginMutation,
        updateAuthentication,
        device: unsafedDevice,
        urqlClient,
        useExtendedLogin,
      });
      const exportKey = loginResult.exportKey;
      // reset the password in case the user ends up on this screen again
      await fetchMainDevice({ urqlClient, exportKey });

      if (Platform.OS === "web") {
        if (!useExtendedLogin) {
          await removeWebDevice();
        }
        await setWebDevice(unsafedDevice, useExtendedLogin);
        await updateActiveDevice();
      } else if (Platform.OS === "ios") {
        if (useExtendedLogin) {
          await setDevice(unsafedDevice);
          await updateActiveDevice();
        }
      }
      try {
        await attachDeviceToWorkspaces({ urqlClient });
      } catch (error) {
        // TOOD: handle error
        console.error(error);
        return;
      }

      setPassword("");
      setUsername("");
      setIsLoggingIn(false);
      if (props.onLoginSuccess) {
        props.onLoginSuccess();
      }
    } catch (error) {
      console.error(error);
      setGqlErrorMessage(
        "Failed to login due incorrect credentials or a network issue. Please try again."
      );
      setIsLoggingIn(false);
      if (props.onLoginFail) {
        props.onLoginFail();
      }
    }
  };

  return (
    <FormWrapper>
      <Input
        label={"Email"}
        keyboardType="email-address"
        value={username}
        onChangeText={(username: string) => {
          setUsername(username);
        }}
        placeholder="Enter your email …"
        autoCapitalize="none"
      />

      <Input
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

      {gqlErrorMessage !== "" ? (
        <InfoMessage variant="error" icon>
          {gqlErrorMessage}
        </InfoMessage>
      ) : null}

      <Button onPress={onLoginPress} disabled={isLoggingIn}>
        Log in
      </Button>
    </FormWrapper>
  );
}
