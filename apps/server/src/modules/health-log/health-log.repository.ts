import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class HealthLogRepository {
  constructor(private readonly prisma: PrismaService) {}

  async userExistsForAccount(userId: string, accountId: string): Promise<boolean> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, accountId },
      select: { id: true },
    });
    return Boolean(user);
  }

  create(data: Prisma.HealthLogUncheckedCreateInput) {
    return this.prisma.healthLog.create({ data });
  }

  findMany(filters: {
    accountId: string;
    userId?: string;
    from?: Date;
    to?: Date;
  }) {
    return this.prisma.healthLog.findMany({
      where: {
        user: {
          accountId: filters.accountId,
          ...(filters.userId ? { id: filters.userId } : {}),
        },
        ...(filters.from || filters.to
          ? {
              occurredAt: {
                ...(filters.from ? { gte: filters.from } : {}),
                ...(filters.to ? { lte: filters.to } : {}),
              },
            }
          : {}),
      },
      orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
    });
  }

  findByIdForAccount(id: string, accountId: string) {
    return this.prisma.healthLog.findFirst({
      where: { id, user: { accountId } },
    });
  }

  async updateForAccount(
    id: string,
    accountId: string,
    data: Prisma.HealthLogUpdateManyMutationInput,
  ) {
    const result = await this.prisma.healthLog.updateMany({
      where: { id, user: { accountId } },
      data,
    });

    if (result.count === 0) return null;
    return this.prisma.healthLog.findUnique({ where: { id } });
  }

  async deleteForAccount(id: string, accountId: string): Promise<boolean> {
    const result = await this.prisma.healthLog.deleteMany({
      where: { id, user: { accountId } },
    });
    return result.count > 0;
  }
}
