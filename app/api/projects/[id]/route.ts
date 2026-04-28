import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminStorage, verifyIdToken } from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * 프로젝트 삭제.
 * - Firestore projects/{id} 문서 삭제
 * - Storage 의 PDF 원본 삭제
 * - Drive 폴더/파일은 그대로 유지 (사용자가 Drive 에서 직접 관리)
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { uid } = await verifyIdToken(req);
    const { id } = params;

    const docRef = adminDb.collection("projects").doc(id);
    const snap = await docRef.get();
    if (!snap.exists) {
      return new NextResponse("project not found", { status: 404 });
    }
    const data = snap.data() as any;
    if (data.ownerId !== uid) {
      return new NextResponse("forbidden", { status: 403 });
    }

    // Storage PDF 삭제 (있는 경우)
    if (data.contractPdfPath) {
      try {
        await adminStorage.bucket().file(data.contractPdfPath).delete();
      } catch (e: any) {
        // 파일이 이미 없거나 다른 이유로 실패해도 Firestore 삭제는 진행
        console.warn("[DELETE projects/{id}] storage delete failed:", e?.message);
      }
    }

    // Firestore 문서 삭제
    await docRef.delete();

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[DELETE projects/{id}] failed", e);
    return new NextResponse(e?.message ?? "internal error", { status: 500 });
  }
}
