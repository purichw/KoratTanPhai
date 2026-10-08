import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, ArrowLeft, ArrowRight, CheckCircle2, Pencil, Plus, Search, Undo2 } from 'lucide-react';
import { AppSelect } from '../components/AppSelect';
import { WorkspaceDialog } from '../components/WorkspaceDialog';
import { WorkspaceEmptyState } from '../components/WorkspaceEmptyState';
import { getNakhonRatchasimaSubdistrictByCode, getNakhonRatchasimaDistrictByCode } from '../domain';
import { rev3Fields } from './normalizedForecastImport';
import { correctImportCell, importCellIssues, inspectRev3Import, sourceRowLabel, type ImportArea, type ImportIssue } from './importReview';
import type { ImportSheet } from './workbook';
import type { Payload } from './types';
import { ConfirmAction } from './ConfirmAction';
import { ImportReviewDownloads } from './ImportReviewDownloads';

export function ImportSheetReview({ sheet, mapping, issues, areas, missing, origin, rev3, metadata, onChange }: {
  sheet: ImportSheet; mapping: Record<string, string>; issues: ImportIssue[]; areas: ImportArea[] | null;
  missing: ImportArea[]; origin: string; rev3: boolean; metadata: Payload | null; onChange: (sheet: ImportSheet) => void;
}) {
  const [mode, setMode] = useState('issues'); const [query, setQuery] = useState(''); const [page, setPage] = useState(0);
  const [edit, setEdit] = useState<{ row: number; values: Payload; touched: string[] } | null>(null);
  const [reason, setReason] = useState('');
  const [discard, setDiscard] = useState(false);
  const closeEdit = () => { if (edit?.touched.length || reason.trim()) setDiscard(true); else setEdit(null); };
  const excluded = new Set(sheet.excludedRows ?? []);
  const errors = issues.filter(issue => issue.severity === 'error');
  const unresolvedIdentity = errors.some(issue => ['year', 'month', 'unknown_id', 'source_cell'].includes(issue.code));
  const editedIssues = useMemo(() => {
    if (!edit) return [];
    const candidate: ImportSheet = { ...sheet, rows: [edit.values], sourceRows: [sheet.sourceRows?.[edit.row] ?? edit.row + 2], excludedRows: [],
      cellProblems: sheet.cellProblems?.filter(problem => problem.row === edit.row && !edit.touched.includes(problem.column)).map(problem => ({ ...problem, row: 0 })) };
    return rev3 ? inspectRev3Import(candidate, mapping, areas, null, '').issues : importCellIssues(candidate);
  }, [edit, sheet, mapping, areas, rev3]);
  const byRow = useMemo(() => {
    const result = new Map<number, ImportIssue[]>();
    issues.forEach(issue => { if (issue.row !== null) result.set(issue.row, [...result.get(issue.row) ?? [], issue]); });
    return result;
  }, [issues]);
  const matching = sheet.rows.map((value, index) => ({ value, index })).filter(({ value, index }) =>
    (mode === 'excluded' ? excluded.has(index) : !excluded.has(index) && (mode === 'all' || byRow.has(index)))
    && JSON.stringify(value).toLocaleLowerCase('th').includes(query.trim().toLocaleLowerCase('th')));
  useEffect(() => setPage(0), [mode, query, sheet]);
  const openRow = (row: number) => { setReason(''); setEdit({ row, values: { ...sheet.rows[row] }, touched: [] }); };
  const areaOptions = useMemo(() => (areas ?? []).map(area => {
    const item = getNakhonRatchasimaSubdistrictByCode(area.subdistrictCode);
    const district = getNakhonRatchasimaDistrictByCode(item?.districtCode);
    return { value: String(area.sourceId), label: `${item?.nameTh ?? area.subdistrictCode} · ${district?.nameTh ?? ''} · ID ${area.sourceId}` };
  }), [areas]);
  function addMissing() {
    const rows = missing.map(area => {
      const item = getNakhonRatchasimaSubdistrictByCode(area.subdistrictCode);
      return Object.fromEntries(rev3Fields.map(field => [mapping[field.key], field.key === 'Year' ? Number(origin.slice(0, 4))
        : field.key === 'Month' ? Number(origin.slice(5)) : field.key === 'ID' ? area.sourceId
        : field.key === 'TAMBON_E' ? item?.nameTh ?? '' : field.key === 'AMPHOE_E' ? getNakhonRatchasimaDistrictByCode(item?.districtCode)?.nameTh ?? ''
        : field.key.startsWith('Pred_Risk_') ? 'ยังไม่กรอก' : '']));
    });
    onChange({ ...sheet, rows: [...sheet.rows, ...rows], sourceRows: [...sheet.rows.map((_, i) => sheet.sourceRows?.[i] ?? i + 2), ...rows.map(() => 0)] });
    setMode('issues');
  }
  return <section className="cms-import-review" aria-label="ตรวจและแก้ไฟล์นำเข้า">
    <div className="cms-validation-bar" role="status"><div><strong>{errors.length ? `ต้องแก้ไข ${errors.length.toLocaleString('th-TH')} จุด` : 'ไม่พบข้อผิดพลาดในไฟล์ที่ตรวจได้'}</strong>
      <span>{sheet.name} · {sheet.rows.length - excluded.size} แถวที่จะนำเข้า · คำเตือน {issues.length - errors.length} จุด</span></div>
      {errors.length ? <AlertCircle size={22} aria-hidden="true" /> : <CheckCircle2 size={22} aria-hidden="true" />}</div>
    {sheet.headerWarnings?.map(warning => <p key={warning} className="cms-warning">{warning}</p>)}
    {issues.length > 0 && <details className="cms-issues" open><summary>ปัญหาและวิธีแก้ไข</summary><ul>{issues.slice(0, 100).map((issue, index) => <li key={index}>
      {issue.row !== null && <button type="button" className="cms-text-button" onClick={() => openRow(issue.row!)}>{sourceRowLabel(sheet, issue.row)}{issue.column ? ` · ${issue.column}` : ''}</button>}
      <span>{issue.message}</span><small>{issue.suggestion}</small>
    </li>)}</ul>{issues.length > 100 && <p>แสดง 100 จาก {issues.length.toLocaleString('th-TH')} จุด กรองแถวหรือดาวน์โหลดรายงานเพื่อดูทั้งหมด</p>}</details>}
    {missing.length > 0 && <><button type="button" className="secondary-button" disabled={unresolvedIdentity} onClick={addMissing}><Plus size={16} />เพิ่มพื้นที่ที่ขาด {missing.length} ตำบล</button>
      {unresolvedIdentity && <p className="cms-help">แก้ปี เดือน รหัสพื้นที่ และเซลล์ต้นทางให้ถูกต้องก่อนเพิ่มพื้นที่ที่ขาด</p>}</>}
    <div className="cms-filter-row"><label className="cms-search"><Search size={18} aria-hidden="true" /><input aria-label="ค้นหาแถวต้นฉบับ" placeholder="ชื่อพื้นที่ รหัส หรือค่าในไฟล์" value={query} onChange={event => setQuery(event.target.value)} /></label>
      <AppSelect ariaLabel="กรองแถวต้นฉบับ" value={mode} onChange={setMode} options={[{ value: 'issues', label: 'แถวที่ต้องตรวจสอบ' }, { value: 'all', label: 'ทุกแถว' }, { value: 'excluded', label: `ไม่นำเข้า (${excluded.size})` }]} /></div>
    {matching.length ? <div className="cms-table-scroll cms-import-rows"><table className="cms-table"><thead><tr><th>แถวต้นฉบับ</th><th>ข้อมูล</th><th>สถานะ</th><th>แก้ไข</th></tr></thead><tbody>
      {matching.slice(page * 15, page * 15 + 15).map(({ value, index }) => <tr key={index} className={byRow.has(index) ? 'has-issue' : ''}>
        <td>{sourceRowLabel(sheet, index)}</td><td>{rev3 ? <><strong>{String(value[mapping.TAMBON_E] ?? '') || `ID ${value[mapping.ID] ?? ''}`}</strong>
          <small>ID {String(value[mapping.ID] ?? '')} · {String(value[mapping.Year] ?? '')}/{String(value[mapping.Month] ?? '')}</small></>
          : sheet.columns.slice(0, 3).map(column => <small key={column}>{column}: {String(value[column] ?? '')}</small>)}</td>
        <td>{excluded.has(index) ? 'ไม่นำเข้า' : byRow.has(index) ? `${byRow.get(index)!.length} จุดที่ต้องตรวจสอบ` : 'พร้อมตรวจรายละเอียด'}</td>
        <td><button type="button" className="icon-button" title={`แก้ไข${sourceRowLabel(sheet, index)}`} aria-label={`แก้ไข${sourceRowLabel(sheet, index)}`} onClick={() => openRow(index)}><Pencil size={16} /></button></td>
      </tr>)}</tbody></table></div> : <WorkspaceEmptyState heading="h3" icon={CheckCircle2} title={mode === 'issues' ? 'ไม่มีแถวที่ต้องตรวจสอบในรายการนี้' : 'ไม่พบแถวตามตัวกรอง'} />}
    {matching.length > 15 && <div className="cms-pagination"><button type="button" className="icon-button" aria-label="แถวต้นฉบับหน้าก่อน" disabled={!page} onClick={() => setPage(value => value - 1)}><ArrowLeft size={18} /></button>
      <span>หน้า {page + 1} / {Math.ceil(matching.length / 15)}</span><button type="button" className="icon-button" aria-label="แถวต้นฉบับหน้าถัดไป" disabled={(page + 1) * 15 >= matching.length} onClick={() => setPage(value => value + 1)}><ArrowRight size={18} /></button></div>}
    <ImportReviewDownloads sheet={sheet} issues={issues} metadata={metadata} mapping={mapping} />
    {edit && <WorkspaceDialog title={`แก้ไข${sourceRowLabel(sheet, edit.row)} · ${sheet.name}`} wide bounded closeLabel="ปิดการแก้ไขแถวต้นฉบับ" onClose={closeEdit}>
      <div className="cms-form"><div className="cms-field-grid">{sheet.columns.map((column, columnIndex) => {
        const field = rev3 ? rev3Fields.find(item => mapping[item.key] === column) : undefined;
        const problems = editedIssues.filter(issue => issue.column === column);
        const helpId = `import-cell-${columnIndex}`;
        const change = (value: string) => setEdit({ ...edit, values: { ...edit.values, [column]: value }, touched: [...new Set([...edit.touched, column])] });
        const label = field?.label ?? column;
        const options = field?.key === 'ID' ? areaOptions : field?.key.startsWith('Pred_Risk_') ? [
          { value: '0', label: '0 · ไม่พบความเสี่ยง' }, { value: '1', label: '1 · เสี่ยงปานกลาง' }, { value: '2', label: '2 · เสี่ยงสูง' }, { value: '', label: 'นอกขอบเขตการศึกษา' },
        ] : null;
        const current = String(edit.values[column] ?? '');
        return <div className={`cms-field${options ? ' is-choice' : ''}${problems.length ? ' has-issue' : ''}`} key={column}>
          <div className="cms-field-label"><span>{label}</span>{problems.length > 0 && <AlertCircle size={16} aria-label="ต้องตรวจสอบ" />}</div>
          {options ? <AppSelect ariaLabel={label} value={current} searchable={field?.key === 'ID'}
            options={[...(!options.some(option => option.value === current) ? [{ value: current, label: `ค่าต้นทาง: ${current || 'ว่าง'}` }] : []), ...options]} onChange={change} />
            : <input aria-label={label} aria-invalid={problems.some(problem => problem.severity === 'error')} aria-describedby={helpId} value={current} onChange={event => change(event.target.value)} />}
          <small id={helpId}>{problems.map(problem => `${problem.message}: ${problem.suggestion}`).join(' · ') || field?.description || column}</small>
        </div>;
      })}</div>
      <label className="cms-field">เหตุผลการแก้ไฟล์<textarea aria-label="เหตุผลการแก้ไฟล์" maxLength={1000} value={reason} onChange={event => setReason(event.target.value)} /></label>
      <footer className="cms-actions"><button type="button" className="secondary-button" disabled={!reason.trim()} onClick={() => {
        const next = new Set(excluded); if (next.has(edit.row)) next.delete(edit.row); else next.add(edit.row);
        onChange({ ...sheet, excludedRows: [...next], corrections: [...sheet.corrections ?? [], { row: edit.row, column: '__included', before: !excluded.has(edit.row), after: excluded.has(edit.row), reason }] }); setEdit(null);
      }}><Undo2 size={16} />{excluded.has(edit.row) ? 'คืนแถวนี้' : 'ไม่นำเข้าแถวนี้'}</button>
        <button type="button" className="secondary-button" onClick={closeEdit}>ยกเลิก</button>
        <button type="button" className="primary-button" disabled={!reason.trim() || !edit.touched.length} onClick={() => {
          let next = sheet; edit.touched.forEach(column => { next = correctImportCell(next, edit.row, column, edit.values[column], reason); }); onChange(next); setEdit(null);
        }}>ใช้ค่าที่แก้ไข</button></footer></div>
    </WorkspaceDialog>}
    {discard && <ConfirmAction title="ยังไม่ได้ใช้ค่าที่แก้ไข" message="ค่าที่แก้ไขในหน้าต่างนี้จะไม่ถูกนำไปใช้" confirmLabel="ปิดโดยไม่บันทึก"
      onCancel={() => setDiscard(false)} onConfirm={() => { setDiscard(false); setEdit(null); }} />}
  </section>;
}
