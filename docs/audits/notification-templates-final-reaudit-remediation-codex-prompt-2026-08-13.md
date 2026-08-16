# HANDS Notification Templates 최종 재감사 보완 구현 프롬프트

아래 전체 내용을 새 Codex 작업에 그대로 전달한다. 이 작업은 추가 보고서 작성이 아니라, 2026-08-13 최종 재감사에서 확인된 문제를 실제 코드·테스트·화면에서 수정하고 출시 승인 조건까지 검증하는 구현 작업이다.

---

## 1. 역할과 최종 목표

너는 HANDS 관리자 알림 문구와 런타임 발송 계약을 출시 가능한 상태로 마무리하는 시니어 풀스택 엔지니어다.

대상 화면:

```text
http://localhost:3101/notifications/templates
```

저장소:

```text
C:\dev\massage-on-demand-vn
```

이 화면의 주 사용자는 프로그래머가 아니라 혼자 운영 업무를 처리하는 관리자다. 운영자는 다음 내용을 신뢰할 수 있어야 한다.

1. `Ready`인 언어는 실제 번역·검토된 문구다.
2. 화면에서 허용하는 변수는 API 저장과 실제 발송에서도 허용된다.
3. 저장 중 다른 템플릿의 문구가 현재 편집기에 섞이지 않는다.
4. 필터 결과, 현재 선택, 변경 상태, 저장 결과가 서로 모순되지 않는다.
5. `Opens` 정보는 실제 고객·파트너 앱 동작을 과장하거나 잘못 설명하지 않는다.
6. 선택·비선택 상태와 오류·성공 상태를 색각이나 추측에 의존하지 않고 구분할 수 있다.
7. 베트남어처럼 특정 언어의 미완료 문구를 연속으로 처리할 수 있다.

현재 재감사 점수는 **62/100**, 판정은 **쓰기 기능 출시 보류**다. UI를 보기 좋게 다듬는 것만으로 완료하지 말라. 아래 P0 세 건이 코드와 자동 테스트에서 해결되지 않으면 완료가 아니다.

## 2. 반드시 먼저 읽을 자료

다음 파일을 끝까지 읽고 작업한다.

```text
C:\dev\massage-on-demand-vn\AGENTS.md
C:\dev\massage-on-demand-vn\docs\audits\notifications-templates-final-reaudit-2026-08-13.md
C:\dev\massage-on-demand-vn\docs\audits\notification-templates-remediation-implementation-2026-08-12.md
C:\dev\massage-on-demand-vn\docs\audits\notifications-templates-final-reaudit-evidence-2026-08-13\09-browser-metrics.json
C:\dev\massage-on-demand-vn\docs\audits\notifications-templates-final-reaudit-evidence-2026-08-13\10-database-readonly-and-contract.json
C:\dev\massage-on-demand-vn\docs\audits\notifications-templates-final-reaudit-evidence-2026-08-13\11-runtime-freshness.json
```

화면 증거도 직접 확인한다.

```text
01-default-1440x1000.png
02-vietnamese-source-copied-1440x1000.png
03-source-copy-can-be-marked-ready-1440x1000.png
04-ready-filter-empty-but-editor-visible-1440x1000.png
05-ui-allows-server-rejected-variable-1440x1000.png
06-default-1600x1000.png
07-default-dark-1440x1000.png
```

보고서의 해결안은 요구사항이지만 현재 코드가 작업 중 변경됐을 수 있다. 먼저 최신 소스와 실행 화면에서 재현 여부를 확인하고, 이미 해결된 항목을 다시 구현하지 않는다.

## 3. 작업 원칙과 안전 경계

