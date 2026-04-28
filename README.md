# 계약서식 자동완성 (contract-app)

청춘작당 협동조합 내부용. 계약서 PDF를 업로드하면 5종 한글 서식(계약 시 구비서류 / 착수계 / 선금신청서 / 완료계 / 청구서)을 자동 생성하고 Google Drive에 폴더링하여 저장한다.

## 핵심 기능

- Google OAuth 로그인 (Drive 업로드 권한 동시 위임)
- 프로젝트 = 계약서 1건. 생성 시 별도 입력 없이 PDF만 업로드
- 계약서에서 업체/계약일/금액/기간 등 자동 파싱, 누락 항목은 화면에서 보완
- 5종 서식 클릭 한 번으로 hwpx 생성 (기존 hwpx-contract 스킬 그대로 호출)
- 미생성 → "생성하기" / 생성됨 → "열기" + "재생성하기" 버튼
- 선금 신청금액을 상단에 1번 입력하면 청구서가 잔금(총액 − 선금)으로 자동 청구. 비우면 총액 청구
- 생성된 hwpx는 자동으로 `청춘작당/{연도}/{프로젝트명}/` Drive 폴더에 업로드

## 기술 스택

| 영역 | 선택 |
|------|------|
| 프레임워크 | Next.js 14 (App Router) + TypeScript |
| 스타일 | Tailwind CSS + shadcn/ui |
| 인증/DB | Firebase Auth (Google), Firestore |
| 파일 저장 | Firebase Storage (PDF 원본, hwpx 캐시) |
| Drive 연동 | googleapis (사용자 OAuth 위임) |
| HWP 생성 | Vercel Python Serverless가 hwpx-contract 스킬 그대로 호출 |
| 호스팅 | Vercel |

## 디렉토리 구조

```
contract-app/
├── app/                # Next.js 페이지
│   ├── layout.tsx
│   ├── globals.css
│   ├── page.tsx                # /        → /projects 또는 /login 리다이렉트
│   ├── login/page.tsx          # /login
│   ├── projects/
│   │   ├── page.tsx            # /projects (목록)
│   │   └── [id]/page.tsx       # /projects/[id] (상세)
│   └── api/                    # Node.js API Routes
│       ├── projects/route.ts   # 프로젝트 CRUD
│       ├── parse/route.ts      # PDF 파싱
│       └── drive/route.ts      # Drive 폴더/업로드
├── api/                # Vercel Python serverless (스킬 호출)
│   └── generate.py             # /api/generate
├── components/
│   ├── LoginButton.tsx
│   ├── ProjectCard.tsx
│   ├── ContractUpload.tsx
│   ├── ContractInfoPanel.tsx
│   └── FormGrid.tsx
├── lib/
│   ├── firebase-client.ts
│   ├── firebase-admin.ts
│   ├── auth.ts
│   ├── drive.ts
│   ├── parse.ts
│   └── types.ts
├── skill/              # ★ hwpx-contract 스킬 사본을 여기에 배치 ★
│   ├── SKILL.md
│   ├── scripts/
│   │   ├── fill_hwpx.py
│   │   └── make_bankbook_pdf.py
│   └── templates/
│       ├── 1__계약_시_구비서류.hwpx
│       ├── 2__착수계.hwpx
│       ├── 3__선금신청서.hwpx
│       ├── 4__완료계.hwpx
│       ├── 5__청구서.hwpx
│       ├── 청춘작당_통장사본.jpg
│       └── 팜앤디_통장사본.jpg
├── firebase.json
├── firestore.rules
├── storage.rules
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── next.config.mjs
└── .env.example
```

## 셋업 (최초 1회)

### 1. Firebase 프로젝트

```bash
# https://console.firebase.google.com 에서 프로젝트 생성 (예: contract-app)
firebase login
firebase use --add  # 위에서 만든 프로젝트 선택
```

활성화할 항목:
- Authentication → Sign-in method → **Google** 활성화
- Firestore Database → 생성 (asia-northeast3 권장)
- Storage → 생성

### 2. Google OAuth + Drive scope

Firebase Console > Authentication > Sign-in method > Google > **Web SDK 구성**에서 OAuth 2.0 client ID/Secret을 메모.

Google Cloud Console > APIs & Services:
- **OAuth consent screen**: Internal 또는 External 선택, scope에 `https://www.googleapis.com/auth/drive.file` 추가
- **Drive API** 활성화

### 3. Service Account (서버 측 Firestore/Storage 접근)

Firebase Console > 프로젝트 설정 > 서비스 계정 > 새 비공개 키 생성 → JSON 다운로드 → base64 인코딩하여 `.env`의 `FIREBASE_ADMIN_KEY_BASE64`에 저장.

```bash
base64 -i firebase-admin.json | pbcopy
```

### 4. 스킬 파일 복사

기존 `hwpx-contract` 스킬의 `SKILL.md`, `scripts/`, `templates/` 폴더를 이 프로젝트의 `skill/` 디렉토리로 복사.

```bash
cp -r ~/path/to/hwpx-contract/* contract-app/skill/
```

### 5. 환경변수

`.env.example` → `.env.local` 복사 후 값 채움:

```env
# Firebase Web SDK (클라이언트)
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...

# Firebase Admin (서버 전용)
FIREBASE_ADMIN_KEY_BASE64=...

# Drive 루트 폴더명
NEXT_PUBLIC_DRIVE_ROOT_FOLDER=계약 문서 관리
```

