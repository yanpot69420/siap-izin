'use strict';
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ZoneData=api;})(globalThis,()=>{
 function validateCollection(data,planId,kbli){
  const fail=()=>{throw new Error('Kontrak data zona tidak valid atau konteksnya berubah.');};
  const record=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
  const short=x=>typeof x==='string'&&x.length>0&&x.length<=4000;
  if(!record(data)||data.type!=='FeatureCollection'||!Array.isArray(data.features)||data.features.length>20000||!record(data.meta))fail();
  const m=data.meta;
  if(!record(m.plan)||m.plan.id!==planId||m.plan.regionId!==planId.split(':')[0]||!short(m.plan.name))fail();
  if(!record(m.kbli)||m.kbli.code!==kbli||m.kbli.version!=='2025'||m.kbli.scope!=='budidaya-kakao'||m.kbli.scopeConfirmed!==false||m.kbli.mappingReviewed!==false)fail();
  if(m.coverage!=='loaded-plan-matching-zones-only'||m.geometryPurpose!=='display')fail();
  if(!Array.isArray(m.filterZoneCodes)||m.filterZoneCodes.some(x=>!short(x))||new Set(m.filterZoneCodes).size!==m.filterZoneCodes.length)fail();
  if(!record(m.counts)||!['matched','returned','excludedInvalid'].every(k=>Number.isSafeInteger(m.counts[k])&&m.counts[k]>=0)||m.counts.returned!==data.features.length||m.counts.matched!==m.counts.returned+m.counts.excludedInvalid)fail();
  if(!record(m.source)||!['live','cached_snapshot'].includes(m.source.status)||!short(m.source.retrievedAt)||!Number.isFinite(Date.parse(m.source.retrievedAt)))fail();
  for(const k of ['activitiesUrl','metadataUrl','geometryQueryUrl']){if(!short(m.source[k]))fail();try{const u=new URL(m.source[k]);if(u.protocol!=='https:'||!['gistaru.atrbpn.go.id','gistaru-proxy.atrbpn.go.id'].includes(u.hostname)||u.username||u.password)fail();}catch{fail();}}
  if(!Array.isArray(m.limitations)||!m.limitations.length||m.limitations.some(x=>!short(x)))fail();
  const ids=new Set();let vertices=0;
  function ring(coords){
   if(!Array.isArray(coords)||coords.length<4)fail();
   for(const point of coords){if(!Array.isArray(point)||point.length<2||point.length>3||!point.every(Number.isFinite)||Math.abs(point[0])>180||Math.abs(point[1])>90||++vertices>1000000)fail();}
   const first=coords[0],last=coords[coords.length-1];if(first[0]!==last[0]||first[1]!==last[1])fail();
  }
  function polygon(coords){if(!Array.isArray(coords)||!coords.length)fail();coords.forEach(ring);}
  for(const feature of data.features){
   if(!record(feature)||feature.type!=='Feature'||!record(feature.properties)||!record(feature.geometry))fail();
   const p=feature.properties;const id=String(p.object_id);
   if((typeof p.object_id!=='string'&&!Number.isSafeInteger(p.object_id))||!id||ids.has(id)||String(feature.id)!==id)fail();ids.add(id);
   if(p.plan_id!==planId||p.activity_id!=='041'||!short(p.activity_name)||p.evidence_status!=='unreviewed_mapping'||p.permission!=='unknown'||!m.filterZoneCodes.includes(p.zone_code)||!short(p.zone_name)||!short(p.zone_group))fail();
   if(p.regulation!==null&&typeof p.regulation!=='string')fail();
   if(feature.geometry.type==='Polygon')polygon(feature.geometry.coordinates);
   else if(feature.geometry.type==='MultiPolygon'&&Array.isArray(feature.geometry.coordinates)&&feature.geometry.coordinates.length)feature.geometry.coordinates.forEach(polygon);
   else fail();
  }
  // Coordinate/schema checks only. Full topology is checked by the local API.
  return data;
 }
 return {validateCollection};
});
