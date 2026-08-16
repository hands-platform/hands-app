import type {
  AdminPushCampaign,
  AdminPushCampaignPreview,
  AdminPushCampaignSummary,
} from '../../../lib/admin-api';
import type {
  PushAccountCandidate,
  PushConfirmActionState,
  PushPreviewActionState,
} from './actions';

export type PushComposerBrowserFixture = {
  readonly body: string;
  readonly confirmState?: PushConfirmActionState;
  readonly destination: string;
  readonly locale: string;
  readonly previewState?: PushPreviewActionState;
  readonly role: 'CUSTOMER' | 'PROVIDER';
  readonly segment: string;
  readonly selectedAccount?: PushAccountCandidate;
  readonly title: string;
};

export type PushSendBrowserFixture = {
  readonly campaigns: readonly AdminPushCampaign[];
  readonly composer: PushComposerBrowserFixture;
  readonly pageError?: string;
  readonly summary: AdminPushCampaignSummary;
};

const GENERATED_AT = '2026-08-13T07:00:00.000Z';

export function pushSendBrowserFixture(name: string | undefined): PushSendBrowserFixture | null {
  if (process.env.NODE_ENV === 'production' || process.env.PUSH_SEND_BROWSER_FIXTURES_ENABLED !== '1') {
    return null;
  }
  const fixtureName = name || 'customers-default';
  const composer = composerFixture(fixtureName);
  const campaigns = fixtureName === 'partial-history'
    ? [campaignFixture('PARTIAL_FAILED'), campaignFixture('COMPLETED'), campaignFixture('PROCESSING')]
    : fixtureName === 'queued-success'
      ? [campaignFixture('QUEUED')]
      : [campaignFixture('COMPLETED')];
  const needsAttention = campaigns.filter((campaign) => ['FAILED', 'PARTIAL_FAILED'].includes(campaign.status)).length;
  return {
    campaigns,
    composer,
    ...(fixtureName === 'permission-denied'
      ? { pageError: 'You do not have the exact NOTIFICATIONS_PUSH permission required for this elevated-risk operation.' }
      : {}),
    summary: {
      deliveredDevices: campaigns.reduce((sum, campaign) => sum + campaign.deliveredDeviceCount, 0),
      eligibleDevices: campaigns.reduce((sum, campaign) => sum + campaign.eligibleDeviceCount, 0),
      failedDevices: campaigns.reduce((sum, campaign) => sum + campaign.failedDeviceCount, 0),
      generatedAt: GENERATED_AT,
      lastCompletedAt: campaigns.find((campaign) => campaign.completedAt)?.completedAt ?? null,
      needsAttention,
      pendingDevices: campaigns.reduce((sum, campaign) => sum + campaign.pendingDeviceCount, 0),
      queuedOrProcessing: campaigns.filter((campaign) => ['QUEUED', 'PROCESSING'].includes(campaign.status)).length,
      skippedDevices: campaigns.reduce((sum, campaign) => sum + campaign.skippedDeviceCount, 0),
      totalCount: campaigns.length,
      totalNotifications: campaigns.reduce((sum, campaign) => sum + campaign.notificationCount, 0),
      totalRecipients: campaigns.reduce((sum, campaign) => sum + campaign.recipientCount, 0),
    },
  };
}

function composerFixture(name: string): PushComposerBrowserFixture {
  const provider = name === 'partners-default';
  const base: PushComposerBrowserFixture = {
    body: provider
      ? 'Lịch hoạt động hôm nay đã được cập nhật. Mở HANDS để xem thông tin mới nhất.'
      : 'Your reviewed HANDS service update is ready. Open the app for the latest details.',
    destination: provider ? 'jobs' : 'notificationCenter',
    locale: provider ? 'vi' : 'en',
    role: provider ? 'PROVIDER' : 'CUSTOMER',
    segment: 'all',
    title: provider ? 'Cập nhật hoạt động HANDS' : 'Your HANDS update',
  };
  if (name === 'customers-default' || name === 'partners-default' || name === 'permission-denied') return base;
  if (name === 'queue-error') {
    return {
      ...base,
      confirmState: { status: 'error', error: 'Queue unavailable. Draft preserved; retry uses the same request key.' },
      previewState: readyPreviewState(1),
    };
  }
  if (name === 'preview-expired') {
    return {
      ...base,
      confirmState: { status: 'error', error: 'Preview expired. Create and review a new preview before queueing.' },
      previewState: readyPreviewState(1),
    };
  }
  if (name === 'queued-success') {
    return {
      ...base,
      confirmState: { status: 'success', campaign: campaignFixture('QUEUED') },
      previewState: readyPreviewState(1),
    };
  }
  if (name === 'invalid-destination') {
    return { ...base, previewState: previewState(1, 1, 'INVALID_DESTINATION') };
  }
  if (name === 'max-copy') {
    const bodyPattern = '\uC608\uC57D \uC0C1\uD0DC\uB97C \uC548\uC804\uD558\uAC8C \uD655\uC778\uD574 \uC8FC\uC138\uC694. C\u1EADp nh\u1EADt d\u1ECBch v\u1EE5. \u91CD\u8981\u306A\u304A\u77E5\u3089\u305B. ';
    const titlePattern = '\u91CD\u8981\u306A\u304A\u77E5\u3089\u305B \u00B7 \uC608\uC57D \uC0C1\uD0DC \uD655\uC778 \u00B7 C\u1EADp nh\u1EADt d\u1ECBch v\u1EE5 \u00B7 ';
    const maximumBody = bodyPattern.repeat(Math.ceil(500 / bodyPattern.length)).slice(0, 499) + '\u2728';
    const maximumTitle = titlePattern.repeat(Math.ceil(120 / titlePattern.length)).slice(0, 119) + '\u2728';
    return {
      ...base,
      body: maximumBody,
      title: maximumTitle,
      previewState: readyPreviewState(1),
    };
  }
  if (name === 'specific-account') {
    return {
      ...base,
      previewState: readyPreviewState(1),
      selectedAccount: {
        accountStatus: 'Customer account',
        displayLabel: 'Minh A.',
        maskedPhone: '+84******21',
        selectionId: '',
      },
    };
  }
  if (name === 'zero') return { ...base, previewState: previewState(0, 0, 'ZERO_RECIPIENTS') };
  if (name === 'blocked-101') return { ...base, previewState: previewState(101, 118, 'OVER_LIMIT') };
  if (name === 'mismatch') {
    return {
      ...base,
      previewState: previewState(12, 14, 'READY', [
        { code: 'DEVICE_LOCALE_MISMATCH', count: 7, label: 'Enabled devices registered for another language' },
        { code: 'DEVICE_ROLE_MISMATCH', count: 3, label: 'Enabled devices registered for another app role' },
      ]),
    };
  }
  if (name === 'ready-100') return { ...base, previewState: readyPreviewState(100) };
  return { ...base, previewState: readyPreviewState(1) };
}

