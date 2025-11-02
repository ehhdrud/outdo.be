# Outdo 루틴 관리 요구사항 문서

## 📋 요구사항 개요

사용자의 요구사항을 바탕으로 루틴 관리 시스템의 핵심 동작을 정의합니다.

---

## 🎯 핵심 개념

### 루틴의 본질

- **단일 `routine_pk`로 루틴을 정의**합니다.
- 루틴 이름(`routine_name`)은 하나이며, **과거/미래 모든 날짜에서 동일**합니다.
- 날짜별 실행 기록은 별도 테이블(`routine_days`)로 관리됩니다.
- 예: "Back" 루틴(`routine_pk = 1`)을 2025-10-01/08/15에 실행
  - `routine_pk = 1` (단일 루틴)
  - `routine_days` 테이블에 3개의 레코드 (각 날짜별)
  - 이름은 모두 동일하게 "Back"

### 날짜별 루틴 관리

- **Routine**: 루틴의 정체성 (이름, 기본 구성)
- **RoutineDay**: 날짜별 실행 기록 (세트, 무게, 횟수, 메모)
- 루틴 이름 변경 시 → 과거/미래 모든 날짜에서 동일하게 반영

---

## 📱 화면별 동작 정의

### 1. Routines.tsx (루틴 목록 화면)

#### 기능

- 사용자가 만든 모든 루틴 목록을 보여줌
- 새로운 루틴을 추가할 수 있음 (`Add routine` 버튼)

#### 동작

1. **루틴 목록 조회**
   - API: `GET /routines`
   - 응답: 각 루틴(`routine_pk`)의 **가장 최근 실행 날짜 정보**를 표시
   - 예시 응답:
     ```json
     [
       {
         "routine_pk": 1,
         "routine_name": "Back",
         "last_session_date": "2025-10-15",  // 가장 최근 실행 날짜
         "workouts": [...]  // 가장 최근 날짜의 운동 정보
       }
     ]
     ```

2. **루틴 클릭 시**
   - `navigate('/routines/${routine_pk}')`
   - **무조건 오늘 날짜의 루틴을 기록/수정하는 용도**
   - 오늘 날짜의 `routine_day`가 있으면 불러와서 수정 (UPDATE)
   - 없으면 빈 폼으로 표시하여 새로 생성 (CREATE)

3. **Add routine 클릭 시**
   - `navigate('/routines/new')`
   - 새로운 루틴 작성 화면으로 이동

---

### 2. RoutineDetail.tsx (루틴 작성/수정 화면)

#### 경로 구분

- `/routines/new` → 새 루틴 작성
- `/routines/:routine_pk` → 기존 루틴 수정

#### 동작 시나리오

##### 시나리오 1: 새 루틴 작성 (`/routines/new`)

1. 사용자가 루틴을 작성하고 `Save` 클릭
2. **새로운 `routine_pk` 생성** + **오늘 날짜의 `routine_day` 생성**
3. API: `POST /routines`
   ```json
   {
     "routine_name": "Back",
     "workouts": [...]
   }
   ```
4. 백엔드 로직:
   - **같은 `routine_name`의 루틴이 이미 존재하는지 확인**
     - 존재하면 → **에러 반환** (중복 불가)
   - 같은 이름이 없으면:
     - 새로운 `Routine` 레코드 생성 (단일 `routine_pk`)
     - 오늘 날짜(`session_date = 오늘`)의 `RoutineDay` 생성
   - **다른 이름의 루틴**이라면 오늘 날짜에 이미 루틴이 있어도 새로 생성 가능

##### 시나리오 2: Routines.tsx에서 루틴 클릭 시 (`/routines/:routine_pk`)

1. Routines.tsx에서 루틴 클릭 시
2. API: `GET /routines/:routine_pk/today`
   - 해당 `routine_pk`의 **오늘 날짜(`session_date = 오늘`) 정보를 불러옴**
   - 오늘 날짜의 `routine_day`가 있으면 그 정보 반환
   - 없으면 빈 응답 또는 빈 폼 데이터 반환
3. 사용자가 수정하고 `Save` 클릭
4. API: `POST /routines/:routine_pk/days/today` 또는 `PATCH /routines/:routine_pk/days/today`
   ```json
   {
     "workouts": [...]  // session_date는 오늘 날짜로 자동 설정
   }
   ```
5. 백엔드 로직:
   - **해당 `routine_pk`의 오늘 날짜 `RoutineDay`가 있으면** → `UPDATE` (기존 기록 수정)
   - **해당 `routine_pk`의 오늘 날짜 `RoutineDay`가 없으면** → `CREATE` (새로운 오늘 날짜 기록 생성)
   - 다른 `routine_pk`의 오늘 날짜 기록은 영향을 받지 않음 (같은 날짜에 다른 이름의 루틴 여러 개 가능)
   - `routine_pk`와 `routine_name`은 변경되지 않음
   - **계속해서 오늘 날짜의 루틴을 수정할 수 있음** (매번 UPDATE)

##### 시나리오 2-2: SummaryChart.tsx에서 날짜 클릭 시 (`/routines/by-date`)

