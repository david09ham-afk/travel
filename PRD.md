# 여행지·숙소 예약 사이트 PRD

## 1. 제품 개요와 MVP 범위

관리자가 등록한 여행지와 주변 숙소를 방문자가 탐색하고, 회원이 숙소 예약 요청을 제출하는 반응형 웹사이트다. 화면은 HTML/CSS/순수 JavaScript, 개발 웹 서버는 Python, 인증은 Firebase Authentication, 데이터는 Firebase Realtime Database(RTDB), 소스 관리는 GitHub, 배포는 Vercel을 사용한다. 현재 MVP 개발 서버는 프로젝트 루트에서 `python -m http.server 8000`으로 실행한다. 서버 측 엔드포인트가 필요해지면 Python으로 구현한다.

- MVP: 여행지·숙소 탐색, 회원가입·로그인, 예약 요청·취소, 관리자 CRUD와 예약 상태 관리.
- 결제와 외부 예약 시스템 연동은 MVP에서 제외한다. 예약은 `pending` 요청으로 저장하고 관리자가 가용성을 확인한 후 확정한다. 날짜별 재고 충돌 방지를 구현하지 않는 한 실시간 예약 가능을 보장하지 않는다.
- 최소 수집 원칙을 지킨다. 비밀번호는 Firebase Authentication에서만 관리하고 RTDB에는 저장하지 않는다.

## 2. 메뉴 구성

### 주 메뉴
1. **여행지** — 여행지 목록, 지역 및 키워드(이름/소개) 검색, 상세 보기
2. **숙소** — 숙소 목록, 지역 및 키워드(이름/주소/소개) 검색, 가격/인원 필터, 상세 보기
3. **예약** — 로그인 회원의 예약 내역·상세·취소
4. **회원** — 로그인/회원가입, 내 정보, 로그아웃
5. **관리자** — 관리자만 접근 가능한 대시보드

### 보조 메뉴
- 홈, 여행지 상세의 주변 숙소, 숙소 상세의 예약하기
- 예약/취소 정책, 개인정보 안내
- 관리자 하위 메뉴: 요약, 여행지 관리, 숙소 관리, 회원 관리, 예약 관리

## 3. 화면 구조도

```text
홈 (index.html)
├─ 여행지 목록 (html/destinations.html)
│  └─ 여행지 상세 (html/destination-detail.html?id=...)
│     └─ 주변 숙소 → 숙소 상세
├─ 숙소 목록 (html/stays.html)
│  └─ 숙소 상세 (html/stay-detail.html?id=...)
│     └─ 로그인 확인 → 예약 작성 → 완료 안내
├─ 회원가입/로그인/관리자 로그인 다이얼로그
├─ 예약 요청 (html/reservation-create.html) [로그인 필요]
└─ 내 예약 (html/reservations.html) [로그인 필요]

관리자 (admin.html) [admin custom claim 필요]
├─ 요약 대시보드
├─ 여행지 목록 → 등록/수정 폼
├─ 숙소 목록 → 등록/수정 폼
├─ 회원 목록 → 회원 상세/상태 변경
└─ 예약 목록 → 예약 상세/상태 처리
```

## 4. View 파일명 및 책임

| 파일 | 책임 |
| --- | --- |
| `index.html` | 루트 홈, 공개 여행지/숙소 조회, 회원·관리자 인증 진입점 |
| `html/destinations.html` | 공개 여행지 목록, 검색/지역 필터 |
| `html/destination-detail.html` | 여행지 소개·대표 이미지·주소·주변 숙소 |
| `html/stays.html` | 공개 숙소 목록, 여행지/가격/인원 필터 |
| `html/stay-detail.html` | 숙소 상세 및 예약 진입 |
| `html/reservation-create.html` | 숙소 선택, 날짜/인원 검증, 예약 요청 제출 |
| `html/reservations.html` | 로그인 회원의 예약 목록 |
| `admin.html` | 관리자 대시보드, 여행지/숙소 CRUD, 예약 상태, 회원 조회 |
| `html/policies.html` | 예약/취소 및 개인정보 안내 |

기획 파일 목록이며 화면을 통합/분리하면 링크와 이 문서를 함께 갱신한다. URL query parameter는 `?id=...` 형식으로 사용한다.

## 5. 논리 데이터 테이블 (Realtime Database 경로)

