"use client";

import Link from "next/link";
import type { Project } from "@/lib/types";
import { FORM_KEYS } from "@/lib/types";

export default function ProjectCard({ p }: { p: Project }) {
  const generated = FORM_KEYS.filter((k) => p.forms[k]).length;
  const total = FORM_KEYS.length;

  return (
    <Link
      href={`/projects/${p.id}`}
      className="block rounded-xl border border-border bg-background p-4 transition-shadow hover:shadow-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">
            {p.parsed.serviceName || "(용역명 미확인)"}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {[
              p.parsed.department,
              p.parsed.contractDate && `계약일 ${p.parsed.contractDate}`,
              p.parsed.contractAmount && `₩${p.parsed.contractAmount.toLocaleString("en-US")}`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {p.parsed.startDate && p.parsed.endDate
              ? `${p.parsed.startDate} ~ ${p.parsed.endDate}`
              : ""}
          </div>
        </div>
        <span
          className={`rounded px-2 py-0.5 text-xs font-medium ${
            generated === 0
              ? "bg-slate-100 text-slate-600"
              : generated === total
                ? "bg-emerald-100 text-emerald-700"
                : "bg-amber-100 text-amber-700"
          }`}
        >
          {generated}/{total} 서식
        </span>
      </div>
    </Link>
  );
}
