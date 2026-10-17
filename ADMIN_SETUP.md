# 관리자 계정 준비

관리자 로그인은 별도 `admin` 아이디가 아니라 Firebase Authentication에 등록된 관리자 본인의 이메일과 비밀번호를 입력합니다. 로그인 시 Auth의 `admin: true` custom claim을 확인하므로 해당 claim이 설정된 이메일 계정만 관리자 대시보드에 접근할 수 있습니다.

Firebase Auth 로그인만으로는 관리자 권한이 생기지 않습니다. 대시보드는 신뢰된 Firebase Auth custom claim `admin: true`도 확인하고, RTDB 규칙도 같은 claim을 확인합니다. 웹 설정의 이메일 주소나 회원 프로필 값은 관리자 권한의 근거가 되지 않습니다.

## 관리자 권한 지정

1. Firebase Console → Authentication → 사용자에서 관리자 계정을 찾고 UID를 복사합니다.
2. Firebase Console의 프로젝트 설정 → 서비스 계정에서 Admin SDK 키를 생성합니다. 키 파일은 프로젝트 폴더 밖의 안전한 위치에 보관하고 커밋하지 않습니다.
3. 프로젝트 루트에서 `python -m pip install -r tools/requirements-admin.txt`를 실행합니다.
4. 아래 명령에서 Firebase Authentication에 등록된 UID 또는 이메일과 키 파일 경로를 실제 값으로 바꿔 실행합니다. 이 도구는 custom claim을 설정하고 `/members/{uid}` 프로필에 `role: "admin"`도 기록합니다.

```powershell
python tools/set_admin_claim.py 관리자이메일@example.com --credentials "C:\secure\travel-service-account.json"
```

5. 프로젝트에 규칙을 게시할 수 있는 Firebase 계정으로 CLI 로그인 상태를 확인합니다. 프로젝트 루트에서 `firebase login` 후 `firebase projects:list`에 `travel-30c1b`가 나타나는지 확인하고, 나타나지 않으면 해당 Google 계정에 Firebase 프로젝트 권한을 부여해야 합니다.
6. `firebase.json`은 `database.rules.json`을 RTDB 규칙 파일로 지정하고 `.firebaserc`는 프로젝트 ID를 지정합니다. 게시 전 규칙을 검토한 뒤 프로젝트 루트에서 `firebase deploy --only database --project travel-30c1b`를 실행하거나, Firebase Console → Realtime Database → Rules에서 같은 JSON을 게시합니다. 이 규칙은 공개 여행지/숙소 읽기, 회원 본인 프로필/예약, 관리자 작업을 구분합니다.
7. 관리자 계정에서 로그아웃한 뒤 실제 관리자 이메일로 다시 로그인합니다. ID 토큰을 새로 받아야 custom claim이 반영됩니다.
8. 기존 관리자가 회원정보 화면에 사용자로 표시된다면 업데이트된 설정 도구를 같은 이메일로 다시 실행해 `role: "admin"` 프로필을 기록합니다.

회원가입은 Firebase Authentication 계정 생성 후 `/members/{uid}`에 프로필을 저장합니다. 일시적인 DB 오류로 프로필 저장만 실패한 경우, 회원이 다시 로그인하면 앱이 본인 프로필이 없는지 확인하고 최소 프로필을 복구합니다. 비밀번호는 RTDB에 저장하지 않습니다.

현재 RTDB 규칙은 다음 접근을 허용합니다.

- 비로그인 방문자: `status=published` 조건으로 여행지/숙소 조회
- 회원: 본인 프로필 조회 및 본인 UID의 프로필 최초 생성, 본인 예약 생성/조회/대기 예약 취소
- 관리자: `admin: true` custom claim이 있는 계정만 회원/예약 열람 및 여행지·숙소·예약 관리. 회원 목록의 `role` 구분은 표시용이며 권한을 부여하지 않음

규칙 게시 전에는 Emulator Suite 또는 별도 개발 프로젝트에서 회원 및 관리자 흐름을 확인하고, 실제 프로젝트에 적용된 규칙 화면에서 게시 시각과 내용을 확인하세요.

Admin SDK 키 파일과 그 내용은 브라우저 코드, 프로젝트 폴더, Git 저장소에 넣지 마세요.
