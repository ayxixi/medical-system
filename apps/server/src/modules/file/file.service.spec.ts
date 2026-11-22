import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileRepository } from './file.repository';
import { FileService } from './file.service';
import { FileStorageService } from './storage/storage.interface';

describe('FileService', () => {
  let service: FileService;
  let fileRepository: {
    findVisitByIdForAccount: jest.Mock;
    create: jest.Mock;
    findByIdForAccount: jest.Mock;
    deleteById: jest.Mock;
    updateById: jest.Mock;
  };
  let getConfig: jest.Mock;
  let storageService: {
    save: jest.Mock;
    delete: jest.Mock;
  };

  function createFile(overrides?: Partial<{ originalname: string; mimetype: string; size: number; buffer?: Buffer }>) {
    return {
      originalname: 'report.pdf',
      mimetype: 'application/pdf',
      size: 1024,
      buffer: Buffer.from('content'),
      ...overrides,
    };
  }

  beforeEach(() => {
    fileRepository = {
      findVisitByIdForAccount: jest.fn(),
      create: jest.fn(),
      findByIdForAccount: jest.fn(),
      deleteById: jest.fn(),
      updateById: jest.fn(),
    };

    getConfig = jest.fn((key: string, defaultValue?: unknown) => {
      if (key === 'MAX_FILE_SIZE_MB') {
        return 10;
      }

      if (key === 'FILE_STORAGE') {
        return 'local';
      }

      return defaultValue;
    });

    storageService = {
      save: jest.fn(),
      delete: jest.fn(),
    };

    service = new FileService(
      fileRepository as unknown as FileRepository,
      { get: getConfig } as unknown as ConfigService,
      storageService as unknown as FileStorageService,
      {} as ConstructorParameters<typeof FileService>[3],
      {} as ConstructorParameters<typeof FileService>[4],
    );
  });

  it('rejects upload when file is missing', async () => {
    await expect(
      service.upload('account-1', undefined, { visitId: 'visit-1' }),
    ).rejects.toThrow(BadRequestException);

    await expect(
      service.upload('account-1', undefined, { visitId: 'visit-1' }),
    ).rejects.toThrow('必须上传文件');
  });

  it('rejects upload when file type is unsupported', async () => {
    await expect(
      service.upload('account-1', createFile({ mimetype: 'text/plain' }), {
        visitId: 'visit-1',
      }),
    ).rejects.toThrow('不支持的文件类型');
  });

  it('uploads file after validating visit ownership', async () => {
    fileRepository.findVisitByIdForAccount.mockResolvedValue({
      id: 'visit-1',
      userId: 'user-1',
    });
    storageService.save.mockResolvedValue({
      storedName: 'stored-report.pdf',
      relativePath: 'user-1/visit-1/stored-report.pdf',
    });
    fileRepository.create.mockResolvedValue({ id: 'file-1' });

    const result = await service.upload('account-1', createFile(), {
      visitId: 'visit-1',
    });

    expect(storageService.save).toHaveBeenCalledWith({
      buffer: Buffer.from('content'),
      userId: 'user-1',
      visitId: 'visit-1',
      originalName: 'report.pdf',
      mimeType: 'application/pdf',
    });
    expect(fileRepository.create).toHaveBeenCalledWith({
      visitId: 'visit-1',
      originalName: 'report.pdf',
      storedName: 'stored-report.pdf',
      relativePath: 'user-1/visit-1/stored-report.pdf',
      mimeType: 'application/pdf',
      size: 1024,
      storageProvider: 'local',
    });
    expect(result).toEqual({ id: 'file-1' });
  });

  it('removes stored file and database record', async () => {
    fileRepository.findByIdForAccount.mockResolvedValue({
      id: 'file-1',
      relativePath: 'user-1/visit-1/old-report.pdf',
    });
    fileRepository.deleteById.mockResolvedValue({ id: 'file-1' });

    const result = await service.remove('account-1', 'file-1');

    expect(storageService.delete).toHaveBeenCalledWith(
      'user-1/visit-1/old-report.pdf',
    );
    expect(fileRepository.deleteById).toHaveBeenCalledWith('file-1');
    expect(result).toEqual({ id: 'file-1' });
  });

  it('replaces file and deletes old object after updating database', async () => {
    fileRepository.findByIdForAccount.mockResolvedValue({
      id: 'file-1',
      visitId: 'visit-1',
      relativePath: 'user-1/visit-1/old-report.pdf',
    });
    fileRepository.findVisitByIdForAccount.mockResolvedValue({
      id: 'visit-1',
      userId: 'user-1',
    });
    storageService.save.mockResolvedValue({
      storedName: 'new-report.pdf',
      relativePath: 'user-1/visit-1/new-report.pdf',
    });
    fileRepository.updateById.mockResolvedValue({ id: 'file-1' });

    const result = await service.replace('account-1', 'file-1', createFile());

    expect(fileRepository.updateById).toHaveBeenCalledWith('file-1', {
      originalName: 'report.pdf',
      storedName: 'new-report.pdf',
      relativePath: 'user-1/visit-1/new-report.pdf',
      mimeType: 'application/pdf',
      size: 1024,
      storageProvider: 'local',
    });
    expect(fileRepository.updateById.mock.invocationCallOrder[0]).toBeLessThan(
      storageService.delete.mock.invocationCallOrder[0],
    );
    expect(storageService.delete).toHaveBeenCalledWith(
      'user-1/visit-1/old-report.pdf',
    );
    expect(result).toEqual({ id: 'file-1' });
  });

  it('returns updated record even if old file cleanup fails during replace', async () => {
    fileRepository.findByIdForAccount.mockResolvedValue({
      id: 'file-1',
      visitId: 'visit-1',
      relativePath: 'user-1/visit-1/old-report.pdf',
    });
    fileRepository.findVisitByIdForAccount.mockResolvedValue({
      id: 'visit-1',
      userId: 'user-1',
    });
    storageService.save.mockResolvedValue({
      storedName: 'new-report.pdf',
      relativePath: 'user-1/visit-1/new-report.pdf',
    });
    fileRepository.updateById.mockResolvedValue({ id: 'file-1', updated: true });
    storageService.delete.mockRejectedValueOnce(new Error('cleanup failed'));

    await expect(
      service.replace('account-1', 'file-1', createFile()),
    ).resolves.toEqual({ id: 'file-1', updated: true });
  });

  it('throws when replace target file does not belong to current account', async () => {
    fileRepository.findByIdForAccount.mockResolvedValue(null);

    await expect(
      service.replace('account-1', 'file-1', createFile()),
    ).rejects.toThrow(NotFoundException);
  });
});