- `git status --short`로 시작 상태를 기록한다.
- dirty worktree의 기존 변경은 사용자 작업이다. 관련 없는 파일을 revert, reset, cleanup, 일괄 format하지 않는다.
- 단일 에이전트로 작업한다. subagent나 별도 작업 thread를 만들지 않는다.
- 계획만 작성하고 멈추지 말고 P0부터 구현·검증까지 진행한다.
- 가장 좁은 공통 원인을 수정한다. 화면과 API에 같은 규칙을 복제하지 않는다.
- 기존 NestJS, Prisma, Next.js, 관리자 공통 form/button/status 컴포넌트와 테스트 도구를 재사용한다.
- 새 상태 관리 라이브러리, 디자인 시스템, 번역 SaaS, workflow engine을 추가하지 않는다.
- 새로운 추상화나 테이블은 기존 구조로 해결할 수 없을 때만 추가한다.
- schema/migration, bookings, notification runtime contract는 보호 영역이다. 변경 시 `AGENTS.md`의 강화 검증을 수행한다.
- 실제 고객·파트너에게 push/in-app 알림을 발송하지 않는다.
- 브라우저 검증에서 실제 운영 문구를 저장하지 않는다. mutation은 테스트 fixture나 명시적인 로컬 격리 데이터에서만 검증한다.
- destructive migration, 번역 행 삭제, 운영 DB 일괄 변경을 하지 않는다.
- 서버 재시작 전 해당 포트의 PID와 command line을 확인한다. 모든 `node.exe`를 일괄 종료하지 않는다.
- 사용자 요청 없이 commit하지 않는다.
- 1024px 이하 화면은 구현·검수·보고서에서 완전히 제외한다.
- 화면 기준은 `1440×1000`, `1600×1000`, 라이트·다크 테마다.

운영형 관리자 화면이므로 장식보다 정확성, 스캔 가능성, 상태 구분, 오류 복구, 키보드 접근성을 우선한다.

## 4. 우선 확인할 코드

```text
apps/admin_web/app/notifications/templates/page.tsx
apps/admin_web/app/notifications/templates/notification-template-editor.tsx
apps/admin_web/app/notifications/templates/actions.ts
apps/admin_web/app/notifications/templates/notification-template-browser-fixtures.ts
apps/admin_web/app/notifications/templates/page.spec.tsx
apps/admin_web/app/notifications/templates/actions.spec.ts
apps/admin_web/components/admin-form-controls.tsx
apps/admin_web/lib/admin-api.ts
apps/admin_web/app/globals.css

apps/api/src/admin/admin.dto.ts
apps/api/src/admin/admin.controller.ts
apps/api/src/admin/admin.service.ts
apps/api/src/admin/admin.service.spec.ts
apps/api/src/notifications/notification-template-catalog.ts
apps/api/src/notifications/notification-template-catalog.spec.ts
apps/api/src/notifications/notifications.service.ts
apps/api/src/notifications/notifications.service.spec.ts
apps/api/src/notifications/notification-push-payload.ts
apps/api/src/bookings/bookings.notifications.ts
apps/api/src/bookings/bookings.notifications.spec.ts

apps/customer_app/lib/src/features/notification/domain/entities/push_notification_open_intent.dart
apps/provider_app/lib/src/features/notification/domain/entities/push_notification_open_intent.dart

apps/api/prisma/schema.prisma
apps/api/prisma/migrations/20260813181500_add_notification_translation_readiness/
```

수정 전에 다음 흐름을 끝까지 추적한다.

```text
DB template metadata
→ GET /admin/notifications/templates
→ AdminNotificationTemplate type
→ editor variable chips / validation
→ server action
→ PATCH DTO normalization
→ API placeholder validation
→ transaction / readiness transition / audit log
→ runtime template resolution and mobile open intent
```

## 5. 보존해야 할 현재 개선사항

다음 기능은 회귀시키지 않는다.

- 24개 정식 이벤트 카탈로그와 고객/파트너 라우팅 분리
- 5개 언어 탭과 여러 언어의 원자적 저장
- `SOURCE_COPIED`, `NEEDS_REVIEW`, `READY` 상태 모델
- 요청 언어 READY → 영어 READY → 코드 fallback 순서
- 미해결 placeholder의 runtime fallback/차단
- GET 조회의 무쓰기 계약
- `updatedAt` 기반 낙관적 동시성
- 저장 사유와 before/after 감사 로그
- conflict, session expired, source unavailable, server error 상태 분리
- 저장하지 않은 변경의 이탈 경고
- 언어 탭의 ArrowLeft/Right, Home/End 키보드 이동
- 1440/1600에서 페이지 수준 가로 overflow가 없는 구조
- `Managed copy off`에서도 알림은 코드 fallback으로 계속 발송된다는 의미

## 6. 구현 순서

아래 순서를 지킨다.

```text
P0-1 변수 계약 단일화
→ P0-2 readiness 승격 보호
→ P0-3 저장 중 템플릿 혼선 차단
→ clean build와 실행 서버 최신성 확인
→ P1 운영 UI·문구·접근성
→ 테스트·1440/1600 브라우저 재검증
```

