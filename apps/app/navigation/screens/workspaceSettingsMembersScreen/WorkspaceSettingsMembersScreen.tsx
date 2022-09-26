import {
  Button,
  CenterContent,
  Checkbox,
  InfoMessage,
  Spinner,
  Text,
  tw,
  View,
} from "@serenity-tools/ui";
import { useMachine } from "@xstate/react";
import { useEffect, useState } from "react";
import { StyleSheet, useWindowDimensions } from "react-native";
import { useClient } from "urql";
import { CreateWorkspaceInvitation } from "../../../components/workspace/CreateWorkspaceInvitation";
import { useWorkspaceId } from "../../../context/WorkspaceIdContext";
import {
  Device,
  MeResult,
  RemoveMembersAndRotateWorkspaceKeyDocument,
  RemoveMembersAndRotateWorkspaceKeyMutation,
  RemoveMembersAndRotateWorkspaceKeyMutationVariables,
  useUpdateWorkspaceMutation,
  Workspace,
  WorkspaceMember,
} from "../../../generated/graphql";
import { useWorkspaceContext } from "../../../hooks/useWorkspaceContext";
import { workspaceSettingsLoadWorkspaceMachine } from "../../../machines/workspaceSettingsLoadWorkspaceMachine";
import { WorkspaceDrawerScreenProps } from "../../../types/navigation";
import { WorkspaceDeviceParing } from "../../../types/workspaceDevice";
import { createAndEncryptWorkspaceKeyForDevice } from "../../../utils/device/createAndEncryptWorkspaceKeyForDevice";
import { getDevices } from "../../../utils/device/getDevices";
import { getWorkspaceDevices } from "../../../utils/workspace/getWorkspaceDevices";
import { getWorkspaceKey } from "../../../utils/workspace/getWorkspaceKey";

type Member = {
  userId: string;
  username: string;
  isAdmin: boolean;
};

function WorkspaceMemberRow({
  userId,
  username,
  isAdmin,
  allowEditing,
  adminUserId,
  onAdminStatusChange,
  onDeletePress,
}) {
  useWindowDimensions(); // needed to ensure tw-breakpoints are triggered when resizing

  return (
    <View style={styles.memberListItem}>
      <Text style={styles.memberListItemLabel}>
        {username}
        {userId === adminUserId && (
          <Text style={workspaceMemberStyles.adminLabel}>(You)</Text>
        )}
      </Text>
      <View style={workspaceMemberStyles.checkboxContainer}>
        <Checkbox
          defaultIsChecked={isAdmin}
          isDisabled={!allowEditing}
          onChange={onAdminStatusChange}
          value={username}
        >
          <Text>Admin</Text>
        </Checkbox>
        {allowEditing && <Button onPress={onDeletePress}>Remove</Button>}
      </View>
    </View>
  );
}

const workspaceMemberStyles = StyleSheet.create({
  memberListItem: {
    flexGrow: 1,
  },
  memberListItemLabel: {
    flexGrow: 1,
  },
  checkboxContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  adminLabel: {
    fontStyle: "italic",
  },
});

