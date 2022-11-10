import { useFocusRing } from "@react-native-aria/focus";
import { useNavigation, useRoute } from "@react-navigation/native";
import {
  decryptFolderName,
  encryptExistingFolderName,
  encryptFolderName,
} from "@serenity-tools/common";
import {
  Icon,
  IconButton,
  InlineInput,
  Pressable,
  SidebarText,
  Tooltip,
  tw,
  useIsDesktopDevice,
  View,
  ViewProps,
} from "@serenity-tools/ui";
import { HStack } from "native-base";
import { useEffect, useState } from "react";
import { ActivityIndicator, Platform, StyleSheet } from "react-native";
import { v4 as uuidv4 } from "uuid";
import {
  runCreateDocumentMutation,
  runCreateFolderMutation,
  runDeleteFoldersMutation,
  runUpdateFolderNameMutation,
  useDocumentsQuery,
  useFoldersQuery,
} from "../../generated/graphql";
import { useWorkspaceContext } from "../../hooks/useWorkspaceContext";
import { RootStackScreenProps } from "../../types/navigation";
import { useActiveDocumentInfoStore } from "../../utils/document/activeDocumentInfoStore";
import {
  getDocumentPath,
  useDocumentPathStore,
} from "../../utils/document/documentPathStore";
import { buildKeyDerivationTrace } from "../../utils/folder/buildKeyDerivationTrace";
import { deriveParentFolderKey } from "../../utils/folder/deriveFolderKeyData";
import { useFolderKeyStore } from "../../utils/folder/folderKeyStore";
import { getFolder } from "../../utils/folder/getFolder";
import { useOpenFolderStore } from "../../utils/folder/openFolderStore";
import { deriveCurrentWorkspaceKey } from "../../utils/workspace/deriveCurrentWorkspaceKey";
import { deriveWorkspaceKey } from "../../utils/workspace/deriveWorkspaceKey";
import { getWorkspace } from "../../utils/workspace/getWorkspace";
import SidebarFolderMenu from "../sidebarFolderMenu/SidebarFolderMenu";
import SidebarPage from "../sidebarPage/SidebarPage";

type Props = ViewProps & {
  workspaceId: string;
  folderId: string;
  folderName?: string;
  encryptedName: string;
  encryptedNameNonce?: string;
  subkeyId: number;
  depth?: number;
  onStructureChange: () => void;
};

