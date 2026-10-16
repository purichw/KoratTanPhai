import { useCallback, useEffect, useRef, useState } from 'react';
import { AdminRequestError, type createAdminClient } from './client';
import { uploadImportObject, type ImportSnapshot, type ImportWork } from './importWork';

export function useImportAutosave(api: ReturnType<typeof createAdminClient>, snapshot: ImportSnapshot | null, file: File | undefined,
  initial?: { work: ImportWork; snapshot: ImportSnapshot }, paused = false) {
  const record = useRef<ImportWork | undefined>(initial?.work);
  const ids = useRef({ work: initial?.work.id ?? crypto.randomUUID(), source: initial?.work.source_id ?? crypto.randomUUID() });
  const sourceUploaded = useRef(Boolean(initial?.work.source_id));
  const pending = useRef<{ text: string; id: string; uploaded: boolean } | null>(null);
  const running = useRef<Promise<ImportWork | undefined> | null>(null);
  const conflict = useRef(false);
  const [saved, setSaved] = useState(initial ? JSON.stringify(initial.snapshot) : '');
  const savedText = useRef(saved);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>(initial ? 'saved' : 'idle');
  const [error, setError] = useState('');
  const text = snapshot ? JSON.stringify(snapshot) : '';
  const latest = useRef({ text, snapshot, file, saved });
  latest.current = { text, snapshot, file, saved };
  const flush = useCallback((): Promise<ImportWork | undefined> => {
    if (running.current) return running.current.then(() => flush());
    const state = latest.current;
    if (!state.snapshot || !state.text || state.text === savedText.current) return Promise.resolve(record.current);
    if (conflict.current) return Promise.reject(new Error('งานค้างถูกบันทึกจากอีกหน้าต่างแล้ว กรุณาโหลดงานค้างใหม่ก่อนทำต่อ'));
    setStatus('saving'); setError('');
    const task = (async () => {
      try {
        if (!record.current) record.current = await api<ImportWork>('work-create', { body: { workId: ids.current.work,
          title: state.snapshot!.title.trim() || state.snapshot!.filename, filename: state.snapshot!.filename } });
        if (!sourceUploaded.current) {
          if (!state.file) throw new Error('ไม่พบไฟล์ต้นฉบับ กรุณาเลือกไฟล์อีกครั้ง');
          await uploadImportObject(api, ids.current.work, ids.current.source, 'source', new Uint8Array(await state.file.arrayBuffer()));
          sourceUploaded.current = true;
        }
        if (pending.current?.text !== state.text) pending.current = { text: state.text, id: crypto.randomUUID(), uploaded: false };
        if (!pending.current.uploaded) {
          await uploadImportObject(api, ids.current.work, pending.current.id, 'snapshot', new TextEncoder().encode(state.text));
          pending.current.uploaded = true;
        }
        record.current = await api<ImportWork>('work-save', { body: { workId: ids.current.work, revision: record.current.revision,
          sourceId: ids.current.source, snapshotId: pending.current.id, title: state.snapshot!.title.trim() || state.snapshot!.filename } });
        savedText.current = state.text; setSaved(state.text); setStatus('saved');
        return record.current;
      } catch (failure) {
        if (failure instanceof AdminRequestError && failure.code === 'revision_conflict') conflict.current = true;
        setError(failure instanceof Error ? failure.message : 'ยังบันทึกงานค้างไม่สำเร็จ'); setStatus('error'); throw failure;
      } finally { running.current = null; }
    })();
    running.current = task;
    return task.then(result => latest.current.text && latest.current.text !== savedText.current ? flush() : result);
  }, [api]);
  useEffect(() => {
    if (paused || !text || text === saved || conflict.current) return;
    const timer = window.setTimeout(() => { void flush().catch(() => {}); }, 1200);
    return () => window.clearTimeout(timer);
  }, [text, saved, paused, flush]);
  const reset = () => {
    record.current = undefined; ids.current = { work: crypto.randomUUID(), source: crypto.randomUUID() };
    sourceUploaded.current = false; pending.current = null; conflict.current = false;
    savedText.current = '';
    setSaved(''); setStatus('idle'); setError('');
  };
  return { record, dirty: Boolean(text && text !== saved), status, error, flush, reset };
}
