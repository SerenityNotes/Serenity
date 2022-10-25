import * as sodium from "@serenity-tools/libsodium";
import { Device } from "../../types/device";
import { createConfirmationCode } from "../../utils/confirmationCode";
import { ExpectedGraphqlError } from "../../utils/expectedGraphqlError/expectedGraphqlError";
import { prisma } from "../prisma";

type DeviceInput = Device & {
  ciphertext: string;
  nonce: string;
  encryptionKeySalt: string;
};

type Props = {
  username: string;
  opaqueEnvelope: string;
  mainDevice: DeviceInput;
  pendingWorkspaceInvitationId: string | null | undefined;
};

const verifyDevice = async (device: DeviceInput) => {
  return await sodium.crypto_sign_verify_detached(
    device.encryptionPublicKeySignature,
    device.encryptionPublicKey,
    device.signingPublicKey
  );
};

export async function finalizeRegistration({
  username,
  opaqueEnvelope,
  mainDevice,
  pendingWorkspaceInvitationId,
}: Props) {
  if (!verifyDevice(mainDevice)) {
    throw new Error("Failed to verify main device.");
  }
  try {
    return await prisma.$transaction(async (prisma) => {
      // if this user has already completed registration, throw an error
      const existingUserData = await prisma.user.findUnique({
        where: {
          username,
        },
      });
      if (existingUserData) {
        throw new ExpectedGraphqlError(
          "This email has already been registered."
        );
      }
      const confirmationCode = await createConfirmationCode();
      const unverifiedUser = await prisma.unverifiedUser.create({
        data: {
          username,
          confirmationCode,
          opaqueEnvelope,
          mainDeviceCiphertext: mainDevice.ciphertext,
          mainDeviceNonce: mainDevice.nonce,
          mainDeviceSigningPublicKey: mainDevice.signingPublicKey,
          mainDeviceEncryptionKeySalt: mainDevice.encryptionKeySalt,
          mainDeviceEncryptionPublicKey: mainDevice.encryptionPublicKey,
          mainDeviceEncryptionPublicKeySignature:
            mainDevice.encryptionPublicKeySignature,
          pendingWorkspaceInvitationId,
        },
      });
      // TODO: send an email to the user's email address
      console.log(
        `New user confirmation code: ${unverifiedUser.confirmationCode}`
      );
      return unverifiedUser;
    });
  } catch (error) {
    console.error("Error saving user");
    console.log(error);
    throw error;
  }
}
