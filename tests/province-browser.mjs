// Live Chromium acceptance. No production fixtures or fabricated geometry.
// Run with backend active; SIAP_IZIN_URL, CHROME_BIN, SIAP_IZIN_TEST_OUTPUT optional.
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const base=process.env.SIAP_IZIN_URL||'http://127.0.0.1:8765/prototype/';
const output=process.env.SIAP_IZIN_TEST_OUTPUT||path.resolve('prototype/test-output/province');
const scratch=process.env.TMPDIR||os.tmpdir();
const chrome=process.env.CHROME_BIN||(process.platform==='darwin'?'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome':'chromium');
fs.mkdirSync(output,{recursive:true});
const profile=fs.mkdtempSync(path.join(scratch,'siap-izin-province-'));
const browser=spawn(chrome,['--headless=new','--no-first-run','--no-default-browser-check','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{stdio:'ignore'});
const delay=ms=>new Promise(r=>setTimeout(r,ms));
let ws,nextId=0;const pending=new Map(),exceptions=[],results=[];let live=null;
async function send(method,params={}){const id=++nextId;return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(id);reject(new Error('CDP timeout: '+method));},30000);pending.set(id,{resolve:v=>{clearTimeout(timer);resolve(v);},reject:e=>{clearTimeout(timer);reject(e);}});ws.send(JSON.stringify({id,method,params}));});}
async function evaluate(expression){const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw new Error(JSON.stringify(r.exceptionDetails));return r.result.value;}
async function waitFor(expr,ms=30000){const until=Date.now()+ms;while(Date.now()<until){if(await evaluate(expr))return;await delay(200);}throw new Error('Timeout '+expr);}
async function check(test,expr){const observed=await evaluate(expr);results.push({test,passed:observed===true});if(observed!==true)throw new Error(test);}
async function screenshot(name){const s=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(path.join(output,name),Buffer.from(s.data,'base64'));}
async function select(ids){await evaluate(`document.querySelectorAll('[name=region]').forEach(x=>x.checked=${JSON.stringify(ids)}.includes(x.value));document.querySelector('#regionOptions').dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('#criteriaForm').requestSubmit();void 0`);}
async function keyPress(key){
 const codes={Enter:13,Escape:27,Tab:9},code=key;
 await send('Input.dispatchKeyEvent',{type:'keyDown',key,code,windowsVirtualKeyCode:codes[key],...(key==='Enter'?{text:'\r',unmodifiedText:'\r'}:{})});
 await send('Input.dispatchKeyEvent',{type:'keyUp',key,code,windowsVirtualKeyCode:codes[key]});
}
async function touch(selector){
 const point=await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw new Error('Touch target missing');e.scrollIntoView({block:'center',inline:'center'});const r=e.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};})()`);
 await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...point,radiusX:1,radiusY:1,force:1,id:1}]});
 await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await delay(100);
}
try{
 const portFile=path.join(profile,'DevToolsActivePort');for(let i=0;i<100&&!fs.existsSync(portFile);i++)await delay(100);
 if(!fs.existsSync(portFile))throw new Error('Isolated Chrome CDP unavailable');
 const port=fs.readFileSync(portFile,'utf8').split('\n')[0];
 const targets=await(await fetch(`http://127.0.0.1:${port}/json/list`)).json();
 ws=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);
 await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});
 ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.reject(new Error(JSON.stringify(m.error))):p.resolve(m.result);}}else if(m.method==='Runtime.exceptionThrown')exceptions.push(m.params.exceptionDetails.text);});
 await send('Page.enable');await send('Runtime.enable');
 await send('Emulation.setDeviceMetricsOverride',{width:1512,height:1100,deviceScaleFactor:1,mobile:false});
 await send('Page.navigate',{url:base});await waitFor("typeof catalog!=='undefined'&&catalogState!=='loading'");
 await check('Validated snapshot: 17 regions, 18 plans, 16 candidate activities, 2 unavailable',"catalog!==null&&catalog.regions.length===17&&catalog.plans.length===18&&plans.filter(p=>p.activity).length===16&&plans.filter(p=>!p.activity).length===2&&document.querySelectorAll('.audit-row').length===18");
 await check('No geometry or external map before map opt-in',"map===null&&planRecords.size===0&&!document.querySelector('.leaflet-container')&&configuration().overlay.loadedPlanCount===0");
 await check('Snapshot and six gaps are explicitly labelled, no permission claim',"document.querySelector('#catalogStatus').textContent.includes('Bukan katalog live')&&document.querySelector('#catalogGaps').textContent.includes('6 wilayah')&&configuration().kbli.mappingReviewed===false");
 const entries=await evaluate('regionEntries');
 for(const r of entries){await select([r.id]);await check('Individual region: '+r.name,`(()=>{const c=configuration();const n=plans.filter(p=>p.regionId===${JSON.stringify(r.id)}).length;return c.regions.length===1&&c.regions[0].id===${JSON.stringify(r.id)}&&c.regions[0].gistaruId===${JSON.stringify(r.gistaruId)}&&document.querySelectorAll('.audit-row').length===n&&document.querySelector('#auditCount').textContent===String(n)&&document.querySelector('#mapTitle').textContent.includes(${JSON.stringify(r.name)})})()`);}
 await evaluate("document.querySelector('#resetButton').click();window.__originalFetch=window.fetch.bind(window);window.__requests=[];window.__active=0;window.__peak=0;window.fetch=async function(url,options){if(!String(url).startsWith('/api/zones'))return window.__originalFetch(url,options);window.__requests.push(String(url));window.__active++;window.__peak=Math.max(window.__peak,window.__active);try{return await window.__originalFetch(url,options);}finally{window.__active--;}};document.querySelector('#loadMap').click();void 0");
 await waitFor("map!==null&&configuration().overlay.plans.length===18&&!['loading','idle'].includes(zonePhase)&&!configuration().overlay.plans.some(p=>p.status==='loading')",480000);
 live=await evaluate("({configuration:configuration(),requests:window.__requests,peak:window.__peak,records:[...planRecords].map(([id,r])=>({id,status:r.status,error:r.error,meta:r.data?.meta,featureCount:r.data?.features.length})),pathCount:document.querySelectorAll('.leaflet-overlay-pane path').length,coverage:document.querySelector('#coverageStatus').textContent})");
 fs.writeFileSync(path.join(output,'live-plans.json'),JSON.stringify(live,null,2)+'\n');
 await check('All 16 source-mappable plans actually loaded, with only two unmapped plans',"configuration().overlay.loadedPlanCount===16&&configuration().overlay.failedPlanCount===0&&configuration().overlay.unmappedPlanCount===2&&layerMapper.size===16");
 await check('Exactly 16 literal plan queries at concurrency at most three',"window.__requests.length===16&&new Set(window.__requests).size===16&&window.__peak<=3&&window.__requests.every(u=>/^\\/api\\/zones\\?plan=74\\d{8}:\\d{3}&kbli=01273$/.test(u))");
 await check('Every returned feature drawn and identities remain plan-local',"(()=>{const n=[...planRecords.values()].reduce((s,r)=>s+(r.data?.features.length||0),0);return n>0&&featureLayers.size===n&&document.querySelectorAll('.leaflet-overlay-pane path').length===n&&[...layerMapper].every(([id,l])=>l.getLayers().length===planRecords.get(id).data.features.length)})()");
 await check('All features remain unknown/unreviewed and source counts reconcile',"[...planRecords.values()].filter(r=>r.data).every(r=>r.data.meta.counts.matched===r.data.meta.counts.returned+r.data.meta.counts.excludedInvalid&&r.data.features.every(f=>f.properties.permission==='unknown'&&f.properties.evidence_status==='unreviewed_mapping'))");
 await check('Province remains partial, not full territorial or permission coverage',"zonePhase==='partial'&&configuration().overlay.notListedRegionCount===6&&document.querySelector('#coverageStatus').textContent.includes('bukan seluruh daratan')");
 await check('Pagination is mandatory beyond 200, with native stable controls and live page totals',"configuration().overlay.highlightedFeatureCount>200&&document.querySelectorAll('.zone-row').length===200&&document.querySelector('#zonePrevious').disabled&&!document.querySelector('#zoneNext').disabled&&document.querySelector('#zonePageStatus').getAttribute('role')==='status'");
 const expectedKeys=await evaluate("ProvinceData.aggregate(catalog,applied.regions,planRecords,true).features.map(({feature,data})=>ProvinceData.featureKey(data.meta.plan.id,feature.id))");
 await evaluate("window.__previousNode=document.querySelector('#zonePrevious');window.__nextNode=document.querySelector('#zoneNext');document.querySelector('#zoneNext').focus();void 0");await keyPress('Enter');
 await check('Native keyboard Next crosses feature 200 without replacing controls or truncating the map',`document.querySelector('.zone-row').dataset.zoneId===${JSON.stringify(expectedKeys[200])}&&document.querySelector('#zonePageStatus').textContent.includes('Halaman 2 dari')&&document.querySelector('#zonePrevious')===window.__previousNode&&document.querySelector('#zoneNext')===window.__nextNode&&featureLayers.size===${expectedKeys.length}`);
 await keyPress('Tab');await check('Tab from Next reaches the first later feature',"document.activeElement===document.querySelector('.zone-row')");await keyPress('Enter');
 await check('Keyboard opens feature beyond 200 with its own plan-local provenance',`document.querySelector('#zoneDialog').open&&document.querySelector('#zoneDetailContent').textContent.includes(${JSON.stringify(expectedKeys[200])})&&document.querySelector('#zoneDetailContent').textContent.includes('unknown')`);
 await keyPress('Escape');await check('Closing later feature returns keyboard focus to its source row',`!document.querySelector('#zoneDialog').open&&document.activeElement.dataset.zoneId===${JSON.stringify(expectedKeys[200])}`);
 await evaluate("document.querySelector('#zonePrevious').focus()");await keyPress('Enter');
 await check('Native keyboard Previous returns to the first page with usable focus',`document.querySelector('.zone-row').dataset.zoneId===${JSON.stringify(expectedKeys[0])}&&document.querySelector('#zonePrevious').disabled&&document.activeElement===document.querySelector('#zoneNext')`);
 const visitedKeys=[],pageCount=Math.ceil(expectedKeys.length/200);
 for(let page=0;page<pageCount;page++){
  if(page){await evaluate("document.querySelector('#zoneNext').focus()");await keyPress('Enter');}
  visitedKeys.push(...await evaluate("[...document.querySelectorAll('.zone-row')].map(e=>e.dataset.zoneId)"));
  await check('Keyboard page '+(page+1)+' reports correct total without changing source layers',`document.querySelector('#zonePageStatus').textContent===${JSON.stringify(`Halaman ${page+1} dari ${pageCount} · fitur ${page*200+1}–${Math.min((page+1)*200,expectedKeys.length)} dari ${expectedKeys.length}`)}&&featureLayers.size===${expectedKeys.length}&&document.querySelectorAll('.leaflet-overlay-pane path').length===${expectedKeys.length}`);
 }
 const allReachable=JSON.stringify(visitedKeys)===JSON.stringify(expectedKeys)&&new Set(visitedKeys).size===expectedKeys.length;
 results.push({test:'Every loaded feature is reachable exactly once through native keyboard pagination',passed:allReachable});if(!allReachable)throw new Error('Keyboard pagination omits or duplicates source features');
 await check('Last page disables Next and keeps keyboard focus on Previous',"document.querySelector('#zoneNext').disabled&&document.activeElement===document.querySelector('#zonePrevious')");
 for(const p of await evaluate('plans.filter(p=>p.activity).map(p=>({id:p.id,name:p.name}))')){
  await evaluate(`(()=>{const d=planRecords.get(${JSON.stringify(p.id)}).data;openZone(d.features[0],d);})()`);
  await check('Per-plan polygon detail: '+p.name,`document.querySelector('#zoneDialog').open&&document.querySelector('#zoneDetailContent').textContent.includes(${JSON.stringify(p.id)})&&document.querySelector('#zoneDetailContent').textContent.includes('unknown')`);
  await evaluate("document.querySelector('#zoneDialog').close()");
 }
 await check('Lasalimu corrected to activity 014 and Langara retains KODUNK dot filter',"planRecords.get('7404000000:001').data.meta.activity.id==='014'&&planRecords.get('7412000000:001').data.meta.activity.filterField==='KODUNK'&&planRecords.get('7412000000:001').data.features.some(f=>f.properties.filter_value.includes('.'))");
 const folder=fs.mkdtempSync(path.join(output,'download-'));await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:folder});
 await evaluate("document.querySelector('#exportTop').click()");const preview=await evaluate("document.querySelector('#jsonPreview').textContent");
 // The download must remain the immutable preview even after current criteria change.
 await select(['local:sultra:muna']);await evaluate("document.querySelector('#downloadConfig').click()");
 const downloaded=path.join(folder,'siap-izin-konfigurasi-eksplorasi.json');for(let i=0;i<100&&!fs.existsSync(downloaded);i++)await delay(100);
 const actual=JSON.parse(fs.readFileSync(downloaded,'utf8'));const same=JSON.stringify(actual)===JSON.stringify(JSON.parse(preview))&&actual.schemaVersion===3&&actual.overlay.loadedPlanCount===16&&actual.regions.length===17&&actual.containsGeometry===false&&!/"(?:geometry|coordinates|targetAreaM2|roadPreference)"/.test(JSON.stringify(actual));
 results.push({test:'Real download reopened, immutable preview with all plan provenance and no geometry/candidate inputs',passed:same});if(!same)throw new Error('download mismatch');
 await evaluate("document.querySelector('#exportDialog').close()");
 await check('Unavailable region clears previous polygons and pagination without implying prohibition',"zonePhase==='unavailable'&&featureLayers.size===0&&document.querySelectorAll('.leaflet-overlay-pane path').length===0&&configuration().overlay.notListedRegionCount===1&&document.querySelector('#zoneStatus').textContent.includes('Bukan bukti')&&document.querySelector('#zonePageStatus').textContent==='Halaman 0 dari 0 · fitur 0 dari 0'&&document.querySelector('#zonePrevious').disabled&&document.querySelector('#zoneNext').disabled");
 await select(['7409000000','7471000000']);
 await check('Two unmapped plans displayed without borrowed activities or source geometry requests',"zonePhase==='unavailable'&&configuration().overlay.unmappedPlanCount===2&&featureLayers.size===0");
 await select(['7411000000']);await waitFor("zonePhase==='ready'");
 await check('Selected region loads both of its available plans, not only Tirawuta',"layerMapper.size===2&&[...planRecords.values()].every(r=>r.status==='ready')");
 await evaluate("document.querySelector('#clearRegions').click()");
 await check('Draft and empty submission preserve applied overlay',"configuration().regions.length===1&&document.querySelectorAll('[name=region]:checked').length===0&&layerMapper.size===2");
 await evaluate("document.querySelector('#criteriaForm').requestSubmit()");await check('Empty selection rejected',"!document.querySelector('#formError').hidden&&layerMapper.size===2");
 // Explicit invalid-response injection in test only; never synthesise valid source geometry.
 await evaluate("window.fetch=async(u,o)=>String(u).startsWith('/api/zones')?new Response('{}',{status:200,headers:{'Content-Type':'application/json'}}):window.__originalFetch(u,o);document.querySelector('#retryZones').click();void 0");await waitFor("zonePhase==='error'");
 await check('Invalid API response fails closed, clears old data and offers retry',"featureLayers.size===0&&document.querySelectorAll('.leaflet-overlay-pane path').length===0&&!document.querySelector('#retryZones').hidden");
 // Delay real response and ignore AbortSignal to exercise revision guard.
 await evaluate("window.__release=[];window.fetch=async(u,o)=>{if(!String(u).startsWith('/api/zones'))return window.__originalFetch(u,o);const r=await window.__originalFetch(u);await new Promise(resolve=>window.__release.push(resolve));return r;};document.querySelector('#retryZones').click();void 0");await waitFor('window.__release.length===2');await select(['local:sultra:muna']);
 await evaluate("window.__release.forEach(r=>r());void 0");await delay(500);
 await check('Late genuine old responses cannot repopulate a different selected region',"zonePhase==='unavailable'&&featureLayers.size===0&&configuration().regions[0].id==='local:sultra:muna'");
 await evaluate("window.fetch=window.__originalFetch;document.querySelector('#resetButton').click();void 0");await waitFor("configuration().overlay.loadedPlanCount===16&&!configuration().overlay.plans.some(p=>p.status==='loading')",480000);
 await waitFor("document.querySelectorAll('.leaflet-tile-loaded').length>0");
 await check('Desktop has no horizontal overflow',"document.documentElement.scrollWidth<=innerWidth");
 await evaluate("window.scrollTo(0,0);void 0");await screenshot('province-desktop.png');
 await select(['7411000000']);await waitFor("zonePhase==='ready'");
 await evaluate("(()=>{const d=planRecords.get('7411000000:001').data;const l=featureLayers.get(ProvinceData.featureKey(d.meta.plan.id,d.features[0].id));map.fitBounds(l.getBounds(),{maxZoom:16,animate:false});})()");await delay(500);
 const point=await evaluate("(()=>{const d=planRecords.get('7411000000:001').data;const el=featureLayers.get(ProvinceData.featureKey(d.meta.plan.id,d.features[0].id)).getElement();const b=el.getBBox();for(const x of [.5,.25,.75,.125,.875])for(const y of [.5,.25,.75,.125,.875]){const local=new DOMPoint(b.x+b.width*x,b.y+b.height*y);if(el.isPointInFill(local)){const p=local.matrixTransform(el.getScreenCTM());const r=document.querySelector('#map').getBoundingClientRect();if(p.x>r.left&&p.x<r.right&&p.y>r.top&&p.y<r.bottom)return {x:p.x,y:p.y};}}throw new Error('No visible interior of source SVG polygon');})()");
 await send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...point});await send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...point});
 await check('Trusted pointer opens the interior of a rendered source polygon',"document.querySelector('#zoneDialog').open");
 await evaluate("document.querySelector('#zoneDialog').close()");
 await evaluate("document.querySelector('.zone-row').focus()");await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r',unmodifiedText:'\r'});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
 await check('Native keyboard opens source polygon detail',"document.querySelector('#zoneDialog').open");await screenshot('province-polygon-detail.png');
 await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
 await check('Escape closes detail',"!document.querySelector('#zoneDialog').open");
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});await delay(300);
 await evaluate("window.scrollTo(0,0);map.invalidateSize();void 0");await check('Mobile 390px has no horizontal overflow',"document.documentElement.scrollWidth<=innerWidth");await screenshot('province-mobile.png');
 await touch('#clearRegions');await touch('[name=region][value="7412000000"]');
 await check('Mobile touch changes region draft without changing applied overlays',"document.querySelectorAll('[name=region]:checked').length===1&&document.querySelector('[name=region][value=\"7412000000\"]').checked&&configuration().regions[0].id==='7411000000'&&layerMapper.size===2");
 await touch('#criteriaForm button[type=submit]');await waitFor("zonePhase==='ready'&&configuration().regions.length===1&&configuration().regions[0].id==='7412000000'");
 await check('Mobile touch Apply loads the selected source region and resets pagination',"layerMapper.size===1&&planRecords.get('7412000000:001').status==='ready'&&document.querySelector('#zonePageStatus').textContent.startsWith('Halaman 1 dari')&&document.querySelector('#zonePrevious').disabled&&document.documentElement.scrollWidth<=innerWidth");
 const mobileKey=await evaluate("document.querySelector('.zone-row').dataset.zoneId");
 await touch('.zone-row');await check('Mobile touch opens source detail with original provenance',`document.querySelector('#zoneDialog').open&&document.querySelector('#zoneDetailContent').textContent.includes(${JSON.stringify(mobileKey)})&&document.querySelector('#zoneDetailContent').textContent.includes('KODUNK')&&document.querySelector('#zoneDetailContent').textContent.includes('unknown')`);
 await screenshot('province-mobile-detail.png');await touch('[data-close="zoneDialog"]');
 await check('Mobile touch closes detail and retains selected source results',`!document.querySelector('#zoneDialog').open&&document.querySelector('.zone-row').dataset.zoneId===${JSON.stringify(mobileKey)}&&configuration().regions[0].id==='7412000000'&&document.documentElement.scrollWidth<=innerWidth`);
 await check('No JavaScript exceptions',exceptions.length===0?'true':'false');
 const report={checkedAt:new Date().toISOString(),passed:results.every(r=>r.passed),assertionCount:results.length,results,live, javascriptExceptions:exceptions};fs.writeFileSync(path.join(output,'browser-results.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,assertionCount:results.length,liveOverlay:live.configuration.overlay,output},null,2));
}catch(error){let state=null;try{state=await evaluate("({phase:zonePhase,config:configuration(),records:[...planRecords].map(([id,r])=>({id,status:r.status,error:r.error}))})");await screenshot('failure.png');}catch{}fs.writeFileSync(path.join(output,'browser-failure.json'),JSON.stringify({error:String(error),results,state,exceptions},null,2)+'\n');console.error(String(error),JSON.stringify(state));process.exitCode=1;
}finally{if(ws)ws.close();browser.kill('SIGTERM');}
