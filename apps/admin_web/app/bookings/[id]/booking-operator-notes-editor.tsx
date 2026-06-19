'use client';

import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Italic,
  Strikethrough,
  Underline,
  type LucideIcon,
} from 'lucide-react';
import { Bold as BoldExtension } from '@tiptap/extension-bold';
import { Italic as ItalicExtension } from '@tiptap/extension-italic';
import { Placeholder } from '@tiptap/extension-placeholder';
import { Strike } from '@tiptap/extension-strike';
import { TextAlign } from '@tiptap/extension-text-align';
import { Underline as UnderlineExtension } from '@tiptap/extension-underline';
import type { Editor } from '@tiptap/react';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useState } from 'react';

type EditorState = {
  isBold: boolean;
  isCenterAligned: boolean;
  isItalic: boolean;
  isJustified: boolean;
  isLeftAligned: boolean;
  isRightAligned: boolean;
  isStrike: boolean;
  isUnderline: boolean;
};

type EditorTool = {
  active: keyof EditorState;
  icon: LucideIcon;
  label: string;
  run: (editor: Editor) => void;
};

const EDITOR_TOOLS: EditorTool[] = [
  {
    active: 'isBold',
    icon: Bold,
    label: 'Bold',
    run: (editor) => editor.chain().focus().toggleBold().run(),
  },
  {
    active: 'isUnderline',
    icon: Underline,
    label: 'Underline',
    run: (editor) => editor.chain().focus().toggleUnderline().run(),
  },
  {
    active: 'isItalic',
    icon: Italic,
    label: 'Italic',
    run: (editor) => editor.chain().focus().toggleItalic().run(),
  },
  {
    active: 'isStrike',
    icon: Strikethrough,
    label: 'Strikethrough',
    run: (editor) => editor.chain().focus().toggleStrike().run(),
  },
  {
    active: 'isLeftAligned',
    icon: AlignLeft,
    label: 'Align left',
    run: (editor) => editor.chain().focus().setTextAlign('left').run(),
  },
  {
    active: 'isCenterAligned',
    icon: AlignCenter,
    label: 'Align center',
    run: (editor) => editor.chain().focus().setTextAlign('center').run(),
  },
  {
    active: 'isRightAligned',
    icon: AlignRight,
    label: 'Align right',
    run: (editor) => editor.chain().focus().setTextAlign('right').run(),
  },
  {
    active: 'isJustified',
    icon: AlignJustify,
    label: 'Justify',
    run: (editor) => editor.chain().focus().setTextAlign('justify').run(),
  },
];

const EMPTY_EDITOR_STATE: EditorState = {
  isBold: false,
  isCenterAligned: false,
  isItalic: false,
  isJustified: false,
  isLeftAligned: true,
  isRightAligned: false,
  isStrike: false,
  isUnderline: false,
};

export function BookingOperatorNotesEditor() {
  const [note, setNote] = useState('');

  const editor = useEditor({
    editorProps: {
      attributes: {
        'aria-label': 'Operator note',
      },
    },
    extensions: [
      StarterKit.configure({
        bold: false,
        italic: false,
        strike: false,
        underline: false,
      }),
      Placeholder.configure({
        placeholder: 'Example: Called Partner, confirmed arrival in 15 minutes.',
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      BoldExtension,
      ItalicExtension,
      Strike,
      UnderlineExtension,
    ],
    immediatelyRender: false,
    onUpdate: ({ editor: currentEditor }) => {
      setNote(currentEditor.getText().trim());
    },
  });

  const editorState = useEditorState({
    editor,
    selector: ({ editor: currentEditor }) => {
      if (!currentEditor) {
        return EMPTY_EDITOR_STATE;
      }

      return {
        isBold: currentEditor.isActive('bold') ?? false,
        isCenterAligned: currentEditor.isActive({ textAlign: 'center' }) ?? false,
        isItalic: currentEditor.isActive('italic') ?? false,
        isJustified: currentEditor.isActive({ textAlign: 'justify' }) ?? false,
        isLeftAligned: currentEditor.isActive({ textAlign: 'left' }) ?? false,
        isRightAligned: currentEditor.isActive({ textAlign: 'right' }) ?? false,
        isStrike: currentEditor.isActive('strike') ?? false,
        isUnderline: currentEditor.isActive('underline') ?? false,
      };
    },
  });

  return (
    <div className="vuexy-full-editor" role="group" aria-label="Operator note full editor">
      <input name="note" readOnly type="hidden" value={note} />
      <div className="vuexy-full-editor-toolbar">
        {EDITOR_TOOLS.map(({ active, icon: Icon, label, run }) => (
          <button
            aria-label={label}
            aria-pressed={Boolean(editorState?.[active])}
            className={`vuexy-editor-tool${editorState?.[active] ? ' is-active' : ''}`}
            disabled={!editor}
            key={label}
            onClick={() => {
              if (editor) {
                run(editor);
                setNote(editor.getText().trim());
              }
            }}
            title={label}
            type="button"
          >
            <Icon aria-hidden="true" size={16} strokeWidth={2} />
          </button>
        ))}
      </div>
      <EditorContent editor={editor} className="vuexy-full-editor-content" />
    </div>
  );
}
