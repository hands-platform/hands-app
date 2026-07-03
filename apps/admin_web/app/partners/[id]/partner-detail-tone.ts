import type { StatusBadgeTone } from '../../../components/status-badge';

export type PartnerOpsTone = 'blocked' | 'done' | 'pending';

export function partnerOpsStatusBadgeTone(tone: PartnerOpsTone): StatusBadgeTone {
  if (tone === 'done') return 'success';
  if (tone === 'blocked') return 'danger';
  return 'warning';
}

export function partnerOpsPillClass(tone: PartnerOpsTone) {
  if (tone === 'done') return 'pill-success';
  if (tone === 'blocked') return 'pill-danger';
  return 'pill-warn';
}

export function partnerOpsCardClass(tone: PartnerOpsTone) {
  if (tone === 'done') return 'ops-task-done';
  if (tone === 'blocked') return 'ops-task-blocked';
  return 'ops-task-pending';
}

export function partnerOpsStepLabel(tone: PartnerOpsTone) {
  if (tone === 'done') return 'Clear';
  if (tone === 'blocked') return 'Blocks booking';
  return 'Operator check';
}
