import { Role } from '@prisma/client';
import {
  isRoleNeutralNotificationType,
  notificationDataWithTargetRole,
  notificationTargetRole,
  pushDeviceMatchesTargetRole,
} from './notification-target-role';

describe('notification target role helpers', () => {
  it('stores and reads explicit target role metadata', () => {
    const data = notificationDataWithTargetRole({ bookingId: 'booking-1' }, Role.PROVIDER);

    expect(data).toEqual({ bookingId: 'booking-1', targetRole: Role.PROVIDER });
    expect(notificationTargetRole({ type: 'booking.matched', data })).toBe(Role.PROVIDER);
  });

  it('falls back to conservative legacy notification type inference', () => {
    expect(notificationTargetRole({ type: 'earning.created' })).toBe(Role.PROVIDER);
    expect(notificationTargetRole({ type: 'payment.updated' })).toBe(Role.CUSTOMER);
  });

  it('does not infer ambiguous booking, service, or chat notification types', () => {
    expect(notificationTargetRole({ type: 'booking.matched' })).toBeNull();
    expect(notificationTargetRole({ type: 'service.started' })).toBeNull();
    expect(notificationTargetRole({ type: 'chat.message.created' })).toBeNull();
  });

  it('matches devices only when a target role is known', () => {
    expect(pushDeviceMatchesTargetRole({ role: Role.PROVIDER }, Role.PROVIDER)).toBe(true);
    expect(pushDeviceMatchesTargetRole({ role: Role.CUSTOMER }, Role.PROVIDER)).toBe(false);
    expect(pushDeviceMatchesTargetRole({ role: Role.CUSTOMER }, null)).toBe(false);
  });

  it('recognizes only explicit role-neutral notification types', () => {
    expect(isRoleNeutralNotificationType('system.notice')).toBe(true);
    expect(isRoleNeutralNotificationType('chat.message.created')).toBe(false);
    expect(isRoleNeutralNotificationType(undefined)).toBe(false);
  });
});
