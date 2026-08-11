# Codex 실행 프롬프트 — Chat Evidence Search 운영 개선

아래 `Prompt` 전체를 새 Codex 작업에 그대로 전달한다. 이 문서는 단순 디자인 제안이 아니라, 코드 수정·테스트·실제 브라우저 검증까지 완료시키기 위한 실행 계약이다.

---

## Prompt

작업 경로는 반드시 `C:\dev\massage-on-demand-vn`만 사용한다.

관리자 페이지 `http://localhost:3101/chat-archive`를 운영자가 신뢰할 수 있는 **메시지 중심 글로벌 채팅 증거 검색 화면**으로 개선하라. 화면만 보기 좋게 바꾸지 말고, 날짜·검색·발신자·집계·페이지네이션·오류·권한·감사 기록·민감정보가 같은 의미를 갖도록 Admin Web과 API의 실제 데이터 흐름을 함께 수정하라.

계획만 작성하고 멈추지 않는다. 현재 코드를 확인하고, 필요한 최소 범위로 구현하고, 테스트하고, 로그인된 실제 관리자 화면에서 검증한 뒤 결과를 보고한다.

### 1. 먼저 읽을 자료

다음 순서로 확인한다.

1. `C:\dev\massage-on-demand-vn\AGENTS.md`
2. `C:\dev\massage-on-demand-vn\docs\agent\HANDS_CODEX_WORKFLOW_GUARD.md`
3. `C:\dev\massage-on-demand-vn\output\chat-archive-audit-2026-08-06\chat-archive-operator-ux-security-audit.md`
4. 같은 폴더의 `01-default-today.png`부터 `13-partner-sender-filter-context.png`까지 모든 감사 캡처

감사 이후 코드가 변경됐을 수 있으므로 보고서만 믿고 수정하지 않는다. 먼저 `git status --short`를 확인하고, 아래 관련 파일의 현재 내용과 diff를 검사한 다음 실제 호출 흐름을 추적한다. 기존 dirty worktree의 변경은 모두 사용자 소유로 간주하고 되돌리거나 덮어쓰지 않는다.

### 2. 운영자 목표

운영자는 이 화면에서 추측하지 않고 다음 질문에 답할 수 있어야 한다.

- 어떤 메시지가 검색 조건과 일치했는가?
- 누가 언제 보냈는가?
- 어느 고객·Partner·예약의 대화인가?
- 첨부파일이 있는가?
- 전체 대화는 어디서 확인하는가?
- 현재 결과가 실제 0건인가, 필터 불일치인가, 요청 실패인가?
- 검색 범위·발신자·건수·페이지·URL이 서로 일치하는가?
- 이 민감한 증거에 누가 접근하거나 검색했는가?

이 화면의 visitor mode는 **Operate**다. 시각적 장식보다 빠른 탐색, 정보 신뢰, 개인정보 최소 노출, 명확한 다음 행동, 키보드 접근성을 우선한다.

### 3. 고정된 제품·정보구조 결정

다음 결정은 다시 토론하지 말고 구현한다. 현재 코드가 전제와 명백히 다를 때만 그 사실을 최종 보고한다.

