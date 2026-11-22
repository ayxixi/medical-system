import { BadRequestException, ExecutionContext } from '@nestjs/common';
import { lastValueFrom, of, throwError } from 'rxjs';
import { AuditService } from './audit.service';
import { AuditInterceptor } from './audit.interceptor';

function createContext(method: string, user = { id: 'account-1', email: 'private@example.com', username: null, tokenVersion: 0 }) {
  const request = { method, user, params: { id: 'visit-1' }, body: { diagnosis: 'private diagnosis' } };
  const response = { statusCode: 201 };
  const context = {
    getType: jest.fn().mockReturnValue('http'),
    switchToHttp: jest.fn().mockReturnValue({ getRequest: () => request, getResponse: () => response }),
    getClass: jest.fn().mockReturnValue({ name: 'VisitController' }),
    getHandler: jest.fn().mockReturnValue({ name: 'create' }),
  } as unknown as ExecutionContext;
  return { context, request, response };
}

describe('AuditInterceptor', () => {
  let auditService: { record: jest.Mock };
  let interceptor: AuditInterceptor;

  beforeEach(() => {
    auditService = { record: jest.fn().mockResolvedValue(undefined) };
    interceptor = new AuditInterceptor(auditService as unknown as AuditService);
  });

  it('records only authenticated write metadata and preserves the handler result', async () => {
    const { context } = createContext('post');
    const result = await lastValueFrom(interceptor.intercept(context, { handle: () => of({ ok: true }) }));
    expect(result).toEqual({ ok: true });
    expect(auditService.record).toHaveBeenCalledWith({
      accountId: 'account-1', action: 'Visit.create', resourceType: 'Visit', resourceId: 'visit-1',
      method: 'POST', statusCode: 201, succeeded: true,
    });
    expect(JSON.stringify(auditService.record.mock.calls)).not.toContain('private diagnosis');
    expect(JSON.stringify(auditService.record.mock.calls)).not.toContain('private@example.com');
  });

  it('records failed write status and rethrows the original handler error', async () => {
    const { context } = createContext('PATCH');
    const error = new BadRequestException('invalid');
    await expect(lastValueFrom(interceptor.intercept(context, { handle: () => throwError(() => error) })))
      .rejects.toBe(error);
    expect(auditService.record).toHaveBeenCalledWith(expect.objectContaining({
      method: 'PATCH', statusCode: 400, succeeded: false,
    }));
  });

  it('skips reads and unauthenticated writes', async () => {
    const read = createContext('GET');
    await lastValueFrom(interceptor.intercept(read.context, { handle: () => of('read') }));
    const anonymous = createContext('POST');
    (anonymous.request as { user?: unknown }).user = undefined;
    await lastValueFrom(interceptor.intercept(anonymous.context, { handle: () => of('anonymous') }));
    expect(auditService.record).not.toHaveBeenCalled();
  });
});
