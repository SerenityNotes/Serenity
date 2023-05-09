import { generateId, useYjsSyncMachine } from "@naisho/core";
import {
  KeyDerivationTrace,
  LocalDevice,
  SerenitySnapshotPublicData,
  encryptDocumentTitle,
} from "@serenity-tools/common";
import { decryptDocumentTitleBasedOnSnapshotKey } from "@serenity-tools/common/src/decryptDocumentTitleBasedOnSnapshotKey/decryptDocumentTitleBasedOnSnapshotKey";
import { AwarenessUserInfo } from "@serenity-tools/editor";
import {
  collaboratorColorToHex,
  hashToCollaboratorColor,
} from "@serenity-tools/ui";
import { useEffect, useRef, useState } from "react";
import sodium, { KeyPair } from "react-native-libsodium";
import { Awareness } from "y-protocols/awareness";
import * as Yjs from "yjs";
import Editor from "../../components/editor/Editor";
import { usePage } from "../../context/PageContext";
import { useWorkspace } from "../../context/WorkspaceContext";
import {
  Document,
  Workspace,
  runDocumentQuery,
  runMeQuery,
} from "../../generated/graphql";
import { useAuthenticatedAppContext } from "../../hooks/useAuthenticatedAppContext";
import { WorkspaceDrawerScreenProps } from "../../types/navigationProps";
import { createNewSnapshotKey } from "../../utils/createNewSnapshotKey/createNewSnapshotKey";
import { deriveExistingSnapshotKey } from "../../utils/deriveExistingSnapshotKey/deriveExistingSnapshotKey";
import { useDocumentTitleStore } from "../../utils/document/documentTitleStore";
import { getDocument } from "../../utils/document/getDocument";
import { updateDocumentName } from "../../utils/document/updateDocumentName";
import { getUserFromWorkspaceQueryResultByDeviceInfo } from "../../utils/getUserFromWorkspaceQueryResultByDeviceInfo/getUserFromWorkspaceQueryResultByDeviceInfo";
import {
  getLocalDocument,
  setLocalDocument,
} from "../../utils/localSqliteApi/localSqliteApi";
import { getWorkspace } from "../../utils/workspace/getWorkspace";

type Props = WorkspaceDrawerScreenProps<"Page"> & {
  signatureKeyPair: KeyPair;
  workspaceId: string;
  reloadPage: () => void;
};

