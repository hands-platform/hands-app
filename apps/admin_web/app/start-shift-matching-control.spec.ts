import { buildMatchingControlRoom } from './start-shift-matching-control';

describe('Start Shift matching control', () => {
  it('uses safe live defaults when no detailed booking or Partner rows are loaded', () => {
    const result = buildMatchingControlRoom([], [], [], {
      online: 3,
      onlineAvailable: 2,
      staleLocation: 0,
    });

    expect(result.healthLabel).toBe('Stable');
    expect(result.openRows).toEqual([]);
    expect(result.metrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Open matching', value: '0' }),
        expect.objectContaining({ label: 'Policy timer', value: '10 min live' }),
        expect.objectContaining({ label: 'Marketplace radius', value: '10 km' }),
        expect.objectContaining({ label: 'Fresh online supply', value: '2' }),
      ]),
    );
  });
});
