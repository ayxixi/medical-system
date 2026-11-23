import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class HealthReminderRepository {
  constructor(private readonly prisma: PrismaService) {}

  async userExistsForAccount(userId: string, accountId: string): Promise<boolean> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, accountId },
      select: { id: true },
    });
    return Boolean(user);
  }

  create(data: Prisma.HealthReminderUncheckedCreateInput) {
    return this.prisma.healthReminder.create({ data });
  }

  findMany(filters: { accountId: string; userId?: string; includeInactive?: boolean }) {
    return this.prisma.healthReminder.findMany({
      where: {
        user: {
          accountId: filters.accountId,
          ...(filters.userId ? { id: filters.userId } : {}),
        },
        completedAt: null,
        ...(filters.includeInactive ? {} : { isActive: true }),
      },
      orderBy: [{ isActive: 'desc' }, { nextAt: 'asc' }, { createdAt: 'asc' }],
    });
  }

  findByIdForAccount(id: string, accountId: string) {
    return this.prisma.healthReminder.findFirst({ where: { id, user: { accountId } } });
  }

  async updateForAccount(id: string, accountId: string, data: Prisma.HealthReminderUpdateManyMutationInput) {
    const result = await this.prisma.healthReminder.updateMany({
      where: { id, user: { accountId } },
      data,
    });
    if (result.count === 0) return null;
    return this.prisma.healthReminder.findUnique({ where: { id } });
  }

  async deleteForAccount(id: string, accountId: string): Promise<boolean> {
    const result = await this.prisma.healthReminder.deleteMany({
      where: { id, user: { accountId } },
    });
    return result.count > 0;
  }
}
