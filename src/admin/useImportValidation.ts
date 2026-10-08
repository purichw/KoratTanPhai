import { useEffect, useState } from 'react';
import type { createAdminClient } from './client';
import type { DataKind, Payload, ValidationReport } from './types';

export function useImportValidation(api: ReturnType<typeof createAdminClient>, kind: DataKind, payload: Payload | null) {
  const [result, setResult] = useState<{ payload: Payload; kind: DataKind; report?: ValidationReport; error?: string } | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!payload) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void api<ValidationReport>('inspect', { body: { kind, payload }, signal: controller.signal }).then(report => {
        if (!controller.signal.aborted) setResult({ payload, kind, report });
      }).catch(error => {
        if (!controller.signal.aborted) setResult({ payload, kind, error: error instanceof Error ? error.message : 'ตรวจข้อมูลไม่สำเร็จ' });
      });
    }, 350);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [api, kind, payload, retry]);
  const current = result?.payload === payload && result?.kind === kind ? result : null;
  return { report: current?.report, error: current?.error, pending: Boolean(payload && !current), retry: () => { setResult(null); setRetry(value => value + 1); } };
}
