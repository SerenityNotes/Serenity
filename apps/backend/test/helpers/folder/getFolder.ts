import { gql } from "graphql-request";

type Params = {
  graphql: any;
  id: string;
  authorizationHeader: string;
};

export const getFolder = async ({
  graphql,
  id,
  authorizationHeader,
}: Params) => {
  const authorizationHeaders = {
    authorization: authorizationHeader,
  };
  const query = gql`
    query folder($id: ID!) {
      folder(id: $id) {
        id
        name
        parentFolderId
        rootFolderId
        workspaceId
      }
    }
  `;
  const result = await graphql.client.request(
    query,
    { id },
    authorizationHeaders
  );
  return result;
};
