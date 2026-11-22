import { BadGatewayException, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RecognitionService } from './recognition.service';

describe('RecognitionService', () => {
  let service: RecognitionService;
  let values: Record<string, unknown>;
  const config = {
    get: (key: string, fallback?: unknown) => values[key] ?? fallback,
  } as unknown as ConfigService;

  beforeEach(() => {
    values = { RECOGNITION_WORKER_URL: 'http://localhost:8001/', RECOGNITION_API_KEY: 'local-secret', RECOGNITION_TIMEOUT_MS: 1234 };
    service = new RecognitionService(config);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('sends media to the configured local worker and returns recognized text', async () => {
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ text: '识别正文' }), { status: 200 }),
    );
    const file = { buffer: Buffer.from('private media bytes'), mimetype: 'image/png' };

    await expect(service.recognize('ocr', file)).resolves.toEqual({ text: '识别正文' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('http://localhost:8001/ocr');
    expect(options).toMatchObject({
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Recognition-Key': 'local-secret' },
    });
    expect(JSON.parse(options!.body as string)).toEqual({
      content: file.buffer.toString('base64'), mimeType: 'image/png',
    });
    expect(options?.signal).toBeInstanceOf(AbortSignal);
  });

  it('does not call fetch when the worker is not configured', async () => {
    values.RECOGNITION_WORKER_URL = '';
    const fetchMock = jest.spyOn(globalThis, 'fetch');
    await expect(service.recognize('transcribe', { buffer: Buffer.from('x'), mimetype: 'audio/webm' }))
      .rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('maps worker size limits and busy responses to stable client errors', async () => {
    const fetchMock = jest.spyOn(globalThis, 'fetch');
    fetchMock.mockResolvedValueOnce(new Response('', { status: 413 }));
    await expect(service.recognize('ocr', { buffer: Buffer.from('x'), mimetype: 'image/jpeg' }))
      .rejects.toThrow('媒体文件超过识别服务限制');
    fetchMock.mockResolvedValueOnce(new Response('', { status: 429 }));
    await expect(service.recognize('transcribe', { buffer: Buffer.from('x'), mimetype: 'audio/webm' }))
      .rejects.toMatchObject({ status: 429 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('maps timeouts, invalid responses and network failures without logging media text', async () => {
    const fetchMock = jest.spyOn(globalThis, 'fetch');
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    const timeout = new Error('timeout');
    timeout.name = 'TimeoutError';
    fetchMock.mockRejectedValueOnce(timeout);
    await expect(service.recognize('ocr', { buffer: Buffer.from('x'), mimetype: 'image/png' }))
      .rejects.toBeInstanceOf(BadGatewayException);

    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ text: 12 }), { status: 200 }));
    await expect(service.recognize('ocr', { buffer: Buffer.from('x'), mimetype: 'image/png' }))
      .rejects.toThrow('识别失败');

    fetchMock.mockRejectedValueOnce(new TypeError('network details with private text'));
    await expect(service.recognize('transcribe', { buffer: Buffer.from('x'), mimetype: 'audio/webm' }))
      .rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(warn).toHaveBeenCalledWith('识别工作进程不可用');
    expect(JSON.stringify(warn.mock.calls)).not.toContain('private text');
  });
});
