import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const method = request?.method ?? 'UNKNOWN';
    const route = request?.route?.path ?? 'unknown';
    const controller = context.getClass()?.name ?? 'Controller';
    const handler = context.getHandler()?.name ?? 'handler';
    const routeLabel = `${controller}.${handler} ${route}`;
    const startedAt = Date.now();

    return next.handle().pipe(
      tap(() => {
        const response = context.switchToHttp().getResponse();
        const statusCode = response?.statusCode ?? 200;
        const duration = Date.now() - startedAt;

        this.logger.log(`${method} ${routeLabel} ${statusCode} +${duration}ms`);
      }),
    );
  }
}
