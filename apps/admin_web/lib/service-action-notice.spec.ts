import { serviceActionNotice } from './service-action-notice';

describe('service action notice', () => {
  it('returns saved notice copy for known service actions', () => {
    expect(
      serviceActionNotice({
        reason: 'duration-set-created',
        status: 'saved',
      }),
    ).toEqual({
      detail: 'The service type was created with the valid duration options that passed pricing checks.',
      title: 'Duration set created',
      tone: 'success',
    });
  });

  it('returns blocked notice copy for known validation failures', () => {
    expect(
      serviceActionNotice({
        reason: 'invalid-payout',
        status: 'blocked',
      }),
    ).toEqual({
      detail: 'Partner payout cannot be greater than the customer price for the same service option.',
      title: 'Partner payout is too high',
      tone: 'danger',
    });
  });

  it('links a group command receipt to its exact audit target', () => {
    expect(
      serviceActionNotice({
        group: 'foot',
        reason: 'service-menu-published',
        status: 'saved',
      }),
    ).toMatchObject({
      actionHref: '/services?evidence=foot',
      actionLabel: 'Open service change evidence',
      title: 'Service group published',
    });
  });

  it('returns stable fallbacks for unknown reasons and ignores unknown statuses', () => {
    expect(serviceActionNotice({ reason: 'unknown', status: 'saved' })?.title).toBe(
      'Service option updated',
    );
    expect(serviceActionNotice({ reason: 'unknown', status: 'blocked' })?.title).toBe(
      'Service action blocked',
    );
    expect(serviceActionNotice({ reason: 'service-created', status: 'ignored' })).toBeNull();
    expect(serviceActionNotice({ reason: 'service-created' })).toBeNull();
  });

  it('uses the first query value when a route param is repeated', () => {
    expect(
      serviceActionNotice({
        reason: ['service-created', 'invalid-payout'],
        status: ['saved', 'blocked'],
      })?.title,
    ).toBe('Service option created');
  });
});
