// Acceptance geometri tampilan v1. Hanya data sumber asli; bukan benchmark timing.
// Wajib backend/replay terintegrasi yang eksplisit (tidak menjalankan server sendiri):
// SIAP_IZIN_URL=http://127.0.0.1:8767/prototype/ \
// SIAP_IZIN_TEST_OUTPUT=/absolute/private/display-acceptance \
// node tests/display-browser.mjs
// Opsional: SIAP_IZIN_RENDERER=auto|svg|canvas, SIAP_IZIN_MODE=replay|live,
// SIAP_IZIN_SOURCE_DIR=/private/frozen-source, CHROME_BIN=/path/to/chrome.
// Mode replay wajib banner + timestamp/status replay asli. Live adalah opt-in eksplisit;
// inventaris live tetap harus cocok dengan baseline privat 16 rencana/5.994 ID ini.
// Hook publik: configuration(), planRecords, layerMapper, featureLayers, map,
// requestViewport(), resource(), ProvinceData.aggregate(), serta kontrol DOM lama.
// Nama counter: interface DisplayData.configuration yang dibaca saat harness dibuat.
// Jangan mengubah assert menjadi conditional pass bila hook integrasi bergeser.
import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const base = process.env.SIAP_IZIN_URL;
const output = process.env.SIAP_IZIN_TEST_OUTPUT || process.env.SIAP_IZIN_OUTPUT;
const mode = process.env.SIAP_IZIN_MODE || 'replay';
const renderer = process.env.SIAP_IZIN_RENDERER || 'auto';
const sourceDir = process.env.SIAP_IZIN_SOURCE_DIR;
const scratch = process.env.TMPDIR || path.join(os.homedir(), '.hermes/cache/scratch');
const chrome = process.env.CHROME_BIN || (process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : 'chromium');
const within = (root, target) => {const r=path.relative(root,target);return r===''||(!r.startsWith('..'+path.sep)&&r!=='..'&&!path.isAbsolute(r));};
assert(base, 'SIAP_IZIN_URL wajib eksplisit; tidak memakai backend lama/default');
assert(output && path.isAbsolute(output), 'SIAP_IZIN_TEST_OUTPUT wajib direktori privat absolut');
assert(sourceDir && path.isAbsolute(sourceDir), 'SIAP_IZIN_SOURCE_DIR wajib direktori sumber privat absolut');
assert(['replay','live'].includes(mode) && ['auto','svg','canvas'].includes(renderer), 'Mode/renderer tidak valid');
const target = new URL(base);
assert(['http:','https:'].includes(target.protocol) && !target.username && !target.password, 'URL backend tidak valid');
assert(!within(repo,path.resolve(output)), 'Screenshot/hasil privat tidak boleh masuk repository');
assert(!within(repo,fs.realpathSync(sourceDir)), 'Sumber mentah harus tetap di luar repository');
if (mode === 'replay') assert(['127.0.0.1','localhost','[::1]'].includes(target.hostname) && target.port !== '8765', 'Replay wajib loopback non-8765; live harus opt-in SIAP_IZIN_MODE=live');
fs.mkdirSync(output,{recursive:true,mode:0o700});
assert(!within(fs.realpathSync(repo),fs.realpathSync(output)), 'Symlink output mengarah ke repository');
fs.mkdirSync(scratch,{recursive:true,mode:0o700});

