import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AttachmentCleanupService } from './attachment-cleanup.service';
import { FileController } from './file.controller';
import { FileRepository } from './file.repository';
import { FileService } from './file.service';
import { LocalStorageService } from './storage/local-storage.service';
import { S3StorageService } from './storage/s3-storage.service';
import { FILE_STORAGE_SERVICE } from './storage/storage.interface';

@Module({
  controllers: [FileController],
  providers: [
    AttachmentCleanupService,
    FileService,
    FileRepository,
    LocalStorageService,
    S3StorageService,
    {
      provide: FILE_STORAGE_SERVICE,
      inject: [ConfigService, LocalStorageService, S3StorageService],
      useFactory: (
        configService: ConfigService,
        localStorageService: LocalStorageService,
        s3StorageService: S3StorageService,
      ) => {
        const provider = configService.get<string>('FILE_STORAGE', 'local');

        return provider === 's3' ? s3StorageService : localStorageService;
      },
    },
  ],
})
export class FileModule {}
