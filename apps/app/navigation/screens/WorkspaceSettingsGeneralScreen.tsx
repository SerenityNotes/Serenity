import {
  Button,
  Input,
  Modal,
  ModalButtonFooter,
  ModalHeader,
  RawInput,
  Text,
  tw,
  View,
} from "@serenity-tools/ui";
import { useEffect, useState } from "react";
import { StyleSheet } from "react-native";
import { useClient } from "urql";
import { useWorkspaceId } from "../../context/WorkspaceIdContext";
import {
  MeDocument,
  MeQuery,
  MeQueryVariables,
  MeResult,
  useDeleteWorkspacesMutation,
  useUpdateWorkspaceMutation,
  Workspace,
  WorkspaceMember,
} from "../../generated/graphql";
import { useWorkspaceContext } from "../../hooks/useWorkspaceContext";
import { WorkspaceDrawerScreenProps } from "../../types/navigation";
import {
  removeLastUsedDocumentId,
  removeLastUsedWorkspaceId,
} from "../../utils/lastUsedWorkspaceAndDocumentStore/lastUsedWorkspaceAndDocumentStore";
import { getWorkspace } from "../../utils/workspace/getWorkspace";

export default function WorkspaceSettingsGeneralScreen(
  props: WorkspaceDrawerScreenProps<"Settings"> & { children?: React.ReactNode }
) {
  const urqlClient = useClient();
  const { activeDevice } = useWorkspaceContext();
  const workspaceId = useWorkspaceId();
  const [, deleteWorkspacesMutation] = useDeleteWorkspacesMutation();
  const [, updateWorkspaceMutation] = useUpdateWorkspaceMutation();
  const [me, setMe] = useState<MeResult | null>();
  const [workspaceName, setWorkspaceName] = useState<string>("");
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [memberLookup, setMemberLookup] = useState<{
    [username: string]: number;
  }>({});
  const [isLoadingWorkspaceData, setIsLoadingWorkspaceData] =
    useState<boolean>(false);
  const [hasGraphqlError, setHasGraphqlError] = useState<boolean>(false);
  const [graphqlError, setGraphqlError] = useState<string>("");
  const [showDeleteWorkspaceModal, setShowDeleteWorkspaceModal] =
    useState<boolean>(false);
  const [deletingWorkspaceName, setDeletingWorkspaceName] =
    useState<string>("");
  const [workspace, setWorkspace] = useState<Workspace | null>(null);

  const getMe = async () => {
    const meResult = await urqlClient
      .query<MeQuery, MeQueryVariables>(
        MeDocument,
        {},
        {
          requestPolicy: "network-only",
        }
      )
      .toPromise();
    if (meResult.error) {
      throw new Error(meResult.error.message);
    }
    setMe(meResult.data?.me);
    return meResult.data?.me;
  };

  useEffect(() => {
    (async () => {
      const me = await getMe();
      const workspace = await getWorkspace({
        urqlClient,
        deviceSigningPublicKey: activeDevice.signingPublicKey,
      });
      if (workspace) {
        setWorkspace(workspace);
        updateWorkspaceData(me, workspace);
      } else {
        props.navigation.replace("WorkspaceNotFound");
        return;
      }
    })();
  }, [urqlClient, props.navigation, activeDevice.signingPublicKey]);

  const updateWorkspaceData = async (
    me: MeResult | null | undefined,
    workspace: Workspace
  ) => {
    setIsLoadingWorkspaceData(true);
    const workspaceName = workspace.name || "";
    setWorkspaceName(workspaceName);
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
    setIsLoadingWorkspaceData(false);
  };

  const deleteWorkspace = async () => {
    if (deletingWorkspaceName !== workspaceName) {
      // display an error
      return;
    }
    setIsLoadingWorkspaceData(true);
    setHasGraphqlError(false);
    const deleteWorkspaceResult = await deleteWorkspacesMutation({
      input: {
        ids: [workspaceId],
      },
    });
    if (deleteWorkspaceResult.data?.deleteWorkspaces?.status) {
      removeLastUsedDocumentId(workspaceId);
      removeLastUsedWorkspaceId();
      props.navigation.navigate("Root");
    } else if (deleteWorkspaceResult?.error) {
      setHasGraphqlError(true);
      setGraphqlError(deleteWorkspaceResult?.error.message);
    }
    setIsLoadingWorkspaceData(false);
    setShowDeleteWorkspaceModal(false);
  };

  const updateWorkspaceName = async () => {
    setIsLoadingWorkspaceData(true);
    const updateWorkspaceResult = await updateWorkspaceMutation({
      input: {
        id: workspaceId,
        name: workspaceName,
        members: null,
      },
    });
    if (updateWorkspaceResult.data?.updateWorkspace?.workspace) {
      updateWorkspaceData(
        me,
        updateWorkspaceResult.data?.updateWorkspace?.workspace
      );
    }
    setIsLoadingWorkspaceData(false);
  };

  return (
    <>
      {hasGraphqlError && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{graphqlError}</Text>
        </View>
      )}
      <View style={tw`mt-20 px-4`}>
        {workspace === null ? (
          <Text>Loading...</Text>
        ) : (
          <>
            <View>
              <Text style={tw`mt-6 mb-4 font-700 text-xl text-center`}>
                Change name
              </Text>
              <RawInput
                placeholder="Workspace name"
                value={workspaceName}
                onChangeText={setWorkspaceName}
                editable={isAdmin && !isLoadingWorkspaceData}
              />
              {isAdmin && (
                <Button
                  onPress={updateWorkspaceName}
                  disabled={isLoadingWorkspaceData}
                >
                  Update
                </Button>
              )}
            </View>
            {isAdmin && (
              <Button onPress={() => setShowDeleteWorkspaceModal(true)}>
                Delete workspace
              </Button>
            )}
            {isAdmin && (
              <Modal
                isVisible={showDeleteWorkspaceModal}
                onBackdropPress={() => setShowDeleteWorkspaceModal(false)}
              >
                <ModalHeader>Delete workspace?</ModalHeader>
                <Text>Type the name of this workspace: {workspaceName}</Text>
                <Input
                  label={"Workspace name"}
                  onChangeText={setDeletingWorkspaceName}
                />
                <ModalButtonFooter
                  confirm={
                    <Button
                      disabled={deletingWorkspaceName !== workspaceName}
                      onPress={() => {
                        deleteWorkspace();
                      }}
                    >
                      Delete
                    </Button>
                  }
                />
              </Modal>
            )}
          </>
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
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
