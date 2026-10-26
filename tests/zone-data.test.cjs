'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
// Synthetic schema fixture only: never served as RDTR or used as map fallback.
function fixture(){return {type:'FeatureCollection',features:[{type:'Feature',id:17,geometry:{type:'Polygon',coordinates:[[[121.8,-4],[121.81,-4],[121.81,-4.01],[121.8,-4]]]},properties:{object_id:17,zone_code:'P-3',zone_name:'Nama fixture',zone_group:'Kelompok fixture',regulation:null,plan_id:'7411000000:001',activity_id:'041',activity_name:'Kegiatan fixture',evidence_status:'unreviewed_mapping',permission:'unknown'}}],meta:{plan:{id:'7411000000:001',name:'Rencana fixture',regionId:'7411000000'},kbli:{code:'01273',version:'2025',scope:'budidaya-kakao',scopeConfirmed:false,mappingReviewed:false},filterZoneCodes:['P-3'],counts:{matched:1,returned:1,excludedInvalid:0},source:{status:'live',retrievedAt:'2026-10-25T09:00:00Z',activitiesUrl:'https://gistaru.atrbpn.go.id/rdtrinteraktif/',metadataUrl:'https://gistaru.atrbpn.go.id/rdtrinteraktif/',geometryQueryUrl:'https://gistaru.atrbpn.go.id/rdtrinteraktif/'},coverage:'loaded-plan-matching-zones-only',geometryPurpose:'display',limitations:['Fixture pengujian, bukan keputusan izin.']}};}
test('Kontrak data sorotan: hanya geometri terikat sumber dan pemetaan belum ditinjau, fail closed',()=>{
 const target=path.join(__dirname,'../prototype/zone-data.js');
 assert.ok(fs.existsSync(target),'Validator kontrak sorotan zona belum diimplementasikan');
 const {validateCollection}=require(target);
 const good=fixture();assert.equal(validateCollection(good,'7411000000:001','01273').features.length,1);
 const invalid=[
  d=>d.features[0].properties.permission='allowed',
  d=>d.features[0].properties.evidence_status='reviewed',
  d=>d.meta.kbli.mappingReviewed=true,
  d=>d.meta.kbli.code='1273',
  d=>d.meta.plan.id='7401000000:001',
  d=>d.features[0].properties.zone_code='unknown-zone',
  d=>d.meta.counts.returned=9,
  d=>d.features.push(structuredClone(d.features[0])),
  d=>d.features[0].geometry.coordinates[0][0][0]=900,
  d=>d.features[0].geometry.coordinates[0][3]=[121.7,-4],
  d=>d.meta.source.status='invented',
  d=>d.meta.source.retrievedAt='bukan-tanggal'
 ];
 for(const mutate of invalid){const d=fixture();mutate(d);assert.throws(()=>validateCollection(d,'7411000000:001','01273'));}
 const cached=fixture();cached.meta.source.status='cached_snapshot';assert.equal(validateCollection(cached,'7411000000:001','01273').meta.source.status,'cached_snapshot');
 const empty=fixture();empty.features=[];empty.meta.counts={matched:0,returned:0,excludedInvalid:0};assert.equal(validateCollection(empty,'7411000000:001','01273').features.length,0);
});
const registry=require('../tools/rdtr-plans.json');
function strictFixture(descriptor){
 const d=fixture(),p=d.features[0].properties;
 d.meta.plan={id:descriptor.id,name:descriptor.name,regionId:descriptor.regionId};
 d.meta.activity={id:descriptor.activity.id,name:descriptor.activity.name,filterField:descriptor.filterField,mappingReviewed:false};
 p.plan_id=descriptor.id;p.activity_id=descriptor.activity.id;p.activity_name=descriptor.activity.name;
 p.filter_value=descriptor.filterField==='KODUNK'?'P-3.01':'P-3';
 d.meta.filterZoneCodes=[p.filter_value];
 const layer='https://gistaru-proxy.atrbpn.go.id/proxy.ashx?https://gistaru.atrbpn.go.id/arcgis/rest/services/'+descriptor.servicePath+'/'+descriptor.sublayer;
 Object.assign(d.meta.source,{activitiesUrl:descriptor.activitiesUrl,metadataUrl:layer+'?f=pjson',geometryQueryUrl:layer+'/query'});
 return d;
}
test('Langara uses exact KODUNK filter value, not original KODSZN, with plan-specific activity',()=>{
 const descriptor=registry.plans.find(p=>p.filterField==='KODUNK');
 const d=strictFixture(descriptor);
 assert.equal(require('../prototype/zone-data.js').validateCollection(d,descriptor.id,'01273',descriptor),d);
 assert.equal(d.features[0].properties.zone_code,'P-3');
 assert.equal(d.features[0].properties.filter_value,'P-3.01');
});
test('Strict descriptor context rejects cross-plan, activity, URLs, numeric-ID and filter provenance drift',()=>{
 const {validateCollection}=require('../prototype/zone-data.js');
 const descriptor=registry.plans.find(p=>p.filterField==='KODUNK');
 const invalid=[
  d=>d.meta.plan.name='Another plan',
  d=>d.meta.activity.id='041',
  d=>d.meta.activity.name='Another activity',
  d=>d.meta.activity.filterField='KODSZN',
  d=>d.meta.activity.mappingReviewed=true,
  d=>delete d.meta.activity,
  d=>d.features[0].properties.activity_name='Another activity',
  d=>d.features[0].properties.filter_value='P-3',
  d=>d.features[0].properties.object_id='17',
  d=>d.features[0].id='17',
  d=>d.features[0].properties.object_id=-1,
  d=>d.meta.source.activitiesUrl=registry.plans[0].activitiesUrl,
  d=>d.meta.source.metadataUrl='https://gistaru.atrbpn.go.id/wrong-plan',
  d=>d.meta.source.geometryQueryUrl='https://gistaru-proxy.atrbpn.go.id/proxy.ashx?https://evil.test/query',
  d=>d.meta.source.retrievedAt='October 25, 2026',
 ];
 for(const mutate of invalid){const d=strictFixture(descriptor);mutate(d);assert.throws(()=>validateCollection(d,descriptor.id,'01273',descriptor),String(mutate));}
 assert.throws(()=>validateCollection(strictFixture(descriptor),descriptor.id,'01273',{...descriptor,activity:null}));
 // Three-argument compatibility is only the historical Tirawuta test contract.
 const other=fixture();other.meta.plan.id='7411000000:002';other.features[0].properties.plan_id='7411000000:002';
 assert.throws(()=>validateCollection(other,'7411000000:002','01273'));
 const numeric=fixture();numeric.features[0].id='17';numeric.features[0].properties.object_id='17';
 assert.throws(()=>validateCollection(numeric,'7411000000:001','01273'));
});
test('Large real-plan display budget permits Routa-scale vertices but remains bounded',()=>{
 const descriptor=registry.plans.find(p=>p.id==='7402000000:003');
 const d=strictFixture(descriptor),a=[121.8,-4],b=[121.81,-4],c=[121.81,-4.01];
 // Synthetic size fixture only, no source geometry or permission evidence.
 d.features[0].geometry.coordinates=[[a,b,...Array(1877975).fill(c),a]];
 const validate=require('../prototype/zone-data.js').validateCollection;
 assert.equal(validate(d,descriptor.id,'01273',descriptor),d);
 d.features[0].geometry.coordinates=[[a,b,...Array(1999998).fill(c),a]];
 assert.throws(()=>validate(d,descriptor.id,'01273',descriptor));
});
module.exports={strictFixture};
