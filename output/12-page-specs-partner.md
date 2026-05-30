# Partner App Page Specs

## PAR-001
## 앱 구분
partner App
## 페이지명
Partner Login
## 페이지 목적
파트너 전화번호 OTP 로그인.
## 진입 경로
Splash.
## 나가는 경로
Dashboard, Register, Approval Pending.
## 주요 버튼
Send OTP.
## 입력창
Phone number.
## 탭 메뉴
없음.
## 팝업/모달
OTP 발송 실패.
## 관련 API 후보
POST /auth/request-otp, POST /auth/verify-otp.
## 관련 DB 도메인
User, ProviderProfile, ProviderSession.
## 권한
Public.
## 상태값
idle, sending, verified, failed.
## 비즈니스 규칙
기본 국가번호 +84.
## 제외할 기능
Store Member login.
## 개발 메모
화면명은 Partner 용어 사용.

## PAR-002
## 앱 구분
partner App
## 페이지명
Partner Register
## 페이지 목적
최소 가입 정보 수집.
## 진입 경로
Login.
## 나가는 경로
Profile Form, Approval Pending.
## 주요 버튼
Continue.
## 입력창
Real name, nickname, gender, birth date, phone, Facebook id.
## 탭 메뉴
없음.
## 팝업/모달
필수값 누락.
## 관련 API 후보
PATCH /partner/me.
## 관련 DB 도메인
ProviderProfile.
## 권한
Partner.
## 상태값
draft, saving, saved.
## 비즈니스 규칙
초기에는 세금 정보를 강제하지 않음.
## 제외할 기능
사업자 Hộ Kinh Doanh 가입.
## 개발 메모
첫 수익 후 세금 게이트 연결.

## PAR-003
## 앱 구분
partner App
## 페이지명
KYC Upload
## 페이지 목적
CCCD/CMND, 앞면/뒷면/셀카 업로드.
## 진입 경로
Onboarding, Profile.
## 나가는 경로
Approval Pending.
## 주요 버튼
Upload, Submit review.
## 입력창
CCCD/CMND number.
## 탭 메뉴
없음.
## 팝업/모달
재업로드 안내.
## 관련 API 후보
POST /partner/verification, POST /files.
## 관련 DB 도메인
ProviderKyc, ProviderDocument, FileAsset.
## 권한
Partner.
## 상태값
pending, approved, rejected, blocked.
## 비즈니스 규칙
거절 시 재요청 가능.
## 제외할 기능
자동 신분증 판정 강제.
## 개발 메모
이미지 압축 후 private storage.

## PAR-004
## 앱 구분
partner App
## 페이지명
Dashboard
## 페이지 목적
온라인 상태, 요청 수, 진행 예약, 위치 상태 확인.
## 진입 경로
Login, bottom tab.
## 나가는 경로
Requests, Active Order, Chat, Earnings.
## 주요 버튼
Go online, Go offline, Refresh.
## 입력창
없음.
## 탭 메뉴
Requests, Schedule, Earnings, Chat, Profile.
## 팝업/모달
위치 권한 거부.
## 관련 API 후보
POST /partner/online, POST /partner/offline, POST /partner/location.
## 관련 DB 도메인
ProviderProfile, LocationSnapshot, ProviderDevice.
## 권한
Partner.
## 상태값
OFFLINE, ONLINE_AVAILABLE, ONLINE_BUSY, ONLINE_AVAILABLE_SOON.
## 비즈니스 규칙
앱 실행 시 1회, 켜져 있는 동안 10분마다 위치 업데이트.
## 제외할 기능
백그라운드 실시간 추적.
## 개발 메모
최근 위치 여부를 명확히 표시.

## PAR-005
## 앱 구분
partner App
## 페이지명
New Order Requests
## 페이지 목적
직접 지명 예약과 주변 백업 참여 가능 예약 확인.
## 진입 경로
Dashboard, push notification.
## 나가는 경로
Order Detail, Active Order.
## 주요 버튼
Refresh requests, Accept request, Join matching, Reject.
## 입력창
없음.
## 탭 메뉴
Requests.
## 팝업/모달
수락 제한 사유, 거절 사유.
## 관련 API 후보
GET /partner/bookings/open, GET /partner/bookings, POST /partner/bookings/:id/join.
## 관련 DB 도메인
Booking, BookingParticipant, ProviderWalletLedgerEntry.
## 권한
Partner.
## 상태값
open, direct, joined, matched, blocked.
## 비즈니스 규칙
10km 이내 파트너만 백업 참여 가능, 음수 월렛은 수락 불가.
## 제외할 기능
자동 배정.
## 개발 메모
정책값은 Operations Policy에서 로드.

## PAR-006
## 앱 구분
partner App
## 페이지명
Order Detail
## 페이지 목적
예약 상세, 고객 주소, 서비스, 결제/정책 상태 확인.
## 진입 경로
Requests.
## 나가는 경로
Active Order, Chat.
## 주요 버튼
Accept, Reject, Start service, Complete.
## 입력창
Reject reason optional.
## 탭 메뉴
없음.
## 팝업/모달
Accept/Reject confirmation.
## 관련 API 후보
POST /partner/bookings/:id/accept, /reject, /start, /complete.
## 관련 DB 도메인
Booking, BookingService, ChatRoom, ProviderEarning.
## 권한
Assigned or eligible partner.
## 상태값
OPEN_MATCHING, MATCHED, IN_SERVICE, COMPLETED, CANCELLED.
## 비즈니스 규칙
시작 후 채팅 활성화.
## 제외할 기능
고객 평가 점수.
## 개발 메모
서비스 완료 시 수익/세금/수수료 로그 생성.

## PAR-007
## 앱 구분
partner App
## 페이지명
Chat Detail
## 페이지 목적
고객과 메시지, 현재 위치 공유.
## 진입 경로
Active Order, Chat tab.
## 나가는 경로
Active Order.
## 주요 버튼
Send, Share current location.
## 입력창
Message.
## 탭 메뉴
Chat.
## 팝업/모달
전송 실패, 위치 실패.
## 관련 API 후보
GET /chat/rooms/:id/messages, POST /chat/rooms/:id/messages, POST /partner/location.
## 관련 DB 도메인
ChatRoom, ChatMessage, LocationSnapshot.
## 권한
Chat participant.
## 상태값
ready, sending, shared_location, completed_hidden.
## 비즈니스 규칙
완료 후 모바일에서 숨기고 admin archive 보존.
## 제외할 기능
Directions API.
## 개발 메모
수동 위치 공유만 제공.

## PAR-008
## 앱 구분
partner App
## 페이지명
Earnings / Withdraw
## 페이지 목적
수익, 수수료, 세금, 출금 가능 상태 확인.
## 진입 경로
bottom tab.
## 나가는 경로
Payout Request, Tax Profile.
## 주요 버튼
Request payout, Add tax info, Settle fee.
## 입력창
Bank info, tax code when required.
## 탭 메뉴
Earnings.
## 팝업/모달
출금 제한 사유.
## 관련 API 후보
GET /partner/earnings, POST /partner/payouts.
## 관련 DB 도메인
ProviderEarning, ProviderPayoutBatch, ProviderTaxProfile, ProviderWalletLedgerEntry.
## 권한
Partner.
## 상태값
eligible, tax_required, negative_wallet, payout_pending.
## 비즈니스 규칙
첫 수익 후 세금 정보 입력, 음수 월렛은 예약 수락 제한.
## 제외할 기능
가입 시 세금 강제 입력.
## 개발 메모
세금/수수료는 정책 테이블 기반.
