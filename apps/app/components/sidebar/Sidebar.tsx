import {
  DrawerContentScrollView,
  DrawerContentComponentProps,
} from "@react-navigation/drawer";

import { StyleSheet } from "react-native";
import {
  Button,
  Icon,
  Link,
  Menu,
  Pressable,
  SidebarButton,
  SidebarDivider,
  SidebarLink,
  Text,
  tw,
  useIsPermanentLeftSidebar,
  View,
} from "@serenity-tools/ui";
import {
  useWorkspacesQuery,
  useCreateWorkspaceMutation,
  useCreateDocumentMutation,
  useDeleteDocumentsMutation,
  useUpdateDocumentNameMutation,
  useDocumentPreviewsQuery,
  useWorkspaceQuery,
} from "../../generated/graphql";
import { v4 as uuidv4 } from "uuid";
import { useRoute } from "@react-navigation/native";
import { RootStackScreenProps } from "../../types";
import { useAuthentication } from "../../context/AuthenticationContext";
import { useState } from "react";
import DocumentMenu from "../documentMenu/DocumentMenu";
import Folder from "../folder/Folder";

export default function Sidebar(props: DrawerContentComponentProps) {
  const route = useRoute<RootStackScreenProps<"Workspace">["route"]>();
  const [isOpenWorkspaceSwitcher, setIsOpenWorkspaceSwitcher] = useState(false);
  const isPermanentLeftSidebar = useIsPermanentLeftSidebar();
  const [workspacesResult, refetchWorkspacesResult] = useWorkspacesQuery();
  const [workspaceResult] = useWorkspaceQuery({
    variables: {
      id: route.params.workspaceId,
    },
  });

  const [, createWorkspaceMutation] = useCreateWorkspaceMutation();
  const [, createDocumentMutation] = useCreateDocumentMutation();
  const [, deleteDocumentsMutation] = useDeleteDocumentsMutation();
  const [, updateDocumentNameMutation] = useUpdateDocumentNameMutation();
  const [documentPreviewsResult, refetchDocumentPreviews] =
    useDocumentPreviewsQuery({
      variables: { workspaceId: route.params.workspaceId },
    });
  const { updateAuthentication } = useAuthentication();

  const createWorkspace = async () => {
    const name =
      window.prompt("Enter a workspace name") || uuidv4().substring(0, 8);
    const id = uuidv4();
    await createWorkspaceMutation({
      input: {
        name,
        id,
      },
    });
    refetchWorkspacesResult();
  };

  const createDocument = async () => {
    const id = uuidv4();
    const result = await createDocumentMutation({
      input: { id, workspaceId: route.params.workspaceId },
    });
    if (result.data?.createDocument?.id) {
      props.navigation.navigate("Workspace", {
        workspaceId: route.params.workspaceId,
        screen: "Page",
        params: {
          pageId: result.data?.createDocument?.id,
          isNew: true,
        },
      });
    } else {
      console.error(result.error);
      alert("Failed to create a page. Please try again.");
    }
    refetchDocumentPreviews();
  };

  const deleteDocument = async (id: string) => {
    await deleteDocumentsMutation({
      input: {
        ids: [id],
      },
    });
    refetchDocumentPreviews();
  };

  const updateDocumentName = async (id: string) => {
    const name = window.prompt("Enter a document name");
    if (name && name.length > 0) {
      // refetchDocumentPreviews no necessary since a document is returned
      // and therefor the cache automatically updated
      await updateDocumentNameMutation({
        input: {
          id,
          name,
        },
      });
    }
  };

  return (
    <DrawerContentScrollView {...props} style={tw`bg-gray-100`}>
      {!isPermanentLeftSidebar && (
        <Button
          onPress={() => {
            props.navigation.closeDrawer();
          }}
        >
          Close Sidebar
        </Button>
      )}
      <Menu
        placement="bottom"
        style={tw`w-60`}
        offset={8}
        crossOffset={80}
        isOpen={isOpenWorkspaceSwitcher}
        onChange={setIsOpenWorkspaceSwitcher}
        trigger={
          <Pressable
            accessibilityLabel="More options menu"
            style={tw`flex flex-row`}
          >
            <Text>
              {workspaceResult.fetching
                ? " "
                : workspaceResult.data?.workspace?.name}
            </Text>
            <Icon name="arrow-down-s-fill" />
          </Pressable>
        }
      >
        <View style={tw`p-4`}>
          <Text variant="small" muted>
            jane@example.com
          </Text>
        </View>
        {workspacesResult.fetching
          ? null
          : workspacesResult.data?.workspaces?.nodes?.map((workspace) =>
              workspace === null || workspace === undefined ? null : (
                <SidebarLink
                  key={workspace.id}
                  to={{
                    screen: "Workspace",
                    params: {
                      workspaceId: workspace.id,
                      screen: "Dashboard",
                    },
                  }}
                >
                  <Text variant="small">{workspace.name}</Text>
                </SidebarLink>
              )
            )}
        <SidebarDivider collapsed />

        <SidebarButton
          onPress={() => {
            setIsOpenWorkspaceSwitcher(false);
            createWorkspace();
          }}
        >
          <Text variant="small">Create workspace</Text>
        </SidebarButton>
        <SidebarDivider collapsed />
        <SidebarButton
          onPress={() => {
            setIsOpenWorkspaceSwitcher(false);
            updateAuthentication(null);
            // @ts-expect-error navigation ts issue
            props.navigation.push("Login");
          }}
        >
          <Text variant="small">Logout</Text>
        </SidebarButton>
      </Menu>

      <SidebarDivider />

      <SidebarLink
        to={{
          screen: "Workspace",
          params: { workspaceId: route.params.workspaceId, screen: "Settings" },
        }}
      >
        <Text variant="small">Settings</Text>
      </SidebarLink>
      <SidebarLink to={{ screen: "DevDashboard" }}>
        <Text variant="small">Dev Dashboard</Text>
      </SidebarLink>
      <SidebarLink
        to={{
          screen: "Workspace",
          params: { workspaceId: route.params.workspaceId, screen: "Editor" },
        }}
      >
        <Text variant="small">Editor</Text>
      </SidebarLink>
      <SidebarLink
        to={{
          screen: "Workspace",
          params: {
            workspaceId: route.params.workspaceId,
            screen: "TestLibsodium",
          },
        }}
      >
        <Text variant="small">Libsodium Test Screen</Text>
      </SidebarLink>

      <SidebarDivider />

      <SidebarButton onPress={createDocument}>
        <Text variant="small">Create Page</Text>
      </SidebarButton>

      <SidebarDivider />

      <Text variant="xxs" bold style={tw`ml-4 mb-4`}>
        Documents
      </Text>
      {documentPreviewsResult.fetching ? (
        <Text>Loading...</Text>
      ) : documentPreviewsResult.data?.documentPreviews?.nodes ? (
        documentPreviewsResult.data?.documentPreviews?.nodes.map(
          (documentPreview) => {
            if (documentPreview === null) {
              return null;
            }
            return (
              <View key={documentPreview.id} style={styles.documentPreviewItem}>
                <Link
                  style={styles.documentPreviewLabel}
                  to={{
                    screen: "Workspace",
                    params: {
                      workspaceId: route.params.workspaceId,
                      screen: "Page",
                      params: {
                        pageId: documentPreview.id,
                      },
                    },
                  }}
                >
                  {documentPreview?.name}
                </Link>
                <DocumentMenu
                  documentId={documentPreview.id}
                  refetchDocumentPreviews={refetchDocumentPreviews}
                />
              </View>
            );
          }
        )
      ) : null}

      <Folder />
    </DrawerContentScrollView>
  );
}

const styles = StyleSheet.create({
  documentPreviewItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  documentPreviewLabel: {
    flexGrow: 1,
    height: "100%",
  },
});
