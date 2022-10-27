import { gql } from "graphql-request";
import { v4 as uuidv4 } from "uuid";
import { registerUser } from "../../../../test/helpers/authentication/registerUser";
import deleteAllRecords from "../../../../test/helpers/deleteAllRecords";
import { getWorkspaceKeyForWorkspaceAndDevice } from "../../../../test/helpers/device/getWorkspaceKeyForWorkspaceAndDevice";
import { createFolder } from "../../../../test/helpers/folder/createFolder";
import setupGraphql from "../../../../test/helpers/setupGraphql";
import { createInitialWorkspaceStructure } from "../../../../test/helpers/workspace/createInitialWorkspaceStructure";

const graphql = setupGraphql();
const username = "7dfb4dd9-88be-414c-8a40-b5c030003d89@example.com";
const username2 = "68776484-0e46-4027-a6f4-8bdeef185b73@example.com";
const password = "password";
let workspaceKey = "";
let workspaceKey2 = "";

const workspaceId = "4e9a4c29-2295-471c-84b5-5bf55169ff8c";
const otherWorkspaceId = "929ca262-f144-40f7-8fe2-d3147f415f26";
const parentFolderId = "4e9a4c29-2295-471c-84b5-5bf55169ff8c";
const folderId1 = "3530b9ed-11f3-44c7-9e16-7dba1e14815f";
const folderId2 = "9e911f29-7a86-480b-89d7-5c647f21317f";
const childFolderId = "98b3f4d9-141a-4e11-a0f5-7437a6d1eb4b";
const otherFolderId = "c1c65251-7471-4893-a1b5-e3df937caf66";
let sessionKey = "";
let initialWorkspaceStructureResult: any = null;
let workspace: any = null;

type GetFoldersProps = {
  parentFolderId: string;
  usingOldKeys: boolean;
  authorizationHeader: string;
};
const getFolders = async ({
  parentFolderId,
  usingOldKeys,
  authorizationHeader,
}: GetFoldersProps) => {
  const authorizationHeaders = { authorization: authorizationHeader };
  const query = gql`
  {
      folders(parentFolderId: "${parentFolderId}", first: 50, usingOldKeys: ${usingOldKeys}) {
          edges {
              node {
                  id
                  parentFolderId
                  rootFolderId
                  workspaceId
                  encryptedName
                  encryptedNameNonce
                  keyDerivationTrace {
                    workspaceKeyId
                    parentFolders {
                      folderId
                      subkeyId
                      parentFolderId
                    }
                  }
              }
          }
          pageInfo {
              hasNextPage
              endCursor
          }
      }
  }`;
  const result = await graphql.client.request(
    query,
    null,
    authorizationHeaders
  );
  return result;
};

const setup = async () => {
  const registerUserResult = await registerUser(graphql, username, password);
  sessionKey = registerUserResult.sessionKey;
  const device = registerUserResult.mainDevice;
  const webDevice = registerUserResult.webDevice;
  initialWorkspaceStructureResult = await createInitialWorkspaceStructure({
    workspaceName: "workspace 1",
    workspaceId: workspaceId,
    deviceSigningPublicKey: device.signingPublicKey,
    deviceEncryptionPublicKey: device.encryptionPublicKey,
    deviceEncryptionPrivateKey: registerUserResult.encryptionPrivateKey,
    webDevice,
    folderId: uuidv4(),
    folderName: "Getting started",
    folderIdSignature: `TODO+${uuidv4()}`,
    documentId: uuidv4(),
    documentName: "Introduction",
    graphql,
    authorizationHeader: sessionKey,
  });
  workspace =
    initialWorkspaceStructureResult.createInitialWorkspaceStructure.workspace;
  workspaceKey = await getWorkspaceKeyForWorkspaceAndDevice({
    device: registerUserResult.mainDevice,
    deviceEncryptionPrivateKey: registerUserResult.encryptionPrivateKey,
    workspace,
  });
  const parentFolderName = "parent folder";
  const createParentFolderResult = await createFolder({
    graphql,
    id: parentFolderId,
    name: parentFolderName,
    parentFolderId: null,
    parentKey: workspaceKey,
    authorizationHeader: sessionKey,
    workspaceId: workspaceId,
    workspaceKeyId: workspace.currentWorkspaceKey.id,
  });
  const registerUserResult2 = await registerUser(graphql, username2, password);
  const device2 = registerUserResult2.mainDevice;
  const initialWorkspaceStructureResult2 =
    await createInitialWorkspaceStructure({
      workspaceName: "other user workspace",
      workspaceId: otherWorkspaceId,
      deviceSigningPublicKey: device2.signingPublicKey,
      deviceEncryptionPublicKey: device2.encryptionPublicKey,
      deviceEncryptionPrivateKey: registerUserResult2.encryptionPrivateKey,
      webDevice: registerUserResult2.webDevice,
      folderId: uuidv4(),
      folderName: "Getting started",
      folderIdSignature: `TODO+${uuidv4()}`,
      documentId: uuidv4(),
      documentName: "Introduction",
      graphql,
      authorizationHeader: registerUserResult2.sessionKey,
    });
  const workspace2 =
    initialWorkspaceStructureResult2.createInitialWorkspaceStructure.workspace;
  workspaceKey2 = await getWorkspaceKeyForWorkspaceAndDevice({
    device: registerUserResult2.mainDevice,
    deviceEncryptionPrivateKey: registerUserResult2.encryptionPrivateKey,
    workspace: workspace2,
  });
  const otherFolderName = "other folder";
  const createOtherFolderResult = await createFolder({
    graphql,
    id: otherFolderId,
    name: otherFolderName,
    parentFolderId: null,
    parentKey: workspaceKey2,
    authorizationHeader: registerUserResult2.sessionKey,
    workspaceId: otherWorkspaceId,
    workspaceKeyId: workspace2.currentWorkspaceKey.id,
  });
};

