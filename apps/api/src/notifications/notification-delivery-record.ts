import type { PushSendResult } from './push-delivery.service';
import {
  notificationDeliveryResponse,
  toJson,
} from './notification-push-payload';

export function notificationDeliveryCreateInput(input: {
  notificationId: string;
  pushDeviceId: string;
  pushToken: string;
  result: PushSendResult;
}) {
  return {
    data: {
      notificationId: input.notificationId,
      pushDeviceId: input.pushDeviceId,
      provider: input.result.provider,
      status: input.result.status,
      response: toJson(notificationDeliveryResponse(input.result, input.pushToken)),
    },
  };
}

export function notificationDeliveryJobResult(input: {
  deviceId: string;
  result: PushSendResult;
}) {
  return {
    deviceId: input.deviceId,
    status: input.result.status,
    provider: input.result.provider,
    disableDevice: input.result.disableDevice,
    failureCode: input.result.failureCode,
  };
}
