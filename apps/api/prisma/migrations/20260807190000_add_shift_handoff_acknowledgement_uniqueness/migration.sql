CREATE UNIQUE INDEX "AdminAuditLog_shift_handoff_acknowledgement_target_key"
ON "AdminAuditLog" ("target")
WHERE "action" = 'operations.shift_handoff.acknowledge';
