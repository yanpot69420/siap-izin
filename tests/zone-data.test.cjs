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
