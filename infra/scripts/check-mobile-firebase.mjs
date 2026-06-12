import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repoRoot = resolve(import.meta.dirname, '..', '..');
const expectedNotificationChannelId = 'hands_priority_alerts';
const apiPushDeliverySource = readIfExists('apps/api/src/notifications/push-delivery.service.ts');
const apiNotificationChannelId = apiPushDeliverySource.match(
  /\bFCM_ANDROID_NOTIFICATION_CHANNEL_ID\s*=\s*'([^']+)'/,
)?.[1];
const apps = [
  {
    name: 'customer_app',
    expectedAndroidPackage: 'com.massagevn.customer.customer_app',
    pubspecPath: 'apps/customer_app/pubspec.yaml',
    rootGradlePath: 'apps/customer_app/android/build.gradle.kts',
    appGradlePath: 'apps/customer_app/android/app/build.gradle.kts',
    manifestPath: 'apps/customer_app/android/app/src/main/AndroidManifest.xml',
    fcmHandlerPath: 'apps/customer_app/lib/src/core/fcm_message_handling_service.dart',
    configPath: 'apps/customer_app/android/app/google-services.json',
    iosConfigPath: 'apps/customer_app/ios/Runner/GoogleService-Info.plist',
  },
  {
    name: 'provider_app',
    expectedAndroidPackage: 'com.massagevn.provider.provider_app',
    pubspecPath: 'apps/provider_app/pubspec.yaml',
    rootGradlePath: 'apps/provider_app/android/build.gradle.kts',
    appGradlePath: 'apps/provider_app/android/app/build.gradle.kts',
    manifestPath: 'apps/provider_app/android/app/src/main/AndroidManifest.xml',
    fcmHandlerPath: 'apps/provider_app/lib/src/core/fcm_message_handling_service.dart',
    configPath: 'apps/provider_app/android/app/google-services.json',
    iosConfigPath: 'apps/provider_app/ios/Runner/GoogleService-Info.plist',
  },
];

const optional = process.argv.includes('--optional');
const result = {
  ok: true,
  optional,
  mode: 'firebase_fcm_only',
  apps: [],
};

for (const app of apps) {
  const pubspecSource = readIfExists(app.pubspecPath);
  const rootGradleSource = readIfExists(app.rootGradlePath);
  const appGradleSource = readIfExists(app.appGradlePath);
  const manifestSource = readIfExists(app.manifestPath);
  const fcmHandlerSource = readIfExists(app.fcmHandlerPath);
  const googleServicesPackages = googleServicesAndroidPackages(app.configPath);
  const androidApplicationId = androidApplicationIdFromGradle(appGradleSource);
  const androidManifestChannelId = androidManifestDefaultChannelId(manifestSource);
  const fcmHandlerChannelId = dartFcmNotificationChannelId(fcmHandlerSource);
  const hasGoogleServicesConfig = existsSync(resolve(app.configPath));
  const androidConfigIgnoredByGit = isGitIgnored(app.configPath);
  const iosConfigIgnoredByGit = isGitIgnored(app.iosConfigPath);

  const appResult = {
    name: app.name,
    expectedAndroidPackage: app.expectedAndroidPackage,
    androidApplicationId,
    androidApplicationIdMatches: androidApplicationId === app.expectedAndroidPackage,
    hasFcmPackages: /firebase_core|firebase_messaging/.test(pubspecSource),
    hasBlockedFirebasePackages: /cloud_firestore|firebase_auth|firebase_database|firebase_storage/.test(
      pubspecSource,
    ),
    hasGoogleServicesPlugin: /com\.google\.gms\.google-services/.test(
      `${rootGradleSource}\n${appGradleSource}`,
    ),
    hasGoogleServicesConfig,
    androidConfigIgnoredByGit,
    iosConfigIgnoredByGit,
    googleServicesPackages,
    googleServicesPackageMatches:
      !hasGoogleServicesConfig || googleServicesPackages.includes(app.expectedAndroidPackage),
    expectedNotificationChannelId,
    apiNotificationChannelId,
    androidManifestChannelId,
    fcmHandlerChannelId,
    notificationChannelIdMatches:
      apiNotificationChannelId === expectedNotificationChannelId &&
      androidManifestChannelId === expectedNotificationChannelId &&
      fcmHandlerChannelId === expectedNotificationChannelId,
  };

  if (
    appResult.hasBlockedFirebasePackages ||
    !appResult.androidApplicationIdMatches ||
    !appResult.androidConfigIgnoredByGit ||
    !appResult.iosConfigIgnoredByGit ||
    !appResult.googleServicesPackageMatches ||
    !appResult.notificationChannelIdMatches
  ) {
    result.ok = false;
  }

  result.apps.push(appResult);
}

console.log(JSON.stringify(result, null, 2));

if (!result.ok && !optional) {
  process.exitCode = 1;
}

function readIfExists(path) {
  const filePath = resolve(repoRoot, path);
  return existsSync(filePath) ? readFileSync(filePath, 'utf8') : '';
}

function isGitIgnored(path) {
  return spawnSync('git', ['check-ignore', '-q', path], { cwd: repoRoot }).status === 0;
}

function androidApplicationIdFromGradle(source) {
  return source.match(/\bapplicationId\s*=\s*"([^"]+)"/)?.[1] ?? null;
}

function googleServicesAndroidPackages(path) {
  const source = readIfExists(path);
  if (!source) {
    return [];
  }

  try {
    const parsed = JSON.parse(source);
    return (parsed.client ?? [])
      .map((client) => client?.client_info?.android_client_info?.package_name)
      .filter((packageName) => typeof packageName === 'string' && packageName.length > 0);
  } catch {
    return [];
  }
}

function androidManifestDefaultChannelId(source) {
  return source.match(/default_notification_channel_id"[\s\S]*?android:value="([^"]+)"/)?.[1] ?? null;
}

function dartFcmNotificationChannelId(source) {
  return source.match(/\bhandsFcmNotificationChannelId\s*=\s*'([^']+)'/)?.[1] ?? null;
}
