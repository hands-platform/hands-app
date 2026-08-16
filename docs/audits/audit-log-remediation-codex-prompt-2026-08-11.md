# Codex 실행 프롬프트 — Audit Log 신뢰성·운영 UX 최종 개선

아래 내용을 새 Codex 작업에 그대로 붙여 넣어 사용한다.

---

## 역할

너는 `C:\dev\massage-on-demand-vn` 프로젝트의 시니어 제품 엔지니어이자 감사 로그·보안 통제·관리자 운영 UX 전문가다.

이번 작업의 목적은 `/audit-log`를 단순히 보기 좋은 로그 테이블로 꾸미는 것이 아니다. 운영자, 보안 담당자, 재무 담당자가 이 화면을 근거로 다음 질문에 정확히 답할 수 있도록 데이터 계약, 저장 무결성, API, 화면 정보구조와 테스트를 함께 개선해야 한다.

1. 실제로 무슨 일이 발생했는가?
2. 사람·시스템·서비스 중 누가 수행했는가?
3. 성공·실패·거부·해결 중 결과가 무엇인가?
4. 어떤 객체의 무엇이 어떻게 바뀌었는가?
5. 왜 수행됐으며 어떤 요청·사건과 연결되는가?
6. 데이터가 정상적으로 조회된 것인지, 장애 때문에 비어 보이는 것인지?
7. 원본 증거가 변형되지 않았으며 사후 수정되지 않았는가?

현재 화면의 시각적 완성도보다 **감사 사실의 정확성, append-only 무결성, 오류 시 fail-closed, 운영 판독성**을 우선한다.

## 작업 위치와 기준 문서

- 저장소: `C:\dev\massage-on-demand-vn`
- 대상 화면: `http://localhost:3101/audit-log`
- 최종 재감사 보고서:
  - `C:\dev\massage-on-demand-vn\docs\audits\audit-log-final-reaudit-2026-08-11.md`
