import { checkDraft, contentHash, requireCms } from './contract.mjs';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const shapes = {
  list: [], get: ['workId'], create: ['workId','title','filename'],
  upload: ['workId','objectId','purpose','sha256','bytes','parts','part','data'],
  'read-part': ['workId','objectId','part'], save: ['workId','revision','sourceId','snapshotId','title'],
  convert: ['workId','revision','draft'],
};
export async function handleImportWork(actor, action, body, operation) {
  requireCms(body && typeof body==='object' && !Array.isArray(body) && Object.hasOwn(shapes,action));
  const keys=shapes[action];
  requireCms(keys.length===Object.keys(body).length && keys.every(key=>Object.hasOwn(body,key)));
  for(const key of ['workId','objectId','sourceId','snapshotId','draftId']) if(key in body) requireCms(uuid.test(body[key]));
  if('title' in body) requireCms(typeof body.title==='string' && body.title.trim().length>0 && body.title.length<=160);
  if('filename' in body) requireCms(typeof body.filename==='string' && body.filename.length>0 && body.filename.length<=240 && !/[\x00-\x1f]/.test(body.filename));
  if('revision' in body) requireCms(Number.isInteger(body.revision) && body.revision>=0);
  if('part' in body) requireCms(Number.isInteger(body.part) && body.part>=0 && body.part<160);
  if(action==='upload') {
    requireCms(['source','snapshot'].includes(body.purpose) && /^[a-f0-9]{64}$/.test(body.sha256));
    requireCms(Number.isInteger(body.bytes) && body.bytes>0 && body.bytes<=(body.purpose==='source'?20:40)*1024*1024, 'payload_too_large');
    requireCms(body.parts===Math.ceil(body.bytes/262144) && body.part<body.parts);
    requireCms(typeof body.data==='string' && body.data.length<=349528 && /^[A-Za-z0-9+/]*={0,2}$/.test(body.data));
    const bytes=Buffer.from(body.data,'base64');
    requireCms(bytes.toString('base64')===body.data && bytes.length===Math.min(262144,body.bytes-body.part*262144));
  }
  if(action==='convert') {
    const draft=checkDraft(body.draft);
    return operation(actor,'work:convert',{workId:body.workId,revision:body.revision,draft:{...draft,originalHash:contentHash(draft.payload)}});
  }
  return operation(actor,`work:${action}`,body);
}