## 7. P0-1 — UI와 API의 변수 계약을 단일화

### 현재 문제

- 목록 API는 DB row의 `variables`를 그대로 노출한다.
- `requiredVariables`와 저장 검증은 `DEFAULT_NOTIFICATION_TEMPLATES`를 사용한다.
- 실제 `booking.cancelled`는 DB에서 `bookingId`를 허용하지만 정식 API 카탈로그에서는 허용하지 않는다.
- UI에서는 `{bookingId}`를 정상 삽입하고 저장 버튼까지 활성화하지만 API는 저장을 거절할 수 있다.
- 현재 `Routing errors 0`은 key 누락과 예상 밖 key만 확인하고 metadata drift는 놓친다.

### 필수 구현

1. `variables`, `requiredVariables`, audience, channel, runtimeRoutes의 권위 있는 단일 공급원을 정한다.
2. 권장 최소 구현은 기존 `DEFAULT_NOTIFICATION_TEMPLATES`와 route map을 정식 계약으로 유지하고, 목록 응답도 이 값을 사용하도록 만드는 것이다.
3. 목록 응답에서 DB의 오래된 `variables`를 그대로 노출하지 않는다.
4. DB metadata가 계속 필요하면 안전한 migration/backfill로 정식 계약과 일치시키되, 행 삭제나 destructive migration은 금지한다.
5. health에 최소한 다음 drift를 포함한다.

```text
missing key
unexpected key
audience mismatch
channel mismatch
variables mismatch
requiredVariables mismatch
runtime route mismatch
```

6. 상단 `Routing errors`를 실제 의미에 맞게 `Contract issues`로 변경한다.
7. contract issue가 있으면 관련 템플릿 저장을 차단하고 운영자가 이해할 수 있는 원인을 표시한다.

### 테스트

- 목록 API의 `variables`와 PATCH validator가 동일한 집합을 사용한다.
- UI에 표시되는 모든 변수 칩은 API 저장 검증을 통과한다.
- API에서 거절하는 변수는 UI에 표시되지 않는다.
- DB metadata drift fixture에서 health가 0이 아닌 문제를 반환한다.
- `booking.cancelled`의 기존 불일치 회귀 테스트를 추가한다.

### 합격 기준

- `{bookingId}`를 허용할지 금지할지는 하나의 정의에서 결정된다.
- 화면과 API의 판단이 절대 다르지 않다.
- `Contract issues 0`은 모든 metadata 계약이 일치할 때만 표시된다.

## 8. P0-2 — 번역하지 않은 `SOURCE_COPIED`의 READY 승격 차단

### 현재 문제

- 비영어 문구를 수정하지 않고 `Reviewed and ready`만 체크해도 변경으로 처리된다.
- 서버는 `reviewedAndReady=true`이면 원문 비교 없이 READY로 저장한다.
- 현재 비영어 96개가 영어 문구와 동일하다.
- 변경 요약은 제목·본문만 보여 주어 `SOURCE_COPIED → READY` 전환을 숨긴다.

### 서버 필수 구현

1. 서버를 최종 권한으로 둔다. 클라이언트 차단만으로 끝내지 않는다.
2. 동일 transaction 안에서 기존 비영어 translation, 영어 source translation, 요청 문구를 비교한다.
3. trim, CRLF 등 저장소의 기존 정규화 규칙을 사용해 제목·본문을 비교한다. 임의로 문장부호나 대소문자를 삭제하는 과도한 정규화는 하지 않는다.
4. 기존 상태가 `SOURCE_COPIED`이고 요청 문구가 영어 source와 동일한데 READY를 요청하면 기본적으로 거절한다.
5. 브랜드명처럼 번역 결과가 의도적으로 동일한 예외가 필요하면 다음을 모두 요구한다.

```text
confirmIdenticalTranslation = true
명시적인 별도 확인 UI
기존 change reason
audit metadata의 identical-copy override 표시
검토자와 검토 시각
```

6. 단순 checkbox 오조작으로 예외 승인이 되지 않도록 일반 readiness 체크와 identical-copy override를 분리한다.
7. 영어 문구가 변경되면 기존 비영어 READY 문구를 `NEEDS_REVIEW`로 낮추는 현재 동작을 보존한다.

### UI 필수 구현

