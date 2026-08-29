CREATE TABLE "OperationsHandoffOpenCaseRevision" (
  "key" TEXT NOT NULL,
  "revision" BIGINT NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "OperationsHandoffOpenCaseRevision_pkey" PRIMARY KEY ("key"),
  CONSTRAINT "OperationsHandoffOpenCaseRevision_revision_check" CHECK ("revision" >= 0)
);

INSERT INTO "OperationsHandoffOpenCaseRevision" ("key", "revision")
VALUES ('open-cases', 0);

-- Every statement that can change open-case membership takes this row lock before
-- touching its source table. The handoff transaction locks the same row first, so
-- its queue snapshot and audit insert have one database ordering boundary.
-- ponytail: A single revision serializes membership writes; shard only if measured
-- production contention proves that the simpler global boundary is insufficient.
CREATE OR REPLACE FUNCTION hands_bump_operations_handoff_open_case_revision()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE "OperationsHandoffOpenCaseRevision"
  SET
    "revision" = "revision" + 1,
    "updatedAt" = CURRENT_TIMESTAMP
  WHERE "key" = 'open-cases';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Operations handoff open-case revision is not initialized'
      USING ERRCODE = '55000';
  END IF;

  RETURN NULL;
END;
$$;

CREATE TRIGGER "Booking_bump_operations_handoff_open_case_revision"
BEFORE INSERT OR UPDATE OF
  "id", "customerProfileId", "preferredProviderId", "selectedProviderId", "metadata",
  "status", "updatedAt", "createdAt", "expiresAt", "matchedAt", "closedReason", "closedAt"
OR DELETE ON "Booking"
FOR EACH STATEMENT
EXECUTE FUNCTION hands_bump_operations_handoff_open_case_revision();

CREATE TRIGGER "BookingParticipant_bump_operations_handoff_open_case_revision"
BEFORE INSERT OR UPDATE OF "bookingId" OR DELETE ON "BookingParticipant"
FOR EACH STATEMENT
EXECUTE FUNCTION hands_bump_operations_handoff_open_case_revision();

CREATE TRIGGER "Payment_bump_operations_handoff_open_case_revision"
BEFORE INSERT OR UPDATE OF "bookingId", "status" OR DELETE ON "Payment"
FOR EACH STATEMENT
EXECUTE FUNCTION hands_bump_operations_handoff_open_case_revision();

CREATE TRIGGER "ProviderEarning_bump_operations_handoff_open_case_revision"
BEFORE INSERT OR UPDATE OF "bookingId", "status", "netAmount", "payoutBatchId" OR DELETE ON "ProviderEarning"
FOR EACH STATEMENT
EXECUTE FUNCTION hands_bump_operations_handoff_open_case_revision();

CREATE TRIGGER "Refund_bump_operations_handoff_open_case_revision"
BEFORE INSERT OR UPDATE OF "bookingId", "status" OR DELETE ON "Refund"
FOR EACH STATEMENT
EXECUTE FUNCTION hands_bump_operations_handoff_open_case_revision();

CREATE TRIGGER "ProviderProfile_bump_operations_handoff_open_case_revision"
BEFORE INSERT OR UPDATE OF "id", "userId", "displayName" OR DELETE ON "ProviderProfile"
FOR EACH STATEMENT
EXECUTE FUNCTION hands_bump_operations_handoff_open_case_revision();

CREATE TRIGGER "ProviderVerification_bump_operations_handoff_open_case_revision"
BEFORE INSERT OR UPDATE OF "providerProfileId", "status" OR DELETE ON "ProviderVerification"
FOR EACH STATEMENT
EXECUTE FUNCTION hands_bump_operations_handoff_open_case_revision();

CREATE TRIGGER "ProviderKyc_bump_operations_handoff_open_case_revision"
BEFORE INSERT OR UPDATE OF "providerProfileId", "status" OR DELETE ON "ProviderKyc"
FOR EACH STATEMENT
EXECUTE FUNCTION hands_bump_operations_handoff_open_case_revision();

CREATE TRIGGER "PartnerBankDepositCashDebtAllocation_bump_operations_handoff_open_case_revision"
BEFORE INSERT OR UPDATE OF "providerEarningId", "amount" OR DELETE ON "PartnerBankDepositCashDebtAllocation"
FOR EACH STATEMENT
EXECUTE FUNCTION hands_bump_operations_handoff_open_case_revision();

CREATE TRIGGER "Notification_bump_operations_handoff_open_case_revision"
BEFORE INSERT OR UPDATE OF "id", "data", "createdAt" OR DELETE ON "Notification"
FOR EACH STATEMENT
EXECUTE FUNCTION hands_bump_operations_handoff_open_case_revision();

CREATE TRIGGER "NotificationDelivery_bump_operations_handoff_open_case_revision"
BEFORE INSERT OR UPDATE OF "notificationId", "status" OR DELETE ON "NotificationDelivery"
FOR EACH STATEMENT
EXECUTE FUNCTION hands_bump_operations_handoff_open_case_revision();

CREATE TRIGGER "User_bump_operations_handoff_open_case_revision"
BEFORE UPDATE OF "id", "fullName", "fixtureKind", "fixtureRunId", "fixtureExpiresAt" ON "User"
FOR EACH STATEMENT
EXECUTE FUNCTION hands_bump_operations_handoff_open_case_revision();

CREATE TRIGGER "CustomerProfile_bump_operations_handoff_open_case_revision"
BEFORE UPDATE OF "id", "userId" ON "CustomerProfile"
FOR EACH STATEMENT
EXECUTE FUNCTION hands_bump_operations_handoff_open_case_revision();
