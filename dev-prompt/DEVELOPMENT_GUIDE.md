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

### WorkoutPersonalRecords (운동별 최고 무게 기록)

```sql
CREATE TABLE workout_personal_records (
  record_pk INT PRIMARY KEY AUTO_INCREMENT,
  user_pk INT NOT NULL,
  workout_name VARCHAR(100) NOT NULL,
  `order` INT NOT NULL,
  max_weight DECIMAL(5,2) NOT NULL, -- 해당 workout_name + order + user_pk 조합의 최고 무게
  achieved_at DATE NOT NULL, -- 최고 무게를 달성한 날짜
  routine_day_pk INT, -- 최고 무게를 달성한 routine_day 참조
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_pk) REFERENCES users(user_pk) ON DELETE CASCADE,
  UNIQUE KEY uniq_user_workout_order (user_pk, workout_name, `order`)
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

| Method | Endpoint                                          | 설명                      |
| ------ | ------------------------------------------------- | ------------------------- |
| GET    | `/dashboard/activities?startDate=...&endDate=...` | 날짜별 활동 기록 조회     |
| GET    | `/dashboard/achievements`                         | 최근 5개 achievement 조회 |

**쿼리 파라미터:**

- `/dashboard/activities`: `startDate` (필수, YYYY-MM-DD), `endDate` (필수, YYYY-MM-DD)

**응답 형식:**

```typescript
// GET /dashboard/activities 응답
interface DayActivity {
  date: string; // YYYY-MM-DD
  activity: number; // 0, 1, 2
  routine_name: string | null;
  routine_pk: number | null;
  routine_day_pk: number | null;
  achievement: number | null; // weight * reps 합산의 증가량 합계
  has_max_weight_achieved: boolean; // 최고 무게 달성 여부
  max_weight_records: MaxWeightRecord[] | null; // 최고 무게 달성 세부 정보
  is_new_routine: boolean; // 새로운 루틴 생성 여부
}

interface MaxWeightRecord {
  workout_name: string;
  order: number;
  max_weight: number;
}

// GET /dashboard/achievements 응답
interface AchievementDetail {
  date: string;
  routine_name: string;
  routine_pk: number;
  routine_day_pk: number;
  achievement: number; // 항상 > 0
  workouts: AchievementWorkout[];
}

