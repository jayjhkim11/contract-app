"use client";

import { useState } from "react";
import { FORM_KEYS, FORM_LABEL, type FormKey, type Project } from "@/lib/types";
import { toast } from "sonner";

interface Props {
  project: Project;
  onGenerate: (key: FormKey) => Promise<void>;
}

export default function FormGrid({ project, onGenerate }: Props) {
  const [busyKey, setBusyKey] = useState<FormKey | null>(null);

  async function handle(key: FormKey) {
    setBusyKey(key);
    try {
      await onGenerate(key);
      toast.success(`${FORM_LABEL[key]} 생성 완료`);
    } catch (e: any) {
      toast.error(`생성 실패: ${e?.message ?? e}`);
    } finally {
      setBusyKey(null);
    }
  }

  // 청구서/선금 의존성: 사용자 입력 검증
  const seongeum = project.manual.seongeumAmount;
  const requiresSeongeum = (key: FormKey) => key === "3__선금신청서" && !seongeum;
  const requiresDepartment = (key: FormKey) =>
    key === "1__계약_시_구비서류" && !(project.manual.department || project.parsed.department);

  return (
    <section>
      <div className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        서식 생성
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {FORM_KEYS.map((key) => {
          const rec = project.forms[key];
          const busy = busyKey === key;
          const blocked = requiresSeongeum(key) || requiresDepartment(key);
          return (
            <div
              key={key}
              className={`rounded-lg border p-4 ${
                rec ? "border-emerald-200 bg-emerald-50" : "border-border bg-background"
              }`}
            >
              <div className="text-sm font-medium">{FORM_LABEL[key]}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                {rec
                  ? `생성됨 · ${new Date(rec.generatedAt).toLocaleDateString("ko-KR")}`
                  : blocked
                    ? requiresSeongeum(key)
                      ? "상단에 선금 신청금액 입력 필요"
                      : "상단에 발주부서 입력 필요"
                    : "미생성"}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {rec ? (
                  <>
                    <a
                      href={rec.driveFileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-md border border-border bg-background px-3 py-1.5 text-xs hover:border-foreground"
                    >
                      파일 열기
                    </a>
                    <button
                      onClick={() => handle(key)}
                      disabled={busy || blocked}
                      className="rounded-md border border-border bg-background px-3 py-1.5 text-xs hover:border-foreground disabled:opacity-50"
                    >
                      {busy ? "재생성 중..." : "재생성하기"}
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => handle(key)}
                    disabled={busy || blocked}
                    className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
                  >
                    {busy ? "생성 중..." : "생성하기"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
