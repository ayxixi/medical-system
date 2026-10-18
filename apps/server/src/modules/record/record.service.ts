import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateRecordDto } from './dto/create-record.dto';
import { UpdateRecordDto } from './dto/update-record.dto';
import { RecordRepository } from './record.repository';

@Injectable()
export class RecordService {
  constructor(private readonly recordRepository: RecordRepository) {}

  async create(accountId: string, createRecordDto: CreateRecordDto) {
    const visitExists = await this.recordRepository.visitExistsForAccount(
      createRecordDto.visitId,
      accountId,
    );

    if (!visitExists) {
      throw new NotFoundException('就诊记录不存在');
    }

    return this.recordRepository.create({
      visitId: createRecordDto.visitId,
      diagnosis: createRecordDto.diagnosis,
    });
  }

  async findManyByVisitId(accountId: string, visitId: string) {
    const visitExists = await this.recordRepository.visitExistsForAccount(
      visitId,
      accountId,
    );

    if (!visitExists) {
      throw new NotFoundException('就诊记录不存在');
    }

    return this.recordRepository.findManyByVisitId(visitId);
  }

  async update(
    accountId: string,
    id: string,
    updateRecordDto: UpdateRecordDto,
  ) {
    const record = await this.recordRepository.updateForAccount(
      id,
      accountId,
      { diagnosis: updateRecordDto.diagnosis },
    );

    if (!record) {
      throw new NotFoundException('诊断记录不存在');
    }

    return record;
  }

  async remove(accountId: string, id: string) {
    const deleted = await this.recordRepository.deleteForAccount(id, accountId);

    if (!deleted) {
      throw new NotFoundException('诊断记录不存在');
    }

    return { id };
  }
}
