-- Existing rows remain schema version 1. New rows are normalized by the insert trigger.
CREATE TYPE "AdminAuditActorType" AS ENUM ('HUMAN', 'SYSTEM', 'SERVICE', 'UNKNOWN');
CREATE TYPE "AdminAuditArea" AS ENUM ('OPERATOR', 'POLICY', 'MONEY', 'BOOKING', 'SECURITY', 'SYSTEM', 'UNKNOWN');
CREATE TYPE "AdminAuditSeverity" AS ENUM ('INFO', 'NOTICE', 'REVIEW', 'CRITICAL');
CREATE TYPE "AdminAuditOutcome" AS ENUM (
  'SUCCEEDED',
  'FAILED',
  'DENIED',
  'SKIPPED',
  'OPENED',
  'ACKNOWLEDGED',
  'RESOLVED',
  'RECORDED',
  'UNKNOWN'
);

ALTER TABLE "AdminAuditLog"
  ADD COLUMN "schemaVersion" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "eventId" TEXT,
  ADD COLUMN "occurredAt" TIMESTAMP(3),
  ADD COLUMN "recordedAt" TIMESTAMP(3),
  ADD COLUMN "timelineAt" TIMESTAMP(3) GENERATED ALWAYS AS (COALESCE("occurredAt", "createdAt")) STORED,
  ADD COLUMN "source" TEXT,
  ADD COLUMN "correlationId" TEXT,
  ADD COLUMN "requestId" TEXT,
  ADD COLUMN "actorType" "AdminAuditActorType",
  ADD COLUMN "actorKey" TEXT,
  ADD COLUMN "actorLabelSnapshot" TEXT,
  ADD COLUMN "objectType" TEXT,
  ADD COLUMN "objectId" TEXT,
  ADD COLUMN "objectLabelSnapshot" TEXT,
  ADD COLUMN "area" "AdminAuditArea" NOT NULL DEFAULT 'UNKNOWN',
  ADD COLUMN "severity" "AdminAuditSeverity" NOT NULL DEFAULT 'INFO',
  ADD COLUMN "outcome" "AdminAuditOutcome" NOT NULL DEFAULT 'UNKNOWN',
  ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "payloadHash" TEXT,
  ADD COLUMN "correctionOfEventId" TEXT;

ALTER TABLE "AdminAuditLog" ALTER COLUMN "schemaVersion" SET DEFAULT 2;
ALTER TABLE "AdminAuditLog" ALTER COLUMN "recordedAt" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "AdminAuditLog" ALTER COLUMN "actorType" SET DEFAULT 'HUMAN';
ALTER TABLE "AdminAuditLog" ALTER COLUMN "actorId" DROP NOT NULL;
ALTER TABLE "AdminAuditLog" ALTER COLUMN "occurredAt" SET DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "AdminAuditLog" DROP CONSTRAINT "AdminAuditLog_actorId_fkey";
ALTER TABLE "AdminAuditLog"
  ADD CONSTRAINT "AdminAuditLog_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "AdminAuditLog_eventId_key" ON "AdminAuditLog"("eventId");
CREATE INDEX "AdminAuditLog_createdAt_id_idx" ON "AdminAuditLog"("createdAt", "id");
CREATE INDEX "AdminAuditLog_occurredAt_id_idx" ON "AdminAuditLog"("occurredAt", "id");
CREATE INDEX "AdminAuditLog_timelineAt_id_idx" ON "AdminAuditLog"("timelineAt", "id");
CREATE INDEX "AdminAuditLog_actorType_createdAt_idx" ON "AdminAuditLog"("actorType", "createdAt");
CREATE INDEX "AdminAuditLog_area_severity_createdAt_idx" ON "AdminAuditLog"("area", "severity", "createdAt");
CREATE INDEX "AdminAuditLog_objectType_objectId_createdAt_idx"
  ON "AdminAuditLog"("objectType", "objectId", "createdAt");

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION hands_audit_redact_jsonb(input JSONB)
RETURNS JSONB
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  result JSONB;
BEGIN
  IF input IS NULL THEN
    RETURN NULL;
  END IF;

  CASE jsonb_typeof(input)
    WHEN 'object' THEN
      SELECT COALESCE(
        jsonb_object_agg(
          key,
          CASE
            WHEN key ~* '(password|secret|token|authorization|cookie|signature|api[_-]?key|access[_-]?key|private[_-]?key)'
              THEN to_jsonb('[REDACTED]'::TEXT)
            ELSE hands_audit_redact_jsonb(value)
          END
        ),
        '{}'::JSONB
      ) INTO result
      FROM jsonb_each(input);
      RETURN result;
    WHEN 'array' THEN
      SELECT COALESCE(jsonb_agg(hands_audit_redact_jsonb(value)), '[]'::JSONB)
      INTO result
      FROM jsonb_array_elements(input);
      RETURN result;
    ELSE
      RETURN input;
  END CASE;
END;
$$;

CREATE OR REPLACE FUNCTION hands_prepare_admin_audit_log()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  metadata_source TEXT;
  normalized_payload JSONB;
