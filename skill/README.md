# skill/ 디렉토리

여기에 기존 `hwpx-contract` 스킬의 파일들을 복사해 넣으세요. 빌드 시 Vercel Python serverless가 이 폴더의 파일들을 번들링하여 사용합니다.

## 필요 파일

```
skill/
├── SKILL.md                       # 스킬 명세 (참조용)
├── scripts/
│   ├── fill_hwpx.py               # 핵심 hwpx 채움 로직 (★ 패치된 버전 사용 ★)
│   └── make_bankbook_pdf.py       # 청구서용 통장사본 PDF 생성
└── templates/
    ├── 1__계약_시_구비서류.hwpx
    ├── 2__착수계.hwpx
    ├── 3__선금신청서.hwpx
    ├── 4__완료계.hwpx
    ├── 5__청구서.hwpx
    ├── 청춘작당_통장사본.jpg
    └── 팜앤디_통장사본.jpg
```

## 패치된 fill_hwpx.py 사용

원본 스킬에 다음 3가지 패치가 누적된 버전을 사용해야 합니다:

1. **`apply_cheonggu_amount`** — 청구서의 청구금액({{7}}과 분리)을 `_cheonggu_amount` 키로 별도 입력
2. **`num_to_korean` 회계 규약** — 천/백/십 자리 1을 생략하지 않고 항상 "일" 접두 유지 (예: 일천사만)
3. **`apply_submission_year`** — 모든 양식의 제출일 연도를 `_submission_year` (또는 {{10}} 연도, 오늘 연도)로 자동 치환

이 패치는 이전 세션의 outputs/hwpx-contract_patch/ 에 정리된 것을 그대로 가져다 쓰면 됩니다.

```bash
# 예시 (사용자의 실제 경로에 맞게 수정)
cp -r ~/path/to/hwpx-contract_patch/scripts/fill_hwpx.py contract-app/skill/scripts/
cp ~/path/to/hwpx-contract/scripts/make_bankbook_pdf.py contract-app/skill/scripts/
cp -r ~/path/to/hwpx-contract/templates/* contract-app/skill/templates/
cp ~/path/to/hwpx-contract_patch/SKILL.md contract-app/skill/
```

## 동작 확인 (로컬)

```bash
python3 skill/scripts/fill_hwpx.py \
  skill/templates/5__청구서.hwpx \
  /tmp/test.hwpx \
  '{"1":"청춘작당 협동조합","2":"전라남도 곡성군 죽곡면 화양기동길 23-12","3":"민찬양","5":"2026. 03. 17.","6":"테스트 용역","7":"일금 이천만원정 (₩20,000,000)","9":"2026. 03. 19.","10":"2026. 05. 17.","_cheonggu_amount":10000000}'
```

위가 정상 동작하면 Vercel 배포 시에도 `api/generate.py`가 같은 로직을 호출해서 동작합니다.
