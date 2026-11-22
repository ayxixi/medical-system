import { ExecutionContext, Logger } from '@nestjs/common';
import { lastValueFrom, of } from 'rxjs';
import { LoggingInterceptor } from './logging.interceptor';

describe('LoggingInterceptor', () => {
  it('logs method, route template and status without URL parameters or request body', async () => {
    const interceptor = new LoggingInterceptor();
    const log = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    const request = { method: 'POST', route: { path: '/visits' }, url: '/visits?note=private', body: { diagnosis: 'private diagnosis' } };
    const response = { statusCode: 201 };
    const context = {
      switchToHttp: jest.fn().mockReturnValue({ getRequest: () => request, getResponse: () => response }),
      getClass: jest.fn().mockReturnValue({ name: 'VisitController' }),
      getHandler: jest.fn().mockReturnValue({ name: 'create' }),
    } as unknown as ExecutionContext;

    await lastValueFrom(interceptor.intercept(context, { handle: () => of({ ok: true }) }));
    const logged = JSON.stringify(log.mock.calls);
    expect(logged).toContain('POST VisitController.create /visits 201');
    expect(logged).not.toContain('private diagnosis');
    expect(logged).not.toContain('note=private');
    log.mockRestore();
  });
});
