import { Module } from '@nestjs/common';
import { HealthLogController } from './health-log.controller';
import { HealthLogRepository } from './health-log.repository';
import { HealthLogService } from './health-log.service';

@Module({
  controllers: [HealthLogController],
  providers: [HealthLogService, HealthLogRepository],
})
export class HealthLogModule {}
