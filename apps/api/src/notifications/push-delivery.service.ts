import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type PushMessage = {
  token: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  providerOverride?: 'in_app_only' | 'onesignal';
};

export type PushSendResult = {
  provider: 'IN_APP_ONLY' | 'ONESIGNAL';
  status: 'SENT' | 'SKIPPED' | 'FAILED';
  disableDevice: boolean;
  failureCode?: string;
  response: Record<string, unknown>;
};

@Injectable()
export class PushDeliveryService {
  constructor(private readonly config: ConfigService) {}

  async send(message: PushMessage): Promise<PushSendResult> {
    const provider =
      message.providerOverride ?? this.config.get<string>('PUSH_PROVIDER')?.trim().toLowerCase() ?? 'in_app_only';

    if (provider === 'onesignal') {
      return this.sendWithOneSignal(message);
    }

    return {
      provider: 'IN_APP_ONLY',
      status: 'SKIPPED',
      disableDevice: false,
      response: {
        reason: 'OS push delivery is disabled. Notification is available in the in-app inbox.',
        tokenPlatform: inferTokenPlatform(message.token),
        title: message.title,
      },
    };
  }

  private async sendWithOneSignal(message: PushMessage): Promise<PushSendResult> {
    const appId = this.config.get<string>('ONESIGNAL_APP_ID')?.trim();
    const restApiKey = this.config.get<string>('ONESIGNAL_REST_API_KEY')?.trim();
    const missing = [
      !appId ? 'ONESIGNAL_APP_ID' : null,
      !restApiKey ? 'ONESIGNAL_REST_API_KEY' : null,
    ].filter(Boolean);

    if (missing.length > 0) {
      return {
        provider: 'ONESIGNAL',
        status: 'FAILED',
        disableDevice: false,
        failureCode: 'PUSH_PROVIDER_NOT_CONFIGURED',
        response: {
          reason: 'OneSignal push delivery is selected, but required server-side credentials are missing.',
          missing,
          tokenPlatform: inferTokenPlatform(message.token),
          title: message.title,
        },
      };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8_000);

    try {
      const response = await fetch('https://onesignal.com/api/v1/notifications', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${restApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          app_id: appId,
          include_subscription_ids: [message.token],
          headings: { en: message.title },
          contents: { en: message.body },
          data: message.data ?? {},
        }),
        signal: controller.signal,
      });
      const payload = await readJsonResponse(response);
      const recipients = Number(payload.recipients ?? 0);
      const disableDevice = hasInvalidOneSignalDevice(payload);

      if (response.ok && recipients > 0) {
        return {
          provider: 'ONESIGNAL',
          status: 'SENT',
          disableDevice: false,
          response: {
            oneSignalId: payload.id,
            recipients,
            tokenPlatform: inferTokenPlatform(message.token),
          },
        };
      }

      return {
        provider: 'ONESIGNAL',
        status: 'FAILED',
        disableDevice,
        failureCode: disableDevice ? 'ONESIGNAL_INVALID_SUBSCRIPTION' : oneSignalFailureCode(response.status, payload),
        response: {
          httpStatus: response.status,
          recipients,
          tokenPlatform: inferTokenPlatform(message.token),
          payload,
        },
      };
    } catch (error) {
      return {
        provider: 'ONESIGNAL',
        status: 'FAILED',
        disableDevice: false,
        failureCode:
          error instanceof DOMException && error.name === 'AbortError' ? 'ONESIGNAL_TIMEOUT' : 'ONESIGNAL_ERROR',
        response: {
          reason: error instanceof Error ? error.message : 'Unknown OneSignal delivery error.',
          tokenPlatform: inferTokenPlatform(message.token),
        },
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}

async function readJsonResponse(response: Response): Promise<Record<string, unknown>> {
  try {
    const payload = await response.json();
    if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
      return payload as Record<string, unknown>;
    }
  } catch {
    // Non-JSON response bodies are treated as empty delivery payloads.
  }

  return {};
}

function hasInvalidOneSignalDevice(payload: Record<string, unknown>) {
  const errors = payload.errors;
  if (!errors || typeof errors !== 'object' || Array.isArray(errors)) {
    return false;
  }

  const invalidPlayers = (errors as Record<string, unknown>).invalid_player_ids;
  return Array.isArray(invalidPlayers) && invalidPlayers.length > 0;
}

function oneSignalFailureCode(httpStatus: number, payload: Record<string, unknown>) {
  if (httpStatus === 401 || httpStatus === 403) {
    return 'ONESIGNAL_AUTH_FAILED';
  }

  if (httpStatus === 429) {
    return 'ONESIGNAL_RATE_LIMITED';
  }

  if (Number(payload.recipients ?? 0) === 0) {
    return 'ONESIGNAL_NO_RECIPIENTS';
  }

  return 'ONESIGNAL_DELIVERY_FAILED';
}

function inferTokenPlatform(token: string) {
  if (token.startsWith('ios')) {
    return 'ios';
  }

  if (token.startsWith('web')) {
    return 'web';
  }

  return 'android';
}
