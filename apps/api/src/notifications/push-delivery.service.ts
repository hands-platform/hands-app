import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleAuth, JWT } from 'google-auth-library';
import {
  firebaseProjectIdFromConfig,
  firebaseCredentialReadiness,
  parseFirebaseServiceAccount,
  readFirebaseCredentialConfig,
  type FirebaseCredentialConfig,
} from './firebase-admin-credentials';
import { firebaseFailureCode, isPermanentTokenError, safeErrorMessage } from './push-delivery-error';
import { resolvePushProvider, type PushProvider } from './push-provider';

export const FCM_ANDROID_NOTIFICATION_CHANNEL_ID = 'hands_priority_alerts';
const FCM_MESSAGING_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';
const DEFAULT_FCM_HTTP_TIMEOUT_MS = 15_000;
const MIN_FCM_HTTP_TIMEOUT_MS = 1_000;
const MAX_FCM_HTTP_TIMEOUT_MS = 60_000;

export type PushMessage = {
  token: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  providerOverride?: PushProvider;
};

export type PushSendResult = {
  provider: 'IN_APP_ONLY' | 'FCM';
  status: 'SENT' | 'SKIPPED' | 'FAILED';
  disableDevice: boolean;
  failureCode?: string;
  response: Record<string, unknown>;
};

@Injectable()
export class PushDeliveryService {
  constructor(private readonly config: ConfigService) {}

  async send(message: PushMessage): Promise<PushSendResult> {
    const provider = this.resolveProvider(message.providerOverride);

    if (provider === 'fcm') {
      return this.sendWithFcm(message);
    }

    return {
      provider: 'IN_APP_ONLY',
      status: 'SKIPPED',
      disableDevice: false,
      response: {
        reason: 'FCM push delivery is disabled. Notification is available in the in-app inbox.',
        title: message.title,
      },
    };
  }

  private resolveProvider(providerOverride?: PushProvider): PushProvider {
    return resolvePushProvider({
      configured: this.config.get<string>('PUSH_PROVIDER'),
      override: providerOverride,
    });
  }

  private async sendWithFcm(message: PushMessage): Promise<PushSendResult> {
    const readiness = this.fcmReadiness();

    if (readiness.missing.length > 0 || readiness.invalid.length > 0) {
      return {
        provider: 'FCM',
        status: 'FAILED',
        disableDevice: false,
        failureCode: 'PUSH_PROVIDER_NOT_CONFIGURED',
        response: {
          reason:
            'FCM push delivery is selected, but required server-side credentials are missing or invalid.',
          missing: readiness.missing,
          invalid: readiness.invalid,
          title: message.title,
        },
      };
    }

    try {
      const { accessToken, projectId } = await this.fcmAccess();
      const notificationDeduplicationId = fcmNotificationDeduplicationId(message.data);
      const response = await fetch(fcmSendUrl(projectId), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: {
            token: message.token,
            notification: {
              title: message.title,
              body: message.body,
            },
            data: message.data ?? {},
            android: {
              priority: 'high',
              notification: {
                channelId: FCM_ANDROID_NOTIFICATION_CHANNEL_ID,
                ...(notificationDeduplicationId ? { tag: notificationDeduplicationId } : {}),
              },
            },
            apns: {
              ...(notificationDeduplicationId
                ? { headers: { 'apns-collapse-id': notificationDeduplicationId } }
                : {}),
              payload: {
                aps: {
                  sound: 'default',
                },
              },
            },
          },
        }),
        signal: AbortSignal.timeout(this.fcmHttpTimeoutMs()),
      });

      if (!response.ok) {
        throw await fcmHttpError(response);
      }

      const result = (await response.json()) as { name?: unknown };
      const messageId = typeof result.name === 'string' ? result.name : 'fcm-message-sent';

      return {
        provider: 'FCM',
        status: 'SENT',
        disableDevice: false,
        response: {
          messageId,
        },
      };
    } catch (error) {
      const failureCode = fcmDeliveryFailureCode(error);
      const reason = safeErrorMessage(error, message.token);
      return {
        provider: 'FCM',
        status: 'FAILED',
        disableDevice: isPermanentTokenError(failureCode, reason),
        failureCode,
        response: {
          reason,
        },
      };
    }
  }

  private fcmReadiness() {
    const credentialConfig = this.readFirebaseConfig();
    const readiness = firebaseCredentialReadiness(credentialConfig);

    return {
      config: credentialConfig,
      missing: readiness.missing,
      invalid: readiness.invalid,
    };
  }

  private async fcmAccess() {
    const { config } = this.fcmReadiness();
    const projectId = firebaseProjectIdFromConfig(config);
    const accessToken = await fcmAccessToken(config);

    if (!projectId) {
      throw Object.assign(new Error('FCM project ID is missing from server credentials.'), {
        code: 'PUSH_PROVIDER_NOT_CONFIGURED',
      });
    }

    return { accessToken, projectId };
  }

  private readFirebaseConfig(): FirebaseCredentialConfig {
    return readFirebaseCredentialConfig(this.config);
  }

  private fcmHttpTimeoutMs() {
    const configured = Number(this.config.get<string>('FCM_HTTP_TIMEOUT_MS'));
    return Number.isInteger(configured) &&
        configured >= MIN_FCM_HTTP_TIMEOUT_MS &&
        configured <= MAX_FCM_HTTP_TIMEOUT_MS
      ? configured
      : DEFAULT_FCM_HTTP_TIMEOUT_MS;
  }
}

