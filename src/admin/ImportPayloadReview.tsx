import { useState } from 'react';
import { RefreshCw, ShieldCheck, Minus } from 'lucide-react';
import { WorkspaceDialog } from '../components/WorkspaceDialog';
import { DataRecordForm } from './DataRecordForm';
import { rowsKey, type DataKind, type Payload } from './types';
import type { useImportValidation } from './useImportValidation';
import { displayCell } from './dataPresentation';
import { ConfirmAction } from './ConfirmAction';
import { DATA_FIELDS } from '../../shared/dataFields.mjs';
import { ImportReviewDownloads } from './ImportReviewDownloads';

export function ImportPayloadReview({ kind, payload, base, validation, onChange }: { kind: DataKind; payload: Payload; base: Payload | null;
  validation: ReturnType<typeof useImportValidation>; onChange: (payload: Payload) => void }) {
  const [edit, setEdit] = useState<{ index: number; value: Payload } | null>(null);
  const [discard, setDiscard] = useState(false);
  const [remove, setRemove] = useState(false);
  const rows = payload[rowsKey(kind)] as Payload[];
  const closeEdit = () => { if (edit && JSON.stringify(edit.value) !== JSON.stringify(rows[edit.index])) setDiscard(true); else setEdit(null); };
  const baseline = new Map(((base?.predictions ?? []) as Payload[]).map(row => [`${row.subdistrictCode}/${row.horizonMonths}`, row]));
  const changes = base ? rows.filter(row => { const old = baseline.get(`${row.subdistrictCode}/${row.horizonMonths}`); return old && (old.riskCode !== row.riskCode || old.status !== row.status); }) : [];
  return <section className="cms-import-review" aria-label="ผลตรวจข้อมูลก่อนสร้างฉบับร่าง">
    <div className="cms-validation-bar" role="status"><div><strong>{validation.pending ? 'กำลังตรวจข้อมูล'
      : validation.error ? 'ยังตรวจข้อมูลไม่ได้' : validation.report?.valid ? 'ผ่านการตรวจรูปแบบข้อมูล' : `พบ ${validation.report?.issues.length ?? 0} จุดที่ต้องแก้ไข`}</strong>
      <span>ตรวจตามข้อกำหนดเดียวกับ API · ยังไม่เผยแพร่</span></div><ShieldCheck size={22} aria-hidden="true" /></div>
    {validation.error && <p className="cms-error" role="alert">{validation.error}<button type="button" className="cms-text-button" onClick={validation.retry}><RefreshCw size={16} />ลองตรวจใหม่</button></p>}
    {base && <details className="cms-issues"><summary>ต่างจากชุดที่เผยแพร่ {changes.length} ค่า · ตรงกัน {rows.length - changes.length} ค่า</summary>
      <p>การเปลี่ยนค่าจากชุดเดิมไม่ใช่แถวซ้ำขัดแย้ง ยังต้องยืนยันเผยแพร่จากฉบับร่าง</p>
      <ul>{changes.slice(0, 100).map(row => <li key={`${row.subdistrictCode}/${row.horizonMonths}`}>รหัส {String(row.subdistrictCode)} · T+{String(row.horizonMonths)}:
        {' '}{displayCell('riskCode', baseline.get(`${row.subdistrictCode}/${row.horizonMonths}`)!.riskCode)} → {displayCell('riskCode', row.riskCode)}</li>)}</ul>
      {changes.length > 100 && <p>แสดง 100 จาก {changes.length} ค่าที่เปลี่ยน</p>}</details>}
    {validation.report && !validation.report.valid && <details className="cms-issues" open><summary>รายละเอียดที่ต้องแก้ไข</summary><ul>
      {validation.report.issues.slice(0, 100).map((issue, index) => <li key={index}>{issue.row !== null && rows[issue.row - 1] && <button className="cms-text-button" type="button"
        onClick={() => setEdit({ index: issue.row! - 1, value: structuredClone(rows[issue.row! - 1]) })}>แก้ไขรายการ {issue.row}</button>}
        <span>{issue.message}</span>{issue.suggestion && <small>{issue.suggestion}</small>}</li>)}</ul>
      {validation.report.issues.length > 100 && <p>แสดง 100 จาก {validation.report.issues.length} จุด</p>}</details>}
    <ImportReviewDownloads sheet={{ name: 'ข้อมูลที่เตรียมนำเข้า', columns: [...new Set([...DATA_FIELDS[kind].map(field => field.key), ...rows.flatMap(row => Object.keys(row))])], rows }}
      metadata={Object.fromEntries(Object.entries(payload).filter(([key]) => key !== rowsKey(kind)))}
      ready={Boolean(validation.report) && !validation.pending && !validation.error}
      issues={(validation.report?.issues ?? []).map(issue => ({ row: issue.row === null ? null : issue.row - 1,
        column: issue.field ?? undefined, code: issue.code ?? 'validation', message: issue.message,
        suggestion: issue.suggestion ?? 'ตรวจค่าตามข้อกำหนดของชุดข้อมูลแล้วอัปโหลดกลับเพื่อตรวจใหม่', severity: 'error' }))} />
    {edit && <WorkspaceDialog title={`แก้ไขรายการ ${edit.index + 1}`} wide bounded onClose={closeEdit}>
      <div className="cms-form"><DataRecordForm kind={kind === 'archive' ? 'forecast' : kind} value={edit.value} issues={validation.report?.issues.filter(issue => issue.row === edit.index + 1)} onChange={value => setEdit({ ...edit, value })} />
        <footer className="cms-actions">{kind !== 'archive' && <button type="button" className="secondary-button" disabled={rows.length <= 1} onClick={() => setRemove(true)}><Minus size={16} />ไม่นำเข้ารายการนี้</button>}
          <button type="button" className="secondary-button" onClick={closeEdit}>ยกเลิก</button>
          <button type="button" className="primary-button" onClick={() => { onChange({ ...payload, [rowsKey(kind)]: rows.map((row, index) => index === edit.index ? edit.value : row) }); setEdit(null); }}>ใช้ค่าที่แก้ไข</button></footer></div>
    </WorkspaceDialog>}
    {discard && <ConfirmAction title="ยังไม่ได้ใช้ค่าที่แก้ไข" message="ค่าที่แก้ไขในหน้าต่างนี้จะไม่ถูกนำไปใช้" confirmLabel="ปิดโดยไม่บันทึก"
      onCancel={() => setDiscard(false)} onConfirm={() => { setDiscard(false); setEdit(null); }} />}
    {remove && edit && <ConfirmAction title="ไม่นำเข้ารายการนี้" message="รายการนี้จะไม่อยู่ในฉบับร่างที่กำลังเตรียม ไฟล์ต้นฉบับบนเครื่องยังคงเดิม" confirmLabel="ยืนยันไม่นำเข้า"
      onCancel={() => setRemove(false)} onConfirm={() => { onChange({ ...payload, [rowsKey(kind)]: rows.filter((_, index) => index !== edit.index) }); setEdit(null); setRemove(false); }} />}
  </section>;
}
