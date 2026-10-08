import { useState } from 'react';
import { Download } from 'lucide-react';
import type { ImportSheet } from './workbook';
import type { Payload } from './types';
import { downloadImportBlob, downloadImportCsv, reviewedImportRows, reviewedIssueRows, reviewReportColumns, type ImportIssue } from './importReview';

export function ImportReviewDownloads({ sheet, issues, metadata, mapping, ready = true }: {
  sheet: ImportSheet; issues: ImportIssue[]; metadata: Payload | null; mapping?: Record<string, string>; ready?: boolean;
}) {
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const csvEditable = !metadata || !('baseDatasetId' in metadata || 'runId' in metadata);
  async function downloadExcel() {
    setExporting(true); setError('');
    try {
      const { createReviewedImportWorkbook } = await import('./workbook');
      const bytes = await createReviewedImportWorkbook(sheet, issues, metadata, mapping);
      downloadImportBlob(new Blob([new Uint8Array(bytes)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'Korat_import_reviewed.xlsx');
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'เตรียม Excel ไม่สำเร็จ กรุณาลองดาวน์โหลดอีกครั้ง'); }
    finally { setExporting(false); }
  }
  return <div className="cms-review-downloads">
    <div className="cms-actions" aria-busy={exporting}>
      <button type="button" className="secondary-button" disabled={exporting || !ready} onClick={() => { void downloadExcel(); }}><Download size={16} />{exporting ? 'กำลังเตรียม Excel' : 'Excel พร้อมผลตรวจ'}</button>
      {csvEditable && <button type="button" className="secondary-button" disabled={exporting || !ready} onClick={() => downloadImportCsv(sheet.columns, reviewedImportRows(sheet).map(row => row.values), 'Korat_import_corrected.csv')}><Download size={16} />CSV สำหรับแก้ไข</button>}
      <button type="button" className="secondary-button" disabled={exporting || !ready || !issues.length && !sheet.headerWarnings?.length} onClick={() => downloadImportCsv(reviewReportColumns, reviewedIssueRows(sheet, issues), 'Korat_import_issues.csv')}><Download size={16} />รายงานปัญหา CSV</button>
    </div>
    <p className="cms-help">{!ready ? 'ไฟล์พร้อมผลตรวจจะดาวน์โหลดได้เมื่อระบบตรวจข้อมูลชุดปัจจุบันเสร็จแล้ว'
      : csvEditable ? 'CSV ไม่เก็บสี หมายเหตุ หรือรายละเอียดชุดข้อมูล · อัปโหลดกลับเพื่อตรวจใหม่'
        : 'ข้อมูลชุดนี้มีรายละเอียดประกอบที่ต้องคงไว้ ใช้ Excel สำหรับแก้และนำกลับเข้า · ระบบจะตรวจใหม่ก่อนเผยแพร่'}</p>
    {error && <p className="cms-error" role="alert">{error}</p>}
  </div>;
}
