# Push Send final remediation evidence

검증일: 2026-08-13  
대상: `http://localhost:3101/notifications/push-send`  
정책: 외부 push 0건, browser fixture와 mock/isolated integration만 사용

## 화면 증거

| 파일 | 검증 상태 |
| --- | --- |
| `01-customers-composer-1440-light.png` | Customer audience, 3-step composer, compact risk strip |
| `02-partners-composer-1440-light.png` | Partner role와 Vietnamese-only policy |
| `03-specific-account-1440-light.png` | 특정 계정은 fanout 없이 단일 계정만 평가 |
| `04-zero-recipients-1440-light.png` | 0명 fail closed |
| `05-one-recipient-ready-1440-light.png` | 1명 receipt와 final confirmation |
| `06-100-ready-1600-light.png` | 100명 manual limit 경계에서 confirm 가능 |
| `07-101-blocked-1440-light.png` | 101명 over-limit, queue action 차단 |
| `08-language-mismatch-1440-light.png` | locale/device mismatch exclusion 표시 |
| `09-invalid-destination-1440-light.png` | role destination matrix 위반 차단 |
| `10-preview-expired-1440-light.png` | 만료 receipt의 reason/phrase/action 비활성화 |
| `11-final-typed-confirmation-1440-light.png` | reason과 exact `SEND 1` 입력 후에만 queue 활성화 |
| `12-queued-success-1440-light.png` | `Queued`와 `Delivered`를 구분한 결과 문구 |
| `13-processing-completed-1600-light.png` | queue lifecycle 및 terminal evidence |
| `14-partial-history-1600-light.png` | `PARTIAL_FAILED` 이력과 delivery aggregate |
| `15-campaign-evidence-expanded-1600.png` | reason, timestamps, exclusion, audit/delivery links가 열린 evidence |
| `16-permission-denied-1440-light.png` | exact `NOTIFICATIONS_PUSH` 권한 거부 화면 |
| `17-queue-error-draft-1440-light.png` | queue 오류와 draft 보존/동일 key retry 안내 |
| `18-max-copy-1600-light.png` | title 120자/body 500자 경계와 overflow 없음 |
| `19-ready-1440-dark.png` | 1440 dark theme 대비와 layout |

## 브라우저 검증 결과

- 1440x1000 light: Customer, Partner, specific account, 0, 1, 101, mismatch, invalid destination, expiry, confirmation, queued, permission, queue error를 확인했다.
- 1600x1000 light: 100명 경계, processing/completed, partial history/evidence, 최대 copy를 확인했다.
- 1440x1000 dark: composer와 receipt의 배경/텍스트 대비를 확인했다.
- 모든 핵심 fixture에서 document horizontal overflow는 `false`였다.
- confirmation CTA는 reason 12자 미만 또는 exact phrase 불일치일 때 disabled였고 `SEND 1` 일치 후 enabled였다.
- receipt 만료 상태에서는 reason, phrase, queue CTA가 모두 disabled였다.
- URL에는 title, body, reason, raw account/device ID가 없었다.
- campaign history는 고유 `aria-label`, focus 가능한 scroll region, block 행 레이아웃을 유지했다.
- 마지막 브라우저 확인에서 console error/warning은 0건이었다.

## 명령 로그

- `verify-scope-customer.log`: Customer `flutter analyze` PASS, `flutter test` 139 PASS.
- `verify-scope-provider.log`: Partner `flutter analyze` PASS, `flutter test` 181 PASS.
- `verify-local.log`: API/Admin/Public Web build와 typecheck, mobile tests는 PASS. 전역 dirty worktree의 Push 외 실패는 구현 보고서에 분리했다.

## 데이터 및 외부 시스템 보호

- 실제/shared/production DB에서 preview/confirm mutation을 실행하지 않았다.
- migration은 shared/production에 적용하지 않았다.
- PostgreSQL 통합 검증은 격리 DB에 전체 migration을 적용한 뒤 DB를 삭제했다.
- 실제 FCM/provider 발송은 0건이다.
- 브라우저 queue 결과는 명시적으로 허용된 local fixture였다.