1. `/chat-archive` 경로와 `Chat Evidence` 내비게이션은 유지한다.
2. H1은 `Chat Evidence Search`를 유지한다.
3. 이 페이지는 채팅방 상태판이 아니라 **개별 메시지 중심의 글로벌 증거 검색**이다.
4. 한 결과 행의 기본 단위는 채팅방이나 예약이 아니라 검색 조건과 일치한 메시지다.
5. 전체 대화 원문은 기존 Booking Activity의 읽기 전용 transcript에서 계속 확인한다. 이 페이지에 두 번째 transcript 시스템을 만들지 않는다.
6. 채팅방 누락·빈 방·복구는 증거 검색과 다른 운영 문제다. 기존 Booking repair/integrity queue가 있으면 그곳으로 연결하고, 없다면 이 작업에서 새 범용 queue를 만들지 말고 오해를 부르는 KPI와 표현만 제거한 뒤 별도 후속 작업으로 명시한다.
7. base URL `/chat-archive`와 `Clear filters`는 모두 **All dates**를 의미한다.
8. 날짜 필터의 유일한 기준은 `ChatMessage.createdAt`, 즉 메시지 전송 시각이다.
9. 검색·발신자 필터·결과 목록·집계는 동일한 message-level predicate를 사용한다.
10. 기본 목록에서는 고객·Partner 전화번호를 표시하지 않는다.
11. 예약 상태에서 유추한 `online`, `offline`, `working` 표현을 사용자 앱 접속 상태처럼 표시하지 않는다.
12. 기존 브라우저 `data:` URL CSV는 제거한다. 보존·내보내기 정책이 미결정인 상태에서 새 export를 구현하지 않는다.
13. 채팅 증거 접근 권한은 리뷰 권한이 아니라 기존 `BOOKINGS_DETAIL`의 chat evidence 설명과 일치시킨다. Web 경로, API, 내비게이션 노출, 테스트의 권한 경계를 동일하게 맞춘다.
14. fixture·audit·smoke·seed 데이터는 기본 운영 결과에서 제외한다. 이미 존재하는 production-data predicate를 재사용한다.
15. user-facing copy에서는 내부 타입 이름이 provider여도 반드시 `Partner`라고 쓴다.

### 4. 수정 전 최소 조사 범위

`rg`로 먼저 찾고, 공유 helper를 수정하기 전에는 모든 caller를 확인한다. 최소한 다음 경로와 관련 테스트를 검사한다.

- `apps/admin_web/app/chat-archive/page.tsx`
- `apps/admin_web/app/chat-archive/page.spec.tsx`
- `apps/admin_web/app/chat-archive/chat-archive-page-model.ts`
- `apps/admin_web/app/chat-archive/chat-archive-page-model.spec.ts`
- `apps/admin_web/app/globals.css`
- `apps/admin_web/lib/detail-date-filter.ts`
- `apps/admin_web/lib/admin-api.ts`의 result-aware 요청 패턴
- `apps/admin_web/lib/admin-operator-access-model.ts`
- `apps/admin_web/lib/admin-operator-permissions.ts`
- 내비게이션 정의와 관련 spec
- Booking Activity의 full transcript 컴포넌트·API·read audit
- `apps/api/src/admin/admin-chat-archive-selects.ts`
- chat archive controller/route/DTO/service와 관련 spec
- `apps/api/src/admin/admin-booking-list-query.ts`
- 기존 production-data predicate
- 기존 admin audit-log helper와 이벤트 명명 패턴
- `apps/api/prisma/schema.prisma`의 `ChatRoom`, `ChatMessage`
- `docs/architecture/master-progress-roadmap.md`의 retention/export 미결정 항목

현재 전체 transcript가 사용하는 attachment select, 최대 200개 제한, truncated 신호, `booking.chat.view` 감사 기록은 회귀 없이 유지한다.

### 5. P0 — 결과 신뢰와 보안

#### A. API 오류를 0건으로 숨기지 않기

- list와 summary에서 `adminGet(..., fallback)`으로 오류를 정상 데이터처럼 바꾸는 코드를 제거한다.
- 프로젝트의 기존 result-aware 패턴인 `adminGetResult` 또는 현재 표준을 재사용한다.
- list 실패는 결과 영역을 명시적인 unavailable/error 상태로 바꾸고 동일한 URL을 다시 요청하는 `Retry`를 제공한다.
- summary만 실패했는데 목록을 안전하게 보여줄 수 있으면 목록은 유지하되 summary에 `Summary unavailable`을 표시한다. 0으로 대체하지 않는다.
- list와 summary를 합성할 때 서로 다른 요청의 부분 데이터로 그럴듯한 숫자를 만들지 않는다.
- 서버가 반환한 validation error는 운영자가 수정할 수 있는 문구로 화면에 표시한다.

#### B. 날짜 계약 통일

필터는 다음 하나의 모드만 사용한다.

