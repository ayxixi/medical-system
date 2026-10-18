import { NotFoundException } from '@nestjs/common';
import { VisitRepository } from './visit.repository';
import { VisitService } from './visit.service';

describe('VisitService', () => {
  let service: VisitService;
  let visitRepository: {
    userExistsForAccount: jest.Mock;
    create: jest.Mock;
    findMany: jest.Mock;
    findByIdForAccount: jest.Mock;
    updateForAccount: jest.Mock;
    deleteForAccount: jest.Mock;
  };

  beforeEach(() => {
    visitRepository = {
      userExistsForAccount: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
      findByIdForAccount: jest.fn(),
      updateForAccount: jest.fn(),
      deleteForAccount: jest.fn(),
    };

    service = new VisitService(visitRepository as unknown as VisitRepository);
  });

  it('rejects create when target user does not belong to account', async () => {
    visitRepository.userExistsForAccount.mockResolvedValue(false);

    await expect(
      service.create('account-1', {
        userId: 'user-1',
        date: new Date('2026-05-01T10:00:00.000Z'),
      } as never),
    ).rejects.toThrow(NotFoundException);

    expect(visitRepository.create).not.toHaveBeenCalled();
  });

  it('creates visit with forwarded payload when user exists', async () => {
    const date = new Date('2026-05-01T10:00:00.000Z');
    visitRepository.userExistsForAccount.mockResolvedValue(true);
    visitRepository.create.mockResolvedValue({ id: 'visit-1' });

    const result = await service.create('account-1', {
      userId: 'user-1',
      date,
      hospital: '协和医院',
      department: '心内科',
      doctor: '张医生',
      note: '复诊',
    } as never);

    expect(visitRepository.userExistsForAccount).toHaveBeenCalledWith(
      'user-1',
      'account-1',
    );
    expect(visitRepository.create).toHaveBeenCalledWith({
      userId: 'user-1',
      date,
      hospital: '协和医院',
      department: '心内科',
      doctor: '张医生',
      note: '复诊',
    });
    expect(result).toEqual({ id: 'visit-1' });
  });

  it('forwards list filters to repository unchanged', async () => {
    const query = {
      userId: 'user-1',
      from: new Date('2026-05-01T00:00:00.000Z'),
      to: new Date('2026-05-31T23:59:59.999Z'),
      q: '心内科',
      sortBy: 'createdAt',
      order: 'asc',
    };
    visitRepository.findMany.mockResolvedValue([{ id: 'visit-1' }]);

    const result = await service.findMany('account-1', query as never);

    expect(visitRepository.findMany).toHaveBeenCalledWith({
      accountId: 'account-1',
      userId: 'user-1',
      from: query.from,
      to: query.to,
      q: '心内科',
      sortBy: 'createdAt',
      order: 'asc',
    });
    expect(result).toEqual([{ id: 'visit-1' }]);
  });

  it('throws when visit is not found during findById', async () => {
    visitRepository.findByIdForAccount.mockResolvedValue(null);

    await expect(service.findById('account-1', 'visit-1')).rejects.toThrow(
      '就诊记录不存在',
    );
  });

  it('returns visit when findById hits current account', async () => {
    visitRepository.findByIdForAccount.mockResolvedValue({ id: 'visit-1' });

    await expect(service.findById('account-1', 'visit-1')).resolves.toEqual({
      id: 'visit-1',
    });
  });

  it('throws when update target is not found for current account', async () => {
    visitRepository.updateForAccount.mockResolvedValue(null);

    await expect(
      service.update('account-1', 'visit-1', { note: '复诊' } as never),
    ).rejects.toThrow('就诊记录不存在');
  });

  it('forwards update payload and returns updated visit', async () => {
    const date = new Date('2026-05-02T10:00:00.000Z');
    visitRepository.updateForAccount.mockResolvedValue({ id: 'visit-1' });

    const result = await service.update('account-1', 'visit-1', {
      date,
      hospital: '中山医院',
      department: '神经内科',
      doctor: '李医生',
      note: '调整方案',
    } as never);

    expect(visitRepository.updateForAccount).toHaveBeenCalledWith(
      'visit-1',
      'account-1',
      {
        date,
        hospital: '中山医院',
        department: '神经内科',
        doctor: '李医生',
        note: '调整方案',
      },
    );
    expect(result).toEqual({ id: 'visit-1' });
  });

  it('throws when delete target is not found for current account', async () => {
    visitRepository.deleteForAccount.mockResolvedValue(false);

    await expect(service.remove('account-1', 'visit-1')).rejects.toThrow(
      '就诊记录不存在',
    );
  });

  it('returns deleted id when remove succeeds', async () => {
    visitRepository.deleteForAccount.mockResolvedValue(true);

    await expect(service.remove('account-1', 'visit-1')).resolves.toEqual({
      id: 'visit-1',
    });
  });
});