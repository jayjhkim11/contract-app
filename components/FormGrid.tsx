"use client";

import { useState } from "react";
import { FORM_KEYS, FORM_LABEL, type FormKey, type Project } from "@/lib/types";
import { toast } from "sonner";

interface Props {
  project: Project;
  onGenerate: (key: FormKey) => Promise<void>;
}

/**
 * Drive 파일 ID로부터 직접 다운로드 URL 생성.
 * hwpx는 Drive 미리보기에서 안 열리므로 미리보기 대신 즉시 다운로드.
 */
function driveDownloadUrl(fileId: string): string {
  return `https://drive.google.com/uc?id=${fileId}&export=download`;
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

  const seongeumRate = project.manual.seongeumRate ?? 0;
  const requiresSeongeum = (key: FormKey) => key === "3__선금신청서" && seongeumRate <= 0;
  const requiresDepartment = (key: FormKey) =>
    key === "1__계약_시_구비서류" &&
    !(project.manual.department || project.parsed.department);

  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          서식 생성
        </div>
        {project.driveFolderId && (
          <a
            href={`https://drive.google.com/drive/folders/${project.driveFolderId}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:border-foreground"
          >
            <span>📁</span>
            Drive 폴더 열기
          </a>
        )}
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
                      ? "상단에 선금 신청비율 입력 필요"
                      : "상단에 발주부서 입력 필요"
                    : "미생성"}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {rec ? (
                  <>
                    <a
                      href={driveDownloadUrl(rec.driveFileId)}
                      className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
                    >
                      다운로드
                    </a>
                    <button
                      onClick={() => handle(key)}
                      disabled={busy || blocked}
                      className="rounded-md border border-border bg-background px-3 py-1.5 text-xs hover:border-foreground disabled:opacity-50"
                    >
                      {busy ? "재생성 중..." : "재생성"}
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
              {/* 청구서일 때 통장사본 PDF 부속 파일 다운로드 */}
              {rec?.extraFiles?.[0] && (
                <div className="mt-2 text-xs">
                  <a
                    href={driveDownloadUrl(rec.extraFiles[0].driveFileId)}
                    className="text-blue-700 underline hover:text-blue-900"
                  >
                    통장사본 PDF 다운로드
                  </a>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