- `SOURCE_COPIED` 문구가 영어와 동일하면 일반 `Reviewed and ready` 체크를 비활성화하거나 체크 직후 구체적인 차단 오류를 표시한다.
- 보이는 레이블은 `Reviewed and ready`로 두고, `Use this language at runtime after this save`는 helper 설명으로 분리한다.
- 변경 요약에 다음 내용을 별도 행으로 표시한다.

```text
Copy: unchanged / changed
Readiness: Source copied → Ready
Managed copy: On → Off 또는 Off → On
```

- Before/After 문구가 같더라도 readiness 전환은 숨기지 않는다.

### 테스트

- 미수정 영어 복사본 + readiness 체크는 클라이언트에서 저장 불가.
- 같은 요청을 API에 직접 보내도 거절.
- 실제 번역 문구는 READY 저장 가능.
- identical-copy 예외는 별도 확인이 없으면 거절되고, 확인·사유가 있으면 audit metadata와 함께 저장.
- 영어 변경 시 기존 비영어 READY가 NEEDS_REVIEW로 전환.
- 변경 요약이 readiness transition을 렌더링.

### 합격 기준

- 체크 한 번으로 영어 복사본이 베트남어 READY가 될 수 없다.
- 예외 승인도 감사 로그에서 일반 번역 승인과 구별된다.

## 9. P0-3 — 저장 중 다른 템플릿 상태가 섞이는 경쟁 조건 제거

### 현재 문제

저장 성공 응답이 돌아오면 현재 선택 template key를 확인하지 않고 응답의 draft와 enabled를 편집기에 적용한다. 저장 중 카탈로그 이동도 가능해 다음 오류가 발생할 수 있다.

```text
A 저장 시작
→ B 선택
→ A 응답 도착
→ 선택 표시는 B지만 draft는 A
→ B에 A 문구를 저장할 위험
```

### 필수 구현

1. pending 동안 템플릿 카탈로그 선택, 언어 탭, history/popstate 이동의 동작을 안전하게 처리한다.
2. 가장 단순하고 안전한 방식은 저장이 끝날 때까지 template switching을 잠그고 `Saving…` 상태를 명확히 표시하는 것이다.
3. 잠금 여부와 관계없이 저장 응답 적용 전에 응답의 template key와 현재 선택 key를 다시 확인한다.
4. 현재 선택과 다른 저장 응답은 templates collection만 갱신하고 현재 editor draft/enabled/reason은 덮지 않는다.
5. pending 중 페이지 이탈·뒤로가기에서 초안과 저장 결과가 불명확해지지 않도록 기존 navigation guard를 보완한다.
6. 실패·충돌 응답도 해당 template key에만 연결한다.

### 테스트

- deferred action을 사용해 A 저장 응답을 지연한다.
- 저장 중 B 클릭 또는 history 이동을 시도한다.
- A 응답이 늦게 도착해도 B의 draft가 A로 바뀌지 않는다.
- A 성공 결과는 templates collection의 A에만 반영된다.
- B의 dirty, reason, enabled 상태가 보존된다.
- pending 동안 중복 제출이 발생하지 않는다.

### 합격 기준

- 네트워크 응답 순서가 바뀌어도 다른 템플릿에 문구가 섞일 수 없다.

## 10. 실행 빌드 최신성 확보

감사 당시 실행 API 프로세스가 현재 source와 dist보다 오래됐다. 현재 소스를 수정한 뒤 다음을 수행한다.

1. admin 3101과 API 3000 포트의 PID·시작 시각·command line을 기록한다.
2. 관련 테스트와 typecheck가 통과한 후 clean build를 수행한다.
3. 저장소의 안전한 로컬 start/stop 스크립트를 사용하거나 정확한 프로세스만 재시작한다.
4. 실행 admin/API가 같은 작업 결과와 같은 build 기준을 사용하는지 확인한다.
5. 브라우저 화면과 현재 source가 다른 경우 source만 고치고 완료하지 않는다.

## 11. P1 — 운영 UI와 접근성 개선

### 11.1 버튼 CSS와 선택 상태

