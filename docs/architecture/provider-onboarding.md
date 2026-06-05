# Partner Onboarding, KYC, Tax, and Payout Architecture

HANDS partner onboarding is split into small domains so legal, tax, payout, and verification rules can change without rewriting booking or chat flows.

## Goals

- Register Vietnam-based partners such as massage therapists, drivers, and freelancers.
- Keep existing booking, matching, chat, and partner verification flows working while onboarding becomes richer.
- Move toward Supabase Auth, PostgreSQL, Storage, and Realtime without letting screens call Supabase directly.
- Avoid hardcoded tax rates, payout rules, or legal versions in mobile code.

## Domain Boundaries

| Domain        | Responsibility                                                            | Main Tables                                                                             |
| ------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Partner core  | Public partner identity, activity name, profile quality fields, city, service area, level, status | `ProviderProfile`                                                                       |
| KYC           | CCCD/CMND hash, review state, resubmission state                          | `ProviderKyc`                                                                           |
| Documents     | Typed uploaded files for CCCD front/back, selfie, work photos, bank QR    | `ProviderDocument`, `FileAsset`                                                         |
| Bank accounts | Masked account data, QR banking metadata, admin review                    | `ProviderBankAccount`                                                                   |
| Tax           | Partner MST/tax profile, versioned policy rules, withholding logs         | `ProviderTaxProfile`, `TaxPolicyVersion`, `TaxRule`, `ProviderTaxLog`, `WithholdingLog` |
| Agreements    | Terms, privacy, location, payout, and tax policy consent versions         | `ProviderAgreement`                                                                     |
| Security      | Device, session, IP, app version, and account review signals              | `ProviderDevice`, `ProviderSession`                                                     |
| Admin ops     | KYC, bank, tax, payout approval and audit trail                           | `ProviderVerificationLog`, `AdminAuditLog`                                              |

Internal table and route names still use `Provider*` for compatibility. User-facing product language should say partner.

## Partner Levels

| Level                    | Meaning                                  | Gate                                                                        |
| ------------------------ | ---------------------------------------- | --------------------------------------------------------------------------- |
| `LEVEL_1_SIGNUP`         | Can sign up and create the basic profile | Phone/auth plus basic profile                                               |
| `LEVEL_2_ACTIVE`         | Can receive and complete jobs            | KYC approved and approved bank account                                      |
| `LEVEL_3_PAYOUT_ENABLED` | Can request payouts                      | First earned revenue, tax profile, residential address, required agreements |
| `LEVEL_4_TRUSTED`        | Optional profile review recorded         | Admin career/profile review                                                 |

Tax fields are intentionally not required during signup. They appear when the partner earns revenue for the first time, not before the first job. This keeps signup light while still moving tax and settlement compliance forward as soon as money exists.

The public profile keeps lightweight quality fields early in onboarding because
they directly affect customer trust before booking:

- `experienceYears`
- `specialties`
- `languages`
- `serviceStyle`

These fields are editable from the Partner app basic profile sheet and are
shown on the customer partner detail page alongside bio, services, reviews,
and public photos. They are not tax or payout gates.

The onboarding snapshot follows the same staged rule. Before the first completed service,
`payoutGate.missing` should only report `firstCompletedService`. Tax profile,
residential address, and payout/tax agreement gaps stay deferred in the API payload so
the Partner app does not pressure new signups to complete revenue paperwork too early.
After the first completed service or first earned revenue, tax/profile/address/agreement
requirements become active gates for payout and settlement readiness.

Cash bookings are handled differently from online payments. When a partner receives
cash directly from the customer, HANDS records platform fee and withholding as a
negative wallet amount. A negative partner wallet becomes a settlement-required state
and blocks marketplace participation plus payout release until finance confirms
partner repayment or an approved admin offset. The API response must separate the
internal reason from the partner-facing display message:

- Internal reason: `Outstanding HANDS fee settlement must be completed before marketplace participation or payout release.`
- Partner app display copy: `Unpaid HANDS fees must be settled before you can participate in this marketplace booking.`

## Tax Policy Rule

Tax calculation must read an active `TaxPolicyVersion` and matching `TaxRule`.

Rules may target:

- `DEFAULT`
- `SERVICE_TYPE`
- `AMOUNT_BAND`

Each rule stores `rateBps` and optional `fixedAmount`. The code stores the policy/rule snapshot used for each calculation in `ProviderTaxLog.ruleSnapshot`, so later policy changes do not rewrite history.

To keep tax calculation deterministic, the API rejects ambiguous active rule setups:

- More than one active `DEFAULT` rule in the same policy version.
- More than one active `SERVICE_TYPE` rule for the same service type in the same policy version.
- Overlapping active `AMOUNT_BAND` ranges in the same policy version.

Tax and platform-fee policies must exist before the first booking is completed, even when
the partner has not submitted a tax profile yet. If tax profile data is missing, the
system can request it after first revenue while preserving the policy version that was
active for that booking.

## API Foundation

Partner mobile routes now use the canonical `/partner` prefix. Legacy `/provider` aliases remain active for older builds:

- `GET /partner/onboarding`
- `PATCH /partner/onboarding/basic-profile`
- `POST /partner/onboarding/kyc/submit`
- `POST /partner/onboarding/bank-accounts`
- `POST /partner/onboarding/tax-profile`
- `POST /partner/onboarding/agreements`

Admin tax policy routes:

- `GET /admin/tax-policy-versions`
- `POST /admin/tax-policy-versions`
- `PATCH /admin/tax-policy-versions/:id`
- `POST /admin/tax-policy-versions/:id/rules`

Existing legacy routes such as `GET /provider/verification` and `POST /provider/verification/submit` remain active for compatibility. New app builds should call `GET /partner/verification` and `POST /partner/verification/submit`.

## Policy Configuration

Operational gates that should not be duplicated across services live in `apps/api/src/provider-onboarding/provider-onboarding.policy.ts`.

Current policy constants:

- Required KYC documents: `CCCD_FRONT`, `CCCD_BACK`, `SELFIE`
- Optional partner documents: `PROFILE_PHOTO`, `WORK_PHOTO`, `BANK_QR`
- Required payout agreements: `TERMS`, `PRIVACY`, `LOCATION`, `PAYOUT`, `TAX`
- Partner agreement version: `PROVIDER_AGREEMENT_VERSION` from the API environment
- Partner level requirement copy for Level 1 to Level 4

`GET /partner/onboarding` returns these requirements in the snapshot so mobile screens can progressively move away from hardcoded onboarding gates. The API also rejects KYC submission if required identity documents are missing, so client-side checks are not the only protection.

## Supabase/RLS Direction

Supabase should mirror these domains with RLS:

- Partners can read/write only their own onboarding records.
- Admins can read and review all partner onboarding records.
- Private documents are visible only to the owner partner and admins.
- Tax policy versions and rules are writable by admins only and readable by admins/API service role.

## Production Hardening

- Do not store raw CCCD, tax codes, or bank account numbers in plain text.
- Use hashing for lookup/matching and encryption or a vault for values that must be recoverable.
- Add malware scanning/moderation before KYC approval.
- Add admin review queues for KYC, bank, tax profile, and optional profile review.
- Add one-way audit logs for every approval, rejection, block, and payout action.
