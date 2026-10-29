// Test-only fixed overview LOD comparison. Never changes production or the source harness.
// SIAP_BENCH_OUTPUT=/absolute/private/display SIAP_BENCH_URL=http://127.0.0.1:8767/prototype/ \
// SIAP_BENCH_MANIFEST=/absolute/private/replay-manifest.json node tests/display-performance-benchmark.mjs
// Six fresh Chrome processes: three SVG + three Canvas, explicit preferCanvas false/true.
// Helpers only (NO browser/server): SIAP_BENCH_HELPERS_ONLY=1; report only: SIAP_BENCH_REPORT_ONLY=1.
import {spawn, execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {Script} from 'node:vm';

const MODE='display_lod_fixed_overview', RUNS=3, WIDTH=1512, HEIGHT=1100;
const referenceRoot=process.env.SIAP_BENCH_REFERENCE_ROOT||path.resolve('private/map-performance-reference');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const readJson=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const check=(condition,message)=>{if(!condition)throw new Error(message);};
const sum=(items,key)=>items.reduce((n,item)=>n+item[key],0);
const hash=value=>createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value)).digest('hex');
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const ids=items=>items.map(p=>p.id).sort();
export const percentile=(values,p)=>{check(values.length>0,'Quantiles require samples');const sorted=[...values].sort((a,b)=>a-b);return sorted[Math.max(0,Math.ceil(sorted.length*p)-1)];};
export function summary(values){check(values.length>0&&values.every(Number.isFinite),'Summary requires finite samples');return {samples:values.length,min:Math.min(...values),median:percentile(values,.5),p95:percentile(values,.95),max:Math.max(...values),mean:values.reduce((a,b)=>a+b,0)/values.length};}
const median=values=>percentile(values,.5);
function validateManifest(manifest){
 check(manifest.mode==='benchmark_replay'&&manifest.sourceStatus==='cached_snapshot'&&manifest.networkToGistaru===false,'Require explicit offline cached_snapshot benchmark replay manifest');
 check(manifest.plans?.length===16&&new Set(ids(manifest.plans)).size===16,'Manifest must contain 16 unique plans');
 for(const p of manifest.plans)check(/^\d{10}:\d{3}$/.test(p.id)&&p.sourceStatus==='cached_snapshot'&&p.cacheReason==='benchmark_replay'&&typeof p.retrievedAt==='string'&&Number.isFinite(Date.parse(p.retrievedAt))&&/^[a-f0-9]{64}$/.test(p.cacheFileSha256)&&['features','vertices','httpBodyBytes','cacheFileBytes','quarantined'].every(k=>Number.isSafeInteger(p[k])&&p[k]>=0),'Invalid original source metadata '+p.id);
 check(sum(manifest.plans,'features')===5994,'Expected original sourceCount 5994');
 return manifest;
}
function validateFrames(views,source,{display=false}={}){
 check(views?.length===17&&same(ids(views),['province',...source.map(p=>p.id)].sort()),'Require province + 16 unique focal views');
 for(const view of views){
  check(view.allPlansRetained===16&&view.operations?.length===4&&same(view.operations.map(o=>o.name),['pan96x64','panInverse','zoomPlus1','zoomMinus1'])&&!view.operations.some(o=>o.timeout),'Missing retained plans / invalid pan-zoom operations '+view.id);
  check(view.framesMs?.length>0&&same(view.frameSummaryMs,summary(view.framesMs)),'Invalid RAF quantiles '+view.id);
  if(display)check(view.retentionVerified===true&&view.retainedFeatureCount===5994&&same(view.bounds,view.expectedBounds),'Display retention/sourceBounds failed '+view.id);
 }
}
export function loadSourceReference(directory){
 const manifest=validateManifest(readJson(path.join(directory,'replay-manifest.json'))),data=readJson(path.join(directory,'benchmark-results.json'));
 check(data.mode==='benchmark_replay'&&data.complete===true&&data.runs?.length===3,'Require REAL completed three-run source reference '+directory);
 check(data.viewport?.width===WIDTH&&data.viewport?.height===HEIGHT&&data.viewport?.deviceScaleFactor===1,'Source reference viewport mismatch');
 for(const run of data.runs){
  check(run.plans?.length===16&&same(ids(run.plans),ids(manifest.plans))&&run.readyState.featureLayers===5994,'Incomplete source reference');
  validateFrames(run.frameViews,manifest.plans);
  for(const p of run.plans){const original=manifest.plans.find(s=>s.id===p.id);check(p.httpBodyBytes===original.httpBodyBytes&&p.features===original.features&&p.retrievedAt===original.retrievedAt&&p.network?.end>p.network?.start,'Source reference reconciliation failed '+p.id);}
 }
 return {label:path.basename(directory),directory,planCount:16,runs:3,renderer:data.renderer,manifest,data,
  totals:Object.fromEntries(['features','vertices','httpBodyBytes','cacheFileBytes','quarantined'].map(k=>[k,sum(manifest.plans,k)])),
  measurements:aggregateRunMetrics(data.runs)};
}
function aggregateRunMetrics(runs){return {optInToReadyMs:median(runs.map(r=>r.ready.optInToReadyMs)),firstRequestToReadyMs:median(runs.map(r=>r.ready.firstDisplayRequestToReadyMs??r.ready.firstZoneRequestToReadyMs)),heapUsedBytes:median(runs.map(r=>r.ready.metrics.JSHeapUsedSize)),longTaskTotalMs:median(runs.map(r=>r.ready.longTaskTotalMs)),provinceRafP95Ms:median(runs.map(r=>r.frameViews.find(v=>v.id==='province').frameSummaryMs.p95))};}
export function sourceReferenceMarkdown(references){
 return ['# Original source reference helper verification','', '**These are real original-source baseline/style runs, not display measurements.** No browser, API calls, LOD timing or renderer comparison was executed by this helper.', '',
  '|Reference|Runs|Plans|Source features|Original vertices|Original HTTP body bytes/run|Median opt-in → ready ms|Median heap bytes|', '|---|---:|---:|---:|---:|---:|---:|---:|',
  ...references.map(r=>`|${r.label}|${r.runs}|${r.planCount}|${r.totals.features}|${r.totals.vertices}|${r.totals.httpBodyBytes}|${r.measurements.optInToReadyMs.toFixed(2)}|${r.measurements.heapUsedBytes}|`), '',
  'Source Content-Length values, original retrievedAt, complete three-run/16-plan/17-view structure and raw RAF quantiles reconciled against the actual saved manifests. Durations are separate; overlapping timings are never summed.',''].join('\n');
}
function sourceIdentity(manifest){return manifest.plans.map(p=>({id:p.id,sha256:p.cacheFileSha256,retrievedAt:p.retrievedAt,features:p.features,vertices:p.vertices})).sort((a,b)=>a.id.localeCompare(b.id));}
function validBounds(b){return Array.isArray(b)&&b.length===4&&b.every(Number.isFinite)&&b[0]<b[2]&&b[1]<b[3]&&b[0]>=-180&&b[2]<=180&&b[1]>=-90&&b[3]<=90;}
function unionBounds(bounds){return [Math.min(...bounds.map(b=>b[0])),Math.min(...bounds.map(b=>b[1])),Math.max(...bounds.map(b=>b[2])),Math.max(...bounds.map(b=>b[3]))];}
function vertexCount(coordinates){return typeof coordinates?.[0]==='number'?1:coordinates.reduce((n,c)=>n+vertexCount(c),0);}
function validateDisplayPlan(p,s){
 check(p.id===s.id&&p.replay===true&&p.status===200&&p.retrievedAt===s.retrievedAt,'Display replay provenance failed '+s.id);
 check(p.features===s.features&&p.sourceFeatureCount===s.features&&p.sourceCounts?.matched===s.features+s.quarantined&&p.sourceCounts?.returned===s.features&&p.sourceCounts?.excludedInvalid===s.quarantined&&same(p.counts,p.sourceCounts),'Source / returned feature counts mismatch '+s.id);
 check(p.originalVertices===s.vertices&&Number.isSafeInteger(p.returnedVertices)&&p.returnedVertices>0&&p.actualVertices===p.returnedVertices,'Display returnedVertices reconciliation failed '+s.id);
 check(p.level==='overview'&&p.bbox===null&&validBounds(p.sourceBounds)&&/^[a-f0-9]{64}$/.test(p.snapshotId),'Not fixed overview / original sourceBounds missing '+s.id);
 check(Number.isSafeInteger(p.httpBodyBytes)&&p.httpBodyBytes>0&&p.actualBodyBytes===p.httpBodyBytes&&p.network?.end>p.network?.start&&!p.network.error&&p.network.status===200,'Actual HTTP bytes / network incomplete '+s.id);
 check(/^[a-f0-9]{64}$/.test(p.featureHash)&&/^[a-f0-9]{64}$/.test(p.featureIdsHash),'Missing actual response feature/ID digest '+s.id);
 for(const k of ['fetchStartToHeadersMs','nativeJsonBodyDecodeParseMs','fetchStartToJsonResolvedMs','drawPlanSyncMs','drawEndToTwoRafMs','requestToLoadingFinishedMs'])check(Number.isFinite(p[k])&&p[k]>=0,'Invalid separate duration '+k);
}
export function validateDisplayComparison(data,manifest){
 check(data.mode===MODE,'Report accepts only '+MODE+'; source baseline runs cannot be relabelled');
 validateManifest(manifest);
 check(data.complete===true&&data.runs?.length===6&&data.method?.runsPerRenderer===3,'Comparison requires three REAL runs per renderer');
 check(same(data.sourceIdentity,sourceIdentity(manifest)),'Replay snapshot changed');
 check(same(data.viewport,{width:WIDTH,height:HEIGHT,deviceScaleFactor:1}),'Display viewport mismatch');
 for(const renderer of ['svg','canvas']){
  const runs=data.runs.filter(r=>r.renderer===renderer);
  check(runs.length===3&&same(runs.map(r=>r.index).sort(),[1,2,3]),'Renderer run indices incomplete '+renderer);
  for(const run of runs){
   check(run.plans?.length===16&&same(ids(run.plans),ids(manifest.plans))&&run.exceptions?.length===0&&run.forbiddenRequests?.length===0,'Invalid display run');
   check(run.readyState.featureLayers===5994&&run.readyState.inventoryFeatures===5994&&run.readyState.retentionVerified===true&&run.readyState.bannerVisible===true&&run.readyState.preferCanvas===(renderer==='canvas')&&run.readyState.mapHookCalls===1,'Ready renderer/retention/banner not verified');
   check(run.displayRequestCount===16&&run.readyState.bench.requests.length===16&&run.readyState.bench.draws.length===16&&run.finalDrawCount===16,'Require exactly 16 overview fetches/draws throughout every view');
   check(renderer==='svg'?run.readyState.svgPaths===5994&&run.readyState.canvases===0:run.readyState.canvases>0&&run.readyState.svgPaths===0,'Actual renderer DOM mismatch');
   validateFrames(run.frameViews,manifest.plans,{display:true});
   for(const p of run.plans){validateDisplayPlan(p,manifest.plans.find(s=>s.id===p.id));const first=data.runs[0].plans.find(s=>s.id===p.id);check(['features','returnedVertices','originalVertices','snapshotId','featureHash','featureIdsHash','retrievedAt','httpBodyBytes'].every(k=>p[k]===first[k])&&same(p.sourceBounds,first.sourceBounds),'Fixed data changed between SVG/Canvas/runs '+p.id);}
   const province=unionBounds(run.plans.map(p=>p.sourceBounds));
   for(const v of run.frameViews)check(same(v.bounds,v.id==='province'?province:run.plans.find(p=>p.id===v.id).sourceBounds),'Focal view did not use original meta.sourceBounds '+v.id);
  }
 }
 return true;
}

