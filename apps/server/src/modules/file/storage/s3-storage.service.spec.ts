const mockSend = jest.fn();
const mockDestroy = jest.fn();

jest.mock('@aws-sdk/client-s3', () => {
  class MockNoSuchKey extends Error {}
  return {
    S3Client: jest.fn().mockImplementation(() => ({ send: mockSend, destroy: mockDestroy })),
    PutObjectCommand: jest.fn().mockImplementation((input) => ({ input })),
    GetObjectCommand: jest.fn().mockImplementation((input) => ({ input })),
    DeleteObjectCommand: jest.fn().mockImplementation((input) => ({ input })),
    NoSuchKey: MockNoSuchKey,
  };
});

import { Readable } from 'node:stream';
import { ConfigService } from '@nestjs/config';
import { DeleteObjectCommand, GetObjectCommand, NoSuchKey, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { S3StorageService } from './s3-storage.service';

describe('S3StorageService', () => {
  let service: S3StorageService;
  let values: Record<string, string>;
  const config = { get: (key: string) => values[key] } as unknown as ConfigService;

  beforeEach(() => {
    jest.clearAllMocks();
    values = { S3_REGION: 'us-east-1', S3_BUCKET: 'medical-files' };
    service = new S3StorageService(config);
  });

  it('writes file body, MIME type and key to the configured bucket', async () => {
    const buffer = Buffer.from('private file');
    await service.save({ relativePath: 'user/visit/file.png', buffer, mimeType: 'image/png' });
    const command = mockSend.mock.calls[0][0] as { input: unknown };
    expect(command.input).toEqual({
      Bucket: 'medical-files', Key: 'user/visit/file.png', Body: buffer, ContentType: 'image/png',
    });
    expect(PutObjectCommand).toHaveBeenCalledTimes(1);
  });

  it('reads a stream, maps a missing key to null and rethrows other storage errors', async () => {
    const stream = Readable.from(['private file']);
    mockSend.mockResolvedValueOnce({ Body: stream });
    await expect(service.read('user/visit/file.png')).resolves.toBe(stream);
    expect((mockSend.mock.calls[0][0] as { input: unknown }).input).toEqual({
      Bucket: 'medical-files', Key: 'user/visit/file.png',
    });
    expect(GetObjectCommand).toHaveBeenCalledTimes(1);

    mockSend.mockRejectedValueOnce(new NoSuchKey({ message: 'missing', $metadata: {} }));
    await expect(service.read('missing')).resolves.toBeNull();
    const failure = new Error('s3 unavailable');
    mockSend.mockRejectedValueOnce(failure);
    await expect(service.read('user/file')).rejects.toBe(failure);
  });

  it('rejects an invalid response body and unsafe delete keys before making a request', async () => {
    mockSend.mockResolvedValueOnce({ Body: Buffer.from('not a stream') });
    await expect(service.read('user/file')).rejects.toThrow('S3 未返回可读文件流');
    await expect(service.delete('../secret')).rejects.toThrow('拒绝删除包含不安全对象键的文件');
    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(DeleteObjectCommand).not.toHaveBeenCalled();
  });

  it('requires configuration, caches the S3 client and destroys it on shutdown', async () => {
    values.S3_BUCKET = '';
    await expect(service.delete('u/v/f'))
      .rejects.toThrow('缺少必填的 S3 配置：S3_BUCKET');

    values.S3_BUCKET = 'medical-files';
    (S3Client as unknown as jest.Mock).mockClear();
    service = new S3StorageService(config);
    values.S3_ACCESS_KEY = 'access';
    values.S3_SECRET_KEY = 'secret';
    values.S3_ENDPOINT = 'http://minio:9000';
    values.S3_FORCE_PATH_STYLE = 'true';
    await service.delete('user/visit/file');
    await service.delete('user/visit/other');
    expect(S3Client).toHaveBeenCalledTimes(1);
    const options = (S3Client as unknown as jest.Mock).mock.calls[0][0];
    expect(options).toMatchObject({
      region: 'us-east-1', endpoint: 'http://minio:9000', forcePathStyle: true,
      credentials: { accessKeyId: 'access', secretAccessKey: 'secret' },
    });
    service.onModuleDestroy();
    expect(mockDestroy).toHaveBeenCalledTimes(1);
  });
});
