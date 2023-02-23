export type CiphertextContent = {
  accessReference: string; // hash of the access chain // TODO should this be in the unencrypted part?
  content: string;
};

export type KeyDerivationTraceParentFolder = {
  folderId: string;
  subkeyId: number;
  parentFolderId?: string | undefined | null;
};

export type KeyDerivationTrace = {
  workspaceKeyId: string;
  subkeyId: number;
  parentFolders: KeyDerivationTraceParentFolder[];
};

export type KeyDerivationTraceEntry = {
  entryId: string; // didn't use id because it often GraphQL clients normalize by the id field
  subkeyId: number;
  parentId?: string | undefined | null; // the first entry has no parent
  context: string; // kdf context
};

export type KeyDerivationTraceEntryWithKey = KeyDerivationTraceEntry & {
  key: string;
};

export type KeyDerivationTrace2 = {
  workspaceKeyId: string;
  trace: KeyDerivationTraceEntry[];
};

export type KeyDerivationTraceWithKeys = {
  workspaceKeyId: string;
  trace: KeyDerivationTraceEntryWithKey[];
};

export interface SnapshotPublicData {
  docId: string;
  pubKey: string; // public signing key
  snapshotId: string;
  subkeyId: number;
  keyDerivationTrace: KeyDerivationTrace2;
}

export interface SnapshotServerData {
  latestVersion: number;
}

export interface UpdatePublicData {
  docId: string;
  pubKey: string; // public signing key
  refSnapshotId: string;
}

export interface UpdatePublicDataWithClock {
  docId: string;
  pubKey: string; // public signing key
  refSnapshotId: string;
  clock: number;
}

export interface UpdateServerData {
  version: number;
}

export interface AwarenessUpdatePublicData {
  docId: string;
  pubKey: string; // public signing key
}

export interface Snapshot {
  ciphertext: string;
  nonce: string;
  signature: string; // ciphertext + nonce + publicData
  publicData: SnapshotPublicData;
}

export interface SnapshotWithServerData extends Snapshot {
  serverData: SnapshotServerData;
}

export interface Update {
  ciphertext: string;
  nonce: string;
  signature: string; // ciphertext + nonce + publicData
  publicData: UpdatePublicDataWithClock;
}

export interface UpdateWithServerData extends Snapshot {
  serverData: UpdateServerData;
}

export interface AwarenessUpdate {
  ciphertext: string;
  nonce: string;
  signature: string; // ciphertext + nonce + publicData
  publicData: AwarenessUpdatePublicData;
}

export type ClientEvent = Snapshot | Update | AwarenessUpdate;

export type ServerEvent =
  | SnapshotWithServerData
  | UpdateWithServerData
  | AwarenessUpdate;
