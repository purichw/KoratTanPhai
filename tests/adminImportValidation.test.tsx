import { act, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useImportValidation } from '../src/admin/useImportValidation';
import type { createAdminClient } from '../src/admin/client';
import type { DataKind, Payload, ValidationReport } from '../src/admin/types';

afterEach(() => vi.useRealTimers());
const report: ValidationReport = { revision: 1, valid: true, rowCount: 1, contentHash: 'hash', issues: [] };
it('debounces inspection and ignores a stale valid response after edits without saving any draft', async () => {
  vi.useFakeTimers();
  const replies: ((report: ValidationReport) => void)[] = [];
  const api = vi.fn(() => new Promise<ValidationReport>(resolve => replies.push(resolve)));
  const first: Payload = { observations: [{ value: 0 }] };
  const next: Payload = { observations: [{ value: 'bad' }] };
  const hook = renderHook(({ payload }) => useImportValidation(api as unknown as ReturnType<typeof createAdminClient>, 'station', payload), { initialProps: { payload: first } });
  await act(async () => { vi.advanceTimersByTime(350); });
  expect(api).toHaveBeenCalledTimes(1);
  hook.rerender({ payload: next });
  expect(hook.result.current.report).toBeUndefined(); expect(hook.result.current.pending).toBe(true);
  await act(async () => { replies[0](report); vi.advanceTimersByTime(350); });
  expect(hook.result.current.report).toBeUndefined();
  await act(async () => replies[1]({ ...report, valid: false, issues: [{ row: 1, message: 'invalid' }] }));
  expect(hook.result.current.report?.valid).toBe(false);
  expect(api.mock.calls.every(call => (call as unknown[])[0] === 'inspect')).toBe(true);
});

it('keeps failures distinct from valid/empty results and supports explicit retry', async () => {
  vi.useFakeTimers();
  const api = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(report);
  const payload: Payload = { observations: [{ value: 0 }] };
  const hook = renderHook(() => useImportValidation(api as unknown as ReturnType<typeof createAdminClient>, 'station', payload));
  await act(async () => { vi.advanceTimersByTime(350); });
  expect(hook.result.current.error).toBe('offline'); expect(hook.result.current.report).toBeUndefined();
  act(() => hook.result.current.retry());
  await act(async () => { vi.advanceTimersByTime(350); });
  expect(hook.result.current.report?.valid).toBe(true); expect(hook.result.current.error).toBeUndefined();
});

it('does not reuse validation for the same payload under a different kind', async () => {
  vi.useFakeTimers();
  const api = vi.fn().mockResolvedValue(report);
  const payload: Payload = { observations: [{ value: 0 }] };
  const hook = renderHook(({ kind }: { kind: DataKind }) => useImportValidation(api as unknown as ReturnType<typeof createAdminClient>, kind, payload), { initialProps: { kind: 'station' as DataKind } });
  await act(async () => { vi.advanceTimersByTime(350); });
  expect(hook.result.current.report?.valid).toBe(true);
  hook.rerender({ kind: 'satellite' });
  expect(hook.result.current.pending).toBe(true); expect(hook.result.current.report).toBeUndefined();
  await act(async () => { vi.advanceTimersByTime(350); });
  expect(api).toHaveBeenLastCalledWith('inspect', expect.objectContaining({ body: { kind: 'satellite', payload } }));
});