export default function Page({
  navigation,
  route,
  signatureKeyPair,
  workspaceId,
  reloadPage,
}: Props) {
  const { pageId: docId, setActiveSnapshotAndCommentKeys } = usePage();
  const isNew = route.params?.isNew ?? false;
  const { activeDevice, sessionKey } = useAuthenticatedAppContext();
  const yDocRef = useRef<Yjs.Doc>(new Yjs.Doc());
  const snapshotKeyRef = useRef<{
    keyDerivationTrace: KeyDerivationTrace;
    subkeyId: number;
    key: Uint8Array;
  } | null>(null);
  const snapshotInFlightKeyRef = useRef<{
    keyDerivationTrace: KeyDerivationTrace;
    subkeyId: number;
    key: Uint8Array;
  } | null>(null);
  const yAwarenessRef = useRef<Awareness>(new Awareness(yDocRef.current));
  const [documentLoadedFromLocalStorage, setDocumentLoadedFromLocalStorage] =
    useState(false);
  const [passedDocumentLoadingTimeout, setPassedDocumentLoadingTimeout] =
    useState(false);
  const [userInfo, setUserInfo] = useState<AwarenessUserInfo>({
    name: "Unknown user",
    color: "#000000",
  });

  const setActiveDocumentId = useDocumentTitleStore(
    (state) => state.setActiveDocumentId
  );
  const updateDocumentTitle = useDocumentTitleStore(
    (state) => state.updateDocumentTitle
  );

  let websocketHost = `wss://serenity-dev.fly.dev`;
  if (process.env.NODE_ENV === "development") {
    websocketHost = `ws://localhost:4000`;
  }
  if (process.env.SERENITY_ENV === "e2e") {
    websocketHost = `ws://localhost:4001`;
  }
  const { workspaceQueryResult } = useWorkspace();

  const [state, send] = useYjsSyncMachine({
    yDoc: yDocRef.current,
    yAwareness: yAwarenessRef.current,
    documentId: docId,
    signatureKeyPair,
    websocketHost,
    websocketSessionKey: sessionKey,
    onSnapshotSaved: async () => {
      snapshotKeyRef.current = snapshotInFlightKeyRef.current;
      snapshotInFlightKeyRef.current = null;
    },
    getNewSnapshotData: async () => {
      const documentResult = await runDocumentQuery({ id: docId });
      const document = documentResult.data?.document;
      if (!document) {
        throw new Error("Document not found");
      }
      const snapshotId = generateId();
      // we create a new key for every snapshot
      const snapshotKeyData = await createNewSnapshotKey({
        document,
        snapshotId,
        activeDevice,
      });
      snapshotInFlightKeyRef.current = {
        keyDerivationTrace: snapshotKeyData.keyDerivationTrace,
        subkeyId: snapshotKeyData.subkeyId,
        key: sodium.from_base64(snapshotKeyData.key),
      };

      const workspace = await getWorkspace({
        deviceSigningPublicKey: activeDevice.signingPublicKey,
        workspaceId,
      });
      if (!workspace?.currentWorkspaceKey) {
        console.error("Workspace or workspaceKeys not found");
        throw new Error("Workspace or workspaceKeys not found");
      }

      const documentTitle = decryptDocumentTitleBasedOnSnapshotKey({
        snapshotKey: sodium.to_base64(snapshotKeyRef.current!.key),
        ciphertext: document.nameCiphertext,
        nonce: document.nameNonce,
        subkeyId: document.subkeyId,
      });

      const documentTitleData = encryptDocumentTitle({
        title: documentTitle,
        activeDevice,
        snapshot: {
          keyDerivationTrace: snapshotKeyData.keyDerivationTrace,
        },
        workspaceKeyBox: workspace.currentWorkspaceKey.workspaceKeyBox!,
      });

      return {
        id: snapshotId,
        data: Yjs.encodeStateAsUpdate(yDocRef.current),
        key: sodium.from_base64(snapshotKeyData.key),
        publicData: {
          keyDerivationTrace: snapshotKeyData.keyDerivationTrace,
          subkeyId: snapshotKeyData.subkeyId,
        },
        additionalServerData: { documentTitleData },
      };
    },
    getSnapshotKey: async (snapshot) => {
      const snapshotKeyData = await deriveExistingSnapshotKey(
        docId,
        snapshot,
        activeDevice as LocalDevice
      );

      const key = sodium.from_base64(snapshotKeyData.key);
      snapshotKeyRef.current = {
        keyDerivationTrace: snapshot.publicData.keyDerivationTrace,
        subkeyId: snapshot.publicData.subkeyId,
        key,
      };
      setActiveSnapshotAndCommentKeys(
        {
          id: snapshot.publicData.snapshotId,
          key: snapshotKeyData.key,
        },
        {}
      );

      return key;
    },
    getUpdateKey: async (update) => {
      return snapshotKeyRef.current?.key as Uint8Array;
    },
    shouldSendSnapshot: ({ latestServerVersion }) => {
      // create a new snapshot if the active snapshot has more than 100 updates
      return latestServerVersion !== null && latestServerVersion > 100;
    },
    getEphemeralUpdateKey: async () => {
      return snapshotKeyRef.current?.key as Uint8Array;
    },
    isValidCollaborator: async (signingPublicKey: string) => {
      let workspace: Workspace | undefined | null;
      if (workspaceQueryResult.data) {
        // @ts-expect-error
        workspace = workspaceQueryResult.data.workspace;
      } else {
        workspace = await getWorkspace({
          workspaceId,
          deviceSigningPublicKey: activeDevice.signingPublicKey,
        });
      }

      if (!workspace) {
        return false;
      }

      const creator = getUserFromWorkspaceQueryResultByDeviceInfo(
        { workspace },
        { signingPublicKey }
      );
      if (creator) {
        return true;
      }
      // TODO should be false once we can validate removed devices
      // return false;
      console.warn(
        "Snapshot, Update or EphemeralUpdate creator could not be validated. Probably since it is an already removed device."
      );
      return true;
    },
    // onCustomMessage: async (message) => {
    //   console.log("CUSTOM MESSAGE:", message);
    // },
    additionalAuthenticationDataValidations: {
      // @ts-expect-error should actually match the type?
      snapshot: SerenitySnapshotPublicData,
    },
    sodium,
  });

  // console.log("state", state.value);

  useEffect(() => {
    setTimeout(() => {
      setPassedDocumentLoadingTimeout(true);
    }, 6000);

    async function initDocument() {
      await sodium.ready;

      const localDocument = await getLocalDocument(docId);
      if (localDocument) {
        Yjs.applyUpdate(
          yDocRef.current,
          localDocument.content,
          "serenity-local-sqlite"
        );
        setDocumentLoadedFromLocalStorage(true);
      }

      const me = await runMeQuery({});
      setUserInfo({
        name: me.data?.me?.username ?? "Unknown user",
        color: me.data?.me?.id
          ? collaboratorColorToHex(hashToCollaboratorColor(me.data?.me?.id))
          : "#000000",
      });

      let document: Document | undefined = undefined;
      try {
        const fetchedDocument = await getDocument({
          documentId: docId,
        });
        document = fetchedDocument as Document;
      } catch (err) {
        // TODO
        console.error(err);
      }
      if (!document) {
        console.error("Document not found");
        return;
      }
      // communicate to other components e.g. sidebar or top-bar
      // the currently active document
      setActiveDocumentId({ documentId: docId });

      // remove awareness state when closing the window
      // TODO re-add
      // window.addEventListener("beforeunload", () => {
      // removeAwarenessStates(
      //   yAwarenessRef.current,
      //   [yDocRef.current.clientID],
      //   "window unload"
      // );
      // });

      // TODO switch to v2 updates
      yDocRef.current.on("update", async (update, origin) => {
        // TODO pending updates should be stored in the local db if possible (not possible on web)
        // TODO pending updates should be sent when the websocket connection is re-established
        setLocalDocument({
          id: docId,
          content: Yjs.encodeStateAsUpdate(yDocRef.current),
        });
      });
    }

    initDocument();

    return () => {};
  }, []);

  const updateTitle = async (title: string) => {
    const document = await getDocument({
      documentId: docId,
    });
    // this is necessary to propagate document name update to the sidebar and header
    updateDocumentTitle({ documentId: docId, title });
    if (document?.id !== docId) {
      console.error("document ID doesn't match page ID");
      return;
    }
    try {
      await updateDocumentName({
        documentId: docId,
        workspaceId,
        name: title,
        activeDevice,
      });
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <Editor
      documentId={docId}
      workspaceId={workspaceId}
      yDocRef={yDocRef}
      yAwarenessRef={yAwarenessRef}
      openDrawer={navigation.openDrawer}
      updateTitle={updateTitle}
      isNew={isNew}
      documentLoaded={
        documentLoadedFromLocalStorage || state.context._documentWasLoaded
      }
      passedDocumentLoadingTimeout={passedDocumentLoadingTimeout}
      userInfo={userInfo}
      reloadPage={reloadPage}
    />
  );
}
