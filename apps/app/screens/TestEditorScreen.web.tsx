import Editor from "../components/editor/Editor";
import * as Yjs from "yjs";
import { Editor as SerenityEditor } from "@serenity-tools/editor";
import {
  createSnapshot,
  createUpdate,
  createAwarenessUpdate,
  verifyAndDecryptSnapshot,
  verifyAndDecryptUpdate,
  verifyAndDecryptAwarenessUpdate,
  createSignatureKeyPair,
  addUpdateToInProgressQueue,
  removeUpdateFromInProgressQueue,
  getUpdateInProgress,
  addSnapshotToInProgress,
  removeSnapshotInProgress,
  getSnapshotInProgress,
  addPendingUpdate,
  addPendingSnapshot,
  getPending,
  removePending,
  dispatchWebsocketState,
  getWebsocketState,
  useWebsocketState,
} from "@naisho/core";
import { v4 as uuidv4 } from "uuid";
import sodium from "libsodium-wrappers";
import {
  Awareness,
  encodeAwarenessUpdate,
  applyAwarenessUpdate,
  removeAwarenessStates,
} from "y-protocols/awareness";
import { View } from "@serenity-tools/ui";
import { RootTabScreenProps } from "../types";
import { useEffect, useRef } from "react";

const reconnectTimeout = 2000;