// Body decoding uses the original Response.json. Extra metadata/ID bookkeeping occurs AFTER
// jsonEnd; it is not labelled JSON CPU or added to any request/draw/paint duration.
const preload=`(() => {
 window.__bench={requests:[],draws:[],longTasks:[],exceptions:[],forbiddenRequests:[],viewportNoopCalls:0,mapHookCalls:0};
 try{new PerformanceObserver(list=>{for(const e of list.getEntries())__bench.longTasks.push({start:e.startTime,duration:e.duration});}).observe({type:'longtask',buffered:true});}catch(e){__bench.longTaskUnsupported=String(e);}
 const nativeFetch=window.fetch.bind(window),nativeJson=Response.prototype.json;
 window.fetch=async function(input,options){
  const u=new URL(input instanceof Request?input.url:String(input),location.href);
  if(u.pathname==='/api/zones'||u.pathname.startsWith('/api/zones/')){__bench.forbiddenRequests.push(u.href);throw new Error('Original /api/zones forbidden in display benchmark');}
  if(u.pathname!=='/api/display')return nativeFetch(input,options);
  const r={id:u.searchParams.get('plan'),url:u.href,start:performance.now()};__bench.requests.push(r);
  if(u.origin!==location.origin||u.searchParams.get('level')!=='overview'||u.searchParams.has('bbox')||[...u.searchParams.keys()].some(k=>!['plan','kbli','level'].includes(k))||['plan','kbli','level'].some(k=>u.searchParams.getAll(k).length!==1)||u.searchParams.get('kbli')!=='01273')throw new Error('Only fixed overview without bbox is permitted');
  const response=await nativeFetch(input,options);r.headers=performance.now();r.status=response.status;r.contentLength=Number(response.headers.get('Content-Length'));r.contentEncoding=response.headers.get('Content-Encoding');
  response.json=async function(){r.jsonStart=performance.now();try{const data=await nativeJson.call(response);r.jsonEnd=performance.now();const m=data.meta,d=m?.display;
   Object.assign(r,{replay:m?.benchmarkReplay===true&&m?.source?.status==='cached_snapshot'&&m?.source?.cacheReason==='benchmark_replay',retrievedAt:m?.source?.retrievedAt,features:data.features?.length,planId:m?.plan?.id,sourceCounts:m?.sourceCounts,counts:m?.counts,sourceBounds:m?.sourceBounds,snapshotId:m?.snapshotId,level:d?.level,bbox:d?.bbox,sourceFeatureCount:d?.sourceFeatureCount,originalVertices:d?.originalVertices,returnedVertices:d?.returnedVertices,featureIds:data.features?.map(f=>String(f.id)).sort()});return data;
  }catch(e){r.error=String(e);throw e;}};return response;
 };
 window.addEventListener('error',e=>__bench.exceptions.push(e.message));
 window.addEventListener('unhandledrejection',e=>__bench.exceptions.push(String(e.reason)));
})();`;

