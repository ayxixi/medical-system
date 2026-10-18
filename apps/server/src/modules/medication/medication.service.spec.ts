import { NotFoundException } from '@nestjs/common';
import { MedicationRepository } from './medication.repository';
import { MedicationService } from './medication.service';

describe('MedicationService', () => {
  let service: MedicationService;
  let medicationRepository: {
    visitExistsForAccount: jest.Mock;
    create: jest.Mock;
    findManyByVisitId: jest.Mock;
    updateForAccount: jest.Mock;
    deleteForAccount: jest.Mock;
  };

  beforeEach(() => {
    medicationRepository = {
      visitExistsForAccount: jest.fn(),
      create: jest.fn(),
      findManyByVisitId: jest.fn(),
      updateForAccount: jest.fn(),
      deleteForAccount: jest.fn(),
    };

    service = new MedicationService(
      medicationRepository as unknown as MedicationRepository,
    );
  });

  it('rejects create when visit does not belong to account', async () => {
    medicationRepository.visitExistsForAccount.mockResolvedValue(false);

    await expect(
      service.create('account-1', {
        visitId: 'visit-1',
        name: '阿司匹林',
      } as never),
    ).rejects.toThrow(NotFoundException);

    expect(medicationRepository.create).not.toHaveBeenCalled();
  });

  it('creates medication when visit belongs to account', async () => {
    medicationRepository.visitExistsForAccount.mockResolvedValue(true);
    medicationRepository.create.mockResolvedValue({ id: 'medication-1' });

    const result = await service.create('account-1', {
      visitId: 'visit-1',
      name: '阿司匹林',
      dosage: '100mg',
      frequency: '每日一次',
      duration: '7天',
    } as never);

    expect(medicationRepository.create).toHaveBeenCalledWith({
      visitId: 'visit-1',
      name: '阿司匹林',
      dosage: '100mg',
      frequency: '每日一次',
      duration: '7天',
    });
    expect(result).toEqual({ id: 'medication-1' });
  });

  it('rejects findManyByVisitId when visit does not belong to account', async () => {
    medicationRepository.visitExistsForAccount.mockResolvedValue(false);

    await expect(
      service.findManyByVisitId('account-1', 'visit-1'),
    ).rejects.toThrow('就诊记录不存在');
  });

  it('returns medication list when visit belongs to account', async () => {
    medicationRepository.visitExistsForAccount.mockResolvedValue(true);
    medicationRepository.findManyByVisitId.mockResolvedValue([
      { id: 'medication-1' },
    ]);

    const result = await service.findManyByVisitId('account-1', 'visit-1');

    expect(medicationRepository.findManyByVisitId).toHaveBeenCalledWith(
      'visit-1',
    );
    expect(result).toEqual([{ id: 'medication-1' }]);
  });

  it('rejects update when medication record is not found', async () => {
    medicationRepository.updateForAccount.mockResolvedValue(null);

    await expect(
      service.update('account-1', 'medication-1', {
        name: '氯吡格雷',
      } as never),
    ).rejects.toThrow('用药记录不存在');
  });

  it('updates medication record for current account', async () => {
    medicationRepository.updateForAccount.mockResolvedValue({
      id: 'medication-1',
    });

    const result = await service.update('account-1', 'medication-1', {
      name: '氯吡格雷',
      dosage: '75mg',
      frequency: '每日一次',
      duration: '30天',
    } as never);

    expect(medicationRepository.updateForAccount).toHaveBeenCalledWith(
      'medication-1',
      'account-1',
      {
        name: '氯吡格雷',
        dosage: '75mg',
        frequency: '每日一次',
        duration: '30天',
      },
    );
    expect(result).toEqual({ id: 'medication-1' });
  });

  it('rejects remove when medication record is not found', async () => {
    medicationRepository.deleteForAccount.mockResolvedValue(false);

    await expect(
      service.remove('account-1', 'medication-1'),
    ).rejects.toThrow('用药记录不存在');
  });

  it('returns deleted id when remove succeeds', async () => {
    medicationRepository.deleteForAccount.mockResolvedValue(true);

    await expect(
      service.remove('account-1', 'medication-1'),
    ).resolves.toEqual({
      id: 'medication-1',
    });
  });
});