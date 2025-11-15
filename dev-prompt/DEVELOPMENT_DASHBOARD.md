# 대시보드 API 구현 가이드

> Phase 9: 대시보드 구현을 위한 상세 가이드

---

## 📌 API 엔드포인트

### GET /dashboard/activities

날짜별 활동 기록을 조회하는 API입니다.

**쿼리 파라미터:**

- `startDate` (필수): 시작 날짜 (YYYY-MM-DD)
- `endDate` (필수): 종료 날짜 (YYYY-MM-DD)

**응답 형식:**

```typescript
interface DayActivity {
  date: string; // YYYY-MM-DD
  activity: number; // 0, 1, 2
  routine_name: string | null;
  routine_pk: number | null;
  routine_day_pk: number | null;
  achievement: number | null; // weight * reps 합산의 증가량 합계 (activity = 2의 근거)
  has_max_weight_achieved: boolean; // 최고 무게 달성 여부 (activity = 2의 근거)
  max_weight_records: MaxWeightRecord[] | null; // 최고 무게 달성 세부 정보 (has_max_weight_achieved = true일 때만)
  is_new_routine: boolean; // 새로운 루틴 생성 여부 (activity = 2의 근거)
}

interface MaxWeightRecord {
  workout_name: string; // 해당 운동 이름
  order: number; // 해당 운동의 순서
  max_weight: number; // 해당 운동의 최고 무게
}
```

### GET /dashboard/achievements

최근 5개의 achievement를 조회하는 API입니다.

**응답 형식:**

```typescript
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

**응답 예시:**

```typescript
[
  {
    date: '2025-01-15',
    routine_name: 'Leg',
    routine_pk: 1,
    routine_day_pk: 50,
    achievement: 200,
    workouts: [
      {
        workout_name: 'leg press',
        order: 0,
        weight_increase: 100,
        previous_max_weight: 3000, // [100×10, 100×10, 100×10] 합산
        current_max_weight: 3100, // [100×10, 105×10, 105×10] 합산
      },
      {
        workout_name: 'squat',
        order: 1,
        weight_increase: 100,
        previous_max_weight: 2400,
        current_max_weight: 2500,
      },
    ],
  },
  // ... 최대 5개
];
```

---

## 🎯 Activity 레벨 및 Achievement 값

### Activity 레벨

- **0**: 운동을 하지 않은 날 (`routine_day`가 없음)
- **1**: 운동을 했지만 성취가 없는 날 (`routine_day`가 있지만 다음 모두 미충족):
  - `achievement = 0` 또는 `null`
  - 최고 무게도 달성하지 않음
  - 새로운 루틴 생성이 아님
- **2**: 성취가 있는 날 (다음 중 하나 이상 충족):
  - `achievement > 0` (weight \* reps 증가)
  - 최고 무게 달성
  - **새로운 루틴 생성** (해당 날짜에 새로운 `routine_pk`가 생성됨)

### Achievement 값의 의미

- **`null`**: 다음 중 하나
  - 운동을 하지 않은 날 (`routine_day`가 없음)
  - 운동을 했지만 해당 `routine_pk`의 첫 번째 기록 (이전 기록이 없어서 비교 불가)
- **`0`**: 이전 기록이 있지만 증량이 없음 (weight \* reps 합산이 같거나 감소)
- **`> 0`**: 증량이 있음 (weight \* reps 합산이 증가)

---

## 🏆 Achievement 계산 로직

### 기본 원칙

각 날짜별 루틴의 **마지막 기록**을 토대로, 해당 `routine_pk`의 **이전 기록**과 비교합니다.

### 비교 기준

- **같은 `workout_name` && 같은 `order`**인 운동을 비교
- 각 세트의 `weight * reps` (무게 × 반복 횟수)를 계산하여 합산 비교
- 증량이 있으면 `weight_increase`를 기록하고 모든 `weight_increase`를 합산

### 계산 코드

```typescript
let achievement: number | null = null;

