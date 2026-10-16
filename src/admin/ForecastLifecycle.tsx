import { useState } from 'react';
import { CalendarPlus, CheckCircle2, History, RefreshCw, ShieldCheck, Clock3 } from 'lucide-react';
import { MetricGrid } from '../components/PageSummary';
import { WorkspaceDialog } from '../components/WorkspaceDialog';
import { WorkspaceEmptyState } from '../components/WorkspaceEmptyState';
import { MonthSelect } from '../components/MonthSelect';
import { AppSelect } from '../components/AppSelect';
import { useAdminRead } from './useAdminRead';
import type { createAdminClient } from './client';
import type { Draft, Payload, ValidationReport } from './types';
import { displayCell, monthLabel } from './dataPresentation';
import './forecast-lifecycle.css';

type Api = ReturnType<typeof createAdminClient>;
type Round = { originMonth: string; horizons: number; cells: number; predicted: number; outOfScope: number; targetStart: string; targetEnd: string };
type Readiness = { revision: { datasetId: string; publishedAt: string } | null; rounds: Round[]; checkedAt: string; currentMonth: string; areaCount: number };
type Publication = { datasetId: string; datasetVersion: string; publishedAt: string; originMonth: string | null; reason: string | null; current: boolean; periods: string[] };
export type ForecastComparison = { revision: number; stale: boolean; newOrigin: boolean; changedCells: number; changes: (Payload & { before: Payload | null })[]; validation: ValidationReport };
const dateLabel = (date: string) => new Date(date).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });

