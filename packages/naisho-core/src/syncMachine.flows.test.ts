import sodiumWrappers from "libsodium-wrappers";
import sodium, { KeyPair } from "react-native-libsodium";
import { assign, interpret, spawn } from "xstate";
import { createSnapshot } from "./snapshot";
import { syncMachine } from "./syncMachine";
import { SnapshotPublicData, UpdatePublicData } from "./types";
import { createUpdate } from "./update";

const url = "wss://www.example.com";

let signatureKeyPair: KeyPair;
let key: Uint8Array;
const docId = "6e46c006-5541-11ec-bf63-0242ac130002";
const snapshotId = "c08bbeed-049c-45be-915c-a7206ef55109";

beforeEach(() => {
  signatureKeyPair = {
    privateKey: sodiumWrappers.from_base64(
      "g3dtwb9XzhSzZGkxTfg11t1KEIb4D8rO7K54R6dnxArvgg_OzZ2GgREtG7F5LvNp3MS8p9vsio4r6Mq7SZDEgw"
    ),
    publicKey: sodiumWrappers.from_base64(
      "74IPzs2dhoERLRuxeS7zadzEvKfb7IqOK-jKu0mQxIM"
    ),
    keyType: "ed25519",
  };
});

afterEach(() => {});

type CreateSnapshotTestHelperParams = {
  parentSnapshotCiphertext: string;
  grandParentSnapshotProof: string;
  content: string;
};

const createSnapshotTestHelper = (params?: CreateSnapshotTestHelperParams) => {
  const { parentSnapshotCiphertext, grandParentSnapshotProof, content } =
    params || {};
  key = sodiumWrappers.from_hex(
    "724b092810ec86d7e35c9d067702b31ef90bc43a7b598626749914d6a3e033ed"
  );

  const publicData: SnapshotPublicData = {
    snapshotId,
    docId: "6e46c006-5541-11ec-bf63-0242ac130002",
    pubKey: sodium.to_base64(signatureKeyPair.publicKey),
    parentSnapshotClocks: {},
  };

  const snapshot = createSnapshot(
    content || "Hello World",
    publicData,
    key,
    signatureKeyPair,
    parentSnapshotCiphertext || "",
    grandParentSnapshotProof || ""
  );
  return {
    snapshot: {
      ...snapshot,
      serverData: { latestVersion: 0 },
    },
    key,
    signatureKeyPair,
  };
};

const createUpdateHelper = () => {
  const publicData: UpdatePublicData = {
    refSnapshotId: snapshotId,
    docId,
    pubKey: sodium.to_base64(signatureKeyPair.publicKey),
  };

  const update = createUpdate("u", publicData, key, signatureKeyPair, 0);

  return { update: { ...update, serverData: { version: 0 } } };
};

it("should connect to the websocket", (done) => {
  const websocketServiceMock = (context) => () => {};

  const syncService = interpret(
    syncMachine
      .withContext({
        ...syncMachine.context,
        websocketHost: url,
        websocketSessionKey: "sessionKey",
        signatureKeyPair,
      })
      .withConfig({
        actions: {
          spawnWebsocketActor: assign((context) => {
            return {
              _websocketActor: spawn(
                websocketServiceMock(context),
                "websocketActor"
              ),
            };
          }),
        },
      })
  ).onTransition((state) => {
    if (state.matches("connected")) {
      done();
    }
  });

  syncService.start();
  syncService.send({ type: "WEBSOCKET_CONNECTED" });
});

it("should load a document", (done) => {
  const websocketServiceMock = (context) => () => {};

  let docValue = "";

  const syncService = interpret(
    syncMachine
      .withContext({
        ...syncMachine.context,
        websocketHost: url,
        websocketSessionKey: "sessionKey",
        onDocumentLoaded: () => {
          expect(docValue).toEqual("Hello World");
          done();
        },
        isValidCollaborator: (signingPublicKey) =>
          sodiumWrappers.to_base64(signatureKeyPair.publicKey) ===
          signingPublicKey,
        getSnapshotKey: () => key,
        applySnapshot: (snapshot) => {
          docValue = sodiumWrappers.to_string(snapshot);
        },
        sodium: sodiumWrappers,
        signatureKeyPair,
      })
      .withConfig({
        actions: {
          spawnWebsocketActor: assign((context) => {
            return {
              _websocketActor: spawn(
                websocketServiceMock(context),
                "websocketActor"
              ),
            };
          }),
        },
      })
  );

  syncService.start();
  syncService.send({ type: "WEBSOCKET_CONNECTED" });

  const { snapshot } = createSnapshotTestHelper();
  syncService.send({
    type: "WEBSOCKET_ADD_TO_INCOMING_QUEUE",
    data: {
      type: "document",
      snapshot,
    },
  });
});

