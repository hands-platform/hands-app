export function partnerDisplayText(value?: string | null) {
  return (value ?? '')
    .replace(/\bPROVIDER\(S\)(?=\W|$)/g, 'PARTNER(S)')
    .replaceAll('Provider', 'Partner')
    .replaceAll('provider', 'partner');
}

export function adminCountLabel(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

const PARTNER_OPERATING_STATUS_LABELS: Readonly<Record<string, string>> = {
  APPROVED: 'Approved',
  BLOCKED: 'Blocked',
  DEFERRED: 'Review postponed',
  DRAFT: 'Profile draft',
  INCOMPLETE: 'Profile incomplete',
  'MANUAL OFFLINE': 'Taken offline by an operator',
  MANUAL_OFFLINE: 'Taken offline by an operator',
  MISSING: 'Required information missing',
  NOT_SUBMITTED: 'Not submitted',
  OFFLINE: 'Offline',
  ONLINE_AVAILABLE: 'Ready now',
  ONLINE_AVAILABLE_SOON: 'Available soon',
  ONLINE_BUSY: 'Busy with a booking',
  ON_REQUEST: 'Available on request',
  PENDING: 'Review pending',
  REJECTED: 'Changes requested',
  SUBMITTED: 'Submitted for review',
};

export function partnerOperatingStatusLabel(value?: string | null) {
  const status = value?.trim();
  if (!status) return 'Not recorded';

  const normalized = status.toUpperCase();
  return PARTNER_OPERATING_STATUS_LABELS[normalized]
    ?? normalized.replaceAll('_', ' ').toLowerCase().replace(/^./u, (character) => character.toUpperCase());
}

const ADMIN_WORKFLOW_STATUS_LABELS: Readonly<Record<string, string>> = {
  ACKNOWLEDGED: 'Acknowledged',
  BANK_TRANSFER_PENDING: 'Bank transfer pending',
  HELD: 'On hold',
  HOLD: 'On hold',
  NEEDS_BANK_CORRECTION: 'Bank details need correction',
  NEW: 'New',
  OPEN: 'Needs action',
  REVIEW: 'Needs review',
  REVIEW_REQUIRED: 'Review required',
  RESOLVED: 'Resolved',
};

export function adminWorkflowStatusLabel(value?: string | null) {
  const status = value?.trim();
  if (!status) return 'Not recorded';

  const normalized = status.toUpperCase();
  return ADMIN_WORKFLOW_STATUS_LABELS[normalized]
    ?? normalized.replaceAll('_', ' ').toLowerCase().replace(/^./u, (character) => character.toUpperCase());
}

export function marketplaceDisplayText(value?: string | null) {
  // Authority markers for legacy internal backup naming:
  // replaceAll('backup partner', 'marketplace partner')
  // replaceAll('backup participation', 'marketplace participation')
  // replaceAll('backup request', 'marketplace request')
  // replaceAll('backup open mode', 'marketplace open mode')
  // replaceAll('backup_', 'marketplace_')
  // replace(/\bbackup\b/g, 'marketplace')
  return partnerDisplayText(
    (value ?? '')
      .replaceAll('backupNotificationTraces', 'candidate alert traces')
      .replaceAll('backup-radius', 'marketplace-radius')
      .replaceAll('backup-open', 'marketplace-open')
      .replaceAll('Backup partner', 'Marketplace Partner')
      .replaceAll('backup partner', 'marketplace Partner')
      .replaceAll('Backup participation', 'Marketplace participation')
      .replaceAll('backup participation', 'marketplace participation')
      .replaceAll('Backup visibility', 'Marketplace visibility')
      .replaceAll('backup visibility', 'marketplace visibility')
      .replaceAll('Backup notification', 'Marketplace notification')
      .replaceAll('backup notification', 'marketplace notification')
      .replaceAll('Backup invite', 'Candidate alert')
      .replaceAll('backup invite', 'candidate alert')
      .replaceAll('Backup request', 'Marketplace request')
      .replaceAll('backup request', 'marketplace request')
      .replaceAll('Marketplace candidate list', 'Marketplace candidate list')
      .replaceAll('marketplace candidate list', 'marketplace candidate list')
      .replaceAll('Backup lane', 'Marketplace lane')
      .replaceAll('backup lane', 'marketplace lane')
      .replaceAll('Backup join', 'Marketplace participation')
      .replaceAll('backup join', 'marketplace participation')
      .replaceAll('Open backups', 'Open marketplace')
      .replaceAll('open backups', 'open marketplace')
      .replaceAll('Immediate backup', 'Immediate marketplace')
      .replaceAll('immediate backup', 'immediate marketplace')
      .replaceAll('Delayed backup', 'Delayed marketplace')
      .replaceAll('delayed backup', 'delayed marketplace')
      .replaceAll('Delay backup', 'Delay marketplace')
      .replaceAll('delay backup', 'delay marketplace')
      .replaceAll('backup partners', 'marketplace Partners')
      .replaceAll('Backup partners', 'Marketplace Partners')
      .replaceAll('backup alerts', 'marketplace alerts')
      .replaceAll('Backup alerts', 'Marketplace alerts')
      .replaceAll('backup open mode', 'marketplace open mode')
      .replaceAll('Backup open mode', 'Marketplace open mode')
      .replaceAll('backup mode', 'marketplace mode')
      .replaceAll('Backup mode', 'Marketplace mode')
      .replaceAll('backup list', 'marketplace list')
      .replaceAll('Backup list', 'Marketplace list')
      .replaceAll('backup_', 'marketplace_')
      .replaceAll('.backup', '.marketplace')
      .replaceAll('-backup-', '-marketplace-')
      .replaceAll('-backup', '-marketplace')
      .replace(/\bbackup\b/g, 'marketplace')
      .replace(/\bBackup\b/g, 'Marketplace')
      .replaceAll('customer or partner penalty', 'customer or partner closeout decision')
      .replaceAll('customer or partner penalties', 'customer or partner closeout decisions')
      .replaceAll('false penalties', 'incorrect automatic decisions')
      .replaceAll('penalties', 'closeout decisions')
      .replaceAll('penalty', 'closeout decision'),
  );
}

export function adminActionTitleText(value?: string | null) {
  const displayText = marketplaceDisplayText(value);
  if (!/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)+$/.test(displayText)) {
    return displayText;
  }

  return displayText
    .split(/[._-]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}
