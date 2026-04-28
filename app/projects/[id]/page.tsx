"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import Header from "@/components/Header";
import ContractInfoPanel from "@/components/ContractInfoPanel";
import FormGrid from "@/components/FormGrid";
import ChecklistPanel from "@/components/ChecklistPanel";
import { auth, db } from "@/lib/firebase-client";
import { getDriveAccessToken, subscribeAuth } from "@/lib/auth";
import type { ChecklistState, FormKey, Project } from "@/lib/types";
import { toast } from "sonner";

export default function ProjectDetailPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => subscribeAuth((u) => {
    setAuthReady(true);
    if (!u) router.replace("/login");
  }), [router]);

  useEffect(() => {
    if (!authReady || !auth.currentUser) return;
    return onSnapshot(doc(db, "projects", id), (snap) => {
      if (!snap.exists()) {
        toast.error("프로젝트를 찾을 수 없습니다");
        router.replace("/projects");
        return;
      }
      setProject({ id: snap.id, ...(snap.data() as any) } as Project);
    });
  }, [authReady, id, router]);

  async function saveManual(manual: Project["manual"]) {
    await updateDoc(doc(db, "projects", id), {
      manual,
      updatedAt: new Date().toISOString(),
    });
  }

  async function saveChecklists(checklists: ChecklistState) {
    await updateDoc(doc(db, "projects", id), {
      checklists,
      updatedAt: new Date().toISOString(),
    });
  }

  async function generateForm(key: FormKey) {
    const idToken = await auth.currentUser?.getIdToken();
    const driveToken = getDriveAccessToken();
    if (!idToken) throw new Error("로그인 필요");
    if (!driveToken) throw new Error("Drive 권한이 만료되었습니다. 다시 로그인 해 주세요.");
    const res = await fetch("/api/generate-and-upload", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${idToken}`,
        "Content-Type": "application/json",
        "x-drive-token": driveToken,
      },
      body: JSON.stringify({ projectId: id, formKey: key }),
    });
    if (!res.ok) throw new Error(await res.text());
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error("로그인 필요");
      const res = await fetch(`/api/projects/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success("프로젝트가 삭제되었습니다");
      router.replace("/projects");
    } catch (e: any) {
      toast.error(`삭제 실패: ${e?.message ?? e}`);
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  if (!project) {
    return (
      <main>
        <Header />
        <div className="mx-auto max-w-3xl px-6 py-8 text-sm text-muted-foreground">불러오는 중...</div>
      </main>
    );
  }

  return (
    <main>
      <Header />
      <div className="mx-auto max-w-3xl px-6 py-8">
        <div className="mb-1 text-xs text-muted-foreground">
          <Link href="/projects" className="hover:underline">
            프로젝트
          </Link>
          {" › "}
          <span>{project.parsed.serviceName || "(용역명 미확인)"}</span>
        </div>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold">{project.parsed.serviceName || "(용역명 미확인)"}</h1>
            <div className="mt-1 mb-6 text-xs text-muted-foreground">
              {project.parsed.department} · ₩{project.parsed.contractAmount.toLocaleString("en-US")} ·
              {" "}
              {project.parsed.startDate} ~ {project.parsed.endDate}
            </div>
          </div>
          <button
            onClick={() => setConfirmDelete(true)}
            className="shrink-0 rounded-md border border-red-200 bg-white px-3 py-1.5 text-xs text-red-600 hover:bg-red-50"
            type="button"
          >
            프로젝트 삭제
          </button>
        </div>

        <div className="space-y-8">
          <ContractInfoPanel project={project} onSave={saveManual} />
          <FormGrid project={project} onGenerate={generateForm} />
          <ChecklistPanel project={project} onSave={saveChecklists} />
        </div>
      </div>

      {/* 삭제 확인 다이얼로그 */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !deleting && setConfirmDelete(false)}>
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <div className="text-base font-semibold">프로젝트를 삭제하시겠어요?</div>
            <div className="mt-2 text-sm text-muted-foreground">
              계약서 PDF 와 프로젝트 정보(생성된 서식 기록 포함)가 삭제됩니다.
              Drive 폴더와 파일은 그대로 유지됩니다.
              <br />
              <b className="text-red-600">이 작업은 되돌릴 수 없습니다.</b>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setConfirmDelete(false)}
                disabled={deleting}
                className="rounded-md border border-border bg-white px-4 py-2 text-sm hover:border-foreground disabled:opacity-50"
                type="button"
              >
                취소
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                type="button"
              >
                {deleting ? "삭제 중..." : "삭제"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
