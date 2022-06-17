import setupGraphql from "../../../../test/helpers/setupGraphql";
import deleteAllRecords from "../../../../test/helpers/deleteAllRecords";
import { registerUser } from "../../../../test/helpers/registerUser";
import { createWorkspace } from "../../../../test/helpers/workspace/createWorkspace";
import { updateWorkspace } from "../../../../test/helpers/workspace/updateWorkspace";

const graphql = setupGraphql();
let userId1 = "";
const username = "user";
let userId2 = "";
const username2 = "user1";
const password = "password";
let isUserRegistered = false;
let addedWorkspace: any = null;
let mainDeviceSigningPublicKey1 = "";
let mainDeviceSigningPublicKey2 = "";
let mainDeviceSigningPublicKey3 = "";

beforeAll(async () => {
  await deleteAllRecords();
});

beforeEach(async () => {
  // TODO: we don't want this before every test
  if (!isUserRegistered) {
    const registerUserResult1 = await registerUser(graphql, username, password);
    mainDeviceSigningPublicKey1 =
      registerUserResult1.mainDeviceSigningPublicKey;
    userId1 = registerUserResult1.userId;

    const registerUserResult2 = await registerUser(
      graphql,
      username2,
      password
    );
    mainDeviceSigningPublicKey2 =
      registerUserResult2.mainDeviceSigningPublicKey;
    userId2 = registerUserResult2.userId;

    const createWorkspaceResult = await createWorkspace({
      name: "workspace 1",
      id: "abc",
      graphql,
      authorizationHeader: mainDeviceSigningPublicKey1,
    });
    addedWorkspace = createWorkspaceResult.createWorkspace.workspace;
    isUserRegistered = true;
  }
});

test("user won't update the name when not set", async () => {
  // generate a challenge code
  const authorizationHeader = mainDeviceSigningPublicKey1;
  const id = "abc";
  const name = undefined;
  const members = [
    {
      userId: userId1,
      isAdmin: true,
    },
    {
      userId: userId2,
      isAdmin: true,
    },
  ];
  const result = await updateWorkspace({
    graphql,
    id,
    name,
    members,
    authorizationHeader,
  });
  const workspace = result.updateWorkspace.workspace;
  expect(workspace.name).toBe(addedWorkspace.name);
  expect(workspace.members.length).toBe(2);
  workspace.members.forEach((member: { userId: string; isAdmin: any }) => {
    expect(member.isAdmin).toBe(true);
  });
});

test("user won't update the members", async () => {
  // generate a challenge code
  const authorizationHeader = mainDeviceSigningPublicKey1;
  const id = "abc";
  const name = "workspace 2";
  const members = undefined;
  const result = await updateWorkspace({
    graphql,
    id,
    name,
    members,
    authorizationHeader,
  });
  const workspace = result.updateWorkspace.workspace;
  expect(workspace.name).toBe(name);
  expect(workspace.members.length).toBe(2);
  workspace.members.forEach((member: { userId: string; isAdmin: any }) => {
    expect(member.isAdmin).toBe(true);
  });
});

// WARNING: after this, user is no longer an admin on this workspace
test("user should be able to update a workspace, but not their own access level", async () => {
  // generate a challenge code
  const authorizationHeader = mainDeviceSigningPublicKey1;
  const id = "abc";
  const name = "renamed workspace";
  const members = [
    {
      userId: userId1,
      isAdmin: false,
    },
    {
      userId: userId2,
      isAdmin: false,
    },
  ];
  const result = await updateWorkspace({
    graphql,
    id,
    name,
    members,
    authorizationHeader,
  });
  const workspace = result.updateWorkspace.workspace;
  expect(workspace.name).toBe(name);
  expect(workspace.members.length).toBe(2);
  workspace.members.forEach((member: { userId: string; isAdmin: any }) => {
    if (member.userId === userId1) {
      expect(member.isAdmin).toBe(true);
    } else {
      expect(member.isAdmin).toBe(false);
    }
  });
});

test("user should not be able to update a workspace they don't own", async () => {
  // generate a challenge code
  const authorizationHeader = mainDeviceSigningPublicKey2;
  const id = "abc";
  const name = "unauthorized workspace";
  const members = [
    {
      userId: userId1,
      isAdmin: true,
    },
    {
      userId: userId2,
      isAdmin: true,
    },
  ];
  await expect(
    (async () =>
      await updateWorkspace({
        graphql,
        id,
        name,
        members,
        authorizationHeader,
      }))()
  ).rejects.toThrow("Unauthorized");
});

test("user should not be able to update a workspace for a workspace that doesn't exist", async () => {
  // generate a challenge code
  const authorizationHeader = mainDeviceSigningPublicKey1;
  const id = "hahahaha";
  const name = "nonexistent workspace";
  const members = [
    {
      userId: userId1,
      isAdmin: false,
    },
    {
      userId: userId2,
      isAdmin: true,
    },
  ];
  await expect(
    (async () =>
      await updateWorkspace({
        graphql,
        id,
        name,
        members,
        authorizationHeader,
      }))()
  ).rejects.toThrow("Unauthorized");
});
