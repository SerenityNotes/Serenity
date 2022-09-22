import {
  createDocumentKey,
  encryptDocumentTitle,
  recreateDocumentKey,
} from "@serenity-tools/common";
import { useEffect, useLayoutEffect } from "react";
import { useWindowDimensions } from "react-native";
import { useClient } from "urql";
import Page from "../../components/page/Page";
import { PageHeader } from "../../components/page/PageHeader";
import { PageHeaderRight } from "../../components/pageHeaderRight/PageHeaderRight";
import { useWorkspaceId } from "../../context/WorkspaceIdContext";
import {
  Document,
  useUpdateDocumentNameMutation,
} from "../../generated/graphql";
import { useWorkspaceContext } from "../../hooks/useWorkspaceContext";
import { WorkspaceDrawerScreenProps } from "../../types/navigation";

import { useMachine } from "@xstate/react";
import { loadInitialDataMachine } from "../../machines/loadInitialData";
import { useDocumentStore } from "../../utils/document/documentStore";
import { getDocument } from "../../utils/document/getDocument";
import { getFolderKey } from "../../utils/folder/getFolderKey";
import { setLastUsedDocumentId } from "../../utils/lastUsedWorkspaceAndDocumentStore/lastUsedWorkspaceAndDocumentStore";

export default function PageScreen(props: WorkspaceDrawerScreenProps<"Page">) {
  useWindowDimensions(); // needed to ensure tw-breakpoints are triggered when resizing
  const { activeDevice } = useWorkspaceContext();
  const workspaceId = useWorkspaceId();
  const updateDocumentStore = useDocumentStore((state) => state.update);
  const pageId = props.route.params.pageId;
  const [, updateDocumentNameMutation] = useUpdateDocumentNameMutation();
  const urqlClient = useClient();

  const [state, send] = useMachine(loadInitialDataMachine, {
    context: {
      workspaceId,
      documentId: pageId,
      returnOtherWorkspaceIfNotFound: false,
      returnOtherDocumentIfNotFound: false,
      navigation: props.navigation,
    },
  });

  console.log(state);

  const navigateAwayIfUserDoesntHaveAccess = async (
    workspaceId: string,
    docId: string
  ) => {
    try {
      const document = await getDocument({
        documentId: docId,
        urqlClient,
      });
      await updateDocumentStore(document, urqlClient, activeDevice);
    } catch (error: any) {
      if (
        error.message === "[GraphQL] Document not found" ||
        error.message === "[GraphQL] Unauthorized"
      ) {
        props.navigation.replace("Workspace", {
          workspaceId,
          screen: "NoPageExists",
        });
        return;
      }
    }
    return true;
  };

  useLayoutEffect(() => {
    props.navigation.setOptions({
      headerRight: PageHeaderRight,
      headerTitle: PageHeader,
      headerTitleAlign: "center",
    });
  }, []);

  const updateTitle = async (title: string) => {
    let document: Document | undefined | null = undefined;
    try {
      document = await getDocument({
        documentId: pageId,
        urqlClient,
      });
      await updateDocumentStore(document, urqlClient, activeDevice);
    } catch (error: any) {
      if (
        error.message === "[GraphQL] Document not found" ||
        error.message === "[GraphQL] Unauthorized"
      ) {
        props.navigation.replace("Workspace", {
          workspaceId,
          screen: "NoPageExists",
        });
        return;
      }
    }
    if (document?.id !== pageId) {
      console.error("document ID doesn't match page ID");
      return;
    }
    const folderKeyData = await getFolderKey({
      folderId: document?.parentFolderId!,
      workspaceId: document?.workspaceId!,
      urqlClient,
      activeDevice,
    });
    let documentSubkeyId = 0;
    let documentKey = "";
    if (document?.subkeyId) {
      const documentKeyData = await createDocumentKey({
        folderKey: folderKeyData.key,
      });
      documentSubkeyId = documentKeyData.subkeyId;
      documentKey = documentKeyData.key;
    } else {
      const documentKeyData = await recreateDocumentKey({
        folderKey: folderKeyData.key,
        subkeyId: document?.subkeyId!,
      });
      documentSubkeyId = documentKeyData.subkeyId;
      documentKey = documentKeyData.key;
    }
    const encryptedDocumentTitle = await encryptDocumentTitle({
      title,
      key: documentKey,
    });
    const updateDocumentNameResult = await updateDocumentNameMutation({
      input: {
        id: pageId,
        encryptedName: encryptedDocumentTitle.ciphertext,
        encryptedNameNonce: encryptedDocumentTitle.publicNonce,
        subkeyId: documentSubkeyId,
      },
    });
    if (updateDocumentNameResult.data?.updateDocumentName?.document) {
      const updatedDocument =
        updateDocumentNameResult.data.updateDocumentName.document;
      await updateDocumentStore(updatedDocument, urqlClient, activeDevice);
    }
  };

  useEffect(() => {
    setLastUsedDocumentId(pageId, workspaceId);
    // removing the isNew param right after the first render so users don't have it after a refresh
    props.navigation.setParams({ isNew: undefined });
    (async () => {
      if (pageId) {
        await navigateAwayIfUserDoesntHaveAccess(workspaceId, pageId);
      }
    })();
  }, [pageId]);

  return (
    <Page
      {...props}
      // to force unmount and mount the page
      key={pageId}
      updateTitle={updateTitle}
    />
  );
}
