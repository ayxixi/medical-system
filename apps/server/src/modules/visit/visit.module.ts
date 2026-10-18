import { Module } from '@nestjs/common';
import { VisitController } from './visit.controller';
import { VisitRepository } from './visit.repository';
import { VisitService } from './visit.service';

@Module({
  controllers: [VisitController],
  providers: [VisitService, VisitRepository],
  exports: [VisitService],
})
export class VisitModule {}
