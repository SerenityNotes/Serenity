import { encryptFolder } from "@serenity-tools/common";
import { gql } from "graphql-request";

type Params = {
  graphql: any;
  id: string;
  name: string;
  parentFolderId: string | null | undefined;
  workspaceId: string;
  parentKey: string;
  authorizationHeader: string;
};

export const createFolder = async ({
  graphql,
  id,
  name,
  parentKey,
  parentFolderId,
  workspaceId,
  authorizationHeader,
}: Params) => {
  const authorizationHeaders = {
    authorization: authorizationHeader,
  };
  const encryptedFolderResult = await encryptFolder({
    name,
    parentKey,
  });
  const subKeyId = encryptedFolderResult.folderSubkeyId;
  const encryptedName = encryptedFolderResult.ciphertext;
  const nameNonce = encryptedFolderResult.publicNonce;

  const query = gql`
    mutation createFolder($input: CreateFolderInput!) {
      createFolder(input: $input) {
        folder {
          id
          name
          encryptedName
          nameNonce
          subKeyId
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
        id,
        name,
        encryptedName,
        nameNonce,
        parentFolderId,
        subKeyId,
        workspaceId,
      },
    },
    authorizationHeaders
  );
  return result;
};
