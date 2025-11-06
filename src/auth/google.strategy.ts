import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
	constructor(private configService: ConfigService) {
		super({
			clientID: configService.get<string>('GOOGLE_CLIENT_ID'),
			clientSecret: configService.get<string>('GOOGLE_CLIENT_SECRET'),
			callbackURL: configService.get<string>('GOOGLE_CALLBACK_URL') || '/auth/google/callback',
			scope: ['email', 'profile'],
		});
	}

	async validate(accessToken: string, refreshToken: string, profile: any, done: VerifyCallback): Promise<any> {
		const { id, name, emails } = profile;

		// 필수 필드 검증
		if (!id || !emails || !emails[0] || !emails[0].value) {
			return done(new Error('구글 프로필 정보가 올바르지 않습니다'), null);
		}

		if (!name || !name.givenName || !name.familyName) {
			return done(new Error('구글 이름 정보가 올바르지 않습니다'), null);
		}

		const user = {
			google_id: id,
			email: emails[0].value,
			name: name.givenName + ' ' + name.familyName,
			accessToken,
		};
		done(null, user);
	}
}
