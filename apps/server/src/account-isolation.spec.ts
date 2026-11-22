import { execSync } from 'child_process';
import { unlinkSync } from 'fs';
import { join } from 'path';
import {
  BadRequestException,
  INestApplication,
  ValidationError,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { formatValidationErrors } from './common/utils/validation.util';
import { PrismaService } from './prisma/prisma.service';

const TEST_DB_FILE = 'test-isolation.db';
const TEST_DB_PATH = join(__dirname, '..', 'prisma', TEST_DB_FILE);

jest.setTimeout(60000);

describe('账号隔离 (e2e)', () => {
  let app: INestApplication;
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
    process.env.DATABASE_URL = `file:${TEST_DB_PATH.split('\\').join('/')}`;
    process.env.JWT_SECRET = 'test-secret-test-secret-test-secret';
    process.env.JWT_EXPIRES_IN = '1d';
    process.env.FILE_STORAGE = 'local';
    process.env.UPLOAD_PATH = './uploads';
    process.env.MAX_FILE_SIZE_MB = '10';

    execSync('npx prisma db push --force-reset --skip-generate', {
      stdio: 'ignore',
      env: process.env,
    });

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

    try {
      unlinkSync(TEST_DB_PATH);
    } catch {
      // ignore
    }
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
