import { formatDistance } from './policy-distance-format';

describe('policy distance format', () => {
  it('keeps compact metric labels used by Operations Policy evidence', () => {
    expect(formatDistance(500)).toBe('500 m');
    expect(formatDistance(12345)).toBe('12.3 km');
  });
});