export function ForecastLifecycle({ api, periods, onCreated, refreshVersion }: { api: Api; periods: string[]; onCreated: (draft: Draft) => void; refreshVersion: number }) {
  const read = useAdminRead<Readiness>(api, 'forecast-readiness', { body: {} }, refreshVersion);
  const [dialog, setDialog] = useState<'new' | 'history' | null>(null);
  const [origin, setOrigin] = useState('');
  const [history, setHistory] = useState<Publication[] | null>(null);
  const [selected, setSelected] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const data = read.data;
  const latest = data?.rounds[0];
  const complete = latest && latest.horizons === 6 && latest.cells === data!.areaCount * 6;
  const coversNow = latest && latest.targetStart <= data!.currentMonth && latest.targetEnd >= data!.currentMonth;
  async function run(task: () => Promise<void>) {
    setBusy(true); setError('');
    try { await task(); } catch (failure) { setError(failure instanceof Error ? failure.message : 'ดำเนินการไม่สำเร็จ'); } finally { setBusy(false); }
  }
  return <div className="cms-lifecycle">
    <div className="cms-list-heading"><h3><ShieldCheck size={20} aria-hidden="true" />ความพร้อมข้อมูล</h3>
      <div className="cms-actions"><button className="secondary-button" disabled={!data?.revision || read.refreshing} onClick={() => { setOrigin(''); setError(''); setDialog('new'); }}><CalendarPlus size={17} />สร้างรอบใหม่</button>
        <button className="secondary-button" disabled={!data?.revision || read.refreshing} onClick={() => {
          setDialog('history'); setOrigin(periods[0] ?? ''); setHistory(null); setSelected('');
          void run(async () => { const rows = await api<Publication[]>('forecast-history', { body: {} }); const previous = rows.find(row => !row.current);
            setHistory(rows); setSelected(previous?.datasetId ?? ''); setOrigin(previous?.periods[0] ?? ''); });
        }}><History size={17} />ประวัติและกู้คืน</button></div></div>
    {read.error ? <WorkspaceEmptyState heading="h3" icon={ShieldCheck} title="ยังตรวจความพร้อมไม่ได้" description={read.error}
      action={<button className="secondary-button" onClick={read.reload}><RefreshCw size={16} />ลองใหม่</button>} />
      : latest ? <><MetricGrid className="cms-forecast-metrics cms-readiness-metrics" ariaLabel="ความพร้อมรอบล่าสุด" metrics={[
        { value: monthLabel(latest.originMonth), label: 'เดือนตั้งต้นล่าสุด', icon: <CalendarPlus size={21} /> },
        { value: `${latest.cells.toLocaleString('th-TH')} / ${(data!.areaCount * 6).toLocaleString('th-TH')}`, label: complete ? 'รายการครบ · 6 เดือน' : 'รายการยังไม่ครบ', icon: <CheckCircle2 size={21} /> },
        { value: `${monthLabel(latest.targetStart)} – ${monthLabel(latest.targetEnd)}`, label: coversNow ? 'ช่วงพยากรณ์ครอบคลุมเดือนนี้' : 'ช่วงพยากรณ์ไม่ครอบคลุมเดือนนี้', icon: <Clock3 size={21} /> },
      ]} />
      <p className={coversNow ? 'cms-help' : 'cms-warning'}>ข้อมูลครบไม่เท่ากับข้อมูลปัจจุบัน · มีค่า {latest.predicted.toLocaleString('th-TH')} รายการ · นอกขอบเขต {latest.outOfScope.toLocaleString('th-TH')} รายการ</p>
      <p className="cms-help">เผยแพร่เข้าระบบ {dateLabel(data!.revision!.publishedAt)} · ไม่ใช่วันที่เกิดภัยหรือวันที่ออกผลจากต้นทาง</p>
      <details className="cms-readiness-details"><summary>ความพร้อมแต่ละรอบ ({data!.rounds.length})</summary><div className="cms-table-scroll"><table className="cms-table"><thead><tr><th>เดือนตั้งต้น</th><th>ช่วงพยากรณ์</th><th>มีค่า</th><th>นอกขอบเขต</th><th>ครบถ้วน</th></tr></thead><tbody>{data!.rounds.map(round => <tr key={round.originMonth}>
        <td>{monthLabel(round.originMonth)}</td><td>{monthLabel(round.targetStart)} – {monthLabel(round.targetEnd)}</td><td>{round.predicted}</td><td>{round.outOfScope}</td><td>{round.cells} / {data!.areaCount * 6}</td>
      </tr>)}</tbody></table></div></details></> : !read.loading && <p className="cms-help">ยังไม่มีรอบที่เผยแพร่ให้ตรวจสอบ</p>}
    {dialog && <WorkspaceDialog title={dialog === 'new' ? 'สร้างรอบพยากรณ์ใหม่' : 'กู้คืนจากรุ่นที่เผยแพร่'} closeLabel="ปิดรอบพยากรณ์" bounded onClose={() => { if (!busy) setDialog(null); }}>
      <div className="cms-form">{error && <p className="cms-error" role="alert">{error}</p>}
        {dialog === 'new' ? <><p>เริ่มฉบับร่างโดยยังไม่กรอกค่าพยากรณ์ หรือใช้เมนูนำเข้าข้อมูลเพื่ออัปโหลดทั้งรอบจาก Excel / CSV</p>
          <label className="cms-field cms-month-input">เดือนตั้งต้น<input type="month" aria-label="เดือนตั้งต้นรอบใหม่" min="1900-01" max="2199-12" value={origin} disabled={busy} onChange={event => setOrigin(event.target.value)} /></label>
          {periods.includes(origin) && <p className="cms-warning" role="status">มีรอบเดือนนี้แล้ว เลือก “ตรวจแก้รอบนี้” แทน</p>}
          <footer className="cms-actions"><button className="primary-button" disabled={busy || !/^\d{4}-(0[1-9]|1[0-2])$/.test(origin) || periods.includes(origin)} onClick={() => { void run(async () => {
            const draft = await api<Draft>('forecast-new', { body: { datasetId: data!.revision!.datasetId, originMonth: origin } }); setDialog(null); onCreated(draft);
          }); }}><CalendarPlus size={17} />{busy ? 'กำลังสร้างฉบับร่าง' : 'สร้างฉบับร่าง'}</button></footer></>
          : <><p>เลือกค่าจากรุ่นก่อนเพื่อสร้างฉบับร่างใหม่ เฉพาะรอบที่เลือกจะเปลี่ยนเมื่อคุณตรวจและยืนยันเผยแพร่ รอบอื่นยังคงเดิม</p>
            {history && <><AppSelect label="รุ่นต้นทาง" ariaLabel="รุ่นต้นทางที่จะกู้คืน" value={selected} onChange={value => { if (!busy) {
              setSelected(value); setOrigin(history.find(row => row.datasetId === value)?.periods[0] ?? '');
            } }} searchable options={[
              { value: '', label: 'เลือกรุ่นที่ต้องการกู้คืน', disabled: true }, ...history.filter(row => !row.current).map(row => ({ value: row.datasetId,
                label: `${dateLabel(row.publishedAt)} · ${row.originMonth ? monthLabel(row.originMonth) : 'ชุดข้อมูลต้นทาง'}`, searchText: row.datasetVersion }))]} />
              {selected && <p className="cms-help">{history.find(row => row.datasetId === selected)?.reason || 'ข้อมูลต้นทางก่อนการตรวจแก้ใน CMS'}</p>}
              <MonthSelect ariaLabel="เดือนตั้งต้นที่จะกู้คืน" label="เดือนตั้งต้น" value={origin} onChange={setOrigin} options={(history.find(row => row.datasetId === selected)?.periods ?? []).map(value => ({ value, label: monthLabel(value) }))} />
              {!history.some(row => !row.current) && <p className="cms-help">ยังไม่มีรุ่นก่อนหน้าให้กู้คืน</p>}</>}
            {busy && <p role="status">กำลังโหลดข้อมูล</p>}
            <footer className="cms-actions"><button className="primary-button" disabled={busy || !selected || !origin} onClick={() => { void run(async () => {
              const draft = await api<Draft>('forecast-restore', { body: { datasetId: selected, originMonth: origin } }); setDialog(null); onCreated(draft);
            }); }}><History size={17} />สร้างฉบับร่างเพื่อกู้คืน</button></footer></>}
      </div>
    </WorkspaceDialog>}
  </div>;
}