function readyPreviewState(count: number): PushPreviewActionState {
  return previewState(count, count === 100 ? 126 : count, 'READY');
}

function previewState(
  eligibleUsers: number,
  eligibleDevices: number,
  state: AdminPushCampaignPreview['state'],
  exclusions: AdminPushCampaignPreview['exclusions'] = [],
): PushPreviewActionState {
  return {
    draftRevision: '0',
    idempotencyKey: 'fixture_idempotency_key_not_submitted',
    preview: {
      destination: {
        label: 'Notification center',
        mode: 'LIST',
        targetSummary: 'Customer app · Notification center',
        value: 'notificationCenter',
      },
      eligibleDevices,
      eligibleUsers,
      excludedDevices: exclusions.reduce((sum, item) => sum + item.count, 0),
      excludedUsers: exclusions.length ? 4 : 0,
      exclusions,
      expiresAt: '2099-08-13T08:15:00.000Z',
      locale: 'en',
      manualUserLimit: 100,
      previewId: 'fixture-preview-not-submitted',
      sampleRecipients: eligibleUsers > 0 ? [{
        displayLabel: 'Masked customer sample',
        lastActiveAt: GENERATED_AT,
        maskedPhone: '+84******21',
        platform: 'android',
      }] : [],
      state,
      targetRole: 'CUSTOMER',
      targetSegment: 'all',
    },
    status: 'success',
  };
}

function campaignFixture(status: 'COMPLETED' | 'PARTIAL_FAILED' | 'PROCESSING' | 'QUEUED'): AdminPushCampaign {
  const partial = status === 'PARTIAL_FAILED';
  const processing = status === 'PROCESSING';
  const queued = status === 'QUEUED';
  return {
    appDestination: 'notificationCenter',
    body: partial
      ? 'This campaign retained a provider delivery failure for operator review.'
      : 'Your reviewed HANDS service update is ready.',
    completedAt: processing || queued ? null : '2026-08-13T07:04:00.000Z',
    confirmedAt: '2026-08-13T07:00:30.000Z',
    createdAt: GENERATED_AT,
    deliveredDeviceCount: partial ? 10 : processing ? 8 : queued ? 0 : 24,
    eligibleDeviceCount: partial ? 12 : processing ? 18 : queued ? 1 : 24,
    excludedDeviceCount: partial ? 3 : 0,
    excludedUserCount: partial ? 2 : 0,
    failedAt: partial ? '2026-08-13T07:04:00.000Z' : null,
    failedDeviceCount: partial ? 2 : 0,
    id: `campaign-fixture-${status.toLowerCase()}`,
    locale: 'en',
    notificationCount: partial ? 11 : processing ? 15 : queued ? 0 : 20,
    operatorReason: 'Reviewed service communication approved by operations.',
    pendingDeviceCount: processing ? 10 : queued ? 1 : 0,
    processingAt: queued ? null : '2026-08-13T07:01:00.000Z',
    queueJobId: `queue-fixture-${status.toLowerCase()}`,
    queuedAt: '2026-08-13T07:00:45.000Z',
    recipientCount: partial ? 11 : processing ? 15 : queued ? 1 : 20,
    skippedDeviceCount: 0,
    status,
    targetRole: 'CUSTOMER',
    targetSegment: 'all',
    title: partial ? 'Delivery review required' : 'HANDS service update',
  };
}
