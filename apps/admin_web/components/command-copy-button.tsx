'use client';

import { Check, Copy } from 'lucide-react';
import { useEffect, useState } from 'react';

import { AdminIconButton } from './admin-icon-button';

const COPY_STATE_RESET_MS = 1600;

type CommandCopyButtonProps = {
  readonly copiedLabel?: string;
  readonly failedLabel?: string;
  readonly label?: string;
  readonly value: string;
};

export function CommandCopyButton({
  copiedLabel = 'Command copied',
  failedLabel = 'Copy command failed',
  label = 'Copy command',
  value,
}: CommandCopyButtonProps) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');

  useEffect(() => {
    if (copyState === 'idle') {
      return undefined;
    }
    const timeout = window.setTimeout(() => setCopyState('idle'), COPY_STATE_RESET_MS);
    return () => window.clearTimeout(timeout);
  }, [copyState]);

  async function copyValue() {
    try {
      await navigator.clipboard.writeText(value);
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
  }

  const Icon = copyState === 'copied' ? Check : Copy;
  const accessibleLabel = copyState === 'copied' ? copiedLabel : copyState === 'failed' ? failedLabel : label;

  return (
    <AdminIconButton
      aria-label={accessibleLabel}
      className={`command-copy-button${copyState === 'copied' ? ' is-copied' : ''}${
        copyState === 'failed' ? ' is-failed' : ''
      }`}
      onClick={copyValue}
      title={accessibleLabel}
      type="button"
    >
      <Icon aria-hidden="true" size={16} strokeWidth={2.4} />
    </AdminIconButton>
  );
}
