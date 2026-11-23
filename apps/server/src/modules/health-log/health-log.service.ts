import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateHealthLogDto } from './dto/create-health-log.dto';
import { ListHealthLogsQueryDto } from './dto/list-health-logs.query';
import { UpdateHealthLogDto } from './dto/update-health-log.dto';
import { HealthLogRepository } from './health-log.repository';
import { HealthLogType } from './health-log.types';

@Injectable()
export class HealthLogService {
  constructor(private readonly healthLogRepository: HealthLogRepository) {}

  async create(accountId: string, dto: CreateHealthLogDto) {
    const userExists = await this.healthLogRepository.userExistsForAccount(dto.userId, accountId);
    if (!userExists) throw new NotFoundException('家庭成员不存在');
    this.validateEntry(dto.type, dto);

    return this.healthLogRepository.create({
      userId: dto.userId,
      type: dto.type,
      occurredAt: dto.occurredAt,
      temperature: dto.temperature,
      medicineName: dto.medicineName,
      dosage: dto.dosage,
      symptoms: dto.symptoms,
      note: dto.note,
    });
  }

  async findMany(accountId: string, query: ListHealthLogsQueryDto) {
    if (query.userId) {
      const userExists = await this.healthLogRepository.userExistsForAccount(query.userId, accountId);
      if (!userExists) throw new NotFoundException('家庭成员不存在');
    }
    return this.healthLogRepository.findMany({
      accountId,
      userId: query.userId,
      from: query.from,
      to: query.to,
    });
  }

  async update(accountId: string, id: string, dto: UpdateHealthLogDto) {
    const existing = await this.healthLogRepository.findByIdForAccount(id, accountId);
    if (!existing) throw new NotFoundException('病程记录不存在');

    const type = dto.type ?? (existing.type as HealthLogType);
    const nextValues = {
      temperature: dto.temperature === undefined ? existing.temperature : dto.temperature,
      medicineName: dto.medicineName === undefined ? existing.medicineName : dto.medicineName,
      symptoms: dto.symptoms === undefined ? existing.symptoms : dto.symptoms,
    };
    this.validateEntry(type, nextValues);

    const updated = await this.healthLogRepository.updateForAccount(id, accountId, {
      type: dto.type,
      occurredAt: dto.occurredAt,
      temperature: dto.temperature,
      medicineName: dto.medicineName,
      dosage: dto.dosage,
      symptoms: dto.symptoms,
      note: dto.note,
    });
    if (!updated) throw new NotFoundException('病程记录不存在');
    return updated;
  }

  async remove(accountId: string, id: string) {
    const deleted = await this.healthLogRepository.deleteForAccount(id, accountId);
    if (!deleted) throw new NotFoundException('病程记录不存在');
    return { id };
  }

  private validateEntry(type: HealthLogType, values: {
    temperature?: number | null;
    medicineName?: string | null;
    symptoms?: string | null;
  }) {
    if (!Object.values(HealthLogType).includes(type)) {
      throw new BadRequestException('记录类型无效');
    }
    if (type === HealthLogType.Temperature && values.temperature == null) {
      throw new BadRequestException('请输入体温');
    }
    if (type === HealthLogType.Medication && !values.medicineName?.trim()) {
      throw new BadRequestException('请输入药品名称');
    }
    if (type === HealthLogType.Symptom && !values.symptoms?.trim()) {
      throw new BadRequestException('请选择或填写症状');
    }
  }
}
