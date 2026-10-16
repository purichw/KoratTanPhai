import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { cmsTestDatabase } from '../fixtures/admin-data.mjs';
import { contentHash, validateCmsPayload } from '../../server/admin-data/contract.mjs';
import { handleForecastLifecycle } from '../../server/admin-data/forecast-lifecycle.mjs';
import { handleImportWork } from '../../server/admin-data/import-work.mjs';
import { authTestUser } from '../fixtures/supabase.mjs';

const context = { route: async () => {}, unroute: async () => {} };
test('new origins publish complete independent grids, preserve old runs, and restore through new drafts', async () => {
  const db = await cmsTestDatabase(context, { forecasts: true });
  const op = (_actor, action, args) => db.operation(action, args);
  try {
    const base = await db.operation('forecast:catalog', {});
    const prior = await db.operation('forecast:read', { datasetId: base.revision.datasetId, originMonth: '2025-12' });
    const next = await handleForecastLifecycle(authTestUser.id, 'new', { datasetId: base.revision.datasetId, originMonth: '2026-10' }, op);
    assert.equal(next.payload.predictions.length, 1734);
    assert(next.payload.predictions.every(row => row.status === 'insufficient_data' && row.riskCode === null));
    assert.throws(() => validateCmsPayload('archive', next.payload));
    await assert.rejects(db.operation('forecast:publish', { id: next.id, revision: 1, reason: 'Not ready', contentHash: contentHash(next.payload) }), /invalid_forecast_cells/);
    const payload = structuredClone(next.payload);
    payload.predictions.forEach(row => { row.status = row.horizonMonths === 6 ? 'out_of_scope' : 'predicted'; row.riskCode = row.horizonMonths === 6 ? null : 0; });
    validateCmsPayload('archive', payload);
    const draft = await db.operation('edit', { id: next.id, revision: 1, reason: 'Isolated source values', payload });
    const preview = await handleForecastLifecycle(authTestUser.id, 'compare', { draftId: draft.id, revision: draft.revision }, op);
    assert.equal(preview.newOrigin, true); assert.equal(preview.changedCells, 1734); assert.equal(preview.stale, false);
    await db.operation('forecast:publish', { id: draft.id, revision: draft.revision, reason: 'Publish new origin', contentHash: contentHash(payload) });
    const catalog = await db.operation('forecast:catalog', {});
    assert.deepEqual(catalog.periods, ['2026-10', '2025-12']);
    assert.equal(catalog.revision.targetMonthEnd, '2026-10'); assert.equal(catalog.revision.forecastVintageCount, 3468);
    const after = await db.operation('forecast:read', { datasetId: catalog.revision.datasetId, originMonth: '2025-12' });
    assert.deepEqual(after.predictions, prior.predictions);
    const readiness = await handleForecastLifecycle(authTestUser.id, 'readiness', {}, op);
    assert.equal(readiness.rounds[0].cells, 1734); assert.equal(readiness.rounds[0].outOfScope, 289);
    assert.equal(readiness.rounds[0].targetEnd, '2027-04');
    const recovery = await handleForecastLifecycle(authTestUser.id, 'restore', { datasetId: base.revision.datasetId, originMonth: '2025-12' }, op);
    assert.equal(recovery.state, 'draft'); assert.equal(recovery.payload.baseDatasetId, catalog.revision.datasetId);
    await db.operation('forecast:publish', { id: recovery.id, revision: 1, reason: 'Reviewed restore', contentHash: contentHash(recovery.payload) });
    const recovered = await db.operation('forecast:catalog', {});
    assert.deepEqual(recovered.periods, catalog.periods);
    assert.deepEqual((await db.operation('forecast:read', { datasetId: recovered.revision.datasetId, originMonth: '2026-10' })).predictions, payload.predictions);
    await db.db.exec('reset role; set role authenticated');
    for (const horizon of [1, 6]) {
      const publicRead = (await db.db.query('select public.ktp_load_forecast_slice($1,$2,$3,$4) data', [recovered.revision.datasetVersion, '2026-10', '30', horizon])).rows[0].data;
      assert.equal(publicRead.meta.horizonCount, horizon);
      assert.equal(publicRead.meta.forecastVintageCount, 289 * 2 * horizon);
      assert.equal(publicRead.targetMonths.length, 2);
      assert.equal(publicRead.targetMonths[1].horizons[0].targetMonth, '2026-11');
      assert.equal(Object.keys(publicRead.packedRiskByTargetMonth['2026-10']).length, 289);
    }
    await db.db.exec('reset role; set role service_role');
    assert.equal((await handleForecastLifecycle(authTestUser.id, 'history', {}, op)).length, 3);
  } finally { await db.close(); }
});

