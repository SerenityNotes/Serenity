import * as documentChain from "@serenity-kit/document-chain";
import {
  DocumentShareLinkDeviceBox,
  KeyDerivationTrace,
  LocalDevice,
  SerenitySnapshotPublicData,
  encryptDocumentTitle,
  encryptSnapshotKeyForShareLinkDevice,
  generateId,
} from "@serenity-tools/common";
import { decryptDocumentTitleBasedOnSnapshotKey } from "@serenity-tools/common/src/decryptDocumentTitleBasedOnSnapshotKey/decryptDocumentTitleBasedOnSnapshotKey";
import { useYjsSync } from "@serenity-tools/secsync";
import {
  Button,
  Description,
  Modal,
  ModalButtonFooter,
  ModalHeader,
  Text,
  View,
  tw,
  useHasEditorSidebar,
} from "@serenity-tools/ui";
import { useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import sodium, { KeyPair } from "react-native-libsodium";
import { Awareness } from "y-protocols/awareness";
import * as Yjs from "yjs";
import Editor from "../../components/editor/Editor";
import { usePage } from "../../context/PageContext";
import { Document, runDocumentQuery } from "../../generated/graphql";
import { useAuthenticatedAppContext } from "../../hooks/useAuthenticatedAppContext";
import {
  getDocumentChainEventByHash,
  loadRemoteDocumentChain,
} from "../../store/documentChainStore";
import { getLocalOrLoadRemoteUserByUserChainHash } from "../../store/userStore";
import {
  WorkspaceMemberDevicesProofLocalDbEntry,
  getLastWorkspaceMemberDevicesProof,
  getLocalOrLoadRemoteWorkspaceMemberDevicesProofQueryByHash,
  loadRemoteWorkspaceMemberDevicesProofQuery,
} from "../../store/workspaceMemberDevicesProofStore";
import { DocumentState } from "../../types/documentState";
import { WorkspaceDrawerScreenProps } from "../../types/navigationProps";
import { createNewSnapshotKey } from "../../utils/createNewSnapshotKey/createNewSnapshotKey";
import { deriveExistingSnapshotKey } from "../../utils/deriveExistingSnapshotKey/deriveExistingSnapshotKey";
import { useDocumentTitleStore } from "../../utils/document/documentTitleStore";
import { getDocument } from "../../utils/document/getDocument";
import { updateDocumentName } from "../../utils/document/updateDocumentName";
import { useEditorStore } from "../../utils/editorStore/editorStore";
import { getEnvironmentUrls } from "../../utils/getEnvironmentUrls/getEnvironmentUrls";
import {
  getLocalDocument,
  setLocalDocument,
} from "../../utils/localSqliteApi/localSqliteApi";
import { showToast } from "../../utils/toast/showToast";
import { getWorkspace } from "../../utils/workspace/getWorkspace";
import { PageLoadingError } from "./PageLoadingError";
import { PageNoAccessError } from "./PageNoAccessError";

type Props = WorkspaceDrawerScreenProps<"Page"> & {
  signatureKeyPair: KeyPair;
  workspaceId: string;
  reloadPage: () => void;
  latestDocumentChainState: documentChain.DocumentChainState;
};

export default function Page({
  navigation,
  route,
  signatureKeyPair,
  workspaceId,
  reloadPage,
  latestDocumentChainState,
}: Props) {
  const { pageId: docId, setActiveSnapshotAndCommentKeys } = usePage();
  const isNew = route.params?.isNew ?? false;
  const { activeDevice, sessionKey } = useAuthenticatedAppContext();
  const yDocRef = useRef<Yjs.Doc>(new Yjs.Doc());
  const snapshotKeyRef = useRef<{
    keyDerivationTrace: KeyDerivationTrace;
    key: Uint8Array;
  } | null>(null);
  const snapshotInFlightKeyRef = useRef<{
    keyDerivationTrace: KeyDerivationTrace;
    key: Uint8Array;
  } | null>(null);
  const [documentLoadedFromLocalDb, setDocumentLoadedFromLocalDb] =
    useState(false);
  const [documentLoadedOnceFromRemote, setDocumentLoadedOnceFromRemote] =
    useState(false);
  const [passedDocumentLoadingTimeout, setPassedDocumentLoadingTimeout] =
    useState(false);
  const syncState = useEditorStore((state) => state.syncState);
  const setSyncState = useEditorStore((state) => state.setSyncState);
  const setDocumentState = useEditorStore((state) => state.setDocumentState);
  const setActiveDocumentId = useDocumentTitleStore(
    (state) => state.setActiveDocumentId
  );
  const setSnapshotKey = useEditorStore((state) => state.setSnapshotKey);
  const setSnapshotId = useEditorStore((state) => state.setSnapshotId);
  const [isClosedErrorModal, setIsClosedErrorModal] = useState(false);
  const ephemeralUpdateErrorsChangedAt = useRef<Date | null>(null);
  const hasEditorSidebar = useHasEditorSidebar();
  const updateDocumentTitleInStore = useDocumentTitleStore(
    (state) => state.updateDocumentTitle
  );
  let activeSnapshotDocumentChainStateRef =
    useRef<documentChain.DocumentChainState>();
  let activeSnapshotWorkspaceMemberDevicesProofEntryRef =
    useRef<WorkspaceMemberDevicesProofLocalDbEntry>();

  const { websocketOrigin } = getEnvironmentUrls();

  const [state, , , yAwareness] = useYjsSync({
    yDoc: yDocRef.current,
    documentId: docId,
    signatureKeyPair,
    websocketHost: websocketOrigin,
    websocketSessionKey: sessionKey,
    onDocumentUpdated: ({ type, knownSnapshotInfo }) => {
      if (type === "snapshot-saved") {
        snapshotKeyRef.current = snapshotInFlightKeyRef.current;
        snapshotInFlightKeyRef.current = null;
        if (snapshotKeyRef.current) {
          setSnapshotKey(snapshotKeyRef.current.key);
          setSnapshotId(knownSnapshotInfo.snapshotId);
        }

        // TODO activeSnapshotDocumentChainStateRef
        // TODO activeSnapshotWorkspaceMemberDevicesRef
        // TODO setActiveSnapshotAndCommentKeys
      }
    },
    getNewSnapshotData: async ({ id }) => {
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

      const workspaceMemberDevicesProof =
        await loadRemoteWorkspaceMemberDevicesProofQuery({ workspaceId });

      const documentTitleData = encryptDocumentTitle({
        title: documentTitle,
        activeDevice,
        snapshot: {
          keyDerivationTrace: snapshotKeyData.keyDerivationTrace,
        },
        workspaceKeyBox: workspace.currentWorkspaceKey.workspaceKeyBox!,
        workspaceId,
        workspaceKeyId: workspace.currentWorkspaceKey.id,
      });

      let documentShareLinkDeviceBoxes: DocumentShareLinkDeviceBox[] = [];
      documentShareLinkDeviceBoxes = Object.entries(
        latestDocumentChainState.devices
      ).map(([shareLinkDeviceSigningPublicKey, deviceEntry]) => {
        const { documentShareLinkDeviceBox } =
          encryptSnapshotKeyForShareLinkDevice({
            documentId: docId,
            snapshotId: id,
            authorDevice: activeDevice,
            snapshotKey: sodium.from_base64(snapshotKeyData.key),
            shareLinkDevice: {
              signingPublicKey: shareLinkDeviceSigningPublicKey,
              encryptionPublicKey: deviceEntry.encryptionPublicKey,
              encryptionPublicKeySignature: "IGNORE",
            },
          });
        return documentShareLinkDeviceBox;
      });

      return {
        id: snapshotId,
        data: Yjs.encodeStateAsUpdateV2(yDocRef.current),
        key: sodium.from_base64(snapshotKeyData.key),
        publicData: {
          workspaceMemberDevicesProof: workspaceMemberDevicesProof.proof,
          keyDerivationTrace: snapshotKeyData.keyDerivationTrace,
          documentChainEventHash: latestDocumentChainState.eventHash,
        },
        additionalServerData: {
          documentTitleData,
          documentShareLinkDeviceBoxes,
        },
      };
    },
    getSnapshotKey: async (snapshotProofInfo) => {
      if (!snapshotProofInfo) {
        throw new Error(
          "SnapshotProofInfo not provided when trying to derive a new key"
        );
      }

      activeSnapshotWorkspaceMemberDevicesProofEntryRef.current =
        await getLocalOrLoadRemoteWorkspaceMemberDevicesProofQueryByHash({
          workspaceId,
          hash: snapshotProofInfo.additionalPublicData
            .workspaceMemberDevicesProof.hash,
        });

      let activeSnapshotDocumentChainEvent = getDocumentChainEventByHash({
        documentId: docId,
        hash: snapshotProofInfo.additionalPublicData.documentChainEventHash,
      });

      if (!activeSnapshotDocumentChainEvent) {
        // refetch newest chain items and try again before returning an error
        await loadRemoteDocumentChain({ documentId: docId });
        activeSnapshotDocumentChainEvent = getDocumentChainEventByHash({
          documentId: docId,
          hash: snapshotProofInfo.additionalPublicData.documentChainEventHash,
        });

        if (!activeSnapshotDocumentChainEvent) {
          console.error("activeSnapshotDocumentChainState not set");
          throw new Error("activeSnapshotDocumentChainState not set");
        }
      }

      activeSnapshotDocumentChainStateRef.current =
        activeSnapshotDocumentChainEvent.state;

      const snapshotKeyData = await deriveExistingSnapshotKey(
        docId,
        snapshotProofInfo.additionalPublicData.keyDerivationTrace,
        activeDevice as LocalDevice
      );

      const key = sodium.from_base64(snapshotKeyData.key);
      snapshotKeyRef.current = {
        keyDerivationTrace:
          snapshotProofInfo.additionalPublicData.keyDerivationTrace,
        key,
      };
      if (snapshotKeyRef.current) {
        setSnapshotKey(snapshotKeyRef.current.key);
        setSnapshotId(snapshotProofInfo.snapshotId);
      }
      setActiveSnapshotAndCommentKeys(
        {
          id: snapshotProofInfo.snapshotId,
          key: snapshotKeyData.key,
        },
        {}
      );

      return key;
    },
    shouldSendSnapshot: ({ snapshotUpdatesCount }) => {
      // create a new snapshot if the active snapshot has more than 100 updates
      const tooManyUpdate =
        snapshotUpdatesCount !== null && snapshotUpdatesCount > 100;
      if (tooManyUpdate) return true;
      const lastProof = getLastWorkspaceMemberDevicesProof({ workspaceId });
      if (
        activeSnapshotWorkspaceMemberDevicesProofEntryRef.current?.proof
          .hash !== lastProof.proof.hash
      ) {
        return true;
      }
      return false;
    },
    isValidClient: async (signingPublicKey: string) => {
      // TODO verify that the users match the entries in the workspaceChain when verifying the proof?
      if (activeSnapshotWorkspaceMemberDevicesProofEntryRef.current) {
        for (const [userId, userChainHash] of Object.entries(
          activeSnapshotWorkspaceMemberDevicesProofEntryRef.current.data
            .userChainHashes
        )) {
          const user = await getLocalOrLoadRemoteUserByUserChainHash({
            userChainHash,
            userId,
            workspaceId,
          });
          if (user && Object.keys(user.devices).includes(signingPublicKey)) {
            return true;
          }
        }
      }

      return false;
    },
    additionalAuthenticationDataValidations: {
      snapshot: SerenitySnapshotPublicData,
    },
    logging: "error",
    sodium,
  });

  const yAwarenessRef = useRef<Awareness>(yAwareness);

  useEffect(() => {
    setTimeout(() => {
      setPassedDocumentLoadingTimeout(true);
    }, 6000);

    async function initDocument() {
      const localDocument = await getLocalDocument(docId);
      if (localDocument) {
        Yjs.applyUpdateV2(
          yDocRef.current,
          localDocument.content,
          "serenity-local-sqlite"
        );
        setDocumentLoadedFromLocalDb(true);
      }

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

      yDocRef.current.on("updateV2", async (update, origin) => {
        // TODO pending updates should be stored in the local db if possible (not possible on web)
        // TODO pending updates should be sent when the websocket connection is re-established
        setLocalDocument({
          id: docId,
          content: Yjs.encodeStateAsUpdateV2(yDocRef.current),
        });
      });
    }

    initDocument();

    return () => {};
  }, []);

  useEffect(() => {
    if (state.context._documentDecryptionState === "complete") {
      setDocumentLoadedOnceFromRemote(true);
    }
  }, [state.context._documentDecryptionState]);

  useEffect(() => {
    if (state.context._ephemeralMessageReceivingErrors.length > 0) {
      const now = new Date(); // Current date and time
      const fiveMinInMs = 60000 * 5;
      const fiveMinsAgo = new Date(now.getTime() - fiveMinInMs);

      if (
        ephemeralUpdateErrorsChangedAt.current === null ||
        ephemeralUpdateErrorsChangedAt.current < fiveMinsAgo
      ) {
        showToast(
          "Can't load or decrypt real-time data from collaborators",
          "info",
          { duration: 15000 }
        );
      }
      ephemeralUpdateErrorsChangedAt.current = new Date();
    }
    // TODO since they are limited to a max length, the length will not be good enough
  }, [state.context._ephemeralMessageReceivingErrors.length]);

  useEffect(() => {
    if (state.matches("failed")) {
      setSyncState({
        variant: "error",
        documentDecryptionState: state.context._documentDecryptionState,
        documentLoadedFromLocalDb,
      });
    } else if (
      state.matches("disconnected") ||
      (state.matches("connecting") && state.context._websocketRetries > 1)
    ) {
      if (syncState.variant === "online") {
        // TODO check for desktop app since there changes will also be stored locally
        if (Platform.OS === "web") {
          showToast(
            "You went offline. Your pending changes will be lost unless you reconnect.",
            "error",
            { duration: 30000 }
          );
        } else {
          showToast(
            "You went offline. Your pending changes will be stored locally and synced when you reconnect.",
            "info",
            { duration: 15000 }
          );
        }
      }
      setSyncState({
        variant: "offline",
        pendingChanges: state.context._pendingChangesQueue.length,
      });
    } else {
      setSyncState({ variant: "online" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    state.value,
    state.context._websocketRetries,
    state.context._pendingChangesQueue.length,
    documentLoadedFromLocalDb,
    setSyncState,
  ]);

  const documentLoaded =
    documentLoadedFromLocalDb ||
    state.context._documentDecryptionState === "complete" ||
    documentLoadedOnceFromRemote;

  let documentState: DocumentState = "loading";
  if (state.matches("failed")) {
    documentState = "error";
  } else if (documentLoaded) {
    documentState = "active";
  }

  useEffect(() => {
    setDocumentState(documentState);
  }, [documentState, setDocumentState]);

  const updateTitle = async (title: string) => {
    const document = await getDocument({
      documentId: docId,
    });
    // this is necessary to propagate document name update to the sidebar and header
    updateDocumentTitleInStore({
      documentId: docId,
      title,
    });
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

  if (state.matches("noAccess")) {
    return <PageNoAccessError />;
  }

  if (
    passedDocumentLoadingTimeout &&
    !documentLoaded &&
    state.context._documentDecryptionState === "pending"
  ) {
    return <PageLoadingError reloadPage={reloadPage} />;
  }

  return (
    <>
      <Modal
        isVisible={!isClosedErrorModal && state.matches("failed")}
        onBackdropPress={() => {
          setIsClosedErrorModal(true);
        }}
      >
        <ModalHeader>
          Failed to load or decrypt {documentLoaded ? "update" : "the page"}
        </ModalHeader>
        <Description variant="modal">
          {documentLoaded
            ? "Incoming page updates couldn't be loaded or decrypted."
            : "The entire page could not be loaded or decrypted, but as much content as possible has been restored."}
        </Description>
        <Description variant="modal">
          {
            "Editing has been disabled, but you still can select and copy the content."
          }
        </Description>
        <Description variant="modal">
          {documentLoaded
            ? "Please save your recent changes and try to reload the page. If the problem persists, please contact support."
            : "Please try to reload the page. If the problem persists, please contact support."}
        </Description>
        <ModalButtonFooter
          confirm={
            <Button
              onPress={() => {
                setIsClosedErrorModal(true);
              }}
              variant="primary"
            >
              Close dialog
            </Button>
          }
          cancel={
            <Button
              onPress={() => {
                reloadPage();
              }}
              variant="secondary"
            >
              Reload page
            </Button>
          }
        />
      </Modal>
      {!hasEditorSidebar && syncState.variant === "offline" ? (
        <View style={tw`bg-gray-200 py-2`}>
          <Text variant="xs" style={tw`mx-auto`}>
            You’re offline. Changes will sync next time you are online.
          </Text>
        </View>
      ) : null}
      <Editor
        editable={!state.matches("failed")}
        documentId={docId}
        workspaceId={workspaceId}
        yDocRef={yDocRef}
        yAwarenessRef={yAwarenessRef}
        openDrawer={navigation.openDrawer}
        updateTitle={updateTitle}
        isNew={isNew}
        documentLoaded={documentLoaded || state.matches("failed")}
        documentState={documentState}
      />
    </>
  );
}
