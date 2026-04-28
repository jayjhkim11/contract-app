import { google } from "googleapis";
import { Readable } from "stream";

/**
 * Drive 클라이언트. 사용자 access token 위임으로 동작.
 */
export function getDrive(accessToken: string) {
  const oauth2 = new google.auth.OAuth2();
  oauth2.setCredentials({ access_token: accessToken });
  return google.drive({ version: "v3", auth: oauth2 });
}

type DriveClient = ReturnType<typeof getDrive>;

/** name + parent 조합으로 폴더 검색. 없으면 null */
export async function findFolder(
  drive: DriveClient,
  name: string,
  parentId?: string
): Promise<string | null> {
  const q = [
    `name = '${name.replace(/'/g, "\\'")}'`,
    `mimeType = 'application/vnd.google-apps.folder'`,
    "trashed = false",
    parentId ? `'${parentId}' in parents` : `'root' in parents`,
  ].join(" and ");

  const res = await drive.files.list({
    q,
    fields: "files(id,name)",
    pageSize: 1,
  });
  return res.data.files?.[0]?.id ?? null;
}

export async function getOrCreateFolder(
  drive: DriveClient,
  name: string,
  parentId?: string
): Promise<string> {
  const existing = await findFolder(drive, name, parentId);
  if (existing) return existing;
  const res = await drive.files.create({
    requestBody: {
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: parentId ? [parentId] : undefined,
    },
    fields: "id",
  });
  return res.data.id!;
}

/**
 * 프로젝트 폴더 경로를 보장. 예: 청춘작당/2026/곡성어린이도서관_도서관의날
 */
export async function ensureProjectFolder(
  drive: DriveClient,
  rootName: string,
  year: number,
  projectFolderName: string
): Promise<string> {
  const root = await getOrCreateFolder(drive, rootName);
  const yearFolder = await getOrCreateFolder(drive, String(year), root);
  return getOrCreateFolder(drive, projectFolderName, yearFolder);
}

/**
 * 파일 업로드. existingFileId가 주어지면 그 파일을 in-place 업데이트하여
 * Drive 링크가 보존된다 (재생성 시 활용).
 */
export async function uploadFile(
  drive: DriveClient,
  opts: {
    folderId: string;
    fileName: string;
    contentBase64: string;
    mimeType: string;
    existingFileId?: string;
  }
): Promise<{ id: string; webViewLink: string }> {
  const buffer = Buffer.from(opts.contentBase64, "base64");
  const stream = Readable.from(buffer);
  if (opts.existingFileId) {
    const res = await drive.files.update({
      fileId: opts.existingFileId,
      requestBody: { name: opts.fileName },
      media: { mimeType: opts.mimeType, body: stream },
      fields: "id,webViewLink",
    });
    return { id: res.data.id!, webViewLink: res.data.webViewLink! };
  }
  const res = await drive.files.create({
    requestBody: {
      name: opts.fileName,
      parents: [opts.folderId],
    },
    media: { mimeType: opts.mimeType, body: stream },
    fields: "id,webViewLink",
  });
  return { id: res.data.id!, webViewLink: res.data.webViewLink! };
}

/** 파일명에 쓸 수 없는 문자를 제거 */
export function slugifyForFolder(s: string): string {
  return s
    .replace(/[\\/:*?"<>|]+/g, "")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 80);
}
