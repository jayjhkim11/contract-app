import { initializeApp, getApps, cert, App } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

function getAdminApp(): App {
  if (getApps().length) return getApps()[0]!;
  const b64 = process.env.FIREBASE_ADMIN_KEY_BASE64;
  if (!b64) throw new Error("FIREBASE_ADMIN_KEY_BASE64 env not set");
  const credentials = JSON.parse(Buffer.from(b64, "base64").toString("utf-8"));
  return initializeApp({
    credential: cert(credentials),
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  });
}

export const adminDb = getFirestore(getAdminApp());
export const adminStorage = getStorage(getAdminApp());

/**
 * Firebase ID 토큰으로 사용자 검증. API Route에서 사용.
 * Authorization: Bearer <id_token>
 */
export async function verifyIdToken(req: Request): Promise<{ uid: string; email?: string }> {
  const auth = req.headers.get("authorization") || "";
  const m = auth.match(/^Bearer (.+)$/);
  if (!m) throw new Error("missing bearer token");
  const { getAuth } = await import("firebase-admin/auth");
  const decoded = await getAuth(getAdminApp()).verifyIdToken(m[1]);
  return { uid: decoded.uid, email: decoded.email };
}
