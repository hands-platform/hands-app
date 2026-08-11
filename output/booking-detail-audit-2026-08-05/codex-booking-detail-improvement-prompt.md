# Codex용 부킹 상세페이지 개선 실행 프롬프트

이 문서는 아래 감사 보고서를 실제 코드 수정 작업으로 전환하기 위한 실행 프롬프트다.

- 원본 보고서: `C:\dev\massage-on-demand-vn\output\booking-detail-audit-2026-08-05\booking-detail-operator-audit.md`
- 증거 캡처: `C:\dev\massage-on-demand-vn\output\booking-detail-audit-2026-08-05\01-decision-strip.png` ~ `14-actions-1024x768.png`
- 대상 저장소: `C:\dev\massage-on-demand-vn`
- 대상 화면: `http://localhost:3101/bookings/audit_booking_list_open_matching_booking#booking-command-decision-strip`

## 사용 방법

Codex를 `C:\dev\massage-on-demand-vn`에서 시작한 후 아래의 **전체 실행 프롬프트**를 그대로 전달한다. 이 프롬프트는 분석만 하고 멈추는 요청이 아니라, 코드 수정과 검증까지 완료하도록 작성되어 있다.

---

## 전체 실행 프롬프트

```text
C:\dev\massage-on-demand-vn 저장소의 관리자 부킹 상세페이지를 실제 운영자가 빠르고 안전하게 판단할 수 있는 화면으로 개선해줘.

대상 화면:
http://localhost:3101/bookings/audit_booking_list_open_matching_booking#booking-command-decision-strip

가장 중요한 목표:
- 운영자가 첫 화면 안에서 현재 상태, 매칭 마감, 선택 가능한 파트너, 현재 공급, 고객 연락 상태, 결제 결론, 담당자, 다음 행동을 이해할 수 있어야 한다.
- 목록 화면과 상세 화면이 같은 예약에 대해 서로 다른 추천 행동을 내리지 않아야 한다.
- 결제나 예약 상태를 바꾸는 위험 작업은 화면과 API 양쪽에서 같은 운영 조건으로 보호되어야 한다.
- 개발자용 데이터 나열이 아니라 실제 운영 판단 순서에 맞게 정보를 배치해야 한다.

필수 참고 자료:
1. 먼저 저장소의 AGENTS.md와 적용 범위에 있는 하위 AGENTS.md를 모두 확인한다.
2. 다음 감사 보고서를 처음부터 끝까지 읽는다.
   C:\dev\massage-on-demand-vn\output\booking-detail-audit-2026-08-05\booking-detail-operator-audit.md
3. 보고서와 같은 폴더의 01~14 PNG를 확인해 현재 화면과 1024px 상태를 이해한다.
4. 보고서가 지목한 코드만 믿고 수정하지 말고 현재 코드의 모든 관련 호출자, 테스트, API 흐름을 다시 추적한다.
5. 현재 git 상태를 먼저 확인하고 사용자의 기존 변경사항을 보존한다. 관련 없는 파일은 수정하지 않는다.

작업 방식:
- 먼저 현재 화면과 코드 흐름을 재현하고 짧은 실행 계획을 세운 뒤, 별도의 승인 대기 없이 구현과 검증까지 진행한다.
- 단, 비즈니스 규칙을 코드와 테스트에서 확인할 수 없고 선택에 따라 고객 또는 결제 결과가 달라지는 경우에만 구체적인 근거와 함께 질문한다.
- 새로운 디자인 시스템, 상태관리 라이브러리, UI 라이브러리, 의존성을 추가하지 않는다.
- 기존 AdminSection, AdminCard, AdminDisclosure, AdminForm*, StatusBadge, DateTimeText 등 현재 공통 컴포넌트와 토큰을 재사용한다.
- 1회성 wrapper, factory, config, 범용 추상화를 만들지 않는다.
- apps/admin_web/app/bookings/[id]/page.tsx 전체를 목적 없이 재작성하지 않는다. 판단 로직은 공통 모델에서 고치고 페이지는 조합 역할만 하게 한다.
- fixture 값을 바꾸거나 숨겨서 모순이 사라진 것처럼 만들지 않는다.
- 모바일/고객 앱의 정상 매칭 동작과 기존 API 응답 형식을 불필요하게 변경하지 않는다.
- DB migration은 기존 audit log와 데이터로 해결할 수 없는 경우에만 고려한다.

반드시 해결할 P0 요구사항:

1. 추천 행동을 하나의 판단 모델로 통일한다.
   - 목록 화면에서 이미 사용하는 apps/admin_web/lib/booking-command-decision-strip.ts와 bookingCommandDecisionStrip()을 우선 재사용한다.
   - 상세 화면의 bookingNeedsActionItems() 첫 항목을 별도 추천 엔진처럼 사용하는 현재 구조를 제거하거나 공통 결정 모델의 결과를 사용하도록 바꾼다.
   - OPEN_MATCHING이고 고객이 선택할 수 있는 Accepted/Joined 후보가 있으면 고객 최종 선택 지원이 단순 만료 종료보다 우선해야 한다.
   - 기존 bookingCustomerSelectableParticipantsForFinalChoice(), 최종 선택 API, 만료 로직과 관련 테스트를 추적해 “기한 경과 후 Accepted 후보가 여전히 유효한지”를 확인한다.
   - 기존 규칙에서 명확하지 않으면 파괴적인 종료를 우선하지 말고 selectable 후보를 보존하는 방향으로 구현한다.
   - 후보가 실제로 무효라면 Accepted로 계속 보여주지 말고 무효 사유와 시각을 표시한다.
   - 목록과 상세의 추천 행동이 동일하다는 회귀 테스트를 추가한다.

2. SLA와 매칭 마감의 모순을 없앤다.
   - page.tsx의 sla="Not defined" 하드코딩과 “No booking deadline is configured” 고정 문구를 제거한다.
   - OPEN_MATCHING에서는 booking.expiresAt을 사용해 “Matching deadline”과 절대시각, 남은 시간 또는 경과 시간을 표시한다.
   - 운영자 응답 SLA가 별도 개념이면 “Operator response SLA”로 분리하고 매칭 마감과 섞지 않는다.
   - expiresAt이 없을 때만 “Deadline unavailable”처럼 정확한 fallback을 사용한다.

3. 서비스 가격과 실제 결제 레코드를 분리한다.
   - booking.payment이 없을 때 financeTrace.customerPrice를 “Customer payment” 또는 “Payment record”로 표시하지 않는다.
   - 500,000 VND 같은 예약 금액은 “Service price” 또는 “Quoted price”로 표시한다.
   - 결제 레코드가 없으면 “No payment record”와 “No refund required”처럼 운영 결론을 표시한다.
   - payment가 있을 때만 실제 payment method/status/amount/provider ref를 결제 레코드로 표시한다.
   - earning, HANDS fee, tax, wallet 값이 아직 성립하지 않는 상태에서는 큰 강조 카드를 만들지 말고 숨기거나 “Not applicable until matched/completed”로 간결히 처리한다.
   - 결제 없음 + 서비스 가격 존재 조합의 테스트를 추가한다.

4. 만료 종료를 안전하게 만든다.
   - 현재 canExpireBooking(status)와 API expireBooking()이 OPEN_MATCHING 상태만 검사하는 문제를 고친다.
   - 실제 서버 mutation 직전에 최소한 다음을 다시 검증한다.
     a. status가 OPEN_MATCHING
     b. expiresAt이 존재하고 현재시각을 지남
     c. final Partner가 없음
     d. 현재 유효한 customer-selectable candidate가 없음
   - 관련 상태가 검증과 update 사이에서 바뀌는 race를 고려해 가능한 한 mutation에 가까운 transaction/guard에서 검증한다.
   - admin_web과 API 사이에 불필요한 새 프레임워크를 만들지 않는다. 기존 shared domain helper가 적합하면 재사용하고, 그렇지 않으면 양쪽의 테스트로 같은 규칙을 보장한다.
   - 만료 폼 제출 전에 다음 결과를 운영자가 읽고 최종 확인할 수 있게 한다.
     * OPEN_MATCHING → EXPIRED
     * Redis matching 종료
     * PENDING/AUTHORIZED payment가 있으면 RELEASED될 수 있음
     * 자동 고객/파트너 알림 여부
     * 고객 연락 체크포인트의 후속 상태
     * 복구 가능 여부
   - 현재 API가 자동 알림을 보내지 않는다면 새 알림을 임의로 추가하지 말고 “No automatic customer notification; contact required”라고 정확히 안내한다.
   - 1차 버튼은 “Review expiry impact”, 최종 확인 버튼은 결과가 드러나는 문구를 사용한다.
   - 공용/보존이 필요한 fixture에서 실제 파괴적 만료 버튼을 누르지 않는다. mutation 검증은 테스트나 재생성 가능한 전용 seed로 수행한다.

5. 고객 메모와 운영자 메모 의미를 분리한다.
   - booking.notes를 Service의 customer note와 Operator notes 양쪽에 동시에 표시하지 않는다.
   - apps/api/src/admin/admin.service.ts의 addBookingOpsNote()가 이미 남기는 booking.ops_note.add audit log를 우선 활용해 운영자 메모를 작성자, 작성시각, 내용 구조로 표시한다.
   - 출처가 확인되지 않는 기존 booking.notes는 “Customer note”라고 단정하지 않는다. 필요한 경우 “Legacy booking note”로 명확히 표시한다.
   - Add note 입력은 required로 만들고 빈 제출, 저장 성공, 저장 실패에 대한 사용자 피드백을 제공한다.
   - 운영자 메모가 Service request/customer note에 나타나지 않는 테스트를 추가한다.

반드시 해결할 P1 화면 구성 요구사항:

6. Decision strip을 운영 판단 요약으로 다시 구성한다.
   첫 화면에 다음 내용을 우선 노출한다.
   - Status + 상태 경과시간
   - Matching deadline + overdue/remaining
   - Candidate 상태: 예) 1 accepted / 1 waiting
   - Current supply: 예) 0 eligible / 40 nearby excluded
   - Customer contact checkpoint
   - Payment conclusion
   - Assignee + 가능한 경우 Assign to me/Transfer
   - 공통 결정 모델에서 나온 단 하나의 primary recommended action
   긴 전체 주소는 지역 중심으로 줄이고 전체 주소/복사는 상세에서 제공한다. 전체 전화번호는 연락 행동이 있는 한 위치에만 반복 없이 제공한다.

7. OPEN_MATCHING 상태에 맞게 섹션 순서를 바꾼다.
   기본 순서:
   1) Decision and primary action
   2) Contact/handling checkpoints
   3) Candidates and current supply
   4) Relevant timeline
   5) Operator notes
   6) Customer and service details
   7) Other booking records는 접힌 보조 영역

   다음은 데이터가 존재하거나 현재 상태에 적용될 때만 상세 노출한다.
   - Chat
   - Payment/earning/tax/wallet
   - Customer reviews
   - Partner evaluations
   - Completion location
   - Cancellation location
   bookingDetailSectionVisibility()와 기존 feature flag를 확인해 실제 렌더링에 일관되게 적용한다.

8. 후보 참여 이력과 현재 공급 평가를 구분한다.
   - 참여 당시 거리/상태에는 “At participation”과 시각을 표시한다.
   - 현재 공급 평가에는 “Current evaluation”, 평가시각, 현재 제외 사유를 표시한다.
   - Mai의 Accepted/2.6 km 이력과 현재 Busy/KYC draft/settlement/0 m가 왜 다른지 화면에서 이해할 수 있어야 한다.
   - Accepted 후보가 현재 선택 불가능하면 상단 candidate count에서도 제외하고 이유를 표시한다.

9. 공급 섹션의 범위를 정직하게 표시한다.
   - 현재 candidateRows.slice(0, 8)을 유지할 수 있지만 “Full Partner supply rows”라고 쓰지 않는다.
   - “Top 8 evaluated Partners”와 “Showing 8 of 40 excluded”를 표시한다.
   - 전체가 필요하면 해당 booking 조건이 적용된 Partners 화면으로 연결한다.
   - 기본 화면에는 관련 후보와 상위 제외 원인 집계를 우선하고 8개 상세 행은 접을 수 있다.
   - 실제 필터가 아닌 metric의 “Current filters” 라벨을 제거하거나 “Current policy”로 바꾼다.

10. 체크포인트를 압축하고 행동 의미를 명확히 한다.
   - “4 open / 4” 대신 “4 checkpoints remaining”처럼 쓴다.
   - 미완료는 info가 아니라 warning 계층으로 표현한다.
   - 각 체크포인트를 한 줄 상태로 만들고 현재 상태에 적용되지 않는 것은 Not applicable로 처리한다.
   - “Review handling detail” 같은 generic 문구를 실제 확인 내용으로 바꾼다.
   - Could not confirm은 펼쳐지는 입력 영역임을 시각적/접근성 구조로 알 수 있게 한다.
   - 실제 assign 기능이 없다면 Assignee 카드를 장식처럼 두지 말고 제거하거나 기존 할당 기능을 연결한다.

11. 중복 타임라인을 하나의 운영 타임라인으로 정리한다.
   - Activity와 Booking chronological activity가 같은 화면에서 경쟁하지 않게 한다.
   - 현재 단계/다음 행동을 위에, 최근 5~7개 이벤트를 아래에 둔다.
   - 원시 audit/CSV는 Technical activity 또는 Developer/System 영역으로 보낸다.
   - OPEN_MATCHING 같은 enum은 사람이 읽는 문구로 바꾼다.
   - Range는 “18:18–18:40 · 7 events”처럼 표시한다.

12. 깨진 내부 링크와 복귀 컨텍스트를 고친다.
   - Matching opened의 #alerts 링크가 현재 DOM에 존재하지 않는 문제를 수정한다.
   - 렌더링되는 섹션의 id만 링크 대상으로 사용한다.
   - 모든 href="#..."가 실제 target id를 가진다는 테스트를 추가한다.
   - 목록에서 상세로 들어온 경우 view/search/sort/page를 보존해 같은 큐로 돌아가게 한다.
   - 직접 진입에서는 /bookings를 fallback으로 사용한다.

13. 제목과 문구를 운영자 언어로 정리한다.
   - “Booking audit_bo”와 raw OPEN_MATCHING 대신 서비스명, humanized status, 복사 가능한 전체 booking ID를 제공한다.
   - OPEN_MATCHING에서 “Booking result / Final booking state”를 사용하지 않는다. “Booking overview”를 사용한다.
   - “Matched Partner detail”은 “Matching & Partner candidates”로 바꾼다.
   - “Cannot complete service”는 실제 결과가 드러나는 “Close matching without a Partner” 계열로 바꾼다.
   - fields, NONE/NONE, Current filters, stage(s), event(s) 같은 개발자 중심 문구를 제거한다.
   - 앱 전체 공통 문구를 무리하게 변경하지 말고 이 화면과 직접 연결된 shared formatter/copy helper만 최소 범위로 수정한다.

접근성 및 반응형 기준:
- 1024×768, 1280×800, 1440×900에서 가로 스크롤이 없어야 한다.
- 1024×768 첫 화면에서 Decision 요약과 primary action을 확인할 수 있어야 한다.
- 위험 작업 확인 UI는 키보드로 열고 취소하고 확정할 수 있어야 하며, 닫힌 뒤 포커스가 자연스럽게 복귀해야 한다.
- label, required, error/help 연결을 유지한다.
- 색상만으로 Pending/Warning/Danger를 구분하지 않는다.
- 기존 focus ring과 공통 토큰을 사용한다.
- 전화번호와 주소의 반복 노출을 줄이되 실제 연락 업무를 방해하지 않는다.

필수 테스트 시나리오:
1. OPEN_MATCHING + 기한 전 + 후보 없음 + 공급 있음
2. OPEN_MATCHING + 기한 경과 + 유효한 Accepted 후보 있음
3. OPEN_MATCHING + 기한 경과 + 후보 없음 + 공급 0
4. OPEN_MATCHING + expiresAt 없음
5. payment 없음 + service price 500,000 VND
6. AUTHORIZED payment + 만료 처리
7. operator note 추가 후 actor/time/content 표시
8. supply 40건 중 8건 표시
9. 모든 내부 fragment link target 존재
10. 목록 필터에서 상세 진입 후 원래 컨텍스트로 복귀

검증 절차:
- 가장 작은 관련 Vitest 테스트부터 실행한다.
- admin web:
  npm run test --workspace @massage-vn/admin-web -- <관련 spec 파일>
  npm run typecheck --workspace @massage-vn/admin-web
  npm run lint --workspace @massage-vn/admin-web
- API:
  npm run test --workspace @massage-vn/api -- <관련 spec 파일>
  npm run typecheck --workspace @massage-vn/api
  npm run lint --workspace @massage-vn/api
- 그 다음 저장소의 빠른 관리자 검증을 실행한다.
  npm run verify:admin:fast
- 실행 중인 관리자 웹에서 대상 URL을 다시 열고 1440px와 1024px 화면을 직접 확인한다.
- 브라우저 console error/warning, horizontal overflow, 내부 fragment link, 폼 label/required를 확인한다.
- 수정 전/후 동일 구간 스크린샷을 남긴다.
- 기존 테스트가 현재 잘못된 문구나 구조를 고정하고 있다면 테스트를 삭제하지 말고 새 운영 요구사항에 맞게 업데이트한다.

완료 조건:
- 첫 화면에서 상태, 마감, 후보, 공급, 연락, 결제, 담당자, 다음 행동을 이해할 수 있다.
- Accepted 후보가 유효한 예약에서 상세와 목록 모두 고객 최종 선택 지원을 추천한다.
- 만료 자격이 없는 예약은 UI와 API 모두 종료를 거부한다.
- payment가 없을 때 서비스 가격이 payment record로 보이지 않는다.
- operator note가 customer/service note로 보이지 않고 actor/time이 표시된다.
- OPEN_MATCHING과 무관한 빈 정산/리뷰/완료 섹션이 기본 화면을 차지하지 않는다.
- 현재 공급과 참여 당시 상태의 시점/출처가 구분된다.
- 모든 내부 링크가 유효하다.
- 1024px에서 핵심 흐름을 키보드로 사용할 수 있다.
- 관련 테스트, typecheck, lint, verify:admin:fast 결과를 보고한다.

최종 응답 형식:
1. 운영자 입장에서 무엇이 달라졌는지 먼저 요약한다.
2. 수정한 파일을 기능별로 정리한다.
3. 실행한 테스트/검증 명령과 성공·실패 결과를 정확히 적는다.
4. 수정 전/후 화면 캡처 경로를 제공한다.
5. 확인하지 못한 항목이나 남은 비즈니스 결정이 있으면 추측하지 말고 명시한다.
6. 테스트를 통과하지 못한 상태를 완료라고 말하지 않는다.

보고서의 모든 제안을 기계적으로 구현할 필요는 없지만, P0와 P1 항목을 누락해서는 안 된다. 현재 코드에서 더 작고 안전한 해결책을 찾으면 그 방법을 사용하되, 해당 요구사항과 완료 조건을 충족했다는 근거를 남겨라.
```

