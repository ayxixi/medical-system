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
