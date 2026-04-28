import { google } from "googleapis";
import { Readable } from "stream";

/**
 * Drive 클라이언트. 사용자 access token 위임으로 동작.
 * 공유 드라이브를 지원하도록 모든 호출에 supportsAllDrives 옵션 적용.
 */
export function getDrive(accessToken: string) {
  const oauth2 = new google.auth.OAuth2();
  oauth2.setCredentials({ access_token: accessToken });
  return google.drive({ version: "v3", auth: oauth2 });
}

type DriveClient = ReturnType<typeof getDrive>;

/** 부모 폴더 안에서 같은 이름의 자식 폴더 검색 (공유 드라이브 포함). */
export async function findFolder(
  drive: DriveClient,
  name: string,
  parentId: string
): Promise<string | null> {
  const q = [
    `name = '${name.replace(/'/g, "\\'")}'`,
    `mimeType = 'application/vnd.google-apps.folder'`,
    "trashed = false",
    `'${parentId}' in parents`,
  ].join(" and ");

  const res = await drive.files.list({
    q,
    fields: "files(id,name)",
    pageSize: 1,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    corpora: "allDrives",
  });
  return res.data.files?.[0]?.id ?? null;
}

export async function getOrCreateFolder(
  drive: DriveClient,
  name: string,
  parentId: string
): Promise<string> {
  const existing = await findFolder(drive, name, parentId);
  if (existing) return existing;
  const res = await drive.files.create({
    requestBody: {
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId],
    },
    fields: "id",
    supportsAllDrives: true,
  });
  return res.data.id!;
}

/**
 * 부모 폴더 ID 안에 {연도}/{프로젝트명_slug}/ 폴더 생성 후 그 ID 반환.
 * parentFolderId 는 사용자가 환경변수로 지정한 "계약 문서 관리" 같은 최종 부모 폴더의 ID.
 * (공유 드라이브의 폴더면 supportsAllDrives 로 처리됨)
 */
export async function ensureProjectFolder(
  drive: DriveClient,
  parentFolderId: string,
  year: number,
  projectFolderName: string
): Promise<string> {
  const yearFolder = await getOrCreateFolder(drive, String(year), parentFolderId);
  return getOrCreateFolder(drive, projectFolderName, yearFolder);
}

/**
 * 파일 업로드. existingFileId가 주어지면 in-place 업데이트하여 Drive 링크가 보존된다.
 *
 * 단, 다음 경우에는 in-place 업데이트 대신 새 파일을 생성한다:
 *  - 기존 파일이 사라졌거나 접근 권한 없음 (404, 403)
 *  - 기존 파일의 부모 폴더가 현재 expected folderId 와 다름 (개인 드라이브 → 공유 드라이브 이전 등)
 *
 * 새 파일 생성 시 함수가 새 fileId 를 반환하므로, 호출자가 Firestore 의 driveFileId 를 갱신해야
 * 다음 재생성에서 정상 in-place 업데이트가 되며 Drive 링크도 보존된다.
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

  // 기존 파일 in-place 업데이트 시도 (가능한 경우)
  if (opts.existingFileId) {
    try {
      const meta = await drive.files.get({
        fileId: opts.existingFileId,
        fields: "id,parents,trashed",
        supportsAllDrives: true,
      });
      const parents = meta.data.parents || [];
      const sameFolder = parents.includes(opts.folderId);
      const trashed = !!meta.data.trashed;

      if (sameFolder && !trashed) {
        const res = await drive.files.update({
          fileId: opts.existingFileId,
          requestBody: { name: opts.fileName },
          media: { mimeType: opts.mimeType, body: Readable.from(buffer) },
          fields: "id,webViewLink",
          supportsAllDrives: true,
        });
        return { id: res.data.id!, webViewLink: res.data.webViewLink! };
      }
      // 다른 폴더 또는 휴지통 → 새 파일 생성으로 fall-through
      // (옛 파일은 그대로 두고 새 위치에 새 파일)
    } catch (e) {
      // 파일이 사라졌거나 접근 권한 없음 → 새 파일 생성으로 fall-through
    }
  }

  const res = await drive.files.create({
    requestBody: {
      name: opts.fileName,
      parents: [opts.folderId],
    },
    media: { mimeType: opts.mimeType, body: Readable.from(buffer) },
    fields: "id,webViewLink",
    supportsAllDrives: true,
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
