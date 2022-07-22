import setupGraphql from "../../../../test/helpers/setupGraphql";
import deleteAllRecords from "../../../../test/helpers/deleteAllRecords";
import { registerUser } from "../../../../test/helpers/authentication/registerUser";
import { createInitialWorkspaceStructure } from "../../../../test/helpers/workspace/createInitialWorkspaceStructure";
import { createDocument } from "../../../../test/helpers/document/createDocument";
import { deleteDocuments } from "../../../../test/helpers/document/deleteDocuments";
import { v4 as uuidv4 } from "uuid";

const graphql = setupGraphql();
const username = "user1";
const password = "password";
let addedWorkspace: any = null;
let addedDocumentId: any = null;
let sessionKey = "";

const setup = async () => {
  const registerUserResult = await registerUser(graphql, username, password);
  sessionKey = registerUserResult.sessionKey;
  const createWorkspaceResult = await createInitialWorkspaceStructure({
    workspaceName: "workspace 1",
    workspaceId: "5a3484e6-c46e-42ce-a285-088fc1fd6915",
    folderName: "Getting started",
    folderId: uuidv4(),
    folderIdSignature: `TODO+${uuidv4()}`,
    documentName: "Introduction",
    documentId: uuidv4(),
    graphql,
    authorizationHeader: sessionKey,
  });
  addedWorkspace =
    createWorkspaceResult.createInitialWorkspaceStructure.workspace;
};

beforeAll(async () => {
  await deleteAllRecords();
  await setup();
});

test("user should be able to create a document", async () => {
  const id = uuidv4();
  const result = await createDocument({
    id,
    graphql,
    authorizationHeader: sessionKey,
    parentFolderId: null,
    workspaceId: addedWorkspace.id,
  });
  expect(result.createDocument.id).toBe(id);
});

test("Unauthenticated", async () => {
  await expect(
    (async () =>
      await createDocument({
        id: uuidv4(),
        graphql,
        authorizationHeader: "badauthkey",
        parentFolderId: null,
        workspaceId: addedWorkspace.id,
      }))()
  ).rejects.toThrowError(/UNAUTHENTICATED/);
});
