"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signOut, subscribeAuth } from "@/lib/auth";
import type { User } from "firebase/auth";

export default function Header() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  useEffect(() => subscribeAuth(setUser), []);

  return (
    <header className="flex items-center justify-between border-b border-border px-6 py-3">
      <Link href="/projects" className="text-base font-bold">
        계약서식 자동완성
      </Link>
      {user && (
        <div className="flex items-center gap-3 text-sm">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 text-xs font-semibold text-white">
            {user.displayName?.[0] ?? user.email?.[0]?.toUpperCase()}
          </div>
          <span className="text-muted-foreground">{user.displayName ?? user.email}</span>
          <button
            onClick={async () => {
              await signOut();
              router.replace("/login");
            }}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            로그아웃
          </button>
        </div>
      )}
    </header>
  );
}
