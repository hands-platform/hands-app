-- Fill only missing launch-language labels for the three verified operational service groups.
-- Existing operator translations remain authoritative.
UPDATE "MassageService"
SET "nameTranslations" = coalesce("nameTranslations", '{}'::jsonb) || jsonb_build_object(
  'en', coalesce(nullif("nameTranslations"->>'en', ''), "name"),
  'vi', coalesce(
    nullif("nameTranslations"->>'vi', ''),
    CASE "serviceGroupKey"
      WHEN 'foot' THEN 'Massage chân'
      WHEN 'swedish' THEN 'Massage Thụy Điển'
      WHEN 'deep_tissue' THEN 'Massage mô sâu'
    END
  )
)
WHERE "serviceGroupKey" IN ('foot', 'swedish', 'deep_tissue')
  AND (
    coalesce(nullif("nameTranslations"->>'en', ''), '') = ''
    OR coalesce(nullif("nameTranslations"->>'vi', ''), '') = ''
  );
