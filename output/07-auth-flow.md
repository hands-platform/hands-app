# Auth Flow

## Scope
- Vietnam-only phone-first auth.
- Default country code: +84.
- Future final target: Supabase Auth.
- Current backend can keep OTP abstraction while Firebase is removed gradually.

## Customer Auth
1. App opens.
2. Session check.
3. Phone number input.
4. OTP request.
5. OTP verify.
6. CustomerProfile loaded or created.
7. AppSession/device record updated.

## Partner Auth
1. Partner phone login.
2. OTP verify.
3. ProviderProfile/Partner profile loaded or created.
4. Onboarding level checked.
5. Device/session recorded.

## Admin Auth
- Admin routes are protected by role.
- Admin action writes audit log.

## Excluded
- Country chooser.
- Store-member account type.
- Affiliate login.

## Security Notes
- No hardcoded secrets.
- Session refresh must be separated from OTP verification.
- Device/session history is used for operation visibility, not person scoring.
