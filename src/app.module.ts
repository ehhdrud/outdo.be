import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { User } from './users/entities/user.entity';
import { RefreshToken } from './auth/entities/refresh-token.entity';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';

@Module({
	imports: [
		// 환경변수 설정 모듈
		ConfigModule.forRoot({
			isGlobal: true, // 모든 모듈에서 사용 가능
			envFilePath: '.env',
		}),

		// TypeORM 설정
		TypeOrmModule.forRootAsync({
			imports: [ConfigModule],
			inject: [ConfigService],
			useFactory: (configService: ConfigService) => ({
				type: 'mysql',
				host: configService.get('DB_HOST'),
				port: configService.get('DB_PORT'),
				username: configService.get('DB_USERNAME'),
				password: configService.get('DB_PASSWORD'),
				database: configService.get('DB_DATABASE'),
				entities: [User, RefreshToken], // 엔티티 명시적으로 등록
				autoLoadEntities: true, // Entity 자동 로드 (추가 엔티티용)
				synchronize: true, // 개발 환경에서만 사용! (자동 테이블 생성)
				logging: true, // SQL 쿼리 로그 출력
			}),
		}),

		// Auth 모듈
		AuthModule,
		// Users 모듈
		UsersModule,
	],
	controllers: [AppController],
	providers: [AppService],
})
export class AppModule {}
