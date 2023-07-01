import sodium from "react-native-libsodium";
import { getKeyPairsA, getKeyPairsB, KeyPairs } from "../test/testUtils";
import {
  addDevice,
  createChain,
  InvalidUserChainError,
  removeDevice,
  resolveState,
} from "./index";

let keyPairsA: KeyPairs;
let keyPairsB: KeyPairs;

beforeAll(async () => {
  await sodium.ready;
  keyPairsA = getKeyPairsA();
  keyPairsB = getKeyPairsB();
});

test("should resolve to one device after adding and removing a device", async () => {
  const event = createChain({
    authorKeyPair: keyPairsA.sign,
    email: "jane@example.com",
  });
  const addDeviceEvent = addDevice({
    authorKeyPair: keyPairsA.sign,
    devicePublicKey: keyPairsB.sign.publicKey,
    prevEvent: event,
  });
  const removeDeviceEvent = removeDevice({
    authorKeyPair: keyPairsA.sign,
    devicePublicKey: keyPairsB.sign.publicKey,
    prevEvent: addDeviceEvent,
  });
  const state = resolveState({
    events: [event, addDeviceEvent, removeDeviceEvent],
    knownVersion: 0,
  });
  expect(state.currentState.devices).toMatchInlineSnapshot(`
    {
      "74IPzs2dhoERLRuxeS7zadzEvKfb7IqOK-jKu0mQxIM": {
        "expiresAt": undefined,
      },
    }
  `);
  expect(state.statePerEvent[state.currentState.eventHash]).toEqual(
    state.currentState
  );
  expect(state.currentState.mainDeviceSigningPublicKey).toEqual(
    keyPairsA.sign.publicKey
  );
  expect(typeof state.currentState.id).toBe("string");
  expect(typeof state.currentState.eventHash).toBe("string");
  expect(state.currentState.eventVersion).toBe(0);
});

test("should fail if a device is removed twice", async () => {
  const event = createChain({
    authorKeyPair: keyPairsA.sign,
    email: "jane@example.com",
  });
  const addDeviceEvent = addDevice({
    authorKeyPair: keyPairsA.sign,
    devicePublicKey: keyPairsB.sign.publicKey,
    prevEvent: event,
  });
  const removeDeviceEvent = removeDevice({
    authorKeyPair: keyPairsA.sign,
    devicePublicKey: keyPairsB.sign.publicKey,
    prevEvent: addDeviceEvent,
  });
  const removeDeviceEvent2 = removeDevice({
    authorKeyPair: keyPairsA.sign,
    devicePublicKey: keyPairsB.sign.publicKey,
    prevEvent: removeDeviceEvent,
  });
  expect(() =>
    resolveState({
      events: [event, addDeviceEvent, removeDeviceEvent, removeDeviceEvent2],
      knownVersion: 0,
    })
  ).toThrow(InvalidUserChainError);
});

test("should fail if a device is removed that doesn't exist", async () => {
  const event = createChain({
    authorKeyPair: keyPairsA.sign,
    email: "jane@example.com",
  });
  const addDeviceEvent = addDevice({
    authorKeyPair: keyPairsA.sign,
    devicePublicKey: keyPairsB.sign.publicKey,
    prevEvent: event,
  });
  const removeDeviceEvent = removeDevice({
    authorKeyPair: keyPairsA.sign,
    devicePublicKey: "abc",
    prevEvent: addDeviceEvent,
  });
  expect(() =>
    resolveState({
      events: [event, addDeviceEvent, removeDeviceEvent],
      knownVersion: 0,
    })
  ).toThrow(InvalidUserChainError);
});

// ---------------------------

test("should fail if the signature has been manipulated", async () => {
  const event = createChain({
    authorKeyPair: keyPairsA.sign,
    email: "jane@example.com",
  });
  const addDeviceEvent = addDevice({
    authorKeyPair: keyPairsA.sign,
    devicePublicKey: keyPairsB.sign.publicKey,
    prevEvent: event,
  });
  const removeDeviceEvent = removeDevice({
    authorKeyPair: keyPairsA.sign,
    devicePublicKey: "abc",
    prevEvent: addDeviceEvent,
  });

  addDeviceEvent.author.signature = sodium.to_base64(
    sodium.crypto_sign_detached(
      "something",
      sodium.from_base64(keyPairsA.sign.privateKey)
    )
  );

  expect(() =>
    resolveState({
      events: [event, addDeviceEvent, removeDeviceEvent],
      knownVersion: 0,
    })
  ).toThrow(InvalidUserChainError);
});

test("should fail if the author (publicKey and signature) have been replaced", async () => {
  const event = createChain({
    authorKeyPair: keyPairsA.sign,
    email: "jane@example.com",
  });
  const addDeviceEvent = addDevice({
    authorKeyPair: keyPairsA.sign,
    devicePublicKey: keyPairsB.sign.publicKey,
    prevEvent: event,
  });
  const removeDeviceEvent = removeDevice({
    authorKeyPair: keyPairsA.sign,
    devicePublicKey: "abc",
    prevEvent: addDeviceEvent,
  });

  addDeviceEvent.author = {
    signature: sodium.to_base64(
      sodium.crypto_sign_detached(
        "something",
        sodium.from_base64(keyPairsB.sign.privateKey)
      )
    ),
    publicKey: keyPairsB.sign.publicKey,
  };

  expect(() =>
    resolveState({
      events: [event, addDeviceEvent, removeDeviceEvent],
      knownVersion: 0,
    })
  ).toThrow(InvalidUserChainError);
});

test("should fail if the chain is based on a different event", async () => {
  const event = createChain({
    authorKeyPair: keyPairsA.sign,
    email: "jane@example.com",
  });
  const addDeviceEvent = addDevice({
    authorKeyPair: keyPairsA.sign,
    devicePublicKey: keyPairsB.sign.publicKey,
    prevEvent: event,
  });
  const addDeviceEvent2 = addDevice({
    authorKeyPair: keyPairsA.sign,
    devicePublicKey: keyPairsB.sign.publicKey,
    prevEvent: event,
  });
  const removeDeviceEvent = removeDevice({
    authorKeyPair: keyPairsA.sign,
    devicePublicKey: "abc",
    prevEvent: addDeviceEvent2,
  });

  expect(() =>
    resolveState({
      events: [event, addDeviceEvent, removeDeviceEvent],
      knownVersion: 0,
    })
  ).toThrow(InvalidUserChainError);
});
