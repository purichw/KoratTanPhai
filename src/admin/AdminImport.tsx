import { useEffect, useMemo, useRef, useState } from 'react';
import { FileUp, ArrowLeft, ArrowRight, Download, CheckCircle2, Save } from 'lucide-react';
import { AppSelect } from '../components/AppSelect';
import { MonthSelect } from '../components/MonthSelect';
import { WorkspaceDialog } from '../components/WorkspaceDialog';
import { DATA_FIELDS, type DataKind } from '../../shared/dataFields.mjs';
import { MetadataForm } from './DataRecordForm';
import { kindLabels, rowsKey, type Payload, type Draft } from './types';
import type { ImportFile, ImportSheet } from './workbook';
import type { createAdminClient } from './client';
import { isOriginalForecastSheet, importOriginalForecast, matchRev3Columns, normalizeRev3Sheet, rev3Fields, riskHelp } from './normalizedForecastImport';
import type { CsvEncoding, DataFileFormat } from './readDataFile';
import templateUrl from '../assets/rev3-import-template.xlsx?url';
import csvTemplateUrl from '../assets/rev3-import-template.csv?url';
import { readWorkbookInWorker } from './readWorkbook';
import { ConfirmAction } from './ConfirmAction';
import { useUnsavedChanges } from './useUnsavedChanges';
import { monthLabel } from './dataPresentation';
import { ImportSheetReview } from './ImportSheetReview';
import { activeImportSheet, importCellIssues, importEvidence, inspectRev3Import, type ImportArea } from './importReview';
import { ImportPayloadReview } from './ImportPayloadReview';
import { useImportValidation } from './useImportValidation';
import { useImportAutosave } from './useImportAutosave';
import { downloadImportObject, type ImportWork, type ImportSnapshot } from './importWork';

export function emptyEnvelope(kind: DataKind): Payload {
  if (kind === 'archive') return { schemaVersion: 1, baseDatasetId: '', originMonth: '', scope: { subdistrictCodes: [] }, predictions: [] };
  return kind === 'forecast' ? { schemaVersion: 1, runId: '', modelVersion: '', originMonth: '',
    informationCutoff: '', createdAt: '', scope: { subdistrictCodes: [] }, inputBatches: [], predictions: [] }
    : { schemaVersion: 1, sourceId: '', batchId: '', ...(kind === 'station' ? {} : { kind }), observations: [] };
}

