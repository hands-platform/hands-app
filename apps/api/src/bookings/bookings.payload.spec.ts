import { normalizeBookingAddress, toJson } from './bookings.payload';

describe('booking payload helpers', () => {
  it('normalizes object booking addresses while preserving the resolved address text', () => {
    expect(normalizeBookingAddress({ unit: '12A', addressText: 'old text' }, 'District 1')).toEqual({
      unit: '12A',
      addressText: 'District 1',
    });
  });

  it('normalizes string and empty booking addresses to an address text payload', () => {
    expect(normalizeBookingAddress('  District 3  ', 'District 1')).toEqual({
      addressText: 'District 3',
    });
    expect(normalizeBookingAddress(undefined, 'District 1')).toEqual({
      addressText: 'District 1',
    });
  });

  it('converts serializable values to Prisma JSON input', () => {
    expect(
      toJson({
        recordedAt: new Date('2026-06-11T00:00:00.000Z'),
        nested: { value: 1 },
      }),
    ).toEqual({
      recordedAt: '2026-06-11T00:00:00.000Z',
      nested: { value: 1 },
    });
  });
});
