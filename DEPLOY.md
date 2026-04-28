# 배포 가이드 (로컬 도구 없이, 웹만으로)

소요 시간: 약 40~60분. 한 번 세팅하면 이후엔 GitHub에 push 하기만 하면 자동 배포된다.

전체 흐름:
```
[Phase 1] 스킬 템플릿 준비       ← 1회
[Phase 2] GitHub 레포 생성/업로드 ← 1회
[Phase 3] Firebase 프로젝트 세팅  ← 1회
[Phase 4] Google OAuth + Drive   ← 1회
[Phase 5] Vercel 배포             ← 첫 1회 + 환경변수
[Phase 6] 동작 확인               ← 끝
```

---

## Phase 1. 스킬 템플릿 파일 준비 ⚠ 필수

`contract-app/skill/templates/` 폴더는 비어 있습니다. 여기에 다음 7개 파일을 채워야 합니다.

```
skill/templates/
├── 1__계약_시_구비서류.hwpx
├── 2__착수계.hwpx
├── 3__선금신청서.hwpx
├── 4__완료계.hwpx
├── 5__청구서.hwpx
├── 청춘작당_통장사본.jpg
└── 팜앤디_통장사본.jpg
```

이 파일들은 기존에 사용하시던 hwpx-contract 스킬 폴더에 있습니다.

### 찾는 방법

Cowork 앱이 plugin을 설치한 폴더를 Finder로 열어 봅니다:

1. Finder를 열고 메뉴에서 **이동 → 폴더로 이동...** (또는 `Cmd + Shift + G`)
2. 다음 경로 입력:
   ```
   /var/folders
   ```
3. `claude-hostloop-plugins` 또는 비슷한 이름의 폴더 안에서 `skills/hwpx-contract/templates/` 를 찾아 7개 파일 복사

**또는** 스킬을 처음에 만들었던 원본 소스(.plugin 파일, 깃 저장소 등)에 templates 폴더가 있을 수도 있습니다. 그쪽이 더 빠릅니다.

### 어디에 둘 것인가

GitHub 업로드 (Phase 2)를 하기 전에 컴퓨터의 contract-app 폴더 안 `skill/templates/` 에 7개 파일을 모두 넣어두세요.

---

## Phase 2. GitHub 레포 생성 + 코드 업로드

### 2-1. GitHub 가입 (이미 있으면 스킵)
- https://github.com/signup 접속
- "Continue with Google" 으로 jay@151201team.com 계정 사용
- username 정하기 (예: jay-151201)

### 2-2. 새 레포 만들기
- GitHub 좌상단 + 버튼 → **New repository**
- Repository name: `contract-app`
- Visibility: **Private** 권장 (내부 도구)
- ✅ "Add a README file" 은 체크 해제 (이미 README.md 있음)
- **Create repository** 클릭

### 2-3. 파일 업로드
새로 만든 레포 화면에서:
- "uploading an existing file" 링크 클릭 (또는 Add file → Upload files)
- contract-app 폴더 안의 **모든 파일·폴더를 드래그** (zip을 먼저 압축 해제 필요)
  - macOS: zip 파일 더블클릭하면 같은 위치에 contract-app 폴더 생성됨
  - Phase 1에서 채워 넣은 skill/templates 도 함께 올라가야 함
- Commit changes 메시지: `Initial commit` → **Commit changes** 클릭

⚠ 한 번에 100MB 이상은 web upload가 막힙니다. 우리 파일은 1~2MB 수준이라 문제 없습니다.

### 2-4. 업로드 확인
레포 화면에 다음 폴더들이 보이면 OK:
- `app/`, `api/`, `components/`, `lib/`, `skill/`, `package.json`, `vercel.json`, `README.md`...

---

## Phase 3. Firebase 프로젝트 세팅

### 3-1. 프로젝트 생성
- https://console.firebase.google.com → **프로젝트 추가**
- 프로젝트 이름: `contract-app` (또는 원하는 이름)
- Google Analytics: 끄기 (불필요)
- **프로젝트 만들기**

