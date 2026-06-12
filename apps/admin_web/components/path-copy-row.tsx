import { CommandCopyRow } from './command-copy-row';

type PathCopyRowProps = {
  readonly path: string;
};

export function PathCopyRow({ path }: PathCopyRowProps) {
  return (
    <CommandCopyRow
      command={path}
      copiedLabel="Path copied"
      failedLabel="Copy path failed"
      label="Copy path"
    />
  );
}
