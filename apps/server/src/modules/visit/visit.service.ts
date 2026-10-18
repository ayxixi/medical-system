import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateVisitDto } from './dto/create-visit.dto';
import { ListVisitsQueryDto } from './dto/list-visits.query';
import { UpdateVisitDto } from './dto/update-visit.dto';
import { VisitRepository } from './visit.repository';

@Injectable()
export class VisitService {
  constructor(private readonly visitRepository: VisitRepository) {}

  async create(accountId: string, createVisitDto: CreateVisitDto) {
    const userExists = await this.visitRepository.userExistsForAccount(
      createVisitDto.userId,
      accountId,
    );

    if (!userExists) {
      throw new NotFoundException('用户不存在');
    }

    return this.visitRepository.create({
      userId: createVisitDto.userId,
      date: createVisitDto.date,
      hospital: createVisitDto.hospital,
      department: createVisitDto.department,
      doctor: createVisitDto.doctor,
      note: createVisitDto.note,
    });
  }

  findMany(accountId: string, query: ListVisitsQueryDto) {
    return this.visitRepository.findMany({
      accountId,
      userId: query.userId,
      from: query.from,
      to: query.to,
      q: query.q,
      sortBy: query.sortBy,
      order: query.order,
    });
  }

  async findById(accountId: string, id: string) {
    const visit = await this.visitRepository.findByIdForAccount(id, accountId);

    if (!visit) {
      throw new NotFoundException('就诊记录不存在');
    }

    return visit;
  }

  async update(accountId: string, id: string, updateVisitDto: UpdateVisitDto) {
    const visit = await this.visitRepository.updateForAccount(
      id,
      accountId,
      {
        date: updateVisitDto.date,
        hospital: updateVisitDto.hospital,
        department: updateVisitDto.department,
        doctor: updateVisitDto.doctor,
        note: updateVisitDto.note,
      },
    );

    if (!visit) {
      throw new NotFoundException('就诊记录不存在');
    }

    return visit;
  }

  async remove(accountId: string, id: string) {
    const deleted = await this.visitRepository.deleteForAccount(id, accountId);

    if (!deleted) {
      throw new NotFoundException('就诊记录不存在');
    }

    return { id };
  }
}
