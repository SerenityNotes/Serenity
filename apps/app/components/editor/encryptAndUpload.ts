import { encryptAndUploadFile } from "../../utils/file/encryptAndUploadFile";

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    // TODO: handle errors
    // @ts-expect-error - throw if not a string
    reader.onload = () => resolve(reader.result);
    reader.onerror = (error) => reject(error);
  });

export const encryptAndUpload = async (file) => {
  const imageAsBase64 = await fileToBase64(file);
  const { fileId, key, publicNonce } = await encryptAndUploadFile({
    base64FileData: imageAsBase64,
    documentId: "invalid",
    workspaceId: "invalid",
  });
  return { fileId, key, nonce: publicNonce };
};
