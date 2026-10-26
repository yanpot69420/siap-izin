'use strict';
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ZoneData=api;})(globalThis,()=>{
 function validateCollection(data,planId,kbli,descriptor){
  const fail=()=>{throw new Error('Kontrak data zona tidak valid atau konteksnya berubah.');};
  const record=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
  const short=x=>typeof x==='string'&&x.length>0&&x.length<=4000;
  const timestamp=x=>typeof x==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(x)&&Number.isFinite(Date.parse(x));
  if(typeof planId!=='string'||!/^74\d{8}:\d{3}$/.test(planId)||kbli!=='01273')fail();
  const strict=descriptor!==undefined;
  if(strict){
   if(!record(descriptor)||descriptor.id!==planId||descriptor.regionId!==planId.split(':')[0]||!short(descriptor.name)||!record(descriptor.activity)||!short(descriptor.activity.id)||!short(descriptor.activity.name)||descriptor.activity.mappingReviewed!==false||!['KODSZN','KODUNK'].includes(descriptor.filterField))fail();
  }else if(planId!=='7411000000:001')fail();
  if(!record(data)||data.type!=='FeatureCollection'||!Array.isArray(data.features)||data.features.length>20000||!record(data.meta))fail();
  const m=data.meta;
  if(!record(m.plan)||m.plan.id!==planId||m.plan.regionId!==planId.split(':')[0]||!short(m.plan.name))fail();
  if(strict&&(m.plan.name!==descriptor.name||!record(m.activity)||m.activity.id!==descriptor.activity.id||m.activity.name!==descriptor.activity.name||m.activity.filterField!==descriptor.filterField||m.activity.mappingReviewed!==false))fail();
  if(!record(m.kbli)||m.kbli.code!==kbli||m.kbli.version!=='2025'||m.kbli.scope!=='budidaya-kakao'||m.kbli.scopeConfirmed!==false||m.kbli.mappingReviewed!==false)fail();
  if(m.coverage!=='loaded-plan-matching-zones-only'||m.geometryPurpose!=='display')fail();
  if(!Array.isArray(m.filterZoneCodes)||m.filterZoneCodes.some(x=>!short(x))||new Set(m.filterZoneCodes).size!==m.filterZoneCodes.length)fail();
  if(!record(m.counts)||!['matched','returned','excludedInvalid'].every(k=>Number.isSafeInteger(m.counts[k])&&m.counts[k]>=0)||m.counts.returned!==data.features.length||m.counts.matched!==m.counts.returned+m.counts.excludedInvalid)fail();
  if(!record(m.source)||!['live','cached_snapshot'].includes(m.source.status)||!timestamp(m.source.retrievedAt))fail();
  for(const k of ['activitiesUrl','metadataUrl','geometryQueryUrl']){if(!short(m.source[k]))fail();try{const u=new URL(m.source[k]);if(u.protocol!=='https:'||!['gistaru.atrbpn.go.id','gistaru-proxy.atrbpn.go.id'].includes(u.hostname)||u.username||u.password)fail();}catch{fail();}}
  if(strict){
   if(!/^(?:071_RDTR_PROVINSI_SULAWESI_TENGGARA|PARKIRAN)\/[A-Za-z0-9_]+\/MapServer$/.test(descriptor.servicePath)||!Number.isSafeInteger(descriptor.sublayer)||descriptor.sublayer<0)fail();
   const layer='https://gistaru-proxy.atrbpn.go.id/proxy.ashx?https://gistaru.atrbpn.go.id/arcgis/rest/services/'+descriptor.servicePath+'/'+descriptor.sublayer;
   if(m.source.activitiesUrl!==descriptor.activitiesUrl||m.source.metadataUrl!==layer+'?f=pjson'||m.source.geometryQueryUrl!==layer+'/query')fail();
  }
  if(!Array.isArray(m.limitations)||!m.limitations.length||m.limitations.some(x=>!short(x)))fail();
  const ids=new Set();let vertices=0;
  function ring(coords){
   if(!Array.isArray(coords)||coords.length<4)fail();
   for(const point of coords){if(!Array.isArray(point)||point.length<2||point.length>3||!point.every(Number.isFinite)||Math.abs(point[0])>180||Math.abs(point[1])>90||++vertices>2000000)fail();}
   const first=coords[0],last=coords[coords.length-1];if(first[0]!==last[0]||first[1]!==last[1])fail();
  }
  function polygon(coords){if(!Array.isArray(coords)||!coords.length)fail();coords.forEach(ring);}
  for(const feature of data.features){
   if(!record(feature)||feature.type!=='Feature'||!record(feature.properties)||!record(feature.geometry))fail();
   const p=feature.properties;const id=String(p.object_id);
   if(!Number.isSafeInteger(p.object_id)||p.object_id<0||ids.has(id)||feature.id!==p.object_id)fail();ids.add(id);
   if(p.plan_id!==planId||p.activity_id!==(descriptor?descriptor.activity.id:'041')||!short(p.activity_name)||p.evidence_status!=='unreviewed_mapping'||p.permission!=='unknown'||!m.filterZoneCodes.includes(descriptor?p.filter_value:p.zone_code)||!short(p.zone_code)||!short(p.zone_name)||!short(p.zone_group))fail();
   if(strict&&(p.activity_name!==descriptor.activity.name||!short(p.filter_value)||(descriptor.filterField==='KODSZN'&&p.filter_value!==p.zone_code)))fail();
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
