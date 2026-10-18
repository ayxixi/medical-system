import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateMedicationDto } from './dto/create-medication.dto';
import { UpdateMedicationDto } from './dto/update-medication.dto';
import { MedicationRepository } from './medication.repository';

@Injectable()
export class MedicationService {
  constructor(private readonly medicationRepository: MedicationRepository) {}

  async create(accountId: string, createMedicationDto: CreateMedicationDto) {
    const visitExists = await this.medicationRepository.visitExistsForAccount(
      createMedicationDto.visitId,
      accountId,
    );

    if (!visitExists) {
      throw new NotFoundException('就诊记录不存在');
    }

    return this.medicationRepository.create({
      visitId: createMedicationDto.visitId,
      name: createMedicationDto.name,
      dosage: createMedicationDto.dosage,
      frequency: createMedicationDto.frequency,
      duration: createMedicationDto.duration,
    });
  }

  async findManyByVisitId(accountId: string, visitId: string) {
    const visitExists = await this.medicationRepository.visitExistsForAccount(
      visitId,
      accountId,
    );

    if (!visitExists) {
      throw new NotFoundException('就诊记录不存在');
    }

    return this.medicationRepository.findManyByVisitId(visitId);
  }

  async update(
    accountId: string,
    id: string,
    updateMedicationDto: UpdateMedicationDto,
  ) {
    const medication = await this.medicationRepository.updateForAccount(
      id,
      accountId,
      {
        name: updateMedicationDto.name,
        dosage: updateMedicationDto.dosage,
        frequency: updateMedicationDto.frequency,
        duration: updateMedicationDto.duration,
      },
    );

    if (!medication) {
      throw new NotFoundException('用药记录不存在');
    }

    return medication;
  }

  async remove(accountId: string, id: string) {
    const deleted = await this.medicationRepository.deleteForAccount(
      id,
      accountId,
    );

    if (!deleted) {
      throw new NotFoundException('用药记录不存在');
    }

    return { id };
  }
}
