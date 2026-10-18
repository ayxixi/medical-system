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
import { CreateMedicationDto } from './dto/create-medication.dto';
import { UpdateMedicationDto } from './dto/update-medication.dto';
import { MedicationService } from './medication.service';

@Controller()
export class MedicationController {
  constructor(private readonly medicationService: MedicationService) {}

  @Post('medications')
  create(
    @CurrentAccount() account: AuthenticatedAccount,
    @Body() createMedicationDto: CreateMedicationDto,
  ) {
    return this.medicationService.create(account.id, createMedicationDto);
  }

  @Get('visits/:visitId/medications')
  findManyByVisitId(
    @CurrentAccount() account: AuthenticatedAccount,
    @Param('visitId') visitId: string,
  ) {
    return this.medicationService.findManyByVisitId(account.id, visitId);
  }

  @Patch('medications/:id')
  update(
    @CurrentAccount() account: AuthenticatedAccount,
    @Param('id') id: string,
    @Body() updateMedicationDto: UpdateMedicationDto,
  ) {
    return this.medicationService.update(account.id, id, updateMedicationDto);
  }

  @Delete('medications/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentAccount() account: AuthenticatedAccount,
    @Param('id') id: string,
  ) {
    await this.medicationService.remove(account.id, id);
  }
}
