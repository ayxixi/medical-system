import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { EnvModule } from './config/env.module';
import { AuthModule } from './modules/auth/auth.module';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
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
    UserModule,
    VisitModule,
    RecordModule,
    MedicationModule,
    FileModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
