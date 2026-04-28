"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithGoogle, subscribeAuth } from "@/lib/auth";
import { toast } from "sonner";

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    return subscribeAuth((user) => {
      if (user) router.replace("/projects");
    });
  }, [router]);

  async function handleSignIn() {
    setLoading(true);
    try {
      await signInWithGoogle();
      router.replace("/projects");
    } catch (e: any) {
      toast.error("로그인 실패: " + (e?.message ?? String(e)));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted px-6">
      <div className="w-full max-w-sm rounded-xl border border-border bg-background p-10 text-center shadow-sm">
        <div className="mb-1 text-xl font-bold">계약서식 자동완성</div>
        <div className="mb-8 text-sm text-muted-foreground">청춘작당 협동조합 내부 도구</div>
        <button
          onClick={handleSignIn}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white text-xs font-bold text-[#4285f4]">
            G
          </span>
          {loading ? "로그인 중..." : "Google로 계속하기"}
        </button>
        <p className="mt-3 text-xs text-muted-foreground">
          로그인 시 Google Drive 업로드 권한이 함께 요청됩니다.
        </p>
      </div>
    </main>
  );
}
