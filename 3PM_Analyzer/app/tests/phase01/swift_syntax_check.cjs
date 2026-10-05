'use strict';
// Developer tool (not part of the mandatory suite): SYNTAX-ONLY check of the Swift helpers with tree-sitter-swift.
// It catches unbalanced braces/parentheses and malformed declarations before the Mac launcher tries to compile them.
// It does NOT type-check, resolve AVFoundation/Network APIs or prove the helper builds: only swiftc on macOS does that.
// Setup (outside the package): npm install tree-sitter@0.22.4 tree-sitter-swift@0.7.1 ; then
//   NODE_PATH=<that>/node_modules node app/tests/phase01/swift_syntax_check.cjs [package-root]
// Exit 0 = no ERROR/MISSING nodes, 1 = syntax error found, 2 = BLOCKED (parser not installed).
const fs=require('fs'),path=require('path');
let Parser,Swift;try{Parser=require('tree-sitter');Swift=require('tree-sitter-swift');}catch(e){console.log(JSON.stringify({status:'BLOCKED',reason:'tree-sitter / tree-sitter-swift not resolvable'}));process.exit(2);}
const root=path.resolve(process.argv[2]||path.join(__dirname,'../../..'));
const files=['app/native_capture_bridge/3PMNativeCaptureBridge.swift','app/ble_bridge/3PMBLEBridge.swift'].map(f=>path.join(root,f)).filter(f=>fs.existsSync(f));
const parser=new Parser();parser.setLanguage(Swift);const out=[];let bad=0;
for(const file of files){
  const src=fs.readFileSync(file,'utf8'),tree=parser.parse(src,null,{bufferSize:1<<22}),errors=[];
  const walk=n=>{if(n.type==='ERROR'||n.isMissing)errors.push(`${n.isMissing?'MISSING '+n.type:'ERROR'} ${n.startPosition.row+1}:${n.startPosition.column+1}`);for(const c of n.children)walk(c);};
  walk(tree.rootNode);if(errors.length)bad++;out.push({file:path.relative(root,file),ok:!errors.length,errors:errors.slice(0,20)});
}
console.log(JSON.stringify({status:bad?'FAIL':'PASS',scope:'tree-sitter-swift 0.7.1 syntax only; no type-check, no compile, no macOS runtime',files:out},null,2));
process.exit(bad?1:0);
