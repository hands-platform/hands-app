import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { SettlementsService } from '../settlements/settlements.service';
import { EarningsController } from './earnings.controller';
import { EarningsService } from './earnings.service';

@Module({
  imports: [NotificationsModule],
  controllers: [EarningsController],
  providers: [EarningsService, SettlementsService],
  exports: [EarningsService, SettlementsService],
})
export class EarningsModule {}