export function ForecastChangePreview({ comparison }: { comparison: ForecastComparison }) {
  const [limit, setLimit] = useState(30);
  const resultLabel = (row: Payload) => row.status === 'predicted' ? displayCell('riskCode', row.riskCode) : displayCell('status', row.status);
  return <div className="cms-change-preview">
    {comparison.stale && <p className="cms-error" role="alert">มีรุ่นใหม่เผยแพร่หลังเริ่มฉบับนี้แล้ว ยังเผยแพร่ทับไม่ได้ กรุณาสร้างฉบับตรวจแก้จากรุ่นล่าสุด</p>}
    <p><strong>{comparison.newOrigin ? 'เพิ่มรอบใหม่' : 'เปลี่ยนจากค่าที่เผยแพร่'} · {comparison.changedCells.toLocaleString('th-TH')} รายการ</strong></p>
    <details className="cms-readiness-details"><summary>ตรวจค่าที่เปลี่ยน</summary><div className="cms-table-scroll"><table className="cms-table"><thead><tr><th>รหัสตำบล</th><th>เดือนพยากรณ์</th><th>ก่อน</th><th>หลัง</th></tr></thead>
      <tbody>{comparison.changes.slice(0, limit).map((row, index) => <tr key={index}><td>{String(row.subdistrictCode)}</td><td>{monthLabel(row.targetMonth)}</td>
        <td>{row.before ? resultLabel(row.before) : 'ยังไม่มีรอบนี้'}</td><td>{resultLabel(row)}</td></tr>)}</tbody></table></div>
      {limit < comparison.changes.length && <button className="secondary-button" onClick={() => setLimit(value => value + 30)}>แสดงเพิ่ม</button>}</details>
  </div>;
}
