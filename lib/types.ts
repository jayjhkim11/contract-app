// 5종 서식 키. fill_hwpx.py 의 템플릿 파일명과 1:1 대응.
export const FORM_KEYS = [
  "1__계약_시_구비서류",
  "2__착수계",
  "3__선금신청서",
  "4__완료계",
  "5__청구서",
] as const;

export type FormKey = (typeof FORM_KEYS)[number];

export const FORM_LABEL: Record<FormKey, string> = {
  "1__계약_시_구비서류": "계약 시 구비서류",
  "2__착수계": "착수계",
  "3__선금신청서": "선금신청서",
  "4__완료계": "완료계",
  "5__청구서": "청구서",
};

// 계약서 자동 추출값. parse.ts 가 생성.
export interface ParsedContract {
  company: string;
  address: string;
  representative: string;
  contractDate: string; // YYYY. MM. DD.
  serviceName: string;
  contractAmount: number; // 정수 (원)
  startDate: string;
  endDate: string;
  department: string | null; // 추출 실패 가능 → 사용자 보완
}

// 사용자가 화면에서 보완 입력한 값.
export interface ManualOverrides {
  department?: string;
  // 선금 신청금액. 비우면 청구서가 총액 청구.
  seongeumAmount?: number;
  // 제출일 연도. 미입력 시 계약종료일 연도 사용.
  submissionYear?: number;
}

export interface FormGenerationRecord {
  generatedAt: string; // ISO
  driveFileId: string;
  driveFileUrl: string;
  fileName: string;
  // 청구서/통장사본의 부속 파일 (PDF 통장사본 등)
  extraFiles?: { driveFileId: string; driveFileUrl: string; fileName: string }[];
}

/**
 * 체크리스트 진행 상태. 키별로 [boolean, boolean, ...] 배열.
 * 길이는 lib/checklists.ts CHECKLISTS[key]의 items.length 와 동일하게 유지된다.
 */
export type ChecklistState = Partial<Record<string, boolean[]>>;

/** 어느 아코디언이 펼쳐져 있는지 (UI 상태). Firestore에 저장하지 않아도 무방. */
export type OpenChecklistsState = Partial<Record<string, boolean>>;

export interface Project {
  id: string;
  ownerId: string;
  contractPdfPath: string;
  parsed: ParsedContract;
  manual: ManualOverrides;
  driveFolderId: string | null;
  forms: Partial<Record<FormKey, FormGenerationRecord>>;
  /** 서식별 구비서류 체크리스트 진행 상태 */
  checklists: ChecklistState;
  createdAt: string;
  updatedAt: string;
}

// /api/generate 요청/응답 타입
export interface GenerateRequest {
  projectId: string;
  formKey: FormKey;
  values: Record<string, string | number>; // {{1}}~{{10}} + _cheonggu_amount, _seongeum_rate, _submission_year 등
}

export interface GenerateResponse {
  fileName: string;
  hwpxBase64: string;
  // 청구서일 때만 통장사본 PDF 동봉
  bankbookPdfBase64?: string;
  bankbookFileName?: string;
}
