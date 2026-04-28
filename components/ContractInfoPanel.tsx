"use client";

import { useEffect, useState } from "react";
import type { Project } from "@/lib/types";

interface Props {
  project: Project;
  onSave: (manual: Project["manual"]) => Promise<void>;
}

/**
 * 계약서에서 추출된 정보 + 사용자 보완 입력 (선금/제출연도/발주부서) 통합 패널.
 * 변경 시 onSave로 호출자에게 알린다.
 */
export default function ContractInfoPanel({ project, onSave }: Props) {
  const [department, setDepartment] = useState(project.manual.department ?? project.parsed.department ?? "");
  const [seongeum, setSeongeum] = useState<string>(
    project.manual.seongeumAmount ? String(project.manual.seongeumAmount) : ""
  );
  const [year, setYear] = useState<string>(
    project.manual.submissionYear ? String(project.manual.submissionYear) : ""
  );
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setDirty(true);
    // 디바운스
    const t = setTimeout(async () => {
      setSaving(true);
      await onSave({
        department: department || undefined,
        seongeumAmount: seongeum ? Number(seongeum.replace(/,/g, "")) : undefined,
        submissionYear: year ? Number(year) : undefined,
      });
      setSaving(false);
      setDirty(false);
    }, 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [department, seongeum, year]);

  const p = project.parsed;
  const total = p.contractAmount;
  const claim = seongeum ? total - Number(seongeum.replace(/,/g, "")) : total;

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
          label="선금 신청금액"
          placeholder="비우면 청구서가 총액으로 청구됩니다"
          value={seongeum}
          onChange={(v) => setSeongeum(v.replace(/[^\d,]/g, ""))}
          suffix="원"
        />
        <RowInput
          label="제출일 연도"
          placeholder={String(parseInt(p.endDate || `${new Date().getFullYear()}`, 10) || new Date().getFullYear())}
          value={year}
          onChange={(v) => setYear(v.replace(/\D/g, "").slice(0, 4))}
        />
      </div>
      {seongeum && (
        <div className="mt-2 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
          선금 ₩{Number(seongeum.replace(/,/g, "")).toLocaleString("en-US")} 입력됨 → 청구서는 잔금 ₩
          {claim.toLocaleString("en-US")} 으로 자동 청구됩니다.
        </div>
      )}
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[140px_1fr] items-center gap-3 border-b border-border px-4 py-2.5 text-sm last:border-0">
      <div className="text-muted-foreground">{label}</div>
      <div className="font-medium">{value || <span className="text-muted-foreground">—</span>}</div>
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
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  suffix?: string;
}) {
  return (
    <div className="grid grid-cols-[140px_1fr] items-center gap-3 border-b border-border px-4 py-2.5 text-sm last:border-0">
      <div className={required ? "text-red-600" : "text-muted-foreground"}>
        {label}
        {required ? " *" : ""}
      </div>
      <div className="flex items-center gap-2">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1 rounded-md border border-border px-2.5 py-1.5 text-sm focus:border-primary focus:outline-none"
        />
        {suffix && <span className="text-xs text-muted-foreground">{suffix}</span>}
      </div>
    </div>
  );
}