beforeAll(async () => {
  await deleteAllRecords();
  await setup();
});

test("user should be able to list folders in a workspace when no subfoldes", async () => {
  const result = await getFolders({
    parentFolderId,
    usingOldKeys: false,
    authorizationHeader: sessionKey,
  });
  expect(result.folders.edges.length).toBe(0);
});

test("user should be able to list folders in a workspace with one item", async () => {
  const createParentFolderResult = await createFolder({
    graphql,
    id: folderId1,
    name: "parent folder",
    parentFolderId: parentFolderId,
    parentKey: workspaceKey,
    authorizationHeader: sessionKey,
    workspaceId: workspaceId,
    workspaceKeyId: workspace.currentWorkspaceKey.id,
  });
  const result = await getFolders({
    parentFolderId,
    usingOldKeys: false,
    authorizationHeader: sessionKey,
  });
  expect(result.folders.edges.length).toBe(1);
  result.folders.edges.forEach(
    (folder: {
      node: { id: string; name: any; parentFolderId: any; rootFolderId: any };
    }) => {
      if (folder.node.id === folderId1) {
        expect(folder.node.parentFolderId).toBe(parentFolderId);
        expect(folder.node.rootFolderId).toBe(parentFolderId);
      }
    }
  );
});

test("user should be able to list folders in a workspace with multiple items", async () => {
  const createFolderResult = await createFolder({
    graphql,
    id: folderId2,
    name: "multiple folders",
    parentFolderId: parentFolderId,
    parentKey: workspaceKey,
    authorizationHeader: sessionKey,
    workspaceId: workspaceId,
    workspaceKeyId: workspace.currentWorkspaceKey.id,
  });
  const result = await getFolders({
    parentFolderId,
    usingOldKeys: false,
    authorizationHeader: sessionKey,
  });
  expect(result.folders.edges.length).toBe(2);
  result.folders.edges.forEach(
    (folder: {
      node: { id: string; name: any; parentFolderId: any; rootFolderId: any };
    }) => {
      if (folder.node.id === folderId2) {
        expect(folder.node.parentFolderId).toBe(parentFolderId);
        expect(folder.node.rootFolderId).toBe(parentFolderId);
      }
    }
  );
});

test("user should be able to list without showing subfolders", async () => {
  const createFolderResult = await createFolder({
    graphql,
    id: childFolderId,
    name: "folder",
    parentFolderId: folderId1,
    parentKey: workspaceKey,
    authorizationHeader: sessionKey,
    workspaceId: workspaceId,
    workspaceKeyId: workspace.currentWorkspaceKey.id,
  });
  const result = await getFolders({
    parentFolderId,
    usingOldKeys: false,
    authorizationHeader: sessionKey,
  });
  expect(result.folders.edges.length).toBe(2);
});

test("old workpace keys", async () => {
  const result = await getFolders({
    parentFolderId,
    usingOldKeys: true,
    authorizationHeader: sessionKey,
  });
  expect(result.folders.edges.length).toBe(0);
});

test("retrieving a folder that doesn't exist throws an error", async () => {
  const fakeFolderId = "2bd63f0b-66f4-491c-8808-0a1de192cb67";
  await expect(
    (async () =>
      await getFolders({
        parentFolderId: fakeFolderId,
        usingOldKeys: false,
        authorizationHeader: sessionKey,
      }))()
  ).rejects.toThrow("Unauthorized");
});

test("listing folders that the user doesn't own throws an error", async () => {
  await expect(
    (async () =>
      await getFolders({
        parentFolderId: otherFolderId,
        usingOldKeys: false,
        authorizationHeader: sessionKey,
      }))()
  ).rejects.toThrow("Unauthorized");
});

test("Unauthenticated", async () => {
  await expect(
    (async () =>
      await getFolders({
        parentFolderId,
        usingOldKeys: false,
        authorizationHeader: "badauthheader",
      }))()
  ).rejects.toThrowError(/UNAUTHENTICATED/);
});
