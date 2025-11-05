import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

export interface JwtPayload {
  sub: number; // user_pk (JWT 표준: subject)
  email: string;
  user_pk?: number; // 하위 호환성을 위한 필드 (선택적)
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private configService: ConfigService) {
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

    return {
      user_pk: userPk,
      email: payload.email,
    };
  }
}
