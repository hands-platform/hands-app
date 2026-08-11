# Chat Evidence Search 개선 후 잔여 문제 수정용 Codex 프롬프트

아래 전체 내용을 새 Codex 작업에 그대로 붙여 넣어 실행한다.

---

## 역할

너는 HANDS 관리자 웹의 운영 UX와 증거 검색 신뢰성을 수정하는 senior full-stack engineer다. 이번 작업은 새 디자인을 만드는 일이 아니라, 이미 크게 개선된 `Chat Evidence Search`의 **잔여 운영 결함만 좁고 안전하게 수정하는 작업**이다.

계획이나 제안만 제출하지 말고 현재 코드를 직접 조사하고 수정하고 테스트하고 실제 브라우저로 검증한 뒤 완료 결과를 보고하라.

## 작업 위치와 기준 문서

- 반드시 작업할 저장소: `C:\dev\massage-on-demand-vn`
- 사용 금지: `C:\dev\massage-vn-workspace`
- 먼저 읽을 파일:
  1. `C:\dev\massage-on-demand-vn\AGENTS.md`
  2. `C:\dev\massage-on-demand-vn\output\chat-archive-post-implementation-audit-2026-08-07\chat-archive-post-implementation-deep-audit.md`
  3. 현재 `apps/admin_web/app/chat-archive/**` 전체
  4. 관련 Admin Web component, API route/service/select, permission, audit, production-data predicate와 관련 spec
- 이전 감사 스크린샷:
  - `C:\dev\massage-on-demand-vn\output\chat-archive-post-implementation-audit-2026-08-07\01-base-1440.jpg`
  - `...\02-results-table-1440.jpg`
  - `...\04-body-search-1440.jpg`
  - `...\05-partner-sender-1440.jpg`
  - `...\06-custom-incomplete-1440.jpg`
  - `...\07-no-match-1440.jpg`
  - `...\08-base-1600.jpg`
  - `...\09-dark-1600.jpg`
  - `...\10-transcript-destination-1600.jpg`

감사 보고서를 요구사항으로 사용하되 line number가 현재 코드와 달라졌다면 현재 코드와 `rg` 결과를 우선한다.

## 절대 작업 원칙

1. 단일 agent로만 작업한다. subagent, worker, multi-agent 도구를 사용하지 않는다.
2. 현재 working tree는 이미 매우 dirty하다. 기존 수정은 사용자 작업으로 간주한다.
3. 시작할 때 `git status --short`와 대상 파일의 `git diff`를 확인한다.
4. unrelated 변경을 되돌리거나 포맷하거나 stage하지 않는다.
5. overlapping dirty file은 전체 덮어쓰기를 하지 말고 필요한 줄만 최소 patch한다.
6. 사용자가 요청하지 않았으므로 commit하지 않는다.
7. 실제 운영 데이터의 생성·수정·삭제·내보내기를 하지 않는다.
8. 실제 브라우저 QA는 GET 검색, 필터, 페이지 이동, 읽기 전용 transcript 열기와 돌아오기만 허용한다.
9. DB schema/migration, auth, wallet, payment, settlement, matching, shared types, infra를 수정하지 않는다.
10. 새 UI library, date-picker, state library, 검색 library, icon package를 추가하지 않는다.
11. 기존 Admin component, token, native date input, URL 기반 GET 검색, permission/audit pattern을 재사용한다.
12. phone, raw coordinate, push token 등 민감정보를 Chat Evidence 목록에 다시 추가하지 않는다.
13. CSV/data URI export 또는 새 export backend를 만들지 않는다.
14. 채팅 메시지를 수정·삭제하는 Admin action을 만들지 않는다.
15. 내부 타입은 provider 명칭을 유지할 수 있지만 사용자 노출 문구는 `Partner`를 사용한다.

## 데스크톱 화면 범위

- 검사·수정·완료 판정 viewport는 **1440×900과 1600×900만** 사용한다.
- 1024px 이하, 모바일, 태블릿, 200% zoom 반응형은 이번 작업에서 검사하거나 보고하지 않는다.
- 기존 작은 화면 CSS를 일부러 제거하지는 말되, 이번 요구사항을 위해 작은 화면용 새 설계나 breakpoint를 추가하지 않는다.
- 전역 Admin shell이나 다른 페이지를 바꿔 1440 레이아웃을 맞추지 않는다. Chat Evidence page 범위 CSS를 우선한다.

