import { Extension } from "@tiptap/core";
import { EditorState, Plugin } from "prosemirror-state";
import { Decoration, DecorationSet } from "prosemirror-view";
import {
  relativePositionToAbsolutePosition,
  ySyncPluginKey,
} from "y-prosemirror";
import * as Y from "yjs";
import { EditorComment } from "../../types";

export interface CommentsExtensionOptions {
  comments: EditorComment[];
  yDoc: Y.Doc;
  highlightComment: (commentId: string | null) => void;
  highlightedCommentId: string | null;
}

type CommentsExtensionStorage = {
  comments: EditorComment[];
  yDoc: Y.Doc;
  highlightComment: (commentId: string | null) => void;
  highlightedCommentId: string | null;
};

// inspired by https://stackoverflow.com/a/46700791
export function notNull<TypeValue>(
  value: TypeValue | null
): value is TypeValue {
  return value !== null;
}

const resolveCommentPositions = (
  comments: EditorComment[],
  state: EditorState,
  yDoc: Y.Doc
) => {
  const ystate = ySyncPluginKey.getState(state);
  const { type, binding } = ystate;
  if (!binding) return [];

  return comments
    .map((comment: EditorComment) => {
      const from = relativePositionToAbsolutePosition(
        yDoc,
        type,
        comment.from,
        binding.mapping
      );
      const to = relativePositionToAbsolutePosition(
        yDoc,
        type,
        comment.to,
        binding.mapping
      );
      if (from === null || to === null) return null;
      return {
        ...comment,
        absoluteFrom: from,
        absoluteTo: to,
      };
    })
    .filter(notNull);
};

const createCommentsDecorationSet = (
  comments: (EditorComment & { absoluteFrom: number; absoluteTo: number })[],
  highlightedCommentId: string | null,
  state: EditorState
) => {
  return DecorationSet.create(
    state.doc,
    comments.map((comment) => {
      return Decoration.inline(comment.absoluteFrom, comment.absoluteTo, {
        class: `editor-comment ${
          comment.id === highlightedCommentId && "editor-comment--active"
        }`,
      });
    })
  );
};

let prevHighlightedCommentId: null | string = null;

export const CommentsExtension = Extension.create<
  CommentsExtensionOptions,
  CommentsExtensionStorage
>({
  name: "comments",

  addOptions() {
    return {
      comments: [],
      yDoc: {} as Y.Doc,
      highlightComment: () => undefined,
      highlightedCommentId: null,
    };
  },

  addStorage() {
    return {
      comments: this.options.comments,
      yDoc: this.options.yDoc,
      highlightComment: this.options.highlightComment,
      highlightedCommentId: this.options.highlightedCommentId,
    };
  },

  addProseMirrorPlugins() {
    const storage = this.editor.storage;

    return [
      new Plugin({
        state: {
          init(editor, state) {
            const resolvedComments = resolveCommentPositions(
              storage.comments.comments,
              state,
              storage.comments.yDoc
            );
            return createCommentsDecorationSet(
              resolvedComments,
              storage.comments.highlightedCommentId,
              state
            );
          },
          apply(tr, oldState, newState) {
            const resolvedComments = resolveCommentPositions(
              storage.comments.comments,
              newState,
              storage.comments.yDoc
            );
            const commentToHighlight = resolvedComments.find((comment) => {
              return (
                comment.absoluteFrom <= newState.selection.from &&
                comment.absoluteTo >= newState.selection.to
              );
            });
            if (commentToHighlight) {
              if (prevHighlightedCommentId !== commentToHighlight.id) {
                prevHighlightedCommentId = commentToHighlight.id;
                storage.comments.highlightComment(commentToHighlight.id);
              }
            } else {
              if (prevHighlightedCommentId !== null) {
                // make sure an endless loop isn't triggered
                prevHighlightedCommentId = null;
                storage.comments.highlightComment(null);
              }
            }

            return createCommentsDecorationSet(
              resolvedComments,
              storage.comments.highlightedCommentId,
              newState
            );
          },
        },
        props: {
          decorations(state) {
            return this.getState(state);
          },
        },
      }),
    ];
  },
});