- 캡처 증거:
  - `C:\dev\massage-on-demand-vn\docs\audits\audit-log-reaudit-evidence-2026-08-11\`
- 저장소 지침:
  - `C:\dev\massage-on-demand-vn\AGENTS.md`

작업을 시작하면 위 문서와 `AGENTS.md`를 먼저 끝까지 읽는다. 보고서의 줄 번호와 파일명은 감사 시점의 근거이므로, 현재 코드와 실제 실행 화면을 다시 대조한 뒤 수정한다. 보고서 문장을 기계적으로 복사하거나 현재 코드에 이미 반영된 항목을 중복 구현하지 않는다.

## 대상 범위

주요 대상은 다음과 같다. 실제 의존 관계를 조사한 후 꼭 필요한 관련 파일만 추가한다.

- `apps/admin_web/app/audit-log/page.tsx`
- `apps/admin_web/app/audit-log/page-content.tsx`
- `apps/admin_web/app/audit-log/audit-log-command-board-section.tsx`
- `apps/admin_web/app/audit-log/audit-log-table-section.tsx`
- `apps/admin_web/app/audit-log/**/*.spec.*`
- `apps/admin_web/lib/admin-api.ts`
- `apps/admin_web/lib/admin-operator-access.ts`
- `apps/admin_web/lib/admin-copy.ts`
- `apps/admin_web/proxy.ts`
- `apps/admin_web/app/globals.css`
- `apps/api/src/admin/admin-governance.routes.ts`
- `apps/api/src/admin/admin.service.ts`
- `apps/api/src/admin/admin-background-jobs.service.ts`
- `apps/api/src/admin/admin-audit-helpers.ts`
- 관련 API 테스트
- `apps/api/prisma/schema.prisma`
- 필요한 경우 최소 Prisma migration
- 필요한 경우 `packages/shared-types`의 감사 이벤트 계약

`schema.prisma`, migrations, shared types는 `AGENTS.md`의 protected area다. 변경하면 해당 scope 검증과 full local verification 요구를 따른다.

## 데스크톱 화면 기준

- **1440px 이상 데스크톱만 구현·검증한다.**
- 필수 검수 크기: `1440×1000`, `1600×1000` 또는 그 이상의 실제 운영 화면.
- 1024px 이하, 모바일, 태블릿, responsive reflow는 이번 작업에서 완전히 제외한다.
- 1024px 이하 문제를 구현 보고서, 잔여 이슈, 스크린샷 목록에 포함하지 않는다.
- 기존 작은 화면 CSS를 의도적으로 훼손하지는 말되 이번 작업의 시간과 완료 기준으로 사용하지 않는다.

## 작업 안전 원칙

1. 현재 dirty worktree의 기존 변경은 사용자 작업이다. 관련 없는 변경을 되돌리거나 덮어쓰지 않는다.
2. `git reset --hard`, 광범위 checkout, 무관한 파일 정리, 기존 사용자 변경 삭제를 금지한다.
3. production 또는 공유 개발 데이터의 감사 기록을 삭제·수정하거나 실제 운영 액션을 발생시키지 않는다.
4. 브라우저 검수 중 write action, export 실행, 권한 변경, 로그 correction 생성은 하지 않는다. 쓰기 흐름은 테스트 DB나 disposable fixture로 검증한다.
5. 새로운 UI 라이브러리, 범용 workflow framework, 별도 audit platform을 추가하지 않는다.
6. 기존 디자인 토큰과 관리자 공용 컴포넌트를 재사용한다.
7. CSS로 데이터를 숨기거나 `overflow: hidden`으로 문제를 감추지 않는다.
8. UI에서만 버튼이나 문구를 바꾸고 서버 계약·저장 무결성을 그대로 두지 않는다.
9. API 장애를 빈 데이터나 `Clear`로 위장하지 않는다.
10. 인덱스, 캐시, 별도 검색 시스템은 측정 근거가 있을 때만 추가한다.
11. 정책상 중요한 결정을 임의로 완화하지 않는다. 아래 P0 정책을 기본 정책으로 구현한다.
12. 구현을 여러 단계로 나눌 수 있지만 P0가 남은 상태를 전체 완료로 보고하지 않는다.

## 감사 시점의 확정 기준선

다음 수치는 하드코딩할 값이 아니라 문제 재현과 전후 비교를 위한 기준선이다. 구현 직전에 최신 수치를 다시 읽기 전용으로 확인한다.

- 전체 `AdminAuditLog`: 약 49,706건
- 당일 Vietnam 기준: 약 326건
- 당일 background failure + 일반 page view: 325건, 약 99.69%
- 전체 `admin_web.page_view`: 약 27,357건, 약 55.04%
- 전체 background failure: 약 5,244건, 약 10.55%
- 당일 이벤트가 모두 `Local Admin Web Actor`로 보이는 오귀속 확인
- 기본 list 쿼리는 로컬 DB에서 약 17.7ms, summary는 약 3.2ms 수준

따라서 이번 문제를 단순 DB 지연으로 단정하지 않는다. 페이지 방문 write amplification, 서로 다른 list/summary snapshot, 중복 UI 계산, 중첩 스크롤과 과도한 상단 정보도 함께 해결한다.

---

# Phase 0 — 출시 차단 문제

## P0-1. 시스템 이벤트의 사람 actor 오귀속 제거

### 현재 문제

백그라운드 모니터가 시스템 이벤트를 기록하면서 첫 번째 Master Admin ID를 actor로 사용한다. 그 결과 시스템 자동 작업이 특정 운영자의 행동처럼 보인다.

### 필수 계약

모든 감사 이벤트는 최소한 다음 actor 정보를 가져야 한다.

```ts
type AuditActor = {
  type: 'HUMAN' | 'SYSTEM' | 'SERVICE';
  id: string | null;
  key?: string;
  labelSnapshot: string;
};
```

- `HUMAN`: 실제 로그인 운영자 ID와 당시 표시명 snapshot
- `SYSTEM`: 안정적인 system principal key. 예: `background-jobs-monitor`
- `SERVICE`: 외부 또는 내부 service principal key
- 시스템 이벤트에 편의를 위해 Master Admin을 대입하지 않는다.
- actor 표시명 변경 또는 계정 삭제 후에도 당시 증거가 남도록 `labelSnapshot`을 보존한다.
- 현재 `actorId`가 required relation이라면 nullable 전환 또는 별도 principal 구조 중 현재 코드에 가장 작은 안전한 모델을 선택한다.
- legacy 이벤트는 원본을 수정하지 않는다. 화면에서 `Legacy attribution uncertain`처럼 정확히 구분하거나 versioned legacy mapping으로 표시한다.

### 필수 테스트

- background failure/retry/incident 이벤트가 `SYSTEM`으로 저장된다.
- SYSTEM 이벤트에 Human Admin ID가 저장되지 않는다.
- 실제 관리자 액션은 `HUMAN`과 실제 actor ID를 유지한다.
- actor 계정의 현재 이름이 바뀌어도 저장된 snapshot이 유지된다.
- UI에서 actor type, label, stable key 또는 short ID가 계층적으로 보인다.

## P0-2. 일반 페이지 방문 기록을 감사 로그에서 분리

### 현재 문제

허용된 관리자 페이지를 열 때마다 `admin_web.page_view`가 기록되고 full pathname + query string이 target에 들어간다. Audit Log 검색 자체가 새 page view를 생성해 같은 검색어로 다시 검색되는 자기 오염이 발생한다.

### 기본 정책

- 일반 page view는 `AdminAuditLog`에서 제거한다.
- 일반 탐색 telemetry가 필요하면 기존 analytics/telemetry primitive를 조사해 별도로 저장한다.
- 별도 telemetry가 없어도 이번 작업을 위해 새 거대한 분석 시스템을 만들지 않는다. 최소한 일반 page view의 audit write를 중단한다.
- 다음 보안성 이벤트는 감사 로그에 유지한다.
  - access denied
  - permission/role 변경
  - 민감 상세 조회
  - 개인정보 또는 재무 데이터 export
  - 관리자 로그인·세션 보안 사건
- query string 전체를 감사 target에 저장하지 않는다. 필요한 경우 route template, allowlisted object ID, filter hash 등 최소 정보만 기록한다.
- 기존 historical page view는 삭제하지 않는다. 기본 saved view와 기본 All records에서 legacy page view를 제외하거나 `Telemetry` legacy filter에서만 명시적으로 볼 수 있게 한다.

### 필수 테스트

- `/audit-log?q=unique-value` 방문이 새로운 검색 결과를 만들지 않는다.
- 일반 `/bookings`, `/partners`, `/audit-log` 방문은 AdminAuditLog row를 만들지 않는다.
- sensitive detail view, access denied, export는 감사 이벤트를 만든다.
- query string의 자유 입력, 검색어, 민감 식별자가 actor/target/metadata에 그대로 남지 않는다.

## P0-3. canonical event registry로 분류를 단일화

### 현재 문제

서버와 프런트가 action prefix를 각자 재해석한다. `provider_`는 Dispatch와 Partner에 동시에 포함되고 Payment는 Finance의 부분집합이다. 동일 이벤트가 여러 priority에 포함될 수 있으며 UI 표시 우선순위와 API 필터 결과도 다르다.

### 필수 계약

- 프런트와 서버에 prefix if-chain을 복제하지 않는다.
- API 측 canonical registry 또는 versioned event definition을 단일 진실 공급원으로 둔다.
- 각 이벤트는 정확히 하나의 primary `area`, 하나의 `severity`, 하나의 `outcome`, 하나의 `actorType`, 하나의 `objectType`을 가진다.
- 여러 관점은 primary area가 아니라 `tags`로 표현한다.
- UI는 API가 반환한 분류를 표시할 뿐 다시 계산하지 않는다.
- filter option과 facet count는 동일 registry와 동일 predicate를 사용한다.
- 새 이벤트 type이 registry에 없으면 조용히 잘못 분류하지 말고 `UNKNOWN` 또는 명시적 data quality 상태로 드러낸다.

권장 기본 영역:

```ts
type AuditArea =
  | 'OPERATOR'
  | 'POLICY'
  | 'MONEY'
  | 'BOOKING'
  | 'SECURITY'
  | 'SYSTEM'
  | 'UNKNOWN';

