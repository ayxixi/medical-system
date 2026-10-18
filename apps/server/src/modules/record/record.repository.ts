import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class RecordRepository {
  constructor(private readonly prisma: PrismaService) {}

  async visitExistsForAccount(
    visitId: string,
    accountId: string,
  ): Promise<boolean> {
    const visit = await this.prisma.visit.findFirst({
      where: { id: visitId, user: { accountId } },
      select: { id: true },
    });

    return Boolean(visit);
  }

  create(data: { visitId: string; diagnosis: string }) {
    return this.prisma.diagnosisRecord.create({
      data,
    });
  }

  findManyByVisitId(visitId: string) {
    return this.prisma.diagnosisRecord.findMany({
      where: { visitId },
      orderBy: { createdAt: 'desc' },
    });
  }

  findByIdForAccount(id: string, accountId: string) {
    return this.prisma.diagnosisRecord.findFirst({
      where: { id, visit: { user: { accountId } } },
    });
  }

  async updateForAccount(
    id: string,
    accountId: string,
    data: { diagnosis: string },
  ) {
    const result = await this.prisma.diagnosisRecord.updateMany({
      where: { id, visit: { user: { accountId } } },
      data,
    });

    if (result.count === 0) {
      return null;
    }

    return this.prisma.diagnosisRecord.findUnique({ where: { id } });
  }

  async deleteForAccount(id: string, accountId: string): Promise<boolean> {
    const result = await this.prisma.diagnosisRecord.deleteMany({
      where: { id, visit: { user: { accountId } } },
    });

    return result.count > 0;
  }
}
