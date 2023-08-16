import { gql } from "graphql-request";
import { TestContext } from "../setupGraphql";

export type Props = {
  graphql: TestContext;
  input: { workspaceIds: string[] };
  sessionKey: string;
};
export const getUnauthorizedMember = async ({
  graphql,
  input,
  sessionKey,
}: Props) => {
  const authorizationHeader = { authorization: sessionKey };
  const query = gql`
    query unauthorizedMember {
      unauthorizedMember {
        userId
        workspaceId
      }
    }
  `;
  return await graphql.client.request(query, input, authorizationHeader);
};
