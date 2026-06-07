import { bookingOpsTaskCards } from './booking-ops-task-cards';

describe('bookingOpsTaskCards', () => {
  it('returns the four required booking operator checklist cards', () => {
    const cards = bookingOpsTaskCards([], { formatDate: (value) => value ?? 'missing' });

    expect(cards.map((card) => card.type)).toEqual([
      'CUSTOMER_CONTACTED',
      'PROVIDER_CONTACTED',
      'LOCATION_CHECKED',
      'PAYMENT_REVIEWED',
    ]);
    expect(cards.every((card) => card.status === 'PENDING')).toBe(true);
    expect(cards.every((card) => card.updatedBy === 'Not checked yet')).toBe(true);
  });

  it('uses existing task state, trims note, and shows actor name', () => {
    const cards = bookingOpsTaskCards(
      [
        {
          type: 'CUSTOMER_CONTACTED',
          status: 'DONE',
          note: '  Customer confirmed address  ',
          updatedAt: '2026-06-07T10:00:00.000Z',
          actor: { fullName: 'Admin One', phone: '+84000000000' },
        },
      ],
      { formatDate: () => '07 Jun 2026 10:00' },
    );

    expect(cards[0]).toMatchObject({
      type: 'CUSTOMER_CONTACTED',
      status: 'DONE',
      note: 'Customer confirmed address',
      updatedBy: 'Updated 07 Jun 2026 10:00 by Admin One',
    });
  });

  it('falls back to actor phone and Admin label', () => {
    const phoneActorCards = bookingOpsTaskCards(
      [
        {
          type: 'PROVIDER_CONTACTED',
          status: 'DONE',
          note: '',
          updatedAt: '2026-06-07T11:00:00.000Z',
          actor: { phone: '+84123456789' },
        },
      ],
      { formatDate: () => '07 Jun 2026 11:00' },
    );
    const adminActorCards = bookingOpsTaskCards(
      [
        {
          type: 'PAYMENT_REVIEWED',
          status: 'DONE',
          note: null,
          updatedAt: '2026-06-07T12:00:00.000Z',
          actor: null,
        },
      ],
      { formatDate: () => '07 Jun 2026 12:00' },
    );

    expect(phoneActorCards[1].updatedBy).toBe('Updated 07 Jun 2026 11:00 by +84123456789');
    expect(adminActorCards[3].updatedBy).toBe('Updated 07 Jun 2026 12:00 by Admin');
  });
});
