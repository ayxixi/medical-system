import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class FileRepository {
  constructor(private readonly prisma: PrismaService) {}

  findVisitByIdForAccount(visitId: string, accountId: string) {
    return this.prisma.visit.findFirst({
      where: { id: visitId, user: { accountId } },
      select: { id: true, userId: true },
    });
  }

  create(data: {
    visitId: string;
    originalName: string;
    storedName: string;
    relativePath: string;
    mimeType: string;
    size: number;
    storageProvider: string;
  }) {
    return this.prisma.visitFile.create({
      data,
    });
  }

  findManyByVisitId(visitId: string) {
    return this.prisma.visitFile.findMany({
      where: { visitId },
      orderBy: { createdAt: 'desc' },
    });
  }

  findById(id: string) {
    return this.prisma.visitFile.findFirst({
      where: { id },
    });
  }

  findByIdForAccount(id: string, accountId: string) {
    return this.prisma.visitFile.findFirst({
      where: { id, visit: { user: { accountId } } },
    });
  }

  deleteById(id: string) {
    return this.prisma.visitFile.delete({
      where: { id },
    });
  }

  updateById(
    id: string,
    data: {
      originalName: string;
      storedName: string;
      relativePath: string;
      mimeType: string;
      size: number;
      storageProvider: string;
    },
  ) {
    return this.prisma.visitFile.update({
      where: { id },
      data,
    });
  }
}
