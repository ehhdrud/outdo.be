import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // CORS 설정 (프론트엔드와 통신하기 위해)
  app.enableCors({
    origin: 'http://localhost:5173', // Vite 기본 포트
    credentials: true,
  });

  // 글로벌 Validation Pipe 등록 (DTO 검증)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // DTO에 없는 속성 제거
      forbidNonWhitelisted: false, // DTO에 없는 속성이 있어도 에러 발생 안함
      transform: true, // DTO로 자동 변환
    })
  );

  // 글로벌 응답 인터셉터 등록 (성공 응답 포맷)
  app.useGlobalInterceptors(new TransformInterceptor());

  // 글로벌 예외 필터 등록 (에러 응답 포맷)
  app.useGlobalFilters(new HttpExceptionFilter());

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`🚀 Server is running on http://localhost:${port}`);
  console.log(`📊 Database: ${process.env.DB_DATABASE}`);
}
bootstrap();
