import { Controller, Get } from '@nestjs/common';
import { CurrentAccount, AuthenticatedAccount } from '../auth/decorators/current-account.decorator';
import { ExportService } from './export.service';

@Controller('export')
export class ExportController {
  constructor(private readonly exportService: ExportService) {}

  @Get()
  exportAccount(@CurrentAccount() account: AuthenticatedAccount) {
    return this.exportService.exportAccount(account.id);
  }
}
