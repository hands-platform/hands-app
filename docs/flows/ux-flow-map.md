# UX Flow Map

## Phase 1 Navigation Shape

Customer app uses five tabs:

- Home: selected address, service categories, distance-sorted partner discovery
- Partners: searchable partner list and partner profile
- Bookings: active booking, matching, history
- Chat: rooms and messages
- Profile: account, addresses, wallet, support

Partner app uses five tabs:

- Requests: open matching jobs and invitations
- Jobs: active service work, accepted requests, and completed records
- Earnings: payout cycles, completed jobs, wallet settlement state
- Chat: customer conversations
- Profile: verification, services, online toggle

Admin web uses sidebar navigation:

- Dashboard
- Customers
- Partners
- Verification
- Bookings
- Matching
- Payments
- Feedback/Reports
- Coupons
- Analytics
- Audit Log

## Customer Booking Sequence

```mermaid
flowchart TD
  A["Launch"] --> B["Address Selection"]
  B --> C["Distance-Sorted Partner Discovery"]
  C --> D["Partner Detail"]
  D --> E["Review Profile / Reviews / Services"]
  E --> F["Customer Selects One Service"]
  F --> G["First-Pick Booking Request"]
  G --> H["Mandatory Booking Confirmation"]
  H --> I["Open Matching Marketplace"]
  I --> J["Marketplace Participants Can Join"]
  J --> K["Customer Selects Final Partner"]
  K --> L["Matched"]
  L --> M["Chat Created"]
  M --> N["Partner On The Way"]
  N --> O["In Service"]
  O --> P["Complete"]
  P --> Q["Factual Feedback"]
```

## Reference Dynamic Flow Notes

Physical-device dynamic analysis confirmed this high-level customer flow shape:

```mermaid
flowchart TD
  A["Explore Home"] --> B["Service Category Card"]
  B --> C["Partner List"]
  C --> D["Search And Filter"]
  C --> E["Partner Card"]
  E --> F["Booking CTA"]
  F --> G["Authentication Gate"]
  G --> H["Google Or Phone Login"]
```

MVP Phase 1 keeps the same broad order: explore first, partner browse second, partner detail third, booking action fourth. HANDS adds mandatory booking confirmation and an Open Matching Marketplace after the first-pick request so participants can appear without removing the customer's final choice.

## Partner Sequence

```mermaid
flowchart TD
  A["Login"] --> B["Verification Check"]
  B --> C["Online Toggle"]
  C --> D["Location Update On App Open / Every 10 Min"]
  D --> E["First-Pick Request Inbox"]
  D --> F["Open Marketplace Request List"]
  E --> G["Accept Or Reject"]
  F --> H["Join Open Request"]
  G --> I["Start Service Flow"]
  H --> J["Wait For Customer Final Selection"]
  J --> I
  I --> K["Chat And Navigate"]
  K --> L["Arrived"]
  L --> M["Start Service"]
  M --> N["Complete Service"]
  N --> O["Earnings Updated"]
```

## UX Comparison Principles

- Preserve: onboarding/auth/location prompts, tab-based IA, partner browsing before booking, booking detail/status timeline, chat placement, partner verification sequence.
- Change: original branding, artwork, copy, colors, icons, and the original matching implementation.
- Improve: make first-pick, marketplace participation, final customer choice, wallet settlement gates, and partner response state explicit for customers, partners, and operators.