export function AdminImport({ api, onClose, onCreated, initial }: { api: ReturnType<typeof createAdminClient>; onClose: () => void; onCreated: (draft: Draft) => void;
  initial?: { work: ImportWork; snapshot: ImportSnapshot } }) {
  const saved = initial?.snapshot;
  const [kind, setKind] = useState<DataKind>(saved?.kind ?? 'archive');
  const [title, setTitle] = useState(saved?.title ?? '');
  const [filename, setFilename] = useState(saved?.filename ?? '');
  const [book, setBook] = useState<ImportFile | null>(saved?.book ?? null);
  const [sheet, setSheet] = useState<ImportSheet | null>(saved?.sheet ?? null);
  const [originalSheet, setOriginalSheet] = useState<ImportSheet | null>(saved?.originalSheet ?? null);
  const [areas, setAreas] = useState<ImportArea[] | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>(saved?.mapping ?? {});
  const [ignored, setIgnored] = useState<string[]>(saved?.ignored ?? []);
  const [payload, setPayload] = useState<Payload | null>(saved?.payload ?? null);
  const [basePayload, setBasePayload] = useState<Payload | null>(saved?.basePayload ?? null);
  const [headerReviewed, setHeaderReviewed] = useState(saved?.headerReviewed ?? false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [fileHash, setFileHash] = useState(saved?.fileHash ?? '');
  const [origin, setOrigin] = useState(saved?.origin ?? '');
  const [catalog, setCatalog] = useState<{ revision: { datasetId: string }; periods: string[] } | null>(null);
  const [rowStart, setRowStart] = useState(saved?.rowStart ?? 1);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [confirmBack, setConfirmBack] = useState(false);
  const [csvEncoding, setCsvEncoding] = useState<CsvEncoding>(saved?.csvEncoding ?? 'utf-8');
  const reading = useRef<AbortController | null>(null);
  const lastFile = useRef<File | undefined>(undefined);
  const input = useRef<HTMLInputElement>(null);
  const editedSheets = useRef(new Map<string, ImportSheet>(saved?.editedSheets));
  const preparedPayload = useRef<Payload | null>(saved?.preparedPayload ?? null);
  const showPreview = (next: Payload) => { preparedPayload.current = next; setPayload(next); };
  const snapshot: ImportSnapshot | null = filename && (sheet || payload) ? { version: 1, kind, title, filename, book, sheet, originalSheet,
    editedSheets: [...editedSheets.current], mapping, ignored, payload, basePayload, preparedPayload: preparedPayload.current,
    fileHash, origin, rowStart, headerReviewed, csvEncoding } : null;
  const autosave = useImportAutosave(api, snapshot, lastFile.current, initial, busy);
  const allowSavedNavigation = useUnsavedChanges(autosave.dirty || busy || autosave.status === 'saving', setError);
  useEffect(() => {
    if (!initial || kind !== 'archive') return;
    let cancelled = false;
    void Promise.all([api<NonNullable<typeof catalog>>('forecast-catalog'), api<ImportArea[]>('forecast-crosswalk')])
      .then(([nextCatalog, nextAreas]) => { if (!cancelled) { setCatalog(nextCatalog); setAreas(nextAreas); } })
      .catch(failure => { if (!cancelled) setError(failure instanceof Error ? failure.message : 'โหลดทะเบียนไม่สำเร็จ'); });
    return () => { cancelled = true; };
  }, [api, initial, kind]);
  useEffect(() => () => reading.current?.abort(), []);
  const rev3 = kind === 'archive' && !book?.metadata?.baseDatasetId;
  const validation = useImportValidation(api, kind, payload);
  const inspection = useMemo(() => sheet ? rev3 ? inspectRev3Import(sheet, mapping, areas, catalog?.periods ?? null, origin)
    : { issues: importCellIssues(sheet, Object.values(mapping)), periods: [], missing: [] } : null, [sheet, rev3, mapping, areas, catalog, origin]);
  const parsed = useMemo(() => {
    if (!sheet || !rev3) return { sheet: null, periods: [] as string[], error: '' };
    try {
      const normalized = normalizeRev3Sheet(activeImportSheet(sheet), mapping);
      return { sheet: normalized, periods: inspection?.periods ?? [], error: '' };
    } catch (failure) { return { sheet: null, periods: [] as string[], error: failure instanceof Error ? failure.message : 'ตรวจรูปแบบไม่สำเร็จ' }; }
  }, [sheet, mapping, rev3, inspection]);
  useEffect(() => { if (!parsed.periods.includes(origin)) setOrigin(parsed.periods[0] ?? ''); }, [parsed, origin]);
  function selectSheet(next: ImportSheet, nextKind = kind, metadata = book?.metadata) {
    setSheet(editedSheets.current.get(next.name) ?? next); setOriginalSheet(next); setIgnored([]); setRowStart(1); setHeaderReviewed(false);
    if (isOriginalForecastSheet(next)) { nextKind = 'archive'; setKind('archive'); }
    setMapping(nextKind === 'archive' && !metadata?.baseDatasetId ? matchRev3Columns(next)
      : Object.fromEntries(DATA_FIELDS[nextKind].map(field => [field.key, next.columns.includes(field.key) ? field.key : next.columns.includes(field.label) ? field.label : ''])));
  }
  async function read(file?: File, encoding = csvEncoding) {
    if (!file) return;
    if (file !== lastFile.current && (sheet || payload)) {
      try { await autosave.flush(); autosave.reset(); }
      catch (failure) { setError(failure instanceof Error ? failure.message : 'บันทึกไฟล์เดิมก่อนเปลี่ยนไฟล์'); return; }
    }
    lastFile.current = file;
    setBusy(true); setError(''); setPayload(null); setBasePayload(null); setBook(null); setSheet(null); setOriginalSheet(null); setCatalog(null); setAreas(null); editedSheets.current.clear();
    try {
      if (file.size > 20 * 1024 * 1024) throw new Error('ไฟล์เกิน 20 MB');
      setFilename(file.name); setTitle(file.name.replace(/\.[^.]+$/, ''));
      if (file.name.toLowerCase().endsWith('.json')) {
        const next = JSON.parse(await file.text()) as Payload;
        if (!next || typeof next !== 'object' || Array.isArray(next)) throw new Error('ไฟล์นี้ไม่ใช่ชุดข้อมูลที่รองรับ กรุณาเลือกไฟล์ที่ส่งออกจากระบบ');
        const nextKind: DataKind = 'predictions' in next ? ('baseDatasetId' in next ? 'archive' : 'forecast') : next.kind === 'satellite' ? 'satellite' : next.kind === 'crop' ? 'crop' : 'station';
        if (nextKind === 'forecast') throw new Error('การนำเข้าผลแบบจำลองใหม่ยังไม่เปิดใช้ เลือกไฟล์พยากรณ์รอบเดิมที่ส่งออกจากระบบ');
        if (!Array.isArray(next[rowsKey(nextKind)])) throw new Error('ไม่พบตารางข้อมูลในไฟล์ กรุณาเลือกไฟล์ที่ส่งออกจากระบบ');
        setKind(nextKind); showPreview(next);
      } else if (/\.(xlsx|xls|csv)$/i.test(file.name)) {
        const bytes = await file.arrayBuffer();
        setFileHash([...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(value => value.toString(16).padStart(2, '0')).join(''));
        reading.current = new AbortController();
        const imported = await readWorkbookInWorker(bytes, reading.current.signal, file.name.split('.').pop()!.toLowerCase() as DataFileFormat, encoding);
        const nextKind: DataKind = imported.metadata?.kind === 'satellite' ? 'satellite' : imported.metadata?.kind === 'crop' ? 'crop'
          : imported.metadata?.baseDatasetId !== undefined ? 'archive' : imported.metadata?.runId !== undefined ? 'forecast'
          : imported.metadata?.sourceId !== undefined && imported.metadata?.batchId !== undefined ? 'station' : kind;
        if (nextKind === 'forecast') throw new Error('การนำเข้าผลแบบจำลองใหม่ยังไม่เปิดใช้ เลือกไฟล์พยากรณ์รอบเดิมที่ส่งออกจากระบบ');
        const initial = imported.sheets.find(isOriginalForecastSheet) ?? imported.sheets[0];
        setKind(nextKind); setBook(imported); selectSheet(initial, nextKind, imported.metadata);
        if (nextKind === 'archive') {
          const [nextCatalog, nextAreas] = await Promise.all([
            api<NonNullable<typeof catalog>>('forecast-catalog'),
            api<ImportArea[]>('forecast-crosswalk'),
          ]);
          setCatalog(nextCatalog); setAreas(nextAreas);
        }
      } else throw new Error('รองรับ CSV, Excel .xlsx และ .xls หรือ JSON ที่ส่งออกจากระบบ');
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'อ่านไฟล์ไม่สำเร็จ'); }
    finally { setBusy(false); if (input.current) input.current.value = ''; }
  }
  async function prepare() {
    if (!sheet) return;
    setError(''); setBusy(true);
    try {
      if (inspection?.issues.some(issue => issue.severity === 'error')) throw new Error('แก้ไขจุดที่ต้องตรวจสอบในไฟล์ก่อนดำเนินการต่อ');
      if (sheet.headerWarnings?.length && !headerReviewed) throw new Error('ยืนยันการจับคู่หัวคอลัมน์ที่ว่างหรือซ้ำก่อน');
      if (rev3) {
        if (!parsed.sheet || !origin) throw new Error(parsed.error || 'ยังไม่มีแถวข้อมูล กรุณากรอกข้อมูลตามแม่แบบ');
        if (!catalog?.revision) throw new Error('ยังโหลดรุ่นที่เผยแพร่ไม่สำเร็จ');
        const existing = catalog.periods.includes(origin);
        const base = await api<Payload>(existing ? 'forecast-source' : 'forecast-template', { body: { datasetId: catalog.revision.datasetId, originMonth: origin } });
        setBasePayload(existing ? base : null);
        if (!areas || !originalSheet) throw new Error('ยังโหลดทะเบียนพื้นที่ไม่สำเร็จ กรุณาลองใหม่');
        const next = importOriginalForecast(parsed.sheet, base, areas, origin);
        showPreview({ ...next, sourceImport: importEvidence(originalSheet, sheet, fileHash, mapping, origin) });
        return;
      }
      const { mapImportRows } = await import('./workbook');
      const active = activeImportSheet(sheet);
      const batch = { ...active, rows: active.rows.slice(rowStart - 1, rowStart - 1 + 2000) };
      showPreview({ ...emptyEnvelope(kind), ...book?.metadata, [rowsKey(kind)]: mapImportRows(kind, batch, mapping, ignored) });
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'จับคู่คอลัมน์ไม่สำเร็จ'); }
    finally { setBusy(false); }
  }
  async function save() {
    setBusy(true); setError('');
    try {
      const work = await autosave.flush();
      if (!work) throw new Error('บันทึกงานตรวจไฟล์ก่อนสร้างฉบับร่าง');
      const draft = await api<Draft>('work-convert', { body: { workId: work.id, revision: work.revision, draft: { title, kind, payload, sourceFilename: filename } } });
      allowSavedNavigation();
      onCreated(draft);
    }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'สร้างฉบับร่างไม่สำเร็จ'); }
    finally { setBusy(false); }
  }
  const close = () => {
    if (busy) { reading.current?.abort(); return; }
    if (autosave.dirty || autosave.status === 'saving') { setConfirmDiscard(true); return; }
    onClose();
  };
  return <><WorkspaceDialog title="นำเข้าชุดข้อมูล" wide bounded closeLabel="ปิดการนำเข้าข้อมูล" onClose={close}>
    <fieldset className="cms-import" aria-busy={busy} disabled={busy}>
      <p className="cms-help">อัปโหลด CSV หรือ Excel รุ่นใหม่ (.xlsx) และรุ่นเก่า (.xls) ขนาดไม่เกิน 20 MB ตรวจข้อมูลก่อนบันทึกเป็นฉบับร่าง การนำเข้ายังไม่เปลี่ยนเว็บไซต์</p>
      {error && <p className="cms-error" role="alert">{error}</p>}
      {snapshot && <div className="cms-validation-bar cms-autosave" role="status"><div><strong><CheckCircle2 size={18} aria-hidden="true" />{autosave.status === 'saving' ? 'กำลังบันทึกงานค้าง' : autosave.dirty ? 'มีการแก้ไขที่ยังไม่บันทึก' : 'บันทึกงานค้างแล้ว'}</strong>
        <span>{autosave.error || 'เก็บไว้ในบัญชีผู้ดูแลนี้ ยังไม่เผยแพร่บนเว็บไซต์'}</span></div>
        <button type="button" className="secondary-button" disabled={busy || autosave.status === 'saving'} onClick={() => { void autosave.flush().catch(() => {}); }}><Save size={16} />บันทึกงานค้าง</button></div>}
      {!payload ? <>
        <div className="cms-import-controls"><AppSelect label="ประเภทข้อมูล" ariaLabel="ประเภทข้อมูล" value={kind}
          options={Object.entries(kindLabels).filter(([value]) => value !== 'forecast').map(([value, label]) => ({ value, label }))}
          onChange={value => { setKind(value as DataKind); if (sheet) selectSheet(book?.sheets.find(item => item.name === sheet.name) ?? sheet, value as DataKind); }} />
          <input ref={input} className="sr-only" type="file" accept=".xlsx,.xls,.csv,.json" disabled={busy} aria-label="ไฟล์ข้อมูล"
            onChange={event => { void read(event.target.files?.[0]); }} />
          <button className="primary-button" type="button" disabled={busy} onClick={() => input.current?.click()}><FileUp size={18} />{busy ? 'กำลังอ่านไฟล์' : 'เลือกไฟล์'}</button></div>
        {kind !== 'archive' && <p className="cms-help">ข้อมูลประเภทนี้รับเก็บจากไฟล์เท่านั้น ยังไม่ใช้สร้างพยากรณ์หรือแสดงบนแผนที่อัตโนมัติ</p>}
        {kind === 'archive' && <section className="cms-import-guide" aria-labelledby="cms-import-guide-title"><h3 id="cms-import-guide-title">เริ่มจากแม่แบบพยากรณ์ rev3</h3>
          <p>เตรียมรายชื่อ 289 ตำบลให้แล้ว กรอกปี–เดือนต้นทางและผลล่วงหน้า 1–6 เดือนในชีต “ข้อมูลพยากรณ์” ดูตัวอย่างและคำอธิบายได้ในชีตแยก</p>
          <div className="cms-actions cms-template-downloads"><a className="secondary-button" href={templateUrl} download="Korat_rev3_template.xlsx"><Download size={16} />แม่แบบ Excel พร้อมคำอธิบาย</a>
            <a className="secondary-button" href={csvTemplateUrl} download="Korat_rev3_template.csv"><Download size={16} />แม่แบบ CSV</a></div>
          <p className="cms-help">CSV มีได้เพียงตารางเดียว กรอกให้ครบ 289 ตำบลต่อรอบเดือน ใช้ได้ทั้งรอบใหม่และตรวจแก้รอบเดิม</p>
          <details className="cms-import-dictionary"><summary>ความหมายของ 12 คอลัมน์และตัวอย่าง</summary><p>{riskHelp}</p>
            <dl>{rev3Fields.map(field => <div key={field.key}><dt>{field.label}</dt><dd>{field.description}<small>ตัวอย่าง: {field.example}</small></dd></div>)}</dl></details>
        </section>}
        <details className="cms-technical"><summary>หากภาษาไทยใน CSV อ่านไม่ออก</summary><AppSelect label="ภาษาในไฟล์ CSV" value={csvEncoding}
          options={[{ value: 'utf-8', label: 'UTF-8 (ทั่วไป)' }, { value: 'windows-874', label: 'ภาษาไทยจาก Excel รุ่นเก่า' }]}
          onChange={value => {
            setCsvEncoding(value as CsvEncoding);
            if (!filename.toLowerCase().endsWith('.csv')) return;
            if (lastFile.current) void read(lastFile.current, value as CsvEncoding);
            else if (initial?.work.source_id) {
              setBusy(true); void downloadImportObject(api, initial.work.id, initial.work.source_id).then(bytes => {
                lastFile.current = new File([bytes], filename); return read(lastFile.current, value as CsvEncoding);
              }).catch(failure => setError(failure instanceof Error ? failure.message : 'โหลดต้นฉบับไม่ได้')).finally(() => setBusy(false));
            }
          }} /></details>
        {book && sheet && <>
          <AppSelect label="ชีต" ariaLabel="ชีตข้อมูล" value={sheet.name} options={book.sheets.map(item => ({ value: item.name, label: `${item.name} · ${item.rows.length} รายการ` }))}
            onChange={value => selectSheet(book.sheets.find(item => item.name === value)!)} />
          {rev3 ? <><h3>พยากรณ์ล่วงหน้า 1–6 เดือนจากต้นฉบับ</h3>
            <details className="cms-import-mapping" open={rev3Fields.some(field => !mapping[field.key]) ? true : undefined}><summary>ตรวจการจับคู่คอลัมน์ ({rev3Fields.filter(field => mapping[field.key]).length} / 12 ช่อง)</summary>
              <div className="cms-mapping">{rev3Fields.map(field => <div key={field.key}><div><strong>{field.label}</strong><p>{field.description}</p><small>ตัวอย่างที่กรอกได้: {field.example}</small>
                {mapping[field.key] && <small>พบในไฟล์: {sheet.rows.slice(0, 3).map(row => String(row[mapping[field.key]] ?? '') || 'ช่องว่าง').join(' · ')}</small>}</div>
                <AppSelect ariaLabel={`คอลัมน์ ${field.label}`} value={mapping[field.key] ?? ''} searchable options={[{ value: '', label: 'เลือกคอลัมน์ในไฟล์' }, ...sheet.columns.map(column => ({ value: column, label: column }))]}
                  onChange={value => { setHeaderReviewed(false); setMapping(current => ({ ...current, [field.key]: value })); }} /></div>)}</div>
            </details>
            {parsed.error && <p className="cms-warning" role="status">{parsed.error}</p>}
            {parsed.periods.length > 0 && <><MonthSelect ariaLabel="เดือนตั้งต้นในไฟล์นำเข้า" value={origin} onChange={setOrigin}
              options={parsed.periods.map(value => ({ value, label: monthLabel(value) }))} /><p>{sheet.rows.length.toLocaleString('th-TH')} แถวต้นฉบับ · นำเข้าเฉพาะ {monthLabel(origin)} ทีละรอบเดือน</p></>}
            {catalog && origin && !catalog.periods.includes(origin) && <p className="cms-warning">รอบใหม่ {monthLabel(origin)} · ไม่มีค่ารอบเดิมมาเติมแทน ต้องตรวจข้อมูลให้ครบก่อนเผยแพร่</p>}
            <p className="cms-help">{riskHelp}</p>
          </> : <><h3>จับคู่คอลัมน์</h3><div className="cms-mapping">{DATA_FIELDS[kind].map(field => <div key={field.key}>
            <span>{field.label}{field.optional && <small>ไม่บังคับ</small>}</span>
            <AppSelect ariaLabel={`คอลัมน์ ${field.label}`} value={mapping[field.key] ?? ''} searchable
              options={[{ value: '', label: 'ยังไม่จับคู่' }, ...sheet.columns.map(column => ({ value: column, label: column }))]}
              onChange={value => { setHeaderReviewed(false); setMapping(current => ({ ...current, [field.key]: value })); }} />
          </div>)}</div>
          {sheet.columns.filter(column => !Object.values(mapping).includes(column)).map(column => <label className="cms-check" key={column}>
            <input type="checkbox" checked={ignored.includes(column)} onChange={event => setIgnored(current => event.target.checked ? [...current, column] : current.filter(item => item !== column))} />ไม่นำเข้าคอลัมน์ {column}</label>)}
          {sheet.rows.length > 2000 && <label className="cms-field">ช่วงรายการนำเข้า<AppSelect ariaLabel="ช่วงรายการนำเข้า" value={String(rowStart)}
            options={Array.from({ length: Math.ceil(sheet.rows.length / 2000) }, (_, index) => ({ value: String(index * 2000 + 1), label: `${index * 2000 + 1}–${Math.min(sheet.rows.length, (index + 1) * 2000)} จาก ${sheet.rows.length} รายการ` }))}
            onChange={value => setRowStart(Number(value))} /></label>}</>}
          {inspection && <ImportSheetReview sheet={sheet} mapping={mapping} issues={inspection.issues} areas={areas} missing={inspection.missing} origin={origin} rev3={rev3} metadata={book.metadata} onChange={next => { editedSheets.current.set(next.name, next); setSheet(next); }} />}
          {Boolean(sheet.headerWarnings?.length) && <label className="cms-check"><input type="checkbox" checked={headerReviewed} onChange={event => setHeaderReviewed(event.target.checked)} />ตรวจค่าตัวอย่างและยืนยันการจับคู่คอลัมน์ที่ว่างหรือซ้ำแล้ว</label>}
          {rev3 && (!catalog || !areas) && <p className="cms-warning">ยังตรวจทะเบียนและรอบเดือนไม่สำเร็จ <button className="cms-text-button" type="button" onClick={() => {
            setBusy(true); setError(''); void (async () => { try { setCatalog(await api<NonNullable<typeof catalog>>('forecast-catalog')); setAreas(await api<ImportArea[]>('forecast-crosswalk')); }
              catch (failure) { setError(failure instanceof Error ? failure.message : 'โหลดทะเบียนไม่สำเร็จ'); } finally { setBusy(false); } })();
          }}>ลองใหม่</button></p>}
          <footer className="cms-actions"><button className="primary-button" type="button" disabled={busy || Boolean(sheet.headerWarnings?.length && !headerReviewed) || inspection?.issues.some(issue => issue.severity === 'error') || (rev3 && (!areas || !parsed.sheet || !catalog?.revision || !origin))} onClick={() => { void prepare(); }}>ตรวจรายละเอียด<ArrowRight size={18} /></button></footer>
        </>}
      </> : <>
        <div className="cms-import-summary"><strong>{kindLabels[kind]}</strong><span>{(payload[rowsKey(kind)] as Payload[]).length} รายการ · {filename}</span></div>
        <label className="cms-field">ชื่อชุดข้อมูล<input value={title} maxLength={160} onChange={event => setTitle(event.target.value)} /></label>
        {kind === 'archive' ? <p>ข้อมูลต้นทาง {monthLabel(payload.originMonth)} · {(payload.predictions as Payload[]).length} ค่าพยากรณ์</p>
          : <MetadataForm value={{ ...emptyEnvelope(kind), ...payload }} onChange={setPayload} />}
        <ImportPayloadReview kind={kind} payload={payload} base={basePayload} validation={validation} onChange={setPayload} />
        <footer className="cms-actions">
          <button className="secondary-button" type="button" disabled={busy} onClick={() => { if (payload !== preparedPayload.current) setConfirmBack(true); else setPayload(null); }}><ArrowLeft size={18} />ย้อนกลับ</button>
          <button className="primary-button" type="button" disabled={busy || !title.trim()} onClick={() => { void save(); }}>{busy ? 'กำลังบันทึก' : 'สร้างฉบับร่าง'}</button>
        </footer>
      </>}
    </fieldset>
  </WorkspaceDialog>{confirmDiscard && <WorkspaceDialog title="บันทึกงานค้างก่อนปิด" onClose={() => setConfirmDiscard(false)}>
    <div className="cms-form"><p>กลับมาทำต่อได้จากรายการนำเข้า การบันทึกนี้ยังไม่เผยแพร่ข้อมูล</p>
      {autosave.error && <p className="cms-error" role="alert">{autosave.error}</p>}
      <div className="cms-actions"><button className="secondary-button" disabled={autosave.status === 'saving'} onClick={() => { allowSavedNavigation(); onClose(); }}>ปิดโดยไม่เก็บการแก้ไขล่าสุด</button>
        <button className="primary-button" disabled={autosave.status === 'saving'} onClick={() => { void autosave.flush().then(() => { allowSavedNavigation(); onClose(); }).catch(() => {}); }}><Save size={16} />บันทึกแล้วปิด</button></div></div>
  </WorkspaceDialog>}
    {confirmBack && <ConfirmAction title="ย้อนกลับไปตรวจไฟล์?" message="ค่าที่แก้ในขั้นตรวจรายละเอียดจะไม่ถูกเก็บไว้ แต่การแก้แถวในขั้นตรวจไฟล์ยังอยู่"
      confirmLabel="ย้อนกลับโดยไม่เก็บค่าขั้นนี้" onCancel={() => setConfirmBack(false)} onConfirm={() => { setConfirmBack(false); setPayload(null); }} />}</>;
}
