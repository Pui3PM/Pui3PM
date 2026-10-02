const AR=require('/home/claude/run/app/shadow/archive/shadow_archive');const crypto=require('crypto');
const {sha256Canonical}=require('/home/claude/run/app/shadow/contracts/canonical_json');
const base=crypto.createHash('sha256').update('b').digest('hex');const bytes=Buffer.from('x');
const body=JSON.parse(JSON.stringify({format:'3pm-shadow-archive-v1',archiveId:'x',baselineDigest:base,records:{frames:{PROTO:{payloadRef:'f.bin',label:'real'}}},fileTable:[{path:'f.bin',mime:'a',byteLength:1,sha256:crypto.createHash('sha256').update(bytes).digest('hex')}]}).replace('"PROTO"','"__proto__"'));
const arc={manifest:{...body,manifestDigest:sha256Canonical(body)},payloads:{'f.bin':bytes.toString('base64')}};
const imp=new AR.InMemoryArchiveImporter();const r=imp.stage(arc,{namespace:'n'});const fr=r.archive.manifest.records.frames;
const {manifestDigest,...stored}=r.archive.manifest;
let mutable=false;try{Object.getPrototypeOf(fr).label='TAMPERED';mutable=fr.label==='TAMPERED';}catch(e){}
console.log(JSON.stringify({status:r.status,ownKeysAfterStage:Object.keys(fr),inheritedLabel:fr.label,storedBodyDigestMatchesManifestDigest:sha256Canonical(stored)===manifestDigest,inheritedRecordMutableAfterDeepFreeze:mutable}));
try{AR.validateArchive(r.archive);console.log('restaged archive revalidates: true');}catch(e){console.log('restaged archive revalidate ERR',e.message);}
