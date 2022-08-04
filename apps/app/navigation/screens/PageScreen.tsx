import { WorkspaceDrawerScreenProps } from "../../types/navigation";
import Page from "../../components/page/Page";
import { useWindowDimensions } from "react-native";
import { PageHeaderRight } from "../../components/pageHeaderRight/PageHeaderRight";
import { useEffect, useLayoutEffect } from "react";
import { useUpdateDocumentNameMutation } from "../../generated/graphql";
import { PageHeader } from "../../components/page/PageHeader";
import { setLastUsedDocumentId } from "../../utils/lastUsedWorkspaceAndDocumentStore/lastUsedWorkspaceAndDocumentStore";
import { useWorkspaceId } from "../../context/WorkspaceIdContext";
import { useDocumentStore } from "../../utils/document/documentStore";
import {
  DocumentQuery,
  DocumentQueryVariables,
  DocumentDocument,
} from "../../generated/graphql";
import { useClient } from "urql";
import { removeLastUsedDocumentId } from "../../utils/lastUsedWorkspaceAndDocumentStore/lastUsedWorkspaceAndDocumentStore";

export default function PageScreen(props: WorkspaceDrawerScreenProps<"Page">) {
  useWindowDimensions(); // needed to ensure tw-breakpoints are triggered when resizing
  const workspaceId = useWorkspaceId();
  const documentStore = useDocumentStore();
  const pageId = props.route.params.pageId;
  const urqlClient = useClient();

  const doesUserHaveAccess = async (docId: string) => {
    const documentResult = await urqlClient
      .query<DocumentQuery, DocumentQueryVariables>(
        DocumentDocument,
        { id: docId },
        {
          // better to be safe here and always refetch
          requestPolicy: "network-only",
        }
      )
      .toPromise();
    if (
      documentResult.error?.message === "[GraphQL] Document not found" ||
      documentResult.error?.message === "[GraphQL] Unauthorized"
    ) {
      props.navigation.replace("Workspace", {
        workspaceId,
        screen: "NoPageExists",
      });
      return;
    }
    return true;
  };

  useLayoutEffect(() => {
    props.navigation.setOptions({
      headerRight: PageHeaderRight,
      headerTitle: PageHeader,
      headerTitleAlign: "left",
    });
  }, []);

  const [, updateDocumentNameMutation] = useUpdateDocumentNameMutation();
  const updateTitle = async (title: string) => {
    const updateDocumentNameResult = await updateDocumentNameMutation({
      input: {
        id: pageId,
        name: title,
      },
    });
    if (updateDocumentNameResult.data?.updateDocumentName?.document) {
      const document =
        updateDocumentNameResult.data.updateDocumentName.document;
      documentStore.update(document);
    }
  };

  useEffect(() => {
    setLastUsedDocumentId(pageId, workspaceId);
    // removing the isNew param right after the first render so users don't have it after a refresh
    props.navigation.setParams({ isNew: undefined });
    (async () => {
      if (pageId) {
        const hasAccess = await doesUserHaveAccess(pageId);
        if (!hasAccess) {
          props.navigation.replace("Workspace", {
            workspaceId,
            screen: "NoPageExists",
          });
        }
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
