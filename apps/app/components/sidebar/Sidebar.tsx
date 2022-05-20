import {
  DrawerContentScrollView,
  DrawerContentComponentProps,
} from "@react-navigation/drawer";

import {
  Button,
  Icon,
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
import { CreateWorkspaceModal } from "../createWorkspaceModal/CreateWorkspaceModal";
import {
  useWorkspacesQuery,
  useWorkspaceQuery,
  useCreateFolderMutation,
  useRootFoldersQuery,
  useMeQuery,
} from "../../generated/graphql";
import { v4 as uuidv4 } from "uuid";
import { useNavigation, useRoute } from "@react-navigation/native";
import { RootStackScreenProps } from "../../types";
import { useAuthentication } from "../../context/AuthenticationContext";
import { useEffect, useState } from "react";
import Folder from "../sidebarFolder/SidebarFolder";

export default function Sidebar(props: DrawerContentComponentProps) {
  const route = useRoute<RootStackScreenProps<"Workspace">["route"]>();
  const navigation = useNavigation();
  const [isOpenWorkspaceSwitcher, setIsOpenWorkspaceSwitcher] = useState(false);
  const isPermanentLeftSidebar = useIsPermanentLeftSidebar();
  const [workspacesResult, refetchWorkspacesResult] = useWorkspacesQuery();
  const [meResult] = useMeQuery();
  const [username, setUsername] = useState<string>("");
  const [workspaceResult] = useWorkspaceQuery({
    variables: {
      id: route.params.workspaceId,
    },
  });
  const [rootFoldersResult] = useRootFoldersQuery({
    variables: {
      workspaceId: route.params.workspaceId,
      first: 20,
    },
  });

  const [, createFolderMutation] = useCreateFolderMutation();
  const { updateAuthentication } = useAuthentication();
  const [showCreateWorkspaceModal, setShowCreateWorkspaceModal] =
    useState(false);

  useEffect(() => {
    if (meResult.data && meResult.data.me) {
      if (meResult.data.me.username) {
        setUsername(meResult.data.me.username);
      } else {
        // TODO: error! Couldn't fetch user
      }
    }
  }, [meResult.fetching]);

  const onWorkspaceCreated = (workspace: { id: string }) => {
    refetchWorkspacesResult();
    setShowCreateWorkspaceModal(false);
    navigation.navigate("Workspace", {
      workspaceId: workspace.id,
      screen: "Dashboard",
    });
  };

  const createFolder = async () => {
    const id = uuidv4();
    const result = await createFolderMutation({
      input: { id, workspaceId: route.params.workspaceId },
    });
    if (result.data?.createFolder?.folder?.id) {
      console.log("created a folder");
    } else {
      console.error(result.error);
      alert("Failed to create a folder. Please try again.");
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
            {username}
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
            setShowCreateWorkspaceModal(true);
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

      <SidebarButton onPress={createFolder}>
        <Text variant="small">Create a Folder</Text>
      </SidebarButton>

      <SidebarDivider />

      <Text variant="xxs" bold style={tw`ml-4 mb-4`}>
        Documents
      </Text>

      {rootFoldersResult.fetching ? (
        <Text>Loading Folders…</Text>
      ) : rootFoldersResult.data?.rootFolders?.nodes ? (
        rootFoldersResult.data?.rootFolders?.nodes.map((folder) => {
          if (folder === null) {
            return null;
          }
          return (
            <Folder
              key={folder.id}
              folderId={folder.id}
              folderName={folder.name}
              workspaceId={route.params.workspaceId}
            />
          );
        })
      ) : null}

      <CreateWorkspaceModal
        isVisible={showCreateWorkspaceModal}
        onBackdropPress={() => setShowCreateWorkspaceModal(false)}
        onWorkspaceCreated={onWorkspaceCreated}
      />
    </DrawerContentScrollView>
  );
}