## 현재 잘된 동작 — 반드시 보존

다음은 이미 수정 완료된 계약이다. 회귀시키지 않는다.

- base `/chat-archive`는 All dates / Newest sent다.
- 날짜 기준은 Booking lifecycle이 아니라 `ChatMessage.createdAt`이다.
- 한 결과 행은 한 matching message다.
- message body, sender role, sent time, room/message reference, attachment count가 보인다.
- `sender=partner`는 Partner message만 반환하고 count에도 Customer message가 섞이지 않는다.
- API 실패, invalid date, no data, no match가 기본적으로 분리돼 있다.
- out-of-range page는 실제 마지막 page URL과 rows로 redirect된다.
- production-data predicate가 list/summary에 적용된다.
- Web/API permission은 `BOOKINGS_DETAIL` 범위다.
- list search는 `booking.chat.search` audit을 남긴다.
- client CSV/data URI와 기본 목록 phone이 없다.
- 1440·1600에서 수평 스크롤과 중첩 세로 스크롤이 없다.
- `Open transcript`가 Booking Activity의 `#booking-chat-history`로 이동한다.
- transcript의 `returnTo`가 원래 검색 URL을 보존한다.
- full transcript, attachment, read audit, message limit/truncation 계약은 유지된다.

## 이번 작업의 우선순위

### Phase 1 — 반드시 수정: 운영 오판 방지

#### 1. 잘못된 missing-room 연결 제거

현재 다음 코드가 `/chat-archive?status=missing-room`을 만든다.

- `apps/admin_web/lib/booking-closeout-checklist-rows.ts`
- `apps/admin_web/app/operations-policy/policy-impact-details.ts`

하지만 Chat Evidence는 message search이며 missing room은 message가 존재하지 않아 이 화면에서 검색할 수 없다. 현재 URL은 화면에서 조용히 All statuses 전체 검색으로 풀린다.

구현 요구사항:

1. 위 두 stale link를 실제 repair queue인 `/bookings?view=chat-repair`로 변경한다.
2. user-facing label도 목적지와 일치하게 유지한다. `Chat archive repair`가 부정확하면 기존 프로젝트 문구 패턴을 찾아 `Chat repair queue` 또는 동등한 운영 문구로 정리한다.
3. Chat Evidence status option에 `missing-room`을 다시 추가하지 않는다.
4. `/chat-archive?status=missing-room` 같은 unknown status가 전체 검색으로 조용히 보이지 않도록 canonical URL로 redirect한다.
5. 두 dirty 파일의 다른 사용자 변경은 보존한다.

완료 기준:

- 두 연결 지점 모두 `/bookings?view=chat-repair`로 이동한다.
- `/chat-archive?status=missing-room`은 `/chat-archive` 또는 유효 필터만 남은 canonical URL로 redirect된다.
- route/model/link focused test가 이 동작을 증명한다.

#### 2. unknown query와 page를 일관되게 canonicalize

현재 allowed 값이 아닌 status/sender/range가 내부적으로 기본값으로 바뀌어도 raw URL에는 남을 수 있다. `page=abc`, `page=1.5`도 같은 문제가 있다.

구현 요구사항:

- status allowed values: empty, `active`, `completed`, `closed`
- sender allowed values: empty, `customer`, `partner`, `admin`
- range allowed values: empty/All dates, `today`, `7d`, `30d`, `custom`
- sort allowed values: empty/Newest, `newest`, `oldest`
- page는 `/^[1-9]\d*$/`에 맞는 양의 정수만 유효하다.
- raw 값과 normalized 값이 의미상 다르면 유효한 필터만 보존한 canonical page 1 URL로 redirect한다.
- `q`와 valid custom dates는 보존한다.
- `page > totalPages`의 기존 마지막 페이지 redirect를 유지한다.
- redirect loop가 없어야 한다.

검색어 길이 제한은 기존 Admin query limit pattern을 먼저 찾는다. 이미 공용 계약이 있으면 재사용한다. 없다면 이번 작업에서 임의 숫자를 발명해 새 전역 정책을 만들지 말고 remaining risk로 남긴다.

테스트해야 할 URL:

- `?status=missing-room`
- `?sender=provider`
- `?range=year`
- `?sort=random`
- `?page=0`
- `?page=abc`
- `?page=1.5`
- valid filter + invalid page 조합

