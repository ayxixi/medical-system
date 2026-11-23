import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ExportService {
  constructor(private readonly prisma: PrismaService) {}

  async exportAccount(accountId: string) {
    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
      select: {
        id: true,
        email: true,
        createdAt: true,
        users: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            name: true,
            createdAt: true,
            updatedAt: true,
            visits: {
              orderBy: { date: 'desc' },
              select: {
                id: true,
                date: true,
                hospital: true,
                department: true,
                doctor: true,
                note: true,
                createdAt: true,
                updatedAt: true,
                records: {
                  orderBy: { createdAt: 'asc' },
                  select: { id: true, diagnosis: true, createdAt: true, updatedAt: true },
                },
                medications: {
                  orderBy: { createdAt: 'asc' },
                  select: {
                    id: true,
                    name: true,
                    dosage: true,
                    frequency: true,
                    duration: true,
                    createdAt: true,
                    updatedAt: true,
                  },
                },
                files: {
                  orderBy: { createdAt: 'asc' },
                  select: {
                    id: true,
                    originalName: true,
                    mimeType: true,
                    size: true,
                    createdAt: true,
                    updatedAt: true,
                  },
                },
              },
            },
            healthLogs: {
              orderBy: { occurredAt: 'desc' },
              select: {
                id: true,
                type: true,
                occurredAt: true,
                temperature: true,
                medicineName: true,
                dosage: true,
                symptoms: true,
                note: true,
                createdAt: true,
                updatedAt: true,
              },
            },
            reminders: {
              orderBy: { createdAt: 'asc' },
              select: {
                id: true,
                kind: true,
                title: true,
                note: true,
                nextAt: true,
                localTime: true,
                timeZone: true,
                repeatDaily: true,
                snoozedUntil: true,
                isActive: true,
                completedAt: true,
                createdAt: true,
                updatedAt: true,
              },
            },
          },
        },
      },
    });

    if (!account) throw new NotFoundException('账号不存在');
    return {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      account: { id: account.id, email: account.email, createdAt: account.createdAt },
      users: account.users,
    };
  }
}
