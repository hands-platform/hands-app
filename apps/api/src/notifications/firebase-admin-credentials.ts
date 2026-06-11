import { ConfigService } from '@nestjs/config';

export const FCM_CREDENTIAL_REQUIREMENT =
  'FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_PROJECT_ID/FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY or GOOGLE_APPLICATION_CREDENTIALS';

export type FirebaseCredentialConfig = {
  projectId?: string;
  clientEmail?: string;
  privateKey?: string;
  serviceAccountJson?: string;
  googleApplicationCredentials?: string;
};

export function readFirebaseCredentialConfig(config: ConfigService): FirebaseCredentialConfig {
  return {
    projectId: config.get<string>('FIREBASE_PROJECT_ID')?.trim(),
    clientEmail: config.get<string>('FIREBASE_CLIENT_EMAIL')?.trim(),
    privateKey: normalizePrivateKey(config.get<string>('FIREBASE_PRIVATE_KEY')?.trim()),
    serviceAccountJson: config.get<string>('FIREBASE_SERVICE_ACCOUNT_JSON')?.trim(),
    googleApplicationCredentials: config.get<string>('GOOGLE_APPLICATION_CREDENTIALS')?.trim(),
  };
}

export function firebaseCredentialReadiness(config: FirebaseCredentialConfig) {
  const hasJson = Boolean(config.serviceAccountJson);
  const hasFieldCredentials = Boolean(config.projectId && config.clientEmail && config.privateKey);
  const hasApplicationDefault = Boolean(config.googleApplicationCredentials);

  return {
    ready: hasJson || hasFieldCredentials || hasApplicationDefault,
    missing: hasJson || hasFieldCredentials || hasApplicationDefault ? [] : [FCM_CREDENTIAL_REQUIREMENT],
  };
}

export function configuredFirebaseCredentialKeys(config: FirebaseCredentialConfig) {
  return [
    config.serviceAccountJson ? 'FIREBASE_SERVICE_ACCOUNT_JSON' : null,
    config.projectId ? 'FIREBASE_PROJECT_ID' : null,
    config.clientEmail ? 'FIREBASE_CLIENT_EMAIL' : null,
    config.privateKey ? 'FIREBASE_PRIVATE_KEY' : null,
    config.googleApplicationCredentials ? 'GOOGLE_APPLICATION_CREDENTIALS' : null,
  ].filter((key): key is string => Boolean(key));
}

export function normalizePrivateKey(value?: string) {
  return value?.replace(/\\n/g, '\n');
}
