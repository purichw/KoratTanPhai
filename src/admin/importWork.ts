import type { createAdminClient } from './client';
import type { DataKind, Payload } from './types';
import type { ImportFile, ImportSheet } from './workbook';

type Api = ReturnType<typeof createAdminClient>;
export type ImportWork = { id: string; title: string; filename: string; revision: number; updated_at: string;
  source_id: string | null; snapshot_id: string | null; draft_id: string | null };
export type ImportSnapshot = { version: 1; kind: DataKind; title: string; filename: string; book: ImportFile | null;
  sheet: ImportSheet | null; originalSheet: ImportSheet | null; editedSheets: [string, ImportSheet][];
  mapping: Record<string, string>; ignored: string[]; payload: Payload | null; basePayload: Payload | null;
  preparedPayload: Payload | null; fileHash: string; origin: string; rowStart: number; headerReviewed: boolean;
  csvEncoding: 'utf-8' | 'windows-874' };
const partSize = 262144;
export async function fileDigest(bytes: Uint8Array<ArrayBuffer>) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(value => value.toString(16).padStart(2, '0')).join('');
}
export async function uploadImportObject(api: Api, workId: string, objectId: string, purpose: 'source' | 'snapshot', bytes: Uint8Array<ArrayBuffer>) {
  if (!bytes.length || bytes.length > (purpose === 'source' ? 20 : 40) * 1024 * 1024) throw new Error('ข้อมูลสำหรับบันทึกงานค้างเกินขนาดที่รองรับ กรุณาแบ่งไฟล์');
  const sha256 = await fileDigest(bytes);
  const parts = Math.ceil(bytes.length / partSize);
  for (let part = 0; part < parts; part++) {
    const chunk = bytes.subarray(part * partSize, (part + 1) * partSize);
    let binary = '';
    for (let start = 0; start < chunk.length; start += 8192) binary += String.fromCharCode(...chunk.subarray(start, start + 8192));
    await api('work-upload', { body: { workId, objectId, purpose, sha256, bytes: bytes.length, parts, part, data: btoa(binary) } });
  }
}
export async function downloadImportObject(api: Api, workId: string, objectId: string) {
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let parts = 1; let sha = '';
  for (let part = 0; part < parts; part++) {
    const next = await api<{ data: string; parts: number; sha256: string }>('work-read-part', { body: { workId, objectId, part } });
    parts = next.parts; sha = next.sha256;
    chunks.push(Uint8Array.from(atob(next.data.replace(/\s/g, '')), char => char.charCodeAt(0)));
  }
  const bytes = new Uint8Array(await new Blob(chunks).arrayBuffer());
  if (await fileDigest(bytes) !== sha) throw new Error('ไฟล์ที่โหลดมาไม่ครบ กรุณาลองใหม่');
  return bytes;
}
export async function loadImportWork(api: Api, id: string) {
  const work = await api<ImportWork>('work-get', { body: { workId: id } });
  if (!work.snapshot_id) throw new Error('รายการนี้ยังอัปโหลดไม่ครบ กรุณาเลือกไฟล์ต้นฉบับอีกครั้ง');
  const snapshot = JSON.parse(new TextDecoder().decode(await downloadImportObject(api, id, work.snapshot_id))) as ImportSnapshot;
  if (snapshot.version !== 1 || !['archive','station','satellite','crop'].includes(snapshot.kind)) throw new Error('รูปแบบงานค้างนี้ยังไม่รองรับ');
  return { work, snapshot };
}
