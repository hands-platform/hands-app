# Customer App Page Specs

## CUS-001
## 앱 구분
Customer App
## 페이지명
Splash / Boot
## 페이지 목적
앱 초기화, 세션 확인, 필수 설정 로드.
## 진입 경로
앱 실행.
## 나가는 경로
Onboarding, Login, Home.
## 주요 버튼
없음.
## 입력창
없음.
## 탭 메뉴
없음.
## 팝업/모달
네트워크 오류.
## 관련 API 후보
GET /api/health/ready, POST /auth/refresh.
## 관련 DB 도메인
User, AppSession.
## 권한
Public.
## 상태값
booting, authenticated, unauthenticated, error.
## 비즈니스 규칙
세션 만료 시 로그인으로 이동.
## 제외할 기능
국가 선택.
## 개발 메모
Vietnam 설정을 기본값으로 로드.

## CUS-002
## 앱 구분
Customer App
## 페이지명
Phone Login
## 페이지 목적
고객 휴대폰 OTP 로그인.
## 진입 경로
Splash, Profile.
## 나가는 경로
OTP Verification.
## 주요 버튼
Send OTP.
## 입력창
Phone number.
## 탭 메뉴
없음.
## 팝업/모달
OTP 발송 실패.
## 관련 API 후보
POST /auth/request-otp.
## 관련 DB 도메인
User, CustomerProfile.
## 권한
Public.
## 상태값
idle, sending, sent, failed.
## 비즈니스 규칙
기본 국가번호 +84.
## 제외할 기능
다국가 선택.
## 개발 메모
Supabase Auth 전환 가능하도록 repository로 분리.

## CUS-003
## 앱 구분
Customer App
## 페이지명
Home
## 페이지 목적
주소, 서비스, 주변 파트너, 진행 예약 진입점.
## 진입 경로
Login success, bottom tab.
## 나가는 경로
Address Picker, Service List, Partner Detail, Booking Detail.
## 주요 버튼
Refresh providers, Reserve, Open active booking.
## 입력창
Search service/address optional.
## 탭 메뉴
Home, Partners, Bookings, Chat, Profile.
## 팝업/모달
위치 권한 안내.
## 관련 API 후보
GET /customer/providers/nearby, GET /services.
## 관련 DB 도메인
CustomerSelectedLocation, ProviderProfile, MassageService, LocationSnapshot.
## 권한
Customer.
## 상태값
loading, ready, permission_denied, empty, error.
## 비즈니스 규칙
파트너는 거리와 가능 상태 기준으로 정렬.
## 제외할 기능
제휴점 배너.
## 개발 메모
MapTiler/MapLibre 지도는 화면 진입 시에만 로드.

## CUS-004
## 앱 구분
Customer App
## 페이지명
Service List
## 페이지 목적
서비스 종류와 시간 옵션 탐색.
## 진입 경로
Home.
## 나가는 경로
Service Detail.
## 주요 버튼
Service card.
## 입력창
Search/filter optional.
## 탭 메뉴
Home tabs.
## 팝업/모달
Filter modal.
## 관련 API 후보
GET /services, GET /services/groups.
## 관련 DB 도메인
MassageService, ServicePayoutRule.
## 권한
Customer.
## 상태값
loading, ready, empty.
## 비즈니스 규칙
시간 옵션은 서비스의 하위 옵션이다.
## 제외할 기능
국가별 서비스 분기.
## 개발 메모
관리자 가격정책과 연결.

## CUS-005
## 앱 구분
Customer App
## 페이지명
Address Picker
## 페이지 목적
GPS, 주소 검색, 지도 핀으로 서비스 위치 확정.
## 진입 경로
Home, Booking Information.
## 나가는 경로
Partner List, Booking Information.
## 주요 버튼
Use this location, Current location.
## 입력창
Address search.
## 탭 메뉴
없음.
## 팝업/모달
권한 거부, 검색 실패.
## 관련 API 후보
POST /customer/locations, Geoapify geocoding.
## 관련 DB 도메인
CustomerSelectedLocation.
## 권한
Customer.
## 상태값
gps_loading, searching, selected, denied.
## 비즈니스 규칙
검색 결과 선택 후에도 핀 조정 가능.
## 제외할 기능
Directions/Routing API.
## 개발 메모
검색 debounce 500ms, 캐싱 적용.

