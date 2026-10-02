'use strict';
const {sha256Canonical}=require('../contracts/canonical_json');
const Sha=require('../contracts/sha256_pure');
const Bin=require('../contracts/binary_pure');
const {immutablePlainCopy,isId}=require('../contracts/strict_types');
const {validateFrameEnvelope}=require('../contracts/contract_v1');
const {validateEvidenceCandidate,validateShotEvent,validateProjection}=require('../contracts/record_validators');
const FORMAT='3pm-shadow-archive-v1',MAX_FILES=10000,MAX_TOTAL_BYTES=512*1024*1024;
const WIN_RESERVED=/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i;
function sha256Bytes(b){return Sha.hex(Bin.bytes(b));}
function normalizedPath(p){if(typeof p!=='string'||!p.length||p.includes('\\')||p.startsWith('/')||/^[A-Za-z]:/.test(p)||p.includes('\0'))return null;const n=p.normalize('NFC');const parts=n.split('/');if(parts.some(x=>!x||x==='.'||x==='..'||x.endsWith('.')||x.endsWith(' ')||x.includes(':')||WIN_RESERVED.test(x)))return null;return n;}
function safePath(p){return normalizedPath(p)!==null;}
function pathKey(p){const n=normalizedPath(p);return n===null?null:n.toLocaleLowerCase('en-US');}
function strictBase64(s){return Bin.base64Decode(s);}
function validateRecords(records,fileSet){
  if(!records||typeof records!=='object'||Array.isArray(records))throw new TypeError('archive records object required');for(const k of Object.keys(records))if(!['frames','candidates','events','projections'].includes(k))throw new TypeError(`unknown archive record collection: ${k}`);
  const frames=(records.frames||[]).map(validateFrameEnvelope),candidates=(records.candidates||[]).map(x=>validateEvidenceCandidate(x)),events=(records.events||[]).map(validateShotEvent),projections=(records.projections||[]).map(validateProjection);const frameByUid=new Map(frames.map(f=>[f.frameUID,f])),candById=new Map(candidates.map(c=>[c.candidateId,c]));
  for(const f of frames)if(f.payloadRef!==null&&!fileSet.has(f.payloadRef))throw new Error('DANGLING_PAYLOAD_REF');for(const c of candidates){if(!fileSet.has(c.payloadRef))throw new Error('DANGLING_PAYLOAD_REF');const f=frameByUid.get(c.frameUID);if(!f||f.sourceId!==c.sourceId||f.streamGeneration!==c.streamGeneration||f.frameSeq!==c.frameSeq||f.contentDigest!==c.contentDigest)throw new Error('DANGLING_FRAME_REF');}
  for(const p of projections)for(const s of p.slots)if(s.status==='real'){const c=candById.get(s.candidateId);if(!c||c.frameUID!==s.actualFrameUID||c.derivationId!==s.derivationId)throw new Error('DANGLING_CANDIDATE_REF');if(!frameByUid.has(s.actualFrameUID))throw new Error('DANGLING_FRAME_REF');}
  return immutablePlainCopy({frames,candidates,events,projections});
}
function validateManifestBody(body,payloads){
  if(body.format!==FORMAT||!isId(body.archiveId)||!(/^[0-9a-f]{64}$/i.test(body.baselineDigest)))throw new TypeError('invalid archive identity');if(!Array.isArray(body.fileTable)||body.fileTable.length>MAX_FILES)throw new TypeError('invalid file table');const seenExact=new Set(),seenPortable=new Set();let total=0;
  for(const f of body.fileTable){const n=normalizedPath(f.path),pk=pathKey(f.path);if(n===null||n!==f.path||seenExact.has(n)||seenPortable.has(pk))throw new Error('UNSAFE_OR_DUPLICATE_PATH');seenExact.add(n);seenPortable.add(pk);if(!Number.isSafeInteger(f.byteLength)||f.byteLength<0||!/^[0-9a-f]{64}$/i.test(f.sha256)||typeof f.mime!=='string')throw new TypeError('invalid file entry');total+=f.byteLength;if(total>MAX_TOTAL_BYTES)throw new Error('ARCHIVE_SIZE_LIMIT');const bytes=strictBase64(payloads?.[f.path]);if(bytes.length!==f.byteLength||sha256Bytes(bytes)!==f.sha256)throw new Error('BLOB_INTEGRITY_ERROR');}
  const payloadKeys=Object.keys(payloads||{});if(payloadKeys.length!==seenExact.size||payloadKeys.some(k=>!seenExact.has(k)))throw new Error('UNLISTED_PAYLOAD_KEY');const records=validateRecords(body.records,seenExact);return records;
}
function buildArchive({archiveId,baselineDigest,records,files={}}){
  if(!isId(archiveId)||!baselineDigest||!records)throw new TypeError('archive identity/records required');if(!/^[0-9a-f]{64}$/i.test(baselineDigest))throw new TypeError('baselineDigest must be sha256');const fileTable=[],payloads={},portable=new Set();for(const [p,value] of Object.entries(files)){const n=normalizedPath(p),pk=pathKey(p);if(n===null||n!==p||portable.has(pk))throw new TypeError('unsafe/colliding archive path');portable.add(pk);const bytes=Bin.bytes(value);fileTable.push({path:p,mime:'application/octet-stream',byteLength:bytes.length,sha256:sha256Bytes(bytes)});payloads[p]=Bin.base64Encode(bytes);}
  fileTable.sort((a,b)=>a.path.localeCompare(b.path));const tempBody={format:FORMAT,archiveId,baselineDigest,records, fileTable};const validatedRecords=validateRecords(records,new Set(fileTable.map(f=>f.path)));const body=immutablePlainCopy({...tempBody,records:validatedRecords});validateManifestBody(body,payloads);return immutablePlainCopy({manifest:{...body,manifestDigest:sha256Canonical(body)},payloads});
}
function validateArchive(archive){if(archive?.manifest?.format!==FORMAT)throw new TypeError('unsupported archive format');const {manifestDigest,...body}=archive.manifest;if(sha256Canonical(body)!==manifestDigest)throw new Error('MANIFEST_DIGEST_MISMATCH');validateManifestBody(body,archive.payloads);return true;}
function roundTrip(archive){validateArchive(archive);const parsed=JSON.parse(JSON.stringify(archive));validateArchive(parsed);return immutablePlainCopy(parsed);}
class InMemoryArchiveImporter{constructor(){this.byArchive=new Map();}stage(archive,{namespace}){if(typeof namespace!=='string'||!namespace.startsWith('shadow/'))throw new TypeError('shadow namespace required');validateArchive(archive);const k=JSON.stringify([namespace,archive.manifest.archiveId]),digest=archive.manifest.manifestDigest,prev=this.byArchive.get(k);if(prev){if(prev.manifest.manifestDigest!==digest)throw new Error('ARCHIVE_ID_CONFLICT');return {status:'existing',archive:prev};}const copy=roundTrip(archive);this.byArchive.set(k,copy);return {status:'staged',archive:copy};}}
module.exports={FORMAT,buildArchive,validateArchive,roundTrip,InMemoryArchiveImporter,safePath,normalizedPath,validateRecords};
