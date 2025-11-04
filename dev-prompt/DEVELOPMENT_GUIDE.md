# Outdo 루틴 관리 시스템 개발 가이드

> 이 문서는 요구사항부터 백엔드 구현까지 모든 내용을 포함한 통합 가이드입니다.

---

## 📋 목차

1. [핵심 개념](#-핵심-개념)
2. [화면별 동작 정의](#-화면별-동작-정의)
3. [데이터베이스 스키마](#️-데이터베이스-스키마)
4. [API 엔드포인트](#-api-엔드포인트)
5. [백엔드 로직 구현](#-백엔드-로직-구현)
6. [모듈 구조](#️-nestjs-모듈-구조)
7. [구현 체크리스트](#-구현-체크리스트)
8. [주의사항](#️-주의사항)

---

## 🎯 핵심 개념

### 루틴 관리 철학

1. **단일 루틴 정체성**: 하나의 `routine_pk`가 루틴을 정의
2. **사용자 종속성**: 루틴은 특정 사용자(`user_pk`)에게 소속되며, 사용자 삭제 시 모든 루틴 및 기록이 삭제됨 (`ON DELETE CASCADE`)
3. **날짜별 기록 분리**: 루틴 이름은 `routines` 테이블, 실행 기록은 `routine_days` 테이블
4. **이름 변경의 일관성**: 루틴 이름 변경 시 모든 날짜에 동일하게 반영

### 데이터 구조

- **Routine**: 루틴의 정체성 (이름)
- **RoutineDay**: 날짜별 실행 기록
- **RoutineDayWorkout**: 날짜별 운동 기록
- **RoutineDaySet**: 날짜별 세트 기록

### 제약사항

- ✅ 같은 사용자는 같은 `routine_name`을 중복 생성할 수 없음
- ✅ 같은 루틴은 같은 날짜에 하나의 기록만 가능
- ✅ 다른 이름의 루틴은 같은 날짜에 여러 개 생성 가능

### 예시

"Back" 루틴(`routine_pk = 1`)을 2025-10-01/08/15에 실행:

- `routine_pk = 1` (단일 루틴)
- `routine_days` 테이블에 3개의 레코드 (각 날짜별)
- 이름은 모두 동일하게 "Back"

---

## 📱 화면별 동작 정의

### 1. Routines.tsx (루틴 목록 화면)

#### 기능

- 사용자가 만든 모든 루틴 목록 표시
- 새로운 루틴 추가 (`Add routine` 버튼)

#### 동작

**루틴 목록 조회**

- API: `GET /routines`
- 각 루틴의 가장 최근 실행 날짜 정보 표시

**루틴 클릭**

- `navigate('/routines/${routine_pk}')`
- 무조건 오늘 날짜의 루틴을 기록/수정
- 오늘 날짜 기록 있으면 UPDATE, 없으면 CREATE

**Add routine 클릭**

- `navigate('/routines/new')`
- 새 루틴 작성 화면으로 이동

---

### 2. RoutineDetail.tsx (루틴 작성/수정 화면)

#### 경로 구분

- `/routines/new` → 새 루틴 작성
- `/routines/:routine_pk` → 기존 루틴 수정

#### 시나리오 1: 새 루틴 작성

1. 사용자가 루틴 작성 후 `Save` 클릭
2. API: `POST /routines`
3. 백엔드 로직:
   - 같은 `routine_name` 존재 시 **에러 반환**
   - 없으면 새 `Routine` 생성 + 오늘 날짜의 `RoutineDay` 생성

#### 시나리오 2: 오늘 날짜 루틴 수정

1. Routines.tsx에서 루틴 클릭
2. API: `GET /routines/:routine_pk/today`
   - 오늘 날짜 기록 있으면 반환
   - 없으면 빈 폼 반환
3. 사용자가 수정 후 `Save` 클릭
4. API: `POST/PATCH /routines/:routine_pk/days/today`
   - 오늘 날짜 기록 있으면 UPDATE
   - 없으면 CREATE

#### 시나리오 3: 과거 날짜 수정

1. SummaryChart.tsx에서 특정 날짜 클릭
2. API: `GET /routines/by-date?date=2025-10-15`
3. 사용자가 수정 후 `Save` 클릭
4. API: `POST/PATCH /routines/:routine_pk/days`
   - 해당 날짜 기록 있으면 UPDATE
   - 없으면 CREATE

---

### 3. SummaryChart.tsx (대시보드 차트)

#### 기능

- 날짜별 활동 기록을 그리드로 표시
- 활동 레벨(0, 1, 2)을 색상으로 표현

#### 동작

- API: `GET /dashboard/activities?startDate=...&endDate=...`
- 날짜 클릭 시 → `/routines/by-date?date=...`로 이동

---

## 🗄️ 데이터베이스 스키마

### Users

```sql
CREATE TABLE users (
  user_pk INT PRIMARY KEY AUTO_INCREMENT,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  name VARCHAR(100) NOT NULL,
  bio TEXT
);
```

### Routines (루틴 정의)

```sql
CREATE TABLE routines (
  routine_pk INT PRIMARY KEY AUTO_INCREMENT,
  user_pk INT NOT NULL,
  routine_name VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_pk) REFERENCES users(user_pk) ON DELETE CASCADE,
  UNIQUE KEY uniq_user_name (user_pk, routine_name)
);
```

### RoutineDays (날짜별 실행 기록)

```sql
CREATE TABLE routine_days (
  routine_day_pk INT PRIMARY KEY AUTO_INCREMENT,
  routine_pk INT NOT NULL,
  user_pk INT NOT NULL,
  session_date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (routine_pk) REFERENCES routines(routine_pk) ON DELETE CASCADE,
  FOREIGN KEY (user_pk) REFERENCES users(user_pk) ON DELETE CASCADE,
  UNIQUE KEY uniq_routine_date (routine_pk, session_date)
);
```

### RoutineDayWorkouts (날짜별 운동 기록)

```sql
CREATE TABLE routine_day_workouts (
  routine_day_workout_pk INT PRIMARY KEY AUTO_INCREMENT,
  routine_day_pk INT NOT NULL,
  workout_name VARCHAR(100) NOT NULL,
  `order` INT NOT NULL DEFAULT 0,
  notes TEXT,
  FOREIGN KEY (routine_day_pk) REFERENCES routine_days(routine_day_pk) ON DELETE CASCADE,
  INDEX idx_day_order (routine_day_pk, `order`)
);
```

### RoutineDaySets (날짜별 세트 기록)

```sql
CREATE TABLE routine_day_sets (
  routine_day_set_pk INT PRIMARY KEY AUTO_INCREMENT,
  routine_day_workout_pk INT NOT NULL,
  weight DECIMAL(5,2),
  reps INT NOT NULL,
  FOREIGN KEY (routine_day_workout_pk) REFERENCES routine_day_workouts(routine_day_workout_pk) ON DELETE CASCADE
);
```

### RefreshTokens (JWT 토큰 관리)

```sql
CREATE TABLE refresh_tokens (
  token_pk INT PRIMARY KEY AUTO_INCREMENT,
  user_pk INT NOT NULL,
  token VARCHAR(500) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_pk) REFERENCES users(user_pk) ON DELETE CASCADE,
  INDEX idx_user_token (user_pk, token)
);
```

---

## 🔌 API 엔드포인트

### 인증

| Method | Endpoint                | 설명                     |
| ------ | ----------------------- | ------------------------ |
| POST   | `/auth/signup`          | 회원가입                 |
| POST   | `/auth/signin`          | 로그인 (이메일/비밀번호) |
| GET    | `/auth/google`          | 구글 로그인 시작         |
| GET    | `/auth/google/callback` | 구글 로그인 콜백         |
| POST   | `/auth/renewalToken`    | 토큰 갱신                |
| POST   | `/auth/changePassword`  | 비밀번호 변경            |
| POST   | `/auth/findPassword`    | 비밀번호 찾기            |

**구글 로그인 플로우:**

1. 사용자가 `/auth/google`로 접근
2. 구글 OAuth 인증 페이지로 리다이렉트
3. 사용자 승인 후 `/auth/google/callback`으로 리다이렉트
4. 구글 사용자 정보로 기존 회원 확인 또는 신규 회원가입
5. Access Token 및 Refresh Token 발급 후 반환

### 사용자

| Method | Endpoint         | 설명        |
| ------ | ---------------- | ----------- |
| GET    | `/users/profile` | 프로필 조회 |
| PATCH  | `/users/profile` | 프로필 수정 |

### 루틴

| Method | Endpoint                                     | 설명                | 비고                              |
| ------ | -------------------------------------------- | ------------------- | --------------------------------- |
| GET    | `/routines`                                  | 루틴 목록 조회      | 가장 최근 날짜 정보 포함          |
| GET    | `/routines/:routine_pk/today`                | 오늘 날짜 루틴 조회 | Routines.tsx용                    |
| GET    | `/routines/by-date?date=YYYY-MM-DD`          | 날짜별 루틴 조회    | SummaryChart.tsx용                |
| POST   | `/routines`                                  | 루틴 생성           | 새 Routine + 오늘 날짜 RoutineDay |
| PATCH  | `/routines/:routine_pk`                      | 루틴 이름 수정      | 모든 날짜에 반영                  |
| POST   | `/routines/:routine_pk/days/today`           | 오늘 날짜 기록 저장 | CREATE or UPDATE                  |
| PATCH  | `/routines/:routine_pk/days/today`           | 오늘 날짜 기록 수정 | UPDATE                            |
| POST   | `/routines/:routine_pk/days`                 | 날짜별 기록 저장    | CREATE or UPDATE                  |
| PATCH  | `/routines/:routine_pk/days/:routine_day_pk` | 날짜별 기록 수정    | UPDATE                            |

### 대시보드

| Method | Endpoint                                          | 설명                  |
| ------ | ------------------------------------------------- | --------------------- |
| GET    | `/dashboard/activities?startDate=...&endDate=...` | 날짜별 활동 기록 조회 |

### API 응답 형식

**성공**

```json
{
  "success": true,
  "data": { ... }
}
```

**실패**

```json
{
  "success": false,
  "message": "에러 메시지",
  "extras": {
    "rs_code": "DOE3000"
  }
}
```

---

## 💻 백엔드 로직 구현

### POST /routines (새 루틴 생성)

```typescript
async createRoutine(userId: number, dto: CreateRoutineDto) {
  // 1. 루틴 이름 중복 체크
  const existing = await this.routineRepo.findOne({
    where: { user_pk: userId, routine_name: dto.routine_name }
  });

  if (existing) {
    throw new ConflictException('Routine with this name already exists');
  }

  const today = new Date().toISOString().split('T')[0];

  // 2. Routine 생성
  const routine = await this.routineRepo.save({
    user_pk: userId,
    routine_name: dto.routine_name
  });

  // 3. 오늘 날짜의 RoutineDay 생성
  const routineDay = await this.routineDayRepo.save({
    routine_pk: routine.routine_pk,
    user_pk: userId,
    session_date: today
  });

  // 4. Workouts & Sets 저장
  for (const workout of dto.workouts) {
    const savedWorkout = await this.workoutRepo.save({
      routine_day_pk: routineDay.routine_day_pk,
      workout_name: workout.workout_name,
      order: workout.order,
      notes: workout.notes
    });

    for (const set of workout.sets) {
      await this.setRepo.save({
        routine_day_workout_pk: savedWorkout.routine_day_workout_pk,
        weight: set.weight,
        reps: set.reps
      });
    }
  }

  return routine;
}
```

### GET /routines/:routine_pk/today (오늘 날짜 조회)

```typescript
async getTodayRoutine(routinePk: number, userId: number) {
  const today = new Date().toISOString().split('T')[0];

  // 해당 routine_pk의 오늘 날짜 RoutineDay 조회
  const routineDay = await this.routineDayRepo.findOne({
    where: { routine_pk: routinePk, user_pk: userId, session_date: today },
    relations: ['workouts', 'workouts.sets']
  });

  if (routineDay) {
    return routineDay;
  }

  // 없으면 빈 폼 데이터 반환
  const routine = await this.routineRepo.findOne({
    where: { routine_pk: routinePk, user_pk: userId }
  });

  return {
    routine_pk: routine.routine_pk,
    routine_name: routine.routine_name,
    workouts: []
  };
}
```

### POST/PATCH /routines/:routine_pk/days/today (오늘 날짜 저장)

```typescript
async saveTodayRoutine(routinePk: number, userId: number, dto: SaveRoutineDayDto) {
  const today = new Date().toISOString().split('T')[0];

  // 해당 routine_pk의 오늘 날짜 RoutineDay 조회
  let routineDay = await this.routineDayRepo.findOne({
    where: { routine_pk: routinePk, user_pk: userId, session_date: today }
  });

  if (routineDay) {
    // UPDATE: 기존 workouts 삭제 후 새로 저장
    await this.workoutRepo.delete({ routine_day_pk: routineDay.routine_day_pk });
  } else {
    // CREATE: 새 RoutineDay 생성
    routineDay = await this.routineDayRepo.save({
      routine_pk: routinePk,
      user_pk: userId,
      session_date: today
    });
  }

  // Workouts & Sets 저장
  for (const workout of dto.workouts) {
    const savedWorkout = await this.workoutRepo.save({
      routine_day_pk: routineDay.routine_day_pk,
      workout_name: workout.workout_name,
      order: workout.order,
      notes: workout.notes
    });

    for (const set of workout.sets) {
      await this.setRepo.save({
        routine_day_workout_pk: savedWorkout.routine_day_workout_pk,
        weight: set.weight,
        reps: set.reps
      });
    }
  }

  return routineDay;
}
```

### GET /routines (루틴 목록 조회)

```typescript
async getRoutinesWithLatestInfo(userId: number) {
  const routines = await this.routineRepo.find({
    where: { user_pk: userId }
  });

  const routinesWithLatest = await Promise.all(
    routines.map(async (routine) => {
      const latestDay = await this.routineDayRepo.findOne({
        where: { routine_pk: routine.routine_pk },
        order: { session_date: 'DESC' },
        relations: ['workouts', 'workouts.sets']
      });

      return {
        routine_pk: routine.routine_pk,
        routine_name: routine.routine_name,
        last_session_date: latestDay?.session_date || null,
        workouts: latestDay?.workouts || []
      };
    })
  );

  return routinesWithLatest;
}
```

---

## 🏗️ NestJS 모듈 구조

```
src/
├── app.module.ts
├── main.ts
├── common/
│   ├── guards/
│   │   └── jwt-auth.guard.ts
│   ├── decorators/
│   │   └── user.decorator.ts
│   └── filters/
│       └── http-exception.filter.ts
├── auth/
│   ├── auth.module.ts
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   ├── jwt.strategy.ts
│   └── entities/
│       └── refresh-token.entity.ts
├── users/
│   ├── users.module.ts
│   ├── users.controller.ts
│   ├── users.service.ts
│   └── entities/
│       └── user.entity.ts
├── routines/
│   ├── routines.module.ts
│   ├── routines.controller.ts
│   ├── routines.service.ts
│   └── entities/
│       ├── routine.entity.ts
│       ├── routine-day.entity.ts
│       ├── routine-day-workout.entity.ts
│       └── routine-day-set.entity.ts
└── dashboard/
    ├── dashboard.module.ts
    ├── dashboard.controller.ts
    └── dashboard.service.ts
```

---

## 📝 구현 체크리스트

### Phase 1: 인프라

- [ ] TypeORM 설정
- [ ] JWT 인증 가드 구현
- [ ] 공통 데코레이터/필터 구현

### Phase 2: 인증 시스템

- [ ] User 엔티티
- [ ] Auth 모듈 (signup, signin, renewalToken)
- [ ] 비밀번호 해싱 (bcrypt)

### Phase 3: 루틴 관리

- [ ] Routine, RoutineDay, RoutineDayWorkout, RoutineDaySet 엔티티
- [ ] 루틴 생성 (이름 중복 검증)
- [ ] 오늘 날짜 루틴 조회/저장
- [ ] 날짜별 루틴 조회/저장
- [ ] 루틴 목록 조회 (최근 정보)

### Phase 4: 대시보드

- [ ] 날짜별 활동 기록 조회 (routine_days 기반)

### Phase 5: 최적화

- [ ] 인덱스 확인
- [ ] N+1 쿼리 최적화
- [ ] 테스트 작성

---

## ⚠️ 주의사항

### 1. 루틴 이름 중복 방지

- DB 제약: `UNIQUE (user_pk, routine_name)`
- API에서도 중복 체크 후 명확한 에러 메시지 반환

### 2. 날짜별 기록 관리

- 같은 `routine_pk`의 같은 날짜는 하나의 `RoutineDay`만 존재
- 다른 이름의 루틴은 같은 날짜에 여러 개 가능

### 3. CREATE vs UPDATE 로직

- 해당 `routine_pk`의 해당 날짜 `RoutineDay` 존재 여부로 판단
- 다른 `routine_pk`의 기록은 영향 없음

### 4. 타임스탬프 필드

- `created_at`/`updated_at`은 DB Entity에만 포함
- API DTO에는 포함하지 않음 (백엔드 내부용)

### 5. 환경 설정

- 개발: `synchronize: true`
- 프로덕션: 마이그레이션 사용
- JWT 시크릿, DB 정보는 환경 변수로 관리

### 6. 삭제 정책

- 사용자 삭제 → 모든 루틴 및 기록 삭제 (`ON DELETE CASCADE`)
- 루틴 삭제 → 모든 날짜의 기록 삭제
- 특정 날짜 기록 삭제 → 해당 날짜만 삭제

---

## 📦 필수 패키지

```bash
# JWT & Auth
npm install @nestjs/jwt @nestjs/passport passport passport-jwt bcrypt
npm install --save-dev @types/passport-jwt @types/bcrypt

# TypeORM & Database
npm install @nestjs/typeorm typeorm mysql2

# Validation
npm install class-validator class-transformer

# Config
npm install @nestjs/config
```

---

## 🔍 핵심 검증 사항

- [ ] 같은 이름의 루틴 중복 생성 불가 (에러 반환)
- [ ] 다른 이름의 루틴은 같은 날짜에 여러 개 생성 가능
- [ ] 해당 `routine_pk`의 해당 날짜 기록이 있으면 UPDATE, 없으면 CREATE
- [ ] 같은 루틴의 같은 날짜는 하나의 기록만 (UNIQUE 제약)
- [ ] 다른 `routine_pk`의 기록은 영향을 받지 않음
- [ ] 루틴 이름 변경 시 모든 날짜에 반영
- [ ] 사용자 삭제 시 모든 루틴 및 기록 삭제