#### 3. Custom 기간을 한 번의 제출로 사용할 수 있게 수정

현재 From/To는 server render의 `range === custom` 조건에서만 생기므로 기본 화면에서 Custom을 선택하면 먼저 invalid submit을 해야 한다.

구현 요구사항:

1. 기존 `AdminFormSelect`, `AdminFormDate`, native date input을 재사용한다.
2. 가장 작은 client component 하나로 `Message date`와 Custom From/To 표시 상태만 관리한다.
3. 기본 All/Today/7d/30d를 Custom으로 바꾸는 즉시 From/To가 나타나야 한다.
4. Custom에서 preset으로 바꾸면 stale From/To가 제출되거나 URL에 남지 않아야 한다.
5. valid Custom은 날짜 입력 후 한 번의 Apply로 결과가 나와야 한다.
6. direct URL 요청은 서버 validation을 계속 거쳐야 한다. client `required`만 믿지 않는다.
7. 빈 값, 한쪽만 입력, invalid date, reversed range, 90일 초과는 각각 검색 API를 호출하지 않는다.
8. helper text로 `Custom range: maximum 90 days.` 또는 현재 copy style에 맞는 명확한 제한 안내를 보여준다.
9. validation 상태에서는 결과 영역에 `No matching messages`를 표시하지 않는다.
10. 대신 다음처럼 검색 미실행 상태를 사용한다.
    - title: `Search not run`
    - message: `Complete a valid From and To date to search retained messages.`
11. `No search request was sent` 문구와 의미가 중복되지 않게 한 곳으로 정리한다.

keyboard 순서는 Message date → From → To → Sort → Apply가 자연스러워야 하며 visible label, `aria-invalid`, `aria-describedby`, alert 연결을 유지한다.

#### 4. retention 정책 미정 상태를 정직하게 표현

Codex가 retention 기간, legal hold, 삭제 시점 또는 attachment 보존 정책을 임의로 결정해서는 안 된다. 이번 구현에서 persistence, cron, migration, 삭제 job을 만들지 않는다.

정책이 아직 미정이면 다음 안전한 UI copy만 반영한다.

- base empty state: `No retained booking messages are available in this scope.`
- no-match state: `No messages match the current search and filters.`
- evidence absence helper: `A missing result does not confirm that no conversation occurred.`

이 helper는 no-data/no-match 근처 한 곳에만 표시하고 모든 행이나 카드에 반복하지 않는다. `docs/architecture/master-progress-roadmap.md`의 정책 미정 상태를 완료로 바꾸지 않는다. retention policy 자체는 최종 보고의 deferred 항목으로 남긴다.

### Phase 2 — 반드시 수정: 운영 속도와 정보 위계

#### 5. 1440 첫 화면에서 실제 결과가 보이도록 밀도 개선

현재 1440×900 계측:

- filter panel 높이 약 271px
- table header 시작 `y≈820`
- 첫 data row 시작 `y≈860`

운영자는 매번 스크롤해야 실제 메시지를 읽는다.

구현 요구사항:

1. 기본 All dates / Newest first는 control 값으로는 유지하되 active filter chip에는 표시하지 않는다.
2. active filter chip은 실제 비기본 상태만 표시한다.
   - q
   - non-empty sender/status
   - date range가 All이 아닐 때
   - sort가 Oldest일 때
3. 정상 상태에서 filter panel의 `10 messages shown` badge를 제거하거나 숨긴다. error/validation badge만 유지할 수 있다.
4. `10 shown`, summary total, pagination range의 중복을 줄인다.
5. 정상 count는 `Matching messages` header/summary와 pagination footer 중심으로 표시한다.
6. summary 3개 값은 결과 section header 근처로 합쳐 불필요한 별도 vertical strip을 줄인다.
7. Apply/Clear가 별도 full-width 높이를 과도하게 만들지 않도록 마지막 control과 같은 compact action area에 둔다.
8. page description, trust line, results description에서 반복되는 `Booking Activity/full transcript` 안내는 한 번의 명확한 설명으로 줄인다.
9. `Restricted internal evidence · Read only` 의미는 반드시 유지한다.
10. 전역 shell이나 다른 Admin page spacing을 바꾸지 않는다.

완료 목표:

