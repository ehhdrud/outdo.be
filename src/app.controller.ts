import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  // 성공 응답 테스트
  @Get('test/success')
  testSuccess() {
    return {
      message: 'Test success response',
      data: { id: 1, name: 'test' },
    };
  }

  // 에러 응답 테스트
  @Get('test/error')
  testError() {
    throw new HttpException(
      {
        message: 'Test error response',
        extras: { rs_code: 'TEST001' },
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

