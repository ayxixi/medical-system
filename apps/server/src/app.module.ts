import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { HealthController } from './health.controller';
import { EnvModule } from './config/env.module';
import { AuthModule } from './modules/auth/auth.module';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { AuditModule } from './modules/audit/audit.module';
import { AuditInterceptor } from './modules/audit/audit.interceptor';
import { ExportModule } from './modules/export/export.module';
import { RecognitionModule } from './modules/recognition/recognition.module';
import { FileModule } from './modules/file/file.module';
import { MedicationModule } from './modules/medication/medication.module';
import { RecordModule } from './modules/record/record.module';
import { UserModule } from './modules/user/user.module';
import { VisitModule } from './modules/visit/visit.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    EnvModule,
    PrismaModule,
    AuthModule,
    AuditModule,
    ExportModule,
    RecognitionModule,
    UserModule,
    VisitModule,
    RecordModule,
    MedicationModule,
    FileModule,
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
  ],
})
export class AppModule {}
