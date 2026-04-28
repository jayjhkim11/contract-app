import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminStorage, verifyIdToken } from "@/lib/firebase-admin";
import type { ParsedContract } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * 새 프로젝트 생성.
 * 1) PDF 업로드 받음
 * 2) Storage 에 원본 저장
 * 3) Vercel Python serverless `/api/parse` 호출하여 계약서 정보 추출
 * 4) Firestore 에 프로젝트 문서 생성 후 projectId 반환
 */
export async function POST(req: NextRequest) {
  try {
    const { uid } = await verifyIdToken(req);
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return new NextResponse("file is required", { status: 400 });
    if (file.type !== "application/pdf") {
      return new NextResponse("must be PDF", { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // ① 파싱 (Python serverless 호출)
    const parsed = await parsePdfViaPython(req, buffer);

    // ② 동일 계약번호의 기존 프로젝트 검색 (중복 방지)
    if (parsed.contractNumber) {
      // 공용 도구: 모든 프로젝트 대상으로 중복 검색
      const dupSnap = await adminDb.collection("projects").get();
      const dup = dupSnap.docs.find(
        (d) => (d.data() as any)?.parsed?.contractNumber === parsed.contractNumber
      );
      if (dup) {
        return NextResponse.json({
          projectId: dup.id,
          alreadyExists: true,
          contractNumber: parsed.contractNumber,
        });
      }
    }

    // ③ 새 문서 ID + Storage 업로드
    const docRef = adminDb.collection("projects").doc();
    const projectId = docRef.id;
    const storagePath = `contracts/${uid}/${projectId}/${file.name}`;
    await adminStorage
      .bucket()
      .file(storagePath)
      .save(buffer, { contentType: "application/pdf" });

    // ④ Firestore 기록
    const now = new Date().toISOString();
    await docRef.set({
      ownerId: uid,
      contractPdfPath: storagePath,
      parsed,
      manual: {},
      driveFolderId: null,
      forms: {},
      checklists: {},
      createdAt: now,
      updatedAt: now,
    });

    return NextResponse.json({ projectId, alreadyExists: false });
  } catch (e: any) {
    console.error("[/api/projects] failed", e);
    return new NextResponse(e?.message ?? "internal error", { status: 500 });
  }
}

async function parsePdfViaPython(req: NextRequest, pdfBuffer: Buffer): Promise<ParsedContract> {
  const baseUrl = getBaseUrl(req);
  const res = await fetch(`${baseUrl}/api/parse`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pdfBase64: pdfBuffer.toString("base64") }),
  });
  if (!res.ok) {
    const msg = await res.text();
    throw new Error(`PDF 파싱 실패: ${msg}`);
  }
  return (await res.json()) as ParsedContract;
}

function getBaseUrl(req: NextRequest): string {
  const env = process.env.VERCEL_URL || process.env.NEXT_PUBLIC_BASE_URL;
  if (env) return env.startsWith("http") ? env : `https://${env}`;
  return new URL(req.url).origin;
}