// Executed outside measured draw/frame intervals at ready and before/after every operation.
const retentionFunction=`function retention(){
 const requests=__bench.requests;let valid=requests.length===16&&layerMapper.size===16&&featureLayers.size===5994&&[...planRecords.values()].filter(e=>e.status==='ready').length===16,inventoryFeatures=0;
 for(const r of requests){const entry=planRecords.get(r.id),group=layerMapper.get(r.id),children=group?.getLayers?.()||[];
  inventoryFeatures+=entry?.data?.features?.length||0;
  if(entry?.status!=='ready'||entry.data?.meta?.display?.level!=='overview'||!map.hasLayer(group)||children.length!==r.features||JSON.stringify(children.map(c=>String(c.feature?.id)).sort())!==JSON.stringify(r.featureIds)||JSON.stringify(entry.data.features.map(f=>String(f.id)).sort())!==JSON.stringify(r.featureIds))valid=false;
 }
 const featureIds=[...featureLayers.values()].map(c=>String(c.feature?.properties?.plan_id)+':'+String(c.feature?.id)).sort();
 const expected=requests.flatMap(r=>r.featureIds.map(id=>r.id+':'+id)).sort();
 if(JSON.stringify(featureIds)!==JSON.stringify(expected)||inventoryFeatures!==5994)valid=false;
 return {retentionVerified:valid,allPlansRetained:layerMapper.size,retainedFeatureCount:featureLayers.size,inventoryFeatures};
}`;
const bannerFunction=`function bannerVisible(){const el=document.querySelector('#benchmarkReplayBanner');if(!el)return false;const b=el.getBoundingClientRect(),s=getComputedStyle(el);return s.display!=='none'&&s.visibility==='visible'&&Number(s.opacity)>0&&b.width>0&&b.height>0&&b.bottom>0&&b.right>0&&b.top<innerHeight&&b.left<innerWidth&&el.textContent.includes('BENCHMARK REPLAY');}`;

export function checkBrowserScripts(){
 const scripts={preload,retention:retentionFunction,banner:bannerFunction};
 for(const [name,source] of Object.entries(scripts))new Script(source,{filename:'display-benchmark-'+name+'.js'});
 return Object.keys(scripts);
}

