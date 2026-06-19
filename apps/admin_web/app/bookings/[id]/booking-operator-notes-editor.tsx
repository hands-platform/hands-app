'use client';

import type { ClipboardEvent } from 'react';
import { useRef, useState } from 'react';
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

type EditorCommand =
  | 'bold'
  | 'underline'
  | 'italic'
  | 'strikeThrough'
  | 'justifyLeft'
  | 'justifyCenter'
  | 'justifyRight'
  | 'justifyFull';

type EditorTool = {
  command: EditorCommand;
  icon: LucideIcon;
  label: string;
};

const EDITOR_TOOLS: EditorTool[] = [
  { command: 'bold', icon: Bold, label: 'Bold' },
  { command: 'underline', icon: Underline, label: 'Underline' },
  { command: 'italic', icon: Italic, label: 'Italic' },
  { command: 'strikeThrough', icon: Strikethrough, label: 'Strikethrough' },
  { command: 'justifyLeft', icon: AlignLeft, label: 'Align left' },
  { command: 'justifyCenter', icon: AlignCenter, label: 'Align center' },
  { command: 'justifyRight', icon: AlignRight, label: 'Align right' },
  { command: 'justifyFull', icon: AlignJustify, label: 'Justify' },
];

const EMPTY_COMMAND_STATE = Object.fromEntries(
  EDITOR_TOOLS.map((tool) => [tool.command, false]),
) as Record<EditorCommand, boolean>;

export function BookingOperatorNotesEditor() {
  const editorRef = useRef<HTMLDivElement>(null);
  const [note, setNote] = useState('');
  const [activeCommands, setActiveCommands] = useState(EMPTY_COMMAND_STATE);

  function syncEditorValue() {
    const text = editorRef.current?.innerText.replace(/\u00a0/g, ' ') ?? '';
    setNote(text.trim());
  }

  function syncCommandState() {
    setActiveCommands(
      Object.fromEntries(
        EDITOR_TOOLS.map((tool) => [tool.command, document.queryCommandState(tool.command)]),
      ) as Record<EditorCommand, boolean>,
    );
  }

  function runCommand(command: EditorCommand) {
    editorRef.current?.focus();
    document.execCommand(command, false);
    syncEditorValue();
    syncCommandState();
  }

  function pastePlainText(event: ClipboardEvent<HTMLDivElement>) {
    event.preventDefault();
    document.execCommand('insertText', false, event.clipboardData.getData('text/plain'));
    syncEditorValue();
  }

  return (
    <div className="vuexy-full-editor" role="group" aria-label="Operator note full editor">
      <input name="note" readOnly type="hidden" value={note} />
      <div className="vuexy-full-editor-toolbar">
        {EDITOR_TOOLS.map(({ command, icon: Icon, label }) => (
          <button
            aria-label={label}
            aria-pressed={activeCommands[command]}
            className={`vuexy-editor-tool${activeCommands[command] ? ' is-active' : ''}`}
            key={command}
            onClick={() => runCommand(command)}
            title={label}
            type="button"
          >
            <Icon aria-hidden="true" size={16} strokeWidth={2} />
          </button>
        ))}
      </div>
      <div
        aria-label="Operator note"
        aria-multiline="true"
        className="vuexy-full-editor-content"
        contentEditable
        data-empty={note.length === 0}
        data-placeholder="Example: Called Partner, confirmed arrival in 15 minutes."
        onBlur={syncEditorValue}
        onInput={syncEditorValue}
        onKeyUp={syncCommandState}
        onMouseUp={syncCommandState}
        onPaste={pastePlainText}
        ref={editorRef}
        role="textbox"
        suppressContentEditableWarning
      />
    </div>
  );
}
