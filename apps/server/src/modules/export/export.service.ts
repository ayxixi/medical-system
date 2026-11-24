import { Injectable, NotFoundException } from '@nestjs/common';
import archiver = require('archiver');
import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import { FileService } from '../file/file.service';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ExportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fileService: FileService,
  ) {}

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

  async exportAccountArchive(accountId: string): Promise<Readable> {
    const data = await this.exportAccount(accountId);
    const archive = archiver('zip', { store: true });
    archive.on('error', () => {
      archive.abort();
      archive.destroy();
    });
    archive.on('warning', (error) => archive.emit('error', error));
    const dataJson = Buffer.from(`${JSON.stringify(data, null, 2)}\n`);
    const readme = Buffer.from(
      'data.json contains the account medical record metadata. Original files are stored under attachments/ using member and visit folders. manifest.json lists the size and SHA-256 checksum for each other archive file.\n',
    );
    const manifestFiles: Array<{ path: string; size: number; sha256: string }> = [{
      path: 'data.json',
      size: dataJson.byteLength,
      sha256: createHash('sha256').update(dataJson).digest('hex'),
    }, {
      path: 'README.txt',
      size: readme.byteLength,
      sha256: createHash('sha256').update(readme).digest('hex'),
    }];
    archive.append(dataJson, { name: 'data.json' });
    archive.append(readme, { name: 'README.txt' });

    const fileService = this.fileService;
    for (const user of data.users) {
      for (const visit of user.visits) {
        for (const [index, file] of visit.files.entries()) {
          const name = [
            'attachments',
            `${archiveSegment(user.name, 'member')}-${archiveSegment(user.id, 'id')}`,
            `${new Date(visit.date).toISOString().slice(0, 10)}-${archiveSegment(visit.hospital ?? 'visit', 'visit')}-${archiveSegment(visit.id, 'id')}`,
            `${String(index + 1).padStart(3, '0')}-${archiveSegment(file.originalName, 'attachment')}`,
          ].join('/');
          const source = Readable.from((async function* () {
            const { stream } = await fileService.read(accountId, file.id);
            const hash = createHash('sha256');
            let size = 0;
            for await (const chunk of stream) {
              const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
              hash.update(buffer);
              size += buffer.byteLength;
              yield buffer;
            }
            manifestFiles.push({ path: name, size, sha256: hash.digest('hex') });
          })());
          archive.append(source, { name });
        }
      }
    }

    archive.append(Readable.from((async function* () {
      yield `${JSON.stringify({
        manifestVersion: 1,
        algorithm: 'sha256',
        files: manifestFiles,
      }, null, 2)}\n`;
    })()), { name: 'manifest.json' });

    void archive.finalize().catch((error: Error) => archive.destroy(error));
    return archive;
  }
}

function archiveSegment(value: string, fallback: string): string {
  return value.normalize('NFC').replace(/[<>:"/\\|?*\u0000-\u001f\u007f]/g, '_')
    .replace(/\.{2,}/g, '_').trim().replace(/[. ]+$/, '').slice(0, 120) || fallback;
}