### 6. 로컬 실행

```bash
cd contract-app
npm install
npm run dev
```

http://localhost:3000 접속.

### 7. Vercel 배포

```bash
npm install -g vercel
vercel link
# 환경변수는 Vercel Dashboard > Settings > Environment Variables 에서 설정
vercel deploy --prod
```

`vercel.json` 의 `functions` 설정으로 `api/generate.py`가 Python 런타임으로 자동 빌드된다.

## 데이터 모델 (Firestore)

```
users/{uid}
  email: string
  displayName: string
  driveRefreshToken: string   # Drive 업로드용 (서버에서만 사용)

projects/{projectId}
  ownerId: string             # 생성자 uid
  contractPdfPath: string     # Storage 경로
  parsed: {                   # 계약서에서 자동 추출된 값
    company: string
    address: string
    representative: string
    contractDate: string      # YYYY. MM. DD.
    serviceName: string
    contractAmount: number    # 정수 (원)
    startDate: string
    endDate: string
    department: string|null   # 자동 추출 실패 시 null
  }
  manual: {                   # 사용자가 보완 입력한 값
    department?: string
    seongeumAmount?: number   # 선금 신청금액. 빈 값이면 청구서가 총액 청구
    submissionYear?: number
  }
  driveFolderId: string|null  # 생성된 Drive 폴더 ID
  forms: {
    "1__계약_시_구비서류": {
      generatedAt: Timestamp
      driveFileId: string
      driveFileUrl: string
      fileName: string
    }
    "2__착수계": { ... }
    ...
  }
  checklists: {                 # 서식별 제출 시 구비서류 체크 상태
    "1__계약_시_구비서류": [true, false, ...]   # CHECKLISTS[key].length 와 동일 길이
    "2__착수계": [false, false, false]
    "_선금_청구서": [...]       # 선금 청구 단계 가상 키 (선금 신청금액 입력 시에만 UI 노출)
    "5__청구서": [...]
  }
  createdAt: Timestamp
  updatedAt: Timestamp
```

체크리스트 정의는 `lib/checklists.ts` 의 `CHECKLISTS` 상수 단일 소스로 관리한다.
서식 제출 시 필요한 항목이 바뀌면 이 파일만 수정하면 UI가 자동으로 따라간다.

| 키 | 항목 수 | 비고 |
|----|--------|------|
| 1__계약_시_구비서류 | 5 | 산출내역서 / 인감 / 등기부 / 수입인지 / 등록면허 |
| 2__착수계 | 3 | 산출내역서 + 2부 출력·예정공정표 지침 |
| 3__선금신청서 | 2 | 청구서 동시 제출 / 신청금액·사용계획 작성 |
| _선금_청구서 | 7 | 보증서·완납증명서 등. **선금 입력 시에만 노출** |
| 4__완료계 | 0 | 별도 구비서류 없음 |
| 5__청구서 | 7 | 완료보고서·통장사본·완납증명서 등 |

## OAuth + Drive 흐름

```
1. 사용자가 "Google로 계속하기" 클릭
2. Firebase Auth가 Google OAuth 콜백 처리, Drive scope 포함하여 요청
3. 클라이언트가 access token (단명)과 refresh token (장기)을 획득
   ※ refresh token은 첫 로그인 시 1번만 발급됨. 콘솔에 prompt=consent 옵션 필요
4. refresh token을 서버 API로 보내 users/{uid}.driveRefreshToken에 저장
5. 이후 모든 Drive 요청은 서버에서 refresh token → access token 갱신 후 호출
```

`lib/drive.ts`가 폴더 검색·생성 후 파일 업로드를 처리. 폴더 구조:

```
내 드라이브
└── 계약 문서 관리                       ← NEXT_PUBLIC_DRIVE_ROOT_FOLDER
    └── 2026
        └── 곡성어린이도서관_도서관의날_기념행사
            ├── 1_계약시_구비서류.hwpx
            ├── 2_착수계.hwpx
            ├── 3_선금신청서.hwpx
            ├── 4_완료계.hwpx
            ├── 5_청구서.hwpx
            └── 통장사본_청춘작당_협동조합.pdf
```

연도 = 계약일자 연도. 프로젝트 폴더명 = 용역명 슬러그(공백/특수문자 → `_`).

## 서식 생성 흐름

1. 사용자가 서식 타일에서 "생성하기" 또는 "재생성하기" 클릭
2. 클라이언트가 `/api/generate` (Python serverless) 호출. 페이로드 = projectId + 사용할 값들 + 템플릿 키
3. Python 함수가 `skill/scripts/fill_hwpx.py` 호출하여 hwpx 생성 후 base64로 응답
4. Next.js API Route가 받아서:
   - Firebase Storage에 캐시 (선택)
   - Drive에 업로드 → fileId/URL 획득
   - Firestore `projects/{id}.forms.{key}` 업데이트
5. UI에 즉시 반영 ("열기" + "재생성하기" 버튼)

## 운영 노트

- 단일 조직 / 소수 사용자 → Firebase 무료 등급 충분
- PDF 파싱 정확도가 100%는 아니므로 항상 화면에서 사용자 검토/보완을 받는다
- 재생성 시 기존 Drive 파일은 덮어쓰기 (같은 fileId update)하여 Drive 링크가 바뀌지 않게 한다
- 통장사본 PDF는 청구서 생성 시 함께 업로드된다
