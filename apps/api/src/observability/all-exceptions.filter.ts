import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';

type RequestWithId = {
  requestId?: string;
  method?: string;
  originalUrl?: string;
  url?: string;
};

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const response = context.getResponse();
    const request = context.getRequest<RequestWithId>();
    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const exceptionResponse = exception instanceof HttpException ? exception.getResponse() : undefined;
    const exceptionBody =
      typeof exceptionResponse === 'object' && exceptionResponse !== null && !Array.isArray(exceptionResponse)
        ? (exceptionResponse as Record<string, unknown>)
        : {};
    const message =
      typeof exceptionResponse === 'object' && exceptionResponse !== null && 'message' in exceptionResponse
        ? (exceptionResponse as { message: unknown }).message
        : exception instanceof Error
          ? exception.message
          : 'Internal server error';

    const body = {
      ...exceptionBody,
      statusCode: status,
      message,
      requestId: request.requestId,
      path: request.originalUrl ?? request.url,
      timestamp: new Date().toISOString(),
    };

    console.error(
      JSON.stringify({
        level: 'error',
        event: 'http_exception',
        requestId: request.requestId,
        method: request.method,
        path: request.originalUrl ?? request.url,
        statusCode: status,
        error: exception instanceof Error ? exception.message : String(exception),
      }),
    );

    response.status(status).json(body);
  }
}
