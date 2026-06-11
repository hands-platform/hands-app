import { appendDatedAdminNote } from './admin-booking-ops-helpers';

describe('admin booking ops helpers', () => {
  const now = new Date('2026-06-11T00:00:00.000Z');

  it('creates a timestamped note when no existing notes are present', () => {
    expect(appendDatedAdminNote(null, 'Operation note', now)).toBe(
      '[2026-06-11T00:00:00.000Z] Operation note',
    );
  });

  it('appends timestamped notes after trimmed existing notes', () => {
    expect(appendDatedAdminNote(' Existing note \n', 'Next note', now)).toBe(
      'Existing note\n[2026-06-11T00:00:00.000Z] Next note',
    );
  });
});
