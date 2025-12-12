import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // HttpException인 경우
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse() as string | { message: string | string[]; error?: string; [key: string]: any };

      // 에러 메시지 추출
      const message =
        typeof exceptionResponse === 'string'
          ? exceptionResponse
          : Array.isArray(exceptionResponse.message)
            ? exceptionResponse.message.join(', ')
            : exceptionResponse.message || exception.message;

      // rs_code 추출 (extras에 있을 경우)
      const rsCode = typeof exceptionResponse === 'object' && exceptionResponse.extras?.rs_code ? exceptionResponse.extras.rs_code : undefined;

      // 에러 응답 형식
      const errorResponse = {
        success: false,
        message,
        ...(rsCode && {
          extras: {
            rs_code: rsCode,
          },
        }),
      };

      response.status(status).json(errorResponse);
      return;
    }

    // 예상치 못한 예외 (DB 에러, 기타 런타임 에러 등)
    this.logger.error(
      `Unexpected error on ${request.method} ${request.url}: ${exception instanceof Error ? exception.message : 'Unknown error'}`,
      exception instanceof Error ? exception.stack : undefined,
    );

    const errorResponse = {
      success: false,
      message: '서버 내부 오류가 발생했습니다',
    };

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json(errorResponse);
  }
}
