import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';

export interface JwtPayload {
  sub: number; // user_pk (JWT 표준: subject)
  email: string;
  user_pk?: number; // 하위 호환성을 위한 필드 (선택적)
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    @InjectRepository(User)
    private userRepository: Repository<User>
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') || 'default-secret',
    });
  }

  async validate(payload: JwtPayload) {
    // sub (JWT 표준) 또는 user_pk (하위 호환성) 사용
    const userPk = payload.sub || payload.user_pk;

    if (!userPk || !payload.email) {
      throw new UnauthorizedException('Invalid token payload');
    }

    // DB에서 사용자 존재 여부 확인 (사용자 삭제 시 토큰 무효화)
    const user = await this.userRepository.findOne({
      where: { user_pk: userPk },
      select: ['user_pk', 'email'], // 필요한 필드만 선택
    });

    if (!user) {
      throw new UnauthorizedException('사용자를 찾을 수 없습니다');
    }

    // 이메일 일치 확인 (토큰 변조 방지)
    if (user.email !== payload.email) {
      throw new UnauthorizedException('토큰 정보가 일치하지 않습니다');
    }

    return {
      user_pk: user.user_pk,
      email: user.email,
    };
  }
}
