import { Controller, Post, Body, Get, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { SignupDto } from './dto/signup.dto';
import { SigninDto } from './dto/signin.dto';
import { RenewalTokenDto } from './dto/renewal-token.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { Public } from '../common/decorators/public.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { User, UserPayload } from '../common/decorators/user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('signup')
  async signup(@Body() signupDto: SignupDto) {
    const user = await this.authService.signup(signupDto);
    return user;
  }

  @Public()
  @Post('signin')
  async signin(@Body() signinDto: SigninDto) {
    const tokens = await this.authService.signin(signinDto);
    return tokens;
  }

  @Public()
  @Get('google')
  @UseGuards(AuthGuard('google'))
  async googleAuth() {
    // 구글 OAuth 시작 - Passport가 자동으로 리다이렉트 처리
  }

  @Public()
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleAuthCallback(@Req() req) {
    const tokens = await this.authService.googleLogin(req.user);
    // 프론트엔드로 토큰 전달
    // 개발 환경: JSON 반환 (프론트엔드에서 처리)
    // 운영 환경: 프론트엔드 URL로 리다이렉트하고 토큰을 쿼리 파라미터로 전달
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    return {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      redirect_url: `${frontendUrl}/auth/callback?access_token=${tokens.access_token}&refresh_token=${tokens.refresh_token}`,
    };
  }

  @Public()
  @Post('renewalToken')
  async renewalToken(@Body() renewalTokenDto: RenewalTokenDto) {
    const tokens = await this.authService.renewalToken(renewalTokenDto);
    return tokens;
  }

  @UseGuards(JwtAuthGuard)
  @Post('changePassword')
  async changePassword(
    @User() user: UserPayload,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    const result = await this.authService.changePassword(user.user_pk, changePasswordDto);
    return result;
  }
}