- `AdminFormControlButton`의 기본 primary class를 전체 프로젝트에서 성급하게 변경하지 않는다.
- 이 화면의 카탈로그 행, 언어 탭, 변수 칩, 미리보기 탭, 아이콘 버튼에 기존 secondary/neutral/ghost 패턴 중 적합한 variant를 명시한다.
- 선택 행은 옅은 accent 배경, 읽기 쉬운 진한 텍스트, border 또는 indicator를 함께 사용한다.
- 미선택 행은 중립 배경으로 표시한다.
- hover, focus-visible, selected, disabled 상태를 색상 하나만으로 구분하지 않는다.
- 라이트·다크 모두 일반 텍스트 4.5:1, 큰 텍스트·UI 경계 3:1 기준을 만족시킨다.
- CSS 문자열 검사만 하지 말고 실제 렌더링의 class/computed style 또는 시각 회귀 검사를 추가한다.

### 11.2 초기 빈 `Not saved` 제거

- clean build에서 최초 진입을 다시 확인한다.
- 초기 상태에서는 오류 status DOM 자체가 없어야 한다.
- 빈 message를 가진 `Not saved`를 렌더링하지 않는다.
- `No unsaved changes`와 오류 배너가 동시에 나타나지 않도록 테스트한다.
- 저장 실패, conflict, session expired, source unavailable 상태는 계속 구분한다.

### 11.3 필터 결과와 편집기 일치

권장 동작을 구현한다.

- 선택된 템플릿이 필터 결과에서 제외되면 편집기를 빈 결과 상태로 전환한다.
- `No templates match these filters`와 `Reset filters` 버튼을 표시한다.
- 결과 수를 `0 of 24`, `8 of 24`처럼 보여 준다.
- dirty 상태에서 필터 변경으로 편집기가 사라질 경우 기존 초안 폐기 확인을 거친다.
- 필터 밖의 템플릿을 아무 안내 없이 계속 편집하게 두지 않는다.

### 11.4 실제 `Opens` 계약

- `notificationDestination(key)`처럼 관리자 웹에서 key prefix만으로 목적지를 추정하지 않는다.
- 먼저 고객·파트너 앱의 `PushNotificationOpenIntent`와 API payload 계약을 확인한다.
- 기존 중앙 계약이 있으면 재사용한다.
- 목적지가 payload에 따라 달라지면 단일 목적지를 거짓으로 표시하지 말고 다음처럼 표현한다.

```text
Varies by payload · Chat or booking details
Earnings
Partner jobs
No deep link
```

- API가 `possibleDestinations`와 필요한 payload key를 제공하게 하거나, 기존 정식 notification catalog에 최소 metadata를 둔다.
- 같은 정보를 관리자 웹에 별도로 중복 하드코딩하지 않는다.
- 고객·파트너 open-intent의 대표 이벤트와 관리자 표시가 일치하는 계약 테스트를 추가한다.

### 11.5 베트남어 중심 번역 작업 큐

현재 96은 이벤트가 아니라 언어 버전 수다. 다음을 최소 범위로 구현한다.

- 언어 필터: All / Vietnamese / Korean / Japanese / Chinese.
- 상태 필터: Source copied / Needs review / Ready.
- 상단 문구: `96 language versions need translation`.
- 언어별 수치: `VI 24 · KO 24 · JA 24 · ZH 24`.
- 언어 필터를 선택하면 카탈로그 뱃지는 전체 `1/5`뿐 아니라 선택 언어의 상태도 보여 준다.
- `Save & next`는 현재 언어·상태 필터에서 다음 미완료 항목으로 이동한다.
- 저장 실패나 conflict가 있으면 다음 항목으로 이동하지 않는다.
- 데이터가 24개인 현재 규모에서 새로운 virtual list나 복잡한 queue framework는 만들지 않는다.

### 11.6 Managed copy 토글 위치와 문구

- 템플릿 전역 설정을 언어 패널 안에 두지 않는다.
- 템플릿 header 또는 `Delivery behavior` 영역으로 이동한다.
- visible label: `Use managed copy`.
- helper: `When off, notifications still send using the code fallback copy.`
- 변경 요약과 저장 하단에 on/off 전환을 명확히 표시한다.

### 11.7 화면 밀도와 스크롤

- 페이지 제목과 readiness strip을 압축해 1440×1000 첫 화면에 언어 탭과 제목 입력이 보이게 한다.
- 카탈로그 내부 스크롤과 페이지 스크롤의 책임을 명확히 한다.
- 권장: viewport 높이에 맞춘 sticky catalog와 editor의 자연스러운 page scroll.
- 1600px에서 불필요하게 넓은 빈 공간을 만들지 않는다.
- 기존 관리자 디자인 토큰, spacing, radius, typography를 유지한다.

