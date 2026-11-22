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
  let trackWrite: jest.Mock;
  let storageService: {
    save: jest.Mock;
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
    };

    trackWrite = jest.fn((_provider, _path, write) => write());
    service = new FileService(
      fileRepository as unknown as FileRepository,
      { get: getConfig } as unknown as ConfigService,
      storageService as unknown as FileStorageService,
      {} as ConstructorParameters<typeof FileService>[3],
      {} as ConstructorParameters<typeof FileService>[4],
      { trackWrite } as unknown as ConstructorParameters<typeof FileService>[5],
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
    fileRepository.create.mockResolvedValue({ id: 'file-1' });

    const result = await service.upload('account-1', createFile(), {
      visitId: 'visit-1',
    });

    expect(storageService.save).toHaveBeenCalledWith({
      buffer: Buffer.from('content'),
      relativePath: expect.stringMatching(/^user-1\/visit-1\/.+\.pdf$/),
      mimeType: 'application/pdf',
    });
    expect(fileRepository.create).toHaveBeenCalledWith({
      visitId: 'visit-1',
      originalName: 'report.pdf',
      storedName: expect.stringMatching(/\.pdf$/),
      relativePath: storageService.save.mock.calls[0][0].relativePath,
      mimeType: 'application/pdf',
      size: 1024,
      storageProvider: 'local',
    });
    expect(result).toEqual({ id: 'file-1' });
  });

  it('removes metadata so database triggers can queue cleanup atomically', async () => {
    fileRepository.findByIdForAccount.mockResolvedValue({ id: 'file-1' });
    fileRepository.deleteById.mockResolvedValue({ id: 'file-1' });

    await expect(service.remove('account-1', 'file-1')).resolves.toEqual({ id: 'file-1' });
    expect(fileRepository.deleteById).toHaveBeenCalledWith('file-1');
    expect(trackWrite).not.toHaveBeenCalled();
  });

  it('queues the new key if replacing metadata fails', async () => {
    fileRepository.findByIdForAccount.mockResolvedValue({
      id: 'file-1',
      visitId: 'visit-1',
      relativePath: 'user-1/visit-1/old.pdf',
    });
    fileRepository.findVisitByIdForAccount.mockResolvedValue({ id: 'visit-1', userId: 'user-1' });
    const error = new Error('metadata write failed');
    fileRepository.updateById.mockRejectedValue(error);

    await expect(service.replace('account-1', 'file-1', createFile())).rejects.toBe(error);
    const key = storageService.save.mock.calls[0][0].relativePath;
    expect(key).not.toBe('user-1/visit-1/old.pdf');
    expect(trackWrite).toHaveBeenCalledWith('local', key, expect.any(Function));
  });

  it('queues the attempted object key if a storage write fails', async () => {
    fileRepository.findVisitByIdForAccount.mockResolvedValue({ id: 'visit-1', userId: 'user-1' });
    const error = new Error('storage write failed');
    storageService.save.mockRejectedValue(error);

    await expect(service.upload('account-1', createFile(), { visitId: 'visit-1' })).rejects.toBe(error);
    expect(fileRepository.create).not.toHaveBeenCalled();
    expect(trackWrite).toHaveBeenCalledWith('local', storageService.save.mock.calls[0][0].relativePath, expect.any(Function));
  });

  it('throws when replace target file does not belong to current account', async () => {
    fileRepository.findByIdForAccount.mockResolvedValue(null);

    await expect(
      service.replace('account-1', 'file-1', createFile()),
    ).rejects.toThrow(NotFoundException);
  });
});