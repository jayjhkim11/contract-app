"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { subscribeAuth } from "@/lib/auth";

export default function HomePage() {
  const router = useRouter();
  useEffect(() => {
    return subscribeAuth((user) => {
      router.replace(user ? "/projects" : "/login");
    });
  }, [router]);
  return null;
}
