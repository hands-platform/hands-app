import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const apps = ['customer_app', 'provider_app'];

const violations = [];
const appSummaries = [];

for (const appName of apps) {
  const libRoot = resolve(root, 'apps', appName, 'lib');
  const dartFiles = listDartFiles(libRoot);
  const summary = {
    app: appName,
    dartFiles: dartFiles.length,
    firebaseReferences: 0,
    supabaseImports: 0,
    presentationSupabaseImports: 0,
    demoAccessReferences: 0,
  };

  for (const file of dartFiles) {
    const source = readFileSync(file, 'utf8');
    const projectPath = normalize(relative(root, file));

    if (hasForbiddenFirebaseReference(source)) {
      summary.firebaseReferences += 1;
      violations.push({
        app: appName,
        file: projectPath,
        rule: 'firebase_scope',
        message: 'Firebase is allowed only for FCM push. Remove Firebase DB/Auth/Firestore/Storage/Functions references.',
      });
    }

    if (source.includes('package:supabase_flutter/supabase_flutter.dart')) {
      summary.supabaseImports += 1;
      if (isPresentationOrScreenFile(projectPath)) {
        summary.presentationSupabaseImports += 1;
        violations.push({
          app: appName,
          file: projectPath,
          rule: 'no_direct_supabase_in_presentation',
          message:
            'Screens, controllers, and presentation providers must use repositories/use cases instead of importing Supabase directly.',
        });
      }
    }

    if (source.includes('Supabase.instance')) {
      violations.push({
        app: appName,
        file: projectPath,
        rule: 'no_supabase_singleton',
        message:
          'Use the injected supabaseClientProvider boundary instead of Supabase.instance so datasources remain testable.',
      });
    }

    if (source.includes('signInDemoCustomer(') || source.includes('signInDemoProvider(')) {
      summary.demoAccessReferences += 1;
      if (projectPath.endsWith('/features/auth/presentation/controllers/auth_controller.dart')) {
        if (
          !source.includes("core/local_demo_access.dart") ||
          !source.includes('ensureLocalDemoAccessEnabled();')
        ) {
          violations.push({
            app: appName,
            file: projectPath,
            rule: 'demo_auth_release_guard',
            message: 'Demo auth controller methods must fail closed through ensureLocalDemoAccessEnabled().',
          });
        }
      } else if (
        !source.includes("core/local_demo_access.dart") ||
        !source.includes('localDemoAccessEnabled')
      ) {
        violations.push({
          app: appName,
          file: projectPath,
          rule: 'demo_auth_ui_release_guard',
          message: 'Every demo auth call site must be gated by localDemoAccessEnabled.',
        });
      }
    }

    if (
      source.includes('Use local demo login') &&
      !/\bif\s*\(\s*localDemoAccessEnabled(?:\s*\)|\s*&&)/.test(source)
    ) {
      violations.push({
        app: appName,
        file: projectPath,
        rule: 'demo_login_visible_copy_release_guard',
        message: 'Visible local demo login controls must render only when localDemoAccessEnabled.',
      });
    }
  }

  const demoAccessSource = readFileSync(resolve(libRoot, 'src', 'core', 'local_demo_access.dart'), 'utf8');
  if (
    !demoAccessSource.includes('const bool localDemoAccessEnabled = kDebugMode;') ||
    !demoAccessSource.includes('ensureLocalDemoAccessEnabled')
  ) {
    violations.push({
      app: appName,
      file: normalize(relative(root, resolve(libRoot, 'src', 'core', 'local_demo_access.dart'))),
      rule: 'demo_access_debug_only',
      message: 'Local demo access must be tied directly to kDebugMode and expose a fail-closed assertion.',
    });
  }

  appSummaries.push(summary);
}

const result = {
  ok: violations.length === 0,
  apps: appSummaries,
  rules: [
    'Firebase is allowed only for FCM push through firebase_core/firebase_messaging.',
    'Supabase imports are allowed in core/data layers, not in main.dart or presentation layers.',
    'Use injected Supabase clients, not Supabase.instance.',
    'Local demo login controls and auth helpers are available only in debug builds.',
  ],
  violations,
};

console.log(JSON.stringify(result, null, 2));

if (!result.ok) {
  process.exitCode = 1;
}

function listDartFiles(directory) {
  const entries = readdirSync(directory, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      return listDartFiles(fullPath);
    }
    return entry.isFile() && entry.name.endsWith('.dart') ? [fullPath] : [];
  });
}

function hasForbiddenFirebaseReference(source) {
  const firebaseImports = Array.from(source.matchAll(/package:firebase_([a-z_]+)\//gi)).map(
    (match) => match[1],
  );
  if (firebaseImports.some((packageName) => !['core', 'messaging'].includes(packageName))) {
    return true;
  }

  return /\bFirebase(Auth|Firestore|Database|Storage|Functions|Analytics|Crashlytics|RemoteConfig|Performance)\b/i.test(
    source,
  );
}

function isPresentationOrScreenFile(projectPath) {
  return (
    projectPath.endsWith('/lib/main.dart') ||
    projectPath.includes('/presentation/') ||
    projectPath.includes('/ui/') ||
    projectPath.includes('/screens/') ||
    projectPath.includes('/pages/')
  );
}

function normalize(value) {
  return value.replaceAll('\\', '/');
}
