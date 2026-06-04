# Development Environment

This project is currently branded as `HANDS` and targets nationwide service coverage across Vietnam.

Run the local tool check before starting a new phase:

```powershell
.\infra\scripts\check-dev-env.ps1
```

If Windows blocks `.ps1` execution:

```powershell
powershell -ExecutionPolicy Bypass -File .\infra\scripts\check-dev-env.ps1
```

Required tools:

- Node.js and npm for the monorepo, API, shared packages, and Admin Web.
- Git for GitHub backup, branch workflow, diffs, and stable commits.
- Docker Desktop for PostgreSQL/PostGIS, Redis, MinIO, Nginx, and production-style compose tests.
- Flutter and Dart for customer and partner mobile apps.

Recommended tools:

- Java 17 for Android build tooling.
- Android Studio for emulator, Android SDK, and Flutter device testing.

Current local status after setup:

- Git, Docker Desktop, Flutter, Dart, Node.js, npm, Java, Android Studio, Android SDK, and Android Emulator are available.
- `verify-local.ps1 -WithServices` passes Docker, Prisma, API smoke, Admin build, and Flutter analyze checks.
- Customer and Partner apps build, install, and launch on the Android emulator from an ASCII-only path such as `C:\dev\massage-vn-workspace\repo`.
- The source workspace path contains Korean characters. Flutter analyze/test works there, but Android Gradle builds can fail on Windows unless the project is run from an ASCII-only path.

If required tools are missing and Chocolatey is available, open PowerShell as Administrator and run:

```powershell
.\infra\scripts\check-dev-env.ps1 -Install
```

Execution-policy-safe install command:

```powershell
powershell -ExecutionPolicy Bypass -File .\infra\scripts\check-dev-env.ps1 -Install
```

For a dedicated installer that installs Git, Docker Desktop, and Flutter:

```powershell
powershell -ExecutionPolicy Bypass -File .\infra\scripts\install-dev-tools-admin.ps1
```

If Chocolatey reports a stale lock file under `C:\ProgramData\chocolatey\lib`, close other install windows and rerun:

```powershell
powershell -ExecutionPolicy Bypass -File .\infra\scripts\install-dev-tools-admin.ps1 -ClearChocolateyLocks
```

After installing Git, Docker Desktop, or Flutter, restart PowerShell so PATH changes are visible.

Docker Desktop may also require enabling WSL 2 and rebooting Windows before `docker --version` works.

## Local Verification

Run this before considering a phase stable:

```powershell
npm.cmd run verify:local
```

The verification script runs all checks that are possible on the current PC and marks unavailable checks as `SKIP`.

It currently covers:

- development tool availability
- Node script syntax checks
- environment template validation
- Prisma schema validation
- API typecheck and build
- Admin Web typecheck and build
- Git status when Git is available
- Docker Compose and smoke tests when Docker is available
- Flutter dependency/analyze checks when Flutter is available

For external integrations, use focused checks before asking the app to run against real providers:

```powershell
npm.cmd run setup:doctor
npm.cmd run external:check:supabase
npm.cmd run external:check:maps
npm.cmd run external:check:payments
```

After Docker Desktop is installed and running, use:

```powershell
powershell -ExecutionPolicy Bypass -File .\infra\scripts\verify-local.ps1 -WithServices
```

## Current Known Limitation

The Codex shell may not have Administrator privileges. If Chocolatey fails with an access error under `C:\ProgramData\chocolatey`, rerun the install command from an Administrator PowerShell window.

Android builds on Windows should be run from an ASCII-only project path. If the repo is under a Downloads folder with non-ASCII characters, mirror or move it to a path such as `C:\dev\massage-vn-workspace\repo` before running:

```powershell
cd C:\dev\massage-vn-workspace\repo\apps\customer_app
flutter run -d emulator-5554 --dart-define=API_BASE_URL=http://10.0.2.2:3100/api --dart-define=SOCKET_BASE_URL=http://10.0.2.2:3100
```

If you want the HANDS customer/partner apps to render real MapTiler maps and Geoapify address search instead of fallback panels, set `MAPTILER_API_KEY` and `GEOAPIFY_API_KEY` in the ignored root `.env` or in your shell. The helper scripts pass them as Flutter defines:

```powershell
$env:MAPTILER_API_KEY="your-maptiler-key"
$env:GEOAPIFY_API_KEY="your-geoapify-key"
powershell -ExecutionPolicy Bypass -File .\infra\scripts\run-hands-emulator.ps1 -App customer
```

To verify both map services without opening the mobile app:

```powershell
npm.cmd run external:check:maps
```

For the organized HANDS workspace, prefer:

- repo: `C:\dev\massage-vn-workspace\repo`
- secrets: `C:\dev\massage-vn-workspace\secrets`
- local API: `http://localhost:3000`
- local Admin: `http://localhost:3101`

For a physical Android device over USB, use the helper script from the workspace root:

```powershell
powershell -ExecutionPolicy Bypass -File .\infra\scripts\run-hands-mobile-device.ps1 -App customer
powershell -ExecutionPolicy Bypass -File .\infra\scripts\run-hands-mobile-device.ps1 -App provider
```

For Android Emulator, use:

```powershell
powershell -ExecutionPolicy Bypass -File .\infra\scripts\run-hands-emulator.ps1 -App customer
powershell -ExecutionPolicy Bypass -File .\infra\scripts\run-hands-emulator.ps1 -App provider
```
