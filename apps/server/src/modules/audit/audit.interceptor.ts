import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable, from, throwError } from 'rxjs';
import { catchError, map, mergeMap } from 'rxjs/operators';
import { AuthenticatedAccount } from '../auth/decorators/current-account.decorator';
import { AuditService } from './audit.service';

type AuditedRequest = Request & { user?: AuthenticatedAccount };

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const http = context.switchToHttp();
    const request = http.getRequest<AuditedRequest>();
    const method = request.method?.toUpperCase();
    const account = request.user;
    if (!account?.id || !['POST', 'PATCH', 'PUT', 'DELETE'].includes(method)) {
      return next.handle();
    }

    const resourceType = context.getClass().name.replace(/Controller$/, '') || 'Unknown';
    const handlerName = context.getHandler().name || 'unknown';
    const resourceId = typeof request.params?.id === 'string'
      ? request.params.id.slice(0, 200)
      : undefined;
    const response = http.getResponse<Response>();
    const event = {
      accountId: account.id,
      action: `${resourceType}.${handlerName}`.slice(0, 200),
      resourceType: resourceType.slice(0, 100),
      resourceId,
      method,
    };

    return next.handle().pipe(
      mergeMap((value) => from(this.auditService.record({
        ...event,
        statusCode: response.statusCode,
        succeeded: true,
      })).pipe(map(() => value))),
      catchError((error: unknown) => from(this.auditService.record({
        ...event,
        statusCode: response.statusCode >= 400 ? response.statusCode : this.getStatusCode(error),
        succeeded: false,
      })).pipe(mergeMap(() => throwError(() => error)))),
    );
  }

  private getStatusCode(error: unknown): number {
    if (
      typeof error === 'object' && error !== null &&
      'getStatus' in error && typeof error.getStatus === 'function'
    ) {
      const status = error.getStatus();
      if (Number.isInteger(status)) return status;
    }
    return 500;
  }
}
