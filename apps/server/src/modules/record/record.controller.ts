import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import {
  AuthenticatedAccount,
  CurrentAccount,
} from '../auth/decorators/current-account.decorator';
import { CreateRecordDto } from './dto/create-record.dto';
import { UpdateRecordDto } from './dto/update-record.dto';
import { RecordService } from './record.service';

@Controller()
export class RecordController {
  constructor(private readonly recordService: RecordService) {}

  @Post('records')
  create(
    @CurrentAccount() account: AuthenticatedAccount,
    @Body() createRecordDto: CreateRecordDto,
  ) {
    return this.recordService.create(account.id, createRecordDto);
  }

  @Get('visits/:visitId/records')
  findManyByVisitId(
    @CurrentAccount() account: AuthenticatedAccount,
    @Param('visitId') visitId: string,
  ) {
    return this.recordService.findManyByVisitId(account.id, visitId);
  }

  @Patch('records/:id')
  update(
    @CurrentAccount() account: AuthenticatedAccount,
    @Param('id') id: string,
    @Body() updateRecordDto: UpdateRecordDto,
  ) {
    return this.recordService.update(account.id, id, updateRecordDto);
  }

  @Delete('records/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentAccount() account: AuthenticatedAccount,
    @Param('id') id: string,
  ) {
    await this.recordService.remove(account.id, id);
  }
}