async function runBrowser(renderer,index,config){
 const {chrome,scratch,output,base,manifest}=config;
 const runDir=path.join(output,renderer);fs.mkdirSync(runDir,{recursive:true,mode:0o700});
 const profile=fs.mkdtempSync(path.join(scratch,'siap-izin-display-benchmark-'));
 const browser=spawn(chrome,['--headless=new','--no-first-run','--no-default-browser-check','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{stdio:'ignore'});
 let ws,nextId=0,spawnError;browser.on('error',e=>{spawnError=e;});
 const pending=new Map(),network=new Map(),exceptions=[],forbiddenRequests=[];
 function send(method,params={}){const id=++nextId;return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(id);reject(new Error('CDP timeout '+method));},180000);pending.set(id,{resolve:v=>{clearTimeout(timer);resolve(v);},reject:e=>{clearTimeout(timer);reject(e);}});ws.send(JSON.stringify({id,method,params}));});}
 async function evaluate(expression){const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw new Error(JSON.stringify(r.exceptionDetails));return r.result.value;}
 async function waitFor(expression,timeout=120000){const end=Date.now()+timeout;while(Date.now()<end){check(!spawnError,String(spawnError));check(forbiddenRequests.length===0,'Forbidden browser request');if(await evaluate(expression))return;await delay(150);}throw new Error('Timeout '+expression);}
 const save=(name,value)=>fs.writeFileSync(path.join(runDir,name),JSON.stringify(value,null,2)+'\n',{mode:0o600});
 try{
  const portFile=path.join(profile,'DevToolsActivePort');for(let i=0;i<200&&!fs.existsSync(portFile);i++){if(spawnError)throw spawnError;await delay(100);}check(fs.existsSync(portFile),'Fresh isolated Chrome unavailable');
  const port=fs.readFileSync(portFile,'utf8').split('\n')[0],targets=await(await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  ws=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});
  ws.addEventListener('message',event=>{
   const m=JSON.parse(event.data);if(m.id){const p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.reject(new Error(JSON.stringify(m.error))):p.resolve(m.result);}return;}
   const p=m.params;
   if(m.method==='Runtime.exceptionThrown')exceptions.push(p.exceptionDetails.text);
   if(m.method==='Fetch.requestPaused'){forbiddenRequests.push(p.request.url);send('Fetch.failRequest',{requestId:p.requestId,errorReason:'BlockedByClient'}).catch(e=>exceptions.push(String(e)));}
   if(m.method==='Network.requestWillBeSent'){
    const u=new URL(p.request.url);if(u.pathname==='/api/zones'||u.pathname.startsWith('/api/zones/')||/(^|\.)atrbpn\.go\.id$/.test(u.hostname))forbiddenRequests.push(u.href);
    if(u.pathname==='/api/display')network.set(p.requestId,{requestId:p.requestId,id:u.searchParams.get('plan'),url:u.href,start:p.timestamp});
   }
   const n=network.get(p?.requestId);if(!n)return;
   if(m.method==='Network.responseReceived'){n.headers=p.timestamp;n.status=p.response.status;n.timing=p.response.timing;n.responseHeaders=p.response.headers;n.fromDiskCache=p.response.fromDiskCache;n.fromServiceWorker=p.response.fromServiceWorker;}
   if(m.method==='Network.loadingFinished'){n.end=p.timestamp;n.encodedDataLength=p.encodedDataLength;}
   if(m.method==='Network.loadingFailed')n.error=p.errorText;
  });
  await send('Page.enable');await send('Runtime.enable');
  await send('Network.enable',{maxTotalBufferSize:256*1024*1024,maxResourceBufferSize:128*1024*1024});await send('Performance.enable');
  await send('Network.setCacheDisabled',{cacheDisabled:true});await send('Network.setBypassServiceWorker',{bypass:true});
  await send('Network.setExtraHTTPHeaders',{headers:{'Accept-Encoding':'identity'}});
  await send('Network.setBlockedURLs',{urls:['*gistaru.atrbpn.go.id/*','*gistaru-proxy.atrbpn.go.id/*']});
  await send('Fetch.enable',{patterns:[{urlPattern:'*/api/zones*',requestStage:'Request'},{urlPattern:'*://*.atrbpn.go.id/*',requestStage:'Request'}]});
  await send('Emulation.setDeviceMetricsOverride',{width:WIDTH,height:HEIGHT,deviceScaleFactor:1,mobile:false});
  await send('Page.addScriptToEvaluateOnNewDocument',{source:preload});await send('Page.navigate',{url:base});
  await waitFor("typeof catalog!=='undefined'&&catalogState==='ready'");
  check(await evaluate(`(()=>{${bannerFunction}return bannerVisible()&&map===null&&__bench.requests.length===0;})()`),'Visible replay banner missing, requests premature, or map already active');
  await evaluate(`(()=>{
   if(typeof requestViewport!=='function'||typeof drawPlan!=='function'||typeof zoomAll!=='function'||typeof resource!=='function'||!(planRecords instanceof Map)||!(layerMapper instanceof Map)||!(featureLayers instanceof Map))throw new Error('Required display benchmark hooks absent; refusing opt-in');
   requestViewport=function(){__bench.viewportNoopCalls++;};__bench.fixedOverviewHook=true;
   const nativeDraw=drawPlan;drawPlan=function(...args){const data=args[0],t={id:data.meta.plan.id,start:performance.now()};__bench.draws.push(t);try{return nativeDraw.apply(this,args);}finally{t.end=performance.now();requestAnimationFrame(()=>requestAnimationFrame(()=>{t.twoRaf=performance.now();}));}};
   const nativeZoom=zoomAll;zoomAll=function(...args){const start=performance.now();const value=nativeZoom.apply(this,args);__bench.zoomAll={start,end:performance.now()};return value;};
   const nativeResource=resource;resource=async function(...args){const value=await nativeResource.apply(this,args);if(window.L&&!L.__displayBenchHooked){L.__displayBenchHooked=true;const makeMap=L.map;L.map=function(id,options){__bench.mapHookCalls++;return makeMap.call(this,id,{...options,preferCanvas:${renderer==='canvas'}});};}return value;};
   if(!document.querySelector('#loadMap'))throw new Error('Missing opt-in');__bench.optIn=performance.now();document.querySelector('#loadMap').click();
  })()`);
  await waitFor("map!==null&&layerMapper.size===16&&featureLayers.size===5994&&[...planRecords.values()].filter(e=>e.status==='ready').length===16&&__bench.zoomAll&&__bench.draws.length===16&&__bench.draws.every(d=>Number.isFinite(d.twoRaf))",480000);
  await evaluate("new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>{__bench.ready=performance.now();document.querySelector('#map').scrollIntoView({block:'center'});resolve();})))");
  const readyState=await evaluate(`(()=>{${retentionFunction}${bannerFunction}return {bench:__bench,...retention(),bannerVisible:bannerVisible(),preferCanvas:map.options.preferCanvas,mapHookCalls:__bench.mapHookCalls,featureLayers:featureLayers.size,svgPaths:document.querySelectorAll('.leaflet-overlay-pane path').length,canvases:document.querySelectorAll('.leaflet-overlay-pane canvas').length,tileLoaded:document.querySelectorAll('.leaflet-tile-loaded').length,tileTotal:document.querySelectorAll('.leaflet-tile').length,mapStatus:document.querySelector('#mapStatus')?.textContent,mapSize:map.getSize(),viewport:{width:innerWidth,height:innerHeight}};})()`);
  check(readyState.retentionVerified&&readyState.bannerVisible&&readyState.preferCanvas===(renderer==='canvas')&&readyState.mapHookCalls===1&&!readyState.bench.longTaskUnsupported,'Incomplete fixed overview or explicit renderer hook');
  check(renderer==='svg'?readyState.svgPaths===5994&&readyState.canvases===0:readyState.canvases>0&&readyState.svgPaths===0,'Actual Leaflet renderer mismatch');
  check(readyState.bench.requests.length===16&&same(ids(readyState.bench.requests),ids(manifest.plans))&&readyState.bench.requests.every(p=>p.replay&&p.status===200&&p.planId===p.id&&validBounds(p.sourceBounds)),'Incomplete/non-replay overview responses');
  const metrics=Object.fromEntries((await send('Performance.getMetrics')).metrics.map(x=>[x.name,x.value])),heap=await send('Runtime.getHeapUsage');
  const screenshot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(path.join(runDir,`run-${index}-ready.png`),Buffer.from(screenshot.data,'base64'),{mode:0o600});
  const b=readyState.bench,province=unionBounds(b.requests.map(p=>p.sourceBounds));
  const views=[{id:'province',name:'All plans',bounds:province},...manifest.plans.map(s=>({id:s.id,name:s.name,bounds:b.requests.find(p=>p.id===s.id).sourceBounds}))],frameViews=[];
  for(const view of views){
   const result=await evaluate(`(async()=>{
    ${retentionFunction}
    const id=${JSON.stringify(view.id)},bounds=${JSON.stringify(view.bounds)},raf=()=>new Promise(r=>requestAnimationFrame(r));
    const verify=()=>{const r=retention();if(!r.retentionVerified)throw new Error('All 16/5994 overview layers must remain retained '+id);return r;};verify();
    map.stop();map.fitBounds([[bounds[1],bounds[0]],[bounds[3],bounds[2]]],{padding:[28,28],maxZoom:15,animate:false});await raf();await raf();verify();
    const center=map.getCenter(),zoom=map.getZoom(),frames=[],operations=[];let active=true,last=null;
    const tick=t=>{if(last!==null)frames.push(t-last);last=t;if(active)requestAnimationFrame(tick);};requestAnimationFrame(tick);
    const perform=async(name,fn)=>{verify();const start=performance.now();let timeout=false;await new Promise(resolve=>{let done=false;const finish=()=>{if(done)return;done=true;clearTimeout(timer);map.off('moveend',finish);resolve();};const timer=setTimeout(()=>{timeout=true;finish();},3000);map.once('moveend',finish);fn();});await raf();await raf();const durationMs=performance.now()-start;verify();operations.push({name,durationMs,timeout});};
    const start=performance.now();await perform('pan96x64',()=>map.panBy([96,64],{animate:true,duration:.25}));await perform('panInverse',()=>map.panBy([-96,-64],{animate:true,duration:.25}));await perform('zoomPlus1',()=>map.setZoom(zoom+1,{animate:true}));await perform('zoomMinus1',()=>map.setZoom(zoom,{animate:true}));active=false;await raf();
    return {id,start,end:performance.now(),bounds,expectedBounds:bounds,startCenter:{lat:center.lat,lng:center.lng},startZoom:zoom,...verify(),framesMs:frames,operations};
   })()`);
   frameViews.push({...view,...result,frameSummaryMs:summary(result.framesMs),over50Ms:result.framesMs.filter(x=>x>50).length,over33_34Ms:result.framesMs.filter(x=>x>33.34).length});
   check(!result.operations.some(o=>o.timeout),'Frame operation timeout '+view.id);
  }
  await delay(200);const finalBench=await evaluate('__bench');
  check(finalBench.requests.length===16&&finalBench.draws.length===16&&network.size===16&&forbiddenRequests.length===0&&finalBench.forbiddenRequests.length===0,'Viewport refetch / forbidden original API observed');
  const plans=[];
  // Body validation is deliberately AFTER ready/heap/all frame views, in Node, not timed JS.
  for(const r of b.requests){
   const draw=b.draws.find(d=>d.id===r.id),n=[...network.values()].find(n=>n.id===r.id);check(n?.end&&!n.error&&!n.fromDiskCache&&!n.fromServiceWorker,'Missing real network response '+r.id);
   const body=await send('Network.getResponseBody',{requestId:n.requestId}),bytes=body.base64Encoded?Buffer.from(body.body,'base64'):Buffer.from(body.body,'utf8'),payload=JSON.parse(bytes.toString('utf8'));
   check(!r.contentEncoding||r.contentEncoding==='identity','Compressed body cannot be compared to decoded Content-Length');
   check(payload.meta.plan.id===r.id&&payload.features.length===r.features,'Actual body differs from browser metadata');
   const p={...r,httpBodyBytes:r.contentLength,actualBodyBytes:bytes.length,actualVertices:payload.features.reduce((n,f)=>n+vertexCount(f.geometry.coordinates),0),featureHash:hash(payload.features),featureIdsHash:hash(payload.features.map(f=>String(f.id)).sort()),fetchStartToHeadersMs:r.headers-r.start,nativeJsonBodyDecodeParseMs:r.jsonEnd-r.jsonStart,fetchStartToJsonResolvedMs:r.jsonEnd-r.start,drawPlanSyncMs:draw.end-draw.start,drawEndToTwoRafMs:draw.twoRaf-draw.end,requestToLoadingFinishedMs:(n.end-n.start)*1000,network:n};
   delete p.featureIds;validateDisplayPlan(p,manifest.plans.find(s=>s.id===r.id));plans.push(p);
  }
  const longTasks=finalBench.longTasks.filter(t=>t.start>=b.optIn&&t.start<b.ready);
  const result={renderer,index,ready:{optInToReadyMs:b.ready-b.optIn,firstDisplayRequestToReadyMs:b.ready-Math.min(...b.requests.map(r=>r.start)),zoomAllSyncMs:b.zoomAll.end-b.zoomAll.start,longTaskCount:longTasks.length,longTaskTotalMs:sum(longTasks,'duration'),longTaskMaxMs:Math.max(0,...longTasks.map(t=>t.duration)),longTasks,metrics,heap},readyState,plans,frameViews,allLongTasks:finalBench.longTasks,viewportNoopCalls:finalBench.viewportNoopCalls,displayRequestCount:network.size,finalDrawCount:finalBench.draws.length,forbiddenRequests:[...forbiddenRequests,...finalBench.forbiddenRequests],exceptions:[...exceptions,...finalBench.exceptions]};
  save(`run-${index}.json`,result);check(result.exceptions.length===0,'JavaScript exceptions recorded');return result;
 }catch(error){save(`run-${index}-failure.json`,{error:String(error),network:[...network.values()],exceptions,forbiddenRequests});throw error;}
 finally{
  if(ws)ws.close();for(const p of pending.values())p.reject(new Error('Browser run closed'));pending.clear();
  browser.kill('SIGTERM');if(browser.exitCode===null)await Promise.race([new Promise(resolve=>browser.once('exit',resolve)),delay(5000)]);if(browser.exitCode===null)browser.kill('SIGKILL');
  fs.rmSync(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200});
 }
}