test('durable import work verifies bytes, resumes exact checkpoints, rejects stale writes and account crossover', async () => {
  const db = await cmsTestDatabase(context);
  const op = (_actor, action, args) => db.operation(action, args);
  const call = (action, body) => handleImportWork(authTestUser.id, action, body, op);
  const workId = randomUUID(); const sourceId = randomUUID(); const snapshotId = randomUUID();
  async function upload(id, purpose, bytes) {
    const parts = Math.ceil(bytes.length / 262144);
    for (let part = 0; part < parts; part++) await call('upload', { workId, objectId: id, purpose, bytes: bytes.length, parts, part,
      sha256: createHash('sha256').update(bytes).digest('hex'), data: bytes.subarray(part * 262144, (part + 1) * 262144).toString('base64') });
  }
  try {
    await call('create', { workId, title: 'Invalid file being repaired', filename: 'source.csv' });
    const original = Buffer.from('Year,Month,ID\n2568,12,999999\n');
    const snapshot = Buffer.from(JSON.stringify({ version: 1, raw: 'x'.repeat(300000), mapping: { Year: 'Year' }, invalidYear: 2568 }));
    await upload(sourceId, 'source', original); await upload(snapshotId, 'snapshot', snapshot);
    const args = { workId, sourceId, snapshotId, revision: 0, title: 'Work in progress' };
    const work = await call('save', args);
    assert.equal(work.revision, 1); assert.equal((await call('save', args)).revision, 1);
    const data = await call('read-part', { workId, objectId: sourceId, part: 0 });
    assert.deepEqual(Buffer.from(data.data, 'base64'), original);
    const reopened = await call('get', { workId }); assert.equal(reopened.snapshot_id, snapshotId);
    const chunks = [];
    for (let part = 0; part < 2; part++) chunks.push(Buffer.from((await call('read-part', { workId, objectId: snapshotId, part })).data, 'base64'));
    assert.deepEqual(Buffer.concat(chunks), snapshot);
    const invalidId = randomUUID();
    await call('upload', { workId, objectId: invalidId, purpose: 'snapshot', bytes: 1, parts: 1, part: 0,
      sha256: '0'.repeat(64), data: Buffer.from('x').toString('base64') });
    await assert.rejects(call('save', { ...args, revision: 1, snapshotId: invalidId }), /cms_incomplete_object/);
    assert.equal((await call('get', { workId })).snapshot_id, snapshotId);
    await assert.rejects(call('save', { ...args, snapshotId: randomUUID() }), /revision_conflict/);
    const draftInput = { kind: 'station', title: 'Incomplete station review', sourceFilename: 'source.csv',
      payload: { schemaVersion: 1, sourceId: '', batchId: '', observations: [{ stationId: 'S1', value: 'wrong' }] } };
    const converted = await call('convert', { workId, revision: 1, draft: draftInput });
    assert.equal(converted.state, 'draft');
    assert.equal((await call('convert', { workId, revision: 1, draft: draftInput })).id, converted.id);
    await assert.rejects(call('convert', { workId, revision: 1, draft: { ...draftInput, payload: { ...draftInput.payload, batchId: 'changed' } } }), /revision_conflict/);
    assert.equal((await call('get', { workId })).draft_id, converted.id);
    const another = randomUUID();
    await db.db.exec('reset role');
    await db.db.query('insert into auth.users values($1)', [another]);
    await db.db.query('insert into public.ktp_cms_operators(user_id) values($1)', [another]);
    await db.db.exec('set role service_role');
    await assert.rejects(db.db.query("select public.ktp_cms_import_work_operation($1,'get',$2::jsonb)", [another, JSON.stringify({ workId })]), /cms_not_found/);
    const denied = await db.db.query("select public.ktp_cms_import_work_operation($1,'list','{}') data", [another]); assert.deepEqual(denied.rows[0].data, []);
    await db.db.exec('reset role');
    await db.db.query('update public.ktp_cms_operators set enabled=false where user_id=$1', [authTestUser.id]);
    await db.db.exec('set role service_role');
    await assert.rejects(call('get', { workId }), /cms_forbidden/);
    await db.db.exec('reset role;set role authenticated');
    await assert.rejects(db.db.query('select * from public.ktp_cms_import_parts'), /permission denied/);
  } finally { await db.close(); }
});