---

## 프롬프트가 Codex에 강제하는 핵심 기준

| 기준 | 의미 |
|---|---|
| 단일 판단 소스 | 목록과 상세의 추천 로직을 따로 만들지 않음 |
| 파괴적 작업 서버 검증 | 화면을 우회해도 잘못된 만료 처리가 실행되지 않음 |
| 실제 데이터 의미 유지 | 가격, 결제, 환불, 메모의 의미를 섞지 않음 |
| 상태 기반 정보 구조 | OPEN_MATCHING에 필요한 정보부터 노출 |
| 기존 코드 재사용 | 이미 존재하는 결정 모델과 Admin UI 컴포넌트를 활용 |
| 최소 변경 | 관련 없는 대규모 리팩터링과 신규 의존성 금지 |
| 증거 기반 완료 | 테스트, 타입 검사, 린트, 실제 브라우저 확인까지 수행 |

## 작업 중 Codex가 임의로 결정하면 안 되는 항목

다음은 코드와 테스트에서 기존 정책을 먼저 찾아야 한다.

1. 매칭 기한 경과 후 Accepted 후보가 계속 선택 가능한지 여부
2. 만료 시 고객/파트너에게 자동 알림을 새로 발송해야 하는지 여부
3. 만료된 예약을 되돌릴 수 있는 운영 정책
4. 실제 Assignee 데이터와 할당 API의 존재 여부
5. `booking.notes` 중 어떤 레거시 데이터가 진짜 고객 요청인지 여부

정책이 존재하지 않으면 고객/결제에 영향을 주는 새 동작을 발명하지 말고, 파괴적 행동을 제한하는 안전한 기본값과 남은 결정사항을 보고해야 한다.

## 권장 후속 검토 프롬프트

구현이 끝난 뒤 별도 Codex 작업에서 아래 문장으로 검토할 수 있다.

```text
C:\dev\massage-on-demand-vn\output\booking-detail-audit-2026-08-05\booking-detail-operator-audit.md와 codex-booking-detail-improvement-prompt.md를 기준으로 현재 변경사항을 리뷰해줘.

코드를 수정하지 말고 다음만 보고해줘.
- P0/P1 요구사항별 충족 여부와 근거 파일/라인
- 목록과 상세 추천 행동의 일관성
- 만료 API의 우회 가능성 또는 race condition
- 가격/결제/메모 의미가 다시 섞인 부분
- 1024px 실제 화면에서 남은 운영 방해 요소
- 누락된 테스트와 실패한 검증

심각도순으로 findings를 먼저 제시하고, 문제가 없으면 확인한 테스트와 남은 한계를 적어줘.
```
