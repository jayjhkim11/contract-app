"use client";

import { useEffect, useState } from "react";
import type { Project } from "@/lib/types";

interface Props {
  project: Project;
  onSave: (manual: Project["manual"]) => Promise<void>;
}

/** 계약 총액과 비율(0~100)로부터 선금 금액 계산 (원 미만 버림). */
function calcSeongeum(total: number, rate: number): number {
  if (!total || !rate) return 0;
  return Math.floor((total * rate) / 100);
}

/** "YYYY. MM. DD." 또는 "YYYY. MM.    ." 등을 {y, m, d} 로 분해. */
function parseSubmissionDate(s: string | undefined): { y: string; m: string; d: string } {
  if (!s) return { y: "", m: "", d: "" };
  const m = s.match(/^(\d{4})\.\s*(\d{1,2})\.\s*(\d{0,2})\.?$/);
  if (!m) return { y: "", m: "", d: "" };
  return { y: m[1], m: m[2].padStart(2, "0"), d: m[3] ? m[3].padStart(2, "0") : "" };
}

/** {y, m, d} → "YYYY. MM. DD." 또는 "YYYY. MM.    ." (일자 비움 시 4 스페이스). */
function buildSubmissionDate(y: string, m: string, d: string): string | undefined {
  if (!y || !m) return undefined;
  const yy = y.padStart(4, "0");
  const mm = m.padStart(2, "0");
  if (d) {
    const dd = d.padStart(2, "0");
    return `${yy}. ${mm}. ${dd}.`;
  }
  return `${yy}. ${mm}.    .`;
}

/**
 * 계약서에서 추출된 정보 + 사용자 보완 입력 (발주부서/선금 비율/제출일) 통합 패널.
 * 변경 시 onSave로 호출자에게 알린다.
 *
 * 제출일은 연/월(필수)/일(선택) 으로 분리 입력. 일자를 비우면 hwpx 출력에
 * 'YYYY. MM.    .' 형식으로 들어가 사용자가 출력 후 수기 기입할 수 있다.
 */
