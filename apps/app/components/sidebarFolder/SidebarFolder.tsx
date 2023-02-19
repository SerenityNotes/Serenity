import { KeyDerivationTrace2 } from "@naisho/core";
import { useFocusRing } from "@react-native-aria/focus";
import { useNavigation, useRoute } from "@react-navigation/native";
import {
  decryptFolderName,
  encryptFolderName,
  folderDerivedKeyContext,
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
import { useAuthenticatedAppContext } from "../../hooks/useAuthenticatedAppContext";
import { RootStackScreenProps } from "../../types/navigationProps";
import { useActiveDocumentInfoStore } from "../../utils/document/activeDocumentInfoStore";
import {
  getDocumentPath,
  useDocumentPathStore,
} from "../../utils/document/documentPathStore";
import { createFolderKeyDerivationTrace } from "../../utils/folder/createFolderKeyDerivationTrace";
import { deriveFolderKey } from "../../utils/folder/deriveFolderKeyData";
import { useFolderKeyStore } from "../../utils/folder/folderKeyStore";
import { getFolder } from "../../utils/folder/getFolder";
import { useOpenFolderStore } from "../../utils/folder/openFolderStore";
import { getWorkspace } from "../../utils/workspace/getWorkspace";
import SidebarFolderMenu from "../sidebarFolderMenu/SidebarFolderMenu";
import SidebarPage from "../sidebarPage/SidebarPage";

type Props = ViewProps & {
  workspaceId: string;
  folderId: string;
  parentFolderId?: string | null | undefined;
  folderName?: string;
  encryptedName: string;
  encryptedNameNonce?: string;
  subkeyId: number;
  keyDerivationTrace: KeyDerivationTrace2;
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
  const { activeDevice } = useAuthenticatedAppContext();
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
  }, [props.encryptedName, props.keyDerivationTrace.subkeyId]);

  const decryptName = async () => {
    if (
      !props.keyDerivationTrace.subkeyId ||
      !props.encryptedName ||
      !props.encryptedNameNonce
    ) {
      setFolderName("Untitled");
      return;
    }
    try {
      const parentKeyChainData = await deriveFolderKey({
        folderId: props.folderId,
        workspaceId: props.workspaceId,
        keyDerivationTrace: props.keyDerivationTrace,
        activeDevice,
      });
      // since the decryptFolderName method takes a parent key
      // and the last item of the key chain is the current folder key,
      // we have to send in the parent key to the decryptFolderName method
      const parentKeyData = parentKeyChainData[parentKeyChainData.length - 2];
      const folderName = decryptFolderName({
        parentKey: parentKeyData.key,
        subkeyId: props.keyDerivationTrace.subkeyId!,
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
    // let workspaceKey = "";
    const workspace = await getWorkspace({
      deviceSigningPublicKey: activeDevice.signingPublicKey,
      workspaceId: props.workspaceId,
    });
    if (!workspace?.currentWorkspaceKey) {
      // TODO: handle error in UI
      console.error("Workspace or workspaceKeys not found");
      return;
    }
    // derive this (the new folder's parent) folder key trace:
    const parentFolderKeyChainData = await deriveFolderKey({
      folderId: props.folderId,
      workspaceId: props.workspaceId,
      keyDerivationTrace: props.keyDerivationTrace,
      activeDevice,
      overrideWithWorkspaceKeyId: workspace.currentWorkspaceKey?.id,
    });
    const parentChainItem =
      parentFolderKeyChainData[parentFolderKeyChainData.length - 1];
    const encryptedFolderResult = encryptFolderName({
      name,
      parentKey: parentChainItem.key,
    });
    // const parentKeyDerivationTrace = await buildKeyDerivationTrace({
    //   folderId: props.folderId,
    //   subkeyId: encryptedFolderResult.folderSubkeyId,
    //   workspaceKeyId: workspace?.currentWorkspaceKey?.id!,
    // });
    const keyDerivationTrace = await createFolderKeyDerivationTrace({
      workspaceKeyId: workspace?.currentWorkspaceKey?.id!,
      folderId: props.folderId,
    });
    keyDerivationTrace.trace.push({
      entryId: id,
      subkeyId: encryptedFolderResult.folderSubkeyId,
      parentId: props.folderId,
      context: folderDerivedKeyContext,
    });

    let didCreateFolderSucceed = false;
    let numCreateFolderAttempts = 0;
    let folderId: string | undefined = undefined;
    let result: any = undefined;
    do {
      numCreateFolderAttempts += 1;
      result = await runCreateFolderMutation(
        {
          input: {
            id,
            workspaceId: props.workspaceId,
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
    const result = await runCreateDocumentMutation(
      {
        input: {
          id,
          workspaceId: props.workspaceId,
          parentFolderId: props.folderId,
        },
      },
      {}
    );
    if (result.data?.createDocument?.id) {
      navigation.navigate("Workspace", {
        workspaceId: props.workspaceId,
        screen: "WorkspaceDrawer",
        params: {
          screen: "PageCommentsDrawer",
          params: {
            pageId: result.data?.createDocument?.id,
            screen: "Page",
            params: {
              isNew: true,
            },
          },
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
    const folder = await getFolder({ id: props.folderId });
    const folderKeyTrace = await deriveFolderKey({
      folderId: props.folderId,
      workspaceId: props.workspaceId,
      overrideWithWorkspaceKeyId: workspace?.currentWorkspaceKey?.id!,
      keyDerivationTrace: folder.keyDerivationTrace,
      activeDevice,
    });
    // ignore the last chain item as it's the key for the old folder name
    const parentChainItem = folderKeyTrace[folderKeyTrace.length - 2];
    const encryptedFolderResult = encryptFolderName({
      name: newFolderName,
      parentKey: parentChainItem.key,
    });
    const keyDerivationTrace = await createFolderKeyDerivationTrace({
      folderId: props.folderId,
      workspaceKeyId: workspace?.currentWorkspaceKey?.id!,
    });
    const updateFolderNameResult = await runUpdateFolderNameMutation(
      {
        input: {
          id: props.folderId,
          encryptedName: encryptedFolderResult.ciphertext,
          encryptedNameNonce: encryptedFolderResult.publicNonce,
          workspaceKeyId: workspace?.currentWorkspaceKey?.id!,
          subkeyId: encryptedFolderResult.folderSubkeyId!,
          keyDerivationTrace,
        },
      },
      {}
    );
    const updatedFolder = updateFolderNameResult.data?.updateFolderName?.folder;
    if (updatedFolder) {
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
                    parentFolderId={folder.parentFolderId}
                    workspaceId={props.workspaceId}
                    subkeyId={
                      folder.keyDerivationTrace.trace[
                        folder.keyDerivationTrace.trace.length - 1
                      ].subkeyId
                    }
                    encryptedName={folder.encryptedName}
                    encryptedNameNonce={folder.encryptedNameNonce}
                    keyDerivationTrace={folder.keyDerivationTrace}
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
                    subkeyId={document.nameKeyDerivationTrace.subkeyId}
                    nameKeyDerivationTrace={document.nameKeyDerivationTrace}
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
