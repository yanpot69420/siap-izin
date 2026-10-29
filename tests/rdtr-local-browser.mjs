// UAT DB lokal nyata. Tidak membuat source/HTTP respons tiruan atau menjalankan server.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
const base=process.env.SIAP_IZIN_URL,requestedOutput=process.env.SIAP_IZIN_TEST_OUTPUT,sourceDir=process.env.SIAP_IZIN_SOURCE_DIR;
assert(base&&requestedOutput&&sourceDir,'URL, direktori output privat dan source wajib eksplisit');
const url=new URL(base);assert(['127.0.0.1','localhost'].includes(url.hostname)&&url.port!=='8765','Uji memakai loopback terpisah, bukan server/browser pengguna');
const repository=fs.realpathSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'));
function outsideRepository(candidate){const relative=path.relative(repository,candidate);return relative==='..'||relative.startsWith('..'+path.sep)||path.isAbsolute(relative);}
function canonicalDestination(value){
 let ancestor=path.resolve(value);const suffix=[];
 for(;;){
  try{return path.join(fs.realpathSync(ancestor),...suffix);}
  catch(error){
   if(error.code!=='ENOENT')throw error;
   try{assert(!fs.lstatSync(ancestor).isSymbolicLink(),'Output harus privat di luar repo');}
   catch(linkError){if(linkError.code!=='ENOENT')throw linkError;}
   const parent=path.dirname(ancestor);assert(parent!==ancestor,'Output harus privat di luar repo');
   suffix.unshift(path.basename(ancestor));ancestor=parent;
  }
 }
}
assert(path.isAbsolute(requestedOutput),'Output harus privat di luar repo');
const destination=canonicalDestination(requestedOutput);
assert(outsideRepository(destination),'Output harus privat di luar repo');
fs.mkdirSync(destination,{recursive:true,mode:0o700});
const output=fs.realpathSync(destination);
assert(outsideRepository(output),'Output harus privat di luar repo');
const selected={'7411000000:001':'tirawuta-01273.json','7402000000:003':'7402000000-003-01273.json'};
const manifest=JSON.parse(fs.readFileSync(path.join(path.dirname(sourceDir),'frozen-input-verification.json'),'utf8'));
const reference={};
for(const [id,name]of Object.entries(selected)){
 const raw=fs.readFileSync(path.join(sourceDir,name));assert.equal(createHash('sha256').update(raw).digest('hex'),manifest.checks.find(r=>r.planId===id).sha256);
 const payload=JSON.parse(raw).data.payload;assert.equal(payload.meta.plan.id,id);reference[id]={ids:payload.features.map(f=>f.id).sort((a,b)=>a-b),source:payload.meta.source};
}
const expected=Object.values(reference).reduce((n,r)=>n+r.ids.length,0),requests=[],exceptions=[],results=[];let browser,ws,profile,next=0;
const pending=new Map(),delay=ms=>new Promise(r=>setTimeout(r,ms));
function record(name,passed,observed){results.push({name,passed,observed});assert(passed,name);}
const save=(name,value)=>fs.writeFileSync(path.join(output,name),JSON.stringify(value,null,2)+'\n',{mode:0o600});
async function send(method,params={}){const id=++next;return new Promise((resolve,reject)=>{const t=setTimeout(()=>{pending.delete(id);reject(new Error('CDP timeout '+method));},45000);pending.set(id,{resolve:v=>{clearTimeout(t);resolve(v);},reject:e=>{clearTimeout(t);reject(e);}});ws.send(JSON.stringify({id,method,params}));});}
async function evaluate(expression){const value=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(value.exceptionDetails)throw new Error(JSON.stringify(value.exceptionDetails));return value.result.value;}
async function waitFor(expression,timeout=120000){const end=Date.now()+timeout;while(Date.now()<end){if(await evaluate(expression))return;await delay(150);}throw new Error('Timeout '+expression);}
async function capture(name){const value=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(path.join(output,name),Buffer.from(value.data,'base64'),{mode:0o600});}
async function applyCriteriaNative(){
 const previousGeneration=await evaluate('loadRevision');
 await evaluate("document.querySelector('#criteriaForm button[type=submit]').scrollIntoView({block:'center'});void 0");await delay(100);
 const p=await evaluate("(()=>{const r=document.querySelector('#criteriaForm button[type=submit]').getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2};})()");
 await send('Input.dispatchMouseEvent',{type:'mousePressed',x:p.x,y:p.y,button:'left',clickCount:1});
 await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:p.x,y:p.y,button:'left',clickCount:1});
 await waitFor(`loadRevision>${previousGeneration}&&document.querySelector('#formStatus').textContent.includes('Kriteria diterapkan')`);
}
async function regionBeaconPoint(region){
 await evaluate("document.activeElement?.blur();document.querySelector('#map').scrollIntoView({block:'center'});void 0");await delay(150);
 return evaluate(`(()=>{const p=document.querySelector(${JSON.stringify('path.region-beacon[data-region="'+region+'"]')});if(!p)return null;const r=p.getBoundingClientRect(),x=Math.round(r.left+r.width/2),y=Math.round(r.top+r.height/2);return r.width>0&&r.height>0&&document.elementFromPoint(x,y)===p?{x,y,region:p.dataset.region}:null;})()`);
}
try{
 const scratch=process.env.TMPDIR||path.join(os.homedir(),'.hermes/cache/scratch');profile=fs.mkdtempSync(path.join(scratch,'siap-izin-local-uat-'));
 const chrome=process.env.CHROME_BIN||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
 browser=spawn(chrome,['--headless=new','--no-first-run','--no-default-browser-check','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:['ignore','ignore','pipe']});
 let startup='';browser.stderr.on('data',v=>{startup=(startup+v.toString()).slice(-6000);});
 const file=path.join(profile,'DevToolsActivePort');for(let i=0;i<200&&!fs.existsSync(file);i++)await delay(100);assert(fs.existsSync(file),'Chrome terisolasi tidak siap: '+startup);
 const port=fs.readFileSync(file,'utf8').split('\n')[0],targets=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();
 ws=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});
 ws.addEventListener('message',event=>{const m=JSON.parse(event.data);if(m.id){const p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.reject(new Error(JSON.stringify(m.error))):p.resolve(m.result);}return;}if(m.method==='Runtime.exceptionThrown')exceptions.push(m.params.exceptionDetails);if(m.method==='Network.requestWillBeSent')requests.push({url:m.params.request.url,method:m.params.request.method,id:m.params.requestId});if(m.method==='Network.loadingFinished'){const r=requests.find(r=>r.id===m.params.requestId);if(r)r.encodedBytes=m.params.encodedDataLength;}});
 await send('Page.enable');await send('Runtime.enable');await send('Network.enable');await send('Network.setCacheDisabled',{cacheDisabled:true});
 await send('Network.setBlockedURLs',{urls:['*://*.atrbpn.go.id/*','*://atrbpn.go.id/*']});
 await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1050,deviceScaleFactor:1,mobile:false});
 await send('Page.navigate',{url:base});await waitFor("typeof catalog!=='undefined'&&catalogState==='ready'");
 const boot=await evaluate('catalog');record('Katalog mempertahankan17wilayah/18rencana',boot.regions.length===17&&boot.plans.length===18);
 record('Bootstrap datasetlokal parsial/pin64hex',boot.localDataset?.sourceKind==='local_dataset'&&boot.localDataset.partial===true&&/^[a-f0-9]{64}$/.test(boot.localDataset.releaseHash));
 const available=boot.plans.filter(p=>p.localDataset?.available).map(p=>p.id).sort();record('Hanya dua sumber nyata tersedia',JSON.stringify(available)===JSON.stringify(Object.keys(reference).sort()),available);
 record('Tidak mengambil geometri sebelumoptin',requests.filter(r=>new URL(r.url).pathname==='/api/display').length===0);
 const start=Date.now();await evaluate("document.querySelector('#loadMap').click();void 0");
 await applyCriteriaNative();record('Native Terapkan setelah Muat peta diterima',await evaluate("document.querySelector('#formStatus').textContent.includes('Kriteria diterapkan')"));
 await waitFor(`typeof configuration==='function'&&configuration().overlay.loadedFeatureCount===${expected}&&configuration().overlay.loadedPlanCount===2&&!['idle','loading'].includes(configuration().overlay.viewport.state)`);
 await delay(1100);const readyMs=Date.now()-start;
 const inventory=await evaluate("[...planRecords.entries()].filter(([,r])=>r.status==='ready').map(([id,r])=>({id,ids:r.data.features.map(f=>f.id).sort((a,b)=>a-b),meta:r.data.meta}))");
 record('Inventaris 1708 ID sumber tepat',inventory.length===available.length&&inventory.every(r=>JSON.stringify(r.ids)===JSON.stringify(reference[r.id].ids)),inventory.map(r=>({plan:r.id,count:r.ids.length})));
 record('Status/tanggal/pin/rulescope tetap jujur',inventory.every(r=>r.meta.source.status==='local_dataset'&&Date.parse(r.meta.source.retrievedAt)===Date.parse(reference[r.id].source.retrievedAt)&&r.meta.dataset.releaseHash===boot.localDataset.releaseHash&&r.meta.dataset.geometryScope==='filtered_subset'&&r.meta.dataset.rulesScope==='filter_membership_only'&&r.meta.kbli.mappingReviewed===false));
 const config=await evaluate('configuration()');record('Coverage tetappartial/unknown, bukanfullSultra',config.overlay.state==='partial'&&config.overlay.availableFeatureCount===null&&config.containsGeometry===false);
 function privateKey(value){return value&&typeof value==='object'&&Object.entries(value).some(([k,v])=>['geometry','coordinates','geom_original_4326','blob_locator','owner_dsn','reader_dsn','password'].includes(k)||privateKey(v));}
 record('Ekspor konfigurasi tanpa geometri/kredensial',!privateKey(config));
 const expectedRegions=[...new Set(boot.plans.filter(p=>available.includes(p.id)).map(p=>p.regionId))].sort();
 const initialBeacons=await evaluate("[...document.querySelectorAll('path.region-beacon[data-region]')].map(p=>p.dataset.region).sort()");
 record('Lingkaran wilayah langsung terlihat tanpa membuka daftar RDTR',JSON.stringify(initialBeacons)===JSON.stringify(expectedRegions),initialBeacons);
 await evaluate("map.setView([0,0],7,{animate:false});void 0");await delay(500);
 await applyCriteriaNative();
 await waitFor("configuration().overlay.loadedFeatureCount===1708&&configuration().overlay.loadedPlanCount===2&&!['idle','loading'].includes(configuration().overlay.viewport.state)&&featureLayers.size>0");
 record('Terapkan ulang setelah selesai tetap menggambar polygon',await evaluate('featureLayers.size>0'),await evaluate('({loaded:configuration().overlay.loadedFeatureCount,drawn:featureLayers.size,viewport:configuration().overlay.viewport.state})'));
 record('Terapkan memusatkan sorotan walau sebelumnya peta digeser jauh',await evaluate("map.getCenter().lat<-1&&map.getCenter().lng>119&&map.getCenter().lng<125"));
 const body=await evaluate('document.body.textContent');record('Label datasetlokal terlihat',/dataset\s+lokal/i.test(body));
 await evaluate("document.activeElement?.blur();document.querySelector('#map').scrollIntoView({block:'center'});void 0");await capture('local-db-desktop.png');
 const routaRegion=boot.plans.find(p=>p.id==='7402000000:003').regionId;
 const beacon=await regionBeaconPoint(routaRegion);record('Lingkaran Routa mempunyai target klik nyata',Boolean(beacon),beacon);
 const cameraBefore=await evaluate('({lat:map.getCenter().lat,lng:map.getCenter().lng,zoom:map.getZoom()})');
 await send('Input.dispatchMouseEvent',{type:'mousePressed',x:beacon.x,y:beacon.y,button:'left',clickCount:1});
 await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:beacon.x,y:beacon.y,button:'left',clickCount:1});
 await waitFor("!['idle','loading'].includes(configuration().overlay.viewport.state)&&featureLayers.size>0");
 const cameraAfter=await evaluate('({lat:map.getCenter().lat,lng:map.getCenter().lng,zoom:map.getZoom()})');
 record('Klik lingkaran memperbesar area sumber tanpa daftar RDTR',cameraAfter.zoom>=cameraBefore.zoom&&JSON.stringify(cameraAfter)!==JSON.stringify(cameraBefore),{before:cameraBefore,after:cameraAfter});
 await capture('local-db-region-zoom.png');
 const detailStart=requests.length;await evaluate("document.querySelector('.zone-row').scrollIntoView({block:'center'});document.querySelector('.zone-row').focus();void 0");
 await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r'});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
 await waitFor("document.querySelector('#zoneDialog').open&&document.querySelector('#zoneDetailContent').textContent.includes('unknown')");
 record('Detail memakai endpoint atribut',requests.slice(detailStart).some(r=>new URL(r.url).pathname==='/api/feature-detail'));await capture('local-db-detail.png');
 await evaluate("document.querySelector('#zoneDialog').close();map.setView([-3.5,121.7],11,{animate:false});void 0");await delay(1500);await waitFor("!['loading','idle'].includes(configuration().overlay.viewport.state)");
 record('Viewport tidak meminta muatulangsnapshot',!['error','reload-required'].includes((await evaluate('configuration()')).overlay.viewport.state));
 await send('Emulation.setDeviceMetricsOverride',{width:393,height:852,deviceScaleFactor:1,mobile:true});await evaluate("map.invalidateSize();document.querySelector('#map').scrollIntoView({block:'center'});void 0");await delay(1500);await capture('local-db-mobile.png');
 // Focal SVG acceptance: point must be inside an actual visible source fill.
 await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1050,deviceScaleFactor:1,mobile:false});
 await evaluate("document.activeElement?.blur();map.invalidateSize();document.querySelector('.zone-row').click();void 0");
 await waitFor("document.querySelector('#zoneDialog').open&&document.querySelector('#zoneDetailContent').textContent.includes('Dataset lokal')");
 await evaluate("document.querySelector('#zoneDialog').close();void 0");await delay(1000);
 await waitFor("!['idle','loading'].includes(configuration().overlay.viewport.state)&&featureLayers.size>0");
 await evaluate("document.activeElement?.blur();document.querySelector('#map').scrollIntoView({block:'center'});void 0");await delay(300);
 const target=await evaluate(`(()=>{const mr=document.querySelector('#map').getBoundingClientRect();for(const [key,l]of featureLayers){const p=l._path;if(!p?.isPointInFill)continue;const b=p.getBoundingClientRect(),m=p.getScreenCTM();if(!m)continue;const x0=Math.max(b.left,mr.left+3,1),x1=Math.min(b.right,mr.right-3,innerWidth-1),y0=Math.max(b.top,mr.top+3,1),y1=Math.min(b.bottom,mr.bottom-3,innerHeight-1);if(x1-x0<4||y1-y0<4)continue;for(let a=0;a<15;a++)for(let z=0;z<15;z++){const x=Math.round(x0+(x1-x0)*(a+.5)/15),y=Math.round(y0+(y1-y0)*(z+.5)/15),q=new DOMPoint(x,y).matrixTransform(m.inverse());if(p.isPointInFill(q)&&document.elementFromPoint(x,y)===p)return{key,x,y,fill:getComputedStyle(p).fill,opacity:getComputedStyle(p).fillOpacity};}}return null;})()`);
 record('Target pointer adalah interior SVG sumber terlihat',Boolean(target),target);await capture('local-db-focal.png');
 await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:target.x,y:target.y});
 await send('Input.dispatchMouseEvent',{type:'mousePressed',x:target.x,y:target.y,button:'left',clickCount:1});
 await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:target.x,y:target.y,button:'left',clickCount:1});
 await waitFor(`document.querySelector('#zoneDialog').open&&document.querySelector('#zoneDetailContent').textContent.includes(${JSON.stringify(target.key)})`);
 record('Klik native polygon membuka detail identitas yang tepat',true,{key:target.key});
 await evaluate("document.querySelector('#zoneDialog').close();void 0");await delay(500);
 // Native mobile touch filter/apply/detail, not merely a resized screenshot.
 await send('Emulation.setDeviceMetricsOverride',{width:393,height:852,deviceScaleFactor:1,mobile:true});
 await send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});
 async function tap(selector){await evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'center'});void 0`);await delay(150);const r=await evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2};})()`);await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:r.x,y:r.y}]});await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await delay(150);}
 const region=boot.plans.find(p=>p.id==='7411000000:001').regionId;
 await tap('#resetMap');
 await waitFor(`document.querySelectorAll('path.region-beacon[data-region]').length===${expectedRegions.length}&&!['idle','loading'].includes(configuration().overlay.viewport.state)`);
 const mobileBeacon=await regionBeaconPoint(region);record('Lingkaran Tirawuta dapat disentuh pada mobile',Boolean(mobileBeacon),mobileBeacon);
 const mobileCameraBefore=await evaluate('JSON.stringify({lat:map.getCenter().lat,lng:map.getCenter().lng,zoom:map.getZoom()})');
 await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:mobileBeacon.x,y:mobileBeacon.y}]});await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await waitFor(`JSON.stringify({lat:map.getCenter().lat,lng:map.getCenter().lng,zoom:map.getZoom()})!==${JSON.stringify(mobileCameraBefore)}&&!['idle','loading'].includes(configuration().overlay.viewport.state)&&featureLayers.size>0`);
 record('Sentuh lingkaran memperbesar sumber tanpa memilih daftar',true);await capture('local-db-mobile-region-zoom.png');
 await tap('#clearRegions');await tap(`input[name=region][value="${region}"]`);await tap('#criteriaForm button[type=submit]');
 await waitFor(`applied.regions.length===1&&applied.regions[0]===${JSON.stringify(region)}&&configuration().overlay.loadedFeatureCount===20&&configuration().overlay.loadedPlanCount===1&&!['idle','loading'].includes(configuration().overlay.viewport.state)`);
 record('Sentuh mobile menerapkan wilayah Tirawuta dengan20fitur',true,{region,loaded:20});
 await tap('.zone-row');await waitFor("document.querySelector('#zoneDialog').open&&document.querySelector('#zoneDetailContent').textContent.includes('7411000000:001:')&&document.querySelector('#zoneDetailContent').textContent.includes('Dataset lokal')");
 record('Detail sumber Tirawuta dibuka lewat sentuh mobile',true);await capture('local-db-mobile-detail.png');
 await tap('#zoneDialog .close-button');await waitFor("!document.querySelector('#zoneDialog').open");await delay(1000);
 await waitFor("!['idle','loading'].includes(configuration().overlay.viewport.state)&&featureLayers.size>0");
 await evaluate("document.activeElement?.blur();map.invalidateSize();void 0");await delay(500);
 await evaluate("document.activeElement?.blur();document.querySelector('#map').scrollIntoView({block:'center'});void 0");await delay(200);await capture('local-db-mobile-focal.png');
 record('Peta mobile tidak overflow horizontal',await evaluate('document.documentElement.scrollWidth<=innerWidth'));
 const api=requests.filter(r=>new URL(r.url).pathname.startsWith('/api/')),data=api.filter(r=>['/api/display','/api/feature-detail'].includes(new URL(r.url).pathname));
 record('Semua request data mengunci rilisbootstrap',data.length>0&&data.every(r=>new URL(r.url).searchParams.get('release')===boot.localDataset.releaseHash));
 record('Tidak ada request ATR meskipundiblok',!requests.some(r=>new URL(r.url).hostname==='atrbpn.go.id'||new URL(r.url).hostname.endsWith('.atrbpn.go.id')));
 record('Tidak ada fallback /api/zones asli',!api.some(r=>new URL(r.url).pathname==='/api/zones'));
 record('Tidak ada exceptionJS',exceptions.length===0);
 save('summary.json',{passed:true,sourceKind:'local_dataset',selectedPlans:available,verifiedInventoryFeatures:expected,releaseHash:boot.localDataset.releaseHash,readyFromOptInMs:readyMs,apiRequests:api.length,apiEncodedBytes:api.reduce((n,r)=>n+(r.encodedBytes||0),0),results,requests:api,exceptions,notes:['Pemuatan basemap/Leaflet memakai internet terpisah; bukan bukti seluruh aplikasi offline.','Timing baru, bukan perbandingan kausal dengan benchmark lama.','Tidak mengevaluasi ITBX/exact-KBLI atau penerimaan OSS.']});console.log(JSON.stringify({passed:true,assertions:results.length,verifiedInventoryFeatures:expected,readyFromOptInMs:readyMs,output}));
}catch(error){save('failure.json',{passed:false,error:String(error),stack:error.stack,results,requests,exceptions});throw error;}
finally{try{ws?.close();}catch{}if(browser){browser.kill('SIGTERM');await delay(400);}if(profile)fs.rmSync(profile,{recursive:true,force:true});}
