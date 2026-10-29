'use strict';
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./local-dataset.js'));else root.ProvinceData=factory(root.LocalDataset);})(globalThis,LocalDataset=>{
 const record=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
 const short=x=>typeof x==='string'&&x.trim().length>0&&x.length<=4000;
 const timestamp=x=>typeof x==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(x)&&Number.isFinite(Date.parse(x));
 function validateCatalog(data,entries,kbli){
  const fail=()=>{throw new Error('Katalog lokal tidak valid atau identitas wilayah tidak cocok.');};
  if(!record(data)||data.schemaVersion!==1||kbli!=='01273'||data.kbli!==kbli||data.sourceStatus!=='curated_source_snapshot'||!timestamp(data.checkedAt)||!record(data.province)||data.province.id!=='7400000000'||data.province.name!=='Sulawesi Tenggara'||data.citiesUrl!=='https://gistaru.atrbpn.go.id/rdtrinteraktif/api/interactive/cities/7400000000'||!Array.isArray(data.regions)||!Array.isArray(data.plans)||!Array.isArray(entries)||data.regions.length!==entries.length||data.plans.length>100)fail();
  const known=new Map(entries.map(r=>[r.id,r])),regions=new Map(),plans=new Map();
  if(known.size!==entries.length)fail();
  for(const r of data.regions){
   if(!record(r)||!known.has(r.id)||regions.has(r.id))fail();
   const expected=known.get(r.id);
   for(const key of ['name','type','idNamespace','gistaruId'])if(r[key]!==expected[key])fail();
   if(!Array.isArray(r.planIds)||r.planIds.some(id=>typeof id!=='string')||new Set(r.planIds).size!==r.planIds.length||r.catalogStatus!==(r.planIds.length?'listed':'not_listed_in_public_catalog'))fail();
   regions.set(r.id,r);
  }
  for(const p of data.plans){
   if(!record(p)||!short(p.id)||!/^74\d{8}:\d{3}$/.test(p.id)||plans.has(p.id)||!regions.has(p.regionId)||p.id!==p.regionId+':'+p.rtr||!short(p.name)||!['KODSZN','KODUNK'].includes(p.filterField)||!Number.isSafeInteger(p.sublayer)||p.sublayer<0||![4326,32749,32751].includes(p.nativeWkid)||!Number.isSafeInteger(p.sourceStatus))fail();
   const base='https://gistaru.atrbpn.go.id/rdtrinteraktif/api/interactive/';
   if(p.catalogUrl!==base+'rdtr/'+p.regionId||p.activitiesUrl!==base+'activities?id_wilayah='+p.regionId+'&id_rtr='+p.rtr||! /^(?:071_RDTR_PROVINSI_SULAWESI_TENGGARA|PARKIRAN)\/[A-Za-z0-9_]+\/MapServer$/.test(p.servicePath))fail();
   if(p.activity===null){if(p.mappingStatus!=='activity_mapping_unavailable')fail();}
   else if(!record(p.activity)||!/^\d{3}$/.test(p.activity.id)||!short(p.activity.name)||p.activity.mappingReviewed!==false||!short(p.activity.basis)||p.mappingStatus!=='unreviewed_relation')fail();
   if(p.integrationDate!==null&&(typeof p.integrationDate!=='string'||!Number.isFinite(Date.parse(p.integrationDate))))fail();
   plans.set(p.id,p);
  }
  for(const r of regions.values()){
   for(const id of r.planIds)if(!plans.has(id)||plans.get(id).regionId!==r.id)fail();
   if([...plans.values()].filter(p=>p.regionId===r.id).length!==r.planIds.length)fail();
  }
  if(LocalDataset)LocalDataset.validateCatalog(data);else if(data.localDataset!==undefined||data.plans.some(p=>p.localDataset!==undefined))fail();
  return data;
 }
 function featureKey(planId,objectId){return `${planId}:${objectId}`;}
 function aggregate(catalog,regionIds,records,active){
  if(!Array.isArray(regionIds)||new Set(regionIds).size!==regionIds.length||regionIds.some(id=>!catalog.regions.some(r=>r.id===id)))throw new Error('Pilihan wilayah tidak valid.');
  const regions=catalog.regions.filter(r=>regionIds.includes(r.id));
  const selected=catalog.plans.filter(p=>regionIds.includes(p.regionId));
  const plans=[],features=[],counts={matched:0,returned:0,excludedInvalid:0};
  let requestedPlanCount=0,loadedPlanCount=0,failedPlanCount=0,unmappedPlanCount=0,pendingPlanCount=0,notImportedPlanCount=0;
  for(const plan of selected){
   const notImported=plan.localDataset?.available===false;
   const entry=notImported?{status:'unavailable',reason:'not_in_release'}:plan.activity?(records.get(plan.id)||{status:active?'loading':'idle'}):{status:'unavailable'};
   if(notImported)notImportedPlanCount++;
   if(!['idle','loading','ready','partial','unavailable','error'].includes(entry.status))throw new Error('Status rencana tidak valid.');
   if(!plan.activity)unmappedPlanCount++;else requestedPlanCount++;
   const item={planId:plan.id,status:entry.status,source:null,...(notImported?{reason:'not_in_release'}:{})};
   if(entry.status==='ready'){
    const d=entry.data,m=d?.meta;
    if(!plan.activity||m?.plan?.id!==plan.id||m.plan.name!==plan.name||m.activity?.id!==plan.activity.id||m.activity.name!==plan.activity.name||!Array.isArray(d.features)||m.counts?.returned!==d.features.length)throw new Error('Hasil lintas rencana ditolak.');
    const ids=new Set();for(const feature of d.features){const id=feature.properties?.object_id;if(feature.properties?.plan_id!==plan.id||!Number.isSafeInteger(id)||id<0||feature.id!==id||ids.has(id))throw new Error('Identitas fitur tidak valid.');ids.add(id);features.push({plan,feature,data:d});}
    item.counts={};
    for(const key of ['matched','returned','excludedInvalid']){
     const value=m.counts[key];if(!Number.isSafeInteger(value)||value<0)throw new Error('Hitungan sumber tidak valid.');
     item.counts[key]=value;counts[key]+=value;
    }
    if(plan.localDataset)Object.assign(item,LocalDataset.provenance(plan,m));
    if(!['live','cached_snapshot','local_dataset'].includes(m.source?.status)||!timestamp(m.source.retrievedAt)||!plan.localDataset&&m.source.status==='local_dataset')throw new Error('Status sumber tidak valid.');
    loadedPlanCount++;item.source={status:m.source.status,retrievedAt:m.source.retrievedAt};
   }else if(notImported){/* Known release gap: no request, count, or success inferred. */}
   else if(plan.activity&&['error','unavailable'].includes(entry.status))failedPlanCount++;
   else if(plan.activity)pendingPlanCount++;
   plans.push(item);
  }
  const notListedRegionCount=regions.filter(r=>r.catalogStatus==='not_listed_in_public_catalog').length;
  let state='idle';
  if(active){
   if(!requestedPlanCount)state='unavailable';
   else if(pendingPlanCount)state=loadedPlanCount?'partial':'loading';
   else if(!loadedPlanCount)state=notImportedPlanCount?'unavailable':'error';
   else state=(failedPlanCount||unmappedPlanCount||notListedRegionCount||notImportedPlanCount)?'partial':'ready';
  }
  return {state,requestedPlanCount,loadedPlanCount,failedPlanCount,unmappedPlanCount,notListedRegionCount,notImportedPlanCount,pendingPlanCount,highlightedFeatureCount:features.length,mappingReviewed:false,plans,features,counts};
 }
 function configuration(catalog,entries,applied,records,active,catalogState='idle'){
  if(applied.kbli!=='01273'||catalog&&(catalog.sourceStatus!=='curated_source_snapshot'||!timestamp(catalog.checkedAt)))throw new Error('Konfigurasi sumber tidak valid.');
  const summary=catalog?aggregate(catalog,applied.regions,records,active):null;
  const overlay=summary?Object.fromEntries(Object.entries(summary).filter(([key])=>!['features','counts','pendingPlanCount'].includes(key))):{state:catalogState,requestedPlanCount:null,loadedPlanCount:0,failedPlanCount:0,unmappedPlanCount:null,notListedRegionCount:null,highlightedFeatureCount:0,mappingReviewed:false,plans:[]};
  const result={schemaVersion:3,artifactType:'zone-exploration-configuration',module:'zone-exploration',status:'eksplorasi-pemetaan-belum-direview',containsGeometry:false,kbli:{code:applied.kbli,version:'2025',scope:'budidaya-kakao',scopeConfirmed:false,mappingReviewed:false},regions:applied.regions.map(id=>{const r=entries.find(e=>e.id===id);if(!r)throw new Error('Wilayah tidak valid.');return {id:r.id,name:r.name,idNamespace:r.idNamespace,gistaruId:r.gistaruId};}),catalog:catalog?{sourceStatus:catalog.sourceStatus,checkedAt:catalog.checkedAt}:null,assessments:{zoning:'belum-dinilai'},evaluatedZoneCount:0,overlay,limitations:['Konfigurasi saja, bukan GeoJSON atau hasil kesesuaian.','Sorotan relevansi kelompok kegiatan lokal; bukan izin atau penerimaan exact-KBLI pada OSS.','Cakupan hanya zona hasil filter dari rencana yang berhasil dimuat, bukan seluruh daratan Sulawesi Tenggara.','ITBX sampel historis bukan evaluasi seluruh bidang.']};
  if(catalog?.localDataset)result.catalog.localDataset=LocalDataset.catalogProvenance(catalog);
  // Detach preview from mutable records and applied selection, including nested provenance/counts.
  return JSON.parse(JSON.stringify(result));
 }
 // Requests remain bounded independently of server timeouts. Cancel invalidates even fetches that ignore AbortSignal.
 function createLoader({fetchImpl=globalThis.fetch,validateCollection,onUpdate=()=>{},timeoutMs=120000}){
  let revision=0;const controllers=new Set();
  function cancel(){revision++;for(const controller of controllers)controller.abort();controllers.clear();}
  async function start(plans,kbli){
   cancel();if(!LocalDataset&&plans.some(p=>p.localDataset!==undefined))throw new Error('Helper dataset lokal tidak tersedia.');
   plans=LocalDataset?LocalDataset.capturePlans(plans,kbli):plans;const current=revision,queue=plans.filter(p=>LocalDataset?LocalDataset.canRequest(p):p.activity),records=new Map(plans.map(p=>[p.id,LocalDataset?LocalDataset.initialRecord(p):{status:p.activity?'loading':'unavailable'}]));let next=0;
   const publish=()=>{if(current===revision)onUpdate(records);};publish();
   async function worker(){
    while(current===revision&&next<queue.length){
     const plan=queue[next++],controller=new AbortController();controllers.add(controller);let timedOut=false;
     let rejectAbort;const aborted=new Promise((resolve,reject)=>{rejectAbort=reject;});
     const onAbort=()=>rejectAbort(new Error(timedOut?'timeout':'aborted'));
     controller.signal.addEventListener('abort',onAbort,{once:true});
     const timer=setTimeout(()=>{timedOut=true;controller.abort();},timeoutMs);
     try{
      const work=(async()=>{
       // Literal allowlisted identifiers; do not URL-encode the colon (backend checks raw tokens).
       const url=plan.localDataset?`/api/display?plan=${plan.id}&kbli=${kbli}&level=overview${LocalDataset.releaseQuery(plan)}`:`/api/zones?plan=${plan.id}&kbli=${kbli}`;
       const response=await fetchImpl(url,{signal:controller.signal,cache:'no-store'});
       if(!response.ok)throw new Error(response.status===422?'unavailable':`http_${response.status}`);
       return validateCollection(await response.json(),plan.id,kbli,plan);
      })();
      const data=await Promise.race([work,aborted]);
      if(current===revision)records.set(plan.id,{status:'ready',data});
     }catch(error){if(current===revision)records.set(plan.id,{status:error.message==='unavailable'?'unavailable':'error',error:timedOut?'timeout':error.message});}
     finally{clearTimeout(timer);controller.signal.removeEventListener('abort',onAbort);controllers.delete(controller);}
     publish();
    }
   }
   await Promise.all(Array.from({length:Math.min(3,queue.length)},worker));return records;
  }
  return {start,cancel};
 }
 return {validateCatalog,aggregate,featureKey,configuration,createLoader};
});
