import {
  adminAppSessionListSelect,
  adminNotificationBoardListSelect,
  adminNotificationListSelect,
  adminPushDeviceSummarySelect,
  adminUserAuthSelect,
  adminUserIdentitySelect,
  adminUserListSelect,
  adminUserSummarySelect,
} from './admin-user-selects';

describe('admin user selects', () => {
  it('keeps user summary and auth selects explicit', () => {
    expect(adminUserSummarySelect).toMatchObject({
      id: true,
      phone: true,
      email: true,
      fullName: true,
      roles: true,
    });
    expect(adminUserAuthSelect).toMatchObject({
      ...adminUserSummarySelect,
      supabaseUserId: true,
    });
    expect(adminUserIdentitySelect).toEqual({
      id: true,
      phone: true,
      fullName: true,
    });
  });

  it('keeps push delivery summaries bounded for user surfaces', () => {
    expect(adminPushDeviceSummarySelect.deliveries).toMatchObject({
      orderBy: { attemptedAt: 'desc' },
      take: 1,
    });
    expect(adminUserListSelect.pushDevices).toMatchObject({
      orderBy: { updatedAt: 'desc' },
      take: 3,
    });
  });

  it('keeps notification and app session list selects connected to safe user summaries', () => {
    expect(adminNotificationListSelect).toMatchObject({
      user: { select: expect.objectContaining({ id: true, phone: true }) },
      deliveries: expect.objectContaining({ orderBy: { attemptedAt: 'desc' }, take: 10 }),
    });
    expect(adminNotificationBoardListSelect).toMatchObject({
      user: { select: expect.objectContaining({ id: true, phone: true }) },
      deliveries: expect.objectContaining({ orderBy: { attemptedAt: 'desc' }, take: 10 }),
    });
    expect(adminAppSessionListSelect.user.select).toMatchObject({
      phone: true,
      pushDevices: expect.objectContaining({ take: 3 }),
    });
    expect(adminAppSessionListSelect).not.toHaveProperty('createdAt');
    expect(adminAppSessionListSelect).not.toHaveProperty('updatedAt');
    expect(adminAppSessionListSelect.user.select).not.toHaveProperty('email');
    expect(adminAppSessionListSelect.user.select).not.toHaveProperty('roles');
    expect(adminAppSessionListSelect.user.select.customerProfile.select).toEqual({ id: true });
    expect(adminAppSessionListSelect.user.select.providerProfile.select).toEqual({
      id: true,
      displayName: true,
    });
    expect(adminAppSessionListSelect.user.select.pushDevices.select).toEqual({
      id: true,
      platform: true,
      enabled: true,
      lastSeenAt: true,
    });
  });
});
