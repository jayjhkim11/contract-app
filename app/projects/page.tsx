"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
} from "firebase/firestore";
import Header from "@/components/Header";
import ProjectCard from "@/components/ProjectCard";
import ContractUpload from "@/components/ContractUpload";
import { auth, db } from "@/lib/firebase-client";
import { subscribeAuth } from "@/lib/auth";
import type { Project } from "@/lib/types";

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    return subscribeAuth((u) => {
      setAuthReady(true);
      if (!u) router.replace("/login");
    });
  }, [router]);

  useEffect(() => {
    if (!auth.currentUser) return;
    const q = query(
      collection(db, "projects"),
      where("ownerId", "==", auth.currentUser.uid),
      orderBy("createdAt", "desc")
    );
    return onSnapshot(q, (snap) => {
      setProjects(
        snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Project[]
      );
    });
  }, [authReady]);

  return (
    <main>
      <Header />
      <div className="mx-auto max-w-3xl px-6 py-8">
        <h1 className="mb-4 text-lg font-semibold">새 프로젝트</h1>
        <ContractUpload />

        <h2 className="mb-3 mt-10 text-lg font-semibold">프로젝트 목록</h2>
        {projects.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            아직 프로젝트가 없습니다. 위에서 계약서를 업로드해 보세요.
          </div>
        ) : (
          <div className="grid gap-3">
            {projects.map((p) => (
              <ProjectCard key={p.id} p={p} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
