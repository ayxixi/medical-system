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
  Query,
} from '@nestjs/common';
import {
  AuthenticatedAccount,
  CurrentAccount,
} from '../auth/decorators/current-account.decorator';
import { CreateVisitDto } from './dto/create-visit.dto';
import { ListVisitsQueryDto } from './dto/list-visits.query';
import { UpdateVisitDto } from './dto/update-visit.dto';
import { VisitService } from './visit.service';

@Controller('visits')
export class VisitController {
  constructor(private readonly visitService: VisitService) {}

  @Post()
  create(
    @CurrentAccount() account: AuthenticatedAccount,
    @Body() createVisitDto: CreateVisitDto,
  ) {
    return this.visitService.create(account.id, createVisitDto);
  }

  @Get()
  findMany(
    @CurrentAccount() account: AuthenticatedAccount,
    @Query() query: ListVisitsQueryDto,
  ) {
    return this.visitService.findMany(account.id, query);
  }

  @Get(':id')
  findById(
    @CurrentAccount() account: AuthenticatedAccount,
    @Param('id') id: string,
  ) {
    return this.visitService.findById(account.id, id);
  }

  @Patch(':id')
  update(
    @CurrentAccount() account: AuthenticatedAccount,
    @Param('id') id: string,
    @Body() updateVisitDto: UpdateVisitDto,
  ) {
    return this.visitService.update(account.id, id, updateVisitDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentAccount() account: AuthenticatedAccount,
    @Param('id') id: string,
  ) {
    await this.visitService.remove(account.id, id);
  }
}
