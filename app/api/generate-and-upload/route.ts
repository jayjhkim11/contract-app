import { NextRequest, NextResponse } from "next/server";
import { adminDb, verifyIdToken } from "@/lib/firebase-admin";
import { ensureProjectFolder, getDrive, slugifyForFolder, uploadFile } from "@/lib/drive";
import { yearOf } from "@/lib/utils";
import { formatContractAmount as fmtContract } from "@/lib/parse";
import type { FormKey, GenerateResponse, Project } from "@/lib/types";
import { FORM_LABEL } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

interface Body {
  projectId: string;
  formKey: FormKey;
}

/**
 * 1) Firestore에서 프로젝트 정보를 읽고
 * 2) Python /api/generate 호출하여 hwpx (필요시 통장사본 PDF) 받음
 * 3) Drive에 업로드 (in-place 업데이트로 fileId 보존)
 * 4) Firestore projects/{id}.forms.{key} 업데이트
 */
export async function POST(req: NextRequest) {
  try {
    const { uid } = await verifyIdToken(req);
    const driveAccessToken = req.headers.get("x-drive-token");
    if (!driveAccessToken) return new NextResponse("missing drive token", { status: 401 });

    const { projectId, formKey } = (await req.json()) as Body;
    const docRef = adminDb.collection("projects").doc(projectId);
    const snap = await docRef.get();
    if (!snap.exists) return new NextResponse("project not found", { status: 404 });
    const project = { id: snap.id, ...(snap.data() as any) } as Project;
    // 공용 도구: 로그인된 모든 사용자가 모든 프로젝트의 서식을 생성/재생성 가능

    // 1) 스킬에 넘길 values 계산
    const values = buildValues(project, formKey);

    // 2) Python serverless 호출
    const pyRes = await fetch(`${getBaseUrl(req)}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ formKey, values }),
    });
    if (!pyRes.ok) {
      const msg = await pyRes.text();
      throw new Error(`generate.py: ${msg}`);
    }
    const gen = (await pyRes.json()) as GenerateResponse;

    // 3) Drive 업로드
    const drive = getDrive(driveAccessToken);
    const parentFolderId = process.env.NEXT_PUBLIC_DRIVE_PARENT_FOLDER_ID;
    if (!parentFolderId) {
      throw new Error("NEXT_PUBLIC_DRIVE_PARENT_FOLDER_ID 환경변수가 설정되지 않았습니다");
    }
    // 폴더 연도: 사용자가 입력한 제출일 → 계약종료일 → 계약일자
    const year = project.manual.submissionDate
      ? yearOf(project.manual.submissionDate)
      : yearOf(project.parsed.endDate || project.parsed.contractDate);
    const folderName = slugifyForFolder(project.parsed.serviceName || projectId);
    const folderId = await ensureProjectFolder(drive, parentFolderId, year, folderName);

    const existing = project.forms[formKey];
    const main = await uploadFile(drive, {
      folderId,
      fileName: gen.fileName,
      contentBase64: gen.hwpxBase64,
      mimeType: "application/octet-stream",
      existingFileId: existing?.driveFileId,
    });

    let extraFiles: NonNullable<Project["forms"][FormKey]>["extraFiles"] = undefined;
    if (gen.bankbookPdfBase64 && gen.bankbookFileName) {
      const existingExtra = existing?.extraFiles?.[0];
      const extra = await uploadFile(drive, {
        folderId,
        fileName: gen.bankbookFileName,
        contentBase64: gen.bankbookPdfBase64,
        mimeType: "application/pdf",
        existingFileId: existingExtra?.driveFileId,
      });
      extraFiles = [{ driveFileId: extra.id, driveFileUrl: extra.webViewLink, fileName: gen.bankbookFileName }];
    }

    // 4) Firestore 업데이트
    await docRef.update({
      driveFolderId: folderId,
      [`forms.${formKey}`]: {
        generatedAt: new Date().toISOString(),
        driveFileId: main.id,
        driveFileUrl: main.webViewLink,
        fileName: gen.fileName,
        ...(extraFiles ? { extraFiles } : {}),
      },
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({
      ok: true,
      label: FORM_LABEL[formKey],
      driveFileUrl: main.webViewLink,
    });
  } catch (e: any) {
    console.error("[/api/generate-and-upload] failed", e);
    return new NextResponse(e?.message ?? "internal error", { status: 500 });
  }
}

function getBaseUrl(req: NextRequest): string {
  const env = process.env.VERCEL_URL || process.env.NEXT_PUBLIC_BASE_URL;
  if (env) return env.startsWith("http") ? env : `https://${env}`;
  return new URL(req.url).origin;
}

/** 비율(%) → 만원 단위 절삭 선금 금액 */
function calcSeongeum(total: number, rate: number): number {
  if (!total || !rate) return 0;
  return Math.floor((total * rate) / 100);
}

/**
 * 프로젝트 + 사용자 보완값 → fill_hwpx.py가 기대하는 values 객체
 * 스킬의 플레이스홀더 규칙 그대로 매핑.
 */
function buildValues(p: Project, formKey: FormKey): Record<string, string | number> {
  const total = p.parsed.contractAmount;
  const rate = p.manual.seongeumRate || 0;
  const seongeum = calcSeongeum(total, rate);
  const department = p.manual.department || p.parsed.department || "";
  const submissionDate = p.manual.submissionDate;

  // 기본값: 모든 양식 공통
  const v: Record<string, string | number> = {
    "1": p.parsed.company,
    "2": p.parsed.address,
    "3": p.parsed.representative,
    "5": p.parsed.contractDate,
    "6": p.parsed.serviceName,
    "7": fmtContract(total), // 계약금액 (계약 총액 그대로)
    "9": p.parsed.startDate,
    "10": p.parsed.endDate,
    // {{4}}(업종)은 스킬에서 자동 설정
    // {{8}}(계약보증금액)은 구비서류에만 사용 — 필요 시 v["8"] 추가 입력
    "13": department,
  };
  if (submissionDate) v["_submission_date"] = submissionDate;

  if (formKey === "3__선금신청서") {
    if (!rate) {
      throw new Error("선금 신청비율이 입력되지 않았습니다");
    }
    v["_seongeum_rate"] = rate;
  }

  if (formKey === "5__청구서") {
    // 청구금액 = 선금이 입력되었으면 잔금, 아니면 총액
    const claim = seongeum > 0 ? total - seongeum : total;
    v["_cheonggu_amount"] = claim;
  }

  return v;
}