- `All dates`
- `Today`
- `Last 7 days`
- `Last 30 days`
- `Custom`

구현 규칙:

- query parameter가 없으면 `All dates`다.
- `Custom`일 때만 From/To 입력을 노출하거나 활성화한다.
- Today/7d/30d/All로 바꾸면 이전 From/To 값을 제출하거나 URL에 남기지 않는다.
- Custom은 From과 To를 모두 요구한다.
- From > To를 자동으로 뒤집지 않는다. inline validation error를 표시하고 요청하지 않는다.
- 유효하지 않은 날짜, 한쪽만 있는 날짜, 기존 API 제한인 90일을 초과한 Custom 범위는 각각 명확한 inline error를 표시한다.
- 서버 필터, summary, 정렬, 화면의 `Sent` 값은 모두 `ChatMessage.createdAt`을 사용한다.
- 예약의 opened/created/updated/matched/closed/expires 시각을 메시지 날짜 필터에 사용하지 않는다.
- 현재 필터 query는 pagination과 transcript 왕복 후에도 보존한다.

권장 문구:

- 필터 label: `Message date`
- Custom 입력 label: `From`, `To`
- 결과 시각 열: `Sent`
- 정렬: `Newest sent`, `Oldest sent`

#### C. message-level 검색 계약

기존 `/admin/chat-archive`가 page 전용이고 다른 caller가 없다면 endpoint path를 유지하면서 최소 변경으로 message-level 응답으로 바꿔도 된다. 다른 caller가 있으면 호환성을 확인해 가장 작은 안전한 방법을 선택한다. 범용 검색 프레임워크나 별도 repository abstraction을 만들지 않는다.

각 결과는 최소한 다음 정보를 제공한다.

- message ID
- immutable body excerpt와 전체 본문 접근 가능 여부
- sender role과 표시 이름
- message `createdAt`
- attachment count 또는 attachment 존재 여부
- room ID
- booking ID와 읽을 수 있는 booking reference
- booking status와 service
- customer ID/name
- Partner ID/name
- full Booking Activity transcript 링크

검색 규칙:

- `q`는 메시지 본문과 운영자가 실제로 결과에서 확인 가능한 예약 reference/ID, 고객명, Partner명에 적용한다.
- 검색 가능한 필드는 결과 행 또는 직접 여는 row detail에서 확인 가능해야 한다.
- 전화번호를 검색 대상으로 계속 유지해야 할 명확한 기존 정책이 없다면 목록 검색에서 제거한다. 유지할 경우 결과에 번호를 노출하지 말고 그 이유와 테스트를 남긴다.
- 본문 검색 hit는 반드시 일치한 메시지 excerpt를 보여준다.
- entity 검색 hit도 반환되는 각 message body, sender, sent time을 보여준다.
- `sender=partner`는 Partner가 하나라도 참여한 room이 아니라 **Partner가 보낸 메시지만** 결과와 count에 포함한다.
- Customer/Partner/Admin-system 등 실제 저장된 sender role만 제공한다. 존재하지 않는 role을 UI에 만들지 않는다.
- `matchingMessages`는 정확히 필터를 만족한 메시지 수다.
- `roomsRepresented`는 해당 메시지가 속한 distinct room 수다.
- 기본 정렬은 message `createdAt desc`, 선택 정렬은 `asc`다.

#### D. pagination 정합성

- page는 message-level 결과를 server-side pagination한다.
- 현재의 bounded pagination과 API maximum을 유지한다. page-size selector 같은 새 기능은 추가하지 않는다.
- `page < 1`은 page 1로 canonicalize한다.
- `page > lastPage`는 마지막 유효 page URL로 redirect하거나 한 번 안전하게 재조회해 실제 마지막 page row를 표시한다.
- canonicalization 시 `q`, `sender`, `status`, `range`, `from`, `to`, `sort` 등 모든 독립 필터를 보존한다.
- URL, 선택된 page, rows, total, `Showing x–y`가 서로 모순되면 안 된다.
- total이 0이면 `Showing 0–0 of 0` 같은 기계적 문구 대신 적절한 empty state를 보여준다.

