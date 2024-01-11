import { KeyDerivationTrace } from "@serenity-tools/common";
import { ForbiddenError, UserInputError } from "apollo-server-express";
import { Prisma, Role } from "../../../prisma/generated/output";
import { prisma } from "../prisma";

type Params = {
  id: string;
  nameCiphertext: string;
  nameNonce: string;
  signature: string;
  workspaceMemberDevicesProofHash: string;
  workspaceKeyId: string;
  subkeyId: string;
  userId: string;
  keyDerivationTrace: KeyDerivationTrace;
};

export async function updateFolderName({
  id,
  nameCiphertext,
  nameNonce,
  workspaceKeyId,
  signature,
  workspaceMemberDevicesProofHash,
  subkeyId,
  userId,
  keyDerivationTrace,
}: Params) {
  const allowedRoles = [Role.ADMIN, Role.EDITOR];
  return await prisma.$transaction(
    async (prisma) => {
      const folderWithSubkeyId = await prisma.folder.findFirst({
        where: { subkeyId, id: { not: id } },
        select: { id: true },
      });
      if (folderWithSubkeyId) {
        throw new UserInputError("Invalid input: duplicate subkeyId");
      }
      // fetch the folder
      // check if the user has access to the workspace
      // update the folder
      const folder = await prisma.folder.findFirst({
        where: {
          id,
        },
      });
      if (!folder) {
        throw new ForbiddenError("Unauthorized");
      }
      const userToWorkspace = await prisma.usersToWorkspaces.findFirst({
        where: {
          userId,
          workspaceId: folder.workspaceId,
          role: { in: allowedRoles },
        },
      });
      if (
        !userToWorkspace ||
        folder.workspaceId !== userToWorkspace.workspaceId
      ) {
        throw new ForbiddenError("Unauthorized");
      }
      const updatedFolder = await prisma.folder.update({
        where: {
          id,
        },
        data: {
          nameCiphertext,
          nameNonce,
          signature,
          workspaceMemberDevicesProofHash,
          workspaceKeyId,
          subkeyId,
          keyDerivationTrace,
        },
      });
      return updatedFolder;
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    }
  );
}
