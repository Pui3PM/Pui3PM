'use strict';
const {sha256Canonical}=require('../contracts/canonical_json');
const Sha=require('../contracts/sha256_pure');
const Bin=require('../contracts/binary_pure');
const {immutablePlainCopy,isId,isShadowNamespace}=require('../contracts/strict_types');
const {validateFrameEnvelope}=require('../contracts/contract_v1');
const {validateEvidenceCandidate,validateShotEvent,validateProjection}=require('../contracts/record_validators');
const {verifyProjectionBinding}=require('../projector/projection_binding');
// records.schemaVersion 2 (S-06/S-07): adds `timelines` (projection timeline binding) and payload-digest binding.
const RECORDS_SCHEMA_VERSION=2;
const FORMAT='3pm-shadow-archive-v1',MAX_FILES=10000,MAX_TOTAL_BYTES=512*1024*1024;
const WIN_RESERVED=/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i;
function sha256Bytes(b){return Sha.hex(Bin.bytes(b));}
function normalizedPath(p){if(typeof p!=='string'||!p.length||p.includes('\\')||p.startsWith('/')||/^[A-Za-z]:/.test(p)||p.includes('\0'))return null;const n=p.normalize('NFC');const parts=n.split('/');if(parts.some(x=>!x||x==='.'||x==='..'||x.endsWith('.')||x.endsWith(' ')||x.includes(':')||WIN_RESERVED.test(x)))return null;return n;}
function safePath(p){return normalizedPath(p)!==null;}
function pathKey(p){const n=normalizedPath(p);return n===null?null:n.toLocaleLowerCase('en-US');}
function strictBase64(s){return Bin.base64Decode(s);}
function validateRecords(records,fileSet){
  if(!records||typeof records!=='object'||Array.isArray(records))throw new TypeError('archive records object required');if(records.schemaVersion!==RECORDS_SCHEMA_VERSION){const e=new Error(`ARCHIVE_SCHEMA_UNSUPPORTED: records.schemaVersion ${JSON.stringify(records.schemaVersion??null)} (required ${RECORDS_SCHEMA_VERSION}; v1 archives lack projection timelines)`);e.code='ARCHIVE_SCHEMA_UNSUPPORTED';throw e;}for(const k of Object.keys(records))if(!['schemaVersion','frames','candidates','events','projections','timelines'].includes(k))throw new TypeError(`unknown archive record collection: ${k}`);
  const frames=(records.frames||[]).map(validateFrameEnvelope),candidates=(records.candidates||[]).map(x=>validateEvidenceCandidate(x)),events=(records.events||[]).map(validateShotEvent),projections=(records.projections||[]).map(validateProjection);const frameByUid=new Map(frames.map(f=>[f.frameUID,f])),candById=new Map(candidates.map(c=>[c.candidateId,c]));
  // S-05: a shadow archive carries shadow events only; legacy archives go through a separate legacy reader (contract §2.7), never relabelled.
  for(const e of events)if(!isShadowNamespace(e.eventNamespace))throw new Error('ARCHIVE_EVENT_NAMESPACE_DENIED');
  for(const f of frames)if(f.payloadRef!==null&&!fileSet.has(f.payloadRef))throw new Error('DANGLING_PAYLOAD_REF');for(const c of candidates){if(!fileSet.has(c.payloadRef))throw new Error('DANGLING_PAYLOAD_REF');const f=frameByUid.get(c.frameUID);if(!f||f.sourceId!==c.sourceId||f.streamGeneration!==c.streamGeneration||f.frameSeq!==c.frameSeq||f.contentDigest!==c.contentDigest)throw new Error('DANGLING_FRAME_REF');}
  for(const p of projections)for(const s of p.slots)if(s.status==='real'){const c=candById.get(s.candidateId);if(!c||c.frameUID!==s.actualFrameUID||c.derivationId!==s.derivationId)throw new Error('DANGLING_CANDIDATE_REF');if(!frameByUid.has(s.actualFrameUID))throw new Error('DANGLING_FRAME_REF');}
  // S-06: every projection is re-derived against its archived timeline and the archived candidates.
  const timelines=Array.isArray(records.timelines)?records.timelines:(records.timelines===undefined?[]:null);if(timelines===null)throw new TypeError('archive timelines must be an array');
  const tlByProjection=new Map();for(const t of timelines){if(!t||typeof t!=='object'||!isId(t.projectionId)||Object.keys(t).some(k=>!['projectionId','timeline','releaseTime'].includes(k))||!Object.prototype.hasOwnProperty.call(t,'releaseTime'))throw new TypeError('invalid archive timeline record');if(tlByProjection.has(t.projectionId))throw new Error('DUPLICATE_PROJECTION_TIMELINE');tlByProjection.set(t.projectionId,t);}
  const projectionIds=new Set();for(const p of projections){if(projectionIds.has(p.projectionId))throw new Error('DUPLICATE_PROJECTION_ID');projectionIds.add(p.projectionId);const t=tlByProjection.get(p.projectionId);if(!t)throw new Error('PROJECTION_TIMELINE_MISSING');verifyProjectionBinding({projection:p,timeline:t.timeline,releaseTime:t.releaseTime,candidateById:id=>candById.get(id)});}
  for(const id of tlByProjection.keys())if(!projectionIds.has(id))throw new Error('ORPHAN_PROJECTION_TIMELINE');
  return immutablePlainCopy({schemaVersion:RECORDS_SCHEMA_VERSION,frames,candidates,events,projections,timelines:[...tlByProjection.values()]});
}
function validateManifestBody(body,payloads){
  if(body.format!==FORMAT||!isId(body.archiveId)||!(/^[0-9a-f]{64}$/i.test(body.baselineDigest)))throw new TypeError('invalid archive identity');if(!Array.isArray(body.fileTable)||body.fileTable.length>MAX_FILES)throw new TypeError('invalid file table');const seenExact=new Set(),seenPortable=new Set();let total=0;
  for(const f of body.fileTable){const n=normalizedPath(f.path),pk=pathKey(f.path);if(n===null||n!==f.path||seenExact.has(n)||seenPortable.has(pk))throw new Error('UNSAFE_OR_DUPLICATE_PATH');seenExact.add(n);seenPortable.add(pk);if(!Number.isSafeInteger(f.byteLength)||f.byteLength<0||!/^[0-9a-f]{64}$/i.test(f.sha256)||typeof f.mime!=='string')throw new TypeError('invalid file entry');total+=f.byteLength;if(total>MAX_TOTAL_BYTES)throw new Error('ARCHIVE_SIZE_LIMIT');const bytes=strictBase64(payloads?.[f.path]);if(bytes.length!==f.byteLength||sha256Bytes(bytes)!==f.sha256)throw new Error('BLOB_INTEGRITY_ERROR');}
  const payloadKeys=Object.keys(payloads||{});if(payloadKeys.length!==seenExact.size||payloadKeys.some(k=>!seenExact.has(k)))throw new Error('UNLISTED_PAYLOAD_KEY');const records=validateRecords(body.records,seenExact);return records;
}
function buildArchive({archiveId,baselineDigest,records,files={}}){
  if(!isId(archiveId)||!baselineDigest||!records)throw new TypeError('archive identity/records required');if(!/^[0-9a-f]{64}$/i.test(baselineDigest))throw new TypeError('baselineDigest must be sha256');const fileTable=[],payloads={},portable=new Set();for(const [p,value] of Object.entries(files)){const n=normalizedPath(p),pk=pathKey(p);if(n===null||n!==p||portable.has(pk))throw new TypeError('unsafe/colliding archive path');portable.add(pk);const bytes=Bin.bytes(value);fileTable.push({path:p,mime:'application/octet-stream',byteLength:bytes.length,sha256:sha256Bytes(bytes)});payloads[p]=Bin.base64Encode(bytes);}
  fileTable.sort((a,b)=>a.path.localeCompare(b.path));const stamped={...records,schemaVersion:RECORDS_SCHEMA_VERSION};const tempBody={format:FORMAT,archiveId,baselineDigest,records:stamped,fileTable};const validatedRecords=validateRecords(stamped,new Set(fileTable.map(f=>f.path)));const body=immutablePlainCopy({...tempBody,records:validatedRecords});validateManifestBody(body,payloads);return immutablePlainCopy({manifest:{...body,manifestDigest:sha256Canonical(body)},payloads});
}
function validateArchive(archive){if(archive?.manifest?.format!==FORMAT)throw new TypeError('unsupported archive format');const {manifestDigest,...body}=archive.manifest;if(sha256Canonical(body)!==manifestDigest)throw new Error('MANIFEST_DIGEST_MISMATCH');validateManifestBody(body,archive.payloads);return true;}
function roundTrip(archive){validateArchive(archive);const parsed=JSON.parse(JSON.stringify(archive));validateArchive(parsed);return immutablePlainCopy(parsed);}
class InMemoryArchiveImporter{constructor(){this.byArchive=new Map();}stage(archive,{namespace}){if(!isShadowNamespace(namespace))throw new TypeError('shadow namespace required');validateArchive(archive);const k=JSON.stringify([namespace,archive.manifest.archiveId]),digest=archive.manifest.manifestDigest,prev=this.byArchive.get(k);if(prev){if(prev.manifest.manifestDigest!==digest)throw new Error('ARCHIVE_ID_CONFLICT');return {status:'existing',archive:prev};}const copy=roundTrip(archive);this.byArchive.set(k,copy);return {status:'staged',archive:copy};}}
module.exports={FORMAT,RECORDS_SCHEMA_VERSION,buildArchive,validateArchive,roundTrip,InMemoryArchiveImporter,safePath,normalizedPath,validateRecords};