#### E. production 데이터 경계

- chat archive list와 summary가 동일한 기존 production-data predicate를 사용하게 한다.
- `audit_*`, `smoke_*`, `seed_*` 같은 이름 문자열만 임의로 제외하는 새 휴리스틱을 작성하지 않는다.
- 현재 코드베이스의 명시적인 production/test source 구분 helper를 재사용한다.
- predicate 적용 뒤 list, count, distinct room count가 동일한 모집단을 사용하도록 테스트한다.

#### F. 권한과 감사 기록

- `/chat-archive`, `/admin/chat-archive`, `/admin/chat-archive/summary` 및 새로 필요한 page-owned API의 권한을 `BOOKINGS_DETAIL` chat evidence 범위로 맞춘다.
- `CUSTOMERS_REVIEWS`만 가진 운영자는 전체 채팅 증거를 볼 수 없어야 한다.
- `BOOKINGS_DETAIL` 권한을 가진 운영자만 내비게이션과 페이지/API를 사용할 수 있어야 한다.
- 기존 operator access guard와 category 모델을 재사용하고 새로운 권한 체계를 만들지 않는다.
- list/search API는 actor, normalized filters, result count, timestamp를 기존 admin audit-log 패턴으로 기록한다.
- summary 요청이 같은 검색을 중복 감사하지 않도록 list/search 한 곳을 감사 주체로 정한다.
- Booking Activity full transcript의 기존 `booking.chat.view` 감사 기록은 유지한다.
- audit logging 실패를 어떻게 처리하는지는 기존 민감증거 접근 패턴을 따른다. 임의로 무시하지 않는다.

#### G. CSV와 민감정보

- `data:text/csv` href와 client-generated page-preview CSV를 완전히 제거한다.
- raw message body나 전화번호가 HTML href에 직렬화되지 않는지 테스트한다.
- 이번 작업에서 새 export endpoint, retention engine, legal hold, 대형 export job을 만들지 않는다.
- `master-progress-roadmap.md`의 retention/export 정책이 확정되기 전까지 UI에 export CTA를 노출하지 않는다.
- 전화번호, 앱 접속상태, 전체 메시지 본문은 기본 목록의 부가 메타데이터로 반복 노출하지 않는다.

### 6. P1 — 운영자 조사 효율

#### A. 상단 구조와 compact summary

상단은 다음 순서로 단순화한다.

1. 제목과 한 줄 설명
2. 민감도·읽기 전용 안내
3. 검색과 필터
4. compact result summary
5. message results

권장 문구:

- H1: `Chat Evidence Search`
- 설명: `Search retained booking messages across customers and Partners. Open the booking transcript for full context.`
- trust label: `Restricted internal evidence · Read only`
- 필터 heading: `Search retained messages`
- 검색 placeholder: `Search message, booking, customer or Partner`

현재의 `Rooms loaded`, `Messages`, `Completed rooms`, `Active rooms`, `Empty rooms`, `Latest message` 대형 카드 묶음은 제거한다. 다음처럼 한 줄 summary로 충분하다.

`258 matching messages · 242 rooms represented · Latest 5 Aug 2026, 18:41`

숫자가 unavailable이면 0으로 만들지 말고 unavailable을 표시한다. `room(s)`, `message(s)` 식 개발자 문구를 쓰지 않는다.

#### B. 필터 구성

필수 control만 유지한다.

- Search
- Sender
- Message date
- Custom From/To
- Booking status — 실제 예약 상태를 좁히는 유효한 기존 filter일 때만 유지
- Sort
- Apply
- Clear filters — 활성 filter가 있을 때만 표시

규칙:

- `Active`, `Completed`를 유지한다면 label을 `Booking status`로 명확히 한다.
- missing room, empty room, repair 상태는 검색 filter에서 제거하고 integrity/repair queue 책임으로 둔다.
- control은 visible label을 가져야 한다.
- 1024px에서 검색 + 나머지 control이 2–3열로 자연스럽게 reflow되어 값이 `A`처럼 잘리지 않아야 한다.
- URL은 공유 가능하고, control 하나를 바꿀 때 다른 filter가 사라지지 않아야 한다.

