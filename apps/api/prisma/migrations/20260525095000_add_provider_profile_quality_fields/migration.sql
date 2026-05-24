ALTER TABLE "ProviderProfile"
ADD COLUMN "experienceYears" INTEGER,
ADD COLUMN "specialties" JSONB,
ADD COLUMN "languages" JSONB,
ADD COLUMN "serviceStyle" TEXT;
