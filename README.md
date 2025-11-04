# Outdo Backend

NestJS 기반 백엔드 서버

## 설치 방법

```bash
npm install
```

## 실행 방법

### 개발 모드

```bash
npm run start:dev
```

### 프로덕션 빌드

```bash
npm run build
npm run start:prod
```

## 환경 변수 설정

`.env` 파일에 다음 변수들을 설정해야 합니다:

```env
# 데이터베이스
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=your_username
DB_PASSWORD=your_password
DB_DATABASE=your_database

# JWT
JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=1h

# 구글 OAuth (선택)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback
```

## 기본 엔드포인트

### 인증

- `POST /auth/signup` - 회원가입
- `POST /auth/signin` - 로그인 (이메일/비밀번호)
- `GET /auth/google` - 구글 로그인 시작
- `GET /auth/google/callback` - 구글 로그인 콜백

### 기타

- `GET http://localhost:3000` - 기본 엔드포인트

## 포트

기본 포트: **3000**
