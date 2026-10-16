import { useEffect, useState } from 'react';
import { ArrowRight, Download, FileClock, RefreshCw } from 'lucide-react';
import { WorkspaceDialog } from '../components/WorkspaceDialog';
import { WorkspaceEmptyState } from '../components/WorkspaceEmptyState';
import type { createAdminClient } from './client';
import { useAdminRead } from './useAdminRead';
import { downloadImportObject, loadImportWork, type ImportWork } from './importWork';
import { downloadImportBlob } from './importReview';
import { AdminImport } from './AdminImport';
import type { Draft } from './types';

type Api = ReturnType<typeof createAdminClient>;
export function ImportWorkList({ api, onNavigate, refreshVersion }: { api: Api; onNavigate: (url: string) => void; refreshVersion: number }) {
  const read = useAdminRead<ImportWork[]>(api, 'work-list', { body: {} }, refreshVersion);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const items = read.data ?? [];
  return <section className="cms-import-work" aria-labelledby="cms-work-title"><div className="cms-list-heading"><h2 id="cms-work-title"><FileClock size={20} aria-hidden="true" />งานตรวจไฟล์ที่บันทึกไว้</h2></div>
    {(error || read.error) && <p className="cms-error" role="alert">{error || read.error}<button className="cms-text-button" onClick={read.reload}><RefreshCw size={16} />ลองใหม่</button></p>}
    {!items.length && !read.loading && !read.error ? <p className="cms-help">ไม่มีงานตรวจไฟล์ค้างในบัญชีนี้</p> : <div className="cms-table-scroll cms-draft-list"><table className="cms-table"><thead><tr><th>ไฟล์</th><th>บันทึกล่าสุด</th><th>สถานะ</th><th>ดำเนินการ</th></tr></thead>
      <tbody>{items.map(work => <tr key={work.id}><td className="cms-draft-name"><span className="cms-draft-icon"><FileClock size={22} aria-hidden="true" /></span><div>{work.title}<small>{work.filename}</small></div></td><td className="cms-draft-date"><time dateTime={work.updated_at}>{new Date(work.updated_at).toLocaleString('th-TH')}</time></td>
        <td className="cms-draft-state">{work.draft_id ? 'สร้างฉบับร่างแล้ว' : work.snapshot_id ? 'ตรวจไฟล์ค้างอยู่' : 'อัปโหลดยังไม่ครบ'}</td><td className="cms-draft-open"><div className="cms-actions">
          <button className="icon-button" aria-label={`เปิดงาน ${work.title}`} title="ทำต่อ" disabled={!work.snapshot_id} onClick={() => onNavigate(work.draft_id ? `/admin?draft=${work.draft_id}` : `/admin?view=upload&work=${work.id}`)}><ArrowRight size={18} /></button>
          <button className="icon-button" aria-label={`ดาวน์โหลดต้นฉบับ ${work.filename}`} title="ดาวน์โหลดไฟล์ต้นฉบับ" disabled={!work.source_id || Boolean(busy)} onClick={() => {
            setBusy(work.id); setError(''); void downloadImportObject(api, work.id, work.source_id!).then(bytes => downloadImportBlob(new Blob([bytes]), work.filename))
              .catch(failure => setError(failure instanceof Error ? failure.message : 'ดาวน์โหลดไม่สำเร็จ')).finally(() => setBusy(''));
          }}><Download size={18} /></button></div></td></tr>)}</tbody></table></div>}
  </section>;
}
export function ResumeImport({ api, workId, onClose, onCreated }: { api: Api; workId: string; onClose: () => void; onCreated: (draft: Draft) => void }) {
  const [state, setState] = useState<Awaited<ReturnType<typeof loadImportWork>> | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setError(''); setState(null);
    void loadImportWork(api, workId).then(next => { if (!cancelled) setState(next); })
      .catch(failure => { if (!cancelled) setError(failure instanceof Error ? failure.message : 'โหลดงานค้างไม่ได้'); });
    return () => { cancelled = true; };
  }, [api, workId, retry]);
  if (state) return <AdminImport api={api} initial={state} onClose={onClose} onCreated={onCreated} />;
  return <WorkspaceDialog title="เปิดงานตรวจไฟล์" onClose={onClose}><WorkspaceEmptyState heading="h3" icon={FileClock}
    title={error ? 'ยังเปิดงานค้างไม่ได้' : 'กำลังเปิดงานที่บันทึกไว้'} description={error || undefined}
    action={error ? <button className="secondary-button" onClick={() => setRetry(value => value + 1)}><RefreshCw size={16} />ลองใหม่</button> : undefined} /></WorkspaceDialog>;
}