- 1440×900, `scrollY=0`에서 table header와 최소 1개 full data row가 보인다.
- 가능한 경우 두 번째 row의 시작도 보이게 한다.
- 위 목표를 위해 label, validation, read-only 안내 또는 기본 접근성을 제거하지 않는다.
- 1600×900에서는 모든 열과 action이 안정적으로 유지된다.

#### 6. message body를 행의 시각적 1순위로 변경

현재 sender name이 굵고 message body가 일반 text여서 증거보다 인물명이 먼저 읽힌다.

구현 요구사항:

- message body 또는 `Attachment-only message`를 primary text로 표시한다.
- sender name은 secondary metadata로 내린다.
- Sent 열의 sender role badge와 People 열의 인물 링크를 유지하되 불필요한 동일 문구 반복을 줄인다.
- 본문은 최대 3줄 clamp를 유지하고 long word를 안전하게 wrap한다.
- attachment count는 계속 visible text로 제공한다.
- sender/status/attachment 의미를 색만으로 전달하지 않는다.

#### 7. Booking reference 줄바꿈과 중복 transcript 링크 제거

현재 full Booking ID가 좁은 열에서 한 글자만 다음 줄로 내려가며 Booking ID와 `Open transcript`가 같은 href다.

구현 요구사항:

1. 현재 저장소의 ID display/copy component 또는 helper를 먼저 찾는다.
2. 있다면 재사용한다.
3. 없다면 page-local의 가장 작은 표시 방식을 사용한다.
   - visible reference는 충돌 가능성을 낮춘 10–12자 또는 기존 Admin readable reference pattern
   - full ID는 `title`, accessible name, 또는 기존 copy affordance로 확인 가능
4. 새 범용 ID component를 만들지 않는다.
5. `Open transcript`를 유일한 transcript navigation action으로 유지한다.
6. Booking reference는 동일 목적지의 두 번째 링크로 만들지 않는다.
7. service와 booking status는 계속 보인다.

완료 기준:

- 1440에서 reference가 예측할 수 없는 글자 단위로 깨지지 않는다.
- 한 행에서 동일 transcript URL 링크는 하나다.
- full ID를 확인하거나 복사할 수 있는 접근 가능한 방법이 남는다.

#### 8. 검색 일치 텍스트를 안전하게 강조

현재 q는 body, message ID, room ID, booking ID, Customer/Partner 이름·ID, service name을 검색하지만 UI는 일치 이유를 강조하지 않는다.

구현 요구사항:

1. visible field에 q가 포함되면 해당 substring을 `<mark>`로 강조한다.
2. `dangerouslySetInnerHTML`을 사용하지 않는다.
3. 새 highlight/search package를 추가하지 않는다.
4. case-insensitive match를 사용하되 원문 casing은 보존한다.
5. q가 비어 있으면 현재 rendering과 동일해야 한다.
6. body, sender/customer/Partner name, booking reference, room/message reference, service 중 실제로 화면에 표시되는 값에만 적용한다.
7. 현재 API predicate와 다른 새로운 “match count”를 client에서 계산하지 않는다.
8. backend response에 match reason field를 추가하는 대규모 API 변경은 하지 않는다. 현재 visible data로 충분하다.
9. light/dark mode에서 `<mark>`의 text/background 대비를 기존 token으로 확보한다.

테스트:

- body hit
- Customer name hit
- Partner name hit
- booking ID hit
- service hit
- no q
- regex 특수문자가 포함된 q도 안전하게 plain text로 처리

#### 9. normal/no-match/validation/error 문구 중복 제거

정상 화면에서 동일한 visible row count를 세 번 반복하지 않는다. no-match에서 `0` 상태를 네 번 반복하지 않는다.

권장 계약:

- 정상: 결과 header summary + footer range
- no-match: `No matching messages` + 한 문장 + `Clear filters`
- base no-data: `No retained messages` + retention caution 한 문장
- validation: `Search not run` + 구체적인 date error
- list failure: `Chat evidence could not be loaded` + Retry
- summary partial failure: rows 유지 + `Summary unavailable`
- permission failure: 기존 Booking Detail access denied pattern

`Clear filters`는 no-match state 가까이에서도 발견 가능해야 하지만 같은 링크를 과도하게 반복하지 않는다.

### Phase 3 — 검증 후에만 수정

#### 10. 다크 모드 muted text 대비

