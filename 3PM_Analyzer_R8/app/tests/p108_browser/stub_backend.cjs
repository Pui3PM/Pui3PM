'use strict';
// R8 P1-08 browser gate backend TEST DOUBLE. The real backend is the frozen Mach-O runtime (cannot run on Linux).
// Serves the shipped app/static files unchanged and answers the frozen app's /api/* reads with one deterministic
// seeded session. It is NOT a backend acceptance test; unhandled requests are recorded so a gate can fail on them.
const http=require('http'),fs=require('fs'),path=require('path');
const MIME={'.js':'text/javascript','.mjs':'text/javascript','.html':'text/html','.css':'text/css','.json':'application/json','.png':'image/png','.wasm':'application/wasm','.task':'application/octet-stream','.jpg':'image/jpeg'};
function state(){
  const t='2026-10-03T00:00:00Z';
  return {athletes:[{id:1,name:'Field Test Archer',handedness:'right',created_at:t}],equipment:[],
    sessions:[{id:1,athlete_id:1,name:'P1-08 browser gate session',created_at:t,updated_at:t,notes:'',media:[]}],
    shots:[{id:11,session_id:1,shot_no:1,created_at:t,metrics:{},is_reference:false,score:null},{id:12,session_id:1,shot_no:2,created_at:t,metrics:{},is_reference:false,score:null}],
    shot_frames:[]};
}
function start(staticRoot,{port=0}={}){
  const unhandled=[],served=[];
  const server=http.createServer((req,res)=>{
    const u=new URL(req.url,'http://x');
    if(u.pathname==='/api/storage'){res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({root:'/stub-backend (test double)',available:true,free_bytes:1e10,total_bytes:2e10}));return;}
    if(u.pathname==='/favicon.ico'){res.writeHead(204);res.end();return;}
    if(u.pathname==='/api/state'){res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(state()));return;}
    if(u.pathname.startsWith('/static/')){
      const file=path.join(staticRoot,decodeURIComponent(u.pathname.slice('/static/'.length)));
      if(file.startsWith(staticRoot)&&fs.existsSync(file)&&fs.statSync(file).isFile()){served.push(u.pathname);res.writeHead(200,{'Content-Type':MIME[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});fs.createReadStream(file).pipe(res);return;}
    }
    if(u.pathname==='/'||u.pathname==='/index.html'){res.writeHead(302,{Location:'/static/index.html'});res.end();return;}
    unhandled.push(req.method+' '+u.pathname);res.writeHead(404,{'Content-Type':'application/json'});res.end(JSON.stringify({ok:false,stub:'unhandled',path:u.pathname}));
  });
  return new Promise(r=>server.listen(port,'127.0.0.1',()=>r({server,port:server.address().port,unhandled,served,close:()=>new Promise(c=>server.close(c))})));
}
module.exports={start,state};
if(require.main===module)start(path.resolve(process.argv[2]),{port:Number(process.argv[3])||8790}).then(s=>console.log('stub on',s.port));