export default function TestEditorScreen({
  navigation,
}: RootTabScreenProps<"EditorScreen">) {
  const docId = "eadef252-c282-4e9d-a403-ad1481d2ad78";
  const activeSnapshotIdRef = useRef<string | null>(null);
  const yDocRef = useRef<Yjs.Doc>(new Yjs.Doc());
  const yAwarenessRef = useRef<Awareness>(new Awareness(yDocRef.current));
  const websocketConnectionRef = useRef<WebSocket>(null);
  const createSnapshotRef = useRef<boolean>(false); // only used for the UI
  const signatureKeyPairRef = useRef<sodium.KeyPair | null>(null);
  const latestServerVersionRef = useRef<number | null>(null);
  const editorInitializedRef = useRef<boolean>(false);
  const websocketState = useWebsocketState();

  const applySnapshot = (snapshot, key) => {
    activeSnapshotIdRef.current = snapshot.publicData.snapshotId;
    const initialResult = verifyAndDecryptSnapshot(
      snapshot,
      key,
      sodium.from_base64(snapshot.publicData.pubKey) // TODO check if this pubkey is part of the allowed collaborators
    );
    // @ts-expect-error TODO handle later
    Yjs.applyUpdate(yDocRef.current, initialResult, null);
  };

  const applyUpdates = (updates, key) => {
    updates.forEach((update) => {
      console.log(
        update.serverData.version,
        update.publicData.pubKey,
        update.publicData.clock
      );
      const updateResult = verifyAndDecryptUpdate(
        update,
        key,
        sodium.from_base64(update.publicData.pubKey) // TODO check if this pubkey is part of the allowed collaborators
      );
      // when reconnecting the server might send already processed data updates. these then are ignored
      if (updateResult) {
        Yjs.applyUpdate(yDocRef.current, updateResult, null);
        latestServerVersionRef.current = update.serverData.version;
      }
    });
  };

  const createAndSendSnapshot = (key) => {
    const yDocState = Yjs.encodeStateAsUpdate(yDocRef.current);
    const publicData = {
      snapshotId: uuidv4(),
      docId,
      // @ts-expect-error TODO handle later
      pubKey: sodium.to_base64(signatureKeyPairRef.current.publicKey),
    };
    const snapshot = createSnapshot(
      yDocState,
      publicData,
      key,
      // @ts-expect-error TODO handle later
      signatureKeyPairRef.current
    );

    addSnapshotToInProgress(snapshot);

    // @ts-expect-error TODO handle later
    websocketConnectionRef.current.send(
      JSON.stringify({
        ...snapshot,
        lastKnownSnapshotId: activeSnapshotIdRef.current,
        latestServerVersion: latestServerVersionRef.current,
      })
    );
  };

  const createAndSendUpdate = (update, key, clockOverwrite?: number) => {
    const publicData = {
      refSnapshotId: activeSnapshotIdRef.current,
      docId,
      // @ts-expect-error TODO handle later
      pubKey: sodium.to_base64(signatureKeyPairRef.current.publicKey),
    };
    const updateToSend = createUpdate(
      update,
      // @ts-expect-error TODO handle later
      publicData,
      key,
      signatureKeyPairRef.current,
      clockOverwrite
    );

    if (clockOverwrite === undefined) {
      addUpdateToInProgressQueue(updateToSend, update);
    }
    // @ts-expect-error TODO handle later
    websocketConnectionRef.current.send(JSON.stringify(updateToSend));
  };

  useEffect(() => {
    async function initDocument() {
      await sodium.ready;

      yAwarenessRef.current.setLocalStateField("user", {
        name: `User ${yDocRef.current.clientID}`,
      });

      const key = sodium.from_base64(window.location.hash.slice(1));

      signatureKeyPairRef.current = createSignatureKeyPair();

      const onWebsocketMessage = (event) => {
        const data = JSON.parse(event.data);
        switch (data.type) {
          case "document":
            if (data.snapshot) {
              applySnapshot(data.snapshot, key);
            }
            applyUpdates(data.updates, key);
            if (editorInitializedRef.current === false) {
              // TODO initiate editor
              editorInitializedRef.current = true;
            }

            // check for pending snapshots or pending updates and run them
            const pendingChanges = getPending(docId);
            if (pendingChanges.type === "snapshot") {
              createAndSendSnapshot(key);
              removePending(docId);
            } else if (pendingChanges.type === "updates") {
              // TODO send multiple pending.rawUpdates as one update, this requires different applying as well
              removePending(docId);
              pendingChanges.rawUpdates.forEach((rawUpdate) => {
                createAndSendUpdate(rawUpdate, key);
              });
            }
            break;
          case "snapshot":
            console.log("apply snapshot");
            const snapshotResult = verifyAndDecryptSnapshot(
              data,
              key,
              sodium.from_base64(data.publicData.pubKey) // TODO check if this pubkey is part of the allowed collaborators
            );
            activeSnapshotIdRef.current = data.publicData.snapshotId;
            // @ts-expect-error TODO handle later
            latestServerVersionRef.current = undefined;
            // @ts-expect-error TODO handle later
            Yjs.applyUpdate(yDocRef.current, snapshotResult, null);
            break;
          case "snapshotSaved":
            console.log("snapshot saving confirmed");
            activeSnapshotIdRef.current = data.snapshotId;
            // @ts-expect-error TODO handle later
            latestServerVersionRef.current = undefined;
            removeSnapshotInProgress(data.docId);

            const pending = getPending(data.docId);
            if (pending.type === "snapshot") {
              createAndSendSnapshot(key);
              removePending(data.docId);
            } else if (pending.type === "updates") {
              // TODO send multiple pending.rawUpdates as one update, this requires different applying as well
              removePending(data.docId);
              pending.rawUpdates.forEach((rawUpdate) => {
                createAndSendUpdate(rawUpdate, key);
              });
            }
            break;
          case "snapshotFailed":
            console.log("snapshot saving failed", data);
            if (data.snapshot) {
              applySnapshot(data.snapshot, key);
            }
            if (data.updates) {
              applyUpdates(data.updates, key);
            }

            // TODO add a backoff after multiple failed tries

            // removed here since again added in createAndSendSnapshot
            removeSnapshotInProgress(data.docId);
            // all pending can be removed since a new snapshot will include all local changes
            removePending(data.docId);
            createAndSendSnapshot(key);
            break;
          case "update":
            const updateResult = verifyAndDecryptUpdate(
              data,
              key,
              sodium.from_base64(data.publicData.pubKey) // TODO check if this pubkey is part of the allowed collaborators
            );
            // @ts-expect-error TODO handle later
            Yjs.applyUpdate(yDocRef.current, updateResult, null);
            latestServerVersionRef.current = data.serverData.version;
            break;
          case "updateSaved":
            console.log("update saving confirmed", data.snapshotId, data.clock);
            latestServerVersionRef.current = data.serverVersion;
            removeUpdateFromInProgressQueue(
              data.docId,
              data.snapshotId,
              data.clock
            );
            break;
          case "updateFailed":
            console.log("update saving failed", data.snapshotId, data.clock);
            // TODO retry with an increasing offset instead of just trying again
            const rawUpdate = getUpdateInProgress(
              data.docId,
              data.snapshotId,
              data.clock
            );
            createAndSendUpdate(rawUpdate, key, data.clock);
            break;
          case "awarenessUpdate":
            const awarenessUpdateResult = verifyAndDecryptAwarenessUpdate(
              data,
              key,
              sodium.from_base64(data.publicData.pubKey) // TODO check if this pubkey is part of the allowed collaborators
            );
            applyAwarenessUpdate(
              yAwarenessRef.current,
              // @ts-expect-error TODO handle later
              awarenessUpdateResult,
              null
            );
            break;
        }
      };

      const setupWebsocket = () => {
        const host =
          process.env.NODE_ENV === "development"
            ? "ws://localhost:4000"
            : "wss://api.naisho.org";
        const connection = new WebSocket(`${host}/${docId}`);
        // @ts-expect-error TODO handle later
        websocketConnectionRef.current = connection;

        // Listen for messages
        connection.addEventListener("message", onWebsocketMessage);

        connection.addEventListener("open", function (event) {
          console.log("connection opened");
          dispatchWebsocketState({ type: "connected" });
        });

        connection.addEventListener("close", function (event) {
          console.log("connection closed");
          dispatchWebsocketState({ type: "disconnected" });
          // remove the awareness states of everyone else
          removeAwarenessStates(
            yAwarenessRef.current,
            Array.from(yAwarenessRef.current.getStates().keys()).filter(
              (client) => client !== yDocRef.current.clientID
            ),
            "TODOprovider"
          );
          // retry connecting
          setTimeout(() => {
            dispatchWebsocketState({ type: "reconnecting" });
            setupWebsocket();
          }, reconnectTimeout * (1 + getWebsocketState().unsuccessfulReconnects));
        });
      };

      setupWebsocket();

      // remove awareness state when closing the window
      window.addEventListener("beforeunload", () => {
        removeAwarenessStates(
          yAwarenessRef.current,
          [yDocRef.current.clientID],
          "window unload"
        );
      });

      yAwarenessRef.current.on("update", ({ added, updated, removed }) => {
        if (!getWebsocketState().connected) {
          return;
        }

        const changedClients = added.concat(updated).concat(removed);
        const yAwarenessUpdate = encodeAwarenessUpdate(
          yAwarenessRef.current,
          changedClients
        );
        const publicData = {
          docId,
          // @ts-expect-error TODO handle later
          pubKey: sodium.to_base64(signatureKeyPairRef.current.publicKey),
        };
        const awarenessUpdate = createAwarenessUpdate(
          yAwarenessUpdate,
          publicData,
          key,
          // @ts-expect-error TODO handle later
          signatureKeyPairRef.current
        );
        // @ts-expect-error TODO handle later
        websocketConnectionRef.current.send(JSON.stringify(awarenessUpdate));
      });

      yDocRef.current.on("update", (update, origin) => {
        if (origin?.key === "y-sync$") {
          if (!activeSnapshotIdRef.current || createSnapshotRef.current) {
            createSnapshotRef.current = false;

            if (
              getSnapshotInProgress(docId) ||
              !getWebsocketState().connected
            ) {
              addPendingSnapshot(docId);
            } else {
              createAndSendSnapshot(key);
            }
          } else {
            if (
              getSnapshotInProgress(docId) ||
              !getWebsocketState().connected
            ) {
              // don't send updates when a snapshot is in progress, because they
              // must be based on the new snapshot
              addPendingUpdate(docId, update);
            } else {
              createAndSendUpdate(update, key);
            }
          }
        }
      });
    }

    initDocument();
  }, []);

  return (
    <View>
      <View>{websocketState.connected ? "Connected" : "Disconnected"}</View>
      <SerenityEditor ydoc={yDocRef.current} />
    </View>
  );
}
