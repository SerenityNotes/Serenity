import { useNavigation } from "@react-navigation/native";
import {
  createIntroductionDocumentSnapshot,
  createSnapshotKey,
  encryptDocumentTitle,
  encryptFolderName,
} from "@serenity-tools/common";
import sodium from "@serenity-tools/libsodium";
import {
  Button,
  FormWrapper,
  InfoMessage,
  Input,
  ModalButtonFooter,
  ModalHeader,
} from "@serenity-tools/ui";
import { useEffect, useRef, useState } from "react";
import { TextInput } from "react-native";
import { v4 as uuidv4 } from "uuid";
import { useAppContext } from "../../context/AppContext";
import {
  useCreateInitialWorkspaceStructureMutation,
  useDevicesQuery,
} from "../../generated/graphql";
import { Device } from "../../types/Device";
import { createWorkspaceKeyBoxesForDevices } from "../../utils/device/createWorkspaceKeyBoxesForDevices";
import { getMainDevice } from "../../utils/device/mainDeviceMemoryStore";
import { VerifyPasswordModal } from "../verifyPasswordModal/VerifyPasswordModal";

export type CreateWorkspaceFormProps = {
  onCancel?: () => void;
  onWorkspaceStructureCreated?: () => void;
};

export function CreateWorkspaceForm(props: CreateWorkspaceFormProps) {
  const inputRef = useRef<TextInput>();
  const [name, setName] = useState<string>("");
  const [isPasswordModalVisible, setIsPasswordModalVisible] = useState(false);
  const [isCreatingWorkspace, setIsCreatingWorkspace] = useState(false);
  const [hasCreateWorkspaceError, setHasCreateWorkspaceError] = useState(false);
  const { activeDevice } = useAppContext();
  const navigation = useNavigation();
  const [, createInitialWorkspaceStructure] =
    useCreateInitialWorkspaceStructureMutation();

  const [devicesResult] = useDevicesQuery({
    variables: {
      hasNonExpiredSession: true,
      first: 500,
    },
  });

  useEffect(() => {
    // the password input field doesn't work in case we activate the modal
    // in the useState call
    const mainDevice = getMainDevice();
    if (!mainDevice) {
      setIsPasswordModalVisible(true);
    } else {
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }, 250);
    }
  }, []);

  const createWorkspace = async () => {
    setIsCreatingWorkspace(true);
    try {
      if (!activeDevice) {
        throw new Error("No active device available");
      }
      const workspaceId = uuidv4();
      const workspaceKeyId = uuidv4();
      const folderId = uuidv4();
      const documentId = uuidv4();
      // grab all devices for this user
      if (!devicesResult.data?.devices?.nodes) {
        throw new Error("No devices found!");
      }
      const devices = devicesResult.data?.devices?.nodes as Device[];
      const { deviceWorkspaceKeyBoxes, workspaceKey } =
        await createWorkspaceKeyBoxesForDevices({ devices, activeDevice });
      if (!workspaceKey) {
        throw new Error("Could not retrieve workspaceKey!");
      }
      const folderName = "Getting started";
      const encryptedFolderResult = await encryptFolderName({
        name: folderName,
        parentKey: workspaceKey,
      });
      const documentName = "Introduction";
      // FIXME: For now we will use the same key for
      // document name and snapshot.
      // Separate these keys when we restructure the
      // createInitialWorkspaceStructure mutation
      // const documentKeyData = await createDocumentKey({
      //   folderKey: encryptedFolderResult.folderSubkey,
      // });
      const snapshotKey = await createSnapshotKey({
        folderKey: encryptedFolderResult.folderSubkey,
      });
      const encryptedDocumentTitle = await encryptDocumentTitle({
        title: documentName,
        key: snapshotKey.key, // documentKeyData.key, // FIXME!
      });
      // TODO: remove
      // const documentContentKeyData = await createDocumentKey({
      //   folderKey: encryptedFolderResult.folderSubkey,
      // });
      const snapshot = await createIntroductionDocumentSnapshot({
        documentId,
        snapshotEncryptionKey: sodium.from_base64(snapshotKey.key),
        subkeyId: snapshotKey.subkeyId,
        keyDerivationTrace: {
          workspaceKeyId,
          subkeyId: snapshotKey.subkeyId,
          parentFolders: [
            {
              folderId,
              subkeyId: encryptedFolderResult.folderSubkeyId,
              parentFolderId: null,
            },
          ],
        },
      });

      const createInitialWorkspaceStructureResult =
        await createInitialWorkspaceStructure({
          input: {
            workspaceName: name,
            workspaceId,
            folderId,
            encryptedFolderName: encryptedFolderResult.ciphertext,
            encryptedFolderNameNonce: encryptedFolderResult.publicNonce,
            folderSubkeyId: encryptedFolderResult.folderSubkeyId,
            folderIdSignature: `TODO+${folderId}`,
            encryptedDocumentName: encryptedDocumentTitle.ciphertext,
            encryptedDocumentNameNonce: encryptedDocumentTitle.publicNonce,
            documentSubkeyId: snapshotKey.subkeyId, // FIXME: documentKeyData.subkeyId,
            documentContentSubkeyId: 123, // TODO: remove
            documentId,
            documentSnapshot: snapshot,
            creatorDeviceSigningPublicKey: activeDevice?.signingPublicKey!,
            deviceWorkspaceKeyBoxes,
          },
        });
      if (
        !createInitialWorkspaceStructureResult.data
          ?.createInitialWorkspaceStructure?.workspace ||
        !createInitialWorkspaceStructureResult.data
          ?.createInitialWorkspaceStructure?.folder ||
        !createInitialWorkspaceStructureResult.data
          ?.createInitialWorkspaceStructure?.document
      ) {
        throw new Error("Could not create workspace structure!");
      }
      const workspace =
        createInitialWorkspaceStructureResult.data
          .createInitialWorkspaceStructure.workspace;
      const document =
        createInitialWorkspaceStructureResult.data
          .createInitialWorkspaceStructure.document;

      navigation.navigate("Workspace", {
        workspaceId: workspace.id,
        screen: "Page",
        params: {
          pageId: document.id,
        },
      });
      if (props.onWorkspaceStructureCreated) {
        props.onWorkspaceStructureCreated();
      }
    } catch (err) {
      console.error(err);
      setHasCreateWorkspaceError(true);
    } finally {
      setIsCreatingWorkspace(false);
    }
  };

  return (
    <>
      <FormWrapper>
        <ModalHeader>Create a workspace</ModalHeader>
        <Input
          ref={inputRef}
          label={"Workspace name"}
          onChangeText={setName}
          hint="This is the name of your organization, team or private notes. You can invite team members afterwards."
        />
        {hasCreateWorkspaceError && (
          <InfoMessage variant="error">
            Failed to create the workspace. Please try again later.
          </InfoMessage>
        )}
        <ModalButtonFooter
          confirm={
            <Button
              disabled={
                name.trim() === "" &&
                devicesResult.data?.devices?.nodes?.length !== undefined
              }
              onPress={createWorkspace}
              isLoading={isCreatingWorkspace}
            >
              Create workspace
            </Button>
          }
        />
      </FormWrapper>
      <VerifyPasswordModal
        isVisible={isPasswordModalVisible}
        description="Creating a new workspace requires access to the main account and therefore verifying your password is required"
        onSuccess={() => {
          setIsPasswordModalVisible(false);
          setTimeout(() => {
            if (inputRef.current) {
              inputRef.current.focus();
            }
          }, 250);
        }}
        onCancel={() => {
          setIsPasswordModalVisible(false);
          if (props.onCancel) {
            props.onCancel();
          }
        }}
      />
    </>
  );
}
