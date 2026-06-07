import { formatDistanceMeters } from './admin-format';

export function participantDistancePolicy(distanceMeters: number | null | undefined, radiusMeters: number) {
  if (distanceMeters === undefined || distanceMeters === null || !Number.isFinite(distanceMeters)) {
    return {
      label: 'Distance not recorded',
      tone: 'pill-neutral',
      helper: 'Participant row has no saved distance from the booking address.',
    };
  }

  const distance = formatDistanceMeters(distanceMeters);
  const radius = formatDistanceMeters(radiusMeters);
  if (distanceMeters <= radiusMeters) {
    return {
      label: 'Within booking radius',
      tone: 'pill-success',
      helper: `${distance} from the booking address; marketplace participation is inside the configured ${radius} radius.`,
    };
  }

  return {
    label: 'Outside policy radius',
    tone: 'pill-warn',
    helper: `${distance} from the booking address; keep the row as evidence, but review why this partner participated outside the configured ${radius} radius.`,
  };
}
