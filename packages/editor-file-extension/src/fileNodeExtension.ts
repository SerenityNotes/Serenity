import { mergeAttributes, Node } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { File } from "./components/File";
import {
  DownloadAndDecryptFileFunction,
  EncryptAndUploadFunctionFile,
  FileNodeAttributes,
} from "./types";
import { uploadImageProsemirrorPlugin } from "./uploadImageProsemirrorPlugin";

export interface ImageOptions {
  inline: boolean;
  HTMLAttributes: Record<string, any>;
  encryptAndUploadFile: EncryptAndUploadFunctionFile;
  downloadAndDecryptFile: DownloadAndDecryptFileFunction;
}

// we can add markdown support later
// export const inputRegex = /(?:^|\s)(!\[(.+|:?)]\((\S+)(?:(?:\s+)["'](\S+)["'])?\))$/;

export const FileNodeExtension = Node.create<ImageOptions>({
  name: "file",

  addOptions() {
    return {
      inline: false,
      HTMLAttributes: {},
      encryptAndUploadFile: async () => {
        return { key: "", nonce: "", fileId: "" };
      },
      downloadAndDecryptFile: async () => "",
    };
  },

  inline() {
    // return this.options.inline;
    return false;
  },

  group() {
    // return this.options.inline ? "inline" : "block";
    return "block";
  },

  addStorage() {
    return {
      downloadAndDecryptFile: this.options.downloadAndDecryptFile,
    };
  },

  draggable: true,

  addAttributes() {
    return {
      subtype: {
        default: "file",
      },
      subtypeAttributes: {
        // image: { src: null, alt: null, title: null, width: null, height: null }
        // file:  { fileName: null, fileSize: null }
        default: {},
      },
      fileInfo: {
        default: null,
      },
      uploadId: {
        default: null,
      },
      mimeType: {
        default: null,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "img",
        getAttrs(node) {
          if (typeof node === "string") return {};
          const width = parseInt(node.getAttribute("width")!, 10);
          const height = parseInt(node.getAttribute("height")!, 10);
          const mimeType = node.getAttribute("data-mime-type")!;
          const rawFileInfo = node.getAttribute("data-file-info");

          const attrs: FileNodeAttributes = {
            subtype: "image",
            subtypeAttributes: {
              width,
              height,
            },
            uploadId: node.getAttribute("data-upload-id"),
            mimeType,
            fileInfo: JSON.parse(rawFileInfo || "{}"),
          };
          return attrs;
        },
      },
      {
        tag: "div[data-type=file]",
        getAttrs(node) {
          if (typeof node === "string") return {};
          const fileName = node.getAttribute("data-file-name")!;
          const fileSize = node.getAttribute("data-file-size")!;
          const mimeType = node.getAttribute("data-mime-type")!;
          const rawFileInfo = node.getAttribute("data-file-info");

          const attrs: FileNodeAttributes = {
            subtype: "file",
            subtypeAttributes: {
              fileName,
              fileSize: parseInt(fileSize, 10),
            },
            uploadId: node.getAttribute("data-upload-id"),
            mimeType,
            fileInfo: JSON.parse(rawFileInfo || "{}"),
          };
          return attrs;
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes, node }) {
    if (node.attrs.subtype === "image") {
      return [
        "img",
        mergeAttributes(this.options.HTMLAttributes, {
          ["data-file-info"]: JSON.stringify(HTMLAttributes.fileInfo),
          ["data-upload-id"]: HTMLAttributes.attrsuploadId,
          width: HTMLAttributes.subtypeAttributes.width,
          height: HTMLAttributes.subtypeAttributes.width,
          ["data-mime-type"]: HTMLAttributes.mimeType,
          // TODO add src as base64!
        }),
      ];
    }
    return [
      "div",
      mergeAttributes(this.options.HTMLAttributes, {
        ["data-type"]: "file",
        ["data-file-info"]: JSON.stringify(HTMLAttributes.fileInfo),
        ["data-upload-id"]: HTMLAttributes.attrsuploadId,
        ["data-file-name"]: HTMLAttributes.subtypeAttributes.fileName,
        ["data-file-size"]: HTMLAttributes.subtypeAttributes.fileSize,
        ["data-mime-type"]: HTMLAttributes.mimeType,
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(File);
  },

  addProseMirrorPlugins() {
    return [uploadImageProsemirrorPlugin(this.options.encryptAndUploadFile)];
  },
});