RTDB는 SQL 테이블이 아니라 JSON 트리다. 아래 네 이름을 최상위 경로로 두고 각 레코드는 Firebase key로 식별한다. 모든 엔티티는 `createdAt`, `updatedAt`을 서버 기준 시각으로 기록한다.

### `destinations` — 여행지
경로: `/destinations/{destinationId}`

| 필드 | 필수 | 설명 |
| --- | --- | --- |
| `name` | 예 | 여행지명 |
| `region` | 예 | 검색용 시·도/시·군 |
| `address` | 예 | 대표 주소 |
| `description` | 예 | 소개 글 |
| `imageUrl` | 예 | 대표 이미지 URL (MVP 한 장) |
| `status` | 예 | `draft`, `published`, `archived` |
| `createdAt`, `updatedAt` | 예 | 서버 타임스탬프 |

좌표/지도 데이터는 지도나 거리순 탐색이 실제 요구사항이 될 때 추가한다.

### `stays` — 숙소
경로: `/stays/{stayId}`

| 필드 | 필수 | 설명 |
| --- | --- | --- |
| `destinationId` | 예 | 연결된 여행지 key |
| `name` | 예 | 숙소명 |
| `address` | 예 | 숙소 주소 |
| `description` | 예 | 숙소 안내 |
| `imageUrl` | 예 | 대표 이미지 URL |
| `pricePerNight` | 예 | 1박 가격, KRW 정수, 0 초과 |
| `maxGuests` | 예 | 예약당 최대 인원 |
| `contact` | 예 | 문의 연락처 |
| `status` | 예 | `draft`, `published`, `archived` |
| `createdAt`, `updatedAt` | 예 | 서버 타임스탬프 |

초기 범위는 대표 요금/수용 인원이다. 객실 종류, 날짜별 요금·재고는 별도 정책이 정해진 후 모델링한다.

### `members` — 회원 프로필
경로: `/members/{uid}` (Firebase Auth `uid`가 key)

| 필드 | 필수 | 설명 |
| --- | --- | --- |
| `name` | 예 | 예약자 이름 |
| `email` | 예 | 계정 이메일, Auth 이메일과 일치 |
| `phone` | 예 | 예약 확인 연락처 |
| `role` | 예 | `member` 또는 `admin` 표시용 구분값. 관리자 값은 신뢰된 Admin SDK만 기록 |
| `status` | 예 | `active`, `suspended`, `deleted` |
| `createdAt`, `updatedAt` | 예 | 서버 타임스탬프 |

비밀번호는 저장하지 않는다. 화면 구분은 `role` 필드(`member`/`admin`)를 사용한다. 이 값은 목록 표시 전용이며 권한 판정은 Firebase Auth의 신뢰된 custom claim `admin: true`로만 한다. 회원 클라이언트는 `member`만 기록할 수 있고 관리자 프로필은 Admin SDK 설정 도구가 기록한다.

### `reservations` — 예약
경로: `/reservations/{reservationId}`

| 필드 | 필수 | 설명 |
| --- | --- | --- |
| `memberId` | 예 | 예약자의 Auth `uid` |
| `stayId` | 예 | 예약 숙소 key |
| `destinationId` | 예 | 숙소 연결 여행지 key |
| `checkIn` | 예 | 체크인 `YYYY-MM-DD` |
| `checkOut` | 예 | 체크아웃, 체크인 이후 |
| `guestCount` | 예 | 1 이상, `maxGuests` 이하 |
| `nights` | 예 | 체크아웃과 체크인 사이 일수 |
| `pricePerNight` | 예 | 요청 시점 단가 스냅샷 |
| `totalPrice` | 예 | `nights × pricePerNight` 스냅샷 |
| `status` | 예 | `pending`, `confirmed`, `rejected`, `cancelled`, `completed` |
| `createdAt`, `updatedAt` | 예 | 서버 타임스탬프 |

이름/이메일/전화는 `members`에서 참조해 중복 저장하지 않는다. 가격은 현재 숙소 데이터로 검증해 저장하며 브라우저가 보낸 합계를 신뢰하지 않는다. MVP의 날짜 겹침/가용성은 관리자가 확정 전 확인한다. 동시 재고 통제가 필요해지면 날짜 단위 재고와 transaction 설계를 추가한다.

