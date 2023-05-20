import { generateId } from "@serenity-tools/common";
import { gql } from "graphql-request";
import deleteAllRecords from "../../../../test/helpers/deleteAllRecords";
import setupGraphql from "../../../../test/helpers/setupGraphql";
import { createInitialWorkspaceStructure } from "../../../../test/helpers/workspace/createInitialWorkspaceStructure";
import createUserWithWorkspace from "../../../database/testHelpers/createUserWithWorkspace";

const graphql = setupGraphql();
let userData1: any = undefined;
let otherWorkspaceStructure: any = undefined;
const password = "password";
let sessionKey = "";

const workspace2Name = "workspace 2";

const meQuery = gql`
  {
    me {
      id
      username
    }
  }
`;

const meWithWorkspaceLoadingInfoQuery = gql`
  query me(
    $workspaceId: ID
    $documentId: ID
    $returnOtherWorkspaceIfNotFound: Boolean
    $returnOtherDocumentIfNotFound: Boolean
  ) {
    me {
      id
      username
      workspaceLoadingInfo(
        workspaceId: $workspaceId
        returnOtherWorkspaceIfNotFound: $returnOtherWorkspaceIfNotFound
        documentId: $documentId
        returnOtherDocumentIfNotFound: $returnOtherDocumentIfNotFound
      ) {
        id
        isAuthorized
        documentId
        role
      }
    }
  }
`;

const setup = async () => {
  userData1 = await createUserWithWorkspace({
    id: generateId(),
    username: `${generateId()}@example.com`,
    password,
  });
  const createWorkspaceResult = await createInitialWorkspaceStructure({
    graphql,
    workspaceName: workspace2Name,
    creatorDevice: {
      ...userData1.device,
      encryptionPrivateKey: userData1.encryptionPrivateKey,
      signingPrivateKey: userData1.signingPrivateKey,
    },
    devices: [userData1.device, userData1.webDevice],
    authorizationHeader: userData1.sessionKey,
  });
  otherWorkspaceStructure =
    createWorkspaceResult.createInitialWorkspaceStructure;
};

beforeAll(async () => {
  await deleteAllRecords();
  await setup();
});

test("user should be able to get their username", async () => {
  const result = await graphql.client.request(meQuery, null, {
    authorization: userData1.sessionKey,
  });
  expect(result.me.id).toEqual(userData1.user.id);
  expect(result.me.username).toEqual(userData1.user.username);
});

test("should be able to get the workspaceLoadingInfo with a defined workspaceId and documentId", async () => {
  const result = await graphql.client.request(
    meWithWorkspaceLoadingInfoQuery,
    {
      workspaceId: userData1.workspace.id,
      documentId: userData1.document.id,
      returnOtherWorkspaceIfNotFound: false,
      returnOtherDocumentIfNotFound: false,
    },
    { authorization: userData1.sessionKey }
  );
  expect(result.me.workspaceLoadingInfo).toMatchInlineSnapshot(`
    {
      "documentId": "${userData1.document.id}",
      "id": "${userData1.workspace.id}",
      "isAuthorized": true,
      "role": "ADMIN",
    }
  `);
});

test("should get the fallback workspace if the workspaceId is not available and return other is true", async () => {
  const result = await graphql.client.request(
    meWithWorkspaceLoadingInfoQuery,
    {
      workspaceId: "abc",
      documentId: "cde",
      returnOtherWorkspaceIfNotFound: true,
      returnOtherDocumentIfNotFound: true,
    },
    { authorization: userData1.sessionKey }
  );
  expect(result.me.workspaceLoadingInfo).toMatchInlineSnapshot(`
    {
      "documentId": "${otherWorkspaceStructure.document.id}",
      "id": "${otherWorkspaceStructure.workspace.id}",
      "isAuthorized": true,
      "role": "ADMIN",
    }
  `);
});

test("should get no workspace if the workspaceId is not available and return other is false", async () => {
  const result = await graphql.client.request(
    meWithWorkspaceLoadingInfoQuery,
    {
      workspaceId: "abc",
      documentId: "cde",
      returnOtherWorkspaceIfNotFound: false,
      returnOtherDocumentIfNotFound: false,
    },
    { authorization: userData1.sessionKey }
  );
  expect(result.me.workspaceLoadingInfo).toBe(null);
});

test("should be able to get the workspaceLoadingInfo, but another documentId if the provided documentId is not available and return other is true", async () => {
  const result = await graphql.client.request(
    meWithWorkspaceLoadingInfoQuery,
    {
      workspaceId: userData1.workspace.id,
      documentId: "abc",
      returnOtherDocumentIfNotFound: true,
    },
    { authorization: userData1.sessionKey }
  );
  expect(result.me.workspaceLoadingInfo).toMatchInlineSnapshot(`
    {
      "documentId": "${userData1.document.id}",
      "id": "${userData1.workspace.id}",
      "isAuthorized": true,
      "role": "ADMIN",
    }
  `);
});

test("should get the workspaceLoadingInfo, but no documentId if the provided documentId is not available and return other is false", async () => {
  const result = await graphql.client.request(
    meWithWorkspaceLoadingInfoQuery,
    {
      workspaceId: userData1.workspace.id,
      documentId: "abc",
      returnOtherDocumentIfNotFound: false,
    },
    { authorization: userData1.sessionKey }
  );
  expect(result.me.workspaceLoadingInfo).toMatchInlineSnapshot(`
    {
      "documentId": null,
      "id": "${userData1.workspace.id}",
      "isAuthorized": true,
      "role": "ADMIN",
    }
  `);
});

test("documentId provided but not the workspaceId", async () => {
  await expect(
    (async () =>
      await graphql.client.request(
        meWithWorkspaceLoadingInfoQuery,
        {
          documentId: userData1.document.id,
        },
        { authorization: userData1.sessionKey }
      ))()
  ).rejects.toThrowError(/BAD_USER_INPUT/);
});

test("Unauthenticated", async () => {
  const result = await graphql.client.request(meQuery, null, {
    authorization: "bad-session-key",
  });
  expect(result.me).toEqual(null);
});
