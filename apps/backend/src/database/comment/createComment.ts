import { ForbiddenError, UserInputError } from "apollo-server-express";
import { Role, ShareDocumentRole } from "../../../prisma/generated/output";
import { getOrCreateCreatorDevice } from "../../utils/device/getOrCreateCreatorDevice";
import { prisma } from "../prisma";

type Params = {
  commentId: string;
  userId: string;
  documentShareLinkToken?: string | null | undefined;
  creatorDeviceSigningPublicKey: string;
  snapshotId: string;
  subkeyId: number;
  contentCiphertext: string;
  contentNonce: string;
  signature: string;
};

export async function createComment({
  commentId,
  userId,
  documentShareLinkToken,
  creatorDeviceSigningPublicKey,
  snapshotId,
  subkeyId,
  contentCiphertext,
  contentNonce,
  signature,
}: Params) {
  // verify the document exists
  const document = await prisma.document.findFirst({
    where: { activeSnapshotId: snapshotId },
  });
  if (!document) {
    throw new ForbiddenError("Unauthorized");
  }
  const allowedRoles = [Role.ADMIN, Role.EDITOR, Role.COMMENTER];
  const allowedShareDocumentRoles = [
    ShareDocumentRole.EDITOR,
    ShareDocumentRole.COMMENTER,
  ];
  // if the user has a documentShareLinkToken, verify it
  let documentShareLink: any = null;
  if (documentShareLinkToken) {
    documentShareLink = await prisma.documentShareLink.findFirst({
      where: {
        token: documentShareLinkToken,
        documentId: document.id,
        role: { in: allowedShareDocumentRoles },
      },
    });
    if (!documentShareLink) {
      throw new UserInputError("Invalid documentShareLinkToken");
    }
  } else {
    // if no documentShareLinkToken, the user must have access to the workspace
    const user2Workspace = await prisma.usersToWorkspaces.findFirst({
      where: {
        userId,
        workspaceId: document.workspaceId,
        role: { in: allowedRoles },
      },
    });
    if (!user2Workspace) {
      throw new ForbiddenError("Unauthorized");
    }
  }

  // convert the user's device into a creatorDevice
  const creatorDevice = await getOrCreateCreatorDevice({
    prisma,
    userId,
    signingPublicKey: creatorDeviceSigningPublicKey,
  });

  try {
    const comment = await prisma.comment.create({
      data: {
        id: commentId,
        documentId: document.id,
        snapshotId,
        creatorDeviceSigningPublicKey: creatorDevice.signingPublicKey,
        contentCiphertext,
        contentNonce,
        subkeyId,
        signature,
      },
    });
    return {
      ...comment,
      creatorDevice,
    };
  } catch (e) {
    console.log(e);
    throw e;
  }
}