export default function SidebarFolder(props: Props) {
  const defaultFolderName = "Untitled";
  const route = useRoute<RootStackScreenProps<"Workspace">["route"]>();
  const navigation = useNavigation();
  const openFolderIds = useOpenFolderStore((state) => state.folderIds);
  const folderStore = useOpenFolderStore();
  const isDesktopDevice = useIsDesktopDevice();
  const [isHovered, setIsHovered] = useState(false);
  const { isFocusVisible, focusProps: focusRingProps }: any = useFocusRing();
  const [isDeleted, setIsDeleted] = useState(false);
  const isOpen = openFolderIds.includes(props.folderId);
  const [isEditing, setIsEditing] = useState<"none" | "name" | "new">("none");
  const [foldersResult, refetchFolders] = useFoldersQuery({
    pause: !isOpen,
    variables: {
      parentFolderId: props.folderId,
      first: 50,
    },
  });
  const [documentsResult, refetchDocuments] = useDocumentsQuery({
    pause: !isOpen,
    variables: {
      parentFolderId: props.folderId,
      first: 50,
    },
  });
  const { depth = 0 } = props;
  const { activeDevice } = useWorkspaceContext();
  const documentPathStore = useDocumentPathStore();
  const document = useActiveDocumentInfoStore((state) => state.document);
  const documentPathIds = useDocumentPathStore((state) => state.folderIds);
  const [folderName, setFolderName] = useState("decrypting…");
  const getFolderKey = useFolderKeyStore((state) => state.getFolderKey);

  useEffect(() => {
    const isOpen = openFolderIds.indexOf(props.folderId) >= 0;
    if (isOpen) {
      refetchFolders();
      refetchDocuments();
    }
  }, [openFolderIds, props.folderId]);

  useEffect(() => {
    decryptName();
  }, [props.encryptedName, props.subkeyId]);

  const decryptName = async () => {
    if (!props.subkeyId || !props.encryptedName || !props.encryptedNameNonce) {
      setFolderName("Untitled");
      return;
    }
    try {
      const folder = await getFolder({ id: props.folderId });
      let parentKey = "";
      if (folder.parentFolderId) {
        parentKey = await getFolderKey({
          workspaceId: props.workspaceId,
          workspaceKeyId: folder.keyDerivationTrace.workspaceKeyId,
          folderId: folder.parentFolderId,
          folderSubkeyId: props.subkeyId,
          activeDevice,
        });
      } else {
        const workspaceKeyData = await deriveWorkspaceKey({
          workspaceId: props.workspaceId,
          workspaceKeyId: folder.keyDerivationTrace.workspaceKeyId,
          activeDevice,
        });
        parentKey = workspaceKeyData.workspaceKey;
      }
      const folderName = await decryptFolderName({
        parentKey: parentKey,
        subkeyId: props.subkeyId!,
        ciphertext: props.encryptedName,
        publicNonce: props.encryptedNameNonce,
      });
      setFolderName(folderName);
    } catch (error) {
      console.error(error);
      setFolderName("decryption error");
    }
  };

  const createFolder = async (name: string) => {
    openFolder();
    const id = uuidv4();
    let workspaceKey = "";
    const workspace = await getWorkspace({
      deviceSigningPublicKey: activeDevice.signingPublicKey,
      workspaceId: props.workspaceId,
    });
    if (!workspace?.currentWorkspaceKey) {
      // TODO: handle error in UI
      console.error("Workspace or workspaceKeys not found");
      return;
    }
    try {
      const result = await deriveCurrentWorkspaceKey({
        workspaceId: props.workspaceId,
        activeDevice,
      });
      workspaceKey = result.workspaceKey;
    } catch (error: any) {
      // TODO: handle device not registered error
      console.error(error);
      return;
    }
    const parentFolderKey = await getFolderKey({
      folderId: props.folderId,
      workspaceKeyId: workspace.currentWorkspaceKey.id,
      workspaceId: props.workspaceId,
      folderSubkeyId: props.subkeyId,
      activeDevice,
    });

    const encryptedFolderResult = await encryptFolderName({
      name,
      parentKey: parentFolderKey,
    });
    let didCreateFolderSucceed = false;
    let numCreateFolderAttempts = 0;
    let folderId: string | undefined = undefined;
    let result: any = undefined;
    const keyDerivationTrace = await buildKeyDerivationTrace({
      folderId: props.folderId,
      workspaceKeyId: workspace.currentWorkspaceKey.id,
    });
    do {
      numCreateFolderAttempts += 1;
      result = await runCreateFolderMutation(
        {
          input: {
            id,
            workspaceId: route.params.workspaceId,
            encryptedName: encryptedFolderResult.ciphertext,
            encryptedNameNonce: encryptedFolderResult.publicNonce,
            workspaceKeyId: workspace?.currentWorkspaceKey?.id!,
            subkeyId: encryptedFolderResult.folderSubkeyId,
            parentFolderId: props.folderId,
            keyDerivationTrace,
          },
        },
        {}
      );
      if (result.data?.createFolder?.folder?.id) {
        didCreateFolderSucceed = true;
        folderId = result.data?.createFolder?.folder?.id;
        setIsEditing("none");
      }
    } while (!didCreateFolderSucceed && numCreateFolderAttempts < 5);
    if (folderId) {
      setIsEditing("none");
    } else {
      console.error(result.error);
      alert("Failed to create a folder. Please try again.");
    }
    refetchDocuments();
    refetchFolders();
  };

  const createDocument = async () => {
    const id = uuidv4();
    const workspace = await getWorkspace({
      deviceSigningPublicKey: activeDevice.signingPublicKey,
      workspaceId: props.workspaceId,
    });
    if (!workspace?.currentWorkspaceKey) {
      console.error("Workspace or workspaceKeys not found");
      return;
    }
    const folderKeyString = await getFolderKey({
      folderId: props.folderId,
      workspaceKeyId: workspace.currentWorkspaceKey.id,
      workspaceId: props.workspaceId,
      folderSubkeyId: props.subkeyId,
      activeDevice,
    });
    const nameKeyDerivationTrace = await buildKeyDerivationTrace({
      folderId: props.folderId,
      workspaceKeyId: workspace.currentWorkspaceKey.id,
    });
    const result = await runCreateDocumentMutation(
      {
        input: {
          id,
          workspaceId: props.workspaceId,
          parentFolderId: props.folderId,
          nameKeyDerivationTrace,
        },
      },
      {}
    );
    if (result.data?.createDocument?.id) {
      navigation.navigate("Workspace", {
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
    refetchDocuments();
    refetchFolders();
  };

  const editFolderName = () => {
    setIsEditing("name");
  };

  const toggleFolderOpen = () => {
    if (isOpen) {
      closeFolder();
    } else {
      openFolder();
    }
  };

  const openFolder = () => {
    const openFolderIds = folderStore.folderIds;
    if (!openFolderIds.includes(props.folderId)) {
      openFolderIds.push(props.folderId);
      folderStore.update(openFolderIds);
    }
  };

  const closeFolder = () => {
    const openFolderIds = folderStore.folderIds;
    const position = openFolderIds.indexOf(props.folderId);
    if (position >= 0) {
      openFolderIds.splice(position, 1);
      folderStore.update(openFolderIds);
    }
  };
  const updateFolderName = async (newFolderName: string) => {
    let workspace = await getWorkspace({
      workspaceId: props.workspaceId,
      deviceSigningPublicKey: activeDevice.signingPublicKey,
    });
    const parentKey = await deriveParentFolderKey({
      folderId: props.folderId,
      workspaceId: props.workspaceId,
      workspaceKeyId: workspace?.currentWorkspaceKey?.id!,
      activeDevice,
    });
    const encryptedFolderResult = await encryptExistingFolderName({
      name: newFolderName,
      parentKey: parentKey.keyData.key,
      subkeyId: props.subkeyId!,
    });
    const sourceFolder = await getFolder({ id: props.folderId });
    const keyDerivationTrace = await buildKeyDerivationTrace({
      folderId: sourceFolder.parentFolderId,
      workspaceKeyId: workspace?.currentWorkspaceKey?.id!,
    });
    const updateFolderNameResult = await runUpdateFolderNameMutation(
      {
        input: {
          id: props.folderId,
          encryptedName: encryptedFolderResult.ciphertext,
          encryptedNameNonce: encryptedFolderResult.publicNonce,
          workspaceKeyId: workspace?.currentWorkspaceKey?.id!,
          subkeyId: props.subkeyId!,
          keyDerivationTrace,
        },
      },
      {}
    );
    const folder = updateFolderNameResult.data?.updateFolderName?.folder;
    if (folder) {
      setFolderName(newFolderName);
      // refetch the document path
      // TODO: Optimize by checking if the current folder is in the document path
      if (document && documentPathIds.includes(props.folderId)) {
        const documentPath = await getDocumentPath(document.id);
        documentPathStore.update(documentPath, activeDevice, getFolderKey);
      }
    } else {
      // TODO: show error: couldn't update folder name
    }
    setIsEditing("none");
  };

  const deleteFolder = async (folderId: string) => {
    const deleteFoldersResult = await runDeleteFoldersMutation(
      {
        input: {
          ids: [folderId],
          workspaceId: props.workspaceId,
        },
      },
      {}
    );
    if (deleteFoldersResult.data && deleteFoldersResult.data.deleteFolders) {
      setIsDeleted(true);
      props.onStructureChange();
    } else {
      // TODO: show error: couldn't delete folder
    }
  };

  const styles = StyleSheet.create({
    folder: tw``,
    hover: tw`bg-gray-200`,
    focusVisible: Platform.OS === "web" ? tw`se-inset-focus-mini` : {},
  });

  const maxWidthBase = isDesktopDevice ? 32 : 42;
  const maxWidth = maxWidthBase - depth * 2;

  if (isDeleted) {
    return <></>;
  }

  return (
    <>
      <View
        style={[
          styles.folder,
          isHovered && styles.hover,
          isFocusVisible && styles.focusVisible,
          props.style,
        ]}
        // as Views usually shouldn't have mouse-events ()
        // @ts-expect-error as views usually don't have hover
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <HStack>
          <Pressable
            {...focusRingProps} // needed so focus is shown on view-wrapper
            onPress={toggleFolderOpen}
            style={[
              tw`grow-1 pl-${depth * (isDesktopDevice ? 3 : 4)}`, // needed so clickable area is as large as possible
            ]}
            // disable default outline styles and add 1 overridden style manually (grow)
            _focusVisible={{
              _web: { style: { outlineStyle: "none", flexGrow: 1 } },
            }}
          >
            <View style={[tw`pl-5 md:pl-2.5`]}>
              <HStack
                alignItems="center"
                style={[
                  tw`py-2 md:py-1.5`,
                  !isDesktopDevice && tw`border-b border-gray-200`,
                ]}
              >
                <View style={!isDesktopDevice && tw`-ml-1`}>
                  {documentPathIds.includes(props.folderId) ? (
                    <Icon
                      name={isOpen ? "arrow-down-filled" : "arrow-right-filled"}
                      color={"gray-800"}
                      mobileSize={5}
                    />
                  ) : (
                    <Icon
                      name={isOpen ? "arrow-down-filled" : "arrow-right-filled"}
                      color={isDesktopDevice ? "gray-500" : "gray-400"}
                      mobileSize={5}
                    />
                  )}
                </View>
                <View style={tw`-ml-0.5`}>
                  <Icon name="folder" size={5} mobileSize={8} />
                </View>

                {isEditing === "name" ? (
                  <InlineInput
                    onSubmit={updateFolderName}
                    onCancel={() => {
                      setIsEditing("none");
                    }}
                    value={folderName}
                    style={tw`ml-0.5 w-${maxWidth}`}
                    testID={`sidebar-folder--${props.folderId}__edit-name`}
                  />
                ) : (
                  <SidebarText
                    style={tw`pl-2 md:pl-1.5 max-w-${maxWidth}`}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                    testID={`sidebar-folder--${props.folderId}`}
                  >
                    {folderName}
                  </SidebarText>
                )}
              </HStack>
            </View>
          </Pressable>

          {/* TODO mobile : use overlay element */}
          {isEditing === "new" && (
            <InlineInput
              value=""
              onSubmit={createFolder}
              onCancel={() => {
                setIsEditing("none");
              }}
              style={tw`w-${maxWidth} ml-1.5`}
            />
          )}

          <HStack
            alignItems="center"
            space={1}
            style={[
              tw`pr-4 md:pr-2  ${
                isHovered || !isDesktopDevice ? "" : "hidden"
              }`,
              !isDesktopDevice && tw`border-b border-gray-200`,
            ]}
          >
            <SidebarFolderMenu
              folderId={props.folderId}
              refetchFolders={refetchFolders}
              onUpdateNamePress={editFolderName}
              onDeletePressed={() => deleteFolder(props.folderId)}
              onCreateFolderPress={() => {
                createFolder(defaultFolderName);
              }}
            />
            {/* offset not working yet as NB has a no-no in their component */}
            <Tooltip label="New page" placement="right" offset={8}>
              <IconButton
                onPress={createDocument}
                name="file-add-line"
                color="gray-600"
                style={tw`p-2 md:p-0`}
                testID={`sidebar-folder--${props.folderId}__create-document`}
              ></IconButton>
            </Tooltip>
            {documentsResult.fetching ||
              (foldersResult.fetching && <ActivityIndicator />)}
          </HStack>
        </HStack>
      </View>

      {isOpen && (
        <>
          {foldersResult.data?.folders?.nodes
            ? foldersResult.data?.folders?.nodes.map((folder) => {
                if (folder === null) {
                  return null;
                }
                return (
                  <SidebarFolder
                    key={folder.id}
                    folderId={folder.id}
                    workspaceId={props.workspaceId}
                    subkeyId={folder.subkeyId}
                    encryptedName={folder.encryptedName}
                    encryptedNameNonce={folder.encryptedNameNonce}
                    onStructureChange={props.onStructureChange}
                    depth={depth + 1}
                  />
                );
              })
            : null}
          {documentsResult.data?.documents?.nodes
            ? documentsResult.data?.documents?.nodes.map((document) => {
                if (document === null) {
                  return null;
                }
                return (
                  <SidebarPage
                    key={document.id}
                    parentFolderId={props.folderId}
                    documentId={document.id}
                    encryptedName={document.encryptedName}
                    encryptedNameNonce={document.encryptedNameNonce}
                    subkeyId={document.subkeyId}
                    workspaceId={props.workspaceId}
                    onRefetchDocumentsPress={refetchDocuments}
                    depth={depth}
                  />
                );
              })
            : null}
        </>
      )}
    </>
  );
}