### 3-2. Authentication 활성화
- 좌측 메뉴 **빌드 → Authentication**
- **시작하기** → **Sign-in method** 탭
- **Google** 클릭 → **사용 설정** → 프로젝트 지원 이메일 선택 → 저장

### 3-3. Firestore 활성화
- 좌측 메뉴 **빌드 → Firestore Database**
- **데이터베이스 만들기** → **프로덕션 모드** 선택
- 위치: **asia-northeast3 (서울)** 권장 → 사용 설정

규칙 페이지에서 **규칙** 탭 → 우리 레포의 `firestore.rules` 내용을 복사해서 붙여넣고 **게시**.

### 3-4. Storage 활성화
- 좌측 메뉴 **빌드 → Storage**
- **시작하기** → 위치 같음(서울) → 완료

규칙 탭 → 레포의 `storage.rules` 내용 붙여넣고 **게시**.

### 3-5. Web 앱 등록 + 환경변수 추출
- 프로젝트 개요 페이지 상단 **웹(</>)** 아이콘 클릭
- 앱 닉네임: `contract-app-web` → **앱 등록**
- 다음 화면에 표시되는 `firebaseConfig` 내용을 메모장에 복사 (예시):
  ```js
  const firebaseConfig = {
    apiKey: "AIza...",
    authDomain: "contract-app-xxxxx.firebaseapp.com",
    projectId: "contract-app-xxxxx",
    storageBucket: "contract-app-xxxxx.appspot.com",
    messagingSenderId: "1234567890",
    appId: "1:1234567890:web:abcdef..."
  };
  ```
- 이 값들이 그대로 `NEXT_PUBLIC_FIREBASE_*` 환경변수가 됩니다.

### 3-6. 서비스 계정 키 (서버용)
- 좌측 톱니 아이콘 → **프로젝트 설정** → **서비스 계정** 탭
- **새 비공개 키 생성** → **키 생성** → JSON 파일 다운로드
- 이 JSON 내용을 base64로 인코딩해야 합니다:
  - **간단한 방법**: https://www.base64encode.org/ 에 JSON 내용 통째로 붙여넣고 **ENCODE** → 출력값 복사
  - 이 base64 문자열이 `FIREBASE_ADMIN_KEY_BASE64` 환경변수가 됩니다.
- ⚠ JSON 파일은 절대 GitHub에 올리지 말 것 (`.gitignore`에 이미 차단됨)

---

## Phase 4. Google OAuth + Drive API

### 4-1. Google Cloud Console 진입
- https://console.cloud.google.com → 우측 상단 프로젝트 선택 → 방금 만든 Firebase 프로젝트와 동일 이름 선택 (Firebase 프로젝트는 자동으로 GCP 프로젝트도 생성됩니다)

### 4-2. Drive API 활성화
- 검색창에 "Google Drive API" → 클릭 → **사용** 버튼

### 4-3. OAuth 동의 화면
- 좌측 메뉴 **API 및 서비스 → OAuth 동의 화면**
- User Type: **Internal** (Google Workspace) 또는 **External** (개인 계정)
  - 151201team.com 도메인이 Workspace면 **Internal** 선택 가능 (검수 불필요)
  - 그 외 **External** + 테스트 사용자에 본인 이메일 추가
- 앱 이름: `계약서식 자동완성`
- 사용자 지원 이메일·개발자 이메일: jay@151201team.com
- **저장 후 계속**

### 4-4. 범위(Scope) 추가
- 다음 화면 **범위 추가 또는 삭제** → 검색에 "drive" 입력 → **`.../auth/drive.file`** 체크 → 업데이트
- (drive.file은 앱이 만든/연 파일만 접근 — 가장 안전한 범위)
- 저장 후 계속

### 4-5. OAuth 클라이언트 (생략 가능)
별도 OAuth 클라이언트는 만들 필요 없습니다. Firebase Auth의 Google 공급자가 자동으로 OAuth 클라이언트를 생성·관리합니다. 우리 코드는 `signInWithPopup` 으로 받은 access token 으로 Drive 호출하므로 client_id/secret을 직접 환경변수에 둘 필요가 없습니다.