if (previousDay) {
  achievement = 0; // 이전 기록이 있으면 0으로 초기화

  for (const currentWorkout of currentDay.workouts) {
    const previousWorkout = previousDay.workouts.find((w) => w.workout_name === currentWorkout.workout_name && w.order === currentWorkout.order);

    if (previousWorkout) {
      const currentTotalVolume = currentWorkout.sets.reduce((sum, set) => sum + set.weight * set.reps, 0);
      const previousTotalVolume = previousWorkout.sets.reduce((sum, set) => sum + set.weight * set.reps, 0);

      if (currentTotalVolume > previousTotalVolume) {
        achievement += currentTotalVolume - previousTotalVolume;
      }
    }
  }
  // 이전 기록이 있지만 증량이 없으면 achievement는 0 유지
}
// 이전 기록이 없으면 achievement는 null 유지
```

### 최고 무게 달성 체크

**목적**: 각 workout별로 사용자의 최고 무게를 추적하여 최고 무게 달성을 감지합니다.

**추적 방법:**

- 각 `workout_name` + `order` + `user_pk` 조합별로 최고 무게를 `workout_personal_records` 테이블의 `max_weight` 필드에 저장
- **최고 무게 계산**: 각 `routine_day_workout`(workout_pk)을 저장할 때마다, 해당 workout의 모든 세트(`routine_day_set`) 중 가장 큰 `weight` 값을 계산
- 계산된 최고 무게를 기존 `max_weight`와 비교하여 최고 무게 달성 여부 판단
- 더 큰 값이면 `max_weight` 갱신

**데이터베이스 스키마:**

```sql
CREATE TABLE workout_personal_records (
  record_pk INT PRIMARY KEY AUTO_INCREMENT,
  user_pk INT NOT NULL,
  workout_name VARCHAR(100) NOT NULL,
  `order` INT NOT NULL,
  max_weight DECIMAL(5,2) NOT NULL, -- 해당 workout_name + order + user_pk 조합의 최고 무게 (각 routine_day_workout의 모든 세트 중 최대 weight 값)
  achieved_at DATE NOT NULL, -- 최고 무게를 달성한 날짜
  routine_day_pk INT, -- 최고 무게를 달성한 routine_day 참조
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_pk) REFERENCES users(user_pk) ON DELETE CASCADE,
  UNIQUE KEY uniq_user_workout_order (user_pk, workout_name, `order`)
);
```

**체크 코드:**

```typescript
let hasMaxWeightAchieved = false;
const maxWeightRecords: MaxWeightRecord[] = [];

for (const currentWorkout of currentDay.workouts) {
  // 현재 routine_day_workout의 모든 세트 중 가장 큰 weight 값 계산
  // 이 값은 해당 workout_pk 레벨에서 저장될 때마다 계산됨
  const currentMaxWeight = Math.max(...currentWorkout.sets.map((s) => s.weight));

  // 기존 최고 무게 조회 (workout_name + order + user_pk 조합의 max_weight)
  const maxWeightRecord = await getMaxWeightRecord(userId, currentWorkout.workout_name, currentWorkout.order);

  // 현재 workout의 최고 무게가 기존 max_weight보다 크면 최고 무게 달성
  if (!maxWeightRecord || currentMaxWeight > maxWeightRecord.max_weight) {
    hasMaxWeightAchieved = true;
    // max_weight 갱신
    await updateMaxWeightRecord(
      userId,
      currentWorkout.workout_name,
      currentWorkout.order,
      currentMaxWeight,
      currentDay.session_date,
      currentDay.routine_day_pk
    );

    // max_weight_records 배열에 추가
    maxWeightRecords.push({
      workout_name: currentWorkout.workout_name,
      order: currentWorkout.order,
      max_weight: currentMaxWeight,
    });
  }
}

