import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
	catch(exception: HttpException, host: ArgumentsHost) {
		const ctx = host.switchToHttp();
		const response = ctx.getResponse<Response>();
		const request = ctx.getRequest<Request>();
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
	}
}