## CUS-006
## 앱 구분
Customer App
## 페이지명
Partner List / Picker
## 페이지 목적
선택 위치 기준 주변 파트너 확인.
## 진입 경로
Home, Service Detail.
## 나가는 경로
Partner Detail, Booking Information.
## 주요 버튼
Reserve, Partner thumbnail.
## 입력창
Filter/search optional.
## 탭 메뉴
Home tabs.
## 팝업/모달
Filter modal.
## 관련 API 후보
GET /customer/partners/nearby.
## 관련 DB 도메인
ProviderProfile, ProviderService, LocationSnapshot.
## 권한
Customer.
## 상태값
loading, ready, no_nearby_partner.
## 비즈니스 규칙
24시간 이상 지난 위치는 숨김, 30분 이상은 not recent 표시.
## 제외할 기능
파트너 점수화.
## 개발 메모
UI 용어는 Partner로 표기.

## CUS-007
## 앱 구분
Customer App
## 페이지명
Partner Detail
## 페이지 목적
파트너 프로필, 리뷰, 제공 서비스 확인.
## 진입 경로
Partner List.
## 나가는 경로
Booking Information, Back.
## 주요 버튼
Book, Share, Favorite.
## 입력창
없음.
## 탭 메뉴
없음.
## 팝업/모달
이미지 미리보기.
## 관련 API 후보
GET /customer/partners/:id.
## 관련 DB 도메인
ProviderProfile, ProviderService, Review, FileAsset.
## 권한
Customer.
## 상태값
loading, ready, unavailable.
## 비즈니스 규칙
공개 프로필 정보만 표시.
## 제외할 기능
프로필 사진/자산 복제.
## 개발 메모
디자인은 추후 Figma에 맞춤.

## CUS-008
## 앱 구분
Customer App
## 페이지명
Booking Information
## 페이지 목적
서비스, 시간, 가격, 주소, 파트너 확인 후 예약 생성.
## 진입 경로
Partner Detail.
## 나가는 경로
Payment Method, Address Picker.
## 주요 버튼
Book now.
## 입력창
Customer name, phone, address note optional.
## 탭 메뉴
없음.
## 팝업/모달
필수값 누락.
## 관련 API 후보
POST /customer/bookings.
## 관련 DB 도메인
Booking, BookingService, Payment, CustomerSelectedLocation.
## 권한
Customer.
## 상태값
draft, submitting, created, failed.
## 비즈니스 규칙
선택한 서비스 가격정책을 서버에서 재검증.
## 제외할 기능
수동 가격 입력.
## 개발 메모
String/num cast 방어 필요.

## CUS-009
## 앱 구분
Customer App
## 페이지명
Matching Waiting
## 페이지 목적
선호 파트너와 백업 참여 파트너를 보여주고 최종 선택.
## 진입 경로
Booking Complete, Booking Detail.
## 나가는 경로
Chat Detail, Booking Detail.
## 주요 버튼
Refresh status, Select partner, Cancel.
## 입력창
없음.
## 탭 메뉴
없음.
## 팝업/모달
취소 확인.
## 관련 API 후보
GET /customer/bookings/:id, POST /customer/bookings/:id/select-provider.
## 관련 DB 도메인
Booking, BookingParticipant, ChatRoom.
## 권한
Customer.
## 상태값
OPEN_MATCHING, MATCHED, EXPIRED, CANCELLED.
## 비즈니스 규칙
최종 파트너는 고객이 선택한다.
## 제외할 기능
자동 최종 매칭.
## 개발 메모
운영정책 기본값은 관리자 설정에서 로드.

## CUS-010
## 앱 구분
Customer App
## 페이지명
Chat Detail
## 페이지 목적
매칭된 파트너와 메시지 송수신.
## 진입 경로
Booking Detail, Chat tab.
## 나가는 경로
Booking Detail.
## 주요 버튼
Send, Refresh chat.
## 입력창
Message.
## 탭 메뉴
Chat.
## 팝업/모달
전송 실패.
## 관련 API 후보
GET /chat/rooms/:id/messages, POST /chat/rooms/:id/messages.
## 관련 DB 도메인
ChatRoom, ChatMessage, Booking.
## 권한
Customer as participant.
## 상태값
loading, ready, sending, failed, completed_hidden.
## 비즈니스 규칙
완료 후 모바일에서는 active chat에서 숨김, admin archive는 보존.
## 제외할 기능
완료 후 고객/파트너 앱 영구 채팅.
## 개발 메모
Realtime은 Socket.IO 또는 Supabase Realtime 교체 가능 구조.
