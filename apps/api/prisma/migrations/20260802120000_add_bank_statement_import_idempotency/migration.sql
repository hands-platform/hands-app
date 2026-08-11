CREATE UNIQUE INDEX "AdminAuditLog_company_bank_batch_import_target_key"
ON "AdminAuditLog" ("target")
WHERE "action" = 'company_bank_transaction.batch_import';
