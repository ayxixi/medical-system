import { Module } from '@nestjs/common';
import { RecordController } from './record.controller';
import { RecordRepository } from './record.repository';
import { RecordService } from './record.service';

@Module({
  controllers: [RecordController],
  providers: [RecordService, RecordRepository],
})
export class RecordModule {}
