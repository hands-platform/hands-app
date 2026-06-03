# APK Analysis Report

This file is historical reference only. It does not define HANDS product behavior.

## Scope

The provided reference XAPK was inspected only to understand broad mobile flow order and implementation signals. The analysis did not bypass authentication, certificate pinning, payment controls, or private user data.

Do not reuse:

- proprietary source code
- extracted assets
- photos, logos, icons, videos, or brand identity
- private API payloads or hidden business logic

## Useful Reference Findings

- Mobile flow starts with explore/home, service category, partner list, partner detail, booking/auth gate, status, and chat.
- Partner cards commonly show media, display name, distance, availability, and booking action.
- The app uses Android permissions for network, foreground location, camera/media, notifications, billing, and attribution.
- SDK signals included React Native/Hermes, Firebase, Google services, OneSignal, WebView, billing, and social/auth integrations.
- Dynamic analysis confirmed the broad flow on a user-owned Android device without security bypass.

## HANDS Decision

HANDS keeps only the broad screen order and interaction concept:

`address -> partner list -> partner detail -> service/duration -> booking confirmation -> first-pick + marketplace matching -> customer final selection -> chat/service -> completion`

HANDS changes the business model:

- no reference branding or assets
- no VIP/subscription/tip model
- no automatic final partner assignment
- no scheduled booking UX
- NestJS owns business rules
- Admin is Operations Command Center
