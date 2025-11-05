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
import { RenewalTokenDto } from './dto/renewal-token.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

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
      const { password, ...userWithoutPassword } = savedUser;
      return userWithoutPassword as Omit<User, 'password'>;
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

    // 2. 비밀번호가 없는 경우 (구글 로그인 등) 체크
    if (!user.password) {
      throw new UnauthorizedException('이메일 또는 비밀번호가 올바르지 않습니다');
    }

    // 3. 비밀번호 검증
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('이메일 또는 비밀번호가 올바르지 않습니다');
    }

    // 4. Access Token 발급
    const payload = { sub: user.user_pk, email: user.email };
    const access_token = this.jwtService.sign(payload);

    // 5. Refresh Token 발급 및 DB 저장
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

  async renewalToken(renewalTokenDto: RenewalTokenDto): Promise<{
    access_token: string;
  }> {
    const { refresh_token } = renewalTokenDto;

    try {
      // 1. Refresh Token 검증 (JWT 토큰 자체가 유효한지 확인)
      const decoded = this.jwtService.verify(refresh_token);
      
      if (!decoded.sub || !decoded.email || decoded.type !== 'refresh') {
        throw new UnauthorizedException('유효하지 않은 Refresh Token입니다');
      }

      // 2. DB에서 Refresh Token 조회
      const refreshTokenEntity = await this.refreshTokenRepository.findOne({
        where: {
          token: refresh_token,
          user_pk: decoded.sub,
        },
      });

      if (!refreshTokenEntity) {
        throw new UnauthorizedException('Refresh Token이 존재하지 않습니다');
      }

      // 3. 만료 확인
      const now = new Date();
      if (refreshTokenEntity.expires_at < now) {
        // 만료된 토큰은 DB에서 삭제
        await this.refreshTokenRepository.remove(refreshTokenEntity);
        throw new UnauthorizedException('Refresh Token이 만료되었습니다');
      }

      // 4. 사용자 정보 조회
      const user = await this.userRepository.findOne({
        where: { user_pk: decoded.sub },
      });

      if (!user) {
        throw new UnauthorizedException('사용자를 찾을 수 없습니다');
      }

      // 5. 새로운 Access Token 발급
      const payload = { sub: user.user_pk, email: user.email };
      const access_token = this.jwtService.sign(payload);

      return {
        access_token,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      // JWT 검증 실패 등 기타 에러
      throw new UnauthorizedException('유효하지 않은 Refresh Token입니다');
    }
  }

  async changePassword(userPk: number, changePasswordDto: ChangePasswordDto): Promise<{ message: string }> {
    const { current_password, new_password } = changePasswordDto;

    // 1. 사용자 조회
    const user = await this.userRepository.findOne({
      where: { user_pk: userPk },
    });

    if (!user) {
      throw new UnauthorizedException('사용자를 찾을 수 없습니다');
    }

    // 2. 비밀번호가 없는 경우 (구글 로그인 등) 체크
    if (!user.password) {
      throw new UnauthorizedException('비밀번호가 설정되지 않은 계정입니다');
    }

    // 3. 현재 비밀번호 검증
    const isPasswordValid = await bcrypt.compare(current_password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('현재 비밀번호가 올바르지 않습니다');
    }

    // 4. 새 비밀번호 해싱
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(new_password, saltRounds);

    // 5. 비밀번호 업데이트
    try {
      user.password = hashedPassword;
      await this.userRepository.save(user);

      return {
        message: '비밀번호가 성공적으로 변경되었습니다',
      };
    } catch (error) {
      throw new InternalServerErrorException('비밀번호 변경 중 오류가 발생했습니다');
    }
  }
}
