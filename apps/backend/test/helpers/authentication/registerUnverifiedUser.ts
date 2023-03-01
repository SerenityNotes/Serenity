import {
  createAndEncryptDevice,
  encryptWorkspaceInvitationPrivateKey,
} from "@serenity-tools/common";
import { gql } from "graphql-request";
import sodium from "react-native-libsodium";
import { TestContext } from "../setupGraphql";
import { requestRegistrationChallengeResponse } from "./requestRegistrationChallengeResponse";

export type Props = {
  graphql: TestContext;
  username: string;
  password: string;
  pendingWorkspaceInvitationId: string | null | undefined;
};
export const registerUnverifiedUser = async ({
  graphql,
  username,
  password,
  pendingWorkspaceInvitationId,
}: Props) => {
  const result = await requestRegistrationChallengeResponse(
    graphql,
    username,
    password
  );
  const message = result.registration.finish(
    password,
    sodium.from_base64(result.data.challengeResponse)
  );
  const query = gql`
    mutation finishRegistration($input: FinishRegistrationInput!) {
      finishRegistration(input: $input) {
        id
      }
    }
  `;
  const exportKey = sodium.to_base64(result.registration.getExportKey());
  const { signingPrivateKey, encryptionPrivateKey, ...mainDevice } =
    createAndEncryptDevice(exportKey);

  let pendingWorkspaceInvitationKeyCiphertext: string | null = null;
  let pendingWorkspaceInvitationKeyPublicNonce: string | null = null;
  let pendingWorkspaceInvitationKeySubkeyId: number | null = null;
  let pendingWorkspaceInvitationKeyEncryptionSalt: string | null = null;
  if (pendingWorkspaceInvitationId) {
    const signingKeyPair = sodium.crypto_sign_keypair();
    const workspaceInvitationKeyData = encryptWorkspaceInvitationPrivateKey({
      exportKey,
      workspaceInvitationSigningPrivateKey: sodium.to_base64(
        signingKeyPair.privateKey
      ),
    });
    pendingWorkspaceInvitationKeyCiphertext =
      workspaceInvitationKeyData.ciphertext;
    pendingWorkspaceInvitationKeyPublicNonce =
      workspaceInvitationKeyData.publicNonce;
    pendingWorkspaceInvitationKeySubkeyId = workspaceInvitationKeyData.subkeyId;
    pendingWorkspaceInvitationKeyEncryptionSalt =
      workspaceInvitationKeyData.encryptionKeySalt;
  }

  const registrationResponse = await graphql.client.request(query, {
    input: {
      registrationId: result.data.registrationId,
      message: sodium.to_base64(message),
      mainDevice,
      pendingWorkspaceInvitationId,
      pendingWorkspaceInvitationKeyCiphertext,
      pendingWorkspaceInvitationKeyPublicNonce,
      pendingWorkspaceInvitationKeySubkeyId,
      pendingWorkspaceInvitationKeyEncryptionSalt,
    },
  });
  return registrationResponse;
};
