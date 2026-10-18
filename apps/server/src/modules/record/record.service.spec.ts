import { NotFoundException } from '@nestjs/common';
import { RecordRepository } from './record.repository';
import { RecordService } from './record.service';

describe('RecordService', () => {
  let service: RecordService;
  let recordRepository: {
    visitExistsForAccount: jest.Mock;
    create: jest.Mock;
    findManyByVisitId: jest.Mock;
    updateForAccount: jest.Mock;
    deleteForAccount: jest.Mock;
  };

  beforeEach(() => {
    recordRepository = {
      visitExistsForAccount: jest.fn(),
      create: jest.fn(),
      findManyByVisitId: jest.fn(),
      updateForAccount: jest.fn(),
      deleteForAccount: jest.fn(),
    };

    service = new RecordService(recordRepository as unknown as RecordRepository);
  });

  it('rejects create when visit does not belong to account', async () => {
    recordRepository.visitExistsForAccount.mockResolvedValue(false);

    await expect(
      service.create('account-1', {
        visitId: 'visit-1',
        diagnosis: '高血压',
      } as never),
    ).rejects.toThrow(NotFoundException);

    expect(recordRepository.create).not.toHaveBeenCalled();
  });

  it('creates diagnosis record when visit belongs to account', async () => {
    recordRepository.visitExistsForAccount.mockResolvedValue(true);
    recordRepository.create.mockResolvedValue({ id: 'record-1' });

    const result = await service.create('account-1', {
      visitId: 'visit-1',
      diagnosis: '高血压',
    } as never);

    expect(recordRepository.create).toHaveBeenCalledWith({
      visitId: 'visit-1',
      diagnosis: '高血压',
    });
    expect(result).toEqual({ id: 'record-1' });
  });

  it('rejects findManyByVisitId when visit does not belong to account', async () => {
    recordRepository.visitExistsForAccount.mockResolvedValue(false);

    await expect(
      service.findManyByVisitId('account-1', 'visit-1'),
    ).rejects.toThrow('就诊记录不存在');
  });

  it('returns diagnosis list when visit belongs to account', async () => {
    recordRepository.visitExistsForAccount.mockResolvedValue(true);
    recordRepository.findManyByVisitId.mockResolvedValue([{ id: 'record-1' }]);

    const result = await service.findManyByVisitId('account-1', 'visit-1');

    expect(recordRepository.findManyByVisitId).toHaveBeenCalledWith('visit-1');
    expect(result).toEqual([{ id: 'record-1' }]);
  });

  it('rejects update when diagnosis record is not found', async () => {
    recordRepository.updateForAccount.mockResolvedValue(null);

    await expect(
      service.update('account-1', 'record-1', { diagnosis: '糖尿病' } as never),
    ).rejects.toThrow('诊断记录不存在');
  });

  it('updates diagnosis record for current account', async () => {
    recordRepository.updateForAccount.mockResolvedValue({ id: 'record-1' });

    const result = await service.update('account-1', 'record-1', {
      diagnosis: '糖尿病',
    } as never);

    expect(recordRepository.updateForAccount).toHaveBeenCalledWith(
      'record-1',
      'account-1',
      { diagnosis: '糖尿病' },
    );
    expect(result).toEqual({ id: 'record-1' });
  });

  it('rejects remove when diagnosis record is not found', async () => {
    recordRepository.deleteForAccount.mockResolvedValue(false);

    await expect(service.remove('account-1', 'record-1')).rejects.toThrow(
      '诊断记录不存在',
    );
  });

  it('returns deleted id when remove succeeds', async () => {
    recordRepository.deleteForAccount.mockResolvedValue(true);

    await expect(service.remove('account-1', 'record-1')).resolves.toEqual({
      id: 'record-1',
    });
  });
});