#### C. message-first 결과 구조

기본 읽기 순서는 다음과 같다.

1. `Sent`
2. `Matching message`
3. `People`
4. `Booking`
5. `Open transcript`

구현 기준:

- message excerpt가 행의 시각적·의미적 중심이다.
- 2–3줄 excerpt, sender role/name, attachment indicator를 함께 표시한다.
- People에는 고객과 Partner 이름을 표시하고 각 상세 링크를 유지한다.
- Booking에는 읽을 수 있는 reference, service, status를 표시한다.
- 짧은 ID가 충돌하거나 식별력이 없으면 기존 readable reference를 사용한다.
- 행의 primary action은 `Open transcript` 하나다.
- 이름 자체가 entity link라면 별도의 중복 Customer/Partner 버튼을 만들지 않는다.
- `Chat`과 `Booking`이 같은 URL을 가리키는 중복 action을 제거한다.
- 목록에서는 phone과 가짜 presence badge를 제거한다.
- full immutable message text와 attachment 원문은 기존 Booking Activity transcript에서 확인한다.
- attachment가 있으면 `Attachment 1`처럼 text를 함께 사용하고 아이콘이나 색만으로 표시하지 않는다.
- 1024×768과 1440×900에서 message excerpt와 `Open transcript`가 수평 스크롤 없이 보여야 한다.
- 기존 1,180px `min-width`를 이 화면에 강제하지 않는다. 전역 CSS를 약화시켜 다른 표를 깨뜨리지 말고 page-specific layout/class를 사용한다.
- CSS와 native responsive layout을 우선하고 JavaScript viewport 분기를 추가하지 않는다.

#### D. scroll 구조

- page, card, table에 세로 scroll이 겹치지 않게 한다.
- 기본 page scroll 하나를 유지한다.
- 핵심 message/action을 보기 위해 좌우와 상하를 번갈아 스크롤하게 만들지 않는다.
- 긴 본문, 긴 이름, 긴 service, 긴 booking reference는 wrapping/truncation과 accessible full value를 일관되게 처리한다.

#### E. 상태별 문구

다음 상태를 서로 다르게 표시한다.

1. 운영 데이터 자체가 없음: `No retained booking messages are available in this scope.`
2. filter/search 결과 없음: `No messages match the current search and filters.` + `Clear filters`
3. 잘못된 날짜: 해당 입력 가까이에 구체적인 validation error
4. list 불러오기 실패: `Chat evidence could not be loaded.` + `Retry`
5. summary만 실패: `Summary unavailable`을 표시하되 실제 rows가 있으면 유지
6. 권한 없음: 기존 access-denied 패턴 사용

`Clear filters or wait until matched bookings create chat rooms.`처럼 원인과 행동을 섞은 문구를 사용하지 않는다.

### 7. P2 — 접근성·문구·시각적 완성도

- heading 순서는 H1 → section heading으로 논리적으로 유지한다.
- 모든 form control은 placeholder나 `aria-label`만이 아니라 visible label을 가진다.
- filter validation은 해당 control과 programmatically 연결한다.
- result count와 error는 screen reader가 인지할 수 있는 기존 status/alert 패턴을 사용한다.
- sender, booking status, attachment는 색만으로 의미를 전달하지 않는다.
- 링크와 버튼의 이름은 목적지가 분명해야 한다. `Open` 대신 `Open transcript`를 쓴다.
- focus indicator를 제거하지 않는다.
- keyboard만으로 search → filters → results → transcript 이동이 가능해야 한다.
- transcript에서 돌아왔을 때 filter URL 문맥이 유지되어야 한다.
- 200% zoom에서 filter, excerpt, action, pagination을 사용할 수 있어야 하며 core content에 two-dimensional scrolling이 없어야 한다.
- 기존 admin typography, spacing, border, color token과 공용 component를 재사용한다.
- 새 UI library, icon package, design system, state library를 추가하지 않는다.
- 과도한 카드, gradient, 장식 애니메이션, KPI 색상 남용을 추가하지 않는다.

