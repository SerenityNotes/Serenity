import { gql } from "graphql-request";

type Params = {
  graphql: any;
  workspaceId: string;
  workspaceName: string;
  folderId: string;
  folderIdSignature: string;
  folderName: string;
  documentId: string;
  documentName: string;
  authorizationHeader: string;
};

export const createInitialWorkspaceStructure = async ({
  graphql,
  workspaceName,
  workspaceId,
  folderId,
  folderIdSignature,
  folderName,
  documentId,
  documentName,
  authorizationHeader,
}: Params) => {
  const authorizationHeaders = {
    authorization: authorizationHeader,
  };
  const query = gql`
    mutation createInitialWorkspaceStructure(
      $input: CreateInitialWorkspaceStructureInput!
    ) {
      createInitialWorkspaceStructure(input: $input) {
        workspace {
          id
          name
          members {
            userId
            isAdmin
          }
        }
        folder {
          id
          name
          parentFolderId
          rootFolderId
          workspaceId
        }
      }
    }
  `;
  const result = await graphql.client.request(
    query,
    {
      input: {
        workspaceName,
        workspaceId,
        folderId,
        folderIdSignature,
        folderName,
        documentId,
        documentName,
      },
    },
    authorizationHeaders
  );
  return result;
};
