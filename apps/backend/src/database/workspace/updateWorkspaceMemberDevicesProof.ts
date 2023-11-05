import { PrismaClient } from "@prisma/client";
import * as workspaceMemberDevicesProofUtil from "@serenity-kit/workspace-member-devices-proof";
import { ForbiddenError } from "apollo-server-express";
import { getLastWorkspaceChainEventWithState } from "../workspaceChain/getLastWorkspaceChainEventWithState";
import { getWorkspaceMemberDevicesProofByWorkspaceId } from "./getWorkspaceMemberDevicesProofByWorkspaceId";

type Params = {
  workspaceId: string;
  userId: string;
  userChainEventHash?: string;
  prisma: PrismaClient;
  workspaceMemberDevicesProof: workspaceMemberDevicesProofUtil.WorkspaceMemberDevicesProof;
  authorPublicKey: string;
};

export async function updateWorkspaceMemberDevicesProof({
  userId,
  workspaceId,
  userChainEventHash,
  workspaceMemberDevicesProof,
  authorPublicKey,
  prisma,
}: Params) {
  const userToWorkspace = await prisma.usersToWorkspaces.findFirst({
    where: {
      userId,
      workspaceId,
    },
    select: {
      workspaceId: true,
    },
  });
  if (!userToWorkspace) {
    throw new ForbiddenError("Unauthorized");
  }

  const { workspaceChainState } = await getLastWorkspaceChainEventWithState({
    prisma,
    workspaceId,
  });

  const existingWorkspaceMemberDevicesProof =
    await getWorkspaceMemberDevicesProofByWorkspaceId({
      prisma,
      workspaceId,
    });

  const workspaceMemberDevicesProofData: workspaceMemberDevicesProofUtil.WorkspaceMemberDevicesProofData =
    {
      clock: existingWorkspaceMemberDevicesProof.proof.clock + 1,
      workspaceChainHash: workspaceChainState.lastEventHash,
      userChainHashes: userChainEventHash
        ? {
            ...existingWorkspaceMemberDevicesProof.data.userChainHashes,
            [userId]: userChainEventHash,
          }
        : existingWorkspaceMemberDevicesProof.data.userChainHashes,
    };

  if (
    !workspaceMemberDevicesProofUtil.isValidWorkspaceMemberDevicesProof({
      workspaceMemberDevicesProof,
      authorPublicKey,
      workspaceMemberDevicesProofData,
    })
  ) {
    throw new Error(
      "Invalid workspaceMemberDevicesProof in updateWorkspaceMemberDevicesProof"
    );
  }

  await prisma.workspaceMemberDevicesProof.create({
    data: {
      workspaceId,
      hash: workspaceMemberDevicesProof.hash,
      clock: workspaceMemberDevicesProofData.clock,
      proof: workspaceMemberDevicesProof,
      data: workspaceMemberDevicesProofData,
    },
  });
}
