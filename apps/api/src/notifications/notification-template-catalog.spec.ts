import { Role } from '@prisma/client';
import {
  DEFAULT_NOTIFICATION_TEMPLATES,
  NOTIFICATION_TEMPLATE_LOCALES,
  isNotificationTemplateLocale,
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
        expect.objectContaining({ key: 'admin.push.broadcast' }),
      ]),
    );
    for (const template of DEFAULT_NOTIFICATION_TEMPLATES) {
      expect(template.key).toMatch(/^[a-z0-9_.-]+$/);
      expect(template.title.trim()).toBeTruthy();
      expect(template.body.trim()).toBeTruthy();
      expect(['IN_APP', 'PUSH', 'BOTH']).toContain(template.channel);
    }
  });
});
