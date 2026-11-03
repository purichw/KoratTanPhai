import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ChartColumnIncreasing, Check, Database, RotateCcw, ShieldCheck } from 'lucide-react';
import { animateStartupProgress, syncStartupMotion } from '../startupMotion';
import '../app-startup.css';

const steps = [
  { icon: ShieldCheck, label: 'ตรวจสอบสิทธิ์' },
  { icon: Database, label: 'โหลดระบบ' },
  { icon: ChartColumnIncreasing, label: 'เตรียมหน้า' },
];

/** Public presentation only: no session, workspace or data imports. */
export function AppStartup({ path, message, phase = 'page' }: {
  path: string; message?: string; phase?: 'auth' | 'module' | 'page' | 'complete';
}) {
  const root = useRef<HTMLElement>(null);
  const completed = { auth: 0, module: 1, page: 2, complete: 3 }[phase];
  const progress = Math.round(completed / 3 * 100);
  const complete = phase === 'complete';
  const [slow, setSlow] = useState(false);
  useLayoutEffect(() => {
    syncStartupMotion(root.current);
    animateStartupProgress(root.current?.querySelector('.app-startup-track > span') ?? null, completed / 3);
  }, [completed]);
  useEffect(() => {
    const timer = window.setTimeout(() => setSlow(true), 20_000);
    return () => window.clearTimeout(timer);
  }, []);

  return <section ref={root} className={`app-startup${complete ? ' is-complete' : ''}`} lang="th"
    aria-label="กำลังเปิดโคราชทันภัย" aria-hidden={complete || undefined} inert={complete}>
    <div className="app-startup-scene" aria-hidden="true" />
    <div className="app-startup-halo" aria-hidden="true"><div className="app-startup-orbit" /></div>
    <div className="app-startup-brand">
      <img src="/brand/korat-tan-phai-emblem.webp" width="192" height="192" alt="" fetchPriority="high" />
      <h1>โคราชทันภัย</h1>
      <p className="app-startup-caption">Korat Tan Phai</p>
      <ol className="app-startup-steps" aria-label="ขั้นตอนเตรียมใช้งาน">
        {steps.map(({ icon, label }, index) => {
          const StepIcon = index < completed ? Check : icon;
          return <li key={label} className={index < completed ? 'is-complete' : undefined} aria-current={index === completed ? 'step' : undefined}>
            <span className="app-startup-step-icon"><StepIcon aria-hidden="true" /></span><span>{label}</span>
          </li>;
        })}
      </ol>
      <div className="app-startup-progress" role="progressbar" aria-label="ความพร้อมของหน้า"
        aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} aria-valuetext={`${completed} จาก 3 ขั้นตอน`}>
        <div className="app-startup-track" aria-hidden="true"><span style={{ transform: `scaleX(${completed / 3})` }} /></div>
        <strong className="app-startup-percent" aria-hidden="true">{progress}%</strong>
      </div>
      <p className="app-startup-progress-note">ความพร้อมของหน้า · {completed}/3 ขั้นตอน</p>
      <p className="app-startup-message" role="status">{complete ? 'พร้อมแสดงหน้า' : message ?? (path.startsWith('/admin') ? 'กำลังเตรียมข้อมูลสำหรับผู้ดูแล...' : 'กำลังเตรียมข้อมูลให้คุณ...')}</p>
      {!complete && slow && <div className="app-startup-recovery">
        <p>ใช้เวลานานกว่าปกติ กรุณาตรวจสอบการเชื่อมต่อ</p>
        <button type="button" className="secondary-button" onClick={() => window.location.reload()}><RotateCcw size={16} aria-hidden="true" />โหลดหน้าใหม่</button>
      </div>}
    </div>
  </section>;
}