### 8. 반드시 보존할 동작

- Booking Activity의 full read-only transcript
- transcript의 attachment 표시와 접근제어
- 최대 200 message 제한과 truncated 신호
- 기존 `booking.chat.view` audit
- Booking, Customer, Partner 상세 링크
- 서버측 bounded pagination과 API maximum
- 현재 프로젝트의 admin auth, error, timestamp, badge, form component 패턴
- 관련 상세 페이지에서 `/chat-archive?q=...`로 진입하는 연결

상세 페이지 링크가 새 message-level 검색에서도 기대한 결과를 내는지 회귀 테스트한다.

### 9. 구현 경계

- 먼저 reuse 가능한 helper/component/audit/permission/error pattern을 찾는다.
- 같은 날짜·pagination root cause를 여러 page에서 공유할 때만 shared helper를 수정한다. 모든 caller를 검사하고 관련 회귀 테스트를 실행한다.
- 다른 화면까지 바꾸는 broad CSS 수정은 피한다.
- 새 패키지, 범용 검색 엔진, generic repository layer, export infrastructure, retention engine, background job을 추가하지 않는다.
- Prisma의 기존 필드로 충분하면 migration을 만들지 않는다.
- schema 변경이 정말 필요하다고 현재 코드가 입증하지 않는 한 `schema.prisma`와 migration을 건드리지 않는다.
- 채팅 메시지를 수정·삭제하는 admin action을 만들지 않는다.
- 내부 provider 타입을 user-facing `Partner` 문구 때문에 전역 rename하지 않는다.
- unrelated formatter를 실행하거나 unrelated dirty file을 stage하지 않는다.
- 사용자가 요청하지 않았으므로 commit하지 않는다.
- protected area를 건드리게 되면 `AGENTS.md`의 추가 검증 규칙을 따른다.

### 10. 최소 테스트 요구사항

현재 테스트 스타일을 재사용하고 새 test framework를 추가하지 않는다. 아래 동작을 증명하는 가장 작은 focused test를 작성하거나 수정한다.

#### Admin Web

1. missing `range`는 All dates다.
2. Today/7d/30d/All로 변경할 때 stale From/To가 URL/API 요청에서 제거된다.
3. Custom은 From/To를 모두 요구한다.
4. reversed, invalid, incomplete, 90일 초과 Custom 범위는 inline error이며 0건으로 보이지 않는다.
5. pagination이 모든 filter와 sort를 보존한다.
6. page 999가 마지막 유효 page로 canonicalize되고 실제 rows를 다시 표시한다.
7. list 실패는 zero/empty state가 아니다.
8. summary 실패는 0 metrics가 아니다.
9. 검색 hit 결과에 matching excerpt, sender, sent time이 표시된다.
10. Customer/Partner phone과 가짜 app presence가 기본 row에 없다.
11. client `data:` CSV와 export CTA가 없다.
12. message-first column/order와 `Open transcript` action이 존재한다.
13. empty data, no-match, invalid filter, error 상태의 문구가 서로 다르다.
14. page-specific layout이 1,180px forced table 또는 nested vertical scroll에 의존하지 않는다.
15. `/chat-archive` operator category와 nav visibility가 `BOOKINGS_DETAIL`과 일치한다.

#### API

16. 날짜 filtering/sorting이 `ChatMessage.createdAt`을 사용한다.
17. query가 본문 hit의 실제 message를 반환한다.
18. entity query hit도 반환 message의 context와 body를 제공한다.
19. `sender=partner`의 rows와 count가 Partner message만 포함한다.
20. matching message count와 distinct rooms represented가 동일한 predicate를 사용한다.
21. newest/oldest가 message sent time 기준으로 정확하다.
22. attachment indicator가 기존 attachments 데이터를 변경하지 않고 계산된다.
23. production-data predicate가 list와 summary 모두에 적용된다.
24. `CUSTOMERS_REVIEWS`만 가진 actor는 거부되고 `BOOKINGS_DETAIL` actor는 허용된다.
25. search audit가 actor, normalized filters, result count, timestamp를 기록한다.
26. summary가 동일한 access event를 중복 기록하지 않는다.
27. message 본문과 양측 전화번호를 직렬화한 client CSV contract가 제거된다.