### 검색/관계 보조 인덱스
RTDB는 관계형 조인을 제공하지 않는다. 실제 목록 규모에 따라 아래 인덱스를 둘 수 있고, 원본과 multi-location update로 함께 갱신한다.
- `/destinationStayIndex/{destinationId}/{stayId}: true`
- `/memberReservationIndex/{uid}/{reservationId}: true`
- `/reservationStatusIndex/{status}/{reservationId}: true`

## 6. 회원 흐름

1. 방문자가 공개 여행지/숙소를 둘러본다.
2. 숙소 상세에서 체크인, 체크아웃, 인원수를 고른다. 날짜 순서, 1박 이상, 최대 인원을 검증한다.
3. 예약 요청 시 비로그인 사용자는 로그인/가입으로 이동하고 인증 후 숙소 예약으로 돌아온다.
4. 회원은 이름/연락처를 확인하고 요청을 제출한다. `memberId`는 인증 UID로 정하고 숙소 가격을 다시 확인해 총액을 만든다.
5. 예약 상태는 `pending`으로 시작한다. 회원은 본인 예약 목록/상세에서 처리 상태를 확인한다.
6. `pending`은 회원이 취소할 수 있다. `confirmed` 이후 취소는 정책에 따라 관리자에게 요청하고 관리자가 상태를 처리한다.
7. 예약 이력은 물리 삭제하지 않고 상태 변경으로 보존한다.

## 7. 관리자 흐름 및 대시보드

### 권한
- `admin` custom claim을 보유한 로그인 사용자만 관리자 화면과 쓰기 동작에 접근한다.
- 화면 가드와 별개로 RTDB Security Rules에서 권한을 강제한다.
- custom claim은 Admin SDK를 쓰는 보호된 운영 절차 또는 보호된 Cloud Function만 설정한다. 회원가입 UI에서 부여하지 않는다.

### 대시보드 위젯
- 전체/활성 회원 수
- 공개/초안 여행지 수
- 공개/초안 숙소 수
- 상태별 예약 수, 처리 대기 예약 수
- 최근 예약 5건, 최근 가입 회원 5명
- 빠른 작업: 여행지 추가, 숙소 추가, 대기 예약 보기

### 관리 기능
- **여행지**: 이름/지역/주소/소개 검색, 상태 확인, 목록, 등록/수정, 미리보기, 공개 전환, 보관, 삭제 확인. 연결 숙소/예약이 있으면 삭제 대신 보관 또는 연결 정리를 안내한다.
- **숙소**: 숙소명/연결 여행지/주소/소개/연락처 검색, 필수 항목 검증, 가격/수용 인원 수정, 공개 전환, 보관, 삭제 확인. 예약 이력이 있으면 물리 삭제하지 않는다.
- **회원**: 이름/이메일/연락처/UID 검색과 전체/관리자/사용자 필터를 함께 사용해 프로필을 찾고 확인한다. 관리자 권한은 custom claim을 기준으로 판정하며 프로필 역할은 표시용이다. 활성/정지. Auth 계정 삭제는 대시보드 MVP에서 제외하고 보호된 운영 절차로 처리한다.
- **예약**: 예약 ID/날짜/회원 연락처/숙소/상태 검색, 상세 보기, `pending`을 `confirmed` 또는 `rejected`로 처리, 허용되는 취소/완료 전환, 처리 시각 표시.
- 모든 변경과 삭제에는 확인 UI, 성공/오류 피드백을 제공한다. 로딩/빈 목록/오류 상태를 구분한다.

## 8. 주요 동작 및 품질
- 방문자는 `published` 여행지/숙소만 본다. 주변 숙소는 `destinationId`로 연결한다.
- 회원은 본인 예약만 읽는다. 관리자는 전체 예약을 관리한다.
- 예약 제출 시 날짜·인원·숙소 상태·현재 단가를 다시 검증하고 기본 상태 `pending`으로 저장한다.
- 반응형: 모바일 단일 열, 폼 전체 폭, 관리자 표의 카드 또는 가로 스크롤 대안, 터치 가능한 버튼, 키보드 포커스를 제공한다.
- Firebase 처리에는 로딩/성공/오류 피드백을 제공하고 토큰/내부 설정을 오류 화면에 노출하지 않는다.

## 9. 파일 구조 계획

