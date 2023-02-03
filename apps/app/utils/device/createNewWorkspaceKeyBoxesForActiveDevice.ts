import {
  decryptWorkspaceKey,
  encryptWorkspaceKeyForDevice,
} from "@serenity-tools/common";
import {
  WorkspaceKeyBox,
  WorkspaceKeyBoxData,
  WorkspaceKeyDevicePair,
} from "../../generated/graphql";
import { Device } from "../../types/Device";
import { getWorkspace } from "../workspace/getWorkspace";
import { getWorkspaces } from "../workspace/getWorkspaces";
import { getDevices } from "./getDevices";
import { getMainDevice } from "./mainDeviceMemoryStore";

type GetWorkspaceKeyBoxByDeviceSigningPublicKeyProps = {
  workspaceKeyBoxes: WorkspaceKeyBox[];
  deviceSigningPublicKey: string;
};

const getWorkspaceKeyBoxByDeviceSigningPublicKey = ({
  workspaceKeyBoxes,
  deviceSigningPublicKey,
}: GetWorkspaceKeyBoxByDeviceSigningPublicKeyProps):
  | WorkspaceKeyBox
  | undefined => {
  for (const workspaceKeyBox of workspaceKeyBoxes) {
    if (workspaceKeyBox.deviceSigningPublicKey === deviceSigningPublicKey) {
      return workspaceKeyBox;
    }
  }
  return undefined;
};

export type Props = {
  activeDevice: Device;
};
export const createNewWorkspaceKeyBoxesForActiveDevice = async ({
  activeDevice,
}: Props) => {
  const devices = await getDevices({ hasNonExpiredSession: true });
  if (!devices) {
    throw new Error("No devices found");
  }
  const mainDevice = getMainDevice();
  if (!mainDevice) {
    throw new Error("No main device found!");
  }
  const workspaces = await getWorkspaces({
    deviceSigningPublicKey: activeDevice.signingPublicKey,
  });
  if (workspaces === null) {
    throw new Error("No workspaces found");
  }
  const deviceWorkspaceKeyBoxes: WorkspaceKeyBoxData[] = [];
  for (const workspace of workspaces) {
    const workspaceWithMainWorkspaceKeyBox = await getWorkspace({
      workspaceId: workspace.id,
      deviceSigningPublicKey: mainDevice?.signingPublicKey,
    });
    const workspaceKeys = workspaceWithMainWorkspaceKeyBox?.workspaceKeys;
    if (!workspaceKeys) {
      // TODO: handle this error
      throw new Error("No workspace keys found for workspace");
    }
    const workspaceKeyDevicePairs: WorkspaceKeyDevicePair[] = [];
    for (let workspaceKey of workspaceKeys) {
      const workspaceKeyBox =
        workspaceWithMainWorkspaceKeyBox?.currentWorkspaceKey?.workspaceKeyBox;
      if (!workspaceKeyBox) {
        throw new Error("Could not find workspaceKeyBox for main device!");
      }
      const creatorDevice = workspaceKeyBox.creatorDevice;
      const workspaceKeyString = decryptWorkspaceKey({
        ciphertext: workspaceKeyBox.ciphertext,
        nonce: workspaceKeyBox.nonce,
        receiverDeviceEncryptionPrivateKey: mainDevice?.encryptionPrivateKey!,
        creatorDeviceEncryptionPublicKey: creatorDevice?.encryptionPublicKey!,
      });
      const { nonce, ciphertext } = encryptWorkspaceKeyForDevice({
        workspaceKey: workspaceKeyString,
        receiverDeviceEncryptionPublicKey: activeDevice.encryptionPublicKey,
        creatorDeviceEncryptionPrivateKey: mainDevice.encryptionPrivateKey!,
      });
      workspaceKeyDevicePairs.push({
        workspaceKeyId: workspaceKey.id,
        ciphertext,
        nonce,
      });
    }
    deviceWorkspaceKeyBoxes.push({
      workspaceId: workspace.id,
      workspaceKeyDevicePairs,
    });
  }
  return {
    deviceWorkspaceKeyBoxes,
    creatorDevice: mainDevice,
    receiverDevice: activeDevice,
  };
};
