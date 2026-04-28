/**
 * 서식별 제출 시 구비서류 체크리스트.
 *
 * type:
 *  - "doc"  : 서류 준비 항목. 진행도(2/5)에 카운트됨
 *  - "note" : 안내·지침. 카운트 제외 (예: "착수계 2부 출력")
 *  - "cond" : 조건부 항목. 카운트되며 note에 조건 명시 (예: "총액 2천만원 초과 시")
 */

export type ChecklistItemType = "doc" | "note" | "cond";

export interface ChecklistItem {
  type: ChecklistItemType;
  text: string;
  /** 조건부 항목의 부연 설명 (cond 타입) */
  note?: string;
}

/**
 * 체크리스트 키. 5종 서식 키 외에 "_선금_청구서"는 선금 청구 단계 전용 가상 키.
 * 선금 신청금액이 입력된 경우에만 UI에 노출된다.
 */
export type ChecklistKey =
  | "1__계약_시_구비서류"
  | "2__착수계"
  | "3__선금신청서"
  | "_선금_청구서"
  | "4__완료계"
  | "5__청구서";

export const CHECKLISTS: Record<ChecklistKey, ChecklistItem[]> = {
  "1__계약_시_구비서류": [
    { type: "doc", text: "산출내역서" },
    { type: "doc", text: "법인 인감증명서" },
    { type: "doc", text: "법인 등기부등본" },
    { type: "doc", text: "정부 수입인지 (나라장터 시 전자납부)" },
    { type: "doc", text: "기타 필요한 등록 / 면허 / 허가 / 신고" },
  ],
  "2__착수계": [
    { type: "note", text: "착수계는 2부 출력하여 제출" },
    { type: "doc", text: "산출내역서 추가" },
    { type: "note", text: "한글파일에서 예정공정표 추가 수정" },
  ],
  "3__선금신청서": [
    { type: "note", text: "청구서와 함께 제출" },
    { type: "note", text: "선금급 신청금액·사용계획을 최종 견적서에 맞추어 작성" },
  ],
  "_선금_청구서": [
    { type: "doc", text: "선금급 이행 보증서" },
    { type: "doc", text: "선금 보증보험" },
    { type: "cond", text: "지역개발공채", note: "총액 2천만원 초과 시" },
    { type: "doc", text: "국세 완납증명서" },
    { type: "doc", text: "지방세 완납증명서" },
    { type: "doc", text: "4대보험 완납증명서" },
    { type: "cond", text: "전자세금계산서", note: "차후 계약팀 요청 시" },
  ],
  "4__완료계": [],
  "5__청구서": [
    { type: "doc", text: "완료보고서" },
    { type: "cond", text: "지역개발공채", note: "총액 2천만원 초과 시 — 군청농협 발급" },
    { type: "doc", text: "국세 완납증명서" },
    { type: "doc", text: "지방세 완납증명서" },
    { type: "doc", text: "법인 통장 사본" },
    { type: "doc", text: "4대보험 완납증명서" },
    { type: "cond", text: "전자세금계산서", note: "차후 계약팀 요청 시" },
  ],
};

/** UI에 표시할 순서·라벨 정의. 워크플로우 순서대로 정렬. */
export interface ChecklistDisplay {
  key: ChecklistKey;
  label: string;
  /** true면 manual.seongeumAmount가 입력된 경우에만 노출 */
  onlyIfSeongeum?: boolean;
  /** 라벨 옆 작은 배지 */
  extraTag?: string;
}

export const CHECKLIST_ORDER: ChecklistDisplay[] = [
  { key: "1__계약_시_구비서류", label: "계약 시 구비서류" },
  { key: "2__착수계", label: "착수계" },
  { key: "3__선금신청서", label: "선금신청서" },
  { key: "_선금_청구서", label: "선금 청구서", onlyIfSeongeum: true, extraTag: "선금 신청 시" },
  { key: "4__완료계", label: "완료계" },
  { key: "5__청구서", label: "청구서 (잔금/총액)" },
];

/** 진행도 계산 (doc + cond만 카운트, note 제외) */
export function progressOf(key: ChecklistKey, checks: boolean[] | undefined) {
  const items = CHECKLISTS[key] || [];
  const counted = items
    .map((it, i) => ({ it, checked: !!checks?.[i] }))
    .filter((x) => x.it.type !== "note");
  const total = counted.length;
  const done = counted.filter((x) => x.checked).length;
  return { total, done };
}
