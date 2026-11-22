import { PrismaService } from './prisma/prisma.service';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('reports database readiness', async () => {
    const prisma = {
      $queryRaw: jest.fn(async (query: TemplateStringsArray) => {
        expect(query.join('')).toContain('SELECT 1');
      }),
    };
    const controller = new HealthController(prisma as unknown as PrismaService);

    await expect(controller.check()).resolves.toEqual({ status: 'ok' });
    expect(prisma.$queryRaw).toHaveBeenCalled();
  });

  it('fails readiness if database is unavailable', async () => {
    const prisma = { $queryRaw: jest.fn().mockRejectedValue(new Error('database unavailable')) };
    const controller = new HealthController(prisma as unknown as PrismaService);

    await expect(controller.check()).rejects.toThrow('database unavailable');
  });
});
