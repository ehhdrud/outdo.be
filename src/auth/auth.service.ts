import {
  Injectable,
  ConflictException,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { User } from '../users/entities/user.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { SignupDto } from './dto/signup.dto';
import { SigninDto } from './dto/signin.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(RefreshToken)
    private refreshTokenRepository: Repository<RefreshToken>,
    private jwtService: JwtService,
  ) {}

  async signup(signupDto: SignupDto): Promise<User> {
    const { email, password, name } = signupDto;

    // 1. 이메일 중복 확인
    const existingUser = await this.userRepository.findOne({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('이미 사용 중인 이메일입니다');
    }

    // 2. 비밀번호 해싱
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // 3. User 생성
    const user = this.userRepository.create({
      email,
      password: hashedPassword,
      name,
      bio: null,
    });

    try {
      const savedUser = await this.userRepository.save(user);
      // password 제외하고 반환
      delete (savedUser as any).password;
      return savedUser;
    } catch (error) {
      throw new InternalServerErrorException('회원가입 중 오류가 발생했습니다');
    }
  }

  async signin(signinDto: SigninDto): Promise<{
    access_token: string;
    refresh_token: string;
  }> {
    const { email, password } = signinDto;

    // 1. 이메일로 사용자 조회
    const user = await this.userRepository.findOne({
      where: { email },
    });

    if (!user) {
      throw new UnauthorizedException('이메일 또는 비밀번호가 올바르지 않습니다');
    }

    // 2. 비밀번호 검증
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('이메일 또는 비밀번호가 올바르지 않습니다');
    }

    // 3. Access Token 발급
    const payload = { sub: user.user_pk, email: user.email };
    const access_token = this.jwtService.sign(payload);

    // 4. Refresh Token 발급 및 DB 저장
    const refreshTokenPayload = {
      sub: user.user_pk,
      email: user.email,
      type: 'refresh',
    };
    const refresh_token = this.jwtService.sign(refreshTokenPayload, {
      expiresIn: '7d',
    });

    // Refresh Token DB 저장
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7일 후 만료

    const refreshTokenEntity = this.refreshTokenRepository.create({
      user_pk: user.user_pk,
      token: refresh_token,
      expires_at: expiresAt,
      created_at: new Date(),
    });

    await this.refreshTokenRepository.save(refreshTokenEntity);

    return {
      access_token,
      refresh_token,
    };
  }

  async googleLogin(googleUser: { google_id: string; email: string; name: string }): Promise<{
    access_token: string;
    refresh_token: string;
  }> {
    const { google_id, email, name } = googleUser;

    // 1. google_id로 기존 회원 확인
    let user = await this.userRepository.findOne({
      where: { google_id },
    });

    // 2. google_id로 없으면 email로 확인
    if (!user) {
      user = await this.userRepository.findOne({
        where: { email },
      });

      // 3. email로 찾았으면 google_id 업데이트
      if (user) {
        user.google_id = google_id;
        await this.userRepository.save(user);
      }
    }

    // 4. 둘 다 없으면 신규 회원가입
    if (!user) {
      user = this.userRepository.create({
        email,
        google_id,
        name,
        password: null, // 구글 로그인은 비밀번호 없음
        bio: null,
      });
      user = await this.userRepository.save(user);
    }

    // 5. Access Token 발급
    const payload = { sub: user.user_pk, email: user.email };
    const access_token = this.jwtService.sign(payload);

    // 6. Refresh Token 발급 및 DB 저장
    const refreshTokenPayload = {
      sub: user.user_pk,
      email: user.email,
      type: 'refresh',
    };
    const refresh_token = this.jwtService.sign(refreshTokenPayload, {
      expiresIn: '7d',
    });

    // Refresh Token DB 저장
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7일 후 만료

    const refreshTokenEntity = this.refreshTokenRepository.create({
      user_pk: user.user_pk,
      token: refresh_token,
      expires_at: expiresAt,
      created_at: new Date(),
    });

    await this.refreshTokenRepository.save(refreshTokenEntity);

    return {
      access_token,
      refresh_token,
    };
  }
}
