import { execSync } from 'child_process';
import { existsSync, mkdtempSync, rmSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  BadRequestException,
  INestApplication,
  ValidationError,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { formatValidationErrors } from './common/utils/validation.util';
import { AttachmentCleanupService } from './modules/file/attachment-cleanup.service';
import { FileRepository } from './modules/file/file.repository';
import { LocalStorageService } from './modules/file/storage/local-storage.service';
import { PrismaService } from './prisma/prisma.service';

jest.setTimeout(60000);

describe('账号隔离 (e2e)', () => {
  let app: INestApplication;
  let testRoot: string;
  let uploadPath: string;
  let httpServer: ReturnType<INestApplication['getHttpServer']>;

  let aliceToken: string;
  let aliceUserId: string;
  let aliceVisitId: string;
  let aliceRecordId: string;
  let aliceMedicationId: string;

  let bobToken: string;
  let bobUserId: string;
  let bobVisitId: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    testRoot = mkdtempSync(join(tmpdir(), 'medical-attachments-'));
    process.env.DATABASE_URL = `file:${join(testRoot, 'test.db').split('\\').join('/')}`;
    process.env.JWT_SECRET = 'test-secret-test-secret-test-secret';
    process.env.JWT_EXPIRES_IN = '1d';
    process.env.FILE_STORAGE = 'local';
    uploadPath = join(testRoot, 'uploads');
    process.env.UPLOAD_PATH = uploadPath;
    process.env.MAX_FILE_SIZE_MB = '10';

    execSync('npm run prisma:migrate:deploy', {
      stdio: 'pipe',
      env: { ...process.env, RUST_LOG: 'info' },
    });

    const { AppModule } = await import('./app.module');
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
        exceptionFactory: (errors: ValidationError[]) =>
          new BadRequestException(formatValidationErrors(errors)),
      }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();

    httpServer = app.getHttpServer();

    const aliceRegister = await request(httpServer)
      .post('/auth/register')
      .send({
        email: 'alice@example.com',
        password: 'hunter2hunter2',
        name: 'Alice',
      })
      .expect(201);
    aliceToken = aliceRegister.body.accessToken;
    aliceUserId = aliceRegister.body.defaultUserId;

    const bobRegister = await request(httpServer)
      .post('/auth/register')
      .send({
        email: 'bob@example.com',
        password: 'hunter2hunter2',
        name: 'Bob',
      })
      .expect(201);
    bobToken = bobRegister.body.accessToken;
    bobUserId = bobRegister.body.defaultUserId;

    const aliceVisit = await request(httpServer)
      .post('/visits')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({
        userId: aliceUserId,
        date: '2026-04-01T00:00:00.000Z',
        hospital: '甲医院',
      })
      .expect(201);
    aliceVisitId = aliceVisit.body.id;

    const aliceRecord = await request(httpServer)
      .post('/records')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ visitId: aliceVisitId, diagnosis: '感冒' })
      .expect(201);
    aliceRecordId = aliceRecord.body.id;

    const aliceMedication = await request(httpServer)
      .post('/medications')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ visitId: aliceVisitId, name: '布洛芬' })
      .expect(201);
    aliceMedicationId = aliceMedication.body.id;

    const bobVisit = await request(httpServer)
      .post('/visits')
      .set('Authorization', `Bearer ${bobToken}`)
      .send({
        userId: bobUserId,
        date: '2026-04-02T00:00:00.000Z',
        hospital: '乙医院',
      })
      .expect(201);
    bobVisitId = bobVisit.body.id;
  });

  afterAll(async () => {
    if (app) {
      const prisma = app.get(PrismaService);
      await prisma.$disconnect();
      await app.close();
    }

    if (testRoot) rmSync(testRoot, { recursive: true, force: true });
  });

  it('未携带 token 时拒绝访问受保护接口', async () => {
    await request(httpServer).get('/users').expect(401);
    await request(httpServer).get('/visits').expect(401);
  });

  it('Bob 无法读取 Alice 的用户档案', async () => {
    await request(httpServer)
      .get(`/users/${aliceUserId}`)
      .set('Authorization', `Bearer ${bobToken}`)
      .expect(404);
  });

  it('Bob 无法用 Alice 的 userId 创建就诊记录', async () => {
    await request(httpServer)
      .post('/visits')
      .set('Authorization', `Bearer ${bobToken}`)
      .send({
        userId: aliceUserId,
        date: '2026-04-03T00:00:00.000Z',
      })
      .expect(404);
  });

  it('Bob 无法读取/修改/删除 Alice 的就诊记录', async () => {
    await request(httpServer)
      .get(`/visits/${aliceVisitId}`)
      .set('Authorization', `Bearer ${bobToken}`)
      .expect(404);

    await request(httpServer)
      .patch(`/visits/${aliceVisitId}`)
      .set('Authorization', `Bearer ${bobToken}`)
      .send({ hospital: '冒名顶替医院' })
      .expect(404);

    await request(httpServer)
      .delete(`/visits/${aliceVisitId}`)
      .set('Authorization', `Bearer ${bobToken}`)
      .expect(404);
  });

  it('Bob 无法看到 Alice 的就诊列表', async () => {
    const response = await request(httpServer)
      .get('/visits')
      .set('Authorization', `Bearer ${bobToken}`)
      .expect(200);

    const ids = (response.body as Array<{ id: string }>).map((v) => v.id);
    expect(ids).not.toContain(aliceVisitId);
    expect(ids).toContain(bobVisitId);
  });

  it('Bob 无法用 Alice 的 visitId 创建诊断记录或用药', async () => {
    await request(httpServer)
      .post('/records')
      .set('Authorization', `Bearer ${bobToken}`)
      .send({ visitId: aliceVisitId, diagnosis: '伪造诊断' })
      .expect(404);

    await request(httpServer)
      .post('/medications')
      .set('Authorization', `Bearer ${bobToken}`)
      .send({ visitId: aliceVisitId, name: '伪造药物' })
      .expect(404);
  });

  it('Bob 无法列出/修改/删除 Alice 的诊断与用药', async () => {
    await request(httpServer)
      .get(`/visits/${aliceVisitId}/records`)
      .set('Authorization', `Bearer ${bobToken}`)
      .expect(404);

    await request(httpServer)
      .patch(`/records/${aliceRecordId}`)
      .set('Authorization', `Bearer ${bobToken}`)
      .send({ diagnosis: '伪造诊断' })
      .expect(404);

    await request(httpServer)
      .delete(`/records/${aliceRecordId}`)
      .set('Authorization', `Bearer ${bobToken}`)
      .expect(404);

    await request(httpServer)
      .get(`/visits/${aliceVisitId}/medications`)
      .set('Authorization', `Bearer ${bobToken}`)
      .expect(404);

    await request(httpServer)
      .patch(`/medications/${aliceMedicationId}`)
      .set('Authorization', `Bearer ${bobToken}`)
      .send({ dosage: '500mg' })
      .expect(404);

    await request(httpServer)
      .delete(`/medications/${aliceMedicationId}`)
      .set('Authorization', `Bearer ${bobToken}`)
      .expect(404);
  });

  it('Bob 无法上传文件到 Alice 的就诊记录或查看其附件', async () => {
    await request(httpServer)
      .post('/files/upload')
      .set('Authorization', `Bearer ${bobToken}`)
      .field('visitId', aliceVisitId)
      .attach('file', Buffer.from('%PDF-1.4 fake'), {
        filename: 'fake.pdf',
        contentType: 'application/pdf',
      })
      .expect(404);

    await request(httpServer)
      .get(`/visits/${aliceVisitId}/files`)
      .set('Authorization', `Bearer ${bobToken}`)
      .expect(404);
  });

  it('附件原件仅对所属账号可读，原件缺失返回 404', async () => {
    const bytes = Buffer.from('%PDF-1.4 test');
    const uploaded = await request(httpServer)
      .post('/files/upload')
      .set('Authorization', `Bearer ${aliceToken}`)
      .field('visitId', aliceVisitId)
      .attach('file', bytes, { filename: 'report.pdf', contentType: 'application/pdf' })
      .expect(201);
    const url = `/files/${uploaded.body.id}/content`;

    await request(httpServer).get(url).expect(401);
    await request(httpServer).get(url).set('Authorization', `Bearer ${bobToken}`).expect(404);
    const result = await request(httpServer)
      .get(url)
      .set('Authorization', `Bearer ${aliceToken}`)
      .expect('Content-Type', 'application/octet-stream')
      .expect('Cache-Control', 'private, no-store')
      .expect('Content-Disposition', 'attachment; filename="report.pdf"')
      .expect(200);
    expect(result.body).toEqual(bytes);

    unlinkSync(join(uploadPath, uploaded.body.relativePath));
    await request(httpServer).get(url).set('Authorization', `Bearer ${aliceToken}`).expect(404);
  });

  it('附件替换、删除就诊和删除成员时清理原件，失败可重试', async () => {
    const auth = `Bearer ${aliceToken}`;
    const visit = await request(httpServer)
      .post('/visits').set('Authorization', auth)
      .send({ userId: aliceUserId, date: '2026-04-04T00:00:00.000Z' }).expect(201);
    const upload = async (visitId: string) => {
      const result = await request(httpServer).post('/files/upload').set('Authorization', auth)
        .field('visitId', visitId)
        .attach('file', Buffer.from('%PDF-1.4 fixture'), { filename: 'report.pdf', contentType: 'application/pdf' })
        .expect(201);
      return result.body;
    };
    const first = await upload(visit.body.id);
    const prisma = app.get(PrismaService);
    const cleanup = app.get(AttachmentCleanupService);
    expect(await prisma.attachmentCleanup.count()).toBe(0);

    const replace = (content: string) => request(httpServer)
      .put(`/files/${first.id}`).set('Authorization', auth)
      .attach('file', Buffer.from(content), { filename: 'report.pdf', contentType: 'application/pdf' });
    const failWrite = jest.spyOn(app.get(FileRepository), 'updateById')
      .mockRejectedValueOnce(new Error('metadata temporarily unavailable'));
    try {
      await replace('%PDF-1.4 failed').expect(500);
      const queued = await prisma.attachmentCleanup.findMany();
      expect(queued).toHaveLength(1);
      expect(existsSync(join(uploadPath, queued[0].relativePath))).toBe(true);
      await cleanup.runPending();
      expect(existsSync(join(uploadPath, queued[0].relativePath))).toBe(false);
      expect(existsSync(join(uploadPath, first.relativePath))).toBe(true);
      await request(httpServer).get(`/files/${first.id}/content`).set('Authorization', auth).expect(200);
    } finally {
      failWrite.mockRestore();
    }

    const replacements = await Promise.all([
      replace('%PDF-1.4 first').expect(200),
      replace('%PDF-1.4 second').expect(200),
    ]);
    const current = await prisma.visitFile.findUniqueOrThrow({ where: { id: first.id } });
    const obsolete = replacements.map(({ body }) => body.relativePath)
      .find((path) => path !== current.relativePath);
    expect(obsolete).toBeDefined();

    await cleanup.runPending();
    expect(existsSync(join(uploadPath, first.relativePath))).toBe(false);
    expect(existsSync(join(uploadPath, obsolete))).toBe(false);
    expect(existsSync(join(uploadPath, current.relativePath))).toBe(true);

    const deleteObject = jest.spyOn(app.get(LocalStorageService), 'delete')
      .mockRejectedValueOnce(new Error('storage temporarily unavailable'));
    try {
      await request(httpServer).delete(`/visits/${visit.body.id}`).set('Authorization', auth).expect(204);
      await cleanup.runPending();
      expect(existsSync(join(uploadPath, current.relativePath))).toBe(true);
      await prisma.attachmentCleanup.updateMany({
        where: { relativePath: current.relativePath, nextAttemptAt: { gt: BigInt(Date.now()) } },
        data: { nextAttemptAt: 0n },
      }).then(({ count }) => expect(count).toBe(1));
      await cleanup.runPending();
      expect(existsSync(join(uploadPath, current.relativePath))).toBe(false);
    } finally {
      deleteObject.mockRestore();
    }

    const member = await request(httpServer).post('/users').set('Authorization', auth)
      .send({ name: '临时测试成员' }).expect(201);
    const memberVisit = await request(httpServer).post('/visits').set('Authorization', auth)
      .send({ userId: member.body.id, date: '2026-04-04T00:00:00.000Z' }).expect(201);
    const memberFile = await upload(memberVisit.body.id);
    const single = await upload(memberVisit.body.id);
    await request(httpServer).delete(`/files/${single.id}`)
      .set('Authorization', `Bearer ${bobToken}`).expect(404);
    await request(httpServer).delete(`/files/${single.id}`).set('Authorization', auth).expect(200);
    await request(httpServer).delete(`/users/${member.body.id}`).set('Authorization', auth).expect(204);
    await cleanup.runPending();
    expect(existsSync(join(uploadPath, memberFile.relativePath))).toBe(false);
    expect(existsSync(join(uploadPath, single.relativePath))).toBe(false);
  });

  it('账号下至少保留一个用户：删除唯一用户应返回 400', async () => {
    await request(httpServer)
      .delete(`/users/${bobUserId}`)
      .set('Authorization', `Bearer ${bobToken}`)
      .expect(400);
  });

  it('更新就诊时可清空可选字段，并保留成员、诊断和用药关联', async () => {
    const auth = `Bearer ${aliceToken}`;
    const url = `/visits/${aliceVisitId}`;
    await request(httpServer).patch(url).set('Authorization', auth).send({ note: '复诊备注' }).expect(200);
    const result = await request(httpServer)
      .patch(url)
      .set('Authorization', auth)
      .send({ hospital: null, note: null, doctor: ' 李医生 ' })
      .expect(200);

    expect(result.body).toMatchObject({
      userId: aliceUserId,
      hospital: null,
      note: null,
      doctor: '李医生',
      records: [expect.objectContaining({ id: aliceRecordId })],
      medications: [expect.objectContaining({ id: aliceMedicationId })],
    });
    const list = await request(httpServer).get('/visits').set('Authorization', auth).expect(200);
    expect(list.body).toContainEqual(expect.objectContaining({
      id: aliceVisitId, hospital: null, note: null, doctor: '李医生',
    }));
  });

  it('Alice 仍可访问自己的所有数据', async () => {
    await request(httpServer)
      .get(`/visits/${aliceVisitId}`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .expect(200);

    await request(httpServer)
      .get(`/visits/${aliceVisitId}/records`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .expect(200);

    await request(httpServer)
      .get(`/visits/${aliceVisitId}/medications`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .expect(200);
  });
});
