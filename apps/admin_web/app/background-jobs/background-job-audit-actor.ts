import type { AdminBackgroundJobAuditAttribution } from '../../lib/admin-api';

export function backgroundJobAuditActorLabel(attribution: AdminBackgroundJobAuditAttribution) {
  const actor = attribution.actor;
  if (actor) {
    return actor.fullName?.trim() || actor.email?.trim() || actor.id;
  }

  return attribution.actorLabelSnapshot?.trim() || 'HANDS system';
}
