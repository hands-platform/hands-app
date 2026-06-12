import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const apps = [
  {
    name: 'customer_app',
    expectedAndroidPackage: 'com.massagevn.customer.customer_app',
    pubspecPath: 'apps/customer_app/pubspec.yaml',
    rootGradlePath: 'apps/customer_app/android/build.gradle.kts',
    appGradlePath: 'apps/customer_app/android/app/build.gradle.kts',
    configPath: 'apps/customer_app/android/app/google-services.json',
  },
  {
    name: 'provider_app',
    expectedAndroidPackage: 'com.massagevn.provider.provider_app',
    pubspecPath: 'apps/provider_app/pubspec.yaml',
    rootGradlePath: 'apps/provider_app/android/build.gradle.kts',
    appGradlePath: 'apps/provider_app/android/app/build.gradle.kts',
    configPath: 'apps/provider_app/android/app/google-services.json',
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
  const googleServicesPackages = googleServicesAndroidPackages(app.configPath);
  const androidApplicationId = androidApplicationIdFromGradle(appGradleSource);
  const hasGoogleServicesConfig = existsSync(resolve(app.configPath));

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
    googleServicesPackages,
    googleServicesPackageMatches:
      !hasGoogleServicesConfig || googleServicesPackages.includes(app.expectedAndroidPackage),
  };

  if (
    appResult.hasBlockedFirebasePackages ||
    !appResult.androidApplicationIdMatches ||
    !appResult.googleServicesPackageMatches
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
  const filePath = resolve(path);
  return existsSync(filePath) ? readFileSync(filePath, 'utf8') : '';
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
