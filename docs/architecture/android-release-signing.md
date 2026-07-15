# HANDS Android Release Signing

This runbook prepares Android upload signing for the HANDS customer and partner apps.

Do not commit keystores, passwords, `key.properties`, Play Console credentials, or screenshot-visible secrets.

## App IDs

- Customer: `com.massagevn.customer.customer_app`
- Provider: `com.massagevn.provider.provider_app`

## Recommended Local Flow

Run from the repository root:

```powershell
cd C:\dev\massage-on-demand-vn
npm.cmd run android:signing:create
```

The helper creates two upload keystores under the local secrets folder:

```text
C:\dev\hands-secrets\android-signing\hands-customer-upload.jks
C:\dev\hands-secrets\android-signing\hands-provider-upload.jks
```

It also writes ignored app-local Gradle signing files:

```text
C:\dev\massage-on-demand-vn\apps\customer_app\android\key.properties
C:\dev\massage-on-demand-vn\apps\provider_app\android\key.properties
```

The Play Console and Android API restriction handoff file is:

```text
C:\dev\hands-secrets\android-signing\android-signing-summary.txt
```

This file includes the SHA-1 and SHA-256 fingerprints for both apps.

## Build Verification

```powershell
cd C:\dev\massage-on-demand-vn\apps\customer_app
flutter build apk --release

cd C:\dev\massage-on-demand-vn\apps\provider_app
flutter build apk --release
```

For Play Console upload bundles:

```powershell
cd C:\dev\massage-on-demand-vn\apps\customer_app
flutter build appbundle --release

cd C:\dev\massage-on-demand-vn\apps\provider_app
flutter build appbundle --release
```

The ignored upload artifacts are written to each app's
`build/app/outputs/bundle/release/app-release.aab`. Confirm the signer certificate
against the matching SHA-1/SHA-256 values in
`C:\dev\hands-secrets\android-signing\android-signing-summary.txt` before upload.

The Gradle files automatically use `android/key.properties` when it exists. Debug builds remain available without it, but every release task fails closed when signing credentials are missing. Release builds never fall back to the debug signing key.

## Environment Values

For production-like readiness checks, fill these in your local `.env` or deployment environment:

```dotenv
ANDROID_CUSTOMER_UPLOAD_KEYSTORE=C:\dev\hands-secrets\android-signing\hands-customer-upload.jks
ANDROID_PROVIDER_UPLOAD_KEYSTORE=C:\dev\hands-secrets\android-signing\hands-provider-upload.jks
```

Then verify:

```powershell
cd C:\dev\massage-on-demand-vn
npm.cmd run android:signing:check
npm.cmd run external:check:production
```

`android:signing:check` is read-only. It checks both Gradle fail-closed contracts,
the ignored `key.properties` files, environment-to-keystore path alignment, and
each configured alias with `keytool` without printing passwords. CI or a machine
without signing credentials can run `npm.cmd run android:signing:check:static`.

Both Android apps fail closed for release tasks. `assembleRelease`, `bundleRelease`, and Flutter release builds stop when `android/key.properties` is absent; they never fall back to the debug signing key. Debug builds remain available without release credentials.

## Play Console Notes

Create the customer and partner apps separately in Play Console because they use different package names.

For each app:

- Use the matching package name.
- Keep the matching upload key backed up outside Git.
- Store the SHA-1 and SHA-256 fingerprints from `android-signing-summary.txt`.
- If a third-party provider asks for Android app restrictions, use the matching package name and SHA fingerprint for that app.

## Recovery Rule

If an upload key is lost before Play Console is configured, generate a fresh key and replace the local `key.properties`. If the key is already registered in Play Console, follow Google's upload key reset process instead of replacing it locally without coordination.
