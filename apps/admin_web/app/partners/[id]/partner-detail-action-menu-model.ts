import type { ActionMenuItem } from '../../../components/action-menu';
import {
  approvePartnerForOperationsDescription,
  blockPartnerAccountDescription,
  rejectPartnerForOperationsDescription,
  unblockPartnerAccountDescription,
} from '../partner-action-copy';
import { partnerAccountActionConfirmHref } from '../partner-account-action-confirmation';
import {
  type PartnerDecisionQueue,
  withPartnerDecisionQueue,
} from '../partner-review-mode';
import {
  type PartnerReviewConfirmationAction,
  partnerReviewActionConfirmHref,
} from '../partner-review-action-confirmation';
import { partnerDeviceActionConfirmHref } from './partner-detail-device-action-confirmation';
import { partnerDetailWorkspaceHref } from './partner-detail-workspace-model';

export type PartnerDetailAccountActionSubject = {
  readonly blocked: boolean;
  readonly id: string;
  readonly kycStatus?: string | null;
  readonly profileComplete: boolean;
  readonly verificationStatus?: string | null;
};

export type PartnerDetailDeviceActionSubject = {
  readonly blocked: boolean;
  readonly enabled: boolean;
  readonly id: string;
};

export function partnerDetailReviewActionConfirmHref(
  providerId: string,
  action: PartnerReviewConfirmationAction,
  target: {
    readonly bankAccountId?: string;
    readonly documentId?: string;
    readonly fileId?: string;
  } = {},
) {
  return partnerReviewActionConfirmHref(providerId, action, target, {
    baseHref: partnerDetailWorkspaceHref(providerId, 'dossier'),
  });
}

export function buildPartnerDetailAccountActionMenuItems(
  subject: PartnerDetailAccountActionSubject,
  decisionQueue: PartnerDecisionQueue | null,
): readonly ActionMenuItem[] {
  const detailBaseHref = withPartnerDecisionQueue(
    partnerDetailWorkspaceHref(subject.id, 'control'),
    decisionQueue,
  );
  const alreadyApproved = subject.verificationStatus === 'APPROVED';
  const approveDisabled =
    alreadyApproved || !subject.profileComplete || subject.kycStatus !== 'APPROVED';
  const approveDescription = alreadyApproved
    ? 'This Partner is already approved. Use reject or account controls only when a new operational issue exists.'
    : !subject.profileComplete
      ? 'Required Partner profile fields must be completed before approval.'
      : subject.kycStatus !== 'APPROVED'
        ? 'KYC must be approved before Partner activation.'
        : approvePartnerForOperationsDescription;
  const actions: ActionMenuItem[] = [
    {
      description: approveDescription,
      disabled: approveDisabled,
      href: partnerAccountActionConfirmHref(subject.id, 'approve', { baseHref: detailBaseHref }),
      kind: 'link',
      label: alreadyApproved ? 'Partner approved' : 'Approve partner',
      tone: 'success',
    },
    {
      description: rejectPartnerForOperationsDescription,
      disabled: subject.verificationStatus === 'REJECTED',
      href: partnerAccountActionConfirmHref(subject.id, 'reject', { baseHref: detailBaseHref }),
      kind: 'link',
      label: 'Reject partner',
      tone: 'danger',
    },
  ];

  actions.push(
    subject.blocked
      ? {
          description: unblockPartnerAccountDescription,
          href: partnerAccountActionConfirmHref(subject.id, 'unblock', {
            baseHref: detailBaseHref,
          }),
          kind: 'link',
          label: 'Unblock account',
          tone: 'warning',
        }
      : {
          description: blockPartnerAccountDescription,
          href: partnerAccountActionConfirmHref(subject.id, 'block', {
            baseHref: detailBaseHref,
          }),
          kind: 'link',
          label: 'Block account',
          tone: 'danger',
        },
  );

  return actions;
}

export function buildPartnerDetailDeviceActionMenuItems(
  providerId: string,
  device: PartnerDetailDeviceActionSubject,
): readonly ActionMenuItem[] {
  if (device.blocked || !device.enabled) {
    return [
      {
        description: 'Review before unblocking this Partner app device.',
        href: partnerDeviceActionConfirmHref(providerId, 'unblock-device', device.id),
        kind: 'link',
        label: 'Unblock',
        tone: 'warning',
      },
    ];
  }

  return [
    {
      description: 'Review and enter a device block reason before blocking this Partner app device.',
      href: partnerDeviceActionConfirmHref(providerId, 'block-device', device.id),
      kind: 'link',
      label: 'Block',
      tone: 'danger',
    },
  ];
}
