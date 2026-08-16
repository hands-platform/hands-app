'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

import { AdminFormControlButton } from '../../components/admin-form-controls';

export function AuditCopyButton({ label, value }: { readonly label: string; readonly value: string }) {
  const [copied, setCopied] = useState(false);

  async function copyValue() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1_800);
  }

  return (
    <AdminFormControlButton
      className="button-secondary audit-copy-button"
      onClick={copyValue}
      type="button"
    >
      {copied ? <Check aria-hidden="true" size={15} /> : <Copy aria-hidden="true" size={15} />}
      {copied ? 'Copied' : label}
    </AdminFormControlButton>
  );
}