async function fcmAccessToken(config: FirebaseCredentialConfig) {
  if (config.serviceAccountJson) {
    return serviceAccountAccessToken(parseFirebaseServiceAccount(config.serviceAccountJson));
  }

  if (config.projectId && config.clientEmail && config.privateKey) {
    return serviceAccountAccessToken({
      projectId: config.projectId,
      clientEmail: config.clientEmail,
      privateKey: config.privateKey,
    });
  }

  if (config.googleApplicationCredentials) {
    const auth = new GoogleAuth({
      keyFile: config.googleApplicationCredentials,
      scopes: [FCM_MESSAGING_SCOPE],
    });
    const client = await auth.getClient();
    return normalizeAccessToken(await client.getAccessToken());
  }

  throw Object.assign(new Error('FCM server credentials are missing.'), {
    code: 'PUSH_PROVIDER_NOT_CONFIGURED',
  });
}

async function serviceAccountAccessToken(serviceAccount: {
  projectId?: string;
  clientEmail?: string;
  privateKey?: string;
}) {
  const client = new JWT({
    email: serviceAccount.clientEmail,
    key: serviceAccount.privateKey,
    scopes: [FCM_MESSAGING_SCOPE],
  });

  return normalizeAccessToken(await client.getAccessToken());
}

function normalizeAccessToken(value: unknown) {
  if (typeof value === 'string' && value) {
    return value;
  }

  if (value && typeof value === 'object' && 'token' in value) {
    const token = (value as { token?: unknown }).token;
    if (typeof token === 'string' && token) {
      return token;
    }
  }

  throw Object.assign(new Error('FCM access token could not be created.'), {
    code: 'PUSH_PROVIDER_NOT_CONFIGURED',
  });
}

function fcmSendUrl(projectId: string) {
  return `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/messages:send`;
}

function fcmNotificationDeduplicationId(data?: Record<string, string>) {
  const notificationId = data?.notificationId?.trim();
  return notificationId ? notificationId.slice(0, 64) : undefined;
}

function fcmDeliveryFailureCode(error: unknown) {
  if (error instanceof DOMException && error.name === 'TimeoutError') {
    return 'FCM_DELIVERY_TIMEOUT';
  }
  const code = firebaseFailureCode(error);
  return code === 'FCM_DELIVERY_FAILED' ? 'FCM_DELIVERY_UNAVAILABLE' : code;
}

async function fcmHttpError(response: Response) {
  const payload = await readFcmErrorPayload(response);
  const fcmError = payload?.error;
  const code = fcmErrorCode(fcmError) ?? fcmError?.status ?? `HTTP_${response.status}`;
  const reason = fcmError?.message ?? `FCM request failed with HTTP ${response.status}.`;

  return Object.assign(new Error(reason), { code });
}

async function readFcmErrorPayload(response: Response) {
  try {
    return (await response.json()) as {
      error?: {
        status?: string;
        message?: string;
        details?: Array<Record<string, unknown>>;
      };
    };
  } catch {
    return undefined;
  }
}

function fcmErrorCode(error?: { details?: Array<Record<string, unknown>> }) {
  const detail = error?.details?.find(
    (candidate) => typeof candidate.errorCode === 'string' && candidate.errorCode.length > 0,
  );

  return typeof detail?.errorCode === 'string' ? detail.errorCode : undefined;
}
