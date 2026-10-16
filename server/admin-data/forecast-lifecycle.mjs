import { checkDraft, CmsError, contentHash, inspectCmsPayload, requireCms } from './contract.mjs';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function handleForecastLifecycle(actor, action, body, operation) {
  requireCms(body && typeof body === 'object' && !Array.isArray(body));
  const keys = Object.keys(body);
  if (action === 'readiness' || action === 'history') {
    requireCms(!keys.length);
    return operation(actor, `forecast:${action}`, {});
  }
  if (action === 'compare') {
    requireCms(keys.length === 2 && uuid.test(body.draftId) && Number.isInteger(body.revision));
    const draft = await operation(actor, 'get', { id: body.draftId });
    requireCms(draft.kind === 'archive');
    if (draft.revision !== body.revision) throw new CmsError(409, 'revision_conflict');
    const catalog = await operation(actor, 'forecast:catalog', {});
    const current = catalog.revision?.datasetId;
    const existing = catalog.periods.includes(draft.payload.originMonth);
    const base = existing ? await operation(actor, 'forecast:read', { datasetId: current, originMonth: draft.payload.originMonth }) : null;
    const before = new Map(base?.predictions.map(row => [`${row.subdistrictCode}:${row.horizonMonths}`, row]) ?? []);
    const changes = draft.payload.predictions.flatMap(row => {
      const previous = before.get(`${row.subdistrictCode}:${row.horizonMonths}`);
      return !previous || previous.status !== row.status || previous.riskCode !== row.riskCode ? [{ ...row, before: previous ?? null }] : [];
    });
    return { revision: draft.revision, currentDatasetId: current, stale: current !== draft.payload.baseDatasetId,
      newOrigin: !existing, changedCells: changes.length, changes, validation: inspectCmsPayload('archive', draft.payload) };
  }
  requireCms(keys.length === 2 && uuid.test(body.datasetId) && /^(19|20|21)\d{2}-(0[1-9]|1[0-2])$/.test(body.originMonth));
  if (action === 'template' || action === 'new') {
    const payload = await operation(actor, 'forecast:template', body);
    if (action === 'template') return payload;
    const draft = checkDraft({ kind: 'archive', title: `พยากรณ์รอบใหม่ ${body.originMonth}`, sourceFilename: 'cms-new-round', payload });
    return operation(actor, 'create', { ...draft, originalHash: contentHash(payload) });
  }
  requireCms(action === 'restore');
  const payload = await operation(actor, 'forecast:read', body);
  const catalog = await operation(actor, 'forecast:catalog', {});
  if (!catalog.revision) throw new CmsError(409, 'revision_conflict');
  // Recovery is a fresh draft against today's base, not a mutable publication pointer.
  payload.baseDatasetId = catalog.revision.datasetId;
  const draft = checkDraft({ kind: 'archive', title: `กู้คืนพยากรณ์ ${body.originMonth}`, sourceFilename: `restored:${body.datasetId}`, payload });
  return operation(actor, 'create', { ...draft, originalHash: contentHash(payload) });
}
