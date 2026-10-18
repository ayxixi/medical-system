import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class MedicationRepository {
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

  create(data: {
    visitId: string;
    name: string;
    dosage?: string;
    frequency?: string;
    duration?: string;
  }) {
    return this.prisma.medication.create({
      data,
    });
  }

  findManyByVisitId(visitId: string) {
    return this.prisma.medication.findMany({
      where: { visitId },
      orderBy: { createdAt: 'desc' },
    });
  }

  findByIdForAccount(id: string, accountId: string) {
    return this.prisma.medication.findFirst({
      where: { id, visit: { user: { accountId } } },
    });
  }

  async updateForAccount(
    id: string,
    accountId: string,
    data: {
      name?: string;
      dosage?: string;
      frequency?: string;
      duration?: string;
    },
  ) {
    const result = await this.prisma.medication.updateMany({
      where: { id, visit: { user: { accountId } } },
      data,
    });

    if (result.count === 0) {
      return null;
    }

    return this.prisma.medication.findUnique({ where: { id } });
  }

  async deleteForAccount(id: string, accountId: string): Promise<boolean> {
    const result = await this.prisma.medication.deleteMany({
      where: { id, visit: { user: { accountId } } },
    });

    return result.count > 0;
  }
}