- 먼저 현재 computed color 대비를 측정한다.
- 일반 크기 metadata가 4.5:1 미만일 때만 Chat Evidence page 범위 selector로 소폭 보정한다.
- 전역 `--admin-muted` token은 수정하지 않는다.
- 이미 기준을 충족하면 코드 변경 없이 검증 결과만 보고한다.

#### 11. Booking transcript hydration mismatch

`Open transcript` 도착 시 Booking Detail의 `<details open>` server/client hydration mismatch가 관찰됐다.

- 먼저 현재 코드와 focused reproduction으로 root cause를 확인한다.
- Chat Evidence return/hash 흐름이 원인인지, 기존 Booking Detail disclosure 문제인지 구분한다.
- 가장 가까운 shared helper 한 곳에서 확실히 수정할 수 있고 관련 caller 회귀 테스트를 실행할 수 있을 때만 수정한다.
- broad Booking Detail refactor, 전역 disclosure 변경, hydration suppress는 하지 않는다.
- 이번 범위에서 안전한 root fix가 아니면 정확한 console error와 후보 파일을 remaining risk로 남긴다.

#### 12. list/summary API 통합 또는 summary audit

이번 작업에서 기본적으로 **defer**한다.

- 현재 list/summary 구조가 기능하고 permission guard가 정렬돼 있다.
- 단순히 보고서에 언급됐다는 이유로 paginated response schema, DTO, controller, service를 광범위하게 재설계하지 않는다.
- summary에 audit을 추가해 한 화면 조회당 audit 두 건이 생기게 하지 않는다.
- 직접 summary 호출의 감사 요구와 한 사용자 검색 행동당 단일 audit event 계약을 먼저 문서로 결정해야 한다.
- 현재 작업에서는 기존 list의 `booking.chat.search`가 유지되는지만 regression test한다.
- 명백한 권한 우회나 민감정보 노출을 발견한 경우에만 최소 root fix를 하고 이유를 보고한다.

## 예상 주요 수정 파일

현재 코드를 확인한 후 필요한 파일만 수정한다. 예상 후보:

- `apps/admin_web/app/chat-archive/page.tsx`
- `apps/admin_web/app/chat-archive/chat-archive-page-model.ts`
- `apps/admin_web/app/chat-archive/page.spec.tsx`
- `apps/admin_web/app/chat-archive/chat-archive-page-model.spec.ts`
- Custom date control용 page-local client component와 가장 가까운 focused spec
- `apps/admin_web/app/globals.css`의 Chat Evidence 전용 selector
- `apps/admin_web/lib/booking-closeout-checklist-rows.ts`
- 해당 link model spec
- `apps/admin_web/app/operations-policy/policy-impact-details.ts`
- 해당 policy/link spec

API 변경은 이번 잔여 UI/URL 문제에 필요하다는 증거가 있을 때만 한다. 이미 올바른 message predicate, production filter, permission, audit select를 다시 작성하지 않는다.

## 최소 테스트 요구사항

현재 Vitest와 기존 test helper를 재사용한다. 새 framework나 E2E infrastructure를 추가하지 않는다.

### Chat Archive model/page

1. base는 All dates/Newest이며 기본 chip이 없다.
2. non-default filter만 active summary에 보인다.
3. unknown status/sender/range/sort가 canonical URL로 redirect된다.
4. page 0/abc/1.5가 canonical page 1 URL로 redirect된다.
5. valid filters는 redirect 중 보존된다.
6. page > totalPages는 마지막 valid page와 rows로 보정된다.
7. Custom 선택 시 From/To가 즉시 나타난다.
8. Custom → preset 전환 시 From/To가 제출되지 않는다.
9. valid Custom은 한 번의 submit으로 검색된다.
10. incomplete/invalid/reversed/90일 초과 Custom은 API를 호출하지 않는다.
11. validation state는 `Search not run`이며 `No matching messages`가 아니다.
12. no-match, no-data, list error, partial summary failure 문구가 서로 다르다.
13. normal/zero count 문구가 불필요하게 반복되지 않는다.
14. message body가 primary hierarchy다.
15. 한 행에 transcript 목적지 링크가 하나다.
16. full Booking ID 접근성은 유지되며 visible reference가 깨지지 않는다.
17. q highlight가 body/name/booking/service/plain-special-character 입력에서 안전하다.
18. phone, client CSV/data URI, fake app presence가 다시 생기지 않는다.

### 연결 링크

