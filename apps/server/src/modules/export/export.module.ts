import { Module } from '@nestjs/common';
import { ExportController } from './export.controller';
import { ExportService } from './export.service';
import { FileModule } from '../file/file.module';

@Module({ imports: [FileModule], controllers: [ExportController], providers: [ExportService] })
export class ExportModule {}
