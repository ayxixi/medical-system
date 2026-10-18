import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';

type ErrorDetails = {
  message: string;
  details?: string[];
};

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const httpContext = host.switchToHttp();
    const response = httpContext.getResponse();
    const request = httpContext.getRequest();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const payload =
      exception instanceof HttpException ? exception.getResponse() : undefined;
    const normalizedError = this.normalizeError(payload, exception);
    const body: Record<string, unknown> = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request?.url,
      error: {
        code: this.resolveCode(status),
        message: normalizedError.message,
      },
    };

    if (normalizedError.details?.length) {
      (body.error as Record<string, unknown>).details = normalizedError.details;
    }

    response.status(status).json(body);
  }

  private normalizeError(
    payload: string | object | undefined,
    exception: unknown,
  ): ErrorDetails {
    if (Array.isArray(payload)) {
      return { message: payload.join(', '), details: payload };
    }

    if (typeof payload === 'string') {
      return { message: payload };
    }

    if (payload && typeof payload === 'object') {
      const value = payload as { message?: string | string[]; error?: string };

      if (Array.isArray(value.message)) {
        return {
          message: value.message.join(', '),
          details: value.message,
        };
      }

      if (typeof value.message === 'string') {
        return { message: value.message };
      }

      if (typeof value.error === 'string') {
        return { message: value.error };
      }
    }

    if (exception instanceof Error && exception.message) {
      return { message: exception.message };
    }

    return { message: '服务器内部错误' };
  }

  private resolveCode(status: number): string {
    const statusName = HttpStatus[status];

    return typeof statusName === 'string'
      ? statusName
      : 'INTERNAL_SERVER_ERROR';
  }
}
