import { CommandCopyButton } from './command-copy-button';

type CommandCopyRowProps = {
  readonly command: string;
  readonly copiedLabel?: string;
  readonly failedLabel?: string;
  readonly label?: string;
};

export function CommandCopyRow({ command, copiedLabel, failedLabel, label }: CommandCopyRowProps) {
  return (
    <div className="command-copy-row">
      <code>{command}</code>
      <CommandCopyButton
        copiedLabel={copiedLabel}
        failedLabel={failedLabel}
        label={label}
        value={command}
      />
    </div>
  );
}