## 12. UX 문구 기준

운영자가 기술 지식 없이 이해할 수 있는 문구를 사용한다.

권장 예:

```text
Contract issues
Language versions needing translation
Reviewed and ready
This copy still matches the English source. Translate it before marking it ready.
This destination varies with the notification payload.
No templates match these filters.
Reset filters
Save & next Vietnamese item
Saving this template…
```

피해야 할 예:

```text
Routing errors 0  // 실제로 metadata drift를 검사하지 않는 경우
Opens booking details  // 실제 목적지가 payload에 따라 다른 경우
Complete  // 원문 복사 상태
Not saved  // 메시지가 없거나 실패가 발생하지 않은 초기 상태
```

## 13. 자동 테스트 요구사항

기존 테스트를 유지하고 다음 테스트를 추가한다.

### Admin Web

- 최초 진입에 빈 `Not saved`가 없음.
- 선택/미선택 카탈로그와 언어 탭에 올바른 variant/class와 접근성 상태가 있음.
- 필터 결과 0일 때 편집기가 계속 노출되지 않음.
- Reset filters가 정상 동작.
- source-copied 동일 문구 readiness 승격 차단.
- readiness transition이 change summary에 표시됨.
- UI 허용 변수 집합이 API 응답의 canonical variables만 사용.
- 저장 중 템플릿 전환 경쟁 조건.
- `Save & next` 성공/실패/conflict 동작.
- 언어 탭 키보드 동작 회귀 없음.

### API

- list와 update가 같은 canonical variables를 사용.
- metadata drift health 검출.
- 미수정 SOURCE_COPIED의 READY 요청 거절.
- 실제 번역 READY 성공.
- identical-copy 예외의 확인·감사 로그.
- 영어 변경 시 비영어 NEEDS_REVIEW 전환.
- 낙관적 동시성에서 translation/audit 부분 저장 없음.
- possible destination metadata와 주요 mobile open-intent 계약.

가능하면 실제 Postgres 테스트 환경에서 동일 revision을 사용한 두 동시 PATCH 중 하나만 성공하고 다른 하나는 conflict이며, loser가 translation/audit를 남기지 않는 integration test를 추가한다. 현재 저장소에 기존 integration harness가 없다면 새로운 대형 harness를 만들지 말고 그 한계를 구현 보고서에 명시한다.

## 14. 검증 명령

저장소의 실제 스크립트를 다시 확인한 뒤 최소 다음을 수행한다.

```powershell
npm.cmd run test -w @massage-vn/admin-web -- app/notifications/templates/page.spec.tsx app/notifications/templates/actions.spec.ts lib/admin-operator-access-model.spec.ts

npm.cmd run test -w @massage-vn/api -- src/notifications/notification-template-catalog.spec.ts src/notifications/notifications.service.spec.ts src/bookings/bookings.notifications.spec.ts src/admin/admin.service.spec.ts -t "notification template"

npm.cmd run typecheck -w @massage-vn/admin-web
npm.cmd run typecheck -w @massage-vn/api

npm.cmd exec --workspace @massage-vn/admin-web -- eslint app/notifications/templates/page.tsx app/notifications/templates/notification-template-editor.tsx app/notifications/templates/actions.ts app/notifications/templates/page.spec.tsx app/notifications/templates/actions.spec.ts

npm.cmd exec --workspace @massage-vn/api -- eslint src/notifications/notification-template-catalog.ts src/notifications/notifications.service.ts src/admin/admin.service.ts
```

그다음 현재 저장소 기준으로 다음 관련 계약 검사를 실행한다.

```powershell
npm.cmd run notifications:push-data-contract
npm.cmd run notifications:partner-alert-contract
npm.cmd run notifications:role-audit
```

보호 영역 변경이 있으면 `AGENTS.md`에 맞는 scoped verification을 추가한다.

전체 API spec과 lint도 실행한다. 이번 범위 밖의 기존 실패가 남으면 무관한 제품 코드를 임의 수정하지 말고 다음을 보고한다.

```text
실패 test/file
기존 실패인지 이번 변경 회귀인지
notification templates 출시 판단에 미치는 영향
```

## 15. 브라우저 검증

clean build와 정확한 프로세스 재시작 후 실제 페이지를 다시 확인한다.

### 필수 화면