19. booking closeout checklist의 repair link가 `/bookings?view=chat-repair`다.
20. operations policy의 repair link가 `/bookings?view=chat-repair`다.
21. `/chat-archive?status=missing-room`을 만드는 production link가 더 이상 없다.

### API/권한 회귀

22. Partner sender query는 Partner message만 반환한다.
23. date filter/sort는 `ChatMessage.createdAt` 기준이다.
24. production-data predicate가 유지된다.
25. list search audit가 actor/filters/resultCount/time을 기록한다.
26. `BOOKINGS_DETAIL` permission 계약이 유지된다.
27. select/serialized result에 phone이 없다.

### Transcript 회귀

28. `Open transcript`에 현재 Chat Evidence URL이 `returnTo`로 보존된다.
29. `#booking-chat-history`로 이동한다.
30. full transcript/attachment/read audit/message limit 계약이 유지된다.

## 검증 명령

명령은 실제 package script를 먼저 확인한 후 실행한다. 최소한 다음 범위를 검증한다.

```powershell
npm.cmd run test --workspace @massage-vn/admin-web -- app/chat-archive/page.spec.tsx app/chat-archive/chat-archive-page-model.spec.ts
npm.cmd run test --workspace @massage-vn/api -- src/admin/admin.service.spec.ts --testNamePattern "chat evidence|matching messages|custom message date range"
npm.cmd run test --workspace @massage-vn/api -- src/admin/admin.controller.spec.ts --testNamePattern "chat archive"
npm.cmd run typecheck --workspace @massage-vn/admin-web
npm.cmd run typecheck --workspace @massage-vn/api
```

수정한 정확한 파일을 각 workspace cwd에서 scoped ESLint로 검사한다.

```powershell
npx.cmd eslint app/chat-archive/page.tsx app/chat-archive/chat-archive-page-model.ts <추가한 Admin Web 파일>
npx.cmd eslint src/admin/admin-chat-archive-selects.ts src/admin/admin-booking.routes.ts
```

그 다음 저장소 지침에 따라 다음을 실행한다.

```powershell
npm.cmd run verify:scope -- -Scope admin
npm.cmd run verify:scope -- -Scope api
```

protected area를 실제로 수정했거나 `AGENTS.md`가 full verification을 요구하는 경우에만 추가 검증을 실행한다. unrelated 기존 실패는 숨기지 말고 이번 변경과 분리한다.

UI 수정이 끝난 후 한 번만 detector를 실행한다.

```powershell
node C:\Users\laboy\.codex\skills\impeccable\scripts\detect.mjs --json <실제로 변경한 UI target>
```

detector가 `globals.css`의 다른 페이지 코드를 지적하면 실제 Chat Evidence selector와 관련 있는지 확인하고 false positive를 구분한다.

## 실제 브라우저 QA

로그인된 in-app browser 세션이 있으면 재사용한다. 로그인 정보, cookie, local storage, token을 읽거나 출력하지 않는다.

### viewport

- 1440×900
- 1600×900

1024px 이하, 모바일, 태블릿, 200% zoom 검사는 하지 않는다.

### 필수 상태

1. `/chat-archive`
2. `?q=Realtime` 또는 현재 데이터에서 검증 가능한 body hit
3. Customer/Partner name hit
4. booking ID hit
5. service hit
6. guaranteed no-match query
7. `?sender=partner`
8. `?range=today`
9. `?range=7d`
10. `?range=30d`
11. UI에서 All dates → Custom 선택, 날짜 입력, 한 번에 Apply
12. Custom → preset 전환
13. incomplete Custom direct URL
14. reversed Custom direct URL
15. 90일 초과 Custom direct URL
16. `?status=missing-room`
17. unknown sender/range/sort
18. page 0/abc/1.5/999
19. first/middle/last page
20. Open transcript → chat history anchor → Back to Chat Evidence Search
21. light mode
22. dark mode

### 화면에서 확인할 것

