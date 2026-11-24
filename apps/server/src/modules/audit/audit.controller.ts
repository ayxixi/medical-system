import { Controller, Get, Query } from '@nestjs/common';
import { CurrentAccount, AuthenticatedAccount } from '../auth/decorators/current-account.decorator';
import { AuditService } from './audit.service';
import { ListAuditLogsQueryDto } from './dto/list-audit-logs-query.dto';

@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  list(@CurrentAccount() account: AuthenticatedAccount, @Query() query: ListAuditLogsQueryDto) {
    return this.auditService.listForAccount(account.id, query.limit, query.cursor);
  }
}