1. 1440×1000 라이트 기본 화면.
2. 1600×1000 라이트 기본 화면.
3. 1440×1000 다크 기본 화면.
4. Vietnamese `SOURCE_COPIED` 상태.
5. 동일 영어 복사본 READY 차단 상태.
6. 실제 번역문 READY 검토 상태. 저장은 fixture에서만 수행.
7. Ready 필터 결과 0과 Reset filters.
8. canonical variable 칩과 invalid variable 오류.
9. 저장 중 템플릿 전환 차단 또는 안전한 격리 상태.
10. conflict, source unavailable, session expired, server error fixture.
11. `Save & next`의 성공·실패 상태.

### 브라우저 합격 기준

- 가로 overflow 없음.
- 선택 템플릿과 선택 언어가 명확함.
- 선택/비선택 텍스트 대비가 WCAG AA 수준.
- 최초 진입에 오류 배너 없음.
- 필터 결과와 편집기가 모순되지 않음.
- 1440×1000 첫 화면에 언어 탭과 제목 입력이 보임.
- 콘솔 warning/error 0.
- 실제 운영 데이터 저장·실제 알림 발송 없음.

## 16. 금지 사항

- P0를 남긴 채 CSS만 수정하고 완료했다고 보고하지 않는다.
- 클라이언트 검증만 추가하고 API 검증을 생략하지 않는다.
- `READY`를 단순 boolean checkbox 의미로 축소하지 않는다.
- DB 변수와 API 변수의 이중 권위를 유지하지 않는다.
- destination을 확인하지 않고 key prefix로 추정하지 않는다.
- 공통 `AdminFormControlButton`의 기본 스타일을 전체 프로젝트에 무계획하게 변경하지 않는다.
- 24개 데이터에 새 virtual scrolling 라이브러리를 추가하지 않는다.
- 실제 push를 보내거나 운영 템플릿을 브라우저에서 시험 저장하지 않는다.
- 테스트를 source 문자열 포함 여부만으로 끝내지 않는다.
- 실행 프로세스가 이전 build인 상태에서 브라우저 검증을 완료 처리하지 않는다.
- 관련 없는 dirty worktree를 정리하지 않는다.

## 17. 완료 조건

다음 조건을 모두 충족해야 완료다.

- P0 세 건이 코드와 자동 테스트에서 해결됨.
- UI 변수와 API validator가 하나의 canonical contract를 사용함.
- 미수정 영어 복사본이 우발적으로 READY가 될 수 없음.
- 저장 응답 순서가 바뀌어도 템플릿 문구가 섞이지 않음.
- 초기 빈 오류, 필터 모순, 버튼 선택 상태가 해결됨.
- 목적지 안내가 실제 계약과 일치하거나 payload 의존성을 정직하게 표시함.
- 베트남어 작업을 연속 처리할 수 있음.
- 1440/1600 라이트·다크 브라우저 검증 완료.
- Admin/API typecheck와 notification templates 집중 테스트 통과.
- 관련 lint 통과.
- 실행 admin/API가 현재 build와 일치함.
- 실제 운영 데이터와 실제 사용자 알림을 변경하지 않음.

## 18. 최종 구현 보고서 형식

작업이 끝나면 다음 형식으로 보고한다.

```markdown
# Notification Templates remediation implementation report

## 결론
- 완료/부분 완료/차단
- 출시 판정

## 변경 파일
- 파일별 변경 이유

## P0 해결 증거
### Canonical variable contract
### SOURCE_COPIED readiness guard
### Pending template race

## P1 개선
- 선택 상태와 대비
- 초기 상태
- 필터/편집기
- destination
- 번역 작업 큐
- managed copy
- 화면 밀도

## 데이터·migration
- schema/migration 변경 여부
- 적용 여부
- rollback 또는 호환성

## 테스트 결과
- 명령
- passed/failed/skipped 수
- 남은 기존 실패

## 브라우저 증거
- 1440/1600
- light/dark
- 핵심 상태 screenshot 경로
- console 결과

## 보호 영역
- 변경한 보호 영역
- 강화 검증 결과

## 남은 위험
- 실제로 남은 항목만 기재
```

완료하지 못한 항목은 숨기지 말고 blocker와 다음 조치를 명확히 남긴다. 최종 보고서만 작성하고 끝내지 말고, 실제 구현·테스트·브라우저 검증 결과를 근거로 작성한다.
