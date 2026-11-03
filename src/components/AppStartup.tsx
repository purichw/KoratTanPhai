import { useEffect, useState } from 'react';
import { ChartColumnIncreasing, Check, Database, RotateCcw } from 'lucide-react';
import '../app-startup.css';

/** Public presentation only: no session, workspace or data imports. */
export function AppStartup({ path, message }: { path: string; message?: string }) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setSlow(true), 20_000);
    return () => window.clearTimeout(timer);
  }, []);

  return <section className="app-startup" lang="th" aria-label="กำลังเปิดโคราชทันภัย">
    <div className="app-startup-scene" aria-hidden="true" />
    <div className="app-startup-halo" aria-hidden="true"><div className="app-startup-orbit" /></div>
    <div className="app-startup-brand">
      <img src="/brand/korat-tan-phai-emblem.webp" width="192" height="192" alt="" fetchPriority="high" />
      <h1>โคราชทันภัย</h1>
      <p className="app-startup-caption">Korat Tan Phai</p>
      <ol className="app-startup-steps" aria-label="ขั้นตอนเตรียมใช้งาน">
        <li aria-current="step"><span className="app-startup-step-icon"><Database aria-hidden="true" /></span><span>กำลังโหลดข้อมูล</span></li>
        <li><span className="app-startup-step-icon"><ChartColumnIncreasing aria-hidden="true" /></span><span>ประมวลผล</span></li>
        <li><span className="app-startup-step-icon"><Check aria-hidden="true" /></span><span>เตรียมใช้งาน</span></li>
      </ol>
      {/* Requests do not expose a reliable total. Keep progress indeterminate. */}
      <div className="app-startup-progress" role="progressbar" aria-label="กำลังเตรียมข้อมูล">
        <div className="app-startup-track" aria-hidden="true"><span /></div>
        <span className="app-startup-activity" aria-hidden="true"><i /><i /><i /></span>
      </div>
      <p className="app-startup-message" role="status">{message ?? (path.startsWith('/admin') ? 'กำลังเตรียมข้อมูลสำหรับผู้ดูแล...' : 'กำลังเตรียมข้อมูลให้คุณ...')}</p>
      {slow && <div className="app-startup-recovery">
        <p>ใช้เวลานานกว่าปกติ กรุณาตรวจสอบการเชื่อมต่อ</p>
        <button type="button" className="secondary-button" onClick={() => window.location.reload()}><RotateCcw size={16} aria-hidden="true" />โหลดหน้าใหม่</button>
      </div>}
    </div>
  </section>;
}
