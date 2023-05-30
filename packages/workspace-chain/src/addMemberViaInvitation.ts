import canonicalize from "canonicalize";
import sodium from "react-native-libsodium";
import {
  AddMemberViaInvitationTransaction,
  AddMemberViaInvitationWorkspaceChainEvent,
  Role,
} from "./types";
import { hashTransaction } from "./utils";
import { verifyAcceptInvitation } from "./verifyAcceptInvitation";

type AddMemberViaInvitationParams = {
  prevHash: string;
  authorKeyPair: sodium.KeyPair;
  role: Role;
  acceptInvitationSignature: string;
  acceptInvitationAuthorSignature: string;
  invitationSigningPublicKey: string;
  invitationId: string;
  mainDeviceSigningPublicKey: string;
  workspaceId: string;
  expiresAt: Date;
};

export const addMemberViaInvitation = ({
  prevHash,
  authorKeyPair,
  role,
  acceptInvitationSignature,
  acceptInvitationAuthorSignature,
  invitationSigningPublicKey,
  invitationId,
  mainDeviceSigningPublicKey,
  workspaceId,
  expiresAt,
}: AddMemberViaInvitationParams): AddMemberViaInvitationWorkspaceChainEvent => {
  const isValid = verifyAcceptInvitation({
    acceptInvitationSignature,
    acceptInvitationAuthorSignature,
    mainDeviceSigningPublicKey,
    expiresAt,
    invitationId,
    invitationSigningPublicKey,
    role,
    workspaceId,
  });
  if (!isValid) {
    throw new Error("Invalid accept invitation data");
  }

  const transaction: AddMemberViaInvitationTransaction = {
    type: "add-member-via-invitation",
    memberMainDeviceSigningPublicKey: mainDeviceSigningPublicKey,
    role,
    acceptInvitationSignature,
    acceptInvitationAuthorSignature,
    invitationSigningPublicKey,
    invitationId,
    workspaceId,
    expiresAt: expiresAt.toISOString(),
  };

  const hash = hashTransaction(transaction);
  const message = canonicalize({
    prevHash,
    hash,
  });
  if (typeof message !== "string") {
    throw new Error("Could not canonicalize hashes");
  }

  return {
    authors: [
      {
        publicKey: sodium.to_base64(authorKeyPair.publicKey),
        signature: sodium.to_base64(
          sodium.crypto_sign_detached(message, authorKeyPair.privateKey)
        ),
      },
    ],
    transaction,
    prevHash,
  };
};