function writeReport(data,manifest,output,references){
 validateDisplayComparison(data,manifest);
 const fmt=n=>Number(n).toFixed(2),aggregate=[];
 for(const renderer of ['svg','canvas'])for(const source of manifest.plans){
  const runs=data.runs.filter(r=>r.renderer===renderer),measured=runs.map(r=>r.plans.find(p=>p.id===source.id)),first=measured[0];
  aggregate.push({renderer,id:source.id,name:source.name,sourceFeatureCount:source.features,returnedFeatures:first.features,originalVertices:source.vertices,returnedVertices:first.returnedVertices,originalHttpBodyBytes:source.httpBodyBytes,httpBodyBytes:first.httpBodyBytes,retrievedAt:first.retrievedAt,snapshotId:first.snapshotId,requestMsMedian:median(measured.map(p=>p.requestToLoadingFinishedMs)),jsonBodyDecodeParseMsMedian:median(measured.map(p=>p.nativeJsonBodyDecodeParseMs)),drawSyncMsMedian:median(measured.map(p=>p.drawPlanSyncMs)),twoRafMsMedian:median(measured.map(p=>p.drawEndToTwoRafMs)),rafP95MsMedian:median(runs.map(r=>r.frameViews.find(v=>v.id===source.id).frameSummaryMs.p95))});
 }
 fs.writeFileSync(path.join(output,'per-plan-summary.json'),JSON.stringify(aggregate,null,2)+'\n',{mode:0o600});
 const headers=Object.keys(aggregate[0]),csv=x=>'"'+String(x).replaceAll('"','""')+'"';
 fs.writeFileSync(path.join(output,'per-plan-summary.csv'),headers.join(',')+'\n'+aggregate.map(p=>headers.map(k=>csv(p[k])).join(',')).join('\n')+'\n',{mode:0o600});
 const first=data.runs[0].plans,source=manifest.plans;
 const lines=[`# Map performance — ${MODE}`,'',`**Benchmark-only fixed overview SVG vs Canvas; three fresh isolated Chrome processes per renderer.** Not adaptive viewport LOD, detail, production/source latency, or isolated-plan rendering.`, '',
  `Measured ${data.startedAt} → ${data.finishedAt}; viewport ${WIDTH} × ${HEIGHT}, DPR 1. ${data.environment.chrome}; Node ${data.environment.node}; ${data.environment.platform}/${data.environment.arch}; CPU ${data.environment.cpu}; git ${data.environment.gitHead}. Dirty worktree captured in benchmark-results.json.`,
  '',`Original source: 16 plans, **5994 source features**, ${sum(source,'vertices')} original vertices; ${sum(source,'httpBodyBytes')} original HTTP bytes/run (not display bytes, not cache-file sizes).`,
  `Fixed overview actual: **${sum(first,'features')} returned features, ${sum(first,'returnedVertices')} returned vertices, ${sum(first,'httpBodyBytes')} HTTP body bytes/run**; each Content-Length reconciled with actual CDP response body UTF-8 bytes and actual geometry vertex count. Identical feature geometry/IDs, snapshots, original timestamps and counts verified across all six runs.`,
  'All responses: cached_snapshot / cacheReason=benchmark_replay / meta.benchmarkReplay=true, original retrievedAt unchanged. Visible replay banner verified and captured. Original /api/zones blocked before request; any attempted use fails. Exactly 16 /api/display?level=overview requests without bbox per run; no viewport/detail refetch.',
  '', '## Separate ready, heap and long-task measurements', '', '|Renderer/run|Opt-in → ready ms|First display request → ready ms|zoomAll sync ms|Long tasks|Total LT ms|Max LT ms|Heap used bytes|Heap total bytes|Tiles loaded/total|','|---|---:|---:|---:|---:|---:|---:|---:|---:|---|'];
 for(const r of data.runs)lines.push(`|${r.renderer}/${r.index}|${fmt(r.ready.optInToReadyMs)}|${fmt(r.ready.firstDisplayRequestToReadyMs)}|${fmt(r.ready.zoomAllSyncMs)}|${r.ready.longTaskCount}|${fmt(r.ready.longTaskTotalMs)}|${fmt(r.ready.longTaskMaxMs)}|${r.ready.metrics.JSHeapUsedSize}|${r.ready.metrics.JSHeapTotalSize}|${r.readyState.tileLoaded}/${r.readyState.tileTotal}|`);
 lines.push('', '## Renderer comparison — median of three runs', '', '|Renderer|Opt-in → ready ms|First request → ready ms|Heap used bytes|Ready LT total ms|Province RAF p95 ms|','|---|---:|---:|---:|---:|---:|');
 for(const renderer of ['svg','canvas']){const a=aggregateRunMetrics(data.runs.filter(r=>r.renderer===renderer));lines.push(`|${renderer}|${fmt(a.optInToReadyMs)}|${fmt(a.firstRequestToReadyMs)}|${a.heapUsedBytes}|${fmt(a.longTaskTotalMs)}|${fmt(a.provinceRafP95Ms)}|`);}
 lines.push('', '## Per-plan medians (all 16 retained, three runs per renderer)', '', '|Renderer / plan|Source features|Original vertices|Returned vertices|Actual display HTTP bytes|Request → complete ms|Native JSON* ms|drawPlan sync ms|Draw → 2RAF ms|Focal RAF p95 ms|','|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
 for(const p of aggregate)lines.push(`|${p.renderer} / ${p.name} / ${p.id}|${p.sourceFeatureCount}|${p.originalVertices}|${p.returnedVertices}|${p.httpBodyBytes}|${fmt(p.requestMsMedian)}|${fmt(p.jsonBodyDecodeParseMsMedian)}|${fmt(p.drawSyncMsMedian)}|${fmt(p.twoRafMsMedian)}|${fmt(p.rafP95MsMedian)}|`);
 lines.push('', '## All 17 focal-view RAF distributions', '', '|Renderer/run|View|Samples|P50 ms|P95 ms|Max ms|>50ms|>33.34ms|Plans/features retained|','|---|---|---:|---:|---:|---:|---:|---:|---|');
 for(const r of data.runs)for(const v of r.frameViews)lines.push(`|${r.renderer}/${r.index}|${v.id}|${v.frameSummaryMs.samples}|${fmt(v.frameSummaryMs.median)}|${fmt(v.frameSummaryMs.p95)}|${fmt(v.frameSummaryMs.max)}|${v.over50Ms}|${v.over33_34Ms}|${v.allPlansRetained}/${v.retainedFeatureCount}|`);
 lines.push('', '## Real original-source references (historical, not controlled renderer comparisons)', '',sourceReferenceMarkdown(references), '## Method and interpretation', '',...Object.entries(data.method).map(([k,v])=>`- **${k}**: ${v}`),
  '- *Native Response.json includes remaining download, decode, native parse and promise scheduling. Request/JSON/draw/RAF durations overlap. **Do not add them** or label native JSON as pure parse CPU time.',
  '- Fixed requestViewport no-op is installed only in this benchmark page before opt-in; absent hook fails closed. Production adaptive viewport performance is explicitly NOT measured. Leaflet preferCanvas is explicitly false for SVG and true for Canvas, independently of production defaults.',
  '- Geometry and viewport retention/ID validation adds benchmark-only main-thread overhead; retention checks occur outside draw and operation duration brackets, but the continuous RAF stream can include that overhead. Both renderers use identical checks. Node response-body/vertex/hash reconciliation occurs after all ready/heap/frame measurements.',
  '- Cold isolated browser profiles and disabled HTTP cache do not imply cold backend LOD cache. The replay server is warm for original snapshots; derivative cache can warm between sequential runs. Server is not restarted/cleared by this harness. SVG/Canvas order alternates per round (SVG1, Canvas1, Canvas2, SVG2, SVG3, Canvas3). Record server cold/warm context before causal conclusions.',
  '- Three runs are descriptive, not a statistical significance claim or universal renderer winner. Historical baseline/style changed frontend styles; their timings are context, not pure LOD/SVG-vs-Canvas attribution.',
  '', '## Reproduce after parent integration / replay startup', '', '```sh','# Run from the repository root',`export SIAP_BENCH_OUTPUT=${JSON.stringify(output)}`,`export SIAP_BENCH_URL=${JSON.stringify(data.url)}`,`export SIAP_BENCH_MANIFEST=${JSON.stringify(data.manifestPath)}`,`export SIAP_BENCH_BASELINE=${JSON.stringify(references[0].directory)}`,`export SIAP_BENCH_STYLE=${JSON.stringify(references[1].directory)}`,'node tests/display-performance-benchmark.mjs','# Re-render reports only; no Chrome / API access:','SIAP_BENCH_REPORT_ONLY=1 node tests/display-performance-benchmark.mjs','```','',
  'Private outputs: benchmark-results.json, performance-report.md, per-plan-summary.csv/json, svg/run-N.json, canvas/run-N.json and ready screenshots. No raw source geometry or coordinates are written to the report; bounds and IDs in private run files are benchmark diagnostics.','');
 fs.writeFileSync(path.join(output,'performance-report.md'),lines.join('\n')+'\n',{mode:0o600});
}

async function main(){
 const output=process.env.SIAP_BENCH_OUTPUT;check(output&&path.isAbsolute(output),'SIAP_BENCH_OUTPUT must be an absolute PRIVATE output directory');
 const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),realRepo=fs.realpathSync(repo);
 const referenceDirs=[process.env.SIAP_BENCH_BASELINE||path.join(referenceRoot,'baseline'),process.env.SIAP_BENCH_STYLE||path.join(referenceRoot,'style')];
 for(const protectedDir of [repo,...referenceDirs]){const target=path.resolve(output),protectedPath=path.resolve(protectedDir);check(target!==protectedPath&&!target.startsWith(protectedPath+path.sep),'Do not write inside the repository or real source reference directories');}
 fs.mkdirSync(output,{recursive:true,mode:0o700});const realOutput=fs.realpathSync(output);
 check(realOutput!==realRepo&&!realOutput.startsWith(realRepo+path.sep),'Benchmark outputs must remain outside the repository');
 const baseline=loadSourceReference(referenceDirs[0]),style=loadSourceReference(referenceDirs[1]),references=[baseline,style];
 check(same(sourceIdentity(baseline.manifest),sourceIdentity(style.manifest)),'Real baseline/style snapshots differ');
 for(const r of references){const protectedPath=fs.realpathSync(r.directory);check(realOutput!==protectedPath&&!realOutput.startsWith(protectedPath+path.sep),'Never overwrite real baseline/style output');}
 fs.chmodSync(output,0o700);
 const browserScriptSyntax=checkBrowserScripts();
 if(process.env.SIAP_BENCH_HELPERS_ONLY==='1'){
  fs.writeFileSync(path.join(output,'source-reference-report.md'),sourceReferenceMarkdown(references),{mode:0o600});
  const result={helperOnly:true,displayMeasurementsExecuted:false,browserScriptSyntax,references:references.map(({label,directory,totals,measurements,planCount,runs})=>({label,directory,totals,measurements,planCount,runs}))};
  fs.writeFileSync(path.join(output,'helper-check.json'),JSON.stringify(result,null,2)+'\n',{mode:0o600});console.log(JSON.stringify(result));return;
 }
 check(!process.env.SIAP_BENCH_RUNS||process.env.SIAP_BENCH_RUNS==='3','This comparison requires exactly three runs per renderer');
 check(!process.env.SIAP_BENCH_RENDERER||process.env.SIAP_BENCH_RENDERER==='both','Both explicit SVG and Canvas are required; omit SIAP_BENCH_RENDERER');
 const manifestPath=process.env.SIAP_BENCH_MANIFEST||path.join(output,'replay-manifest.json'),manifest=validateManifest(readJson(manifestPath));
 check(same(sourceIdentity(manifest),sourceIdentity(baseline.manifest)),'Replay must use the exact real original source snapshots/timestamps');
 if(process.env.SIAP_BENCH_REPORT_ONLY==='1'){writeReport(readJson(path.join(output,'benchmark-results.json')),manifest,output,references);console.log('Validated display comparison and regenerated performance-report.md');return;}
 const base=process.env.SIAP_BENCH_URL||manifest.url,url=new URL(base);check(url.protocol==='http:'&&url.hostname==='127.0.0.1'&&url.port&&url.port!=='8765'&&!url.username&&!url.password&&url.pathname==='/prototype/'&&!url.search&&!url.hash,'Use isolated loopback replay /prototype/, never 8765');
 check(new URL(manifest.url).origin===url.origin,'Replay manifest/server origin mismatch');
 check(!fs.existsSync(path.join(output,'benchmark-results.json')),'Output already contains a measurement; use a new private directory or REPORT_ONLY');
 const chrome=process.env.CHROME_BIN||(process.platform==='darwin'?'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome':'chromium'),scratch=process.env.TMPDIR||os.tmpdir();
 const report={schemaVersion:1,mode:MODE,url:base,manifestPath,sourceIdentity:sourceIdentity(manifest),viewport:{width:WIDTH,height:HEIGHT,deviceScaleFactor:1},startedAt:new Date().toISOString(),
  environment:{platform:process.platform,arch:process.arch,node:process.version,cpu:os.cpus()[0]?.model,memoryBytes:os.totalmem(),chrome:execFileSync(chrome,['--version'],{encoding:'utf8'}).trim(),gitHead:execFileSync('git',['rev-parse','HEAD'],{cwd:repo,encoding:'utf8'}).trim(),gitStatus:execFileSync('git',['status','--short'],{cwd:repo,encoding:'utf8'}).trim()},
  method:{runsPerRenderer:RUNS,cache:'Fresh isolated Chrome process/profile per run, network cache disabled, service workers bypassed; no CPU/network throttling. Backend original replay warm; derivative cache state not reset.',request:'fetchStartToHeadersMs measures fetch promise latency; CDP requestToLoadingFinishedMs includes serialization, transfer and browser scheduling. Content-Length reconciled to actual response-body UTF-8 bytes; encodedDataLength separately includes network overhead.',json:'Original native Response.json() timed around await; remaining download + UTF-8 decode + native parse + promise scheduling, NOT pure JSON.parse CPU time.',render:'drawPlanSyncMs wraps original drawPlan synchronously; includes layer construction/insertion, excludes final zoomAll and paint. drawEndToTwoRafMs is a scheduling/paint-opportunity proxy, not exclusive GPU time.',ready:'16 unique replay overview responses without bbox; 5994 source/inventory/display features, 16 retained groups, final zoomAll returned and two RAF callbacks. optInToReady includes Leaflet CDN setup; firstDisplayRequestToReady excludes pre-request setup. Basemap readiness separate.',frames:'17 views: province union + 16 original meta.sourceBounds. Nonanimated fitBounds padding [28,28], maxZoom 15, two RAF settle; animated .25s pan [96,64], inverse pan, zoom +1, zoom -1; moveend + two RAF per operation, 3s timeout fails. All 16 groups/5994 feature IDs checked each view/operation. RAF intervals are main-thread scheduling, not presented GPU FPS.',heap:'Performance JSHeapUsedSize/JSHeapTotalSize and Runtime.getHeapUsage at ready, without forced GC; snapshot not peak.',fixedOverview:'Benchmark-only requestViewport function replacement before opt-in; fail closed if absent. Explicit L.map preferCanvas false/true. Exactly 16 initial API requests/draws, no subsequent viewport requests; identical data verified across renderers.'},runs:[]};
 const save=()=>fs.writeFileSync(path.join(output,'benchmark-results.json'),JSON.stringify(report,null,2)+'\n',{mode:0o600});
 try{
  for(let index=1;index<=RUNS;index++)for(const renderer of index%2?['svg','canvas']:['canvas','svg']){const result=await runBrowser(renderer,index,{base,chrome,scratch,output,manifest});report.runs.push(result);save();console.log(JSON.stringify({renderer,index,mode:MODE,readyMs:result.ready.optInToReadyMs,sourceCount:5994,returnedVertices:sum(result.plans,'returnedVertices'),httpBodyBytes:sum(result.plans,'httpBodyBytes'),views:result.frameViews.length}));}
  report.finishedAt=new Date().toISOString();report.complete=true;validateDisplayComparison(report,manifest);save();writeReport(report,manifest,output,references);
 }catch(error){report.complete=false;report.error=String(error);save();throw error;}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(error=>{console.error(error);process.exitCode=1;});