// Baca sumber privat untuk oracle ID, atribut, bounds dan verteks. Tidak menulis
// ulang GeoJSON atau koordinatnya ke repo/output. Nama Tirawuta legacy dipertahankan.
function sourceReference() {
 const reference = {};
 for (const name of fs.readdirSync(sourceDir).filter(n=>n.endsWith('.json')).sort()) {
  const raw=JSON.parse(fs.readFileSync(path.join(sourceDir,name),'utf8'));
  const data=raw.data?.payload;
  assert(data?.type==='FeatureCollection', 'Bukan snapshot sumber asli: '+name);
  const id=data.meta.plan.id;
  assert.match(id,/^74\d{8}:\d{3}$/);assert(!reference[id], 'Duplikat plan sumber '+id);
  const features=[];let originalVertices=0;
  for (const f of data.features) {
   const bounds=[Infinity,Infinity,-Infinity,-Infinity];
   const walk=x=>{if(typeof x[0]==='number'){originalVertices++;bounds[0]=Math.min(bounds[0],x[0]);bounds[1]=Math.min(bounds[1],x[1]);bounds[2]=Math.max(bounds[2],x[0]);bounds[3]=Math.max(bounds[3],x[1]);}else x.forEach(walk);};
   walk(f.geometry.coordinates);
   assert(Number.isSafeInteger(f.id)&&f.id>=0&&f.id===f.properties.object_id);
   features.push({id:f.id,properties:f.properties,bounds});
  }
  const bounds=features.length?[Math.min(...features.map(f=>f.bounds[0])),Math.min(...features.map(f=>f.bounds[1])),Math.max(...features.map(f=>f.bounds[2])),Math.max(...features.map(f=>f.bounds[3]))]:null;
  reference[id]={meta:data.meta,features,bounds,originalVertices};
  assert.equal(features.length,data.meta.counts.returned);
  assert.equal(new Set(features.map(f=>f.id)).size,features.length);
 }
 assert.equal(Object.keys(reference).length,16,'Baseline harus tepat 16 rencana');
 assert.equal(Object.values(reference).reduce((s,r)=>s+r.features.length,0),5994,'Baseline harus tepat 5.994 fitur');
 return reference;
}
const reference=sourceReference();
const expectedKeys=Object.entries(reference).flatMap(([id,r])=>r.features.map(f=>`${id}:${f.id}`)).sort();
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const results=[],exceptions=[],consoleEvents=[],network=[];
let ws,browser,profile,nextId=0;
const pending=new Map();
const save=(name,value)=>fs.writeFileSync(path.join(output,name),JSON.stringify(value,null,2)+'\n',{mode:0o600});
function record(test,passed,observed) {results.push({test,passed,...(observed===undefined?{}:{observed})});assert(passed,test);}
async function send(method,params={}) {
 const id=++nextId;
 return new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>{pending.delete(id);reject(new Error('CDP timeout '+method));},180000);
  pending.set(id,{resolve:r=>{clearTimeout(timer);resolve(r);},reject:e=>{clearTimeout(timer);reject(e);}});
  ws.send(JSON.stringify({id,method,params}));
 });
}
async function evaluate(expression) {
 const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});
 if(r.exceptionDetails)throw new Error(JSON.stringify(r.exceptionDetails));
 return r.result.value;
}
async function check(test,expression) {const value=await evaluate(expression);record(test,value===true,value);}
async function waitFor(expression,timeout=90000) {
 const end=Date.now()+timeout;
 while(Date.now()<end){if(await evaluate(expression))return;await delay(150);}
 throw new Error('Timeout '+expression);
}
async function idle({ignoreHeld=false,timeout=90000}={}) {
 let signature=null,since=0;const end=Date.now()+timeout;
 while(Date.now()<end){
  const value=await evaluate(`(()=>{const a=__displayAcceptance,c=configuration();return {busy:a.active>0||${ignoreHeld?'false':'a.held.some(h=>!h.released)'}||[...planRecords.values()].some(r=>r.status==='loading')||c.overlay.viewport.state==='loading',signature:JSON.stringify([a.requests.length,c.overlay,[...featureLayers.keys()],map&&[map.getCenter().lat,map.getCenter().lng,map.getZoom()]])};})()`);
  if(value.busy){signature=null;since=0;}else if(value.signature!==signature){signature=value.signature;since=Date.now();}else if(Date.now()-since>=900){await evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');return;}
  await delay(150);
 }
 throw new Error('Peta/request tidak stabil setelah idle');
}
async function screenshot(name) {const s=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(path.join(output,name),Buffer.from(s.data,'base64'),{mode:0o600});}
async function keyPress(key) {
 const codes={Enter:13,Escape:27,Tab:9};
 await send('Input.dispatchKeyEvent',{type:'keyDown',key,code:key,windowsVirtualKeyCode:codes[key],...(key==='Enter'?{text:'\r',unmodifiedText:'\r'}:{})});
 await send('Input.dispatchKeyEvent',{type:'keyUp',key,code:key,windowsVirtualKeyCode:codes[key]});
}
async function touch(selector) {
 const point=await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw new Error('Target touch tidak ada');e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};})()`);
 await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...point,id:1,radiusX:1,radiusY:1,force:1}]});
 await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await delay(100);
}
async function select(ids) {
 await evaluate(`document.querySelectorAll('[name=region]').forEach(e=>e.checked=${JSON.stringify(ids)}.includes(e.value));document.querySelector('#regionOptions').dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('#criteriaForm').requestSubmit();void 0`);
}
async function rule(value) {await evaluate(`__displayAcceptance.rule=${JSON.stringify(value)};void 0`);}
async function releaseHeld() {await evaluate('__displayAcceptance.held.filter(h=>!h.released).forEach(h=>{h.released=true;h.release();});void 0');}
async function view() {return evaluate('({lat:map.getCenter().lat,lng:map.getCenter().lng,zoom:map.getZoom()})');}
async function unchangedView(label,before) {
 const after=await view();record(label,after.zoom===before.zoom&&Math.abs(after.lat-before.lat)<1e-8&&Math.abs(after.lng-before.lng)<1e-8,{before,after});
}

// Test-only fetch interception. Valid responses ALWAYS come from the real server.
// Holds clone/decode the real response first, then deliberately ignore AbortSignal
// while withholding delivery. Invalid responses and 409 are the only synthetic data.
function installAcceptance(reference,mode) {
 const canonical=x=>Array.isArray(x)?x.map(canonical):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,canonical(x[k])])):x;
 const equal=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
 const intersect=(a,b)=>a&&b&&a[0]<=b[2]&&a[2]>=b[0]&&a[1]<=b[3]&&a[3]>=b[1];
 const bbox=()=>{const b=map.getBounds();return [b.getWest(),b.getSouth(),b.getEast(),b.getNorth()];};
 const level=()=>map.getZoom()<=9?'overview':map.getZoom()<=13?'regional':'detail';
 const A=window.__displayAcceptance={reference,mode,requests:[],active:0,peak:0,held:[],rule:null,violations:[],snapshots:{},moves:[],nativeFetch:window.fetch.bind(window)};
 A.bbox=bbox;A.level=level;A.intersect=intersect;
 const need=(ok,message)=>{if(!ok)throw new Error(message);};
 function metadata(m,ref) {
  need(m&&equal(m.sourceCounts,ref.meta.counts)&&equal(m.counts,ref.meta.counts),'counts sumber berubah');
  for(const key of ['plan','kbli','activity','filterZoneCodes','coverage','geometryPurpose','limitations'])need(equal(m[key],ref.meta[key]),'provenance/context '+key+' berubah');
  need(m.kbli.mappingReviewed===false&&m.activity.mappingReviewed===false,'mapping bukan unknown');
  need(m.source&&['live','cached_snapshot'].includes(m.source.status)&&Number.isFinite(Date.parse(m.source.retrievedAt)),'status/timestamp sumber');
  for(const key of ['activitiesUrl','catalogUrl','geometryQueryUrl','metadataUrl','nativeWkid','outputWkid'])need(equal(m.source[key],ref.meta.source[key]),'source provenance '+key);
  if(mode==='replay')need(m.benchmarkReplay===true&&m.source.status==='cached_snapshot'&&m.source.cacheReason==='benchmark_replay'&&m.source.retrievedAt===ref.meta.source.retrievedAt,'replay tidak jujur');
 }
 function validate(data,r) {
  const u=new URL(r.url,location.href),q=u.searchParams,ref=reference[q.get('plan')];
  need(ref,'plan di luar sumber');need(q.get('kbli')==='01273','KBLI salah');
  need(r.signal&&r.regions.includes(ref.meta.plan.regionId),'request tanpa AbortSignal/di luar criteria terapan');
  need([...q.keys()].length===new Set(q.keys()).size,'parameter duplikat');
  need(!/%3a/i.test(u.search)&&/^74\d{8}:\d{3}$/.test(q.get('plan')),'ID plan literal');
  if(r.endpoint==='detail') {
   need([...q.keys()].sort().join(',')==='kbli,objectId,plan,snapshot','query detail');
   need(/^(0|[1-9]\d*)$/.test(q.get('objectId'))&&Number.isSafeInteger(Number(q.get('objectId'))),'OID integer');
   need(/^[a-f0-9]{64}$/.test(q.get('snapshot')),'snapshot query');
   const f=ref.features.find(f=>f.id===Number(q.get('objectId')));
   need(f,'OID tidak ada dalam sumber');need(data&&data.schemaVersion===1&&data.planId===q.get('plan')&&data.objectId===f.id&&data.snapshotId===q.get('snapshot')&&data.snapshotId===A.snapshots[data.planId],'identitas detail tidak cocok');
   need(Object.keys(data).sort().join(',')==='meta,objectId,planId,properties,schemaVersion,snapshotId,sourceBounds','detail bukan object atribut murni');
   need(equal(data.sourceBounds,f.bounds),'bounds detail bukan sumber');
   for(const [k,v]of Object.entries(f.properties))need(equal(data.properties?.[k],v),'atribut detail berubah '+k);
   need(!Object.hasOwn(data,'geometry')&&!Object.hasOwn(data.properties,'geometry')&&!Object.hasOwn(data.properties,'coordinates'),'detail membawa geometri');
   metadata(data.meta,ref);
   r.detail={planId:data.planId,objectId:data.objectId,snapshotId:data.snapshotId,regulation:data.properties.regulation,source:data.meta.source};
   return;
  }
  need([...q.keys()].sort().join(',')===(q.has('bbox')?'bbox,kbli,level,plan':'kbli,level,plan'),'query display');
  const lod=q.get('level'),tol={overview:100,regional:10,detail:1}[lod];need(tol,'LOD salah');
  const b=q.has('bbox')?q.get('bbox').split(',').map(Number):null;
  if(b){need(/^-?\d+(?:\.\d+)?(?:,-?\d+(?:\.\d+)?){3}$/.test(q.get('bbox'))&&b.every(Number.isFinite)&&b[0]<b[2]&&b[1]<b[3],'bbox literal');need(r.mapBounds&&b.every((x,i)=>Math.abs(x-r.mapBounds[i])<=1e-6)&&lod===r.mapLevel,'bbox/LOD bukan viewport aktual saat request');need(intersect(ref.bounds,b),'request plan yang tidak berpotongan viewport');}
  else need(lod==='overview','inventory harus overview tanpa bbox');
  const m=data?.meta,d=m?.display;
  need(data?.type==='FeatureCollection'&&Array.isArray(data.features),'bukan GeoJSON collection');metadata(m,ref);
  need(/^[a-f0-9]{64}$/.test(m.snapshotId),'snapshot bukan SHA256 lowercase');
  if(A.snapshots[q.get('plan')])need(A.snapshots[q.get('plan')]===m.snapshotId,'snapshot berubah antar level/bbox');else A.snapshots[q.get('plan')]=m.snapshotId;
  need(equal(m.sourceBounds,ref.bounds),'sourceBounds bukan seluruh sumber');
  need(d&&d.algorithmVersion==='coverage-lod-v1'&&d.purpose==='display-only-not-analysis-or-export'&&d.level===lod&&d.toleranceMeters===tol&&equal(d.bbox,b),'metadata display');
  need(d.sourceFeatureCount===ref.features.length&&d.returnedFeatureCount===data.features.length&&d.originalVertices===ref.originalVertices,'count sumber/display/verteks bercampur');
  need(d.validation?.featureIdsPreserved===true&&d.validation.geometryValid===true&&[true,false,null].includes(d.validation.coverageValid),'validasi geometri');
  need(d.method==='coverage_simplify'?d.fallbackReason===null&&d.validation.coverageValid===true:d.method==='original_preserved'&&['coverage_invalid','quality_validation_failed'].includes(d.fallbackReason),'metode/fallback display');
  const contained=(a,b)=>a[0]<=b[0]&&a[1]<=b[1]&&a[2]>=b[2]&&a[3]>=b[3];
  const required=ref.features.filter(f=>!b||contained(b,f.bounds)).map(f=>f.id),ids=data.features.map(f=>f.id).sort((a,b)=>a-b);
  need(required.every(id=>ids.includes(id))&&new Set(ids).size===ids.length&&ids.every(id=>ref.features.some(f=>f.id===id&&(!b||intersect(f.bounds,b)))),'ID wajib hilang/duplikat atau envelope di luar bbox');
  // Exact original-polygon intersections are checked independently in Node/Python
  // after the run. Envelope overlap alone cannot prove polygon intersection.
  const allowed=['object_id','plan_id','zone_name','zone_code','zone_group','subzone_name','filter_value','activity_id','activity_name','permission','evidence_status','source_bounds'].sort();
  let vertices=0;
  for(const f of data.features){
   const original=ref.features.find(s=>s.id===f.id),p=f.properties;
   need(f.type==='Feature'&&['Polygon','MultiPolygon'].includes(f.geometry?.type),'bukan polygon sumber');
   need(equal(Object.keys(p).sort(),allowed),'display membawa atribut berat/tak dikenal (termasuk regulation)');
   for(const k of allowed)need(equal(p[k],k==='source_bounds'?original.bounds:k==='subzone_name'?(original.properties[k]??null):original.properties[k]),'projection display '+k);
   need(p.permission==='unknown'&&p.evidence_status==='unreviewed_mapping'&&f.id===p.object_id,'status/identitas fitur');
   const walk=x=>{need(Array.isArray(x),'coordinates bukan array');if(typeof x[0]==='number'){vertices++;need(x.length===2&&x.every(Number.isFinite)&&x[0]>=-180&&x[0]<=180&&x[1]>=-90&&x[1]<=90,'coordinates invalid');}else x.forEach(walk);};
   walk(f.geometry.coordinates);
   for(const ring of (f.geometry.type==='Polygon'?f.geometry.coordinates:f.geometry.coordinates.flat()))need(ring.length>=4&&equal(ring[0],ring.at(-1)),'ring tidak tertutup');
  }
  need(d.returnedVertices===vertices&&vertices<=d.originalVertices,'returnedVertices salah');
  r.display={level:lod,bbox:b,ids,sourceFeatureCount:d.sourceFeatureCount,returnedFeatureCount:d.returnedFeatureCount,originalVertices:d.originalVertices,returnedVertices:d.returnedVertices,snapshotId:m.snapshotId,method:d.method,fallbackReason:d.fallbackReason,source:m.source};
 }
 window.fetch=async function(input,options={}) {
  const u=new URL(typeof input==='string'?input:input.url||String(input),location.href);
  if(u.pathname==='/api/zones'){A.violations.push('Dilarang fetch /api/zones');throw new Error('Harness forbids full source endpoint');}
  const endpoint=u.pathname==='/api/display'?'display':u.pathname==='/api/feature-detail'?'detail':null;
  if(!endpoint)return A.nativeFetch(input,options);
  const r={index:A.requests.length,url:u.href,endpoint,started:performance.now(),signal:options.signal instanceof AbortSignal,aborted:options.signal?.aborted===true,regions:[...applied.regions],mapBounds:map?bbox():null,mapLevel:map?level():null};A.requests.push(r);
  options.signal?.addEventListener('abort',()=>{r.aborted=true;r.abortAt=performance.now();},{once:true});
  const rule=A.rule,match=rule&&rule.endpoint===endpoint&&(rule.match!=='viewport'||u.searchParams.has('bbox'))&&(rule.match!=='inventory'||!u.searchParams.has('bbox'))&&(rule.remaining===undefined||rule.remaining>0);
  if(match&&rule.remaining!==undefined)rule.remaining--;
  if(match&&['invalid','conflict'].includes(rule.kind)){
   r.injected=rule.kind;r.status=rule.kind==='conflict'?409:200;r.finished=performance.now();
   return new Response(rule.kind==='conflict'?JSON.stringify({error:'snapshot_changed'}):'{}',{status:r.status,headers:{'Content-Type':'application/json'}});
  }
  A.active++;A.peak=Math.max(A.peak,A.active);
  let response;
  try{
   // Held real responses deliberately receive NO AbortSignal.
   response=await A.nativeFetch(input,match&&rule.kind==='hold'?{...options,signal:undefined}:options);
   r.status=response.status;
   if(response.ok){const data=await response.clone().json();try{validate(data,r);}catch(e){A.violations.push({index:r.index,message:String(e)});}}
   else r.httpError=await response.clone().text();
  }catch(e){r.error=String(e);throw e;}finally{A.active--;r.networkFinished=performance.now();}
  if(match&&rule.kind==='hold')await new Promise(release=>A.held.push({index:r.index,released:false,release}));
  r.finished=performance.now();return response;
 };
 A.fingerprint=()=>JSON.stringify({regions:configuration().regions,viewport:configuration().overlay.viewport,layers:[...featureLayers.keys()].sort(),view:[map.getCenter().lat,map.getCenter().lng,map.getZoom()]});
 A.viewportConsistent=()=>{
  const c=configuration().overlay,b=bbox(),lod=level();
  need(c.loadedFeatureCount===[...planRecords.values()].reduce((n,r)=>n+(r.data?.features.length||0),0),'loadedFeatureCount bukan inventory');
  need(c.drawnFeatureCount===featureLayers.size&&c.viewport.drawnFeatureCount===featureLayers.size,'counter drawn bukan layer aktual');
  need(c.viewport.level===lod,'counter level bukan zoom aktual');
  const expected=Object.entries(reference).filter(([id,r])=>planRecords.get(id)?.status==='ready'&&intersect(r.bounds,b)).map(([id])=>id).sort();
  need(equal([...layerMapper.keys()].sort(),expected),'plan viewport salah/tidak dibersihkan');
  const drawn=[];
  for(const id of expected){
   const response=[...A.requests].reverse().find(r=>r.endpoint==='display'&&!r.injected&&!r.error&&r.display?.level===lod&&r.display.bbox?.every((x,i)=>Math.abs(x-b[i])<=1e-6)&&new URL(r.url).searchParams.get('plan')===id);
   need(response,'tidak ada payload untuk bbox/level viewport stabil '+id);
   const children=layerMapper.get(id).getLayers();need(equal(children.map(l=>l.feature.id).sort((a,b)=>a-b),response.display.ids),'layer bukan payload viewport terbaru');
   drawn.push(...children.map(l=>id+':'+l.feature.id));
  }
  need(equal([...featureLayers.keys()].sort(),drawn.sort()),'indeks layer stale/bercampur inventory');
  const renderers=new Set([...featureLayers.values()].map(l=>l._renderer instanceof L.Canvas?'canvas':l._renderer instanceof L.SVG?'svg':'unknown'));
  need(!renderers.has('unknown')&&renderers.size<=1,'renderer aktual tidak dikenal/campuran');
  if(renderers.size)need(renderers.has(c.renderer),'counter renderer tidak cocok renderer Leaflet');
  return true;
 };
}

async function verifyViewport(label) {await idle();await check(label,'__displayAcceptance.viewportConsistent()');}
async function openRow(selector='.zone-row',{native=true,ignoreHeld=false}={}) {
 await evaluate(`document.querySelector(${JSON.stringify(selector)}).focus();void 0`);
 if(native)await keyPress('Enter');else await touch(selector);
 await waitFor("document.querySelector('#zoneDialog').open&&__displayAcceptance.requests.some(r=>r.endpoint==='detail'&&r.finished&&!r.injected)");
 await idle({ignoreHeld});
 const key=await evaluate("document.activeElement?.dataset.zoneId||selectedFeatureKey");
 return key;
}
async function requireDetail(key,label) {
 await waitFor(`document.querySelector('#zoneDialog').open&&document.querySelector('#zoneDetailContent').textContent.includes(${JSON.stringify(key)})&&document.querySelector('#zoneDetailContent').textContent.includes('unknown')`);
 const request=await evaluate(`__displayAcceptance.requests.filter(r=>r.endpoint==='detail'&&r.detail&&r.detail.planId+':'+r.detail.objectId===${JSON.stringify(key)}).at(-1)`);
 record(label,!!request&&/^[a-f0-9]{64}$/.test(new URL(request.url).searchParams.get('snapshot'))&&request.signal===true);
 const regulation=reference[key.slice(0,key.lastIndexOf(':'))].features.find(f=>String(f.id)===key.slice(key.lastIndexOf(':')+1)).properties.regulation;
 if(regulation)await check(label+' — regulation hanya sesudah detail asli',`document.querySelector('#zoneDetailContent').textContent.includes(${JSON.stringify(regulation)})`);
}
async function closeFocus(key) {
 await keyPress('Escape');
 const closed=`!document.querySelector('#zoneDialog').open&&document.activeElement.dataset.zoneId===${JSON.stringify(key)}`;
 await waitFor(closed,3000); // Native dialog close event/focus restoration is queued.
 await check('Escape menutup detail dan memulihkan fokus row '+key,closed);
}
async function pointerInterior() {
 await evaluate("document.querySelector('#map').scrollIntoView({block:'center'});void 0");await delay(200);
 return evaluate(`(()=>{
  const rect=document.querySelector('#map').getBoundingClientRect();
  const inFill=(layer,p)=>{let inside=false;for(const ring of layer._parts||[])for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)inside=!inside;}return inside;};
  const visible=(x,y)=>x>Math.max(rect.left,0)+3&&x<Math.min(rect.right,innerWidth)-3&&y>Math.max(rect.top,0)+3&&y<Math.min(rect.bottom,innerHeight)-3;
  for(const [key,layer]of [...featureLayers].reverse()){
   const el=layer.getElement?.();
   if(el instanceof SVGPathElement){
    const b=el.getBBox(),matrix=el.getScreenCTM();if(!matrix)continue;
    for(let ix=1;ix<32;ix++)for(let iy=1;iy<32;iy++){
     const p=new DOMPoint(b.x+b.width*ix/32,b.y+b.height*iy/32);if(!el.isPointInFill(p))continue;
     const s=p.matrixTransform(matrix);if(visible(s.x,s.y)&&document.elementFromPoint(s.x,s.y)===el)return {x:s.x,y:s.y,key,renderer:'svg'};
    }
   }else if(layer._renderer instanceof L.Canvas){
    if(typeof layer._containsPoint!=='function')throw new Error('Canvas polygon tidak punya _containsPoint');
    const b=layer._pxBounds;if(!b)continue;
    for(let ix=1;ix<48;ix++)for(let iy=1;iy<48;iy++){
     const p=L.point(b.min.x+(b.max.x-b.min.x)*ix/48,b.min.y+(b.max.y-b.min.y)*iy/48);
     if(!layer._containsPoint(p))continue;
     const c=map.layerPointToContainerPoint(p),x=Math.round(rect.left+c.x),y=Math.round(rect.top+c.y);
     if(!visible(x,y)||document.elementFromPoint(x,y)!==layer._renderer._container)continue;
     // Resolve exactly the integer CSS client point dispatched below, rather than
     // a fractional grid point that Chromium may quantize onto another polygon.
     const actual=map.mouseEventToLayerPoint({clientX:x,clientY:y});
     for(let order=layer._renderer._drawLast;order;order=order.prev){const hit=order.layer;if(hit.options.interactive&&hit._containsPoint(actual)){if(!inFill(hit,actual))break;const hitKey=[...featureLayers].find(([,l])=>l===hit)?.[0];if(!hitKey)throw new Error('Canvas hit bukan source layer aktif');return {x,y,key:hitKey,renderer:'canvas'};}}
    }
   }else throw new Error('Layer aktif bukan SVG/Canvas polygon');
  }
  throw new Error('Tidak menemukan interior polygon sumber yang benar-benar dirender');
 })()`);
}
async function failClosedDetail(kind) {
 await rule({kind,endpoint:'detail',remaining:1});
 const before=await evaluate('__displayAcceptance.requests.length');
 await evaluate("document.querySelector('.zone-row').focus();void 0");await keyPress('Enter');
 await waitFor(`__displayAcceptance.requests.slice(${before}).some(r=>r.injected===${JSON.stringify(kind)}&&r.endpoint==='detail')`);await idle();
 await check(kind==='conflict'?'409 snapshot_changed meminta muat ulang, bukan atribut lain':'Detail malformed gagal tertutup, bukan atribut inventory/lama',`(()=>{const t=document.querySelector('#zoneDetailContent').textContent,s=document.querySelector('#zoneStatus').textContent;const regulations=Object.values(__displayAcceptance.reference).flatMap(r=>r.features.map(f=>f.properties.regulation)).filter(Boolean);return !regulations.some(v=>t.includes(v))&&${kind==='conflict'?"/muat ulang|reload/i.test(t+' '+s)":"/gagal|tidak valid|kesalahan|tidak tersedia/i.test(t+' '+s)"};})()`);
 await evaluate("if(document.querySelector('#zoneDialog').open)document.querySelector('#zoneDialog').close();void 0");await rule(null);
}

try {
 profile=fs.mkdtempSync(path.join(scratch,'siap-izin-display-'));
 browser=spawn(chrome,['--headless=new','--no-first-run','--no-default-browser-check','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{stdio:['ignore','ignore','pipe']});
 let chromeError='';browser.stderr.on('data',d=>{chromeError=(chromeError+d.toString()).slice(-12000);});
 let spawnError;browser.on('error',e=>{spawnError=e;});
 const portFile=path.join(profile,'DevToolsActivePort');
 for(let i=0;i<200&&!fs.existsSync(portFile);i++){if(spawnError)throw spawnError;await delay(100);}
 assert(fs.existsSync(portFile),'Chrome CDP terisolasi tidak tersedia: '+chromeError);
 const port=fs.readFileSync(portFile,'utf8').split('\n')[0];
 const targets=await(await fetch(`http://127.0.0.1:${port}/json/list`)).json();
 ws=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);
 await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});
 ws.addEventListener('message',event=>{
  const m=JSON.parse(event.data);
  if(m.id){const p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.reject(new Error(JSON.stringify(m.error))):p.resolve(m.result);}return;}
  if(m.method==='Runtime.exceptionThrown')exceptions.push(m.params.exceptionDetails);
  if(m.method==='Runtime.consoleAPICalled')consoleEvents.push({type:m.params.type,args:m.params.args.map(a=>a.value??a.description),timestamp:m.params.timestamp});
  if(m.method==='Network.requestWillBeSent'&&/\/api\/(zones|display|feature-detail)(?:\?|$)/.test(m.params.request.url))network.push({url:m.params.request.url,method:m.params.request.method});
 });
 await send('Page.enable');await send('Runtime.enable');await send('Network.enable');
 await send('Network.setCacheDisabled',{cacheDisabled:true});
 await send('Emulation.setDeviceMetricsOverride',{width:1512,height:1100,deviceScaleFactor:1,mobile:false});
 await send('Page.addScriptToEvaluateOnNewDocument',{source:`(${installAcceptance.toString()})(${JSON.stringify(reference)},${JSON.stringify(mode)});`});
 await send('Page.navigate',{url:base});
 await waitFor("typeof catalog!=='undefined'&&catalogState==='ready'");
 await check('Katalog 17 wilayah, 18 rencana, 16 mapped, 2 unmapped',"catalog.regions.length===17&&catalog.plans.length===18&&plans.filter(p=>p.activity).length===16&&plans.filter(p=>!p.activity).length===2");
 await check('Opt-in: belum ada request geometri/detail atau layer',"map===null&&planRecords.size===0&&__displayAcceptance.requests.length===0&&!document.querySelector('.leaflet-container')");
 await check('Enam wilayah unknown dan relasi belum direview dilabel jujur',"document.querySelector('#catalogGaps').textContent.includes('6 wilayah')&&document.querySelector('#catalogGaps').textContent.includes('2 rencana')&&configuration().kbli.mappingReviewed===false");
 if(mode==='replay')await check('Banner replay eksplisit terlihat',"(()=>{const e=document.querySelector('#benchmarkReplayBanner');return !!e&&e.getBoundingClientRect().height>0&&/replay|snapshot/i.test(e.textContent)})()");
 await evaluate(`(()=>{
  const original=resource;resource=async function(...args){const value=await original(...args);if(window.L&&!L.__displayAcceptanceHook){L.__displayAcceptanceHook=true;const make=L.map;L.map=function(id,options){const m=make.call(this,id,{...options,${renderer==='auto'?'':`preferCanvas:${renderer==='canvas'},`}});m.on('moveend',()=>__displayAcceptance.moves.push({at:performance.now(),lat:m.getCenter().lat,lng:m.getCenter().lng,zoom:m.getZoom()}));return m;};}return value;};
  __displayAcceptance.rule={kind:'hold',endpoint:'display',match:'inventory',remaining:1};
  document.querySelector('#loadMap').click();
 })()`);
 await waitFor("map!==null&&__displayAcceptance.held.length===1");
 // Pindah sebelum seluruh overview selesai: respons akhir tidak boleh auto-fit.
 await evaluate('map.setView([-4.05,122.1],8,{animate:false});void 0');const earlyView=await view();
 await rule(null);await releaseHeld();
 await waitFor('configuration().overlay.loadedPlanCount===16',480000);await idle({timeout:480000});
 await unchangedView('Respons inventory terlambat tidak mengembalikan viewport pengguna',earlyView);
 await check('16 overview lengkap menjaga 5.994 ID sumber, bukan count SVG',`(()=>{const a=__displayAcceptance,c=configuration().overlay;const entries=[...planRecords];const keys=entries.flatMap(([id,r])=>(r.data?.features||[]).map(f=>id+':'+f.id)).sort();return entries.filter(([,r])=>r.status==='ready').length===16&&JSON.stringify(keys)===${JSON.stringify(JSON.stringify(expectedKeys))}&&c.loadedPlanCount===16&&c.loadedFeatureCount===5994&&c.availableFeatureCount===5994&&c.highlightedFeatureCount===5994&&c.failedPlanCount===0&&c.unmappedPlanCount===2&&c.notListedRegionCount===6;})()`);
 await check('Tepat 16 request inventory overview tanpa bbox, seluruhnya tervalidasi',"(()=>{const a=__displayAcceptance,r=a.requests.filter(r=>r.endpoint==='display'&&!new URL(r.url).searchParams.has('bbox'));return r.length===16&&new Set(r.map(r=>new URL(r.url).searchParams.get('plan'))).size===16&&r.every(r=>r.display?.level==='overview'&&r.status===200&&r.signal)&&a.violations.length===0&&a.peak>0&&a.peak<=3})()");
 await check('Belum mengambil regulation/detail saat hanya menampilkan peta',"__displayAcceptance.requests.every(r=>r.endpoint!=='detail')&&[...planRecords.values()].filter(r=>r.data).every(r=>r.data.features.every(f=>!Object.hasOwn(f.properties,'regulation')))");
 await check('Cakupan parsial, unknown bukan izin dan bukan seluruh daratan',"zonePhase==='partial'&&document.querySelector('#coverageStatus').textContent.includes('bukan seluruh daratan')&&document.querySelector('#zoneStatus').textContent.includes('unknown')");
 await evaluate('zoomAll();void 0');await verifyViewport('Zoom-semua memakai seluruh indeks source bounds');
 await check('Zoom-semua meliputi 16 bounds, bukan hanya layer terakhir',"Object.values(__displayAcceptance.reference).every(r=>{const b=map.getBounds();return r.bounds===null||(b.getWest()<=r.bounds[0]&&b.getSouth()<=r.bounds[1]&&b.getEast()>=r.bounds[2]&&b.getNorth()>=r.bounds[3])})");
 await evaluate("document.querySelector('#map').scrollIntoView({block:'center'});void 0");await screenshot('display-overview.png');
 const focal=reference['7411000000:001'].features[0].bounds;
 const lat=(focal[1]+focal[3])/2,lng=(focal[0]+focal[2])/2;
 for(const zoom of [9,10,13,14]){
  await evaluate(`map.setView([${lat},${lng}],${zoom},{animate:false});void 0`);const before=await view();
  await verifyViewport('Zoom '+zoom+' — level, bbox aktual, ID crop dan layer cocok payload');
  await unchangedView('Viewport '+zoom+' tidak auto-jump setelah respons',before);
 }
 const burstStart=await evaluate('__displayAcceptance.requests.length');
 await evaluate('for(let i=0;i<8;i++)map.panBy([8,2],{animate:false});void 0');const burstView=await view();
 await verifyViewport('Burst pan memakai hanya crop viewport terakhir setelah debounce');
 await check('Delapan moveend sinkron menghasilkan tepat satu batch plan yang berpotongan',`(()=>{const a=__displayAcceptance,b=a.bbox(),requests=a.requests.slice(${burstStart}).filter(r=>r.endpoint==='display');const expected=[...planRecords].filter(([,r])=>r.status==='ready'&&a.intersect(r.data.meta.sourceBounds,b)).map(([id])=>id).sort();return requests.length===expected.length&&JSON.stringify(requests.map(r=>new URL(r.url).searchParams.get('plan')).sort())===JSON.stringify(expected)&&requests.every(r=>r.display?.bbox?.every((v,i)=>Math.abs(v-b[i])<=1e-6));})()`);
 await unchangedView('Batch pan terakhir tidak fit-bounds ulang sesudah idle',burstView);
 await check('Count sumber tetap 5.994 ketika hanya subset viewport dirender',"configuration().overlay.loadedFeatureCount===5994&&featureLayers.size>0&&featureLayers.size<5994&&configuration().overlay.drawnFeatureCount===featureLayers.size");
 if(renderer!=='auto')await check('Renderer yang diminta benar-benar digunakan',`configuration().overlay.renderer===${JSON.stringify(renderer)}&&[...featureLayers.values()].every(l=>l._renderer instanceof L.${renderer==='canvas'?'Canvas':'SVG'})`);
 const point=await pointerInterior();
 await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:point.x,y:point.y});
 await send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,x:point.x,y:point.y});
 await send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,x:point.x,y:point.y});
 await requireDetail(point.key,'Pointer interior polygon sumber '+point.renderer+' WAJIB membuka detail');
 await screenshot('display-pointer-detail.png');await keyPress('Escape');
 // Crop kosong berbeda dari inventory kosong/tidak dimuat. Tidak ada full-source fallback.
 const farStart=await evaluate('__displayAcceptance.requests.length');
 await evaluate('map.setView([0,110],14,{animate:false});void 0');await verifyViewport('Pan keluar bounds membersihkan layer, mempertahankan inventory');
 await check('Area di luar semua rencana: nol request geometry, 5.994 ID masih tersedia',`featureLayers.size===0&&layerMapper.size===0&&configuration().overlay.loadedFeatureCount===5994&&__displayAcceptance.requests.slice(${farStart}).every(r=>r.endpoint!=='display')`);
 await evaluate('zoomAll();void 0');await verifyViewport('Zoom-semua pulih dari viewport kosong melalui indeks sumber');
 await evaluate(`map.setView([${lat},${lng}],14,{animate:false});void 0`);await verifyViewport('Kembali ke crop detail sebelum pengujian keyboard');
 const ordered=await evaluate("ProvinceData.aggregate(catalog,applied.regions,planRecords,true).features.map(({feature,data})=>ProvinceData.featureKey(data.meta.plan.id,feature.id))");
 record('Oracle daftar memuat tepat seluruh ID frozen-source',JSON.stringify([...ordered].sort())===JSON.stringify(expectedKeys));
 await check('Pagination native tetap 200 per halaman dan 30 halaman',"document.querySelectorAll('.zone-row').length===200&&document.querySelector('#zonePrevious').disabled&&!document.querySelector('#zoneNext').disabled&&document.querySelector('#zonePageStatus').getAttribute('role')==='status'");
 await evaluate("window.__displayPrevious=document.querySelector('#zonePrevious');window.__displayNext=document.querySelector('#zoneNext');void 0");
 const visited=[];const offscreenPlans=new Set();
 for(let page=0;page<30;page++){
  if(page){await evaluate("document.querySelector('#zoneNext').focus();void 0");await keyPress('Enter');}
  if(page===1){await keyPress('Tab');await check('Tab native dari Next mencapai row pertama halaman lanjut',"document.activeElement===document.querySelector('.zone-row')");}
  const keys=await evaluate("[...document.querySelectorAll('.zone-row')].map(e=>e.dataset.zoneId)");visited.push(...keys);
  const status=`Halaman ${page+1} dari 30 · fitur ${page*200+1}–${Math.min((page+1)*200,5994)} dari 5994`;
  await check('Keyboard halaman '+(page+1)+' mempertahankan inventory dan kontrol',`document.querySelector('#zonePageStatus').textContent===${JSON.stringify(status)}&&document.querySelector('#zonePrevious')===window.__displayPrevious&&document.querySelector('#zoneNext')===window.__displayNext&&configuration().overlay.loadedFeatureCount===5994`);
  record('ID halaman '+(page+1)+' tepat dan tidak dipotong renderer',JSON.stringify(keys)===JSON.stringify(ordered.slice(page*200,(page+1)*200)));
  // Wajib membuka row offscreen halaman pertama dan rencana lain di halaman lanjut.
  const offscreen=await evaluate("[...document.querySelectorAll('.zone-row')].map(e=>e.dataset.zoneId).find(k=>{const i=k.lastIndexOf(':'),r=__displayAcceptance.reference[k.slice(0,i)],f=r.features.find(f=>String(f.id)===k.slice(i+1));return !featureLayers.has(k)&&!__displayAcceptance.intersect(f.bounds,__displayAcceptance.bbox())})||null");
  const offscreenPlan=offscreen?.slice(0,offscreen.lastIndexOf(':'));
  if(offscreen&&offscreenPlans.size<2&&!offscreenPlans.has(offscreenPlan)&&(page===0||page>0&&offscreenPlans.size===1)){
   const selector=`.zone-row[data-zone-id=${JSON.stringify(offscreen)}]`;
   await openRow(selector);await requireDetail(offscreen,'Keyboard row offscreen halaman '+(page+1)+' mengambil OID/plan/snapshot sendiri');await closeFocus(offscreen);offscreenPlans.add(offscreenPlan);
  }
 }
 record('Semua 5.994 ID terjangkau tepat sekali melalui 30 halaman keyboard',visited.length===5994&&new Set(visited).size===5994&&JSON.stringify(visited)===JSON.stringify(ordered));
 record('Keyboard offscreen dibuktikan pada halaman lanjut dan dua plan berbeda',offscreenPlans.size===2);
 await check('Akhir daftar: Next disabled, fokus Previous',"document.querySelector('#zoneNext').disabled&&document.activeElement===document.querySelector('#zonePrevious')");
 await evaluate("document.querySelector('#zonePrevious').focus();void 0");await keyPress('Enter');
 await check('Keyboard Previous kembali ke halaman 29',"document.querySelector('#zonePageStatus').textContent.startsWith('Halaman 29 dari 30')");
 // Ekspor adalah snapshot preview, bukan serialisasi live saat menekan download.
 const folder=fs.mkdtempSync(path.join(output,'download-'));
 await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:folder,eventsEnabled:true});
 await evaluate("document.querySelector('#exportTop').click();void 0");
 const preview=await evaluate("document.querySelector('#jsonPreview').textContent");const exported=JSON.parse(preview);
 const checkExport=(value)=>{
  assert.equal(value.schemaVersion,3);assert.equal(value.containsGeometry,false);
  const walk=x=>{if(!x||typeof x!=='object')return;for(const [k,v]of Object.entries(x)){const key=k.toLowerCase().replaceAll('_','');assert(!['geometry','coordinates','coords','sourcebounds','features','feature','area','aream2','targetaream2','road','roadpreference','candidatearea'].includes(key),'Ekspor bocor '+k);assert(v!=='Feature'&&v!=='FeatureCollection','Objek fitur dalam ekspor');walk(v);}};walk(value);
 };
 checkExport(exported);record('Preview schema3 projection tanpa geometri/bounds/coords/road/area',true);
 await evaluate("document.querySelectorAll('[name=region]').forEach(e=>e.checked=e.value==='7411000000');document.querySelector('#regionOptions').dispatchEvent(new Event('input',{bubbles:true}));void 0");
 record('Draft belum diterapkan tidak mengubah konfigurasi/preview',await evaluate(`JSON.stringify(configuration())===${JSON.stringify(JSON.stringify(exported))}&&document.querySelector('#jsonPreview').textContent===${JSON.stringify(preview)}`));
 await select(['local:sultra:muna']);await idle();
 await evaluate("document.querySelector('#downloadConfig').click();void 0");
 const downloaded=path.join(folder,'siap-izin-konfigurasi-eksplorasi.json');
 let actual;for(let i=0;i<100;i++){if(fs.existsSync(downloaded)&&!fs.readdirSync(folder).some(f=>f.endsWith('.crdownload'))){try{actual=JSON.parse(fs.readFileSync(downloaded,'utf8'));break;}catch{}}await delay(100);}
 assert(actual,'Download nyata tidak selesai');checkExport(actual);
 record('Download dibaca ulang, identik preview lama meskipun kriteria sudah berubah',JSON.stringify(actual)===JSON.stringify(exported)&&actual.overlay.loadedFeatureCount===5994&&actual.regions.length===17);
 await evaluate("document.querySelector('#exportDialog').close();void 0");
 await check('Wilayah belum terdaftar tidak meminjam geometri/atribut',"zonePhase==='unavailable'&&featureLayers.size===0&&configuration().overlay.notListedRegionCount===1&&document.querySelector('#zoneStatus').textContent.includes('Bukan bukti')");
 const noActivityStart=await evaluate('__displayAcceptance.requests.length');
 await select(['7409000000','7471000000']);await idle();
 await check('Dua relasi unmapped tidak meminta display/detail pengganti',`configuration().overlay.unmappedPlanCount===2&&featureLayers.size===0&&__displayAcceptance.requests.length===${noActivityStart}`);
 // Fail-closed inventory dan viewport masing-masing; tidak menyentuh server/data.
 await rule({kind:'invalid',endpoint:'display',match:'inventory'});await select(['7411000000']);await idle();
 await check('Inventory malformed gagal tertutup, tidak mempertahankan sumber/layer lama',"zonePhase==='error'&&featureLayers.size===0&&![...planRecords.values()].some(r=>r.status==='ready')&&!document.querySelector('#retryZones').hidden");
 await rule(null);await select(['7411000000']);await waitFor('configuration().overlay.loadedPlanCount===2');
 await evaluate(`map.setView([${lat},${lng}],14,{animate:false});void 0`);await verifyViewport('Pemulihan hanya memakai API display valid');
 await rule({kind:'invalid',endpoint:'display',match:'viewport'});await evaluate('map.panBy([75,20],{animate:false});void 0');await idle();
 await check('Viewport malformed gagal tertutup tanpa menggambar LOD lama/full source',"configuration().overlay.viewport.state==='error'&&configuration().overlay.viewport.failedPlanCount>0&&featureLayers.size===0&&configuration().overlay.loadedPlanCount===2&&/gagal|error|parsial/i.test(document.querySelector('#zoneStatus').textContent+' '+document.querySelector('#coverageStatus').textContent)");
 await rule(null);await evaluate('requestViewport();void 0');await verifyViewport('Viewport dapat dipulihkan sesudah payload invalid');
 await failClosedDetail('invalid');await failClosedDetail('conflict');
 // Snapshot error mungkin memerlukan reload inventory eksplisit, bukan retry atribut lama.
 await select(['7411000000']);await waitFor('configuration().overlay.loadedPlanCount===2');
 await evaluate(`map.setView([${lat},${lng}],14,{animate:false});requestViewport();void 0`);await verifyViewport('Snapshot dimuat ulang sebelum race tests');
 // Race viewport: respons valid lama dikirim sesudah area/level baru selesai.
 await rule({kind:'hold',endpoint:'display',match:'viewport',remaining:1});const heldStart=await evaluate('__displayAcceptance.held.length');
 await evaluate('map.panBy([65,30],{animate:false});void 0');await waitFor(`__displayAcceptance.held.length>${heldStart}`);
 const staleViewport=await evaluate(`__displayAcceptance.held.slice(${heldStart}).map(h=>h.index)`);
 await rule(null);await evaluate(`map.setView([${lat},${lng}],10,{animate:false});void 0`);await idle({ignoreHeld:true});
 await check('Viewport lama menerima abort meski fetch uji mengabaikan signal',`[${staleViewport}].every(i=>__displayAcceptance.requests[i].aborted)`);
 const currentFingerprint=await evaluate('__displayAcceptance.fingerprint()');await releaseHeld();await idle();
 await check('Revision guard menolak respons viewport valid terlambat',`__displayAcceptance.fingerprint()===${JSON.stringify(currentFingerprint)}&&__displayAcceptance.viewportConsistent()`);
 // Race criteria: inventory genuine selesai di jaringan, lalu scope berganti.
 await rule({kind:'hold',endpoint:'display',match:'inventory'});const criterionHeld=await evaluate('__displayAcceptance.held.length');
 await select(['7411000000']);await waitFor(`__displayAcceptance.held.length===${criterionHeld+2}`);
 const criterionIndexes=await evaluate(`__displayAcceptance.held.slice(${criterionHeld}).map(h=>h.index)`);
 await rule(null);await select(['local:sultra:muna']);await idle({ignoreHeld:true});const unavailableView=await view();
 await check('Perubahan criteria meng-abort seluruh inventory lama',`[${criterionIndexes}].every(i=>__displayAcceptance.requests[i].aborted)`);
 await releaseHeld();await idle();
 await check('Respons inventory valid terlambat tidak mengisi wilayah yang berbeda',"zonePhase==='unavailable'&&featureLayers.size===0&&configuration().regions[0].id==='local:sultra:muna'&&configuration().overlay.loadedPlanCount===0");
 await unchangedView('Inventory criteria lama tidak auto-fit setelah scope berubah',unavailableView);
 await select(['7411000000']);await waitFor('configuration().overlay.loadedPlanCount===2');await idle();
 // Detail race latest-wins, close-wins, lalu criteria-wins. Semua payload valid asli.
 const rowKeys=await evaluate("[...document.querySelectorAll('.zone-row')].slice(0,2).map(e=>e.dataset.zoneId)");assert.equal(rowKeys.length,2);
 await rule({kind:'hold',endpoint:'detail',remaining:1});const detailHeld=await evaluate('__displayAcceptance.held.length');
 await evaluate("document.querySelector('.zone-row').focus();void 0");await keyPress('Enter');await waitFor(`__displayAcceptance.held.length===${detailHeld+1}`);
 await keyPress('Escape');await rule(null);
 await openRow(`.zone-row[data-zone-id=${JSON.stringify(rowKeys[1])}]`,{ignoreHeld:true});await requireDetail(rowKeys[1],'Detail terbaru valid sebelum respons lama dilepas');
 await releaseHeld();await idle();
 await check('Detail terbaru menang atas respons valid lama yang mengabaikan abort',`__displayAcceptance.requests[__displayAcceptance.held[${detailHeld}].index].aborted&&document.querySelector('#zoneDialog').open&&document.querySelector('#zoneDetailContent').textContent.includes(${JSON.stringify(rowKeys[1])})&&!document.querySelector('#zoneDetailContent').textContent.includes(${JSON.stringify(rowKeys[0])})`);
 await closeFocus(rowKeys[1]);
 await rule({kind:'hold',endpoint:'detail',remaining:1});const closeHeld=await evaluate('__displayAcceptance.held.length');
 await evaluate("document.querySelector('.zone-row').focus();void 0");await keyPress('Enter');await waitFor(`__displayAcceptance.held.length===${closeHeld+1}`);await keyPress('Escape');
 await rule(null);await releaseHeld();await idle();
 await check('Close membatalkan detail dan respons lama tidak membuka dialog ulang',`__displayAcceptance.requests[__displayAcceptance.held[${closeHeld}].index].aborted&&!document.querySelector('#zoneDialog').open&&document.activeElement.dataset.zoneId===${JSON.stringify(rowKeys[0])}`);
 await rule({kind:'hold',endpoint:'detail',remaining:1});const scopeHeld=await evaluate('__displayAcceptance.held.length');
 await evaluate("document.querySelector('.zone-row').focus();void 0");await keyPress('Enter');await waitFor(`__displayAcceptance.held.length===${scopeHeld+1}`);
 await rule(null);await select(['local:sultra:muna']);await idle({ignoreHeld:true});await releaseHeld();await idle();
 await check('Perubahan criteria membatalkan detail lama, tidak memasangkan atribut salah',`__displayAcceptance.requests[__displayAcceptance.held[${scopeHeld}].index].aborted&&!document.querySelector('#zoneDialog').open&&featureLayers.size===0&&configuration().regions[0].id==='local:sultra:muna'`);
 // Mobile: aksi touch nyata, bukan sekadar screenshot/resize.
 await select(['7411000000']);await waitFor('configuration().overlay.loadedPlanCount===2');await idle();
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 await send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});
 await evaluate('map.invalidateSize();window.scrollTo(0,0);void 0');await idle();
 await touch('#clearRegions');await touch('[name=region][value="7412000000"]');
 await check('Mobile touch draft tidak mengubah filter terapan',"configuration().regions[0].id==='7411000000'&&document.querySelectorAll('[name=region]:checked').length===1&&document.querySelector('[name=region][value=\"7412000000\"]').checked");
 await touch('#criteriaForm button[type=submit]');await waitFor("configuration().regions[0].id==='7412000000'&&configuration().overlay.loadedPlanCount===1");await idle();
 await check('Mobile Apply memuat Langara dengan filter KODUNK asli dan reset halaman',"planRecords.get('7412000000:001').data.meta.activity.filterField==='KODUNK'&&planRecords.get('7412000000:001').data.features.some(f=>f.properties.filter_value.includes('.'))&&document.querySelector('#zonePrevious').disabled&&document.querySelector('#zonePageStatus').textContent.startsWith('Halaman 1 dari')&&document.documentElement.scrollWidth<=innerWidth");
 const mobileKey=await evaluate("document.querySelector('.zone-row').dataset.zoneId");
 await touch('.zone-row');await idle();await requireDetail(mobileKey,'Mobile touch membuka detail plan/OID/snapshot asli');
 await screenshot('display-mobile-detail.png');await touch('[data-close="zoneDialog"]');
 await check('Mobile close touch memulihkan row dan tidak horizontal overflow',`!document.querySelector('#zoneDialog').open&&document.activeElement.dataset.zoneId===${JSON.stringify(mobileKey)}&&configuration().regions[0].id==='7412000000'&&document.documentElement.scrollWidth<=innerWidth`);
 await verifyViewport('Mobile viewport stabil memakai bbox/LOD dan counter renderer aktual');
 await evaluate("document.querySelector('#map').scrollIntoView({block:'center'});void 0");await screenshot('display-mobile-map.png');
 await evaluate("window.scrollTo(0,0);void 0");await screenshot('display-mobile.png');
 await send('Emulation.setTouchEmulationEnabled',{enabled:false});await send('Emulation.setDeviceMetricsOverride',{width:1512,height:1100,deviceScaleFactor:1,mobile:false});
 await evaluate('map.invalidateSize();void 0');await idle();
 await check('Desktop tidak horizontal overflow',"document.documentElement.scrollWidth<=innerWidth");await screenshot('display-desktop.png');
 const audit=await evaluate('({requests:__displayAcceptance.requests,violations:__displayAcceptance.violations,peak:__displayAcceptance.peak,overlay:configuration().overlay,inventory:[...planRecords].map(([id,r])=>({id,status:r.status,count:r.data?.features.length})),moves:__displayAcceptance.moves,renderer:configuration().overlay.renderer})');
 record('Semua payload nyata memenuhi kontrak independen sumber/LOD/detail',audit.violations.length===0,audit.violations);
 const checks=audit.requests.filter(r=>r.display).map(r=>({planId:new URL(r.url).searchParams.get('plan'),bbox:r.display.bbox,ids:r.display.ids}));
 const oracleCode=`import json,sys,pathlib
from shapely.geometry import shape,box
root=pathlib.Path(sys.argv[1]); sources={}; geometries={}
for file in root.glob('*.json'):
 data=json.loads(file.read_text())['data']['payload']; sources[data['meta']['plan']['id']]=data['features']
checks=json.load(sys.stdin)
for record in checks:
 plan=record['planId']; features=sources[plan]
 if record['bbox'] is None: expected=sorted(f['id'] for f in features)
 else:
  if plan not in geometries: geometries[plan]=[(f['id'],shape(f['geometry'])) for f in features]
  viewport=box(*record['bbox']); expected=sorted(oid for oid,geom in geometries[plan] if geom.intersects(viewport))
 if expected!=sorted(record['ids']): raise RuntimeError('Exact original intersection mismatch: '+plan)
print(json.dumps({'passed':True,'responsesChecked':len(checks),'method':'original_source_polygon_intersects_bbox'}))`;
 const sourceOracle=JSON.parse(execFileSync(process.env.SIAP_IZIN_PYTHON||'python3',['-c',oracleCode,sourceDir],{input:JSON.stringify(checks),encoding:'utf8',timeout:180000,maxBuffer:1024*1024}));
 record('Subset setiap respons viewport tepat menurut polygon asli, bukan envelope',sourceOracle.passed===true&&sourceOracle.responsesChecked===checks.length&&checks.length>16,sourceOracle);
 record('Setiap request baru memakai AbortSignal, termasuk detail dan retry',audit.requests.every(r=>r.signal));
 record('Maksimum tetap tiga request geometri/detail nyata serentak',audit.peak>0&&audit.peak<=3,audit.peak);
 record('Tidak ada fetch /api/zones (fetch wrapper DAN CDP)',!network.some(r=>new URL(r.url).pathname==='/api/zones'));
 record('Tidak ada exception JavaScript tak tertangani',exceptions.length===0,exceptions);
 save('browser-results.json',{schemaVersion:1,checkedAt:new Date().toISOString(),base,mode,rendererRequested:renderer,passed:true,assertionCount:results.length,results,audit,network,exceptions,console:consoleEvents});
 console.log(JSON.stringify({passed:true,assertionCount:results.length,inventoryBaseline:{plans:16,features:5994,pages:30},renderer:audit.renderer,output},null,2));
} catch(error) {
 let state=null,audit=null;
 try{state=await evaluate("({phase:typeof zonePhase==='undefined'?null:zonePhase,configuration:typeof configuration==='function'?configuration():null,records:typeof planRecords==='undefined'?[]:[...planRecords].map(([id,r])=>({id,status:r.status,error:r.error,count:r.data?.features.length})),dialogOpen:document.querySelector('#zoneDialog')?.open,focus:{tag:document.activeElement?.tagName,id:document.activeElement?.id,zoneId:document.activeElement?.dataset?.zoneId},dialog:document.querySelector('#zoneDetailContent')?.textContent})");audit=await evaluate('({requests:__displayAcceptance.requests,violations:__displayAcceptance.violations,peak:__displayAcceptance.peak,held:__displayAcceptance.held.map(h=>({index:h.index,released:h.released}))})');await screenshot('failure.png');}catch(captureError){state={...state,captureError:String(captureError)};}
 save('browser-failure.json',{schemaVersion:1,checkedAt:new Date().toISOString(),passed:false,error:String(error),stack:error.stack,base,mode,renderer,results,state,audit,network,exceptions,console:consoleEvents});
 console.error(String(error));process.exitCode=1;
} finally {
 if(ws)ws.close();
 if(browser){const exited=new Promise(resolve=>browser.once('exit',resolve));browser.kill('SIGTERM');await Promise.race([exited,delay(5000)]);if(browser.exitCode===null){browser.kill('SIGKILL');await Promise.race([exited,delay(2000)]);}}
 if(profile)fs.rmSync(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200});
}