```text
index.html
admin.html             # custom claim으로 보호하는 관리자 통합 대시보드
html/                 # 상세, 목록, 인증, 예약, 관리자 views
  reservation-create.html
  reservations.html
css/
  base.css             # 토큰, 리셋, 공통 글꼴
  account.css          # 인증 다이얼로그와 예약 양식
  admin.css            # 관리자 대시보드
  layout.css           # 헤더, 메뉴, 그리드, 반응형
  components.css       # 카드, 폼, 표, 배지, 모달
  pages.css            # 필요한 페이지 전용 스타일
js/
  firebase-config.js   # Firebase 앱/Auth/RTDB 초기화
  site-auth.js         # 회원가입/로그인/로그아웃, 관리자 claim 확인
  reservation-create.js
  reservations.js
  home.js
  admin.js             # 관리자 claim 가드, CRUD, 예약/회원 관리
  navigation.js        # 공통 메뉴
  destinations.js      # 여행지 조회/화면
  stays.js             # 숙소 조회/필터
  reservations.js      # 예약 검증/생성/조회
  admin.js             # 공통 관리자 가드/요약
  admin-destinations.js
  admin-stays.js
  admin-members.js
  admin-reservations.js
  validation.js        # 입력 검증/안전한 출력
database.rules.json    # RTDB 보안 규칙
tools/set_admin_claim.py  # 신뢰된 Admin SDK 운영 도구
tools/requirements-admin.txt
ADMIN_SETUP.md         # 관리자 custom claim 설정 절차
vercel.json            # 필요한 정적 경로 설정
.env.example           # 공개 웹 설정 변수 이름 안내만
README.md              # Firebase/GitHub/Vercel 설정 안내
```

## 10. 작업 순서: 구현부터 배포까지

1. Python 개발 서버를 `python -m http.server 8000`으로 실행하고, HTML/CSS/순수 JS로 공통 레이아웃과 목록·상세·폼 화면을 mock 데이터 기반으로 구현한다.
2. 개발 Firebase 프로젝트와 RTDB를 만들고 웹 앱 설정, 이메일/비밀번호 Auth, 허용 도메인을 설정한다.
3. 데이터 샘플과 `database.rules.json`을 준비한다. 초기 rules는 기본 거부로 두고 Emulator Suite 또는 개발 프로젝트에서 비로그인/회원/관리자 권한을 검증한다.
4. Firebase SDK 모듈을 연결해 인증, 회원 프로필, 공개 콘텐츠 조회, 예약과 관리자 CRUD 순으로 구현한다. 서비스 계정 키는 절대로 커밋하지 않는다.
5. 잘못된 날짜/인원/가격, 비공개 콘텐츠, 권한, 상태 전이, 모바일 화면을 검증한다.
6. GitHub 저장소에 업로드하기 전에 비밀 키와 개인 데이터를 검사한다.
7. Vercel에서 GitHub 저장소를 정적 사이트로 연결한다. Framework Preset `Other`, 빌드 명령 없음, Output Directory 루트. 공개 Firebase 웹 설정만 환경 변수로 제공한다.
8. Vercel 도메인을 Firebase Auth 승인 도메인에 추가하고 배포 URL에서 로그인, 공개 조회, 예약, 관리자 접근과 브라우저 오류를 확인한다.

## 11. 완료 기준
- 지정한 폴더 규칙의 반응형 화면에서 회원/관리자 주요 흐름을 수행할 수 있다.
- 네 논리 데이터 경로가 위 필드와 일치하고 회원 프로필이 Auth UID로 연결된다.
- 공개 사용자는 공개 콘텐츠 읽기만 가능, 회원은 자신의 정보/예약만 접근, 관리 권한은 custom claim으로 강제된다.
- 예약 데이터는 올바른 날짜·인원·숙소 가격을 사용하고 `pending`으로 시작한다.
- 로딩/빈/오류 상태와 모바일 레이아웃이 제공된다.
- 개발 환경 rules 검증 후 GitHub/Vercel 배포 URL에서 핵심 흐름을 확인한다.

## 12. 공식 참고 자료
- [Firebase Realtime Database 웹 시작](https://firebase.google.com/docs/database/web/start)
- [Realtime Database 보안 규칙](https://firebase.google.com/docs/database/security)
- [RTDB 규칙의 인증 정보와 custom claims](https://firebase.google.com/docs/database/security/rules-conditions)
- [Firebase custom claims 관리](https://firebase.google.com/docs/auth/admin/custom-claims)
- [Firebase 웹 설정](https://firebase.google.com/docs/web/setup)
