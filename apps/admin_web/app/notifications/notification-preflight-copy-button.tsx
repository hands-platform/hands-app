'use client';

import { Check, Copy } from 'lucide-react';
import { useEffect, useState } from 'react';

const COPY_STATE_RESET_MS = 1600;

type NotificationPreflightCopyButtonProps = {
  readonly command: string;
};

export function NotificationPreflightCopyButton({ command }: NotificationPreflightCopyButtonProps) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');

  useEffect(() => {
    if (copyState === 'idle') {
      return undefined;
    }
    const timeout = window.setTimeout(() => setCopyState('idle'), COPY_STATE_RESET_MS);
    return () => window.clearTimeout(timeout);
  }, [copyState]);

  async function copyCommand() {
    try {
      await navigator.clipboard.writeText(command);
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
  }

  const Icon = copyState === 'copied' ? Check : Copy;
  const label =
    copyState === 'copied'
      ? 'Preflight command copied'
      : copyState === 'failed'
        ? 'Copy preflight command failed'
        : 'Copy preflight command';

  return (
    <button
      aria-label={label}
      className={`command-copy-button${copyState === 'copied' ? ' is-copied' : ''}${
        copyState === 'failed' ? ' is-failed' : ''
      }`}
      onClick={copyCommand}
      title={label}
      type="button"
    >
      <Icon aria-hidden="true" size={16} strokeWidth={2.4} />
    </button>
  );
}
