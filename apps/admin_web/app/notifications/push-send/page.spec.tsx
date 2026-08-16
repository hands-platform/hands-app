import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { vi } from 'vitest';

import { adminGetResult } from '../../../lib/admin-api';
import PushSendPage from './page';

vi.mock('../../../lib/admin-api', async () => {
  const actual = await vi.importActual<typeof import('../../../lib/admin-api')>('../../../lib/admin-api');
  return { ...actual, adminGetResult: vi.fn() };
});

const mockedAdminGetResult = vi.mocked(adminGetResult);
const composerSource = readFileSync('app/notifications/push-send/push-campaign-composer.tsx', 'utf8');
const actionSource = readFileSync('app/notifications/push-send/actions.ts', 'utf8');
const fixtureSource = readFileSync('app/notifications/push-send/push-send-browser-fixtures.ts', 'utf8');

describe('PushSendPage', () => {
  beforeEach(() => {
    mockedAdminGetResult.mockImplementation(async (_href, fallback) => ({ data: fallback, ok: true, status: 200 }));
  });

  it('renders the compact risk strip, three-step composer, and independent empty history', async () => {
    const markup = renderToStaticMarkup(await PushSendPage({ searchParams: Promise.resolve({}) }));
    expect(markup).toContain('Push campaign risk summary');
    expect(markup).toContain('Create a manual push campaign');
    expect(markup).toContain('Choose audience');
    expect(markup).toContain('Write and preview');
    expect(markup).toContain('Confirm and queue');
    expect(markup).toContain('No campaigns in this history range.');
  });

  it('does not infer a zero summary when the summary API is unavailable', async () => {
    mockedAdminGetResult
      .mockResolvedValueOnce({ data: [], ok: true, status: 200 })
      .mockResolvedValueOnce({ data: null, ok: false, status: 503 });
    const markup = renderToStaticMarkup(await PushSendPage({ searchParams: Promise.resolve({}) }));
    expect(markup).toContain('Campaign summary unavailable. History remains independent.');
    expect(markup).not.toContain('Needs attention</span><strong>0');
  });

  it('keeps copy, reason, and selected account IDs out of GET navigation', () => {
    expect(composerSource).not.toContain('name="title" type="hidden"');
    expect(composerSource).not.toContain('name="body" type="hidden"');
    expect(composerSource).not.toContain('name="targetUserId" type="hidden"');
    expect(composerSource).toContain("formData.set('targetUserId', selectedAccount.selectionId)");
    expect(actionSource).not.toContain('redirect(');
  });

  it('requires a server receipt, reason, exact SEND N confirmation, and one queue action', () => {
    expect(composerSource).toContain('Server receipt required');
    expect(composerSource).toContain('Operator reason');
    expect(composerSource).toContain('Type SEND ${preview.eligibleUsers} to confirm');
    expect(composerSource).toContain('Queue push campaign for');
    expect(composerSource).toContain('Delivery has not completed yet');
  });

  it('offers only ID-less mobile destinations and locks Partner copy to Vietnamese', () => {
    expect(composerSource).not.toContain("['chat'");
    expect(composerSource).not.toContain("['providerProfile'");
    expect(composerSource).toContain('Partner app supports Vietnamese manual push only.');
    expect(composerSource).toContain('Only ID-less list destinations');
  });

  it('keeps browser fixtures exact at copy limits and exposes distinct recovery states', () => {
    expect(fixtureSource).toContain("slice(0, 499) + '\\u2728'");
    expect(fixtureSource).toContain("slice(0, 119) + '\\u2728'");
    expect(fixtureSource).toContain("name === 'invalid-destination'");
    expect(fixtureSource).toContain("name === 'preview-expired'");
    expect(fixtureSource).toContain("name === 'queued-success'");
    expect(actionSource).toContain("message.includes('expired')");
    expect(actionSource).toContain("message.includes('consumed')");
    expect(composerSource).toContain('confirmSuccess || receiptBlocked');
    expect(composerSource).toContain('confirmationPhrase.trim() === `SEND ${preview.eligibleUsers}`');
  });
});
