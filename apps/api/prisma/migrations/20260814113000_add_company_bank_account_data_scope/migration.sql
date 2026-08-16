CREATE TYPE "CompanyBankAccountDataScope" AS ENUM ('UNKNOWN', 'PRODUCTION', 'SYNTHETIC');

ALTER TABLE "CompanyBankAccount"
ADD COLUMN "dataScope" "CompanyBankAccountDataScope" NOT NULL DEFAULT 'UNKNOWN';

CREATE INDEX "CompanyBankAccount_dataScope_status_currency_idx"
ON "CompanyBankAccount"("dataScope", "status", "currency");
