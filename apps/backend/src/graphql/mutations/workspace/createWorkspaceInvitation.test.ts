import { gql } from "graphql-request";
import { v4 as uuidv4 } from "uuid";
import deleteAllRecords from "../../../../test/helpers/deleteAllRecords";
import setupGraphql from "../../../../test/helpers/setupGraphql";
import { createWorkspaceInvitation } from "../../../../test/helpers/workspace/createWorkspaceInvitation";
import createUserWithWorkspace from "../../../database/testHelpers/createUserWithWorkspace";
import { getWorkspace } from "../../../database/workspace/getWorkspace";

const graphql = setupGraphql();

let userAndDevice2: any = null;

beforeAll(async () => {
  await deleteAllRecords();
});

test("user should be able to create an invitation", async () => {
  const workspaceId = "workspace1";
  const username = "jane2@example.com";
  const userAndDevice = await createUserWithWorkspace({
    id: workspaceId,
    username,
  });
  const device = userAndDevice.device;
  const workspace = await getWorkspace({
    id: workspaceId,
    userId: userAndDevice.user.id,
    deviceSigningPublicKey: device.signingPublicKey,
  });
  if (!workspace) {
    throw new Error("workspace not found");
  }
  const result = await createWorkspaceInvitation({
    graphql,
    workspaceId,
    authorizationHeader: userAndDevice.sessionKey,
  });
  const workspaceInvitation =
    result.createWorkspaceInvitation.workspaceInvitation;
  expect(typeof workspaceInvitation.id).toBe("string");
  expect(workspaceInvitation.workspaceId).toBe(workspaceId);
  expect(workspaceInvitation.inviterUserId).toBe(userAndDevice.user.id);
  expect(workspaceInvitation.expiresAt).toBeDefined();
});

test("user should not be able to invite from a workspace they don't own", async () => {
  const workspaceId1 = "workspace2";
  const workspaceId2 = "otherWorkspace";
  const username1 = "adam@example.com";
  const username2 = "betty@example.com";
  const userAndDevice1 = await createUserWithWorkspace({
    id: workspaceId1,
    username: username1,
  });
  userAndDevice2 = await createUserWithWorkspace({
    id: workspaceId2,
    username: username2,
  });
  await expect(
    (async () =>
      await createWorkspaceInvitation({
        graphql,
        workspaceId: workspaceId2,
        authorizationHeader: userAndDevice1.sessionKey,
      }))()
  ).rejects.toThrow("Unauthorized");
});

test("user should not be able to invite from a workspace that doesn't exist", async () => {
  const username = "adam@example.com";
  await expect(
    (async () =>
      await createWorkspaceInvitation({
        graphql,
        workspaceId: "nonexistantWorkspace",
        authorizationHeader: userAndDevice2.sessionKey,
      }))()
  ).rejects.toThrow("Unauthorized");
});

test("Unauthenticated", async () => {
  const workspaceId = uuidv4();
  const username = "a@a.com";
  await createUserWithWorkspace({
    id: workspaceId,
    username: username,
  });
  await expect(
    (async () =>
      await createWorkspaceInvitation({
        graphql,
        workspaceId,
        authorizationHeader: "badauthheader",
      }))()
  ).rejects.toThrowError(/UNAUTHENTICATED/);
});

test("Input Error", async () => {
  const authorizationHeaders = {
    authorization: userAndDevice2.sessionKey,
  };
  const query1 = gql`
    mutation {
      createWorkspaceInvitation(input: null) {
        workspaceInvitation {
          id
          workspaceId
          inviterUserId
          expiresAt
        }
      }
    }
  `;
  await expect(
    (async () =>
      await graphql.client.request(query1, null, authorizationHeaders))()
  ).rejects.toThrowError(/GRAPHQL_VALIDATION_FAILED/);
});