type AuditSeverity = 'INFO' | 'NOTICE' | 'REVIEW' | 'CRITICAL';

type AuditOutcome =
  | 'SUCCEEDED'
  | 'FAILED'
  | 'DENIED'
  | 'SKIPPED'
  | 'OPENED'
  | 'ACKNOWLEDGED'
  | 'RESOLVED'
  | 'RECORDED';
```

### 필수 테스트

- 모든 등록 event type에 primary area와 severity가 정확히 하나다.
- Partner/Dispatch, Payment/Finance가 primary area로 중복되지 않는다.
- UI badge와 API filter가 동일 severity를 사용한다.
- Tax facet, saved view count, 클릭 후 list total이 같다.
- 미등록 event type이 명시적인 Unknown 상태로 나타난다.

## P0-4. list·summary·facets를 동일 snapshot으로 통합하고 오류를 노출

### 현재 문제

화면이 list와 summary를 별도 API로 병렬 호출하며 오류 시 각각 `[]`, `null` fallback을 사용한다. 운영자는 API 장애를 `0건`, `Clear`, `No audit logs loaded`로 오판할 수 있다.

### 필수 API 응답

현재 라우팅 관례에 맞는 단일 page endpoint를 만들거나 기존 endpoint를 호환성 있게 확장한다.

```ts
type AuditLogPageResponse = {
  items: AuditEventView[];
  totalCount: number;
  facets: {
    areas: Array<{ value: string; count: number }>;
    severities: Array<{ value: string; count: number }>;
    outcomes: Array<{ value: string; count: number }>;
    actorTypes: Array<{ value: string; count: number }>;
  };
  summary: {
    reviewRequired: number;
    failed: number;
    unacknowledged: number;
    unknownClassification: number;
  };
  cursor: { next: string | null; previous?: string | null };
  generatedAt: string;
  timezone: 'Asia/Ho_Chi_Minh';
  sourceStatus: 'LIVE' | 'DEGRADED' | 'UNAVAILABLE';
  errorReferenceId?: string;
};
```

- items, counts, facets, summary가 동일 predicate와 동일 snapshot을 사용한다.
- 가능하면 한 transaction/snapshot에서 계산한다.
- partial failure를 정상 0건으로 변환하지 않는다.
- Admin Web의 범용 `adminGet` fallback 동작을 전체 앱에 무리하게 바꾸지 말고, Audit Log에서 typed result/error를 정확히 처리한다. 공용 변경이 안전하고 테스트 가능할 때만 공용화한다.
- `sourceStatus !== LIVE`일 때 `Clear`, `No issues`, 정상 success tone을 표시하지 않는다.

### 화면 상태 계약

다음 상태를 서로 다른 UI와 문구로 구현한다.

1. initial loading
2. live data + records
3. live data + true empty
4. live data + filtered empty
5. degraded/partial data
6. API unavailable/timeout
7. permission denied
8. invalid or expired cursor

오류 상태에는 재시도, 마지막 성공 시각, 오류 reference ID를 제공한다. 기존 데이터가 있더라도 stale/degraded임을 명확히 표시한다.

## P0-5. 감사 저장을 append-only로 강제

### 현재 문제

bank statement batch assignment 과정에서 기존 `AdminAuditLog.metadata`를 update한다. 별도 assignment 이벤트가 추가되더라도 최초 audit payload가 바뀌므로 원본 증거가 아니다.

### 필수 정책

- 감사 event는 insert-only다.
- 기존 event의 application-level `update`와 `delete`를 제거한다.
- 현재 상태 projection은 업무 테이블, review table 또는 materialized view에 둔다.
- 잘못된 이벤트는 원본 수정이 아니라 `audit.correction_recorded`와 같은 correction event로 연결한다.
- application DB role에서 UPDATE/DELETE를 차단할 수 있는 현재 인프라 방식을 조사하고 최소 migration으로 강제한다.
- migration 전후 rollback과 local test DB 적용 절차를 문서화한다.
- historical row를 임의로 backfill/update하지 않는다. 새 필드가 필요한 경우 immutable 원칙을 지키는 migration 전략을 사용한다.

최소 필드:

- `schemaVersion`
- `occurredAt`
- `recordedAt`
- `eventType`
- `eventId`
- `source`
- `correlationId` 또는 `requestId`
- actor type/id/key/label snapshot
- object type/id/label snapshot
- area/severity/outcome
- `payloadHash`

### 필수 테스트

- 서비스 코드에 기존 audit row update/delete 경로가 없다.
- application role로 UPDATE/DELETE 시도가 실패한다.
- correction event는 원본 event ID를 참조하며 원본 hash가 유지된다.
- 동등한 payload에 안정적인 hash가 생성된다.
- migration rollback/forward가 test DB에서 검증된다.

## P0-6. Raw evidence를 byte-faithful하게 제공

### 현재 문제

generic metadata가 `JSON.stringify` 후 `operationalDisplayText`를 통과한다. `provider`, `backup`, `penalty` 같은 JSON key/value가 바뀔 수 있으므로 현재 `Technical evidence`는 DB 원본과 동일하지 않다.

### 필수 정책

- 운영자용 human summary와 raw evidence를 분리한다.
- Raw JSON에는 `operationalDisplayText`나 다른 copy transform을 적용하지 않는다.
- API에서 권한과 redaction 정책을 적용한 뒤 결정론적인 JSON을 반환한다.
- redaction 대상과 원본 보존 대상 key를 명시적으로 allowlist/denylist화한다.
- 화면에 다음 행동을 제공한다.
  - `Copy event ID`
  - `Copy raw JSON`
  - 권한이 있을 때 `Download evidence`
  - JSON wrap on/off
- `payloadHash` 검증 상태를 표시할 수 있으면 `Verified`와 검증 시각을 제공한다. 검증하지 않았는데 `Verified`라고 쓰지 않는다.
- JSON은 테이블 안에서 별도 중첩 스크롤로 길게 렌더링하지 않고 evidence drawer/detail에서 보여 준다.

### 필수 테스트

- 저장 payload와 raw render/copy 결과가 redaction 항목을 제외하고 같다.
- key 이름이 copy transform으로 바뀌지 않는다.
- 권한 없는 actor에게 민감 field가 노출되지 않는다.
- copy action은 화면 summary가 아니라 raw evidence를 복사한다.

---

# Phase 1 — 운영자 중심 화면 재구성

## 1-1. Command Board와 KPI 과밀 제거

Audit Log는 Booking, Finance, Notification, System Health의 처리 queue를 복제하는 command center가 아니다. 이 화면의 역할은 변경·접근·사건의 증거 검색과 조사다.

현재 8개 KPI와 6개 동일 크기 Command card를 제거하거나 다음의 compact trust strip + server-backed saved views로 교체한다.

권장 상단 구조:

```text
Audit Log                         Live · generated 13:55 ICT
[Review required] [Operator changes] [Money & policy]
[Security & access] [System incidents] [All records]