export default function ContractInfoPanel({ project, onSave }: Props) {
  const [department, setDepartment] = useState(
    project.manual.department ?? project.parsed.department ?? ""
  );
  const [seongeumRate, setSeongeumRate] = useState<string>(
    project.manual.seongeumRate != null ? String(project.manual.seongeumRate) : ""
  );
  const initial = parseSubmissionDate(project.manual.submissionDate);
  const [subY, setSubY] = useState(initial.y);
  const [subM, setSubM] = useState(initial.m);
  const [subD, setSubD] = useState(initial.d);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setDirty(true);
    const t = setTimeout(async () => {
      setSaving(true);
      const rate = seongeumRate ? Number(seongeumRate) : undefined;
      await onSave({
        department: department || undefined,
        seongeumRate: rate && rate > 0 ? rate : undefined,
        submissionDate: buildSubmissionDate(subY, subM, subD),
      });
      setSaving(false);
      setDirty(false);
    }, 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [department, seongeumRate, subY, subM, subD]);

  const p = project.parsed;
  const total = p.contractAmount;
  const rateNum = Number(seongeumRate) || 0;
  const seongeumAmount = calcSeongeum(total, rateNum);
  const claim = seongeumAmount > 0 ? total - seongeumAmount : total;

  // 제출일 미리보기 (사용자에게 어떻게 출력될지 보여줌)
  const submissionPreview = buildSubmissionDate(subY, subM, subD);

  return (
    <section>
      <div className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        계약서 정보 (자동 추출){saving ? " · 저장 중" : dirty ? "" : " · 저장됨"}
      </div>
      <div className="rounded-lg border border-border">
        <Row label="업체명" value={p.company} />
        <Row label="소재지" value={p.address} />
        <Row label="대표자" value={p.representative} />
        <Row label="용역명" value={p.serviceName} />
        <Row label="계약일자" value={p.contractDate} />
        <Row label="계약금액" value={`₩ ${total.toLocaleString("en-US")}`} />
        <Row label="계약기간" value={`${p.startDate} ~ ${p.endDate}`} />
        <RowInput
          label="발주부서"
          required={!p.department}
          placeholder={p.department ? "" : "추출 실패 — 직접 입력 (예: 곡성어린이도서관)"}
          value={department}
          onChange={setDepartment}
        />
        <RowInput
          label="선금 신청비율"
          placeholder="비우면 청구서가 총액으로 청구됩니다"
          value={seongeumRate}
          onChange={(v) => {
            const cleaned = v.replace(/[^\d.]/g, "").slice(0, 5);
            const num = Number(cleaned);
            if (cleaned === "" || (num >= 0 && num <= 100)) setSeongeumRate(cleaned);
          }}
          suffix="%"
          hint={
            rateNum > 0
              ? `≈ 선금 ₩${seongeumAmount.toLocaleString("en-US")}`
              : undefined
          }
        />
        {/* 제출일: 연/월(필수) + 일(옵션) — 일자 비우면 hwpx 에 빈 칸으로 출력 */}
        <div className="grid grid-cols-[140px_1fr] items-start gap-3 border-b border-border px-4 py-2.5 text-sm last:border-0">
          <div className="pt-1.5 text-muted-foreground">제출일</div>
          <div>
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                inputMode="numeric"
                maxLength={4}
                placeholder="YYYY"
                value={subY}
                onChange={(e) => setSubY(e.target.value.replace(/\D/g, "").slice(0, 4))}
                className="w-16 rounded-md border border-border px-2 py-1.5 text-sm focus:border-primary focus:outline-none"
              />
              <span className="text-muted-foreground">.</span>
              <input
                type="text"
                inputMode="numeric"
                maxLength={2}
                placeholder="MM"
                value={subM}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, "").slice(0, 2);
                  const n = Number(v);
                  if (v === "" || (n >= 0 && n <= 12)) setSubM(v);
                }}
                className="w-12 rounded-md border border-border px-2 py-1.5 text-sm focus:border-primary focus:outline-none"
              />
              <span className="text-muted-foreground">.</span>
              <input
                type="text"
                inputMode="numeric"
                maxLength={2}
                placeholder="DD (옵션)"
                value={subD}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, "").slice(0, 2);
                  const n = Number(v);
                  if (v === "" || (n >= 0 && n <= 31)) setSubD(v);
                }}
                className="w-20 rounded-md border border-border px-2 py-1.5 text-sm focus:border-primary focus:outline-none"
              />
              <span className="text-muted-foreground">.</span>
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {submissionPreview
                ? <>출력: <code className="rounded bg-muted px-1.5 py-0.5">{submissionPreview}</code> {!subD && <span className="text-amber-700">— 일자는 출력 후 수기 기입</span>}</>
                : "연·월은 필수, 일은 선택 (비워두면 출력 후 수기 기입)"}
            </div>
          </div>
        </div>
      </div>
      {rateNum > 0 && (
        <div className="mt-2 rounded-md bg-blue-50 px-3 py-2 text-xs text-blue-700">
          선금 {rateNum}% (₩{seongeumAmount.toLocaleString("en-US")}) 입력됨 → 청구서는 잔금 <b>₩
          {claim.toLocaleString("en-US")}</b> 으로 자동 청구됩니다.
        </div>
      )}
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[140px_1fr] items-center gap-3 border-b border-border px-4 py-2.5 text-sm last:border-0">
      <div className="text-muted-foreground">{label}</div>
      <div className="font-medium">
        {value || <span className="text-muted-foreground">—</span>}
      </div>
    </div>
  );
}

function RowInput({
  label,
  value,
  onChange,
  placeholder,
  required,
  suffix,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  suffix?: string;
  hint?: string;
}) {
  return (
    <div className="grid grid-cols-[140px_1fr] items-start gap-3 border-b border-border px-4 py-2.5 text-sm last:border-0">
      <div className={`pt-1.5 ${required ? "text-red-600" : "text-muted-foreground"}`}>
        {label}
        {required ? " *" : ""}
      </div>
      <div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="flex-1 rounded-md border border-border px-2.5 py-1.5 text-sm focus:border-primary focus:outline-none"
          />
          {suffix && <span className="text-xs text-muted-foreground">{suffix}</span>}
        </div>
        {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
      </div>
    </div>
  );
}
