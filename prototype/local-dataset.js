'use strict';
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.LocalDataset=api;})(globalThis,()=>{
 const record=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
 const hex=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
 const box=x=>Array.isArray(x)&&x.length===4&&x.every(Number.isFinite)&&x[0]>=-180&&x[2]<=180&&x[1]>=-90&&x[3]<=90&&x[0]<x[2]&&x[1]<x[3];
 const uuid=x=>typeof x==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(x);
 const fail=()=>{throw new Error('Kontrak dataset lokal tidak valid atau pin rilis berubah.');};
 function keys(value,allowed,required=allowed){if(!record(value)||Object.keys(value).some(k=>!allowed.includes(k))||required.some(k=>!Object.hasOwn(value,k)))fail();}
 // Synchronous SHA-256 for the ASCII-only identity tuple. No source content,
 // network, Node-only crypto, or freshness override enters this computation.
 const primes=[];for(let n=2;primes.length<64;n++)if(!primes.some(p=>n%p===0))primes.push(n);
 const initial=primes.slice(0,8).map(p=>(Math.sqrt(p)%1*4294967296)|0),constants=primes.map(p=>(Math.cbrt(p)%1*4294967296)|0);
 const rotate=(x,n)=>(x>>>n)|(x<<(32-n));
 function sha256(ascii){
  const words=[],length=ascii.length*8;for(let i=0;i<ascii.length;i++)words[i>>2]=(words[i>>2]||0)|ascii.charCodeAt(i)<<(24-i%4*8);
  words[length>>5]=(words[length>>5]||0)|0x80<<(24-length%32);words[(((length+64)>>9)<<4)+15]=length;
  const h=initial.slice();for(let offset=0;offset<words.length;offset+=16){const w=[];let [a,b,c,d,e,f,g,z]=h;
   for(let i=0;i<64;i++){const x=w[i-15],y=w[i-2];w[i]=i<16?(words[offset+i]||0):((rotate(x,7)^rotate(x,18)^(x>>>3))+w[i-16]+(rotate(y,17)^rotate(y,19)^(y>>>10))+w[i-7])|0;
    const t1=(z+(rotate(e,6)^rotate(e,11)^rotate(e,25))+((e&f)^(~e&g))+constants[i]+w[i])|0,t2=((rotate(a,2)^rotate(a,13)^rotate(a,22))+((a&b)^(a&c)^(b&c)))|0;
    z=g;g=f;f=e;e=(d+t1)|0;d=c;c=b;b=a;a=(t1+t2)|0;
   }[a,b,c,d,e,f,g,z].forEach((v,i)=>h[i]=(h[i]+v)|0);
  }return h.map(x=>(x>>>0).toString(16).padStart(8,'0')).join('');
 }
 function expectedSnapshot(p){return sha256(JSON.stringify({algorithmVersion:'coverage-lod-v1',mappingId:p.mappingId,planVersionId:p.planVersionId,releaseHash:p.releaseHash}));}
 const datasetKeys=['sourceKind','releaseId','releaseHash','planVersionId','mappingId','geometryScope','rulesScope'];
 function storageState(plan){
  const s=plan?.localStorage;if(s===undefined)return 'unknown';
  keys(s,['state']);if(!['stored','not_stored'].includes(s.state)||s.state==='not_stored'&&plan.localDataset?.available===true||plan.localDataset===undefined)fail();
  return s.state==='stored'?(plan.localDataset.available?'active':'stored_not_active'):'not_stored';
 }
 function validatePlan(plan,release){
  storageState(plan);
  const p=plan?.localDataset;if(p===undefined){if(release)fail();return null;}
  if(!record(p)||typeof p.available!=='boolean'||!hex(p.releaseHash))fail();
  if(release&&p.releaseHash!==release.releaseHash)fail();
  if(!p.available){keys(p,['available','releaseHash']);return p;}
  keys(p,['available','releaseId','releaseHash','planVersionId','mappingId','snapshotId','geometryScope','rulesScope']);
  if(!plan.activity||!uuid(p.releaseId)||!uuid(p.planVersionId)||!uuid(p.mappingId)||!hex(p.snapshotId)||p.snapshotId!==expectedSnapshot(p)||p.geometryScope!=='filtered_subset'||p.rulesScope!=='filter_membership_only'||release&&p.releaseId!==release.releaseId)fail();
  return p;
 }
 function validateCatalog(catalog){
  const r=catalog.localDataset;
  if(catalog.localCapabilities!==undefined){keys(catalog.localCapabilities,['displayBatchOverview']);if(typeof catalog.localCapabilities.displayBatchOverview!=='boolean'||r===undefined)fail();}
  if(r===undefined){if(catalog.plans.some(p=>p.localDataset!==undefined||p.localStorage!==undefined))fail();return null;}
  keys(r,['sourceKind','releaseId','releaseHash','partial']);if(r.sourceKind!=='local_dataset'||!uuid(r.releaseId)||!hex(r.releaseHash)||r.partial!==true)fail();
  catalog.plans.forEach(p=>validatePlan(p,r));return r;
 }
 function validateMetadata(m,plan){
  const p=validatePlan(plan),local=p!==null;
  if(!local){if(m.dataset!==undefined||m.source?.status==='local_dataset')fail();return false;}
  if(!p.available||m.source?.status!=='local_dataset'||m.snapshotId!==p.snapshotId)fail();
  keys(m.dataset,datasetKeys);for(const k of datasetKeys)if(m.dataset[k]!== (k==='sourceKind'?'local_dataset':p[k]))fail();
  keys(m,['plan','activity','kbli','filterZoneCodes','counts','coverage','geometryPurpose','limitations','source','dataset','snapshotId','sourceCounts','sourceBounds','display'],['plan','activity','kbli','filterZoneCodes','counts','coverage','geometryPurpose','limitations','source','dataset','snapshotId']);
  keys(m.plan,['id','name','regionId']);keys(m.activity,['id','name','filterField','mappingReviewed']);keys(m.kbli,['code','version','scope','scopeConfirmed','mappingReviewed']);
  keys(m.counts,['matched','returned','excludedInvalid']);if(m.sourceCounts!==undefined)keys(m.sourceCounts,['matched','returned','excludedInvalid']);
  keys(m.source,['status','retrievedAt','activitiesUrl','metadataUrl','geometryQueryUrl','nativeWkid','outputWkid']);if(m.source.nativeWkid!==plan.nativeWkid||m.source.outputWkid!==4326)fail();
  if(m.sourceBounds!==undefined&&m.sourceBounds!==null&&!box(m.sourceBounds))fail();
  if(m.sourceCounts!==undefined&&(!['matched','returned','excludedInvalid'].every(k=>Number.isSafeInteger(m.sourceCounts[k])&&m.sourceCounts[k]>=0)||m.sourceCounts.matched!==m.sourceCounts.returned+m.sourceCounts.excludedInvalid))fail();
  if(m.display!==undefined){keys(m.display,['algorithmVersion','purpose','level','toleranceMeters','method','fallbackReason','sourceFeatureCount','returnedFeatureCount','originalVertices','returnedVertices','bbox','validation']);keys(m.display.validation,['featureIdsPreserved','geometryValid','coverageValid']);
   const d=m.display;if(d.algorithmVersion!=='coverage-lod-v1'||d.purpose!=='display-only-not-analysis-or-export'||!['overview','regional','detail'].includes(d.level)||d.toleranceMeters!==({overview:100,regional:10,detail:1})[d.level]||!['coverage_simplify','original_preserved'].includes(d.method)||![null,'coverage_invalid','quality_validation_failed'].includes(d.fallbackReason)||d.bbox!==null&&!box(d.bbox)||!['sourceFeatureCount','returnedFeatureCount','originalVertices','returnedVertices'].every(k=>Number.isSafeInteger(d[k])&&d[k]>=0)||d.validation.featureIdsPreserved!==true||d.validation.geometryValid!==true||![true,false,null].includes(d.validation.coverageValid))fail();
  }
  return true;
 }
 function validateFeatures(data){
  keys(data,['type','features','meta']);
  const properties=['object_id','plan_id','zone_name','zone_code','zone_group','subzone_name','filter_value','activity_id','activity_name','permission','evidence_status','source_bounds','regulation'];
  for(const f of data.features){keys(f,['type','id','properties','geometry']);keys(f.geometry,['type','coordinates']);keys(f.properties,properties,['object_id','plan_id','zone_name','zone_code','zone_group','filter_value','activity_id','activity_name','permission','evidence_status']);if(f.properties.source_bounds!==undefined&&!box(f.properties.source_bounds)||f.properties.subzone_name!==undefined&&f.properties.subzone_name!==null&&typeof f.properties.subzone_name!=='string')fail();}
 }
 function capturePlans(plans,kbli){
  if(kbli!=='01273'||!Array.isArray(plans)||plans.some(p=>!/^74\d{8}:\d{3}$/.test(p?.id)))fail();
  const local=plans.some(p=>p.localDataset!==undefined),first=plans.find(p=>p.localDataset?.available)?.localDataset,releaseHash=plans[0]?.localDataset?.releaseHash;
  return plans.map(p=>{const pin=validatePlan(p);if(local&&(!pin||pin.releaseHash!==releaseHash||first&&pin.available&&pin.releaseId!==first.releaseId))fail();return {...p,activity:p.activity?{...p.activity}:null,...(p.localStorage?{localStorage:{...p.localStorage}}:{}),...(pin?{localDataset:{...pin}}:{})};});
 }
 function canRequest(p){return !!p.activity&&p.localDataset?.available!==false;}
 function initialRecord(p){return canRequest(p)?{status:'loading'}:{status:'unavailable',...(p.localDataset?.available===false?{reason:'not_in_release'}:{})};}
 function releaseQuery(p){const pin=validatePlan(p);if(pin&&!pin.available)fail();return pin?'&release='+pin.releaseHash:'';}
 function provenance(plan,m){
  const p=validatePlan(plan);if(!p||!p.available||m.source?.status!=='local_dataset'||m.snapshotId!==p.snapshotId||!record(m.dataset))fail();
  const dataset={};for(const k of datasetKeys){const expected=k==='sourceKind'?'local_dataset':p[k];if(m.dataset[k]!==expected)fail();dataset[k]=expected;}
  return {dataset,snapshotId:p.snapshotId};
 }
 function catalogProvenance(catalog){const r=validateCatalog(catalog);return r?{sourceKind:r.sourceKind,releaseId:r.releaseId,releaseHash:r.releaseHash,partial:true}:null;}
 return {storageState,validateCatalog,validatePlan,validateMetadata,validateFeatures,capturePlans,canRequest,initialRecord,releaseQuery,provenance,catalogProvenance};
});
