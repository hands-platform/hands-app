# Localization Strategy

## Language Matrix

`HANDS` language support should differ by app, based on real users.

### Customer App

Required languages:

- Vietnamese (`vi`)
- English (`en`)
- Korean (`ko`)
- Chinese (`zh`)
- Japanese (`ja`)

Reason:

- primary local users in Vietnam
- foreign travelers visiting Vietnam
- reduced booking friction for non-Vietnamese customers

### Partner App

Required language:

- Vietnamese (`vi`)

Reason:

- partners are expected to be Vietnam-based service professionals
- partner operations should stay direct and low-friction

### Admin Web

Required languages:

- Korean (`ko`)
- Vietnamese (`vi`)
- English (`en`)

Reason:

- Korean-speaking leadership / management
- Vietnamese-speaking operations staff
- English for cross-border operations and fallback

## Default Locale Rules

### Customer App

Recommended default behavior:

1. use explicit saved user language if chosen
2. otherwise use device language when supported
3. otherwise fall back to English

### Partner App

Recommended default behavior:

1. Vietnamese by default
2. allow future extension only if partner operations require it

### Admin Web

Recommended default behavior:

1. use per-admin saved language preference
2. otherwise use browser language if supported
3. otherwise fall back to English

## Product Writing Rules

During localization work:

- customer copy should be calm, simple, and booking-oriented
- partner copy should be short, operational, and action-first
- admin copy should be explicit and audit-friendly

Avoid:

- slang-heavy machine translation
- ambiguous booking statuses
- decorative marketing copy inside operational flows

## Implementation Plan

### Customer App

Planned stack:

- Flutter `gen_l10n` or `intl`
- ARB-based translation files
- centralized app strings

Recommended locale files:

- `app_vi.arb`
- `app_en.arb`
- `app_ko.arb`
- `app_zh.arb`
- `app_ja.arb`

### Partner App

Planned stack:

- same Flutter localization structure as customer app
- only `vi` required in Phase 1.5 / Phase 2 localization pass

Recommended locale files:

- `app_vi.arb`

### Admin Web

Planned stack:

- Next.js locale-aware routing or dictionary-based server/client translation layer
- route-safe dictionary loading
- translation keys grouped by operational domain

Recommended dictionaries:

- `ko`
- `vi`
- `en`

## Translation Ownership

Recommended ownership model:

- product/source copy defined first in English or Korean planning docs
- Vietnamese customer/partner copy reviewed by native Vietnamese operator
- Korean admin copy reviewed by Korean decision-maker
- customer-facing travel copy reviewed for natural English

## Current Gap

Today, the apps are still mostly hardcoded in English.

That is acceptable for the current engineering MVP because:

- flow validation is the current priority
- UI structure is still placeholder-grade
- final design and final copy are still pending

But before broader pilot use, localization must become a formal implementation phase.
