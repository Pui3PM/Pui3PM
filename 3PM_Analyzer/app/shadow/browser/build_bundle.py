#!/usr/bin/env python3
from pathlib import Path
import json,posixpath
ROOT=Path(__file__).resolve().parents[1]
OUT=Path(__file__).with_name('shadow_runtime_bundle.js')
mods=[]
for p in sorted(ROOT.rglob('*.js')):
    if p==OUT or '/browser/' in p.as_posix(): continue
    rel=p.relative_to(ROOT).as_posix()
    mods.append((rel,p.read_text()))
entries={
 'contracts': 'contracts/contract_v1.js',
 'records':'contracts/record_validators.js',
 'identity':'contracts/identity.js',
 'clock':'contracts/clock_mapper.js',
 'replay':'adapters/replay/replay_adapter.js',
 'ring':'ring/role_ring.js',
 'scheduler':'scheduler/priority_scheduler.js',
 'events':'event_log/in_memory_event_log.js',
 'writer':'evidence_writer/in_memory_writer.js',
 'projector':'projector/logical25.js',
 'review':'review/view_model.js',
 'archive':'archive/shadow_archive.js',
 'telemetry':'telemetry/event_tape.js',
}
parts=["(function(root){'use strict';\nconst M=Object.create(null),C=Object.create(null);\n"]
for rel,src in mods:
    parts.append(f"M[{json.dumps(rel)}]=function(module,exports,require){{\n{src}\n}};\n")
parts.append(r'''
function norm(path){const out=[];for(const p of path.split('/')){if(!p||p==='.')continue;if(p==='..'){if(!out.length)throw new Error('module path escapes root');out.pop();}else out.push(p);}return out.join('/');}
function resolve(req,parent){if(req[0]!=='.')throw new Error('external module forbidden in browser bundle: '+req);const base=parent.split('/');base.pop();let id=norm(base.join('/')+'/'+req);if(!id.endsWith('.js'))id+='.js';if(!M[id])throw new Error('module not found: '+id+' from '+parent);return id;}
function load(id){id=norm(id);if(C[id])return C[id].exports;if(!M[id])throw new Error('module not found: '+id);const module={exports:{}};C[id]=module;M[id](module,module.exports,(req)=>load(resolve(req,id)));return module.exports;}
const api=Object.create(null);
''')
for name,id in entries.items(): parts.append(f"api[{json.dumps(name)}]=load({json.dumps(id)});\n")
parts.append("Object.freeze(api);root.ThreePMShadow=api;\n})(typeof globalThis!=='undefined'?globalThis:this);\n")
OUT.write_text(''.join(parts))
print(f'wrote {OUT} modules={len(mods)}')
