import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SortOrder, VisitSortBy } from './dto/list-visits.query';

const visitDetailInclude = {
  user: true,
  records: true,
  medications: true,
  files: true,
} as const;

@Injectable()
export class VisitRepository {
  constructor(private readonly prisma: PrismaService) {}

  async userExistsForAccount(userId: string, accountId: string): Promise<boolean> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, accountId },
      select: { id: true },
    });

    return Boolean(user);
  }

  create(data: {
    userId: string;
    date: Date;
    hospital?: string;
    department?: string;
    doctor?: string;
    note?: string;
  }) {
    return this.prisma.visit.create({
      data,
      include: visitDetailInclude,
    });
  }

  findMany(filters: {
    accountId: string;
    userId?: string;
    from?: Date;
    to?: Date;
    q?: string;
    sortBy?: VisitSortBy;
    order?: SortOrder;
  }) {
    const sortBy = filters.sortBy ?? VisitSortBy.Date;
    const order = filters.order ?? SortOrder.Desc;

    const keyword = filters.q?.trim();
    const keywordCondition: Prisma.VisitWhereInput | undefined = keyword
      ? {
          OR: [
            { hospital: { contains: keyword } },
            { department: { contains: keyword } },
            { doctor: { contains: keyword } },
            { note: { contains: keyword } },
            { user: { is: { name: { contains: keyword } } } },
            { records: { some: { diagnosis: { contains: keyword } } } },
            { medications: { some: { name: { contains: keyword } } } },
          ],
        }
      : undefined;

    const where: Prisma.VisitWhereInput = {
      user: { accountId: filters.accountId },
      ...(filters.userId ? { userId: filters.userId } : {}),
      ...(filters.from || filters.to
        ? {
            date: {
              ...(filters.from ? { gte: filters.from } : {}),
              ...(filters.to ? { lte: filters.to } : {}),
            },
          }
        : {}),
      ...(keywordCondition ? { AND: [keywordCondition] } : {}),
    };

    const orderBy: Prisma.VisitOrderByWithRelationInput[] =
      sortBy === VisitSortBy.CreatedAt
        ? [{ createdAt: order }, { date: order }]
        : [{ date: order }, { createdAt: order }];

    return this.prisma.visit.findMany({
      where,
      orderBy,
      include: visitDetailInclude,
    });
  }

  findByIdForAccount(id: string, accountId: string) {
    return this.prisma.visit.findFirst({
      where: { id, user: { accountId } },
      include: visitDetailInclude,
    });
  }

  async updateForAccount(
    id: string,
    accountId: string,
    data: {
      date?: Date;
      hospital?: string | null;
      department?: string | null;
      doctor?: string | null;
      note?: string | null;
    },
  ) {
    const result = await this.prisma.visit.updateMany({
      where: { id, user: { accountId } },
      data,
    });

    if (result.count === 0) {
      return null;
    }

    return this.prisma.visit.findUnique({
      where: { id },
      include: visitDetailInclude,
    });
  }

  async deleteForAccount(id: string, accountId: string): Promise<boolean> {
    const result = await this.prisma.visit.deleteMany({
      where: { id, user: { accountId } },
    });

    return result.count > 0;
  }
}
