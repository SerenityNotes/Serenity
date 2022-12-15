import { Editor } from "@tiptap/core";
import { updateFileAttributes } from "../editor-file-extension/src";
import { UpdateEditorParams } from "./types";

export const updateEditor = (editor: Editor, params: UpdateEditorParams) => {
  if (params.variant === "toggle-bold") {
    editor.chain().focus().toggleBold().run();
  } else if (params.variant === "toggle-italic") {
    editor.chain().focus().toggleItalic().run();
  } else if (params.variant === "toggle-code") {
    editor.chain().focus().toggleCode().run();
  } else if (params.variant === "toggle-link") {
    // styling dummy
    editor.chain().focus().toggleLink({ href: "#" }).run();
  } else if (params.variant === "toggle-heading-1") {
    editor.chain().focus().toggleHeading({ level: 1 }).run();
  } else if (params.variant === "toggle-heading-2") {
    editor.chain().focus().toggleHeading({ level: 2 }).run();
  } else if (params.variant === "toggle-heading-3") {
    editor.chain().focus().toggleHeading({ level: 3 }).run();
  } else if (params.variant === "toggle-code-block") {
    editor.chain().focus().toggleCodeBlock().run();
  } else if (params.variant === "toggle-blockquote") {
    editor.chain().focus().toggleBlockquote().run();
  } else if (params.variant === "toggle-bullet-list") {
    editor.chain().focus().toggleBulletList().run();
  } else if (params.variant === "toggle-ordered-list") {
    editor.chain().focus().toggleOrderedList().run();
  } else if (params.variant === "toggle-task-list") {
    editor.chain().focus().toggleTaskList().run();
  } else if (params.variant === "insert-image") {
    editor.commands.insertContent({
      type: "image",
      attrs: params.params,
    });
  } else if (params.variant === "update-image-attributes") {
    updateFileAttributes({ ...params.params, view: editor.view });
  }
};
