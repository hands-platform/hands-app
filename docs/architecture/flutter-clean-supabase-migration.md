# Flutter Clean Architecture and Supabase Migration

## Goal

Move the HANDS customer and provider Flutter apps from the current mixed app-state structure to a DDD/Clean Architecture layout, then remove Firebase and migrate platform dependencies to Supabase-backed services without breaking the current MVP flow.

## Current Firebase Usage

The Flutter apps no longer use Firebase.

| App      | File                                                                                                         | Current responsibility                                                                                 |
| -------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| Customer | `apps/customer_app/lib/src/features/notification/data/datasources/in_app_notification_token_datasource.dart` | Keeps notification setup behind the existing repository boundary without registering an OS push token. |
| Provider | `apps/provider_app/lib/src/features/notification/data/datasources/in_app_notification_token_datasource.dart` | Keeps notification setup behind the existing repository boundary without registering an OS push token. |
| API      | `apps/api/src/notifications/push-delivery.service.ts`                                                        | Records in-app-only delivery decisions and avoids external OS push calls.                              |

No Flutter or API code currently calls Firebase Auth, Firestore, Firebase Storage, Realtime Database, Cloud Functions, Cloud Messaging, Firebase Core, or FCM HTTP APIs.

## Target Client Structure

Each Flutter app should gradually move toward this layout:

```text
lib/
  src/
    core/
      config/
      error/
      network/
      providers.dart
      router/
      theme/
      utils/
      widgets/
    features/
      auth/
        domain/
        data/
        presentation/
      user/
      provider/
      booking/
      map/
      chat/
      notification/
      payment/
      file/
      review/
```

## Migration Strategy

Firebase has been removed from the Flutter apps after isolating notification behavior behind feature repositories and use cases.

Use the architecture guard whenever auth, notification, map, or chat code is moved:

```powershell
cd C:\dev\massage-on-demand-vn
npm.cmd run mobile:architecture:check
```

The guard blocks Firebase references, direct Supabase imports from screens/presentation, and `Supabase.instance` usage. Supabase access should stay behind core providers and data-layer datasources so later developers can replace providers without rewriting UI screens.

1. Notification boundary
   - Keep UI calling `RegisterCurrentDevicePushToken`.
   - Keep notification setup behind `PushTokenDataSource`.
   - Use in-app notifications for the MVP.
   - Later add FCM push without adding Firebase DB/Auth/Firestore or changing screens.

2. Auth boundary
   - Keep current NestJS OTP/JWT login during MVP stabilization.
   - Introduce `AuthRepository` and `SignInWithOtp` use case.
   - Later switch the datasource to Supabase Auth or to a NestJS endpoint backed by Supabase Auth.

3. Map/location boundary
   - Keep MapTiler, Geoapify, Geolocator.
   - Move location selection and provider heartbeat logic under `features/map`.
   - Store selected customer locations and provider last-known locations in PostgreSQL/Supabase tables.

4. Booking boundary
   - Keep booking, direct request, provider accept, marketplace matching, and matched chat lifecycle in the API.
   - Move Flutter API calls into `BookingRepository`.

5. Chat boundary
   - Keep Socket.IO until the MVP flow is stable.
   - Add a `ChatRepository` boundary.
   - Later evaluate Supabase Realtime for message subscription only.

6. File/storage boundary
   - Keep current presigned upload flow first.
   - Replace S3/MinIO adapter with Supabase Storage adapter when verification UX is stable.

7. Firebase scope
   - Firebase is allowed only for FCM push. Firebase DB/Auth/Firestore and Firebase Storage stay out of MVP.
   - API FCM service is removed and replaced by an in-app-only delivery adapter.

## Supabase Data Model Direction

Recommended Supabase/PostgreSQL tables:

| Table                         | Purpose                                                           |
| ----------------------------- | ----------------------------------------------------------------- |
| `profiles`                    | Shared user profile linked to Supabase Auth user id.              |
| `providers`                   | Partner profile, verification state, status, public profile data. |
| `services`                    | Massage service catalog.                                          |
| `provider_services`           | Partner-specific offerings and prices.                            |
| `provider_locations`          | Last-known partner location and freshness timestamp.              |
| `customer_selected_locations` | Customer-confirmed booking locations.                             |
| `booking_address_snapshots`   | Immutable address snapshot used for matching radius and audit.    |
| `bookings`                    | Direct booking and matching state.                                |
| `booking_participants`        | Preferred and marketplace partner participation.                  |
| `payments`                    | Cash, MoMo, VNPay, refund/capture state.                          |
| `reviews`                     | Service feedback records, not partner/customer scoring.           |
| `chat_rooms`                  | Booking chat room.                                                |
| `messages`                    | Chat messages.                                                    |
| `notifications`               | In-app notification inbox.                                        |
| `files`                       | Supabase Storage file metadata.                                   |
| `admin_settings`              | Operational configuration.                                        |

## RLS Direction

Use RLS as a second guardrail, but keep critical booking/payment/matching decisions in the API.

| Area          | Policy direction                                                                                                |
| ------------- | --------------------------------------------------------------------------------------------------------------- |
| Profiles      | Users can read/update their own profile. Admins can read all.                                                   |
| Partners      | Public approved profile fields are readable by customers. Partners can update their own private profile.        |
| Bookings      | Customers see their own bookings. Providers see assigned, preferred, or open eligible bookings. Admins see all. |
| Messages      | Only chat room participants and admins can read/write messages.                                                 |
| Notifications | Users read/update their own notification rows. Admins can inspect all.                                          |
| Files         | Owners and admins can access private files. Public provider media can be served through a public bucket/CDN.    |

## Biggest Risks

- Push notification replacement: Supabase Realtime is not a full replacement for OS-level push when the app is closed.
- Auth migration: Supabase Auth JWT and current NestJS JWT must not diverge.
- Booking and payment security: never let mobile clients directly decide match/payment final state.
- Chat realtime migration: Socket.IO events and Supabase Realtime subscriptions have different delivery semantics.
- RLS mistakes: policies can accidentally hide legitimate records or expose private records.

## Recommended Architecture Decision

For the MVP, prefer this direction:

```text
Flutter apps -> Feature repositories/use cases -> NestJS API -> Supabase Postgres/Storage/Auth
```

Use direct Supabase client calls only for low-risk reads or realtime subscriptions after the API ownership boundary is clear.