export default function WorkspaceSettingsMembersScreen(
  props: WorkspaceDrawerScreenProps<"Settings"> & { children?: React.ReactNode }
) {
  const workspaceId = useWorkspaceId();
  const { activeDevice } = useWorkspaceContext();
  const [state] = useMachine(workspaceSettingsLoadWorkspaceMachine, {
    context: {
      workspaceId: workspaceId,
      navigation: props.navigation,
      activeDevice,
    },
  });

  const urqlClient = useClient();
  const [, updateWorkspaceMutation] = useUpdateWorkspaceMutation();
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [memberLookup, setMemberLookup] = useState<{
    [username: string]: number;
  }>({});
  const [hasGraphqlError, setHasGraphqlError] = useState<boolean>(false);
  const [graphqlError, setGraphqlError] = useState<string>("");

  useEffect(() => {
    if (
      state.value === "loadWorkspaceSuccess" &&
      state.context.workspaceQueryResult?.data?.workspace
    ) {
      console.log(state.context);
      updateWorkspaceData(
        state.context.meWithWorkspaceLoadingInfoQueryResult?.data?.me,
        // @ts-expect-error need to fix the generation
        state.context.workspaceQueryResult?.data?.workspace
      );
    }
  }, [state]);

  const updateWorkspaceData = async (
    me: MeResult | null | undefined,
    workspace: Workspace
  ) => {
    const members: WorkspaceMember[] = workspace.members || [];
    setMembers(members);
    const memberLookup = {} as { [username: string]: number };
    members.forEach((member: WorkspaceMember, row: number) => {
      memberLookup[member.userId] = row;
      if (member.userId === me?.id) {
        setIsAdmin(member.isAdmin);
      }
    });
    setMemberLookup(memberLookup);
  };

  const _updateWorkspaceMemberData = async (members: WorkspaceMember[]) => {
    // do graphql stuff
    const graphqlMembers: any[] = [];
    members.forEach((member: Member) => {
      graphqlMembers.push({
        userId: member.userId,
        isAdmin: member.isAdmin,
      });
    });
    const updateWorkspaceResult = await updateWorkspaceMutation({
      input: {
        id: workspaceId,
        members: graphqlMembers,
      },
    });
    if (updateWorkspaceResult.data?.updateWorkspace?.workspace) {
      updateWorkspaceData(
        state.context.meWithWorkspaceLoadingInfoQueryResult?.data?.me,
        updateWorkspaceResult.data?.updateWorkspace?.workspace
      );
    } else if (updateWorkspaceResult?.error) {
      setHasGraphqlError(true);
      setGraphqlError(updateWorkspaceResult?.error.message);
    }
  };

  const updateMember = async (
    member: WorkspaceMember,
    isMemberAdmin: boolean
  ) => {
    const existingMemberRow = memberLookup[member.userId];
    if (existingMemberRow >= 0) {
      members[existingMemberRow].isAdmin = isMemberAdmin;
      setMembers(members);
      await _updateWorkspaceMemberData(members);
    }
  };

  const removeMember = async (username: string) => {
    const row = memberLookup[username];
    if (row >= 0) {
      const member = members[row];
      members.splice(row, 1);
      setMembers(members);
      delete memberLookup[username];
      setMemberLookup(memberLookup);
      const devices = await getDevices({ urqlClient });
      if (!devices) {
        // TODO: show this error in the UI
        console.error("no devices found!");
        return;
      }
      const workspaceKey = await getWorkspaceKey({
        workspaceId,
        urqlClient,
        activeDevice,
      });
      const deviceWorkspaceKeyBoxes: WorkspaceDeviceParing[] = [];
      // TODO: getWorkspaceDevices gets all devices attached to a workspace
      let workspaceDevices: Device[] = [];
      try {
        const rawWorkspaceDevices = await getWorkspaceDevices({
          urqlClient,
          workspaceId,
        });
        if (rawWorkspaceDevices) {
          for (let rawWorkspaceDevice of rawWorkspaceDevices) {
            if (rawWorkspaceDevice) {
              workspaceDevices.push(rawWorkspaceDevice);
            }
          }
        }
      } catch (error) {
        // TODO: handle this error in the UI
        console.error(error);
        throw error;
      }
      for (let device of workspaceDevices) {
        if (device.userId !== member.userId) {
          const { ciphertext, nonce } =
            await createAndEncryptWorkspaceKeyForDevice({
              receiverDeviceEncryptionPublicKey: device.encryptionPublicKey,
              creatorDeviceEncryptionPrivateKey:
                activeDevice.encryptionPrivateKey!,
              workspaceKey,
            });
          deviceWorkspaceKeyBoxes.push({
            ciphertext,
            nonce,
            receiverDeviceSigningPublicKey: device.encryptionPublicKey,
          });
        }
      }

      await urqlClient
        .mutation<
          RemoveMembersAndRotateWorkspaceKeyMutation,
          RemoveMembersAndRotateWorkspaceKeyMutationVariables
        >(
          RemoveMembersAndRotateWorkspaceKeyDocument,
          {
            input: {
              revokedUserIds: [member.userId],
              workspaceId,
              creatorDeviceSigningPublicKey: activeDevice.signingPublicKey,
              deviceWorkspaceKeyBoxes,
            },
          },
          { requestPolicy: "network-only" }
        )
        .toPromise();
      await _updateWorkspaceMemberData(members);
    }
  };

  return (
    <>
      {hasGraphqlError && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{graphqlError}</Text>
        </View>
      )}
      <View style={tw`mt-20 px-4`}>
        {state.value !== "loadWorkspaceSuccess" ? (
          <CenterContent>
            {state.value === "loadWorkspaceFailed" ? (
              <InfoMessage variant="error">
                Failed to load workspace data. Please try again or contact
                support.
              </InfoMessage>
            ) : (
              <Spinner fadeIn />
            )}
          </CenterContent>
        ) : (
          <>
            <View>
              <Text style={tw`mt-6 mb-4 font-700 text-xl text-center`}>
                Invitations
              </Text>
              {isAdmin && (
                <View>
                  <CreateWorkspaceInvitation
                    workspaceId={workspaceId}
                    onWorkspaceInvitationCreated={(
                      workspaceInvitation: any
                    ) => {
                      // do nothing
                    }}
                  />
                  <Text style={tw`mt-6 mb-4 font-700 text-xl text-center`}>
                    Members
                  </Text>
                </View>
              )}
              {members.map((member: any) => (
                <WorkspaceMemberRow
                  key={member.userId}
                  userId={member.userId}
                  username={member.username}
                  isAdmin={member.isAdmin}
                  adminUserId={
                    state.context.meWithWorkspaceLoadingInfoQueryResult?.data
                      ?.me?.id
                  }
                  allowEditing={
                    isAdmin &&
                    member.userId !==
                      state.context.meWithWorkspaceLoadingInfoQueryResult?.data
                        ?.me?.id
                  }
                  onAdminStatusChange={(isMemberAdmin: boolean) => {
                    updateMember(member, isMemberAdmin);
                  }}
                  onDeletePress={() => {
                    removeMember(member.userId);
                  }}
                />
              ))}
              {isAdmin ? (
                <>
                  <Text style={styles.memberListItemLabel}>
                    You are an admin of this workspace
                  </Text>
                </>
              ) : (
                <>
                  <Text style={styles.memberListItemLabel}>
                    You are not an admin of this workspace
                  </Text>
                </>
              )}
            </View>
          </>
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  memberListItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  memberListItemLabel: {
    flexGrow: 1,
  },
  addMemberContainer: {
    flexDirection: "row",
  },
  formError: {
    color: "red",
  },
  errorBanner: {
    backgroundColor: "red",
  },
  errorText: {
    color: "white",
  },
});
