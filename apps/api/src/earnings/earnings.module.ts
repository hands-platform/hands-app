import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { EarningsController } from './earnings.controller';
import { EarningsService } from './earnings.service';

@Module({
  imports: [NotificationsModule],
  controllers: [EarningsController],
  providers: [EarningsService],
  exports: [EarningsService],
})
export class EarningsModule {}