[Search event/object/actor________________] [Area] [Outcome]
[Actor type] [Date & time] [More filters] [Export]
Active filters ...                                      1–50 of 725
```

규칙:

- 각 saved view count는 서버 facet/saved-view predicate에서 계산한다.
- 같은 event를 여러 card count에 중복 합산해 전체 event count처럼 표시하지 않는다.
- `Clear` 대신 `No matching events`를 사용한다.
- 데이터가 live임이 확인되지 않으면 정상 success tone을 사용하지 않는다.
- 상단에는 `Review required`, `Failed`, `Unacknowledged`, `Data lag` 정도의 필수 신뢰 지표만 유지한다.
- 첫 화면에서 필터와 최소 3개의 감사 행이 보여야 한다.

## 1-2. 5열 조사 테이블과 evidence drawer

1440px에서 page vertical scroll 하나만 사용한다. page card, table, JSON에 세로 스크롤을 중첩하지 않는다.

권장 열:

```text
Time & actor | Event / outcome | Object | Change summary | Open
```

각 행의 정보 우선순위:

- Time & actor: absolute ICT time, relative time, actor type, label snapshot, short stable ID
- Event/outcome: human event label, 실제 outcome, severity, review 상태
- Object: object type, human label, short ID, copy
- Change summary: 핵심 before → after 또는 reason/result 한두 줄
- Open: `Open booking`, `Open notification`, `Open payment` 같은 실제 관련 행동 하나와 evidence drawer trigger

규칙:

- `Result`를 모든 행에서 `Recorded`로 하드코딩하지 않는다.
- generic `/audit-log` 자기 링크는 숨긴다.
- full raw ID와 JSON은 기본 행을 지배하지 않게 한다.
- ID는 short display + 명시적 Copy + 접근 가능한 full value를 사용한다.
- row action을 맨 오른쪽 화면 밖으로 밀지 않는다.
- table `min-width: 1500px`, card/table의 불필요한 `max-height`와 중첩 `overflow`를 제거한다.
- evidence drawer는 기존 공용 drawer/dialog 패턴을 먼저 찾고 재사용한다.
- drawer 권장 폭은 실제 Admin content 폭에서 560~640px 정도로 하되 기존 token/pattern을 우선한다.
- drawer는 Summary, Before/after, Reason, Request context, Raw JSON 탭 또는 섹션을 제공한다.
- Escape로 닫히며 focus가 원래 trigger로 돌아온다.
- URL-addressable investigation이 필요하면 `event=<id>` 또는 `/audit-log/events/:id`를 사용하고 민감 payload를 URL에 넣지 않는다.

## 1-3. 조사 가능한 검색·필터

기본 검색 placeholder가 실제 검색 범위와 일치해야 한다.

지원할 축:

- event/action type
- actor label 또는 stable actor ID
- actor type: Human/System/Service
- outcome
- severity
- primary area
- object type
- exact event ID
- exact object ID
- correlation/request ID
- custom date/time from-to
- sensitive access only
- review/acknowledgement status — 별도 review model이 존재할 때

metadata 전체를 무제한 JSON `ILIKE`로 검색하지 않는다. 검색 가능한 evidence key를 allowlist하고 `correlationId`, `bookingId`, `notificationId`, `reasonCode` 등 조사에 필요한 값을 정규화·인덱싱한다. 실제 metadata 검색을 구현하지 않으면 placeholder에서 metadata 약속을 제거한다.

필터 요구:

- URL-addressable query state
- active filter chip과 Clear all
- filter 변경 시 안전한 cursor reset
- count, facet, list, export가 동일 predicate 사용
- 검색 submit과 pagination 중 자기 page view 이벤트 생성 금지
- long query, 특수문자, CJK 입력에서 레이아웃과 쿼리 안정성 유지

## 1-4. 안정적인 서버 정렬·cursor pagination

- 프런트에서 현재 20개 행만 다시 priority sort하지 않는다.
- 기본 정렬은 서버의 `(occurredAt DESC, id DESC)`다.
- severity 정렬을 제공한다면 `(severity DESC, occurredAt DESC, id DESC)`를 서버 전체 결과에 적용한다.
- offset pagination을 cursor pagination으로 교체하거나 현재 API 관례상 cursor가 불가능하면 snapshot time + deterministic tie-breaker로 중복·누락을 방지한다.
- 조사 시작 시 `generatedAt` 또는 snapshot 경계를 cursor에 묶어 새 event가 들어와도 다음 페이지가 움직이지 않게 한다.
- `Newest first`, `Action grouped`, `Metadata preview` 같은 장식 badge는 제거하거나 실제 control로 바꾼다.
- invalid/expired cursor는 명시적인 recovery를 제공한다.

## 1-5. Vietnam 시간 경계의 서버 단일화

- `Today (Vietnam)` 범위를 Next 서버의 로컬 timezone에 의존해 계산하지 않는다.
- API가 IANA timezone `Asia/Ho_Chi_Minh` 기준 from/to를 계산한다.
- 응답에 timezone, from, to, generatedAt을 반환한다.
- UI는 ICT임을 표시한다.
- Vietnam 자정, 월말, 연말 경계 테스트를 추가한다.

## 1-6. 조사 공유·export·correlation

최소 제공:

- event permalink 또는 URL-addressable drawer
- event ID와 correlation/request ID copy
- 관련 booking/payment/notification/actor record direct link
- 현재 filter를 그대로 적용하는 권한 기반 CSV/JSON export

export 안전 요구:

- 최대 행 제한 또는 async export
- 권한과 redaction 적용
- export actor, filter, row count, outcome을 별도 감사 이벤트로 기록
- signed URL이나 raw sensitive payload를 영구 audit metadata에 저장하지 않음
- export 실패를 성공으로 기록하지 않음

review workflow가 필요하면 immutable event에 status를 덧써서 수정하지 않는다. 기존 공용 primitive를 먼저 찾고 없으면 별도 최소 `AuditReview` 모델에 assignee, status, note, acknowledgedAt, resolvedAt을 둔다. audit 전용 범용 ticket system을 만들지 않는다.

---

# Phase 2 — 중복 운영 기능·성능·문구 마감

## 2-1. 페이지 소유권 분리

다음 원칙으로 중복 queue를 정리한다.

| 데이터 성격 | 기본 소유 화면 | Audit Log 역할 |
|---|---|---|
| Booking/dispatch 미처리 업무 | Booking Operations | 상태 변경 증거와 actor |
| Payment/refund/payout 미처리 업무 | Finance Operations/Records | 금액·상태 변경 증거와 direct link |
| Notification 실패 처리 | Notifications | send/retry/resolve 이벤트 증거 |
| 반복 background job 실패 | System Health incident queue | incident opened/acknowledged/resolved 전환 |
| 일반 페이지 방문 | telemetry 또는 별도 access 분석 | 기본 감사 목록에서 제외 |
| 민감 조회·export·권한 거부 | Security & access saved view | 조사 가능한 보안 이벤트 |
| 관리자·권한·정책·가격 변경 | Audit Log Operator changes | 기본 최우선 업무 |

반복 background failure row를 실행마다 Audit Log 기본 목록에 쌓지 않는다. 기존 incident/dedupe primitive를 조사해 incident 상태 전환만 기본 노출하고 raw occurrence는 System Health에서 다룬다. 기존 primitive가 없으면 거대한 incident 시스템을 만들지 말고 기본 Audit view에서 반복 노이즈를 축소하는 안전한 최소 변경과 남은 구조적 blocker를 보고한다.

## 2-2. 성능 개선은 측정 후 적용

현재 로컬 EXPLAIN에서 list와 summary DB 쿼리는 각각 약 17.7ms, 3.2ms였다. 따라서 무조건 캐시부터 추가하지 않는다.

필수 측정:

- 변경 전/후 API 동일 조건 최소 3회 median
- page first useful content
- filter 적용 후 결과 갱신
- DB `EXPLAIN (ANALYZE, BUFFERS)`
- 페이지 방문 시 audit write 수
- 응답 payload 크기
- 브라우저 console warning/error

인덱스 후보:

- 새 계약이 `occurredAt`을 사용하면 `(occurredAt DESC, id DESC)`
- 현 schema를 유지하면 최소 `(createdAt DESC, id DESC)`
- allowlisted exact/search field는 측정 결과에 따라 필요한 index만 추가

인덱스 추가 전 기존 index와 실제 query plan을 확인한다. materialized summary나 cache는 10배·100배 데이터에서 병목이 증명될 때만 기존 cache primitive를 사용한다.

## 2-3. 운영 문구

권장 문구:

| 현재 | 권장 |
|---|---|
| Audit command board | Saved views 또는 Review views |
| Bucket | Area |
| Priority | Severity 또는 Review level |
| Clear | No matching events |
| Recorded | 실제 event outcome |
| Technical evidence | Evidence details; Raw JSON은 별도 탭 |
| No audit logs loaded. | No events match these filters / Audit data unavailable |
| Audit 자기 링크 | 실제 관련 route가 없으면 숨김 |

문구만 바꾸고 데이터 의미를 그대로 두지 않는다. 색상만으로 severity/outcome을 전달하지 않는다. user-facing 용어는 기존 프로젝트의 `Partner` 기준을 유지하지만 Raw JSON key는 절대 치환하지 않는다.

---

# 권장 최종 이벤트 계약

기존 schema와 DTO를 조사해 가장 작은 안전한 diff로 다음 의미를 구현한다. 이 타입을 그대로 복사해 새 거대 shared abstraction을 만들 필요는 없다.

```ts
type AuditEvent = {
  id: string;
  schemaVersion: number;
  occurredAt: string;
  recordedAt: string;
  eventType: string;
  area: 'OPERATOR' | 'POLICY' | 'MONEY' | 'BOOKING' | 'SECURITY' | 'SYSTEM' | 'UNKNOWN';
  severity: 'INFO' | 'NOTICE' | 'REVIEW' | 'CRITICAL';
  outcome: 'SUCCEEDED' | 'FAILED' | 'DENIED' | 'SKIPPED' | 'OPENED' | 'ACKNOWLEDGED' | 'RESOLVED' | 'RECORDED';
  tags?: string[];
  actor: {
    type: 'HUMAN' | 'SYSTEM' | 'SERVICE';
    id: string | null;
    key?: string;
    labelSnapshot: string;
  };
  object: {
    type: string;
    id: string;
    labelSnapshot?: string;
  };
  reason?: {
    code?: string;
    text?: string;
  };
  change?: {
    before?: unknown;
    after?: unknown;
    changedFields?: string[];
  };
  context?: {
    correlationId?: string;
    requestId?: string;
    source?: string;
    routeTemplate?: string;
  };
  payload: unknown;
  payloadHash: string;
};
```

핵심 계약:

- UI가 action prefix를 재해석하지 않는다.
- human summary와 immutable raw payload를 분리한다.
- actor, object, outcome, area, severity는 저장 또는 API canonical registry에서 결정한다.
- legacy event 해석은 versioned mapping이며 원본을 업데이트하지 않는다.
- 분류 불가능한 값은 숨기지 않고 Unknown으로 드러낸다.

---

# 구현 전 필수 조사 순서

코드를 수정하기 전에 다음 내용을 작업 메모에 남긴다.

1. `git status --short`와 대상 파일의 기존 변경 여부
2. `AGENTS.md`와 감사 보고서 핵심 P0/P1/P2 매핑
3. 현재 audit write caller 전체 목록
4. `admin_web.page_view`, sensitive view, access denied, export write 경로
5. background job actor 선택 방식
6. `AdminAuditLog` update/delete 사용처
7. 서버/프런트 area·priority/outcome 분류 함수 비교
8. list/summary route와 query predicate 비교
9. admin 공용 drawer, table, filter, error-state, copy button 패턴
10. 현재 테스트와 fixture가 보장하는 계약
11. 기존 incident, review, export, file/evidence, telemetry primitive
12. 현재 DB index와 read-only EXPLAIN

조사가 끝나면 P0 → P1 → P2 순서의 짧은 실행 계획을 세우고 바로 구현한다. 정책이 명시된 항목을 다시 질문하지 않는다. 현재 코드에서 보고서와 충돌하는 최신 근거가 발견되면 근거 파일과 안전한 결정만 기록한다.

# 상태별 필수 화면 계약

다음 상태를 구현과 테스트에서 구분한다.

1. live data + review required events
2. live data + true empty
3. live data + filtered empty
4. API timeout/unavailable
5. degraded/partial source
6. permission denied
7. unknown event classification
8. legacy actor attribution uncertain
9. raw evidence redacted
10. raw evidence permission denied
11. invalid/expired cursor
12. export queued/succeeded/failed — export를 구현한 경우

# 필수 테스트 계약

source 문자열 존재 검사보다 API predicate, rendered output, 실제 browser behavior를 검증한다.

## 데이터·무결성

- SYSTEM/SERVICE 이벤트가 HUMAN actor로 저장되지 않는다.
- 일반 page view가 AdminAuditLog에 추가되지 않는다.
- sensitive access/access denied/export는 감사된다.
- audit row update/delete가 application role에서 실패한다.
- correction event가 원본을 변경하지 않는다.
- raw JSON이 redaction 외에는 원본과 같다.
- payload hash가 결정론적이며 검증 가능하다.
- legacy event가 원본 수정 없이 표시된다.

## 분류·집계

- 한 이벤트에 primary area와 severity가 정확히 하나다.
- server filter와 row badge가 동일 registry를 사용한다.
- saved view count, facet count, list total이 동일 predicate에서 일치한다.
- Tax/Partner/Dispatch/Payment/Finance overlap이 primary area에 없다.
- Unknown event가 잘못된 기본 area로 섞이지 않는다.

## 오류·일관성

- items/summary/facets가 같은 generatedAt/snapshot을 공유한다.
- 401/403/500/timeout에서 0건 또는 `Clear`가 나오지 않는다.
- sourceStatus가 live가 아니면 success tone이 나오지 않는다.
- 새 이벤트가 생성되는 중에도 cursor pagination에 중복·누락이 없다.
- Vietnam today boundary가 UTC 배포 환경에서도 동일하다.

## UI·접근성

- 1440×1000에서 page vertical scroll 하나만 존재한다.
- 첫 화면에 saved views, 필터, 최소 3행이 보인다.
- page-level horizontal scroll이 없다.
- 마지막 action과 관련 route가 잘리지 않는다.
- drawer가 Escape로 닫히고 focus가 trigger로 복귀한다.
- keyboard로 filter → row → evidence → related record 순서가 자연스럽다.
- loading/empty/filtered-empty/degraded/error/permission 상태가 구분된다.
- raw evidence에 copy, wrap, redaction 설명이 있다.
- 색상 없이도 outcome과 severity를 구분할 수 있다.

# 권장 검증 명령

현재 package script와 spec 경로를 먼저 확인한다. 존재하지 않는 명령을 성공으로 포장하지 말고 가장 가까운 focused 명령으로 대체한 이유를 보고한다.

## Admin Web focused tests

```powershell
npm.cmd run test --workspace @massage-vn/admin-web -- app/audit-log/page.spec.ts app/audit-log/page-content.spec.tsx app/audit-log/audit-log-table-section.spec.tsx app/audit-log/audit-log-command-board-section.spec.tsx app/audit-log/audit-log-page-model.spec.ts
npm.cmd run typecheck --workspace @massage-vn/admin-web
npm.cmd run build --workspace @massage-vn/admin-web
```

현재 기준선의 `page.spec.ts` React `Invalid hook call` 실패를 먼저 재현하고, 애플리케이션 버그인지 renderer/duplicate React 테스트 환경 문제인지 분리한다. 해결하지 않은 baseline 실패를 새 변경과 무관하다고만 적고 완료하지 않는다.

## API focused tests

```powershell
npm.cmd run test --workspace @massage-vn/api -- src/admin/admin.service.spec.ts -t "audit log"
npm.cmd run test --workspace @massage-vn/api -- src/admin/admin-audit-helpers.spec.ts src/admin/admin-background-jobs.service.spec.ts src/admin/admin-audit-log-index-contract.spec.ts
npm.cmd run typecheck --workspace @massage-vn/api
```

새 canonical registry, actor, append-only, snapshot endpoint 테스트 파일을 만들었다면 위 focused suite에 포함한다.

## 저장소 scope 검증

```powershell
npm.cmd run verify:scope -- -Scope admin
npm.cmd run verify:scope -- -Scope api
```

schema, migration, shared type 등 protected area를 바꿨으면 `AGENTS.md`에 따라 가능한 범위에서 다음도 실행한다.

```powershell
npm.cmd run verify:local
powershell -ExecutionPolicy Bypass -File .\infra\scripts\verify-local.ps1 -WithServices
```

실행할 수 없으면 생략 사유, 필요한 서비스, 첫 root cause, 이번 변경과의 관련성을 구분해 보고한다.

## UI detector

UI 수정이 모두 끝난 뒤 한 번만 실행한다.

```powershell
node C:\Users\laboy\.codex\skills\impeccable\scripts\detect.mjs --json apps/admin_web/app/audit-log apps/admin_web/app/globals.css
```

# 실제 브라우저 검증

로그인된 in-app browser를 사용한다. 현재 source/build와 브라우저가 일치하는지 먼저 확인하고 새 캡처를 만든다. 과거 감사 캡처를 최종 구현 증거로 재사용하지 않는다.

필수 캡처:

### 1440×1000

1. 기본 saved views + 필터 + 첫 3개 이상 row
2. Review required
3. Operator changes
4. Money & policy
5. Security & access
6. System incidents
7. Human/System actor가 함께 보이는 table
8. evidence drawer Summary/Before-after
9. byte-faithful Raw JSON과 redaction 표시
10. filtered empty
11. degraded 또는 API unavailable fixture
12. permission denied fixture

### 1600×1000

1. 기본 전체 화면
2. 긴 object label·actor label·change summary가 있는 table
3. evidence drawer open

각 화면에서 확인:

- page-level horizontal scroll 없음
- page vertical scroll 하나
- 카드/table/JSON 세로 스크롤 중첩 없음
- 마지막 action 잘림 없음
- 검색 placeholder 전체 표시
- saved view count와 클릭 결과 total 일치
- actor type과 실제 outcome 판독 가능
- exact/relative time과 ICT 표시
- keyboard focus, Escape, focus return 정상
- console warning/error 0건. HMR 로그는 별도 구분
- query search가 새 audit row를 만들지 않음

1024px 이하 화면은 열거나 캡처하거나 결과에 언급하지 않는다.

# 완료 기준

다음 항목을 모두 확인하기 전에는 `완료`라고 하지 않는다.

- [ ] SYSTEM/SERVICE 이벤트가 사람 actor로 귀속되지 않는다.
- [ ] 일반 page view가 감사 로그를 오염시키지 않는다.
- [ ] 검색이 자기 검색 결과를 생성하지 않는다.
- [ ] canonical registry 하나가 area/severity/outcome/actorType/objectType을 결정한다.
- [ ] UI와 API의 분류·필터·count가 일치한다.
- [ ] list/summary/facets가 동일 snapshot과 generatedAt을 공유한다.
- [ ] API 오류가 0건 또는 `Clear`로 위장되지 않는다.
- [ ] audit event가 append-only이며 correction은 새 이벤트다.
- [ ] Raw JSON이 redaction 외에는 원본과 동일하다.
- [ ] 첫 화면에서 조사 목록을 바로 볼 수 있다.
- [ ] 1440px에서 중첩 세로 스크롤과 page-level 가로 스크롤이 없다.
- [ ] Result가 실제 outcome을 표시한다.
- [ ] actor type, object, before/after, reason, correlation이 조사 가능하다.
- [ ] server sort와 deterministic cursor가 중복·누락을 방지한다.
- [ ] Vietnam today가 Asia/Ho_Chi_Minh 기준으로 계산된다.
- [ ] focused tests, typecheck, build, scope 검증 결과가 기록된다.
- [ ] 현재 코드와 일치하는 새 1440/1600 캡처가 저장된다.
- [ ] protected area 변경과 migration 위험이 명시된다.

# 하지 말아야 할 구현

- `Clear`를 다른 긍정 문구로만 바꾸고 fallback `[]`/`null`을 유지하지 않는다.
- 사람 이름을 `System`으로 표시만 바꾸고 DB actor ID 오귀속을 유지하지 않는다.
- frontend priority 함수만 고치고 API filter를 그대로 두지 않는다.
- Command Board count를 현재 20행에서 계속 계산하지 않는다.
- historical page view를 대량 삭제하거나 기존 audit payload를 backfill update하지 않는다.
- Raw JSON에 user-facing 용어 치환을 적용하지 않는다.
- `overflow: hidden`으로 마지막 열이나 JSON을 자르지 않는다.
- 모든 admin table을 새 범용 table framework로 교체하지 않는다.
- audit 기능만을 위한 거대한 event sourcing framework를 만들지 않는다.
- 측정 없이 cache, Elasticsearch, 새 검색 dependency를 추가하지 않는다.
- permission/redaction 없이 export를 추가하지 않는다.
- 1024px 이하 대응을 새로 만들지 않는다.
- unrelated dirty change를 revert하거나 포맷하지 않는다.
- 실제 운영 audit row를 수정·삭제하며 테스트하지 않는다.

# 최종 보고 형식

작업 완료 후 다음 순서로 보고한다.

1. 운영자 관점에서 실제로 달라진 결과
2. P0/P1/P2별 완료·부분 완료·미완료 표
3. actor attribution before/after 계약
4. 일반 page view와 sensitive access 기록 정책
5. canonical event registry와 unknown event 처리
6. append-only·correction·payload hash 검증 결과
7. 단일 snapshot API와 오류 상태 결과
8. saved views·5열 table·evidence drawer 결과
9. 1440/1600 화면 캡처 링크
10. 성능 동일 조건 before/after 표
11. 변경 파일과 각 파일을 변경한 이유
12. 실행한 명령과 pass/fail/skipped 결과
13. migration과 protected area 검증 결과
14. 개인정보·권한·redaction·export 안전성
15. 남은 위험과 다음 권장 작업 하나

반드시 다음 구체적 증거를 포함한다.

- SYSTEM 이벤트 DB/API/UI actor 값
- 일반 page 방문 전후 AdminAuditLog row 변화
- unique search의 자기 오염 방지 결과
- 같은 filter에서 facet/count/list total 일치 결과
- API 500/timeout에서 `Clear`가 나오지 않는 화면 또는 테스트
- audit UPDATE/DELETE 차단 테스트
- raw payload와 rendered/copied JSON 비교
- cursor pagination 중복·누락 테스트
- 1440 첫 화면과 evidence drawer 캡처
- focused test 개수와 결과
- 브라우저 console 결과

기술적으로 한 번에 완료할 수 없는 구조적 항목이 있어도 독립적으로 안전하게 구현 가능한 항목은 모두 완료한다. 미완료 항목은 성공으로 포장하지 말고 blocker, 코드 근거, 운영 위험, 안전한 최소 대안, 다음 한 단계를 보고한다.

최종 성공 기준은 카드 수나 CSS 변화가 아니다. **운영자가 노이즈와 거짓 정상 상태 없이, 누가 무엇을 왜 변경했고 결과가 무엇이며 원본 증거가 신뢰 가능한지를 한 화면에서 빠르게 판단할 수 있어야 한다.**
