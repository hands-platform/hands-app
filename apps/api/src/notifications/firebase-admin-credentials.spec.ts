import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  configuredFirebaseCredentialKeys,
  firebaseCredentialReadiness,
  hasValidFirebaseServiceAccountJson,
  normalizePrivateKey,
  parseFirebaseServiceAccount,
  readFirebaseCredentialConfig,
} from './firebase-admin-credentials';

describe('Firebase Admin credential helpers', () => {
  let tempDir: string | undefined;
  const validServiceAccountJson = JSON.stringify({
    project_id: 'hands-demo',
    client_email: 'firebase-admin@example.test',
    private_key: 'private-key',
  });

  afterEach(() => {
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
      tempDir = undefined;
    }
  });

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
    expect(firebaseCredentialReadiness({ serviceAccountJson: validServiceAccountJson })).toEqual({
      ready: true,
      missing: [],
      invalid: [],
    });
    expect(
      firebaseCredentialReadiness({
        projectId: 'hands-demo',
        clientEmail: 'firebase-admin@example.test',
        privateKey: 'private-key',
      }),
    ).toEqual({ ready: true, missing: [], invalid: [] });
    expect(
      firebaseCredentialReadiness({
        serviceAccountJson: validServiceAccountJson,
        googleApplicationCredentials: 'C:\\secure\\missing-firebase-admin.json',
      }),
    ).toEqual({ ready: true, missing: [], invalid: [] });
    expect(firebaseCredentialReadiness({}).ready).toBe(false);
  });

  it('rejects malformed service account JSON before Firebase Admin initialization', () => {
    expect(firebaseCredentialReadiness({ serviceAccountJson: '{}' })).toEqual({
      ready: false,
      missing: [],
      invalid: ['FIREBASE_SERVICE_ACCOUNT_JSON'],
    });
    expect(firebaseCredentialReadiness({ serviceAccountJson: 'not-json' })).toEqual({
      ready: false,
      missing: [],
      invalid: ['FIREBASE_SERVICE_ACCOUNT_JSON'],
    });
  });

  it('requires application default credentials to point to an existing file', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'hands-fcm-'));
    const serviceAccountPath = join(tempDir, 'firebase-admin.json');
    writeFileSync(serviceAccountPath, '{}');

    expect(firebaseCredentialReadiness({ googleApplicationCredentials: serviceAccountPath })).toEqual({
      ready: true,
      missing: [],
      invalid: [],
    });
    expect(
      firebaseCredentialReadiness({ googleApplicationCredentials: join(tempDir, 'missing.json') }),
    ).toEqual({
      ready: false,
      missing: [],
      invalid: ['GOOGLE_APPLICATION_CREDENTIALS'],
    });
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
    expect(hasValidFirebaseServiceAccountJson(json)).toBe(true);
    expect(hasValidFirebaseServiceAccountJson(Buffer.from(json, 'utf8').toString('base64'))).toBe(true);
    expect(hasValidFirebaseServiceAccountJson('{}')).toBe(false);
    expect(normalizePrivateKey('line-1\\nline-2')).toBe('line-1\nline-2');
  });
});
