import canonicalize from "canonicalize";
import sodium from "react-native-libsodium";
import { encryptAead } from "../encryptAead/encryptAead";
import { kdfDeriveFromKey } from "../kdfDeriveFromKey/kdfDeriveFromKey";

type Params = {
  name: string;
  // parentKey is the master key for the workspace or the key of the parent folder
  parentKey: string;
  publicData?: any;
};

// Having a specific "folder__" context allows us to use have the same subkeyId
// for one parentKey and checking only the uniquness for this type.
export const folderDerivedKeyContext = "folder__";

export const encryptFolderName = (params: Params) => {
  const publicData = params.publicData || {};
  const canonicalizedPublicData = canonicalize(publicData);
  if (!canonicalizedPublicData) {
    throw new Error("Invalid public data for encrypting the name.");
  }
  // TODO On the frontend and on the backend we should check no
  // subkeyId per parentKey is a duplicate.
  const folderKey = kdfDeriveFromKey({
    key: params.parentKey,
    context: folderDerivedKeyContext,
  });
  const result = encryptAead(
    params.name,
    canonicalizedPublicData,
    sodium.from_base64(folderKey.key)
  );
  return {
    folderSubkey: folderKey.key,
    folderSubkeyId: folderKey.subkeyId,
    ciphertext: result.ciphertext,
    publicNonce: result.publicNonce,
    publicData,
  };
};
