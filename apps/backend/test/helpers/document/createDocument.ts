import {
  createSnapshot,
  KeyDerivationTrace2,
  Snapshot,
  SnapshotPublicData,
} from "@naisho/core";
import {
  createSnapshotKey,
  deriveKeysFromKeyDerivationTrace,
  LocalDevice,
  snapshotDerivedKeyContext,
} from "@serenity-tools/common";
import { gql } from "graphql-request";
import { KeyPair } from "libsodium-wrappers";
import sodium from "react-native-libsodium";
import { v4 as uuidv4 } from "uuid";
import { prisma } from "../../../src/database/prisma";
import { createFolderKeyDerivationTrace } from "../folder/createFolderKeyDerivationTrace";

type RunCreateDocumentMutationParams = {
  graphql: any;
  id: string;
  parentFolderId: string | null;
  workspaceId: string;
  snapshot?: Snapshot | null | undefined;
  authorizationHeader: string;
};
const runCreateDocumentMutation = async ({
  graphql,
  id,
  parentFolderId,
  workspaceId,
  snapshot,
  authorizationHeader,
}: RunCreateDocumentMutationParams) => {
  const authorizationHeaders = {
    authorization: authorizationHeader,
  };
  const query = gql`
    mutation createDocument($input: CreateDocumentInput!) {
      createDocument(input: $input) {
        id
      }
    }
  `;
  return graphql.client.request(
    query,
    {
      input: {
        id,
        parentFolderId,
        workspaceId,
        snapshot,
      },
    },
    authorizationHeaders
  );
};

type Params = {
  graphql: any;
  id: string;
  parentFolderId: string | null;
  workspaceId: string;
  activeDevice: LocalDevice;
  authorizationHeader: string;
};

export const createDocument = async ({
  graphql,
  id,
  parentFolderId,
  workspaceId,
  activeDevice,
  authorizationHeader,
}: Params) => {
  const workspace = await prisma.workspace.findFirst({
    where: {
      id: workspaceId,
    },
    include: {
      workspaceKeys: {
        orderBy: { generation: "desc" },
        take: 1,
        include: {
          workspaceKeyBoxes: {
            where: { deviceSigningPublicKey: activeDevice.signingPublicKey },
            include: { creatorDevice: true },
          },
        },
      },
    },
  });
  if (!workspace) {
    // return the query to produce an error
    return runCreateDocumentMutation({
      graphql,
      id,
      parentFolderId,
      workspaceId,
      snapshot: null,
      authorizationHeader,
    });
  }
  const workspaceKeyBox = workspace.workspaceKeys[0].workspaceKeyBoxes[0];

  const folder = await prisma.folder.findFirst({
    where: {
      id: parentFolderId!,
      workspaceId,
    },
  });
  if (!folder) {
    // return the query to produce an error
    return runCreateDocumentMutation({
      graphql,
      id,
      parentFolderId,
      workspaceId,
      snapshot: null,
      authorizationHeader,
    });
  }
  const folderKeyTrace = deriveKeysFromKeyDerivationTrace({
    keyDerivationTrace: folder.keyDerivationTrace as KeyDerivationTrace2,
    activeDevice,
    workspaceKeyBox,
  });
  const folderKey = folderKeyTrace.trace[folderKeyTrace.trace.length - 1].key;
  const snapshotKey = createSnapshotKey({
    folderKey,
  });

  const snapshotKeyDerivationTrace = await createFolderKeyDerivationTrace({
    workspaceKeyId: workspaceKeyBox.workspaceKeyId,
    parentFolderId,
  });
  const snapshotId = uuidv4();
  snapshotKeyDerivationTrace.trace.push({
    entryId: snapshotId,
    parentId: parentFolderId,
    subkeyId: snapshotKey.subkeyId,
    context: snapshotDerivedKeyContext,
  });

  const signatureKeyPair: KeyPair = {
    publicKey: sodium.from_base64(activeDevice.signingPublicKey),
    privateKey: sodium.from_base64(activeDevice.signingPrivateKey),
    keyType: "ed25519",
  };

  const publicData: SnapshotPublicData = {
    snapshotId: uuidv4(),
    docId: id,
    pubKey: sodium.to_base64(signatureKeyPair.publicKey),
    subkeyId: snapshotKey.subkeyId,
    keyDerivationTrace: snapshotKeyDerivationTrace,
  };

  const initialDocument = "";
  const snapshot = createSnapshot(
    sodium.from_base64(initialDocument),
    publicData,
    sodium.from_base64(snapshotKey.key),
    signatureKeyPair
  );

  return runCreateDocumentMutation({
    graphql,
    id,
    parentFolderId,
    workspaceId,
    snapshot,
    authorizationHeader,
  });
};
