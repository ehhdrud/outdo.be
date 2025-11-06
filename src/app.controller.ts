import { Controller, Get, HttpException, HttpStatus, UseGuards } from '@nestjs/common';
import { AppService } from './app.service';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { User, UserPayload } from './common/decorators/user.decorator';

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
      HttpStatus.BAD_REQUEST
    );
  }

  // JWT 인증 가드 테스트 엔드포인트
  @UseGuards(JwtAuthGuard)
  @Get('test/auth')
  testAuth(@User() user: UserPayload) {
    return {
      message: 'JWT 인증 성공',
      user: {
        user_pk: user.user_pk,
        email: user.email,
      },
    };
  }
}