return { hasMaxWeightAchieved, maxWeightRecords };
```

**중요**:

- `weight_increase` 계산과 최고 무게 달성 체크는 **별개**로 수행
- `achievement`는 `weight * reps` 증가분만 계산
- 최고 무게 달성은 `activity = 2` 판단에만 사용

### 예시

**weight_increase 계산 예시:**

이전 기록 (2025-01-01):

- leg press: [100kg×10, 100kg×10, 100kg×10] = 3000
- squat: [80kg×10, 80kg×10, 80kg×10] = 2400

현재 기록 (2025-01-02):

- leg press: [100kg×10, 105kg×10, 105kg×10] = 3100 (+100)
- squat: [80kg×10, 85kg×10, 85kg×10] = 2500 (+100)

결과:

- `achievement = 200`
- `has_max_weight_achieved = false`
- `max_weight_records = null`
- `is_new_routine = false`
- `activity = 2` (achievement > 0)

**최고 무게 달성 예시:**

기존 `max_weight`: leg press (workout_name + order + user_pk) = 100kg

현재 기록 (2025-01-03) - routine_day_workout 저장 시:

- leg press workout의 세트: [100kg, 100kg, 105kg]
- 해당 workout의 최고 무게 계산: `max(100, 100, 105) = 105kg`
- 기존 `max_weight`(100kg)와 비교: 105kg > 100kg
- 최고 무게 달성! `max_weight`를 105kg로 갱신
- `weight * reps` 합산: 2440 (이전 기록 3000보다 작음)
- `weight_increase`: 없음 (2440 < 3000)

결과:

- `achievement = 0`
- `has_max_weight_achieved = true`
- `max_weight_records = [{ workout_name: 'leg press', order: 1, max_weight: 105 }]`
- `is_new_routine = false`
- `activity = 2` (최고 무게 달성으로 인해)

**여러 workout에서 최고 무게 달성 예시:**

기존 `max_weight`:

- leg press (workout_name + order + user_pk) = 100kg
- squat (workout_name + order + user_pk) = 80kg

현재 기록 (2025-01-05):

- leg press workout의 세트: [100kg, 100kg, 105kg] → 최고 무게: 105kg (최고 무게 달성)
- squat workout의 세트: [80kg, 85kg, 85kg] → 최고 무게: 85kg (최고 무게 달성)

결과:

- `achievement = 0` (weight \* reps 증가 없음)
- `has_max_weight_achieved = true`
- `max_weight_records = [
  { workout_name: 'leg press', order: 1, max_weight: 105 },
  { workout_name: 'squat', order: 2, max_weight: 85 }
]`
- `is_new_routine = false`
- `activity = 2` (최고 무게 달성으로 인해)

**새로운 루틴 생성 예시:**

날짜 (2025-01-04):

- 새로운 루틴 "Chest" 생성 (routine_pk = 3)
- 해당 날짜에 첫 번째 routine_day 생성
- `achievement = null` (이전 기록 없음)
- 최고 무게: 없음 (첫 기록)
- `routine_pk.created_at` = 2025-01-04

결과:

- `achievement = null`
- `has_max_weight_achieved = false`
- `max_weight_records = null`
- `is_new_routine = true`
- `activity = 2` (새로운 루틴 생성으로 인해)

---

## 📅 여러 루틴 처리

같은 날짜에 여러 루틴(`routine_day`)이 있는 경우, 각 루틴별로 별도의 `DayActivity` 객체를 생성하고 독립적으로 achievement를 계산합니다.

---

## 🔍 구현 단계

### Step 9-1: 날짜별 활동 기록 조회 - 기본

1. `GET /dashboard/activities` 엔드포인트 생성
2. `startDate`, `endDate` 쿼리 파라미터 받기
3. 해당 기간의 모든 날짜 배열 생성 (`startDate`부터 `endDate`까지)
   - 각 날짜에 대해 `DayActivity` 객체 초기화
   - `activity = 0`, `routine_name = null`, `routine_pk = null`, `routine_day_pk = null`, `achievement = null`, `has_max_weight_achieved = false`, `max_weight_records = null`, `is_new_routine = false`
4. JWT 가드 적용

### Step 9-2: routine_days 데이터 병합

1. 해당 기간의 `routine_days` 조회
   - `user_pk`로 필터링
   - `session_date`가 `startDate`와 `endDate` 사이
   - `routine`, `workouts`, `workouts.sets` relation 포함
2. Step 9-1에서 생성한 날짜 배열에 `routine_days` 데이터 병합:
   - 각 `routine_day`에 대해 해당 날짜를 찾아서 업데이트
   - 같은 날짜에 여러 루틴이 있으면 **각각 별도의 `DayActivity` 객체로 추가**
   - `routine_name`, `routine_pk`, `routine_day_pk` 설정
   - `activity` 기본값 1로 설정, `achievement`는 null 유지
   - `has_max_weight_achieved = false`, `max_weight_records = null`, `is_new_routine = false` 초기화

### Step 9-3: Achievement 계산 및 Activity 업데이트

1. Step 9-2에서 생성한 `DayActivity` 배열에서 `routine_day_pk`가 있는 항목들에 대해:
   - 해당 `routine_day`의 `routine_pk`로 이전 가장 최근 기록 조회
   - 이전 기록 조회 시 `workouts`와 `workouts.sets` relation 포함
   - 없으면 `achievement = null` 유지

2. **weight_increase 계산** (이전 기록이 있는 경우):
   - 같은 `workout_name` && 같은 `order`인 운동 찾기
   - 각 운동의 모든 세트 `weight * reps` 합산 비교
   - 증량이 없으면 `achievement = 0`으로 설정

3. **최고 무게 달성 체크** (별도 수행):
   - 상세 로직은 "최고 무게 달성 체크" 섹션 참조
   - `has_max_weight_achieved` 및 `max_weight_records` 설정

4. **새로운 루틴 생성 체크**:
   - 해당 `routine_pk`의 `created_at`이 해당 날짜와 같거나, 첫 번째 `routine_day`가 해당 날짜인지 확인
   - 새로운 루틴이면 `is_new_routine = true` 설정

5. **activity 업데이트**:
   - `achievement > 0` 또는 `has_max_weight_achieved = true` 또는 `is_new_routine = true` 중 하나 이상이면 `activity = 2`
   - 모두 없으면 `activity = 1`

### Step 9-4: 최근 Achievement 조회 API

1. `GET /dashboard/achievements` 엔드포인트 생성
2. JWT 가드 적용
3. 현재 사용자의 모든 `routine_days` 조회 (최신순)
   - `routine`, `workouts`, `workouts.sets` relation 포함
4. 각 `routine_day`에 대해 achievement 계산:
   - 같은 `routine_pk`의 이전 가장 최근 기록 조회
   - 없으면 스킵
   - 이전 기록이 있으면 `weight * reps` 합산 비교
   - 증량이 있는 workout만 `workouts` 배열에 추가
5. `achievement > 0`인 것만 필터링하여 최대 5개 반환

---

## ⚠️ 주의사항

1. **이전 기록 조회**: 현재 날짜보다 **이전** 날짜만 조회, 같은 `routine_pk`의 가장 최근 기록만 사용

2. **Volume 비교**: 각 운동의 **모든 세트 `weight * reps` 합산**을 비교 (단순 무게가 아님)

3. **여러 루틴**: 같은 날짜에 여러 루틴이 있으면 각각 별도 계산, 각 루틴은 자신의 이전 기록과만 비교

4. **최고 무게 추적**: 상세 로직은 "최고 무게 달성 체크" 섹션 참조

5. **새로운 루틴 생성**: 해당 날짜에 새로운 `routine_pk`가 생성되면 `activity = 2` (상세 로직은 "새로운 루틴 생성 예시" 참조)

6. **날짜 범위**: `startDate`와 `endDate`는 필수 파라미터

---

## 📝 검증 체크리스트

### GET /dashboard/activities

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
- [ ] 각 `routine_day_workout`(workout_pk)의 모든 세트 중 최고 무게를 계산하여 `max_weight`와 비교
- [ ] 최고 무게가 `max_weight`보다 크면 최고 무게 달성 및 `max_weight` 갱신

### GET /dashboard/achievements

- [ ] `achievement > 0`인 기록만 반환됨
- [ ] 날짜 기준 내림차순 정렬 (최신순)
- [ ] 최대 5개만 반환됨
- [ ] 각 achievement에 `workouts` 배열이 포함됨
- [ ] 모든 workout의 `weight_increase` 합이 `achievement`와 일치함