interface AchievementWorkout {
  workout_name: string;
  order: number;
  weight_increase: number; // weight * reps 합산의 증가분
  previous_max_weight: number; // 이전 기록의 모든 세트 weight * reps 합산
  current_max_weight: number; // 현재 기록의 모든 세트 weight * reps 합산
}
```

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

### 최고 무게 체크 및 업데이트 헬퍼 메서드

```typescript
// RoutinesService에 추가
private async checkAndUpdateMaxWeight(
  userId: number,
  workoutName: string,
  order: number,
  currentMaxWeight: number,
  sessionDate: string,
  routineDayPk: number
) {
  // 기존 최고 무게 기록 조회
  const existingRecord = await this.workoutPersonalRecordRepo.findOne({
    where: {
      user_pk: userId,
      workout_name: workoutName,
      order: order
    }
  });

  if (!existingRecord || currentMaxWeight > existingRecord.max_weight) {
    // 최고 무게 달성 또는 갱신
    if (existingRecord) {
      // 기존 레코드 업데이트
      existingRecord.max_weight = currentMaxWeight;
      existingRecord.achieved_at = sessionDate;
      existingRecord.routine_day_pk = routineDayPk;
      await this.workoutPersonalRecordRepo.save(existingRecord);
    } else {
      // 새 레코드 생성
      await this.workoutPersonalRecordRepo.save({
        user_pk: userId,
        workout_name: workoutName,
        order: order,
        max_weight: currentMaxWeight,
        achieved_at: sessionDate,
        routine_day_pk: routineDayPk
      });
    }
  }
}
```

**참고**: Routines 모듈에 `WorkoutPersonalRecord` 엔티티와 리포지토리를 import해야 합니다.

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

  // 4. Workouts & Sets 저장 및 최고 무게 체크
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

    // 최고 무게 체크 및 업데이트
    const sets = workout.sets;
    if (sets.length > 0) {
      const currentMaxWeight = Math.max(...sets.map((s) => s.weight));
      await this.checkAndUpdateMaxWeight(
        userId,
        workout.workout_name,
        workout.order,
        currentMaxWeight,
        today,
        routineDay.routine_day_pk
      );
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

  // Workouts & Sets 저장 및 최고 무게 체크
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

    // 최고 무게 체크 및 업데이트
    const sets = workout.sets;
    if (sets.length > 0) {
      const currentMaxWeight = Math.max(...sets.map((s) => s.weight));
      const sessionDate = routineDay.session_date || today;
      await this.checkAndUpdateMaxWeight(
        userId,
        workout.workout_name,
        workout.order,
        currentMaxWeight,
        sessionDate,
        routineDay.routine_day_pk
      );
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
│   └── (참고: WorkoutPersonalRecord 엔티티는 dashboard/entities에 있지만, Routines 모듈에서도 import하여 사용)
└── dashboard/
    ├── dashboard.module.ts
    ├── dashboard.controller.ts
    ├── dashboard.service.ts
    └── entities/
        └── workout-personal-record.entity.ts
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

- [ ] WorkoutPersonalRecord 엔티티
- [ ] 날짜별 활동 기록 조회 (routine_days 기반)
- [ ] Activity 레벨 계산 (0, 1, 2)
- [ ] Achievement 계산 (weight \* reps 합산 비교)
- [ ] 최고 무게 달성 체크 및 추적
- [ ] 새로운 루틴 생성 체크
- [ ] 최근 5개 achievement 조회

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

### 6. 대시보드 구현 주의사항

- **이전 기록 조회**: 현재 날짜보다 **이전** 날짜만 조회, 같은 `routine_pk`의 가장 최근 기록만 사용
- **Volume 비교**: 각 운동의 **모든 세트 `weight * reps` 합산**을 비교 (단순 무게가 아님)
- **여러 루틴**: 같은 날짜에 여러 루틴이 있으면 각각 별도 계산, 각 루틴은 자신의 이전 기록과만 비교
- **최고 무게 추적**:
  - `workout_personal_records` 테이블을 사용하여 각 `workout_name` + `order` + `user_pk` 조합별로 최고 무게 추적
  - **중요**: 최고 무게 체크 및 업데이트는 루틴 저장 시점(Phase 5, 7)에 수행됨
  - 대시보드 조회 시(Phase 9)에는 이미 저장된 `workout_personal_records` 테이블을 조회하여 해당 날짜에 달성 여부 확인
- **새로운 루틴 생성**: 해당 날짜에 새로운 `routine_pk`가 생성되면 `activity = 2`
- **날짜 범위**: `startDate`와 `endDate`는 필수 파라미터

### 7. 삭제 정책

- 사용자 삭제 → 모든 루틴 및 기록 삭제 (`ON DELETE CASCADE`)
- 루틴 삭제 → 모든 날짜의 기록 삭제
- 특정 날짜 기록 삭제 → 해당 날짜만 삭제

### 8. 대시보드 Activity 및 Achievement

- **Activity 레벨**:
  - `0`: 운동을 하지 않은 날 (`routine_day`가 없음)
  - `1`: 운동을 했지만 성취가 없는 날 (`routine_day`가 있지만 다음 모두 미충족):
    - `achievement = 0` 또는 `null`
    - 최고 무게도 달성하지 않음
    - 새로운 루틴 생성이 아님
  - `2`: 성취가 있는 날 (다음 중 하나 이상 충족):
    - `achievement > 0` (weight \* reps 증가)
    - 최고 무게 달성
    - 새로운 루틴 생성 (해당 날짜에 새로운 `routine_pk`가 생성됨)
- **Achievement 값의 의미**:
  - `null`: 다음 중 하나
    - 운동을 하지 않은 날 (`routine_day`가 없음)
    - 운동을 했지만 해당 `routine_pk`의 첫 번째 기록 (이전 기록이 없어서 비교 불가)
  - `0`: 이전 기록이 있지만 증량이 없음 (weight \* reps 합산이 같거나 감소)
  - `> 0`: 증량이 있음 (weight \* reps 합산이 증가)
- **Achievement 계산**:
  - 같은 `workout_name` && 같은 `order`인 운동끼리 비교
  - 각 세트의 `weight * reps` 합산 비교
  - 증량이 있으면 `weight_increase`를 기록하고 모든 `weight_increase`를 합산
- **최고 무게 달성**:
  - 각 `workout_name` + `order` + `user_pk` 조합별로 최고 무게 추적
  - `workout_personal_records` 테이블에 저장
  - 각 `routine_day_workout`의 모든 세트 중 최대 `weight` 값 계산하여 비교
  - `weight_increase` 계산과 최고 무게 달성 체크는 **별개**로 수행
  - `achievement`는 `weight * reps` 증가분만 계산
  - 최고 무게 달성은 `activity = 2` 판단에만 사용
- **새로운 루틴 생성**:
  - 해당 날짜에 새로운 `routine_pk`가 생성되면 `is_new_routine = true`
  - `activity = 2`로 설정
- **여러 루틴 처리**:
  - 같은 날짜에 여러 루틴(`routine_day`)이 있는 경우, 각 루틴별로 별도의 `DayActivity` 객체를 생성하고 독립적으로 achievement를 계산

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

### 루틴 관리

- [ ] 같은 이름의 루틴 중복 생성 불가 (에러 반환)
- [ ] 다른 이름의 루틴은 같은 날짜에 여러 개 생성 가능
- [ ] 해당 `routine_pk`의 해당 날짜 기록이 있으면 UPDATE, 없으면 CREATE
- [ ] 같은 루틴의 같은 날짜는 하나의 기록만 (UNIQUE 제약)
- [ ] 다른 `routine_pk`의 기록은 영향을 받지 않음
- [ ] 루틴 이름 변경 시 모든 날짜에 반영
- [ ] 사용자 삭제 시 모든 루틴 및 기록 삭제

### 대시보드 (GET /dashboard/activities)

- [ ] 날짜 범위의 모든 날짜가 응답에 포함됨
- [ ] `routine_day`가 없는 날짜는 `activity = 0`, `achievement = null`, `has_max_weight_achieved = false`, `max_weight_records = null`, `is_new_routine = false`
- [ ] `routine_day`가 있지만 `achievement = 0` 또는 `null`이고 최고 무게도 달성하지 않았고 새로운 루틴도 아니면 `activity = 1`
- [ ] `achievement > 0` 또는 최고 무게 달성 또는 새로운 루틴 생성 시 `activity = 2`
- [ ] 새로운 루틴 생성 시 `achievement = null`이어도 `activity = 2`
- [ ] 모든 응답에 `has_max_weight_achieved`, `max_weight_records`, `is_new_routine` 필드가 포함됨
- [ ] 최고 무게 달성 시 `has_max_weight_achieved = true` 및 `max_weight_records` 배열에 해당 workout 정보 포함
- [ ] `max_weight_records` 배열에는 `workout_name`, `order`, `max_weight` 필드가 포함됨
- [ ] 최고 무게를 달성하지 않았을 때 `max_weight_records = null`
- [ ] 여러 workout에서 최고 무게를 달성했을 때 `max_weight_records` 배열에 모두 포함됨
- [ ] 새로운 루틴 생성 시 `is_new_routine = true`
- [ ] `activity = 2`일 때 `achievement > 0` 또는 `has_max_weight_achieved = true` 또는 `is_new_routine = true` 중 하나 이상이어야 함
- [ ] 같은 날짜에 여러 루틴이 있으면 각각 별도 항목으로 반환
- [ ] 같은 `workout_name` && 같은 `order`만 비교
- [ ] 각 운동의 모든 세트 `weight * reps` 합산을 비교하여 증량 계산
- [ ] 각 `routine_day_workout`의 모든 세트 중 최고 무게를 계산하여 `max_weight`와 비교
- [ ] 최고 무게가 `max_weight`보다 크면 최고 무게 달성 및 `max_weight` 갱신
- [ ] 이전 기록 조회 시 현재 날짜보다 **이전** 날짜만 조회, 같은 `routine_pk`의 가장 최근 기록만 사용

### 대시보드 (GET /dashboard/achievements)

- [ ] `achievement > 0`인 기록만 반환됨
- [ ] 날짜 기준 내림차순 정렬 (최신순)
- [ ] 최대 5개만 반환됨
- [ ] 각 achievement에 `workouts` 배열이 포함됨
- [ ] 모든 workout의 `weight_increase` 합이 `achievement`와 일치함
- [ ] 각 workout에 `previous_max_weight`, `current_max_weight` 필드가 포함됨
