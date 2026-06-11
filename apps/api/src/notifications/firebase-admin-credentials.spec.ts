import {
  configuredFirebaseCredentialKeys,
  firebaseCredentialReadiness,
  normalizePrivateKey,
  parseFirebaseServiceAccount,
  readFirebaseCredentialConfig,
} from './firebase-admin-credentials';

describe('Firebase Admin credential helpers', () => {
  it('reads trimmed Firebase credential fields from config', () => {
    const config = {
      get: jest.fn((key: string) => {
        const values: Record<string, string> = {
          FIREBASE_PROJECT_ID: ' hands-demo ',
          FIREBASE_CLIENT_EMAIL: ' firebase-admin@example.test ',
          FIREBASE_PRIVATE_KEY: 'line-1\\nline-2',
        };
        return values[key];
      }),
    };

    expect(readFirebaseCredentialConfig(config as never)).toEqual({
      projectId: 'hands-demo',
      clientEmail: 'firebase-admin@example.test',
      privateKey: 'line-1\nline-2',
      serviceAccountJson: undefined,
      googleApplicationCredentials: undefined,
    });
  });

  it('reports readiness from any supported credential source', () => {
    expect(firebaseCredentialReadiness({ serviceAccountJson: '{}' })).toEqual({
      ready: true,
      missing: [],
    });
    expect(
      firebaseCredentialReadiness({
        projectId: 'hands-demo',
        clientEmail: 'firebase-admin@example.test',
        privateKey: 'private-key',
      }),
    ).toEqual({ ready: true, missing: [] });
    expect(firebaseCredentialReadiness({}).ready).toBe(false);
  });

  it('lists configured credential keys without exposing values', () => {
    expect(
      configuredFirebaseCredentialKeys({
        clientEmail: 'firebase-admin@example.test',
        googleApplicationCredentials: 'path',
        privateKey: 'private-key',
        projectId: 'hands-demo',
        serviceAccountJson: '{}',
      }),
    ).toEqual([
      'FIREBASE_SERVICE_ACCOUNT_JSON',
      'FIREBASE_PROJECT_ID',
      'FIREBASE_CLIENT_EMAIL',
      'FIREBASE_PRIVATE_KEY',
      'GOOGLE_APPLICATION_CREDENTIALS',
    ]);
  });

  it('parses raw and base64 service account JSON', () => {
    const json = JSON.stringify({
      project_id: 'hands-demo',
      client_email: 'firebase-admin@example.test',
      private_key: 'line-1\\nline-2',
    });
    const expected = {
      projectId: 'hands-demo',
      clientEmail: 'firebase-admin@example.test',
      privateKey: 'line-1\nline-2',
    };

    expect(parseFirebaseServiceAccount(json)).toEqual(expected);
    expect(parseFirebaseServiceAccount(Buffer.from(json, 'utf8').toString('base64'))).toEqual(expected);
    expect(normalizePrivateKey('line-1\\nline-2')).toBe('line-1\nline-2');
  });
});
