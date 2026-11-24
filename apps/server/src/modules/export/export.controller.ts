import { Controller, Get, Res, StreamableFile } from '@nestjs/common';
import type { Response } from 'express';
import { CurrentAccount, AuthenticatedAccount } from '../auth/decorators/current-account.decorator';
import { ExportService } from './export.service';

@Controller('export')
export class ExportController {
  constructor(private readonly exportService: ExportService) {}

  @Get()
  exportAccount(@CurrentAccount() account: AuthenticatedAccount) {
    return this.exportService.exportAccount(account.id);
  }

  @Get('archive')
  async exportAccountArchive(
    @CurrentAccount() account: AuthenticatedAccount,
    @Res({ passthrough: true }) response: Response,
  ) {
    const date = new Date().toISOString().slice(0, 10);
    response.setHeader('Content-Type', 'application/zip');
    response.setHeader('Content-Disposition', `attachment; filename="medical-records-${date}.zip"`);
    response.setHeader('Cache-Control', 'private, no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    return new StreamableFile(await this.exportService.exportAccountArchive(account.id));
  }
}
