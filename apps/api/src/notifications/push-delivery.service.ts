import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { applicationDefault, cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getMessaging, type Messaging } from 'firebase-admin/messaging';
import {
  firebaseCredentialReadiness,
  parseFirebaseServiceAccount,
  readFirebaseCredentialConfig,
  type FirebaseCredentialConfig,
} from './firebase-admin-credentials';
import { firebaseFailureCode, isPermanentTokenFailure, safeErrorMessage } from './push-delivery-error';
import { resolvePushProvider, type PushProvider } from './push-provider';

export const FCM_ANDROID_NOTIFICATION_CHANNEL_ID = 'hands_priority_alerts';

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
  private messaging?: Messaging;

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
        reason: 'OS push delivery is disabled. Notification is available in the in-app inbox.',
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
          reason: 'FCM push delivery is selected, but required server-side credentials are missing.',
          missing: readiness.missing,
          invalid: readiness.invalid,
          title: message.title,
        },
      };
    }

    try {
      const messaging = this.getMessagingClient();
      const messageId = await messaging.send({
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
          },
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
            },
          },
        },
      });

      return {
        provider: 'FCM',
        status: 'SENT',
        disableDevice: false,
        response: {
          messageId,
        },
      };
    } catch (error) {
      const failureCode = firebaseFailureCode(error);
      return {
        provider: 'FCM',
        status: 'FAILED',
        disableDevice: isPermanentTokenFailure(failureCode),
        failureCode,
        response: {
          reason: safeErrorMessage(error, message.token),
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

  private getMessagingClient() {
    if (this.messaging) {
      return this.messaging;
    }

    const { config } = this.fcmReadiness();
    const app =
      getApps().find((candidate) => candidate.name === 'hands-fcm') ?? initializeFirebaseApp(config);
    this.messaging = getMessaging(app);
    return this.messaging;
  }

  private readFirebaseConfig(): FirebaseCredentialConfig {
    return readFirebaseCredentialConfig(this.config);
  }
}

function initializeFirebaseApp(config: FirebaseCredentialConfig): App {
  if (config.serviceAccountJson) {
    return initializeApp(
      { credential: cert(parseFirebaseServiceAccount(config.serviceAccountJson)) },
      'hands-fcm',
    );
  }

  if (config.projectId && config.clientEmail && config.privateKey) {
    return initializeApp(
      {
        credential: cert({
          projectId: config.projectId,
          clientEmail: config.clientEmail,
          privateKey: config.privateKey,
        }),
      },
      'hands-fcm',
    );
  }

  return initializeApp({ credential: applicationDefault() }, 'hands-fcm');
}
