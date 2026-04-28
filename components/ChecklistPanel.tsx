"use client";

import { useEffect, useState } from "react";
import {
  CHECKLISTS,
  CHECKLIST_ORDER,
  progressOf,
  type ChecklistKey,
  type ChecklistItem,
} from "@/lib/checklists";
import type { Project, ChecklistState } from "@/lib/types";

interface Props {
  project: Project;
  onSave: (checklists: ChecklistState) => Promise<void>;
}

/**
 * 서식별 제출 시 구비서류 아코디언.
 * 선금 청구서는 manual.seongeumRate > 0 인 경우에만 노출.
 * 체크박스 변경 시 디바운스 후 onSave(전체 ChecklistState) 호출.
 */
export default function ChecklistPanel({ project, onSave }: Props) {
  const [state, setState] = useState<ChecklistState>(project.checklists ?? {});
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [dirty, setDirty] = useState(false);

  // project.checklists 가 외부에서 갱신되면 동기화
  useEffect(() => {
    setState(project.checklists ?? {});
  }, [project.checklists]);

  // 디바운스 저장
  useEffect(() => {
    if (!dirty) return;
    const t = setTimeout(async () => {
      await onSave(state);
      setDirty(false);
    }, 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, dirty]);

  const visible = CHECKLIST_ORDER.filter(
    (c) => !c.onlyIfSeongeum || (project.manual.seongeumRate ?? 0) > 0
  );

  function toggleOpen(key: string) {
    setOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function setChecked(key: ChecklistKey, idx: number, checked: boolean) {
    setState((prev) => {
      const items = CHECKLISTS[key];
      const arr = (prev[key] && prev[key]!.length === items.length
        ? [...(prev[key] as boolean[])]
        : Array.from({ length: items.length }, (_, i) => !!(prev[key]?.[i]))
      );
      arr[idx] = checked;
      return { ...prev, [key]: arr };
    });
    setDirty(true);
  }

  return (
    <section>
      <div className="flex flex-wrap gap-2 text-xs">
        <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          제출 시 구비서류 체크리스트
        </h2>
        {dirty && <span className="text-amber-600">저장 중...</span>}
      </div>
      <div className="mt-2.5 flex flex-col gap-2">
        {visible.map((conf) => {
          const items = CHECKLISTS[conf.key];
          const checks = state[conf.key];
          const { total, done } = progressOf(conf.key, checks);
          const isOpen = !!open[conf.key];
          return (
            <div
              key={conf.key}
              className="overflow-hidden rounded-lg border border-border bg-background"
            >
              <button
                type="button"
                onClick={() => toggleOpen(conf.key)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted"
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className={`inline-block w-3 text-xs text-muted-foreground transition-transform ${
                      isOpen ? "rotate-90" : ""
                    }`}
                  >
                    ▶
                  </span>
                  <span className="text-sm font-semibold">{conf.label}</span>
                  {conf.extraTag && (
                    <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">
                      {conf.extraTag}
                    </span>
                  )}
                </div>
                <ProgressBadge total={total} done={done} />
              </button>
              {isOpen && (
                <div className="border-t border-border bg-muted px-3.5 pb-3.5 pt-1">
                  {items.length === 0 ? (
                    <div className="px-1 py-3 text-sm text-muted-foreground">별도 구비서류 없음</div>
                  ) : (
                    items.map((it, idx) => (
                      <CheckRow
                        key={`${conf.key}-${idx}`}
                        item={it}
                        checked={!!checks?.[idx]}
                        onChange={(c) => setChecked(conf.key, idx, c)}
                      />
                    ))
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ProgressBadge({ total, done }: { total: number; done: number }) {
  const cls =
    total === 0
      ? "bg-slate-100 text-slate-600"
      : done === 0
        ? "bg-slate-100 text-slate-600"
        : done === total
          ? "bg-emerald-100 text-emerald-700"
          : "bg-amber-100 text-amber-700";
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${cls}`}>
      {total === 0 ? "—" : `${done}/${total}`}
    </span>
  );
}

function CheckRow({
  item,
  checked,
  onChange,
}: {
  item: ChecklistItem;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  // note 항목은 체크박스 대신 정보로 표시 (진행도 미포함)
  const isNote = item.type === "note";
  return (
    <label className="flex items-start gap-2.5 border-b border-dashed border-border py-2 last:border-0 cursor-pointer">
      {!isNote && (
        <input
          type="checkbox"
          className="mt-1 cursor-pointer"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
      )}
      <span className={`flex-1 text-sm leading-relaxed ${checked && !isNote ? "text-muted-foreground line-through" : ""}`}>
        {item.text}
        {item.type === "cond" && (
          <span className="ml-1.5 inline-block rounded bg-amber-100 px-1.5 py-px align-middle text-[10px] text-amber-700">
            {item.note ?? "조건부"}
          </span>
        )}
        {isNote && (
          <span className="ml-1.5 inline-block rounded bg-slate-100 px-1.5 py-px align-middle text-[10px] text-slate-600">
            지침
          </span>
        )}
      </span>
    </label>
  );
}
