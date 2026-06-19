'use client';

import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Image as ImageIcon,
  Italic,
  Palette,
  Strikethrough,
  Underline,
  type LucideIcon,
} from 'lucide-react';
import { Bold as BoldExtension } from '@tiptap/extension-bold';
import { Color } from '@tiptap/extension-color';
import { Image as TiptapImage } from '@tiptap/extension-image';
import { Italic as ItalicExtension } from '@tiptap/extension-italic';
import { Placeholder } from '@tiptap/extension-placeholder';
import { Strike } from '@tiptap/extension-strike';
import { TextAlign } from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
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

const DEFAULT_TEXT_COLOR = '#7367f0';
const TEXT_COLOR_SWATCHES = [
  { label: 'Purple', value: '#7367f0' },
  { label: 'Red', value: '#ff4c51' },
  { label: 'Orange', value: '#ff9f43' },
  { label: 'Green', value: '#28c76f' },
  { label: 'Slate', value: '#4b465c' },
] as const;

type TiptapJsonNode = {
  attrs?: {
    src?: unknown;
  };
  content?: TiptapJsonNode[];
  type?: string;
};

function collectImageUrls(node: TiptapJsonNode): string[] {
  const urls =
    node.type === 'image' && typeof node.attrs?.src === 'string' ? [node.attrs.src] : [];

  if (!Array.isArray(node.content)) {
    return urls;
  }

  return [...urls, ...node.content.flatMap(collectImageUrls)];
}

function getNoteValue(editor: Editor) {
  const text = editor.getText().trim();
  const imageLines = collectImageUrls(editor.getJSON()).map((src) => `[image] ${src}`);

  return [text, ...imageLines].filter(Boolean).join('\n').trim();
}

export function BookingOperatorNotesEditor() {
  const [imageUrl, setImageUrl] = useState('');
  const [note, setNote] = useState('');
  const [textColor, setTextColor] = useState(DEFAULT_TEXT_COLOR);

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
      TextStyle,
      Color,
      TiptapImage.configure({
        allowBase64: false,
        HTMLAttributes: {
          class: 'vuexy-editor-image',
        },
        inline: false,
      }),
      BoldExtension,
      ItalicExtension,
      Strike,
      UnderlineExtension,
    ],
    immediatelyRender: false,
    onUpdate: ({ editor: currentEditor }) => {
      setNote(getNoteValue(currentEditor));
    },
  });

  function syncNoteValue(currentEditor: Editor) {
    setNote(getNoteValue(currentEditor));
  }

  function insertImage() {
    if (!editor) {
      return;
    }

    const src = imageUrl.trim();

    if (!src) {
      return;
    }

    editor.chain().focus().setImage({ src }).run();
    syncNoteValue(editor);
    setImageUrl('');
  }

  function applyTextColor(nextColor: string) {
    setTextColor(nextColor);

    if (editor) {
      editor.chain().focus().setColor(nextColor).run();
      syncNoteValue(editor);
    }
  }

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
                syncNoteValue(editor);
              }
            }}
            title={label}
            type="button"
          >
            <Icon aria-hidden="true" size={16} strokeWidth={2} />
          </button>
        ))}
        <label className="vuexy-editor-color-tool" title="Text color">
          <Palette aria-hidden="true" size={16} strokeWidth={2} />
          <span className="sr-only">Text color</span>
          <span className="vuexy-editor-color-swatch" style={{ backgroundColor: textColor }} />
          <input
            aria-label="Text color"
            className="vuexy-editor-color-input"
            disabled={!editor}
            onChange={(event) => {
              applyTextColor(event.target.value);
            }}
            type="color"
            value={textColor}
          />
        </label>
        <div className="vuexy-editor-color-palette" aria-label="Preset text colors">
          {TEXT_COLOR_SWATCHES.map(({ label, value }) => (
            <button
              aria-label={`Apply text color ${label}`}
              className={`vuexy-editor-swatch${textColor === value ? ' is-active' : ''}`}
              disabled={!editor}
              key={value}
              onClick={() => applyTextColor(value)}
              style={{ backgroundColor: value }}
              title={label}
              type="button"
            />
          ))}
        </div>
      </div>
      <div className="vuexy-editor-media-row">
        <div className="vuexy-editor-media-input-wrap">
          <ImageIcon aria-hidden="true" size={16} strokeWidth={2} />
          <input
            aria-label="Image URL"
            className="vuexy-editor-image-url"
            disabled={!editor}
            onChange={(event) => setImageUrl(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                insertImage();
              }
            }}
            placeholder="Image URL"
            type="url"
            value={imageUrl}
          />
        </div>
        <button
          className="vuexy-editor-insert-button"
          disabled={!editor || !imageUrl.trim()}
          onClick={insertImage}
          type="button"
        >
          <ImageIcon aria-hidden="true" size={16} strokeWidth={2} />
          Insert image
        </button>
      </div>
      <EditorContent editor={editor} className="vuexy-full-editor-content" />
    </div>
  );
}
