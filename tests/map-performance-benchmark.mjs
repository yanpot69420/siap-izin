// Test-only CDP performance harness. No production edits or synthetic geometry.
// SIAP_BENCH_URL=http://127.0.0.1:8767/prototype/ SIAP_BENCH_OUTPUT=/private/output \
// node tests/map-performance-benchmark.mjs
// Optional: SIAP_BENCH_RUNS=3 SIAP_BENCH_RENDERER=svg|canvas CHROME_BIN=...
import {spawn, execFileSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const base=process.env.SIAP_BENCH_URL||'http://127.0.0.1:8767/prototype/';
const output=process.env.SIAP_BENCH_OUTPUT;
if(!output||!path.isAbsolute(output))throw new Error('SIAP_BENCH_OUTPUT must be an absolute private output directory');
const renderer=process.env.SIAP_BENCH_RENDERER||'svg';
const runs=Number(process.env.SIAP_BENCH_RUNS||3);
if(!['svg','canvas'].includes(renderer)||!Number.isInteger(runs)||runs<1)throw new Error('Invalid renderer/runs');
if(new URL(base).hostname!=='127.0.0.1'||new URL(base).port==='8765')throw new Error('Use isolated loopback replay, never 8765');
const chrome=process.env.CHROME_BIN||(process.platform==='darwin'?'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome':'chromium');
const scratch=process.env.TMPDIR||os.tmpdir();
const delay=ms=>new Promise(r=>setTimeout(r,ms));
fs.mkdirSync(output,{recursive:true,mode:0o700});
const save=(name,value)=>fs.writeFileSync(path.join(output,name),JSON.stringify(value,null,2)+'\n');
const percentile=(a,p)=>{const b=[...a].sort((x,y)=>x-y);return b[Math.max(0,Math.ceil(b.length*p)-1)]??null;};
const summary=a=>({samples:a.length,min:Math.min(...a),median:percentile(a,.5),p95:percentile(a,.95),max:Math.max(...a),mean:a.reduce((s,x)=>s+x,0)/a.length});
const report={schemaVersion:1,mode:'benchmark_replay',renderer,viewport:{width:1512,height:1100,deviceScaleFactor:1},startedAt:new Date().toISOString(),
 environment:{platform:process.platform,arch:process.arch,node:process.version,cpu:os.cpus()[0]?.model,memoryBytes:os.totalmem(),chrome:execFileSync(chrome,['--version'],{encoding:'utf8'}).trim(),gitHead:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()},
 method:{runs,cache:'Fresh isolated Chrome profile/process per run; Network cache disabled, no CPU/network throttling. Replay server warm in-memory original snapshots; HTTP serialization remains real.',
 request:'fetchStartToHeadersMs is fetch promise latency. CDP requestToLoadingFinishedMs includes server serialization, transfer and browser event-loop scheduling; Content-Length is actual replay HTTP body, not cache file size.',
 json:'nativeJsonBodyDecodeParseMs times original Response.json(): remaining body download + UTF-8 decode + native JSON parse + promise scheduling. It is NOT a pure JSON.parse CPU measurement.',
 render:'drawPlanSyncMs wraps existing drawPlan, including Leaflet layer construction, SVG projection and insertion at current view; excludes final zoomAll and paint. drawEndToTwoRafMs is a scheduling/paint-opportunity proxy, not exclusive per-plan GPU render time.',
 ready:'All 16 validated collections, all features/layers, final zoomAll returned, then two requestAnimationFrame callbacks. optInToReadyMs includes Leaflet CDN loading; firstZoneRequestToReadyMs excludes pre-request CDN setup. Basemap readiness recorded separately.',
 frames:'All 16 collections retained. For province and each plan focal view, nonanimated fitBounds then settle 2 RAF; pan (96,64), inverse pan, zoom +1, zoom -1. Animated .25s pans; moveend+2RAF per operation; 3s timeout fails. RAF intervals measure browser main-thread scheduling, not compositor presented frames or GPU FPS. Focal views are NOT isolated-plan tests.',
 heap:'CDP Performance JSHeapUsedSize / JSHeapTotalSize at ready without forced GC (snapshot, not peak); Runtime.getHeapUsage also saved. Fresh browser per run.'},runs:[]};

const preload=`(() => {
 window.__bench={requests:[],draws:[],longTasks:[],exceptions:[]};
 try{new PerformanceObserver(list=>{for(const e of list.getEntries())__bench.longTasks.push({start:e.startTime,duration:e.duration});}).observe({type:'longtask',buffered:true});}catch(e){__bench.longTaskUnsupported=String(e);}
 const nativeFetch=window.fetch.bind(window),nativeJson=Response.prototype.json;
 window.fetch=async function(input,options){
  const url=String(input);if(!url.startsWith('/api/zones'))return nativeFetch(input,options);
  const record={id:new URL(url,location.href).searchParams.get('plan'),start:performance.now()};__bench.requests.push(record);
  const response=await nativeFetch(input,options);record.headers=performance.now();record.status=response.status;record.contentLength=Number(response.headers.get('Content-Length'));
  response.json=async function(){record.jsonStart=performance.now();try{const data=await nativeJson.call(response);record.jsonEnd=performance.now();record.replay=data.meta?.benchmarkReplay===true&&data.meta?.source?.status==='cached_snapshot'&&data.meta?.source?.cacheReason==='benchmark_replay';record.retrievedAt=data.meta?.source?.retrievedAt;record.features=data.features?.length;return data;}catch(e){record.error=String(e);throw e;}};
  return response;
 };
 window.addEventListener('error',e=>__bench.exceptions.push(e.message));
})();`;

async function run(index){
 const profile=fs.mkdtempSync(path.join(scratch,'siap-izin-map-benchmark-'));
 const browser=spawn(chrome,['--headless=new','--no-first-run','--no-default-browser-check','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{stdio:'ignore'});
 let ws,nextId=0;const pending=new Map(),network=new Map(),exceptions=[];
 async function send(method,params={}){const id=++nextId;return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(id);reject(new Error('CDP timeout '+method));},180000);pending.set(id,{resolve:v=>{clearTimeout(timer);resolve(v);},reject:e=>{clearTimeout(timer);reject(e);}});ws.send(JSON.stringify({id,method,params}));});}
 async function evaluate(expression){const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw new Error(JSON.stringify(r.exceptionDetails));return r.result.value;}
 async function waitFor(expr,timeout=120000){const end=Date.now()+timeout;while(Date.now()<end){if(await evaluate(expr))return;await delay(150);}throw new Error('Timeout '+expr);}
 try{
  const portFile=path.join(profile,'DevToolsActivePort');for(let i=0;i<200&&!fs.existsSync(portFile);i++)await delay(100);
  if(!fs.existsSync(portFile))throw new Error('Isolated Chrome unavailable');
  const port=fs.readFileSync(portFile,'utf8').split('\n')[0];
  const targets=await(await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  ws=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});
  ws.addEventListener('message',event=>{const m=JSON.parse(event.data);if(m.id){const p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.reject(new Error(JSON.stringify(m.error))):p.resolve(m.result);}return;}
   const p=m.params;
   if(m.method==='Runtime.exceptionThrown')exceptions.push(p.exceptionDetails.text);
   if(m.method==='Network.requestWillBeSent'&&p.request.url.includes('/api/zones?'))network.set(p.requestId,{id:new URL(p.request.url).searchParams.get('plan'),start:p.timestamp});
   const n=network.get(p?.requestId);if(!n)return;
   if(m.method==='Network.responseReceived'){n.headers=p.timestamp;n.status=p.response.status;n.timing=p.response.timing;}
   if(m.method==='Network.loadingFinished'){n.end=p.timestamp;n.encodedDataLength=p.encodedDataLength;}
   if(m.method==='Network.loadingFailed')n.error=p.errorText;
  });
  await send('Page.enable');await send('Runtime.enable');await send('Network.enable');await send('Performance.enable');
  await send('Network.setCacheDisabled',{cacheDisabled:true});
  await send('Network.setBlockedURLs',{urls:['*gistaru.atrbpn.go.id/*','*gistaru-proxy.atrbpn.go.id/*']});
  await send('Emulation.setDeviceMetricsOverride',{width:1512,height:1100,deviceScaleFactor:1,mobile:false});
  await send('Page.addScriptToEvaluateOnNewDocument',{source:preload});
  await send('Page.navigate',{url:base});
  await waitFor("typeof catalog!=='undefined'&&catalogState==='ready'");
  if(!await evaluate("Boolean(document.querySelector('#benchmarkReplayBanner'))&&map===null"))throw new Error('Replay banner missing or map already active');
  await evaluate(`(() => {
   const nativeDraw=drawPlan;drawPlan=function(data){const t={id:data.meta.plan.id,start:performance.now()};__bench.draws.push(t);try{return nativeDraw(data);}finally{t.end=performance.now();requestAnimationFrame(()=>requestAnimationFrame(()=>{t.twoRaf=performance.now();}));}};
   const nativeZoomAll=zoomAll;zoomAll=function(...args){const start=performance.now();const value=nativeZoomAll(...args);__bench.zoomAll={start,end:performance.now()};return value;};
   const originalResource=resource;resource=async function(...args){const value=await originalResource(...args);if(window.L&&!L.__benchHooked){L.__benchHooked=true;const makeMap=L.map;L.map=function(id,options){return makeMap.call(this,id,{...options,${renderer==='canvas'?'preferCanvas:true':''}});};}return value;};
   __bench.optIn=performance.now();document.querySelector('#loadMap').click();
  })()`);
  await waitFor("map!==null&&configuration().overlay.loadedPlanCount===16&&layerMapper.size===16&&__bench.zoomAll&&__bench.draws.length===16",480000);
  await evaluate("new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>{__bench.ready=performance.now();document.querySelector('#map').scrollIntoView({block:'center'});resolve();})))");
  const readyState=await evaluate(`({bench:__bench,overlay:configuration().overlay,featureLayers:featureLayers.size,svgPaths:document.querySelectorAll('.leaflet-overlay-pane path').length,canvases:document.querySelectorAll('.leaflet-overlay-pane canvas').length,tileLoaded:document.querySelectorAll('.leaflet-tile-loaded').length,tileTotal:document.querySelectorAll('.leaflet-tile').length,mapStatus:document.querySelector('#mapStatus').textContent,mapSize:map.getSize(),viewport:{width:innerWidth,height:innerHeight}})`);
  if(readyState.bench.requests.length!==16||new Set(readyState.bench.requests.map(x=>x.id)).size!==16||readyState.bench.requests.some(x=>!x.replay||x.status!==200)||readyState.featureLayers!==readyState.overlay.highlightedFeatureCount)throw new Error('Incomplete or non-replay baseline');
  if(renderer==='svg'&&(readyState.svgPaths!==readyState.featureLayers||readyState.canvases!==0))throw new Error('Expected default SVG');
  const metrics=Object.fromEntries((await send('Performance.getMetrics')).metrics.map(x=>[x.name,x.value]));
  const heap=await send('Runtime.getHeapUsage');
  const screenshot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
  fs.writeFileSync(path.join(output,`run-${index}-ready.png`),Buffer.from(screenshot.data,'base64'));
  const views=await evaluate("[{id:'province',name:'All plans'},...plans.filter(p=>p.activity).map(p=>({id:p.id,name:p.name}))]");
  const frameViews=[];
  for(const view of views){
   const result=await evaluate(`(async()=>{
    const id=${JSON.stringify(view.id)},raf=()=>new Promise(r=>requestAnimationFrame(r));
    map.stop();if(id==='province')map.fitBounds(zoneLayerFeatureGroup.getBounds(),{padding:[28,28],maxZoom:15,animate:false});else map.fitBounds(layerMapper.get(id).getBounds(),{padding:[28,28],maxZoom:15,animate:false});
    await raf();await raf();const center=map.getCenter(),zoom=map.getZoom(),frames=[],operations=[];let active=true,last=null;
    const tick=t=>{if(last!==null)frames.push(t-last);last=t;if(active)requestAnimationFrame(tick);};requestAnimationFrame(tick);
    const perform=async(name,fn)=>{const start=performance.now();let timeout=false;await new Promise(resolve=>{let done=false;const finish=()=>{if(done)return;done=true;clearTimeout(timer);map.off('moveend',finish);resolve();};const timer=setTimeout(()=>{timeout=true;finish();},3000);map.once('moveend',finish);fn();});await raf();await raf();operations.push({name,durationMs:performance.now()-start,timeout});};
    const start=performance.now();await perform('pan96x64',()=>map.panBy([96,64],{animate:true,duration:.25}));await perform('panInverse',()=>map.panBy([-96,-64],{animate:true,duration:.25}));await perform('zoomPlus1',()=>map.setZoom(zoom+1,{animate:true}));await perform('zoomMinus1',()=>map.setZoom(zoom,{animate:true}));active=false;await raf();
    return {id,start,end:performance.now(),startCenter:{lat:center.lat,lng:center.lng},startZoom:zoom,allPlansRetained:layerMapper.size,framesMs:frames,operations};
   })()`);
   frameViews.push({...view,...result,frameSummaryMs:summary(result.framesMs),over50Ms:result.framesMs.filter(x=>x>50).length,over33_34Ms:result.framesMs.filter(x=>x>33.34).length});
   if(result.operations.some(x=>x.timeout))throw new Error(`Frame operation timeout ${view.id}`);
  }
  await delay(200); // Flush PerformanceObserver and CDP events without including this in ready.
  const finalBench=await evaluate('__bench');
  const b=readyState.bench;
  const longTasks=finalBench.longTasks.filter(t=>t.start>=b.optIn&&t.start<b.ready);
  const plans=b.requests.map(r=>{const draw=b.draws.find(d=>d.id===r.id),n=[...network.values()].find(n=>n.id===r.id);return {id:r.id,retrievedAt:r.retrievedAt,features:r.features,httpBodyBytes:r.contentLength,fetchStartToHeadersMs:r.headers-r.start,nativeJsonBodyDecodeParseMs:r.jsonEnd-r.jsonStart,fetchStartToJsonResolvedMs:r.jsonEnd-r.start,drawPlanSyncMs:draw.end-draw.start,drawEndToTwoRafMs:draw.twoRaf-draw.end,requestToLoadingFinishedMs:n?.end?(n.end-n.start)*1000:null,network:n};});
  const result={index,ready:{optInToReadyMs:b.ready-b.optIn,firstZoneRequestToReadyMs:b.ready-Math.min(...b.requests.map(r=>r.start)),zoomAllSyncMs:b.zoomAll.end-b.zoomAll.start,longTaskCount:longTasks.length,longTaskTotalMs:longTasks.reduce((s,t)=>s+t.duration,0),longTaskMaxMs:Math.max(0,...longTasks.map(t=>t.duration)),longTasks,metrics,heap},readyState,plans,frameViews,allLongTasks:finalBench.longTasks,exceptions:[...exceptions,...finalBench.exceptions]};
  save(`run-${index}.json`,result);
  if(result.exceptions.length)throw new Error('JavaScript exceptions recorded');
  return result;
 }catch(error){save(`run-${index}-failure.json`,{error:String(error),network:[...network.values()],exceptions});throw error;}
 finally{if(ws)ws.close();browser.kill('SIGTERM');await Promise.race([new Promise(resolve=>browser.once('exit',resolve)),delay(5000)]);if(browser.exitCode===null)browser.kill('SIGKILL');fs.rmSync(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200});}
}
function writeReport(data){
 const manifest=JSON.parse(fs.readFileSync(process.env.SIAP_BENCH_MANIFEST||path.join(output,'replay-manifest.json'),'utf8'));
 const source=manifest.plans;
 if(!data.complete||data.runs.length!==runs||source.length!==16||data.runs.some(r=>r.plans.length!==16||r.frameViews.length!==17))throw new Error('Report requires all requested runs/plans/views');
 const total=key=>source.reduce((s,p)=>s+p[key],0),med=values=>percentile(values,.5),fmt=n=>Number(n).toFixed(2);
 for(const run of data.runs)for(const p of run.plans){const s=source.find(x=>x.id===p.id);if(!s||p.httpBodyBytes!==s.httpBodyBytes||p.features!==s.features||p.retrievedAt!==s.retrievedAt||!p.network?.end)throw new Error('HTTP/source reconciliation failed '+p.id);}
 const aggregate=source.map(s=>{const measured=data.runs.map(r=>r.plans.find(p=>p.id===s.id)),frames=data.runs.map(r=>r.frameViews.find(v=>v.id===s.id));return {...s,requestMsMedian:med(measured.map(p=>p.requestToLoadingFinishedMs)),jsonBodyDecodeParseMsMedian:med(measured.map(p=>p.nativeJsonBodyDecodeParseMs)),drawSyncMsMedian:med(measured.map(p=>p.drawPlanSyncMs)),rafP95MsMedian:med(frames.map(v=>v.frameSummaryMs.p95)),rafMaxMs:Math.max(...frames.map(v=>v.frameSummaryMs.max))};});
 save('per-plan-summary.json',aggregate);
 const headers=['id','name','features','quarantined','vertices','cacheFileBytes','httpBodyBytes','retrievedAt','requestMsMedian','jsonBodyDecodeParseMsMedian','drawSyncMsMedian','rafP95MsMedian','rafMaxMs'];
 const csvCell=x=>'"'+String(x).replaceAll('"','""')+'"';
 fs.writeFileSync(path.join(output,'per-plan-summary.csv'),headers.join(',')+'\n'+aggregate.map(p=>headers.map(k=>csvCell(p[k])).join(',')).join('\n')+'\n');
 const lines=[`# Baseline peta — ${data.renderer.toUpperCase()} / benchmark_replay`,'',`Git: ${data.environment.gitHead}; ${data.environment.chrome}; Node ${data.environment.node}; ${data.environment.platform}/${data.environment.arch}; CPU ${data.environment.cpu}.`,
  `Pengukuran: ${data.startedAt} sampai ${data.finishedAt}; ${runs} proses/profil Chrome terisolasi; viewport 1512 × 1100, DPR 1; renderer ${data.renderer}.`,
  '',`Sumber asli: ${source.length} rencana, ${total('features')} fitur valid, ${total('quarantined')} karantina, ${total('vertices')} vertex (penutup ring ikut dihitung).`,
  `Berkas cache: ${total('cacheFileBytes')} byte. **HTTP body aktual: ${total('httpBodyBytes')} byte per run**, hasil rekonsiliasi Content-Length 16 respons; bukan ukuran berkas cache.`,
  'Semua respons berstatus cached_snapshot, cacheReason=benchmark_replay, meta.benchmarkReplay=true; retrievedAt asli tidak diubah. Tidak ada permintaan geometri ke GISTARU. Banner test terlihat. Backend/frontend produksi dan TTL tidak diubah.',
  '', '## Ready, long tasks, heap', '', '|Run|Opt-in → ready ms|Request pertama → ready ms|zoomAll sync ms|Long tasks ≥50ms|Total LT ms|Max LT ms|JS heap used byte|JS heap total byte|Basemap tile loaded/total saat ready|', '|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|'];
 for(const r of data.runs)lines.push(`|${r.index}|${fmt(r.ready.optInToReadyMs)}|${fmt(r.ready.firstZoneRequestToReadyMs)}|${fmt(r.ready.zoomAllSyncMs)}|${r.ready.longTaskCount}|${fmt(r.ready.longTaskTotalMs)}|${fmt(r.ready.longTaskMaxMs)}|${r.ready.metrics.JSHeapUsedSize}|${r.ready.metrics.JSHeapTotalSize}|${r.readyState.tileLoaded}/${r.readyState.tileTotal}|`);
 lines.push('', `## Per rencana — median ${runs} run (ms)`, '', '|Rencana / ID|Fitur|Vertex|HTTP byte|Request → body selesai|Native JSON*|drawPlan sync**|Focal-view RAF p95***|', '|---|---:|---:|---:|---:|---:|---:|---:|');
 for(const p of aggregate)lines.push(`|${p.name} / ${p.id}|${p.features}|${p.vertices}|${p.httpBodyBytes}|${fmt(p.requestMsMedian)}|${fmt(p.jsonBodyDecodeParseMsMedian)}|${fmt(p.drawSyncMsMedian)}|${fmt(p.rafP95MsMedian)}|`);
 lines.push('', '## Pan/zoom focal-view seluruh provinsi', '', '|Run|Sampel RAF|P50 ms|P95 ms|Max ms|Interval >50ms|', '|---:|---:|---:|---:|---:|---:|');
 for(const r of data.runs){const v=r.frameViews.find(v=>v.id==='province'),f=v.frameSummaryMs;lines.push(`|${r.index}|${f.samples}|${fmt(f.median)}|${fmt(f.p95)}|${fmt(f.max)}|${v.over50Ms}|`);}
 lines.push('', '## Batas interpretasi', '', ...Object.entries(data.method).filter(([k])=>k!=='runs').map(([k,v])=>`- **${k}**: ${v}`),
  '- *Native JSON mencakup sisa transfer body, decoding, parsing native dan scheduling; bukan waktu CPU JSON.parse murni. Durasi request/JSON/render tumpang tindih; jangan dijumlahkan.',
  '- **drawPlan sync bukan seluruh waktu frame atau paint; proyeksi ulang final zoomAll diukur terpisah, dan Long Tasks meliputi pekerjaan main thread lain. Heap adalah snapshot tanpa forced GC, bukan peak memory.',
  '- ***Semua 16 layer tetap dimuat ketika focal-view per rencana diukur. RAF bukan presented-frame/GPU FPS. P95 tabel adalah median p95 tiap run; seluruh sampel mentah, operasi, pusat dan zoom tersimpan di run-N.json.',
  '- Geometri siap tidak berarti semua raster tile selesai. CDN Leaflet dan tile OSM memakai jaringan aktual; opt-in-to-ready dapat berbeda karena CDN. Ini benchmark replay lokal, bukan latensi sumber GISTARU/produksi.',
  '- Satu renderer saja diukur pada sesi ini; tidak menetapkan pemenang SVG/Canvas.',
  '', '## Reproduksi', '', '```sh', 'cd /Users/mac/Projects/siap-izin', `OUT=${output}`, '/Users/mac/.hermes/cache/scratch/siap-izin-geo-venv/bin/python tests/map-performance-replay.py --port 8767 --manifest "$OUT/replay-manifest.json"', '# Terminal kedua:', `OUT=${output}`, 'SIAP_BENCH_OUTPUT="$OUT" SIAP_BENCH_RUNS=3 SIAP_BENCH_RENDERER=svg node tests/map-performance-benchmark.mjs', '# Regenerasi laporan tanpa mengukur ulang:', 'SIAP_BENCH_OUTPUT="$OUT" SIAP_BENCH_REPORT_ONLY=1 node tests/map-performance-benchmark.mjs', '```', '', 'Output: benchmark-results.json, run-1.json … run-3.json, replay-manifest.json (SHA-256 snapshot/waktu asli), per-plan-summary.csv/json, run-N-ready.png. Tidak memuat koordinat/geometry sumber di laporan.');
 fs.writeFileSync(path.join(output,'baseline-report.md'),lines.join('\n')+'\n');
}
try{
 if(process.env.SIAP_BENCH_REPORT_ONLY==='1'){
  writeReport(JSON.parse(fs.readFileSync(path.join(output,'benchmark-results.json'),'utf8')));
 }else{
 for(let index=1;index<=runs;index++){const result=await run(index);report.runs.push(result);save('benchmark-results.json',report);console.log(JSON.stringify({run:index,readyMs:result.ready.optInToReadyMs,features:result.readyState.featureLayers,frameViews:result.frameViews.length,heapUsedBytes:result.ready.metrics.JSHeapUsedSize}));}
 if(report.runs.length!==runs||report.runs.some(r=>r.plans.length!==16||r.frameViews.length!==17))throw new Error('Incomplete measurement count');
 report.finishedAt=new Date().toISOString();report.complete=true;save('benchmark-results.json',report);writeReport(report);
 }
}catch(error){if(process.env.SIAP_BENCH_REPORT_ONLY!=='1'){report.complete=false;report.error=String(error);save('benchmark-results.json',report);}console.error(error);process.exitCode=1;}