1. SummaryChart.tsx에서 특정 날짜 클릭 시
2. API: `GET /routines/by-date?date=2025-10-15`
   - 해당 날짜의 `routine_day` 조회
   - 해당 날짜의 `routine_pk`와 상세 정보 반환
   - 없으면 빈 폼 표시 (해당 날짜에 루틴이 없는 경우)
3. 사용자가 수정하고 `Save` 클릭
4. API: `POST /routines/:routine_pk/days` 또는 `PATCH /routines/:routine_pk/days/:routine_day_pk`
   ```json
   {
     "session_date": "2025-10-15",  // 특정 날짜
     "workouts": [...]
   }
   ```
5. 백엔드 로직:
   - **해당 `routine_pk`의 해당 날짜 `RoutineDay`가 있으면** → `UPDATE` (기존 기록 수정)
   - **해당 `routine_pk`의 해당 날짜 `RoutineDay`가 없으면** → `CREATE` (새로운 날짜 기록 추가)
   - 다른 `routine_pk`의 해당 날짜 기록은 영향을 받지 않음 (같은 날짜에 다른 이름의 루틴 여러 개 가능)
   - `routine_pk`와 `routine_name`은 변경되지 않음
   - **과거 날짜의 루틴 수정** (기존 수정 용도)

#### 중요한 제약사항

- ✅ **루틴 이름 중복 방지**: 같은 사용자는 같은 `routine_name`의 루틴을 중복 생성할 수 없음
- ✅ **다른 이름의 루틴**: 다른 이름이면 같은 날짜에 여러 루틴 생성 가능
- ✅ **오늘 루틴**: 새로 작성하거나 오늘 날짜의 기존 루틴 수정
- ✅ **과거 루틴**: 특정 날짜의 루틴만 수정 (다른 날짜 영향 없음)
- ❌ **오늘 루틴 작성 시**: 다른 날짜의 루틴은 수정되지 않음

---

### 3. SummaryChart.tsx (대시보드 차트)

#### 기능

- 날짜별 활동 기록을 그리드 형태로 표시
- 각 날짜의 활동 레벨(`activity`: 0, 1, 2)을 색상으로 표현
- API: `GET /dashboard/activities?startDate=...&endDate=...`

#### 동작

- 특정 날짜 클릭 시 → `/routines/by-date?date=2025-10-15`로 이동
- 해당 날짜의 루틴 조회/수정 (시나리오 2-2 참고)

---

## 🗄️ 데이터베이스 스키마

### 단일 routine_pk + 날짜별 데이터 설계

#### 1) Routine (루틴 정의: 이름만 관리)

```sql
CREATE TABLE routines (
  routine_pk INT PRIMARY KEY AUTO_INCREMENT,
  user_pk INT NOT NULL,
  routine_name VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_pk) REFERENCES users(user_pk) ON DELETE CASCADE,
  UNIQUE KEY uniq_user_name (user_pk, routine_name)  -- 같은 사용자는 같은 이름의 루틴 1개만
);
```

#### 2) RoutineDay (날짜별 실행 기록)

```sql
CREATE TABLE routine_days (
  routine_day_pk INT PRIMARY KEY AUTO_INCREMENT,
  routine_pk INT NOT NULL,
  user_pk INT NOT NULL,
  session_date DATE NOT NULL,  -- 실행 날짜 (예: 2025-10-01)
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (routine_pk) REFERENCES routines(routine_pk) ON DELETE CASCADE,
  FOREIGN KEY (user_pk) REFERENCES users(user_pk) ON DELETE CASCADE,
  UNIQUE KEY uniq_routine_date (routine_pk, session_date)  -- 한 루틴은 같은 날짜에 하나의 기록만
  -- 다른 이름의 루틴이라면 같은 날짜에 여러 루틴 기록 가능
);
```

#### 3) RoutineDayWorkout (날짜별 운동 기록)

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

#### 4) RoutineDaySet (날짜별 세트 기록)

```sql
CREATE TABLE routine_day_sets (
  routine_day_set_pk INT PRIMARY KEY AUTO_INCREMENT,
  routine_day_workout_pk INT NOT NULL,
  weight DECIMAL(5,2),
  reps INT NOT NULL,
  FOREIGN KEY (routine_day_workout_pk) REFERENCES routine_day_workouts(routine_day_workout_pk) ON DELETE CASCADE
);
```

### 중요한 제약사항

- **루틴 이름은 `routines.routine_name`에서 단일 소스로 관리**
  - 이름 변경 시 모든 날짜의 기록에서 동일하게 반영됨
- **같은 루틴 같은 날짜 중복 방지**: `(routine_pk, session_date)` 유니크
  - 한 루틴은 같은 날짜에 하나의 기록만 가질 수 있음
  - 다른 이름의 루틴이라면 같은 날짜에 여러 루틴 기록 생성 가능
- **통계 집계**: `routine_pk` 기준으로 모든 날짜의 데이터를 묶어 집계 가능

---

## 🔌 API 엔드포인트 설계

### Routines 관련

