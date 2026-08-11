# Customer App

Flutter + Riverpod app for customers.

Initial screen hierarchy:

- Launch and permissions
- Service selection
- Nearby partners
- Partner detail
- Booking confirmation
- Open matching waiting screen
- Chat and partner location tracking
- Review after service completion

## Local marketing attribution link

The Android customer app accepts a custom-scheme link while hosted App Links
remain deferred until the production domain is available:

```text
hands://open?utm_source=google&utm_campaign=launch-hcm&utm_medium=cpc
```

The first supported source (`meta`, `google`, `tiktok`, `organic`, or `direct`)
is stored locally and sent with the authenticated app-session heartbeat. A
later link does not replace the first-touch attribution.

Links with `gclid`/`gbraid`/`wbraid`, `fbclid`, or `ttclid` are classified as
Google, Meta, or TikTok even when `utm_source` is omitted. When neither a
supported link nor build attribution exists, the first app open is recorded as
`direct` with medium `app-open`; `unknown` is therefore reserved for legacy or
missing telemetry.

Build-specific attribution is also supported with:

```text
--dart-define=MARKETING_SOURCE=google
--dart-define=MARKETING_CAMPAIGN_ID=launch-hcm
--dart-define=MARKETING_MEDIUM=cpc
```

Customer support opens the device email app. Override the default operations
address per build when needed:

```text
--dart-define=SUPPORT_EMAIL=administration@hands.vn
```

