import React, { useEffect, useState } from "react";
import { Text, View, tw, Box, Button, LinkButton } from "@serenity-tools/ui";
import {
  useWindowDimensions,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { useAuthentication } from "../../context/AuthenticationContext";
import {
  useAcceptWorkspaceInvitationMutation,
  useWorkspaceInvitationQuery,
  WorkspaceInvitation,
  WorkspaceInvitationDocument,
  WorkspaceInvitationQuery,
  WorkspaceInvitationQueryVariables,
} from "../../generated/graphql";
import { RootStackScreenProps } from "../../types/navigation";
import { LoginForm } from "../../components/login/LoginForm";
import RegisterForm from "../../components/register/RegisterForm";
import { acceptWorkspaceInvitation } from "../../utils/workspace/acceptWorkspaceInvitation";
import { useClient } from "urql";

export default function AcceptWorkspaceInvitationScreen(
  props: RootStackScreenProps<"AcceptWorkspaceInvitation">
) {
  const workspaceInvitationId = props.route.params?.workspaceInvitationId;
  useWindowDimensions(); // needed to ensure tw-breakpoints are triggered when resizing
  const { sessionKey } = useAuthentication();
  const urqlClient = useClient();
  const [workspaceInvitation, setWorkspaceInvitation] = useState<
    WorkspaceInvitation | undefined
  >();
  const [, acceptWorkspaceInvitationMutation] =
    useAcceptWorkspaceInvitationMutation();
  const [hasGraphqlError, setHasGraphqlError] = useState<boolean>(false);
  const [graphqlError, setGraphqlError] = useState<string>("");
  const [authForm, setAuthForm] = useState<"login" | "register">("login");

  const getWorskpaceInvitation = async (workspaceInvitationId: string) => {
    const workspaceInvitationResult = await urqlClient
      .query<WorkspaceInvitationQuery, WorkspaceInvitationQueryVariables>(
        WorkspaceInvitationDocument,
        { id: workspaceInvitationId },
        {
          // better to be safe here and always refetch
          requestPolicy: "network-only",
        }
      )
      .toPromise();
    if (
      workspaceInvitationResult.error ||
      !workspaceInvitationResult.data?.workspaceInvitation
    ) {
      props.navigation.replace("WorkspaceNotFound");
      return;
    }
    setWorkspaceInvitation(workspaceInvitationResult.data.workspaceInvitation);
  };

  useEffect(() => {
    if (workspaceInvitationId) {
      getWorskpaceInvitation(workspaceInvitationId);
    }
  }, []);

  if (!workspaceInvitationId) {
    return (
      <View>
        <Text>Invalid invitation.</Text>
      </View>
    );
  }
  const acceptAndGoToWorkspace = async () => {
    try {
      const workspace = await acceptWorkspaceInvitation({
        workspaceInvitationId,
        acceptWorkspaceInvitationMutation,
      });
      props.navigation.navigate("Workspace", {
        workspaceId: workspace!.id,
        screen: "WorkspaceRoot",
      });
    } catch (error) {
      setHasGraphqlError(true);
      setGraphqlError(error.message);
    }
  };

  const switchToRegisterForm = () => {
    setAuthForm("register");
  };

  const switchToLoginForm = () => {
    setAuthForm("login");
  };

  const onRegisterSuccess = (username: string, verificationCode: string) => {
    props.navigation.navigate("RegistrationVerification", {
      username,
      verification: verificationCode,
    });
  };

  const onLoginSuccess = async () => {
    await acceptAndGoToWorkspace();
  };

  const onAcceptWorkspaceInvitationPress = async () => {
    await acceptAndGoToWorkspace();
  };

  return (
    <>
      {hasGraphqlError && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{graphqlError}</Text>
        </View>
      )}
      <View
        style={tw`bg-white xs:bg-primary-900 justify-center items-center flex-auto`}
      >
        <Box>
          {workspaceInvitation && (
            <View style={styles.alertBanner}>
              <Text style={styles.alertBannerText}>
                You have been invited to join workspace{" "}
                <b>{workspaceInvitation?.workspaceName}</b> by{" "}
                <b>{workspaceInvitation?.inviterUsername}</b>
              </Text>
              {!sessionKey && (
                <Text style={styles.alertBannerText}>
                  Log in or register to accept the invitation.
                </Text>
              )}
            </View>
          )}
          {sessionKey ? (
            <Button onPress={onAcceptWorkspaceInvitationPress} size="large">
              Accept
            </Button>
          ) : (
            <>
              {authForm === "login" ? (
                <>
                  <LoginForm onLoginSuccess={onLoginSuccess} />
                  <View style={tw`text-center`}>
                    <Text variant="xs" muted>
                      Don't have an account?
                    </Text>
                    <LinkButton onPress={switchToRegisterForm}>
                      Register here
                    </LinkButton>
                  </View>
                </>
              ) : (
                <>
                  <RegisterForm
                    pendingWorkspaceInvitationId={
                      props.route.params.workspaceInvitationId
                    }
                    onRegisterSuccess={onRegisterSuccess}
                  />
                  <View style={tw`text-center`}>
                    <Text variant="xs" muted>
                      Already have an account?
                    </Text>
                    <LinkButton onPress={switchToLoginForm}>
                      Login here
                    </LinkButton>
                  </View>
                </>
              )}
            </>
          )}
        </Box>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  alertBanner: {},
  alertBannerText: {
    color: "#000",
  },
  errorBanner: {
    backgroundColor: "red",
  },
  errorText: {
    color: "white",
  },
});