(추후 refresh token 흐름이 필요해지면 그때 별도 클라이언트 만들고 `GOOGLE_OAUTH_CLIENT_ID/SECRET` 추가 가능)

### 4-6. 승인된 도메인 (Vercel 배포 후 추가)
Firebase Console → Authentication → Settings → 승인된 도메인 에 기본값으로 `localhost`, `{projectId}.firebaseapp.com`, `{projectId}.web.app` 이 들어 있습니다. **Phase 5에서 Vercel 도메인이 정해지면 그 도메인을 추가** 합니다.

---

## Phase 5. Vercel 배포

### 5-1. Vercel 가입
- https://vercel.com/signup → **Continue with GitHub**
- GitHub 권한 승인

### 5-2. 프로젝트 임포트
- Vercel 대시보드 → **Add New → Project**
- GitHub 레포 목록에서 `contract-app` 옆 **Import**
- Framework Preset: Next.js (자동 인식됨)
- Root Directory: 그대로 (`./`)
- **Configure Project** 펼치기

### 5-3. 환경변수 입력
**Environment Variables** 섹션에 다음 값들을 추가 (이름과 값을 정확히 일치시킬 것):

| Key | Value |
|-----|-------|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase 3-5의 apiKey |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase 3-5의 authDomain |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase 3-5의 projectId |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Firebase 3-5의 storageBucket |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Firebase 3-5의 messagingSenderId |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Firebase 3-5의 appId |
| `FIREBASE_ADMIN_KEY_BASE64` | Phase 3-6의 base64 인코딩 결과 |
| `NEXT_PUBLIC_DRIVE_ROOT_FOLDER` | `계약 문서 관리` |

### 5-4. Deploy
- **Deploy** 버튼 클릭
- 빌드 로그가 흘러가고 2~5분 후 완료
- 배포된 URL 확인 (예: `contract-app-xxxx.vercel.app`)

### 5-5. 도메인 정리
- Vercel은 임의의 도메인을 부여합니다. 원하면 Project Settings → Domains 에서 `contract-app.vercel.app` 같은 짧은 이름으로 변경 가능.
- 변경 시 Phase 4-5의 OAuth "승인된 자바스크립트 출처"에 새 도메인 추가하고, Firebase Auth → Settings → 승인된 도메인에도 추가.

---

## Phase 6. 동작 확인

1. 배포된 URL 접속
2. **Google로 계속하기** 클릭 → Drive 권한 동의
3. 계약서 PDF 업로드 → 계약 정보 자동 추출 확인
4. 발주부서 직접 입력 (필요 시)
5. **5종 서식 중 하나 "생성하기"** → 1~3초 후 "파일 열기" 버튼 등장
6. 본인 Google Drive 접속 → `청춘작당/{연도}/{용역명}/` 폴더에 hwpx 생성 확인

---

## 트러블슈팅

| 증상 | 원인 / 해결 |
|------|------------|
| 로그인 후 화이트 스크린 | `NEXT_PUBLIC_FIREBASE_*` 환경변수 누락. Vercel Settings → Environment Variables 확인 |
| `auth/popup-blocked` | 브라우저가 팝업 차단. 사이트별 허용 |
| Drive 업로드 시 401 | OAuth 동의 화면에 drive.file scope 미추가 또는 사용자가 권한 거부. 다시 로그인 필요 |
| `/api/parse` 500 에러 | `api/requirements.txt` 의 pdfplumber 가 빌드 안됨. Vercel 빌드 로그 확인 |
| `/api/generate` 500 에러 | `skill/templates/` 가 비어 있음 (Phase 1 누락). GitHub에 templates 7개 파일 push 했는지 확인 |
| Firestore 권한 거부 | `firestore.rules` 미적용. Phase 3-3 의 규칙 게시 다시 확인 |

---

## 이후 운영

- 코드 수정은 GitHub 웹 에디터에서 파일 클릭 → 연필 아이콘으로 수정 → Commit
- Commit 즉시 Vercel 자동 빌드/배포
- 배포 이력은 Vercel Dashboard → Deployments
