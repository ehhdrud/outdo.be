import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // CORS 설정 (프론트엔드와 통신하기 위해)
  app.enableCors({
    origin: 'http://localhost:5173', // Vite 기본 포트
    credentials: true,
  });
  
  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`🚀 Server is running on http://localhost:${port}`);
  console.log(`📊 Database: ${process.env.DB_DATABASE || 'outdo_db'}`);
}
bootstrap();


