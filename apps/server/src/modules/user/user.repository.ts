import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: { accountId: string; name: string }) {
    return this.prisma.user.create({
      data,
    });
  }

  findManyByAccount(accountId: string) {
    return this.prisma.user.findMany({
      where: { accountId },
      orderBy: { createdAt: 'desc' },
    });
  }

  findByIdForAccount(id: string, accountId: string) {
    return this.prisma.user.findFirst({
      where: { id, accountId },
    });
  }

  findHealthSummaryForAccount(id: string, accountId: string) {
    return this.prisma.user.findFirst({
      where: { id, accountId },
      select: {
        id: true,
        name: true,
        createdAt: true,
        _count: {
          select: {
            visits: true,
            healthLogs: true,
            reminders: { where: { isActive: true } },
          },
        },
        visits: {
          orderBy: [{ date: 'desc' }, { id: 'desc' }],
          take: 5,
          select: {
            id: true,
            date: true,
            hospital: true,
            department: true,
            records: { select: { id: true, diagnosis: true } },
            medications: { select: { id: true, name: true, dosage: true, frequency: true } },
          },
        },
        healthLogs: {
          orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
          take: 10,
          select: {
            id: true,
            type: true,
            occurredAt: true,
            temperature: true,
            medicineName: true,
            dosage: true,
            symptoms: true,
            note: true,
          },
        },
        reminders: {
          where: { isActive: true },
          orderBy: [{ nextAt: 'asc' }, { id: 'asc' }],
          take: 5,
          select: {
            id: true,
            kind: true,
            title: true,
            nextAt: true,
            localTime: true,
            timeZone: true,
            repeatDaily: true,
          },
        },
      },
    });
  }

  countByAccount(accountId: string) {
    return this.prisma.user.count({ where: { accountId } });
  }

  async updateForAccount(
    id: string,
    accountId: string,
    data: { name: string },
  ) {
    const result = await this.prisma.user.updateMany({
      where: { id, accountId },
      data,
    });

    if (result.count === 0) {
      return null;
    }

    return this.prisma.user.findUnique({ where: { id } });
  }

  async deleteForAccount(id: string, accountId: string): Promise<boolean> {
    const result = await this.prisma.user.deleteMany({
      where: { id, accountId },
    });

    return result.count > 0;
  }
}
