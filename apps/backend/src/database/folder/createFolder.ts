import { ForbiddenError } from "apollo-server-express";
import { Folder } from "../../types/folder";
import { prisma } from "../prisma";

type Params = {
  userId: string;
  id: string;
  name?: string;
  encryptedName: string;
  nameNonce: string;
  subKeyId: number;
  parentFolderId?: string;
  workspaceId: string;
};

export async function createFolder({
  userId,
  id,
  name,
  encryptedName,
  nameNonce,
  subKeyId,
  parentFolderId,
  workspaceId,
}: Params) {
  let folderName = "Untitled";
  if (name) {
    folderName = name;
  }
  try {
    return await prisma.$transaction(async (prisma) => {
      // make sure we have permissions to do stuff with this workspace
      const userToWorkspace = await prisma.usersToWorkspaces.findFirst({
        where: {
          userId,
          workspaceId,
        },
      });
      if (!userToWorkspace) {
        throw new ForbiddenError("Unauthorized");
      }
      // if there is a parentId, then grab it's root folder id for our own
      let rootFolderId: string | null = null;
      if (parentFolderId) {
        const parentFolder = await prisma.folder.findFirst({
          where: {
            id: parentFolderId,
            workspaceId: workspaceId,
          },
        });
        if (!parentFolder) {
          throw new ForbiddenError("Unauthorized");
        }
        if (parentFolder.rootFolderId) {
          rootFolderId = parentFolder.rootFolderId;
        } else {
          rootFolderId = parentFolder.id;
        }
      }
      const rawFolder = await prisma.folder.create({
        data: {
          id,
          idSignature: "TODO",
          name: folderName,
          encryptedName,
          nameNonce,
          subKeyId,
          parentFolderId,
          rootFolderId,
          workspaceId,
        },
      });
      const folder: Folder = {
        ...rawFolder,
        parentFolders: [],
      };
      return folder;
    });
  } catch (error) {
    throw error;
  }
}
