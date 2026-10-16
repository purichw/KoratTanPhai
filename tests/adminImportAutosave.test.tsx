import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useImportAutosave } from '../src/admin/useImportAutosave';
import { uploadImportObject, type ImportSnapshot, type ImportWork } from '../src/admin/importWork';
import { AdminRequestError, type createAdminClient } from '../src/admin/client';

vi.mock('../src/admin/importWork', () => ({ uploadImportObject: vi.fn(async () => {}) }));
afterEach(() => vi.clearAllMocks());
const snapshot: ImportSnapshot = { version: 1, kind: 'station', title: 'Initial', filename: 'source.csv', book: null,
  sheet: null, originalSheet: null, editedSheets: [], mapping: {}, ignored: [], payload: { observations: [] }, basePayload: null,
  preparedPayload: null, fileHash: '', origin: '', rowStart: 1, headerReviewed: false, csvEncoding: 'utf-8' };
const work: ImportWork = { id: 'work', title: 'Initial', filename: 'source.csv', revision: 1, updated_at: '', source_id: 'source', snapshot_id: 'old', draft_id: null };
type Api = ReturnType<typeof createAdminClient>;

describe('import checkpoint serialization', () => {
  it('waits for edits made during an in-flight save before save-and-close resolves', async () => {
    let release!: (value: ImportWork) => void;
    const first = new Promise<ImportWork>(resolve => { release = resolve; });
    const request = vi.fn().mockReturnValueOnce(first).mockResolvedValueOnce({ ...work, revision: 3 });
    const initial = { work, snapshot };
    const { result, rerender } = renderHook(({ current }) => useImportAutosave(request as unknown as Api, current, undefined, initial, true),
      { initialProps: { current: { ...snapshot, title: 'First edit' } } });
    let saved!: Promise<ImportWork | undefined>;
    await act(async () => { saved = result.current.flush(); });
    expect(request).toHaveBeenCalledOnce();
    rerender({ current: { ...snapshot, title: 'Latest edit' } });
    await act(async () => { release({ ...work, revision: 2 }); await saved; });
    expect(request).toHaveBeenCalledTimes(2);
    expect(request.mock.calls[1]).toEqual(['work-save', { body: expect.objectContaining({ revision: 2, title: 'Latest edit' }) }]);
    expect(result.current.dirty).toBe(false);
    expect(result.current.record.current?.revision).toBe(3);
  });

  it('retries the same uploaded checkpoint after an uncertain response', async () => {
    const request = vi.fn().mockRejectedValueOnce(new AdminRequestError('cms_unavailable')).mockResolvedValueOnce({ ...work, revision: 2 });
    const { result } = renderHook(() => useImportAutosave(request as unknown as Api, { ...snapshot, title: 'Changed' }, undefined, { work, snapshot }, true));
    await act(async () => { await expect(result.current.flush()).rejects.toThrow(); });
    expect(result.current.dirty).toBe(true);
    expect(result.current.status).toBe('error');
    await act(async () => { await result.current.flush(); });
    expect(request.mock.calls[1]).toEqual(request.mock.calls[0]);
    expect(uploadImportObject).toHaveBeenCalledOnce();
    expect(result.current.status).toBe('saved');
  });

  it('does not retry a stale revision by silently overwriting another editor', async () => {
    const request = vi.fn().mockRejectedValue(new AdminRequestError('revision_conflict'));
    const { result } = renderHook(() => useImportAutosave(request as unknown as Api, { ...snapshot, title: 'Changed' }, undefined, { work, snapshot }, true));
    await act(async () => { await expect(result.current.flush()).rejects.toThrow(); });
    await act(async () => { await expect(result.current.flush()).rejects.toThrow('อีกหน้าต่าง'); });
    expect(request).toHaveBeenCalledOnce();
    expect(result.current.dirty).toBe(true);
    expect(result.current.record.current?.revision).toBe(1);
  });
});
