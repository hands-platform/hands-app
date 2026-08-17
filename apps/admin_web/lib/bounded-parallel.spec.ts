import { mapInBatches } from './bounded-parallel';

describe('mapInBatches', () => {
  it('preserves input order while limiting concurrent work', async () => {
    let active = 0;
    let peak = 0;
    const result = await mapInBatches([1, 2, 3, 4, 5], 2, async (value) => {
      active += 1;
      peak = Math.max(peak, active);
      await Promise.resolve();
      active -= 1;
      return value * 2;
    });

    expect(result).toEqual([2, 4, 6, 8, 10]);
    expect(peak).toBe(2);
  });
});
