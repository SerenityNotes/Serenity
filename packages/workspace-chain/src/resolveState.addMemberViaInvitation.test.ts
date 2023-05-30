import sodium from "react-native-libsodium";
import {
  getDateIn2Min,
  getKeyPairA,
  getKeyPairB,
  getKeyPairC,
  getKeyPairsA,
  getKeyPairsB,
  getKeyPairsC,
  KeyPairs,
} from "../test/testUtils";
import { acceptInvitation } from "./acceptInvitation";
import {
  addInvitation,
  addMemberViaInvitation,
  createChain,
  InvalidWorkspaceChainError,
  resolveState,
} from "./index";
import { hashTransaction } from "./utils";

let keyPairA: sodium.KeyPair;
let keyPairsA: KeyPairs;
let keyPairB: sodium.KeyPair;
let keyPairsB: KeyPairs;
let keyPairC: sodium.KeyPair;
let keyPairsC: KeyPairs;
let mainDevice: {
  mainDeviceSigningPublicKey: string;
};

beforeAll(async () => {
  await sodium.ready;
  keyPairA = getKeyPairA();
  keyPairsA = getKeyPairsA();
  keyPairB = getKeyPairB();
  keyPairsB = getKeyPairsB();
  keyPairC = getKeyPairC();
  keyPairsC = getKeyPairsC();
  mainDevice = {
    mainDeviceSigningPublicKey: keyPairsB.sign.publicKey,
  };
});

test("should be able to add a member via an invitation", async () => {
  const createEvent = createChain(keyPairsA.sign);
  const addInvitationEvent = addInvitation({
    prevHash: hashTransaction(createEvent.transaction),
    authorKeyPair: keyPairA,
    expiresAt: getDateIn2Min(),
    role: "EDITOR",
    workspaceId: "test",
  });

  if (addInvitationEvent.transaction.type !== "add-invitation") {
    throw new Error("Invalid transaction type");
  }

  const { acceptInvitationSignature, acceptInvitationAuthorSignature } =
    acceptInvitation({
      invitationSigningKeyPairSeed:
        addInvitationEvent.invitationSigningKeyPairSeed,
      ...addInvitationEvent.transaction,
      expiresAt: new Date(addInvitationEvent.transaction.expiresAt),
      authorKeyPair: keyPairB,
    });

  const addMemberViaInvitationEvent = addMemberViaInvitation({
    prevHash: hashTransaction(addInvitationEvent.transaction),
    authorKeyPair: keyPairA,
    acceptInvitationSignature: sodium.to_base64(acceptInvitationSignature),
    acceptInvitationAuthorSignature: sodium.to_base64(
      acceptInvitationAuthorSignature
    ),
    ...addInvitationEvent.transaction,
    ...mainDevice,
    expiresAt: new Date(addInvitationEvent.transaction.expiresAt),
  });
  const state = resolveState([
    createEvent,
    addInvitationEvent,
    addMemberViaInvitationEvent,
  ]);
  expect(state.members).toMatchInlineSnapshot(`
    {
      "74IPzs2dhoERLRuxeS7zadzEvKfb7IqOK-jKu0mQxIM": {
        "addedBy": [
          "74IPzs2dhoERLRuxeS7zadzEvKfb7IqOK-jKu0mQxIM",
        ],
        "role": "ADMIN",
      },
      "MTDhqVIMflTD0Car-KSP1MWCIEYqs2LBaXfU20di0tY": {
        "addedBy": [
          "74IPzs2dhoERLRuxeS7zadzEvKfb7IqOK-jKu0mQxIM",
        ],
        "role": "EDITOR",
      },
    }
  `);
});

test("should be able to add a member twice", async () => {
  const createEvent = createChain(keyPairsA.sign);
  const addInvitationEvent = addInvitation({
    prevHash: hashTransaction(createEvent.transaction),
    authorKeyPair: keyPairA,
    expiresAt: getDateIn2Min(),
    role: "EDITOR",
    workspaceId: "test",
  });

  if (addInvitationEvent.transaction.type !== "add-invitation") {
    throw new Error("Invalid transaction type");
  }

  const { acceptInvitationSignature, acceptInvitationAuthorSignature } =
    acceptInvitation({
      invitationSigningKeyPairSeed:
        addInvitationEvent.invitationSigningKeyPairSeed,
      ...addInvitationEvent.transaction,
      expiresAt: new Date(addInvitationEvent.transaction.expiresAt),
      authorKeyPair: keyPairB,
    });

  const addMemberViaInvitationEvent = addMemberViaInvitation({
    prevHash: hashTransaction(addInvitationEvent.transaction),
    authorKeyPair: keyPairA,
    acceptInvitationSignature: sodium.to_base64(acceptInvitationSignature),
    acceptInvitationAuthorSignature: sodium.to_base64(
      acceptInvitationAuthorSignature
    ),
    ...addInvitationEvent.transaction,
    ...mainDevice,
    expiresAt: new Date(addInvitationEvent.transaction.expiresAt),
  });

  const addMemberViaInvitationEvent2 = addMemberViaInvitation({
    prevHash: hashTransaction(addMemberViaInvitationEvent.transaction),
    authorKeyPair: keyPairA,
    acceptInvitationSignature: sodium.to_base64(acceptInvitationSignature),
    acceptInvitationAuthorSignature: sodium.to_base64(
      acceptInvitationAuthorSignature
    ),
    ...addInvitationEvent.transaction,
    ...mainDevice,
    expiresAt: new Date(addInvitationEvent.transaction.expiresAt),
  });

  const chain = [
    createEvent,
    addInvitationEvent,
    addMemberViaInvitationEvent,
    addMemberViaInvitationEvent2,
  ];
  expect(() => resolveState(chain)).toThrow(InvalidWorkspaceChainError);
  expect(() => resolveState(chain)).toThrow("Member already exists.");
});

test("should fail if the author is not a member of the chain", async () => {
  const createEvent = createChain(keyPairsA.sign);
  const addInvitationEvent = addInvitation({
    prevHash: hashTransaction(createEvent.transaction),
    authorKeyPair: keyPairA,
    expiresAt: getDateIn2Min(),
    role: "EDITOR",
    workspaceId: "test",
  });

  if (addInvitationEvent.transaction.type !== "add-invitation") {
    throw new Error("Invalid transaction type");
  }

  const { acceptInvitationSignature, acceptInvitationAuthorSignature } =
    acceptInvitation({
      invitationSigningKeyPairSeed:
        addInvitationEvent.invitationSigningKeyPairSeed,
      ...addInvitationEvent.transaction,
      expiresAt: new Date(addInvitationEvent.transaction.expiresAt),
      authorKeyPair: keyPairB,
    });

  const addMemberViaInvitationEvent = addMemberViaInvitation({
    prevHash: hashTransaction(addInvitationEvent.transaction),
    authorKeyPair: keyPairC,
    acceptInvitationSignature: sodium.to_base64(acceptInvitationSignature),
    acceptInvitationAuthorSignature: sodium.to_base64(
      acceptInvitationAuthorSignature
    ),
    ...addInvitationEvent.transaction,
    ...mainDevice,
    expiresAt: new Date(addInvitationEvent.transaction.expiresAt),
  });
  const chain = [createEvent, addInvitationEvent, addMemberViaInvitationEvent];
  expect(() => resolveState(chain)).toThrow(InvalidWorkspaceChainError);
  expect(() => resolveState(chain)).toThrow("Author is not a member.");
});
