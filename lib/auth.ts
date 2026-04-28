"use client";

import {
  signInWithPopup,
  signOut as fbSignOut,
  onAuthStateChanged,
  User,
  GoogleAuthProvider,
} from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db, googleProvider } from "./firebase-client";

/**
 * Google로 로그인. Drive scope 포함하여 access/refresh token을 받아온다.
 * Firebase Auth는 access token만 직접 반환하므로 refresh token은 서버에서
 * authorization code flow로 별도 처리한다 (signInWithGoogleCode 참고).
 *
 * 단순 구현: signInWithPopup → access token 획득 → 서버 /api/auth/exchange 로
 * 코드 교환 (별도 OAuth flow 필요. 자세한 흐름은 README 참고).
 */
export async function signInWithGoogle(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider);
  // 1차 로그인. Drive 업로드는 access token으로 진행.
  // 사용자 프로필 캐시
  await setDoc(
    doc(db, "users", result.user.uid),
    {
      email: result.user.email,
      displayName: result.user.displayName,
      photoURL: result.user.photoURL,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  // Drive 호출용 access token 획득 → 메모리 보관
  const credential = GoogleAuthProvider.credentialFromResult(result);
  const accessToken = credential?.accessToken;
  if (accessToken) {
    sessionStorage.setItem("google_drive_access_token", accessToken);
  }
  return result.user;
}

export function signOut() {
  sessionStorage.removeItem("google_drive_access_token");
  return fbSignOut(auth);
}

export function getDriveAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem("google_drive_access_token");
}

export function subscribeAuth(cb: (user: User | null) => void) {
  return onAuthStateChanged(auth, cb);
}
