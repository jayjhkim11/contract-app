"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useDropzone } from "react-dropzone";
import { auth } from "@/lib/firebase-client";
import { toast } from "sonner";

/**
 * 계약서 PDF 업로드 → 서버에서 파싱 + Firestore에 프로젝트 생성
 * 성공 시 /projects/{id} 로 이동
 */
export default function ContractUpload() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { "application/pdf": [".pdf"] },
    multiple: false,
    onDrop: async (files) => {
      const file = files[0];
      if (!file) return;
      setBusy(true);
      try {
        const idToken = await auth.currentUser?.getIdToken();
        if (!idToken) throw new Error("로그인이 필요합니다");
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/projects", {
          method: "POST",
          headers: { Authorization: `Bearer ${idToken}` },
          body: fd,
        });
        if (!res.ok) {
          const msg = await res.text();
          throw new Error(msg || "업로드 실패");
        }
        const { projectId, alreadyExists, contractNumber } = await res.json();
        if (alreadyExists) {
          toast.info(
            `같은 계약번호(${contractNumber})의 프로젝트가 이미 있어 해당 프로젝트로 이동합니다.`
          );
        } else {
          toast.success("계약서 파싱 완료, 새 프로젝트가 생성되었습니다.");
        }
        router.push(`/projects/${projectId}`);
      } catch (e: any) {
        toast.error(e?.message ?? "업로드 실패");
      } finally {
        setBusy(false);
      }
    },
  });

  return (
    <div
      {...getRootProps()}
      className={`cursor-pointer rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
        isDragActive ? "border-primary bg-muted" : "border-border bg-background"
      } ${busy ? "pointer-events-none opacity-60" : ""}`}
    >
      <input {...getInputProps()} />
      <div className="text-sm font-medium">
        {busy ? "처리 중..." : "계약서 PDF를 드래그하거나 클릭하여 업로드"}
      </div>
      <div className="mt-2 text-xs text-muted-foreground">
        업로드와 동시에 새 프로젝트가 생성되고, 계약서에서 정보를 자동 추출합니다.
      </div>
    </div>
  );
}