BEGIN
  NEW."schemaVersion" := 2;
  NEW."eventId" := COALESCE(NEW."eventId", NEW."id");
  NEW."occurredAt" := COALESCE(NEW."occurredAt", NEW."createdAt", CURRENT_TIMESTAMP);
  NEW."recordedAt" := COALESCE(NEW."recordedAt", CURRENT_TIMESTAMP);
  NEW."metadata" := hands_audit_redact_jsonb(NEW."metadata");
  metadata_source := NULLIF(NEW."metadata"->>'source', '');
  NEW."source" := COALESCE(NULLIF(NEW."source", ''), metadata_source, 'admin_api');
  NEW."correlationId" := COALESCE(NULLIF(NEW."correlationId", ''), NULLIF(NEW."metadata"->>'correlationId', ''));
  NEW."requestId" := COALESCE(NULLIF(NEW."requestId", ''), NULLIF(NEW."metadata"->>'requestId', ''));

  IF NEW."actorType" IS NULL THEN
    NEW."actorType" := CASE
      WHEN NEW."source" ~* '(system|monitor|sweep|scheduler|background_job)' THEN 'SYSTEM'::"AdminAuditActorType"
      WHEN NEW."source" ~* '(worker|callback|webhook|service)' THEN 'SERVICE'::"AdminAuditActorType"
      WHEN NEW."actorId" IS NOT NULL THEN 'HUMAN'::"AdminAuditActorType"
      ELSE 'UNKNOWN'::"AdminAuditActorType"
    END;
  ELSIF NEW."actorType" = 'HUMAN' AND (
    NEW."actorId" IS NULL
    OR NEW."source" ~* '(system|monitor|sweep|scheduler|worker|background_job)'
  ) THEN
    NEW."actorType" := CASE
      WHEN NEW."source" ~* '(system|monitor|sweep|scheduler|background_job)' THEN 'SYSTEM'::"AdminAuditActorType"
      ELSE 'SERVICE'::"AdminAuditActorType"
    END;
  END IF;

  IF NEW."actorType" IN ('SYSTEM', 'SERVICE') THEN
    NEW."actorId" := NULL;
  END IF;

  NEW."actorKey" := COALESCE(
    NULLIF(NEW."actorKey", ''),
    CASE WHEN NEW."actorType" = 'HUMAN' THEN NEW."actorId" ELSE NEW."source" END,
    lower(NEW."actorType"::TEXT)
  );

  IF NEW."actorLabelSnapshot" IS NULL OR NEW."actorLabelSnapshot" = '' THEN
    IF NEW."actorType" = 'HUMAN' AND NEW."actorId" IS NOT NULL THEN
      SELECT COALESCE(NULLIF("fullName", ''), NULLIF("email", ''), NULLIF("phone", ''), "id")
      INTO NEW."actorLabelSnapshot"
      FROM "User"
      WHERE "id" = NEW."actorId";
    ELSE
      NEW."actorLabelSnapshot" := CASE
        WHEN NEW."actorType" = 'SYSTEM' THEN 'HANDS system'
        WHEN NEW."actorType" = 'SERVICE' THEN 'HANDS service'
        ELSE 'Unknown actor'
      END;
    END IF;
  END IF;

  NEW."objectType" := COALESCE(NULLIF(NEW."objectType", ''), NULLIF(split_part(NEW."target", ':', 1), ''));
  NEW."objectId" := COALESCE(
    NULLIF(NEW."objectId", ''),
    CASE WHEN position(':' IN NEW."target") > 0 THEN substring(NEW."target" FROM position(':' IN NEW."target") + 1) END
  );
  NEW."objectLabelSnapshot" := COALESCE(NULLIF(NEW."objectLabelSnapshot", ''), NEW."target");

  normalized_payload := jsonb_build_object(
    'schemaVersion', NEW."schemaVersion",
    'eventId', NEW."eventId",
    'occurredAt', NEW."occurredAt",
    'recordedAt', NEW."recordedAt",
    'source', NEW."source",
    'correlationId', NEW."correlationId",
    'requestId', NEW."requestId",
    'actorType', NEW."actorType",
    'actorKey', NEW."actorKey",
    'actorLabelSnapshot', NEW."actorLabelSnapshot",
    'action', NEW."action",
    'target', NEW."target",
    'objectType', NEW."objectType",
    'objectId', NEW."objectId",
    'objectLabelSnapshot', NEW."objectLabelSnapshot",
    'area', NEW."area",
    'severity', NEW."severity",
    'outcome', NEW."outcome",
    'tags', NEW."tags",
    'metadata', NEW."metadata",
    'correctionOfEventId', NEW."correctionOfEventId"
  );
  NEW."payloadHash" := encode(digest(convert_to(normalized_payload::TEXT, 'UTF8'), 'sha256'), 'hex');
  RETURN NEW;
END;
$$;

CREATE TRIGGER "AdminAuditLog_prepare_insert"
BEFORE INSERT ON "AdminAuditLog"
FOR EACH ROW EXECUTE FUNCTION hands_prepare_admin_audit_log();

CREATE OR REPLACE FUNCTION hands_reject_admin_audit_log_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'AdminAuditLog is append-only; write a correction event instead';
END;
$$;

CREATE TRIGGER "AdminAuditLog_reject_mutation"
BEFORE UPDATE OR DELETE ON "AdminAuditLog"
FOR EACH ROW EXECUTE FUNCTION hands_reject_admin_audit_log_mutation();
