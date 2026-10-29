'use strict';
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./zone-data.js'),require('./province-data.js'),require('./local-dataset.js'));else root.DisplayData=factory(root.ZoneData,root.ProvinceData,root.LocalDataset);})(globalThis,(ZoneData,ProvinceData,LocalDataset)=>{
 const fail=()=>{throw new Error('Kontrak tampilan tidak valid atau konteks/snapshot berubah.');};
 const record=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
 const integer=x=>Number.isSafeInteger(x)&&x>=0;
 const snapshot=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
 const same=(a,b)=>a===b||(Array.isArray(a)&&Array.isArray(b)?a.length===b.length&&a.every((v,i)=>same(v,b[i])):record(a)&&record(b)&&Object.keys(a).length===Object.keys(b).length&&Object.keys(a).every(k=>Object.hasOwn(b,k)&&same(a[k],b[k])));
 const levels={overview:100,regional:10,detail:1};
 function bounds(b){return Array.isArray(b)&&b.length===4&&b.every(Number.isFinite)&&b[0]>=-180&&b[2]<=180&&b[1]>=-90&&b[3]<=90&&b[0]<b[2]&&b[1]<b[3];}
 function intersects(a,b){return bounds(a)&&bounds(b)&&a[0]<=b[2]&&a[2]>=b[0]&&a[1]<=b[3]&&a[3]>=b[1];}
 function contains(a,b){return bounds(a)&&bounds(b)&&a[0]<=b[0]&&a[1]<=b[1]&&a[2]>=b[2]&&a[3]>=b[3];}
 function counts(c){if(!record(c)||!['matched','returned','excludedInvalid'].every(k=>integer(c[k]))||c.matched!==c.returned+c.excludedInvalid)fail();return {matched:c.matched,returned:c.returned,excludedInvalid:c.excludedInvalid};}
 function validateCollection(data,plan,kbli,{level,bbox=null,inventory=null}={}){
  if(!Object.hasOwn(levels,level)||bbox!==null&&!bounds(bbox)||!record(data)||!record(data.meta)||!Array.isArray(data.features))fail();
  const m=data.meta,d=m.display,c=counts(m.sourceCounts),alias=counts(m.counts);
  if(LocalDataset?.validateMetadata(m,plan))LocalDataset.validateFeatures(data);
  if(!same(c,alias)||!snapshot(m.snapshotId)||!record(d)||d.algorithmVersion!=='coverage-lod-v1'||d.purpose!=='display-only-not-analysis-or-export'||d.level!==level||d.toleranceMeters!==levels[level]||!same(d.bbox,bbox)||d.sourceFeatureCount!==c.returned||d.returnedFeatureCount!==data.features.length||data.features.length>c.returned||!integer(d.originalVertices)||!integer(d.returnedVertices)||d.returnedVertices>d.originalVertices||d.returnedVertices>2000000||!record(d.validation)||d.validation.featureIdsPreserved!==true||d.validation.geometryValid!==true||![true,false,null].includes(d.validation.coverageValid))fail();
  if(c.returned===0){if(c.matched!==0||c.excludedInvalid!==0||d.method!=='original_preserved'||d.fallbackReason!==null||d.validation.coverageValid!==null)fail();}
  if(d.method==='coverage_simplify'){if(d.fallbackReason!==null||d.validation.coverageValid!==true)fail();}
  else if(d.method==='original_preserved'){const empty=c.returned===0&&d.originalVertices===0&&d.returnedVertices===0&&d.validation.coverageValid===null&&d.fallbackReason===null;if(!empty&&!['coverage_invalid','quality_validation_failed'].includes(d.fallbackReason))fail();}
  else fail();
  if(c.returned>20000||d.originalVertices>2000000||d.originalVertices<c.returned*4||c.returned===0&&d.originalVertices!==0||d.method==='original_preserved'&&bbox===null&&d.originalVertices!==d.returnedVertices)fail();
  if(c.returned===0?m.sourceBounds!==null:!bounds(m.sourceBounds))fail();
  if(bbox===null&&data.features.length!==c.returned)fail();
  const allowed=['object_id','plan_id','zone_name','zone_code','zone_group','subzone_name','filter_value','activity_id','activity_name','permission','evidence_status','source_bounds'];
  let vertices=0;const sourceUnion=[Infinity,Infinity,-Infinity,-Infinity];
  for(const f of data.features){
   const p=f?.properties;if(!record(p)||Object.keys(p).some(k=>!allowed.includes(k))||allowed.some(k=>!Object.hasOwn(p,k))||p.subzone_name!==null&&typeof p.subzone_name!=='string'||!bounds(p.source_bounds)||!contains(m.sourceBounds,p.source_bounds)||bbox&&!intersects(p.source_bounds,bbox))fail();
   for(let i=0;i<4;i++)sourceUnion[i]=i<2?Math.min(sourceUnion[i],p.source_bounds[i]):Math.max(sourceUnion[i],p.source_bounds[i]);
   function walk(x){if(!Array.isArray(x))fail();if(typeof x[0]==='number'){vertices++;if(x.length!==2||!x.every(Number.isFinite)||x[0]<p.source_bounds[0]-1e-8||x[0]>p.source_bounds[2]+1e-8||x[1]<p.source_bounds[1]-1e-8||x[1]>p.source_bounds[3]+1e-8)fail();}else x.forEach(walk);}
   walk(f.geometry?.coordinates);
  }
  if(vertices!==d.returnedVertices||bbox===null&&c.returned>0&&!same(sourceUnion,m.sourceBounds))fail();
  // Reuse the existing provenance/context and bounded polygon validator without
  // changing the source counts or copying source geometry into export state.
  ZoneData.validateCollection({...data,features:data.features.map(f=>({...f,properties:{...f.properties,regulation:null}})),meta:{...m,counts:{matched:data.features.length+c.excludedInvalid,returned:data.features.length,excludedInvalid:c.excludedInvalid}}},plan.id,kbli,plan);
  if(inventory){
   const original=inventory.meta;
   if(LocalDataset)LocalDataset.validateMetadata(original,plan);
   if(plan.localDataset&&!same(m.source,original.source))fail();
   if(m.snapshotId!==original.snapshotId||d.originalVertices!==original.display.originalVertices||!same(c,counts(original.sourceCounts))||!same(m.sourceBounds,original.sourceBounds)||!same(m.filterZoneCodes,original.filterZoneCodes))fail();
   const byId=new Map(inventory.features.map(f=>[f.id,f]));
   for(const f of data.features)if(!byId.has(f.id)||!same(f.properties,byId.get(f.id).properties))fail();
   // Envelope overlap is necessary, not sufficient, for original geometry
   // intersection. Only fully contained envelopes guarantee inclusion here.
   if(bbox){const returned=new Set(data.features.map(f=>f.id));if(inventory.features.some(f=>contains(bbox,f.properties.source_bounds)&&!returned.has(f.id)))fail();}
  }
  return data;
 }
 function validateDetail(value,plan,kbli,feature,inventory){
  if(!record(value)||Object.keys(value).some(k=>!['schemaVersion','planId','objectId','snapshotId','properties','sourceBounds','meta'].includes(k))||value.schemaVersion!==1||value.planId!==plan.id||value.objectId!==feature.id||value.snapshotId!==inventory.meta.snapshotId||!snapshot(value.snapshotId)||!same(value.sourceBounds,feature.properties.source_bounds)||!record(value.properties)||!record(value.meta)||!same(counts(value.meta.sourceCounts),counts(inventory.meta.sourceCounts))||!same(counts(value.meta.counts),counts(inventory.meta.counts)))fail();
  const propertyKeys=['object_id','plan_id','zone_name','zone_code','zone_group','subzone_name','filter_value','activity_id','activity_name','permission','evidence_status','regulation','source_bounds'];
  if(Object.keys(value.properties).some(k=>!propertyKeys.includes(k))||Object.hasOwn(value.properties,'source_bounds')&&!same(value.properties.source_bounds,feature.properties.source_bounds))fail();
  for(const [key,val] of Object.entries(feature.properties))if(key!=='source_bounds'&&!same(key==='subzone_name'?(value.properties[key]??null):value.properties[key],val))fail();
  const m=value.meta;
  if(LocalDataset){LocalDataset.validateMetadata(inventory.meta,plan);LocalDataset.validateMetadata(m,plan);}
  if(plan.localDataset&&!same(m.source,inventory.meta.source))fail();
  if(m.snapshotId!==undefined&&m.snapshotId!==value.snapshotId)fail();
  if(!same(m.filterZoneCodes,inventory.meta.filterZoneCodes)||!same(m.limitations,inventory.meta.limitations)||Object.hasOwn(m,'sourceBounds')&&!same(m.sourceBounds,inventory.meta.sourceBounds))fail();
  ZoneData.validateCollection({type:'FeatureCollection',features:[{...feature,properties:{...value.properties,regulation:value.properties.regulation??null}}],meta:{...m,counts:{matched:1,returned:1,excludedInvalid:0}}},plan.id,kbli,plan);
  return value;
 }
 function createTransport({fetchImpl=globalThis.fetch,timeoutMs=120000}={}){
  let active=0;const queue=[];
  function pump(){while(active<3&&queue.length){const job=queue.shift();job.cleanup();if(job.signal.aborted){job.reject(new Error('aborted'));continue;}active++;job.run().then(job.resolve,job.reject).finally(()=>{active--;pump();});}}
  function json(url,{signal}){return new Promise((resolve,reject)=>{
   if(signal.aborted){reject(new Error('aborted'));return;}
   const onQueuedAbort=()=>{const index=queue.indexOf(job);if(index<0)return;queue.splice(index,1);job.cleanup();reject(new Error('aborted'));};
   const job={signal,resolve,reject,cleanup:()=>signal.removeEventListener('abort',onQueuedAbort),run:async()=>{
    const controller=new AbortController();let timedOut=false;
    let rejectAbort;const aborted=new Promise((_,reject)=>{rejectAbort=reject;});
    const cancel=()=>controller.abort();const onAbort=()=>rejectAbort(new Error(timedOut?'timeout':'aborted'));
    signal.addEventListener('abort',cancel,{once:true});controller.signal.addEventListener('abort',onAbort,{once:true});
    const timer=setTimeout(()=>{timedOut=true;controller.abort();},timeoutMs);
    try{return await Promise.race([(async()=>{const response=await fetchImpl(url,{signal:controller.signal,cache:'no-store'});if(!response.ok)throw new Error(response.status===409?'snapshot_changed':response.status===422?'unavailable':`http_${response.status}`);return response.json();})(),aborted]);}
    finally{clearTimeout(timer);signal.removeEventListener('abort',cancel);controller.signal.removeEventListener('abort',onAbort);}
   }};
   signal.addEventListener('abort',onQueuedAbort,{once:true});queue.push(job);pump();
  });}
  return {json};
 }
 function createLoader({fetchImpl,transport,onUpdate=()=>{},timeoutMs=120000,batchOverview=false,reuseContainedOverview=false}={}){
  // A caller-supplied transport lets viewport and detail share the same ceiling.
  transport=transport||createTransport({fetchImpl,timeoutMs});
  let revision=0;const controllers=new Set();
  function cancel(){revision++;for(const c of controllers)c.abort();controllers.clear();}
  async function start(plans,kbli,{level='overview',bbox=null,inventories=null}={}){
   cancel();if(!LocalDataset&&plans.some(p=>p.localDataset!==undefined))throw new Error('Helper dataset lokal tidak tersedia.');
   plans=LocalDataset?LocalDataset.capturePlans(plans,kbli):plans;const current=revision,queue=plans.filter(p=>LocalDataset?LocalDataset.canRequest(p):p.activity),records=new Map(plans.map(p=>[p.id,LocalDataset?LocalDataset.initialRecord(p):{status:p.activity?'loading':'unavailable'}]));let next=0;
   // Only a wholly contained ORIGINAL source envelope proves that every source
   // polygon is in this viewport. Reuse the actual pinned collection unchanged;
   // never synthesize a response or change its null overview query bbox.
   if((typeof reuseContainedOverview==='function'?reuseContainedOverview():reuseContainedOverview)===true&&level==='overview'&&bbox!==null){
    for(let i=queue.length-1;i>=0;i--){const p=queue[i],entry=inventories?.get(p.id);
     if(!p.localDataset?.available||entry?.status!=='ready'||!contains(bbox,entry.data?.meta?.sourceBounds))continue;
     try{validateCollection(entry.data,p,kbli,{level:'overview'});records.set(p.id,{status:'ready',data:entry.data,origin:'inventory_contained'});}
     catch{records.set(p.id,{status:'error',error:'inventory_invalid'});}
     queue.splice(i,1);
    }
   }
   const publish=()=>{if(current===revision)onUpdate(records);};
   if((typeof batchOverview==='function'?batchOverview():batchOverview)===true&&level==='overview'&&bbox===null){
    if(!LocalDataset||queue.length>16||new Set(plans.map(p=>p.id)).size!==plans.length||queue.some(p=>!p.localDataset?.available))fail();
    if(!queue.length){publish();return records;}
    const releaseHash=queue[0].localDataset.releaseHash,controller=new AbortController();controllers.add(controller);
    try{
     const value=await transport.json(`/api/display-batch?kbli=${kbli}&level=overview&release=${releaseHash}&plans=${queue.map(p=>p.id).join(',')}`,{signal:controller.signal});
     if(current!==revision)return records;
     if(!record(value)||Object.keys(value).sort().join(',')!=='releaseHash,results,schemaVersion'||value.schemaVersion!==1||value.releaseHash!==releaseHash||!Array.isArray(value.results)||value.results.length!==queue.length)fail();
     const validated=value.results.map((item,i)=>{
      if(!record(item)||item.planId!==queue[i].id)fail();
      if(Object.hasOwn(item,'error')){const e=item.error;if(Object.keys(item).sort().join(',')!=='error,planId'||!record(e)||Object.keys(e).sort().join(',')!=='code,status'||typeof e.code!=='string'||!/^[a-z][a-z0-9_]{0,63}$/.test(e.code)||!Number.isInteger(e.status)||e.status<400||e.status>599)fail();return {status:e.status===422?'unavailable':'error',error:e.code};}
      if(Object.keys(item).sort().join(',')!=='data,planId')fail();
      return {status:'ready',data:validateCollection(item.data,queue[i],kbli,{level:'overview'})};
     });
     if(current===revision)validated.forEach((entry,i)=>records.set(queue[i].id,entry));
    }catch(e){if(current===revision)queue.forEach(p=>records.set(p.id,{status:'error',error:e.message}));}
    finally{controllers.delete(controller);}publish();return records;
   }
   publish();
   async function worker(){while(current===revision&&next<queue.length){const p=queue[next++],controller=new AbortController();controllers.add(controller);
    try{const value=await transport.json(`/api/display?plan=${p.id}&kbli=${kbli}&level=${level}${bbox?'&bbox='+bbox.join(','):''}${LocalDataset?LocalDataset.releaseQuery(p):''}`,{signal:controller.signal});
     const inventory=inventories?.get(p.id)?.data||null;
     if(inventory&&snapshot(value?.meta?.snapshotId)&&value.meta.snapshotId!==inventory.meta.snapshotId)throw new Error('snapshot_changed');
     const data=validateCollection(value,p,kbli,{level,bbox,inventory});if(current===revision)records.set(p.id,{status:'ready',data});
    }catch(e){if(current===revision)records.set(p.id,{status:e.message==='unavailable'?'unavailable':'error',error:e.message});}
    finally{controllers.delete(controller);}publish();
   }}
   await Promise.all(Array.from({length:Math.min(3,queue.length)},worker));return records;
  }
  return {start,cancel};
 }
 function viewportPlans(plans,inventories,bbox){if(!bounds(bbox))fail();return plans.filter(p=>inventories.get(p.id)?.status==='ready'&&intersects(inventories.get(p.id).data.meta.sourceBounds,bbox));}
 function createDetailLoader({fetchImpl,transport,timeoutMs=20000}={}){
  transport=transport||createTransport({fetchImpl,timeoutMs});let revision=0,controller=null;
  function cancel(){revision++;controller?.abort();controller=null;}
  async function start(plan,kbli,feature,inventory){
   cancel();if(!LocalDataset&&plan.localDataset!==undefined)fail();
   plan=LocalDataset?LocalDataset.capturePlans([plan],kbli)[0]:plan;
   if(!integer(feature?.id)||!snapshot(inventory?.meta?.snapshotId))fail();
   if(LocalDataset)LocalDataset.validateMetadata(inventory.meta,plan);
   const current=revision;controller=new AbortController();
   try{const value=await transport.json(`/api/feature-detail?plan=${plan.id}&kbli=${kbli}&objectId=${feature.id}&snapshot=${inventory.meta.snapshotId}${LocalDataset?LocalDataset.releaseQuery(plan):''}`,{signal:controller.signal});if(current!==revision)return null;return validateDetail(value,plan,kbli,feature,inventory);}
   catch(e){if(current!==revision)return null;throw e;}finally{if(current===revision)controller=null;}
  }
  return {start,cancel};
 }
 function configuration(catalog,entries,applied,records,active,catalogState='idle',viewport={state:'idle',level:'overview',records:new Map(),renderer:'svg'}){
  const result=ProvinceData.configuration(catalog,entries,applied,records,active,catalogState),s=result.overlay;
  const drawn=[...(viewport.records||new Map()).values()].filter(e=>e.status==='ready'),failed=[...(viewport.records||new Map()).values()].filter(e=>e.reason!=='not_in_release'&&(e.status==='error'||e.status==='unavailable'));
  const drawnCount=drawn.reduce((n,e)=>n+e.data.features.length,0),loadedCount=s.highlightedFeatureCount;
  result.overlay={state:s.state,requestedPlanCount:s.requestedPlanCount,loadedPlanCount:s.loadedPlanCount,failedPlanCount:s.failedPlanCount,unmappedPlanCount:s.unmappedPlanCount,notListedRegionCount:s.notListedRegionCount,notImportedPlanCount:s.notImportedPlanCount||0,highlightedFeatureCount:loadedCount,mappingReviewed:false,catalogPlanCount:catalog?catalog.plans.filter(p=>applied.regions.includes(p.regionId)).length:null,availableFeatureCount:catalog&&s.requestedPlanCount>0&&s.loadedPlanCount===s.requestedPlanCount?loadedCount:null,loadedFeatureCount:loadedCount,drawnFeatureCount:drawnCount,renderer:viewport.renderer==='canvas'?'canvas':'svg',viewport:{state:['idle','loading','ready','partial','unavailable','error','reload-required'].includes(viewport.state)?viewport.state:'error',level:Object.hasOwn(levels,viewport.level)?viewport.level:'overview',requestedPlanCount:viewport.records?.size||0,loadedPlanCount:drawn.length,failedPlanCount:failed.length,drawnFeatureCount:drawnCount,coverage:'loaded-plan-matching-zones-only-not-evaluated-outside-polygons'},plans:s.plans.map(p=>({planId:p.planId,status:p.status,...(p.reason==='not_in_release'?{reason:p.reason}:{}),...(p.dataset?{dataset:{...p.dataset},snapshotId:p.snapshotId}:{}),source:p.source?{status:p.source.status,retrievedAt:p.source.retrievedAt}:null,...(p.counts?{counts:counts(p.counts)}:{})}))};
  return JSON.parse(JSON.stringify(result));
 }
 return {validateCollection,validateDetail,bounds,intersects,createTransport,createLoader,viewportPlans,createDetailLoader,configuration};
});