#### 회귀

28. Booking Activity full transcript, attachment, 200-message/truncated, read audit가 유지된다.
29. Booking/Customer/Partner 상세에서 chat archive 검색 링크가 계속 동작한다.
30. shared date, permission, CSS helper를 수정했다면 모든 caller의 관련 focused spec이 통과한다.

테스트가 기존 잘못된 동작인 Today default, latest-message-only room preview, sender room predicate를 기대하고 있다면 테스트를 삭제하지 말고 새 계약에 맞게 수정한다.

### 11. 검증 명령

먼저 가장 가까운 spec만 실행한다. 현재 package script를 확인해 정확한 명령을 선택하고, 없는 명령을 지어내지 않는다.

최소 검증 범위:

- chat archive Admin Web page/model specs
- chat archive API controller/service/query specs
- operator access/permission/navigation specs
- full transcript 관련 regression specs
- 변경한 파일의 typecheck/lint 또는 해당 workspace 검증
- `npm.cmd run verify:scope -- -Scope admin`
- `npm.cmd run verify:scope -- -Scope api`

shared helper나 protected area 변경으로 `AGENTS.md`가 full local verification을 요구할 때만 그 검증을 추가한다. 실패한 검증은 숨기지 말고 원인이 이번 변경인지 기존 dirty worktree인지 구분한다.

UI 파일 수정이 끝나면 한 번만 다음 detector를 변경 target에 실행하고 결과를 처리한다.

```powershell
node C:\Users\laboy\.codex\skills\impeccable\scripts\detect.mjs --json <changed UI targets>
```

검증을 통과하지 않았는데 완료했다고 보고하지 않는다.

### 12. 실제 브라우저 QA

이미 실행 중인 로그인된 관리자 앱이 있으면 그 세션을 사용한다. 실제 데이터 변경, 채팅 수정·삭제, CSV 다운로드는 하지 않는다.

최소 확인 URL/state:

- `/chat-archive`
- `?range=today`
- `?range=7d`
- `?range=30d`
- 화면에서 Today → All dates 변경
- valid Custom range
- Custom From only / To only
- reversed Custom range
- 90일 초과 Custom range
- 본문 hit `?range=all&q=cancellation` 또는 현재 데이터에서 검증 가능한 검색어
- entity/booking hit
- guaranteed no-match query
- `?range=all&sender=partner`
- `?range=all&page=999`
- first/middle/last page
- attachment가 있는 결과와 없는 결과
- transcript 열기와 뒤로 가기 후 filter 보존

viewport:

- 1024×768
- 1280×720
- 1440×900
- 브라우저 200% zoom 또는 동등한 접근성 확인

각 상태에서 다음을 확인한다.

- All dates에 stale From/To가 남지 않는다.
- count, rows, summary, range text, selected page, URL이 일치한다.
- matching message와 sender가 실제 검색 조건을 설명한다.
- Partner filter에 Customer message가 섞이지 않는다.
- message excerpt와 `Open transcript`가 horizontal scroll 없이 보인다.
- page/card/table의 nested vertical scroll이 없다.
- phone, 가짜 presence, client CSV href가 노출되지 않는다.
- keyboard focus가 보이고 필터와 result action을 사용할 수 있다.
- console에 새 warning/error가 없다.

스크린샷은 다음 폴더에 저장한다.

