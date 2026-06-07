import { attentionLevel, type AttentionFlag } from './admin-attention-flags';

describe('attentionLevel', () => {
  it('returns clear when there are no active flags', () => {
    expect(attentionLevel([])).toEqual({
      label: 'Clear',
      helper: 'No active attention checks',
      tone: 'pill-success',
    });
  });

  it('prioritizes high severity flags', () => {
    const flags: AttentionFlag[] = [
      {
        severity: 'medium',
        title: 'Monitor one',
        detail: 'Monitor this',
        action: 'Watch',
      },
      {
        severity: 'high',
        title: 'Act now',
        detail: 'Act now',
        action: 'Resolve',
      },
    ];

    expect(attentionLevel(flags)).toEqual({
      label: 'Action',
      helper: '2 check(s) need attention',
      tone: 'pill-danger',
    });
  });

  it('returns monitor when the highest severity is medium', () => {
    expect(
      attentionLevel([
        {
          severity: 'medium',
          title: 'Monitor',
          detail: 'Monitor this',
          action: 'Watch',
        },
      ]),
    ).toEqual({
      label: 'Monitor',
      helper: '1 check(s) to monitor',
      tone: 'pill-warn',
    });
  });

  it('returns note when only low severity flags exist', () => {
    expect(
      attentionLevel([
        {
          severity: 'low',
          title: 'Note',
          detail: 'Note this',
          action: 'Record',
        },
      ]),
    ).toEqual({
      label: 'Note',
      helper: '1 note check(s)',
      tone: 'pill-info',
    });
  });
});
