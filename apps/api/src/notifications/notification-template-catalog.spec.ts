import { Role } from '@prisma/client';
import {
  DEFAULT_NOTIFICATION_TEMPLATES,
  NOTIFICATION_TEMPLATE_ROUTES,
  NOTIFICATION_TEMPLATE_LOCALES,
  isNotificationTemplateLocale,
  notificationTemplateContractErrors,
  notificationTemplateOpenBehavior,
  resolveNotificationTemplateKey,
} from './notification-template-catalog';

describe('notification template catalog', () => {
  it('keeps the editable locale set explicit', () => {
    expect(NOTIFICATION_TEMPLATE_LOCALES).toEqual(['en', 'vi', 'ko', 'ja', 'zh']);
    expect(isNotificationTemplateLocale('en')).toBe(true);
    expect(isNotificationTemplateLocale('ios')).toBe(false);
  });

  it('defines customer and partner notification copy without raw push provider coupling', () => {
    expect(DEFAULT_NOTIFICATION_TEMPLATES).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ audience: Role.CUSTOMER, key: 'booking.matched' }),
        expect.objectContaining({ audience: Role.PROVIDER, key: 'booking.requested' }),
      ]),
    );
    expect(DEFAULT_NOTIFICATION_TEMPLATES).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ key: 'admin.push.broadcast' })]),
    );
    for (const template of DEFAULT_NOTIFICATION_TEMPLATES) {
      expect(template.key).toMatch(/^[a-z0-9_.-]+$/);
      expect(template.title.trim()).toBeTruthy();
      expect(template.body.trim()).toBeTruthy();
      expect(['IN_APP', 'PUSH', 'BOTH']).toContain(template.channel);
    }
  });

  it('maps every managed event and role to one reachable catalog key', () => {
    expect(notificationTemplateContractErrors()).toEqual([]);
    expect(new Set(NOTIFICATION_TEMPLATE_ROUTES.map((route) => route.templateKey))).toEqual(
      new Set(DEFAULT_NOTIFICATION_TEMPLATES.map((template) => template.key)),
    );
    expect(resolveNotificationTemplateKey({ type: 'booking.matched', targetRole: Role.CUSTOMER })).toBe(
      'booking.matched',
    );
    expect(resolveNotificationTemplateKey({ type: 'booking.matched', targetRole: Role.PROVIDER })).toBe(
      'booking.matched.partner',
    );
    expect(resolveNotificationTemplateKey({ type: 'service.started', targetRole: Role.PROVIDER })).toBe(
      'service.started.partner',
    );
    expect(resolveNotificationTemplateKey({ type: 'chat.message.created', targetRole: Role.CUSTOMER })).toBe(
      'chat.message',
    );
  });

  it('rejects an explicit template key that conflicts with the event role route', () => {
    expect(() =>
      resolveNotificationTemplateKey({
        templateKey: 'booking.matched',
        targetRole: Role.PROVIDER,
        type: 'booking.matched',
      }),
    ).toThrow('Notification template key does not match booking.matched/PROVIDER');
  });

  it('publishes open behavior from the same catalog used by the runtime routes', () => {
    expect(notificationTemplateOpenBehavior('booking.matched')).toEqual({
      payloadKeys: ['bookingId', 'chatRoomId'],
      possibleDestinations: ['Chat', 'Booking details'],
      summary: 'Varies by payload · Chat or booking details',
      variesByPayload: true,
    });
    expect(notificationTemplateOpenBehavior('earning.created')).toMatchObject({
      possibleDestinations: ['Earnings'],
      summary: 'Earnings',
    });
    expect(notificationTemplateOpenBehavior('provider.payout_batch.updated')).toMatchObject({
      payloadKeys: ['payoutBatchId'],
      summary: 'Earnings',
    });
    expect(notificationTemplateOpenBehavior('service.started.partner')).toMatchObject({
      payloadKeys: ['bookingId', 'chatRoomId', 'destination'],
      possibleDestinations: ['Chat', 'Active jobs'],
      variesByPayload: true,
    });
  });
});
