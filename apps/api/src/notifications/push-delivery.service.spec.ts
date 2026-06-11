import { ConfigService } from '@nestjs/config';
import { PushDeliveryService } from './push-delivery.service';

function pushService(env: Record<string, string | undefined>) {
  return new PushDeliveryService(new ConfigService(env));
}

describe('PushDeliveryService', () => {
  const message = {
    token: 'fcm-demo-token',
    title: 'Booking update',
    body: 'A booking update is available.',
    data: { bookingId: 'booking-1' },
  };

  it('keeps local delivery in-app only by default', async () => {
    await expect(pushService({}).send(message)).resolves.toMatchObject({
      provider: 'IN_APP_ONLY',
      status: 'SKIPPED',
      disableDevice: false,
    });
  });

  it('fails safely when FCM is selected without Firebase Admin credentials', async () => {
    await expect(pushService({ PUSH_PROVIDER: 'fcm' }).send(message)).resolves.toMatchObject({
      provider: 'FCM',
      status: 'FAILED',
      disableDevice: false,
      failureCode: 'PUSH_PROVIDER_NOT_CONFIGURED',
    });
  });
});
