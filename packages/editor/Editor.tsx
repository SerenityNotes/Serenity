import "./editor-output.css";
import "./awareness.css";
import React from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { tw, View } from "@serenity-tools/ui";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import { Level } from "@tiptap/extension-heading";
import Collaboration from "@tiptap/extension-collaboration";
import * as Y from "yjs";
import { Awareness } from "y-protocols/awareness";
import { AwarnessExtension } from "./naisho-awareness-extension";
import EditorButton from "./components/editorButton/EditorButton";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import EditorSidebar from "./components/editorSidebar/EditorSidebar";
import { useHasSidebar } from "./hooks/useHasSidebar";

type EditorProps = {
  yDocRef: React.MutableRefObject<Y.Doc>;
  yAwarenessRef?: React.MutableRefObject<Awareness>;
};

const headingLevels: Level[] = [1, 2, 3];

// dummy element - remove when using sidesheet
const Divider = () => {
  return <div className="w-0 border-l border-solid border-gray-600"></div>;
};

export const Editor = (props: EditorProps) => {
  const [wrapperRef, hasSidebar] = useHasSidebar();

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // the Collaboration extension comes with its own history handling
        history: false,
        code: {
          HTMLAttributes: {
            // using py-0.5 so that code elements in adjacent lines don't overlap
            class: "py-0.5 px-1.5 bg-gray-200 rounded",
          },
        },
        codeBlock: {
          HTMLAttributes: {
            class: "my-4 p-4 bg-gray-100 rounded",
          },
        },
        heading: {
          levels: headingLevels,
        },
      }),
      Link.configure({
        openOnClick: false,
      }),
      TaskList,
      TaskItem,
      // register the ydoc with Tiptap
      Collaboration.configure({
        document: props.yDocRef.current,
        field: "page",
      }),
      AwarnessExtension.configure({ awareness: props.yAwarenessRef?.current }),
    ],
  });

  return (
    <div className="flex flex-auto flex-row" ref={wrapperRef}>
      <View style={tw`flex-auto text-gray-900 dark:text-white`}>
        <View>
          <div className="flex space-x-1 p-1">
            {headingLevels.map((lvl) => {
              return (
                <EditorButton
                  key={lvl}
                  onClick={() =>
                    editor?.chain().focus().toggleHeading({ level: lvl }).run()
                  }
                  isActive={
                    editor?.isActive("heading", { level: lvl }) || false
                  }
                >
                  H{lvl}
                </EditorButton>
              );
            })}
            <Divider></Divider>
            <EditorButton
              onClick={() => editor?.chain().focus().toggleBold().run()}
              isActive={editor?.isActive("bold") || false}
            >
              B
            </EditorButton>
            <EditorButton
              onClick={() => editor?.chain().focus().toggleItalic().run()}
              isActive={editor?.isActive("italic") || false}
            >
              I
            </EditorButton>
            {/* styling dummy */}
            <EditorButton
              onClick={() =>
                editor?.chain().focus().toggleLink({ href: "#" }).run()
              }
              isActive={editor?.isActive("link") || false}
            >
              L
            </EditorButton>
            <Divider></Divider>
            <EditorButton
              onClick={() => editor?.chain().focus().toggleCode().run()}
              isActive={editor?.isActive("code") || false}
            >
              C
            </EditorButton>
            <EditorButton
              onClick={() => editor?.chain().focus().toggleCodeBlock().run()}
              isActive={editor?.isActive("codeBlock") || false}
            >
              K
            </EditorButton>
            <Divider></Divider>
            <EditorButton
              onClick={() => editor?.chain().focus().toggleBlockquote().run()}
              isActive={editor?.isActive("blockquote") || false}
            >
              Q
            </EditorButton>
            <Divider></Divider>
            <EditorButton
              onClick={() => editor?.chain().focus().toggleBulletList().run()}
              isActive={editor?.isActive("bulletList") || false}
            >
              &sdot;
            </EditorButton>
            <EditorButton
              onClick={() => editor?.chain().focus().toggleOrderedList().run()}
              isActive={editor?.isActive("orderedList") || false}
            >
              1
            </EditorButton>
            <EditorButton
              onClick={() => editor?.chain().focus().toggleTaskList().run()}
              isActive={editor?.isActive("taskList") || false}
            >
              T
            </EditorButton>
          </div>
        </View>
        <div className="flex-auto overflow-y-auto overflow-x-hidden px-4 py-10 xs:px-6 sm:px-10 md:py-14 lg:px-16">
          <EditorContent editor={editor} />
        </div>
      </View>
      {hasSidebar && <EditorSidebar />}
    </div>
  );
};