- 1440 첫 화면에 최소 1개의 full data row가 보인다.
- filter/summary/result count가 중복되지 않는다.
- 기본 All dates/Newest chip이 없다.
- 비기본 필터만 chip으로 보인다.
- Custom 입력이 첫 submit 전에 나타난다.
- validation state가 no-match로 보이지 않는다.
- unknown query가 canonical URL로 정리된다.
- missing-room 업무가 Chat repair queue로 간다.
- message body가 sender name보다 먼저 읽힌다.
- 검색 일치 text가 안전하게 강조된다.
- Booking reference가 이상하게 한 글자 단위로 깨지지 않는다.
- 한 row에 동일 transcript 링크가 두 개 없다.
- phone/CSV/fake presence가 없다.
- 수평 스크롤과 중첩 세로 스크롤이 없다.
- 1600에서 모든 열과 action이 보인다.
- dark mode muted text가 판독 가능하다.
- keyboard focus와 visible label이 유지된다.
- Chat Evidence 자체 console warning/error가 없다.
- transcript destination hydration error를 수정했다면 error가 사라졌고, defer했다면 정확히 기록한다.

## 스크린샷 저장

새 검증 폴더를 만들고 현재 실행 화면만 저장한다.

`C:\dev\massage-on-demand-vn\output\chat-archive-remediation-verification-2026-08-07\`

최소 캡처:

1. `01-base-1440.png`
2. `02-results-1440.png`
3. `03-custom-before-submit-1440.png`
4. `04-custom-valid-1440.png`
5. `05-custom-invalid-1440.png`
6. `06-body-highlight-1440.png`
7. `07-partner-sender-1440.png`
8. `08-no-match-1440.png`
9. `09-canonical-unknown-filter-1440.png`
10. `10-base-1600.png`
11. `11-dark-1600.png`
12. `12-transcript-destination-1600.png`

각 screenshot은 저장 후 직접 열어 crop, overflow, text 대비, 잘못된 상태가 없는지 확인한다.

## 완료 판정 기준

다음이 모두 충족돼야 완료라고 보고한다.

- stale missing-room link 2곳이 실제 Chat repair queue를 연다.
- unknown filter/page가 전체 검색으로 조용히 풀리지 않는다.
- Custom range가 오류 round-trip 없이 한 번의 submit으로 작동한다.
- validation state와 no-match state가 분리된다.
- retention 미정 상태에서 evidence absence를 단정하지 않는 copy가 있다.
- 1440 첫 화면에 최소 1개의 full data row가 보인다.
- 기본 active chip과 정상/zero count 반복이 제거됐다.
- message body가 primary hierarchy다.
- Booking reference가 안정적이고 transcript 링크가 행당 하나다.
- visible search match가 안전하게 강조된다.
- 기존 message-level query, Partner predicate, production filter, permission, audit, PII 최소화가 유지된다.
- 1440·1600 라이트/다크에서 수평 overflow와 nested vertical scroll이 없다.
- focused tests, typecheck, scoped lint, required scope verification이 통과한다.
- 브라우저 QA와 console 검증이 완료됐다.
- 새 스크린샷이 지정 폴더에 저장됐다.
- 기존 사용자 변경을 되돌리지 않았다.

retention 정책 결정, list/summary API 통합, 안전한 root cause가 확인되지 않은 Booking Detail hydration 문제는 코드로 억지 해결하지 않고 deferred로 명시한다.

## 최종 보고 형식

다음 heading을 사용해 확인된 사실만 보고한다.

1. **Implemented** — Phase와 우선순위별 실제 수정 내용
2. **Changed files** — 절대 경로와 변경 이유
3. **Tests and verification** — 정확한 명령, pass/fail, test count
4. **Browser QA** — URL/state, viewport, console 결과
5. **Screenshots** — 절대 경로
6. **Permissions, privacy, and audit** — 유지·검증한 계약
7. **Protected areas** — 변경 여부와 추가 검증
8. **Preserved user changes** — dirty worktree 보호 방법
9. **Remaining risks / deferred** — retention, summary audit/API 통합, hydration 문제 등 실제 미완료
10. **Next recommended task** — 가장 가치가 높은 한 가지

테스트나 브라우저 검증을 건너뛰었다면 완료라고 말하지 않는다. 구현 전 계획을 최종 답으로 대신하지 않는다.

---

## 이 프롬프트가 잠그는 핵심 기준

- 글로벌 Chat Evidence는 message search만 담당한다.
- missing room과 repair는 Booking repair queue가 담당한다.
- full transcript는 Booking Activity가 담당한다.
- 없는 검색 결과를 “대화가 없었다”로 단정하지 않는다.
- 정확성·권한·개인정보를 시각적 밀도 개선보다 우선한다.
- 기존 동작과 component를 재사용하고 새 인프라를 만들지 않는다.
- 1440·1600 운영 화면에서 실제 message를 더 빨리 읽게 만든다.