it("should load a document and an additional update", (done) => {
  const websocketServiceMock = (context) => () => {};

  let docValue = "";

  const syncService = interpret(
    syncMachine
      .withContext({
        ...syncMachine.context,
        websocketHost: url,
        websocketSessionKey: "sessionKey",
        isValidCollaborator: (signingPublicKey) =>
          sodiumWrappers.to_base64(signatureKeyPair.publicKey) ===
          signingPublicKey,
        getSnapshotKey: () => key,
        applySnapshot: (snapshot) => {
          docValue = sodiumWrappers.to_string(snapshot);
        },
        getUpdateKey: () => key,
        deserializeChanges: (changes) => {
          return changes;
        },
        applyChanges: (changes) => {
          changes.forEach((change) => {
            docValue = docValue + change;
          });
        },
        sodium: sodiumWrappers,
        signatureKeyPair,
      })
      .withConfig({
        actions: {
          spawnWebsocketActor: assign((context) => {
            return {
              _websocketActor: spawn(
                websocketServiceMock(context),
                "websocketActor"
              ),
            };
          }),
        },
      })
  ).onTransition((state) => {
    if (docValue === "Hello Worldu") {
      done();
    }
  });

  syncService.start();
  syncService.send({ type: "WEBSOCKET_CONNECTED" });

  const { snapshot } = createSnapshotTestHelper();
  syncService.send({
    type: "WEBSOCKET_ADD_TO_INCOMING_QUEUE",
    data: {
      type: "document",
      snapshot,
    },
  });

  const { update } = createUpdateHelper();
  syncService.send({
    type: "WEBSOCKET_ADD_TO_INCOMING_QUEUE",
    data: {
      ...update,
      type: "update",
    },
  });
});

it.only("should load a document and an additional snapshot", (done) => {
  const websocketServiceMock = (context) => () => {};

  let docValue = "";

  const syncService = interpret(
    syncMachine
      .withContext({
        ...syncMachine.context,
        websocketHost: url,
        websocketSessionKey: "sessionKey",
        isValidCollaborator: (signingPublicKey) =>
          sodiumWrappers.to_base64(signatureKeyPair.publicKey) ===
          signingPublicKey,
        getSnapshotKey: () => key,
        applySnapshot: (snapshot) => {
          docValue = sodiumWrappers.to_string(snapshot);
        },
        getUpdateKey: () => key,
        deserializeChanges: (changes) => {
          return changes;
        },
        applyChanges: (changes) => {
          changes.forEach((change) => {
            docValue = docValue + change;
          });
        },
        sodium: sodiumWrappers,
        signatureKeyPair,
      })
      .withConfig({
        actions: {
          spawnWebsocketActor: assign((context) => {
            return {
              _websocketActor: spawn(
                websocketServiceMock(context),
                "websocketActor"
              ),
            };
          }),
        },
      })
  ).onTransition((state) => {
    if (docValue === "Hello World again") {
      done();
    }
  });

  syncService.start();
  syncService.send({ type: "WEBSOCKET_CONNECTED" });

  const { snapshot } = createSnapshotTestHelper();
  syncService.send({
    type: "WEBSOCKET_ADD_TO_INCOMING_QUEUE",
    data: {
      type: "document",
      snapshot,
    },
  });

  const { snapshot: snapshot2 } = createSnapshotTestHelper({
    parentSnapshotCiphertext: snapshot.ciphertext,
    grandParentSnapshotProof: snapshot.publicData.parentSnapshotProof,
    content: "Hello World again",
  });
  syncService.send({
    type: "WEBSOCKET_ADD_TO_INCOMING_QUEUE",
    data: {
      type: "snapshot",
      snapshot: snapshot2,
    },
  });
});

// should load a document and an two updates
// should load a document and an additional snapshot
// should load a document and an additional snapshot and an update
// should load a document with updates
// should load a document with updates followed by an updates
// tests for a broken snapshot key
// test for a invalid contributor

// const websocketServiceMock = (context) => (callback, onReceive) => {
//   // callback({ type: 'resolve', data: { message: 'Success' } });
// };
