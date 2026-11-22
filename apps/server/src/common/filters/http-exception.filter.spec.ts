import { BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;
  let response: { status: jest.Mock; json: jest.Mock };
  let request: { url: string };
  let host: { switchToHttp: jest.Mock };

  beforeEach(() => {
    filter = new HttpExceptionFilter();
    response = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    request = { url: '/visits' };
    host = { switchToHttp: jest.fn().mockReturnValue({ getResponse: () => response, getRequest: () => request }) };
  });

  it('normalizes array validation details and status code', () => {
    filter.catch(new BadRequestException(['invalid email', 'unknown field']), host as never);
    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({
      statusCode: 400, path: '/visits',
      error: expect.objectContaining({
        code: 'BAD_REQUEST', message: 'invalid email, unknown field',
        details: ['invalid email', 'unknown field'],
      }),
    }));
  });

  it('normalizes string and object HttpException payloads', () => {
    filter.catch(new HttpException('not found', HttpStatus.NOT_FOUND), host as never);
    expect(response.json).toHaveBeenLastCalledWith(expect.objectContaining({
      statusCode: 404, error: expect.objectContaining({ code: 'NOT_FOUND', message: 'not found' }),
    }));
    filter.catch(new HttpException({ error: 'Conflict', message: 'duplicate' }, 409), host as never);
    expect(response.json).toHaveBeenLastCalledWith(expect.objectContaining({
      statusCode: 409, error: expect.objectContaining({ code: 'CONFLICT', message: 'duplicate' }),
    }));
  });

  it('uses a generic message when an exception has no recognized details', () => {
    filter.catch({ unexpected: true }, host as never);
    expect(response.status).toHaveBeenCalledWith(500);
    expect(response.json).toHaveBeenLastCalledWith(expect.objectContaining({
      statusCode: 500, error: expect.objectContaining({ message: '服务器内部错误' }),
    }));
  });
});
