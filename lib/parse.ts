/**
 * 한글 금액 변환 헬퍼.
 * (PDF 파싱은 api/parse.py 의 pdfplumber 기반 추출로 이전됨 — 한국어 PDF 의
 *  공백 손실 문제를 char-level 좌표로 복원하기 위함.)
 */

const DIGITS = ["", "일", "이", "삼", "사", "오", "육", "칠", "팔", "구"];
const SMALL = ["", "십", "백", "천"];
const LARGE = ["", "만", "억", "조"];

/**
 * 정수 → 한글 금액. 회계 규약에 따라 천/백/십 자리 1을 생략하지 않고
 * 항상 "일" 접두를 유지한다.
 * 예: 10,040,000 → "일천사만"  /  20,080,000 → "이천팔만"
 */
export function numToKorean(n: number): string {
  if (!n) return "영";
  let result = "";
  let unitIdx = 0;
  while (n > 0) {
    const chunk = n % 10000;
    if (chunk) {
      let chunkStr = "";
      for (let i = 0; i < 4; i++) {
        const d = Math.floor(chunk / Math.pow(10, i)) % 10;
        if (d) chunkStr = DIGITS[d] + SMALL[i] + chunkStr;
      }
      result = chunkStr + LARGE[unitIdx] + result;
    }
    n = Math.floor(n / 10000);
    unitIdx++;
  }
  return result;
}

/** 계약금액 표기. 예: 20080000 → "일금 이천팔만원정 (₩20,080,000)" */
export function formatContractAmount(n: number): string {
  return `일금 ${numToKorean(n)}원정 (₩${n.toLocaleString("en-US")})`;
}

/** 청구서 청구금액 표기. 예: 10040000 → "금 일천사만원정 (￦ 10,040,000)" */
export function formatCheongguAmount(n: number): string {
  return `금 ${numToKorean(n)}원정 (￦ ${n.toLocaleString("en-US")})`;
}