#### 1. 루틴 목록 조회 (가장 최근 날짜 정보)

```
GET /routines
```

- **응답**: 각 루틴(`routine_pk`)의 가장 최근 실행 날짜 정보
- 응답 예시:

```json
{
  "success": true,
  "data": [
    {
      "routine_pk": 1,
      "routine_name": "Back",
      "last_session_date": "2025-10-15",
      "workouts": [
        {
          "workout_name": "pull up",
          "sets_count": 4,
          "max_weight": 15
        }
      ]
    }
  ]
}
```

#### 2. 루틴 상세 조회 - 오늘 날짜 (Routines.tsx용)

```
GET /routines/:routine_pk/today
```

- 특정 `routine_pk`의 **오늘 날짜(`session_date = 오늘`) 정보 반환**
- Routines.tsx에서 루틴 클릭 시 사용
- 오늘 날짜의 `routine_day`가 있으면 그 정보 반환
- 없으면 빈 응답 또는 빈 폼 데이터 반환

#### 3. 루틴 조회 (날짜로 - SummaryChart.tsx용)

```
GET /routines/by-date?date=2025-10-15
```

- 특정 날짜의 루틴 조회
- 없으면 `404` 또는 빈 응답
- SummaryChart에서 특정 날짜 클릭 시 사용

#### 4. 루틴 생성 (새로운 routine_pk + 오늘 날짜)

```
POST /routines
```

- **요청**: `{ "routine_name": "Back", "workouts": [...] }`
- **백엔드 로직**: 동일한 `routine_name` 존재 시 에러 반환, 없으면 새 `Routine` + 오늘 날짜의 `RoutineDay` 생성
- **응답**: 생성된 루틴 정보

#### 5. 루틴 이름 수정

```
PATCH /routines/:routine_pk
```

- 루틴 이름만 수정
- 모든 날짜의 기록에서 동일하게 반영됨

#### 6. 오늘 날짜 루틴 기록 생성/수정 (Routines.tsx용)

```
POST /routines/:routine_pk/days/today
PATCH /routines/:routine_pk/days/today
```

- **요청**: `{ "workouts": [...] }` (session_date는 오늘 날짜로 자동 설정)
- **백엔드 로직**: 해당 `routine_pk`의 오늘 날짜 `RoutineDay`가 있으면 UPDATE, 없으면 CREATE

#### 7. 날짜별 루틴 기록 생성/수정 (SummaryChart.tsx용)

```
POST /routines/:routine_pk/days
PATCH /routines/:routine_pk/days/:routine_day_pk
```

- **요청**: `{ "session_date": "2025-10-15", "workouts": [...] }`
- **백엔드 로직**: 해당 `routine_pk`의 해당 날짜 `RoutineDay`가 있으면 UPDATE, 없으면 CREATE

---

### Dashboard 관련

#### 1. 날짜별 활동 기록 조회 (SummaryChart.tsx용)

```
GET /dashboard/activities?startDate=2024-01-01&endDate=2024-10-28
```

- 날짜별 활동 정보 반환 (각 날짜의 `routine_pk`, `routine_day_pk` 포함)
- 응답: `{ "success": true, "data": [{ "date": "...", "activity": 2, "routine_name": "...", ... }] }`

---

## 💻 백엔드 로직 핵심

### POST /routines (새 루틴 생성)

1. 동일한 `routine_name` 존재 확인 → 있으면 에러 반환
2. 새 `Routine` 레코드 생성 + 오늘 날짜의 `RoutineDay` 생성

### GET /routines/:routine_pk/today

- 해당 `routine_pk`의 오늘 날짜 `RoutineDay` 조회
- 없으면 빈 폼 데이터 반환 (`routine_pk`, `routine_name`은 Routine에서 가져옴)

### POST/PATCH /routines/:routine_pk/days/today

- 해당 `routine_pk`의 오늘 날짜 `RoutineDay` 조회
- 있으면 UPDATE, 없으면 CREATE

---

## ✅ 검증 체크리스트

### 핵심 검증 사항

- [ ] 같은 이름의 루틴 중복 생성 불가 (에러 반환)
- [ ] 다른 이름의 루틴은 같은 날짜에 여러 개 생성 가능
- [ ] 해당 `routine_pk`의 해당 날짜 기록이 있으면 UPDATE, 없으면 CREATE
- [ ] 같은 루틴의 같은 날짜는 하나의 기록만 (UNIQUE 제약)
- [ ] 다른 `routine_pk`의 기록은 영향을 받지 않음

---

## 📝 추가 고려사항

1. **루틴 이름 변경 시**
   - 루틴 이름은 `routines.routine_name`에서 단일 소스로 관리
   - 이름 변경 시 모든 날짜의 기록에서 동일하게 반영됨 (이미 결정된 사항)

2. **루틴 삭제 시**
   - 특정 날짜의 루틴만 삭제
   - 과거 모든 날짜의 루틴을 삭제할지 선택 가능

3. **성능 최적화**
   - 루틴 목록 조회 시 가장 최근 정보만 가져오도록 최적화
   - 날짜별 인덱스 활용
