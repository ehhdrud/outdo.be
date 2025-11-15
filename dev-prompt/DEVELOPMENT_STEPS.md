# Outdo 백엔드 개발 단계별 가이드

> 각 단계는 독립적으로 완료하고 테스트할 수 있도록 세분화되었습니다.

---

## 📌 Phase 0: 프로젝트 기본 설정

### Step 0-1: 환경 변수 설정

- [ ] `.env` 파일 생성
- [ ] DB 연결 정보 설정 (HOST, PORT, USERNAME, PASSWORD, DATABASE)
- [ ] JWT 시크릿 키 설정
- [ ] 포트 번호 설정
- [ ] 구글 OAuth 설정 (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_CALLBACK_URL)
- **검증**: `.env` 파일이 존재하고 모든 변수가 설정됨

**구글 OAuth 설정 방법:**

1. [Google Cloud Console](https://console.cloud.google.com/)에서 프로젝트 생성
2. API 및 서비스 > 사용자 인증 정보 > OAuth 2.0 클라이언트 ID 만들기
3. 승인된 리디렉션 URI에 `http://localhost:3000/auth/google/callback` 추가
4. Client ID와 Client Secret을 `.env`에 설정

### Step 0-2: TypeORM 설정

- [ ] `app.module.ts`에 TypeORM 모듈 추가
- [ ] `.env` 변수를 사용한 DB 연결 설정
- [ ] `synchronize: true` 설정 (개발 환경)
- **검증**: `npm run start:dev` 실행 시 DB 연결 성공 메시지

### Step 0-3: 공통 응답 포맷 설정

- [ ] `src/common/interceptors/transform.interceptor.ts` 생성
- [ ] 성공 응답 포맷 구현 (`{ success: true, data: ... }`)
- [ ] 에러 응답 포맷 구현 (`{ success: false, message: ..., extras: { rs_code: ... } }`)
- [ ] `app.module.ts`에 글로벌 인터셉터 등록
- **검증**: 테스트 엔드포인트로 응답 포맷 확인

---

## 📌 Phase 1: 데이터베이스 엔티티 (인증)

### Step 1-1: User 엔티티 생성

- [ ] `src/users/entities/user.entity.ts` 생성
- [ ] 필드: `user_pk`, `email`, `password`, `name`, `bio`
- [ ] 데코레이터 추가 (`@Entity`, `@PrimaryGeneratedColumn`, etc.)
- **검증**: 서버 실행 시 `users` 테이블 자동 생성

### Step 1-2: RefreshToken 엔티티 생성

- [ ] `src/auth/entities/refresh-token.entity.ts` 생성
- [ ] 필드: `token_pk`, `user_pk`, `token`, `expires_at`, `created_at`
- [ ] User와의 관계 설정 (`@ManyToOne`)
- **검증**: 서버 실행 시 `refresh_tokens` 테이블 자동 생성

---

## 📌 Phase 2: 인증 시스템 (Auth)

### Step 2-1: JWT 모듈 설정

- [ ] `@nestjs/jwt`, `@nestjs/passport`, `passport-jwt` 설치
- [ ] `src/auth/jwt.strategy.ts` 생성
- [ ] JWT 검증 로직 구현
- **검증**: Strategy가 정상적으로 등록됨

### Step 2-2: 회원가입 API

- [ ] `POST /auth/signup` 엔드포인트 생성
- [ ] DTO: `SignupDto` (email, password, name)
- [ ] 비밀번호 해싱 (`bcrypt`)
- [ ] User 생성 로직
- **검증**: Postman으로 회원가입 테스트 → DB에 user 저장 확인

### Step 2-3: 로그인 API

- [ ] `POST /auth/signin` 엔드포인트 생성
- [ ] DTO: `SigninDto` (email, password)
- [ ] 비밀번호 검증
- [ ] Access Token 발급
- [ ] Refresh Token 발급 및 DB 저장
- **검증**: 로그인 성공 시 토큰 2개 반환

### Step 2-3-1: 구글 로그인 API

- [ ] `passport-google-oauth20` 패키지 설치
- [ ] Google OAuth Strategy 생성 (`google.strategy.ts`)
- [ ] `GET /auth/google` 엔드포인트 생성 (OAuth 시작)
- [ ] `GET /auth/google/callback` 엔드포인트 생성 (OAuth 콜백)
- [ ] 구글 사용자 정보로 기존 회원 확인 또는 신규 회원가입
- [ ] Access Token 및 Refresh Token 발급
- **검증**: 구글 로그인 성공 시 토큰 2개 반환

### Step 2-4: JWT 인증 가드

- [ ] `src/common/guards/jwt-auth.guard.ts` 생성
- [ ] `@UseGuards(JwtAuthGuard)` 테스트용 엔드포인트 생성
- **검증**: 토큰 없이 요청 시 401 에러, 토큰 있으면 성공

### Step 2-5: 토큰 갱신 API

- [ ] `POST /auth/renewalToken` 엔드포인트 생성
- [ ] Refresh Token 검증
- [ ] 새 Access Token 발급
- **검증**: Refresh Token으로 새 Access Token 발급 확인

### Step 2-6: 비밀번호 변경 API

- [ ] `POST /auth/changePassword` 엔드포인트 생성
- [ ] 인증된 사용자의 비밀번호 변경
- **검증**: 비밀번호 변경 후 새 비밀번호로 로그인 성공

---

## 📌 Phase 3: 사용자 관리 (Users)

### Step 3-1: 프로필 조회 API

- [ ] `GET /users/profile` 엔드포인트 생성
- [ ] JWT 가드 적용
- [ ] 현재 사용자 정보 반환 (password 제외)
- **검증**: 토큰으로 본인 정보 조회 성공

### Step 3-2: 프로필 수정 API

- [ ] `PATCH /users/profile` 엔드포인트 생성
- [ ] DTO: `UpdateProfileDto` (name, bio - optional)
- [ ] 현재 사용자 정보 수정
- **검증**: 프로필 수정 후 조회 시 변경된 정보 확인

---

## 📌 Phase 4: 루틴 엔티티

### Step 4-1: Routine 엔티티 생성

- [ ] `src/routines/entities/routine.entity.ts` 생성
- [ ] 필드: `routine_pk`, `user_pk`, `routine_name`, `created_at`, `updated_at`
- [ ] User와의 관계 설정
- [ ] UNIQUE 제약: `(user_pk, routine_name)`
- **검증**: 서버 실행 시 `routines` 테이블 생성

### Step 4-2: RoutineDay 엔티티 생성

- [ ] `src/routines/entities/routine-day.entity.ts` 생성
- [ ] 필드: `routine_day_pk`, `routine_pk`, `user_pk`, `session_date`, `created_at`, `updated_at`
- [ ] Routine과의 관계 설정
- [ ] UNIQUE 제약: `(routine_pk, session_date)`
- **검증**: 서버 실행 시 `routine_days` 테이블 생성

### Step 4-3: RoutineDayWorkout 엔티티 생성

- [ ] `src/routines/entities/routine-day-workout.entity.ts` 생성
- [ ] 필드: `routine_day_workout_pk`, `routine_day_pk`, `workout_name`, `order`, `notes`
- [ ] RoutineDay와의 관계 설정
- **검증**: 서버 실행 시 `routine_day_workouts` 테이블 생성

### Step 4-4: RoutineDaySet 엔티티 생성

- [ ] `src/routines/entities/routine-day-set.entity.ts` 생성
- [ ] 필드: `routine_day_set_pk`, `routine_day_workout_pk`, `weight`, `reps`
- [ ] RoutineDayWorkout과의 관계 설정
- **검증**: 서버 실행 시 `routine_day_sets` 테이블 생성

### Step 4-5: WorkoutPersonalRecord 엔티티 생성

- [ ] `src/dashboard/entities/workout-personal-record.entity.ts` 생성
- [ ] 필드: `record_pk`, `user_pk`, `workout_name`, `order`, `max_weight`, `achieved_at`, `routine_day_pk`, `created_at`, `updated_at`
- [ ] User와의 관계 설정 (`@ManyToOne`)
- [ ] UNIQUE 제약: `(user_pk, workout_name, order)`
- [ ] **참고**: 이 엔티티는 Dashboard 모듈에 있지만, Routines 모듈에서도 import하여 사용 (Phase 5-7 참조)
- **검증**: 서버 실행 시 `workout_personal_records` 테이블 생성

---

## 📌 Phase 5: 루틴 생성

### Step 5-1: 루틴 생성 DTO

- [ ] `CreateRoutineDto` 생성
- [ ] 중첩 DTO: `CreateWorkoutDto`, `CreateSetDto`
- [ ] Validation 데코레이터 추가
- **검증**: DTO 타입 정의 완료

### Step 5-2: 루틴 생성 API - 기본 구조

- [ ] `POST /routines` 엔드포인트 생성
- [ ] JWT 가드 적용
- [ ] 서비스 메서드 스켈레톤 생성
- **검증**: 엔드포인트 호출 가능 (빈 응답이어도 OK)

### Step 5-3: 루틴 이름 중복 체크

- [ ] 같은 user_pk + routine_name 존재 확인
- [ ] 중복 시 `ConflictException` 반환
- **검증**: 같은 이름으로 2번 생성 시 에러

### Step 5-4: Routine 레코드 생성

- [ ] Routine 테이블에 INSERT
- [ ] user_pk, routine_name 저장
- **검증**: DB에 routine 저장 확인

### Step 5-5: RoutineDay 레코드 생성

- [ ] 오늘 날짜 계산
- [ ] RoutineDay 테이블에 INSERT
- [ ] routine_pk, user_pk, session_date 저장
- **검증**: DB에 routine_day 저장 확인

### Step 5-6: Workout & Set 저장

- [ ] DTO의 workouts 배열 순회
- [ ] 각 workout 저장
- [ ] 각 workout의 sets 저장
- **검증**: 전체 루틴 생성 후 DB에서 모든 데이터 확인

### Step 5-7: 최고 무게 체크 및 업데이트

- [ ] Routines 모듈에 `WorkoutPersonalRecord` 엔티티를 TypeORM에 등록
- [ ] Routines 서비스에 `WorkoutPersonalRecord` 리포지토리 주입 (TypeORM Repository)
- [ ] `checkAndUpdateMaxWeight` 헬퍼 메서드 구현:
  - 파라미터: `user_pk`, `workout_name`, `order`, `currentMaxWeight`, `session_date`, `routine_day_pk`
  - `workout_personal_records` 테이블에서 기존 레코드 조회 (workout_name + order + user_pk 조합)
  - 현재 최고 무게가 기존 `max_weight`보다 크면 `max_weight` 갱신
  - 없으면 새 레코드 생성
- [ ] Step 5-6의 각 workout 저장 후 `checkAndUpdateMaxWeight` 호출
- [ ] 각 workout의 모든 세트 중 최대 `weight` 값 계산하여 전달
- **검증**: 최고 무게 달성 시 `workout_personal_records` 테이블에 저장 확인

---

## 📌 Phase 6: 루틴 조회

### Step 6-1: 루틴 목록 조회 API - 기본

- [ ] `GET /routines` 엔드포인트 생성
- [ ] 현재 사용자의 모든 루틴 조회
- [ ] routine_pk, routine_name만 반환
- **검증**: 본인의 루틴 목록만 조회됨

### Step 6-2: 가장 최근 날짜 정보 추가

- [ ] 각 루틴별 가장 최근 routine_day 조회
- [ ] last_session_date 추가
- [ ] 최근 날짜의 workouts 정보 추가
- **검증**: 응답에 최근 정보 포함 확인

### Step 6-3: 오늘 날짜 루틴 조회 API

- [ ] `GET /routines/:routine_pk/today` 엔드포인트 생성
- [ ] 해당 routine_pk의 오늘 날짜 routine_day 조회
- [ ] relations: workouts, sets 포함
- [ ] 없으면 빈 폼 데이터 반환
- **검증**: 오늘 날짜 있으면 데이터, 없으면 빈 폼

### Step 6-4: 날짜별 루틴 조회 API

- [ ] `GET /routines/by-date?date=YYYY-MM-DD` 엔드포인트 생성
- [ ] 특정 날짜의 routine_day 조회
- [ ] relations: workouts, sets 포함
- **검증**: 특정 날짜의 루틴 조회 성공

---

## 📌 Phase 7: 루틴 수정

### Step 7-1: 오늘 날짜 루틴 저장 - 구조

- [ ] `POST /routines/:routine_pk/days/today` 엔드포인트 생성
- [ ] DTO: `SaveRoutineDayDto`
- [ ] 서비스 메서드 스켈레톤
- **검증**: 엔드포인트 호출 가능

### Step 7-2: 오늘 날짜 RoutineDay 존재 확인

- [ ] 해당 routine_pk + 오늘 날짜 조회
- [ ] 있으면 UPDATE 경로, 없으면 CREATE 경로
- **검증**: 로그로 분기 확인

### Step 7-3: UPDATE 로직 구현

- [ ] 기존 workouts 삭제
- [ ] 새 workouts & sets 저장
- [ ] 각 workout 저장 후 `checkAndUpdateMaxWeight` 메서드 호출 (Step 5-7에서 구현한 메서드 재사용)
- **검증**: 수정 후 조회 시 변경된 데이터 확인

### Step 7-4: CREATE 로직 구현

- [ ] 새 RoutineDay 생성
- [ ] workouts & sets 저장
- [ ] 각 workout 저장 후 `checkAndUpdateMaxWeight` 메서드 호출 (Step 5-7에서 구현한 메서드 재사용)
- **검증**: 생성 후 조회 시 데이터 확인

### Step 7-5: 날짜별 루틴 저장 API

- [ ] `POST /routines/:routine_pk/days` 엔드포인트 생성
- [ ] DTO에 session_date 포함
- [ ] 오늘 날짜 저장과 동일한 로직 (Step 7-2, 7-3, 7-4와 동일)
- [ ] 각 workout 저장 후 최고 무게 체크 및 업데이트 포함
- **검증**: 과거/미래 날짜에 루틴 저장 가능

---

## 📌 Phase 8: 루틴 이름 수정 & 삭제

### Step 8-1: 루틴 이름 수정 API

- [ ] `PATCH /routines/:routine_pk` 엔드포인트 생성
- [ ] routine_name만 수정
- [ ] 중복 체크
- **검증**: 이름 변경 후 모든 날짜에서 변경된 이름 확인

### Step 8-2: 루틴 삭제 API (선택)

- [ ] `DELETE /routines/:routine_pk` 엔드포인트 생성
- [ ] CASCADE로 모든 관련 데이터 삭제
- **검증**: 루틴 삭제 후 관련 데이터 모두 삭제 확인

---

## 📌 Phase 9: 대시보드

### Step 9-1: 날짜별 활동 기록 조회 - 기본

- [ ] `GET /dashboard/activities` 엔드포인트 생성
- [ ] `startDate`, `endDate` 쿼리 파라미터 받기
- [ ] 해당 기간의 모든 날짜 배열 생성 (`startDate`부터 `endDate`까지)
- [ ] 각 날짜에 대해 `DayActivity` 객체 초기화
  - `activity = 0`, `routine_name = null`, `routine_pk = null`, `routine_day_pk = null`
  - `achievement = null`, `has_max_weight_achieved = false`, `max_weight_records = null`, `is_new_routine = false`
- [ ] JWT 가드 적용
- **검증**: 빈 날짜 배열이라도 반환

### Step 9-2: routine_days 데이터 병합

- [ ] 해당 기간의 `routine_days` 조회
  - `user_pk`로 필터링
  - `session_date`가 `startDate`와 `endDate` 사이
  - `routine`, `workouts`, `workouts.sets` relation 포함
- [ ] Step 9-1에서 생성한 날짜 배열에 `routine_days` 데이터 병합
  - 각 `routine_day`에 대해 해당 날짜를 찾아서 업데이트
  - 같은 날짜에 여러 루틴이 있으면 **각각 별도의 `DayActivity` 객체로 추가**
  - `routine_name`, `routine_pk`, `routine_day_pk` 설정
  - `activity` 기본값 1로 설정, `achievement`는 null 유지
  - `has_max_weight_achieved = false`, `max_weight_records = null`, `is_new_routine = false` 초기화
- **검증**: 루틴이 있는 날짜에 정보 표시

### Step 9-3: Achievement 계산 및 Activity 업데이트

- [ ] Step 9-2에서 생성한 `DayActivity` 배열에서 `routine_day_pk`가 있는 항목들에 대해:
  - 해당 `routine_day`의 `routine_pk`로 이전 가장 최근 기록 조회
  - **이전 기록 조회 시 현재 날짜보다 이전 날짜만 조회, 같은 `routine_pk`의 가장 최근 기록만 사용**
  - 이전 기록 조회 시 `workouts`와 `workouts.sets` relation 포함
  - 없으면 `achievement = null` 유지
- [ ] **weight_increase 계산** (이전 기록이 있는 경우):
  - 같은 `workout_name` && 같은 `order`인 운동 찾기
  - 각 운동의 모든 세트 `weight * reps` 합산 비교 (단순 무게가 아님)
  - 증량이 없으면 `achievement = 0`으로 설정
  - 증량이 있으면 `achievement`에 합산
- [ ] **최고 무게 달성 체크** (별도 수행, weight_increase 계산과 독립):
  - 각 `routine_day_workout`의 모든 세트 중 최대 `weight` 값 계산
  - `workout_personal_records` 테이블에서 해당 날짜에 달성한 최고 무게 기록 조회
  - 또는 `workout_personal_records` 테이블의 `routine_day_pk`가 현재 `routine_day_pk`와 일치하는지 확인
  - 해당 날짜에 최고 무게를 달성했으면 `has_max_weight_achieved = true` 및 `max_weight_records` 설정
  - 여러 workout에서 최고 무게를 달성했으면 모두 `max_weight_records` 배열에 추가
  - **참고**: 최고 무게 업데이트는 이미 Phase 5-7에서 루틴 저장 시 수행됨
- [ ] **새로운 루틴 생성 체크**:
  - 해당 `routine_pk`의 `created_at`이 해당 날짜와 같거나, 첫 번째 `routine_day`가 해당 날짜인지 확인
  - 새로운 루틴이면 `is_new_routine = true` 설정
- [ ] **activity 업데이트**:
  - `achievement > 0` 또는 `has_max_weight_achieved = true` 또는 `is_new_routine = true` 중 하나 이상이면 `activity = 2`
  - 모두 없으면 `activity = 1`
- [ ] **여러 루틴 처리**: 같은 날짜에 여러 루틴이 있으면 각각 별도 계산, 각 루틴은 자신의 이전 기록과만 비교
- **검증**: activity 값이 올바르게 계산됨

### Step 9-4: 최근 Achievement 조회 API

- [ ] `GET /dashboard/achievements` 엔드포인트 생성
- [ ] JWT 가드 적용
- [ ] 현재 사용자의 모든 `routine_days` 조회 (최신순)
  - `routine`, `workouts`, `workouts.sets` relation 포함
- [ ] 각 `routine_day`에 대해 achievement 계산:
  - 같은 `routine_pk`의 이전 가장 최근 기록 조회
  - 없으면 스킵
  - 이전 기록이 있으면 `weight * reps` 합산 비교
  - 증량이 있는 workout만 `workouts` 배열에 추가
  - 각 workout에 `weight_increase`, `previous_max_weight`, `current_max_weight` 포함
- [ ] `achievement > 0`인 것만 필터링하여 최대 5개 반환
- **검증**: 최근 5개 achievement 반환 확인

---

## 📌 Phase 10: 테스트 & 최적화

### Step 10-1: N+1 쿼리 최적화

- [ ] 루틴 목록 조회 시 relations 한 번에 로딩
- [ ] 쿼리 로그 확인
- **검증**: 쿼리 수 감소 확인

### Step 10-2: 인덱스 확인

- [ ] UNIQUE 제약 확인
- [ ] Foreign Key 인덱스 확인
- [ ] `session_date`, `order` 필드 인덱스 확인
- **검증**: EXPLAIN으로 쿼리 성능 확인

### Step 10-3: 에러 처리

- [ ] 모든 엔드포인트 에러 케이스 처리
- [ ] 적절한 HTTP 상태 코드 반환
- [ ] 에러 메시지 명확화
- **검증**: 각 에러 케이스 테스트

---

## 🎯 권장 진행 순서

1. **Phase 0-1, 0-2**: 환경 설정 (가장 먼저)
2. **Phase 0-3**: 공통 응답 포맷 (전체에 영향)
3. **Phase 1**: User/RefreshToken 엔티티
4. **Phase 2**: 인증 시스템 (회원가입 → 로그인 → 가드 → 갱신)
5. **Phase 3**: 사용자 관리
6. **Phase 4**: 루틴 엔티티 (한 번에 4개)
7. **Phase 5**: 루틴 생성 (step by step)
8. **Phase 6**: 루틴 조회 (목록 → 오늘 → 날짜별)
9. **Phase 7**: 루틴 수정 (오늘 → 날짜별)
10. **Phase 8**: 이름 수정, 삭제
11. **Phase 9**: 대시보드
12. **Phase 10**: 최적화

---

## 💡 각 Step 완료 시 체크사항

- [ ] 코드 작성
- [ ] Postman 테스트
- [ ] DB 데이터 확인
- [ ] 에러 케이스 테스트
- [ ] 다음 step으로 진행

---

## 📝 작업 방식

1. **하나의 Step만 요청**: "Step 2-3 구현해줘"
2. **검증 후 다음**: 해당 step 테스트 완료 후 다음 step 요청
3. **에러 발생 시**: 즉시 알려주면 같이 해결
4. **중간 저장**: 각 Phase 완료 시 git commit 권장

이렇게 작은 단위로 진행하면 정확도가 높아지고, 문제 발생 시 빠르게 해결할 수 있습니다!
