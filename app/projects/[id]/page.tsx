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
        <h1 className="text-lg font-semibold">{project.parsed.serviceName || "(용역명 미확인)"}</h1>
        <div className="mt-1 mb-6 text-xs text-muted-foreground">
          {project.parsed.department} · ₩{project.parsed.contractAmount.toLocaleString("en-US")} ·
          {" "}
          {project.parsed.startDate} ~ {project.parsed.endDate}
        </div>

        <div className="space-y-8">
          <ContractInfoPanel project={project} onSave={saveManual} />
          <FormGrid project={project} onGenerate={generateForm} />
          <ChecklistPanel project={project} onSave={saveChecklists} />
        </div>
      </div>
    </main>
  );
}