`C:\dev\massage-on-demand-vn\output\chat-archive-improvement-verification-2026-08-06\`

최소 캡처:

1. All dates 기본 화면 1440
2. message-first 결과 1024
3. message-first 결과 1440
4. valid Custom
5. invalid/reversed Custom
6. 본문 검색 hit
7. Partner sender filter
8. no-match
9. canonicalized last page
10. transcript 진입 전후 filter 문맥

브라우저 QA 중 API failure를 인위적으로 만들 필요는 없다. 오류 상태는 focused test로 검증하고, 실제로 재현하지 못했음을 최종 보고한다.

### 13. 완료 판정 기준

다음 항목이 모두 충족돼야 완료다.

- base URL과 Clear filters가 실제 All dates 결과를 사용한다.
- UI에서 All dates로 전환했을 때 stale dates가 제거된다.
- date filter, sort, summary, `Sent`가 모두 `ChatMessage.createdAt` 기준이다.
- invalid/reversed/incomplete/too-long Custom range가 구체적인 error로 표시된다.
- API 실패가 zero data로 보이지 않는다.
- 검색 결과의 중심에 실제 matching message, sender, sent time이 보인다.
- Partner sender filter의 rows/count/summary가 Partner messages만 나타낸다.
- page 999가 canonical URL과 실제 마지막 rows로 보정된다.
- 기본 운영 결과에 test/audit/smoke/seed fixture가 섞이지 않는다.
- Web/API/nav 권한이 `BOOKINGS_DETAIL` chat evidence 경계와 일치한다.
- search access audit가 남고 full transcript read audit가 유지된다.
- client data-URI export가 없어지고 새 export는 만들지 않았다.
- 기본 목록에 phone과 오해를 부르는 presence가 없다.
- attachment 유무를 알 수 있고 full transcript의 attachment가 계속 동작한다.
- 1024×768과 1440×900에서 message/action을 수평 스크롤 없이 볼 수 있다.
- nested vertical scroll이 없다.
- empty/no-match/validation/error가 서로 다른 상태와 문구를 가진다.
- 관련 focused tests, Admin scope, API scope 검증이 통과한다.
- 브라우저 console에 새 warning/error가 없다.
- 검증 스크린샷이 지정 폴더에 저장됐다.

### 14. 최종 보고 형식

확인된 사실만 다음 heading으로 보고한다.

1. **Implemented** — P0/P1/P2별 실제 완료 항목
2. **Changed files** — 절대 경로와 변경 이유
3. **Tests and verification** — 실행한 정확한 명령, pass/fail, test count
4. **Browser QA** — 확인 URL/state, viewport, console 결과
5. **Screenshots** — 절대 경로
6. **Permissions and audit** — 최종 category, 거부/허용 테스트, audit event
7. **Protected areas** — 건드린 영역과 요구된 검증
8. **Preserved user changes** — overlapping dirty files를 어떻게 보호했는지
9. **Remaining risks / deferred** — 실제 미완료만 기록. 특히 retention/export 정책과 별도 chat integrity queue

테스트나 브라우저 검증을 건너뛰었다면 `완료`라고 하지 말고, 정확히 무엇을 왜 확인하지 못했는지 적는다. 구현 전 계획을 최종 답으로 대신하지 않는다.

---

## 이 프롬프트가 잠그는 핵심 기준

- **운영 신뢰:** 화면 숫자와 실제 query 의미가 일치해야 한다.
- **증거 중심:** room metadata보다 matching message가 먼저 보여야 한다.
- **최소 권한:** 리뷰 권한으로 전체 대화가 열리지 않아야 한다.
- **개인정보 최소화:** 전화번호·message body가 불필요하게 목록과 HTML export href에 복제되지 않아야 한다.
- **정책 선행:** retention/export 정책이 없는 상태에서 새 export를 만들지 않는다.
- **단일 책임:** 글로벌 검색은 이 페이지, full transcript는 Booking Activity, repair는 Booking queue가 담당한다.
- **검증 가능성:** 각 요구사항은 focused test나 실제 브라우저 상태로 판정할 수 있어야 한다.
- **최소 구현:** 기존 helper·permission·audit·error pattern을 재사용하고 새 인프라나 추상화를 만들지 않는다.
