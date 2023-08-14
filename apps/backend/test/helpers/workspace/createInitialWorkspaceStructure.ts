import * as workspaceChain from "@serenity-kit/workspace-chain";
import {
  LocalDevice,
  createDocumentTitleKey,
  createIntroductionDocumentSnapshot,
  createSnapshotKey,
  encryptDocumentTitleByKey,
  encryptFolderName,
  encryptWorkspaceKeyForDevice,
  folderDerivedKeyContext,
  generateId,
  snapshotDerivedKeyContext,
} from "@serenity-tools/common";
import { gql } from "graphql-request";
import sodium from "react-native-libsodium";
import { DeviceWorkspaceKeyBoxParams } from "../../../src/database/workspace/createWorkspace";
import { Device } from "../../../src/types/device";

const query = gql`
  mutation createInitialWorkspaceStructure(
    $input: CreateInitialWorkspaceStructureInput!
  ) {
    createInitialWorkspaceStructure(input: $input) {
      workspace {
        id
        name
        members {
          userId
        }
        currentWorkspaceKey {
          id
          workspaceId
          generation
          workspaceKeyBox {
            id
            workspaceKeyId
            deviceSigningPublicKey
            ciphertext
            nonce
            creatorDevice {
              signingPublicKey
              encryptionPublicKey
            }
          }
        }
      }
      folder {
        id
        nameCiphertext
        nameNonce
        parentFolderId
        rootFolderId
        workspaceId
        keyDerivationTrace {
          workspaceKeyId
          trace {
            entryId
            subkeyId
            parentId
            context
          }
        }
      }
      document {
        id
        nameCiphertext
        nameNonce
        parentFolderId
        workspaceId
        subkeyId
      }
    }
  }
`;

type Params = {
  graphql: any;
  workspaceName: string;
  creatorDevice: LocalDevice;
  mainDevice: LocalDevice;
  devices: Device[];
  authorizationHeader: string;
};

export const createInitialWorkspaceStructure = async ({
  graphql,
  workspaceName,
  creatorDevice,
  mainDevice,
  devices,
  authorizationHeader,
}: Params) => {
  // create ids
  const event = workspaceChain.createChain({
    privateKey: mainDevice.signingPrivateKey,
    publicKey: mainDevice.signingPublicKey,
  });

  const workspaceKeyId = generateId();
  const folderId = generateId();
  const documentId = generateId();

  const folderName = "Getting Started";
  const documentName = "Introduction";

  // create workspace key boxes
  const workspaceKey = sodium.to_base64(sodium.crypto_kdf_keygen());
  const deviceWorkspaceKeyBoxes: DeviceWorkspaceKeyBoxParams[] = [];
  for (const device of devices) {
    const deviceWorkspaceKeyBox = encryptWorkspaceKeyForDevice({
      receiverDeviceEncryptionPublicKey: device.encryptionPublicKey,
      creatorDeviceEncryptionPrivateKey: creatorDevice.encryptionPrivateKey,
      workspaceKey,
    });
    deviceWorkspaceKeyBoxes.push({
      deviceSigningPublicKey: device.signingPublicKey,
      ciphertext: deviceWorkspaceKeyBox.ciphertext,
      nonce: deviceWorkspaceKeyBox.nonce,
    });
  }
  const readyWorkspace = {
    name: workspaceName,
    workspaceKeyId,
    deviceWorkspaceKeyBoxes,
  };

  // prepare the folder
  const encryptedFolderResult = encryptFolderName({
    name: folderName,
    parentKey: workspaceKey,
  });
  const encryptedFolderName = encryptedFolderResult.ciphertext;
  const encryptedFolderNameNonce = encryptedFolderResult.publicNonce;
  const folderSubkeyId = encryptedFolderResult.folderSubkeyId;
  const folderKey = encryptedFolderResult.folderSubkey;
  const folderIdSignature = sodium.to_base64(
    sodium.crypto_sign_detached(
      folderId,
      sodium.from_base64(creatorDevice.signingPrivateKey)
    )
  );
  const readyFolder = {
    id: folderId,
    idSignature: folderIdSignature,
    nameCiphertext: encryptedFolderName,
    nameNonce: encryptedFolderNameNonce,
    // since we haven't created the workspaceKey yet,
    // we must derive the trace manually
    keyDerivationTrace: {
      workspaceKeyId,
      trace: [
        {
          entryId: folderId,
          subkeyId: folderSubkeyId,
          parentId: null,
          context: folderDerivedKeyContext,
        },
      ],
    },
  };

  // prepare the snapshot key
  const snapshotKey = createSnapshotKey({
    folderKey,
  });
  // propare the document key
  const documentTitleKeyResult = createDocumentTitleKey({
    snapshotKey: snapshotKey.key,
  });
  const documentTitleKey = documentTitleKeyResult.key;
  const documentSubkeyId = documentTitleKeyResult.subkeyId;

  const encryptedDocumentTitleResult = encryptDocumentTitleByKey({
    title: documentName,
    key: documentTitleKey,
  });
  const encryptedDocumentName = encryptedDocumentTitleResult.ciphertext;
  const encryptedDocumentNameNonce = encryptedDocumentTitleResult.publicNonce;

  const snapshotId = generateId();
  const snapshot = createIntroductionDocumentSnapshot({
    documentId,
    snapshotEncryptionKey: sodium.from_base64(snapshotKey.key),
    keyDerivationTrace: {
      workspaceKeyId,
      trace: [
        {
          entryId: folderId,
          parentId: null,
          subkeyId: encryptedFolderResult.folderSubkeyId,
          context: folderDerivedKeyContext,
        },
        {
          entryId: snapshotId,
          parentId: folderId,
          subkeyId: snapshotKey.subkeyId,
          context: snapshotDerivedKeyContext,
        },
      ],
    },
    device: creatorDevice,
  });

  // prepare the document
  const readyDocument = {
    id: documentId,
    nameCiphertext: encryptedDocumentName,
    nameNonce: encryptedDocumentNameNonce,
    subkeyId: documentSubkeyId,
    snapshot,
  };

  // create the initial workspace structure
  const authorizationHeaders = {
    authorization: authorizationHeader,
  };
  const result = await graphql.client.request(
    query,
    {
      input: {
        workspace: readyWorkspace,
        serializedWorkspaceChainEvent: JSON.stringify(event),
        folder: readyFolder,
        document: readyDocument,
        creatorDeviceSigningPublicKey: creatorDevice.signingPublicKey,
      },
    },
    authorizationHeaders
  );
  return result;
};
