import { participantDistancePolicy } from './admin-distance-policy';

describe('participantDistancePolicy', () => {
  it('marks a partner inside the booking-address marketplace radius', () => {
    expect(participantDistancePolicy(9_800, 10_000)).toEqual({
      label: 'Within booking radius',
      tone: 'pill-success',
      helper: '9.8 km from the booking address; marketplace participation is inside the configured 10 km radius.',
    });
  });

  it('marks a partner outside the configured booking radius', () => {
    expect(participantDistancePolicy(10_100, 10_000)).toEqual({
      label: 'Outside policy radius',
      tone: 'pill-warn',
      helper:
        '10.1 km from the booking address; keep the row as evidence, but review why this partner participated outside the configured 10 km radius.',
    });
  });

  it('handles missing distance evidence', () => {
    expect(participantDistancePolicy(null, 10_000)).toEqual({
      label: 'Distance not recorded',
      tone: 'pill-neutral',
      helper: 'Participant row has no saved distance from the booking address.',
    });
  });
});
