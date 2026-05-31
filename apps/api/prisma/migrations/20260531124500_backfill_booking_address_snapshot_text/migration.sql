UPDATE "BookingAddressSnapshot"
SET "addressText" = COALESCE(
  "address" ->> 'addressText',
  "address" ->> 'address_text',
  "address" ->> 'line1',
  "address" ->> 'addressLine',
  "address" ->> 'address',
  "address" ->> 'label',
  "address" ->> 'text',
  "address" ->> 'name',
  "addressText"
)
WHERE jsonb_typeof("address") = 'object'
  AND COALESCE(
    "address" ->> 'addressText',
    "address" ->> 'address_text',
    "address" ->> 'line1',
    "address" ->> 'addressLine',
    "address" ->> 'address',
    "address" ->> 'label',
    "address" ->> 'text',
    "address" ->> 'name'
  ) IS NOT NULL
  AND (
    "addressText" IS NULL
    OR "addressText" = "address"::TEXT
    OR "addressText" LIKE '{%'
  );
