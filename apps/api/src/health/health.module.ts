import { Module } from '@nestjs/common';
import { AdminModule } from '../admin/admin.module';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

@Module({
  imports: [AdminModule],
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
