import { documentDerivedKeyContext } from "../createDocumentKey/createDocumentKey";
import { kdfDeriveFromKey } from "../kdfDeriveFromKey/kdfDeriveFromKey";

type Params = {
  folderKey: string;
  subkeyId: number;
};

export const recreateDocumentKey = (params: Params) => {
  // TODO On the client and on the backend we should check no
  // subkeyId per folderKey is a duplicate.
  return kdfDeriveFromKey({
    key: params.folderKey,
    context: documentDerivedKeyContext,
    subkeyId: params.subkeyId,
  });
};
