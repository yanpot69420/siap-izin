'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const registry=require('../tools/rdtr-plans.json');
const plan=registry.plans.find(p=>p.activity);
// Synthetic contract fixture ONLY for unit tests; never served by the app.
function fixture(p=plan,id=17){
 const layer='https://gistaru-proxy.atrbpn.go.id/proxy.ashx?https://gistaru.atrbpn.go.id/arcgis/rest/services/'+p.servicePath+'/'+p.sublayer;
 return {type:'FeatureCollection',features:[{type:'Feature',id,properties:{object_id:id,plan_id:p.id,activity_id:p.activity.id,activity_name:p.activity.name,zone_code:'P-3',filter_value:p.filterField==='KODUNK'?'P-3.01':'P-3',zone_name:'SYNTHETIC UNIT ONLY',zone_group:'UNIT ONLY',subzone_name:null,evidence_status:'unreviewed_mapping',permission:'unknown',source_bounds:[122,-4.1,122.1,-4]},geometry:{type:'Polygon',coordinates:[[[122,-4],[122.1,-4],[122.1,-4.1],[122,-4]]]}}],meta:{plan:{id:p.id,name:p.name,regionId:p.regionId},activity:{id:p.activity.id,name:p.activity.name,filterField:p.filterField,mappingReviewed:false},kbli:{code:'01273',version:'2025',scope:'budidaya-kakao',scopeConfirmed:false,mappingReviewed:false},coverage:'loaded-plan-matching-zones-only',geometryPurpose:'display',filterZoneCodes:[p.filterField==='KODUNK'?'P-3.01':'P-3'],counts:{matched:1,returned:1,excludedInvalid:0},sourceCounts:{matched:1,returned:1,excludedInvalid:0},sourceBounds:[122,-4.1,122.1,-4],snapshotId:'a'.repeat(64),display:{algorithmVersion:'coverage-lod-v1',purpose:'display-only-not-analysis-or-export',level:'overview',toleranceMeters:100,method:'coverage_simplify',fallbackReason:null,sourceFeatureCount:1,returnedFeatureCount:1,originalVertices:4,returnedVertices:4,bbox:null,validation:{featureIdsPreserved:true,geometryValid:true,coverageValid:true}},source:{status:'cached_snapshot',retrievedAt:'2026-10-25T09:00:00Z',activitiesUrl:p.activitiesUrl,metadataUrl:layer+'?f=pjson',geometryQueryUrl:layer+'/query'},limitations:['SYNTHETIC UNIT ONLY — not evidence']}};
}
const api=()=>require('../prototype/display-data.js');
test('overview is a strict source inventory, keeping the original object and source metadata',()=>{
 const d=fixture();assert.equal(api().validateCollection(d,plan,'01273',{level:'overview',bbox:null}),d);
 const bad=[d=>d.meta.snapshotId='A'.repeat(64),d=>d.meta.plan.id=registry.plans[1].id,d=>d.meta.kbli.mappingReviewed=true,d=>d.features[0].properties.permission='allowed',d=>d.meta.sourceCounts.returned=2,d=>d.meta.display.sourceFeatureCount=2,d=>d.meta.display.returnedVertices=3,d=>d.meta.display.bbox=[121,-5,123,-3],d=>d.meta.sourceBounds=[123,-4,122,-5],d=>d.features[0].properties.source_bounds=[121,-4.1,121.1,-4],d=>d.features[0].geometry.coordinates[0][0][0]=Infinity,d=>d.features[0].properties.regulation='not lightweight',d=>d.features.push(structuredClone(d.features[0]))];
 for(const mutate of bad){const x=fixture();mutate(x);assert.throws(()=>api().validateCollection(x,plan,'01273',{level:'overview',bbox:null}),String(mutate));}
});
test('viewport validates requested level, bbox, required contained source IDs and inventory snapshot',()=>{
 const inventory=fixture(),box=[121.9,-4.2,122.2,-3.9],d=fixture();d.meta.display={...d.meta.display,level:'regional',toleranceMeters:10,bbox:box};
 assert.equal(api().validateCollection(d,plan,'01273',{level:'regional',bbox:box,inventory}),d);
 for(const change of [x=>x.meta.snapshotId='b'.repeat(64),x=>x.features[0].id=21,x=>x.meta.display.method='simplify',x=>x.meta.display.validation.coverageValid=false,x=>x.meta.display.originalVertices=3]){const x=structuredClone(d);change(x);assert.throws(()=>api().validateCollection(x,plan,'01273',{level:'regional',bbox:box,inventory}));}
 const empty=structuredClone(d);empty.features=[];empty.meta.display.returnedFeatureCount=0;empty.meta.display.returnedVertices=0;
 assert.throws(()=>api().validateCollection(empty,plan,'01273',{level:'regional',bbox:box,inventory}));
 const elsewhere=[120,-6,121,-5];empty.meta.display.bbox=elsewhere;assert.equal(api().validateCollection(empty,plan,'01273',{level:'regional',bbox:elsewhere,inventory}),empty);
});
test('viewport may omit a partially overlapping source envelope without changing snapshot or source counts',()=>{
 // The triangle leaves this corner of its envelope empty; envelope overlap alone
 // cannot prove an intersection with the original source polygon.
 const inventory=fixture(),bbox=[122,-4.1,122.01,-4.09],d=structuredClone(inventory);
 assert.ok(api().intersects(inventory.features[0].properties.source_bounds,bbox));
 d.features=[];Object.assign(d.meta.display,{level:'regional',toleranceMeters:10,bbox,returnedFeatureCount:0,returnedVertices:0});
 assert.equal(api().validateCollection(d,plan,'01273',{level:'regional',bbox,inventory}),d);
 assert.deepEqual(d.meta.sourceCounts,inventory.meta.sourceCounts);assert.deepEqual(d.meta.counts,inventory.meta.counts);
 assert.equal(d.meta.snapshotId,inventory.meta.snapshotId);assert.equal(d.meta.display.originalVertices,4);
 for(const mutate of [x=>x.meta.snapshotId='b'.repeat(64),x=>{x.meta.sourceCounts={matched:0,returned:0,excludedInvalid:0};x.meta.counts={...x.meta.sourceCounts};x.meta.sourceBounds=null;x.meta.display.sourceFeatureCount=0;x.meta.display.originalVertices=0;},x=>x.meta.display.returnedFeatureCount=1,x=>x.meta.display.returnedVertices=4,x=>x.meta.display.originalVertices=8,x=>x.meta.plan.id=registry.plans[1].id]){
  const bad=structuredClone(d);mutate(bad);assert.throws(()=>api().validateCollection(bad,plan,'01273',{level:'regional',bbox,inventory}),String(mutate));
 }
});
test('viewport rejects extraneous source IDs and source envelopes outside the requested bbox',()=>{
 const inventory=fixture(),bbox=[122,-4.1,122.05,-4.02],d=fixture();d.meta.display.bbox=bbox;
 const extra=structuredClone(d);extra.features[0].id=extra.features[0].properties.object_id=21;
 assert.throws(()=>api().validateCollection(extra,plan,'01273',{level:'overview',bbox,inventory}));
 const elsewhere=[120,-6,121,-5];d.meta.display.bbox=elsewhere;
 assert.throws(()=>api().validateCollection(d,plan,'01273',{level:'overview',bbox:elsewhere,inventory}));
});
test('honest empty original-preserved source is legal without a fallback reason',()=>{
 const d=fixture();d.features=[];d.meta.counts={matched:0,returned:0,excludedInvalid:0};d.meta.sourceCounts={...d.meta.counts};d.meta.sourceBounds=null;
 Object.assign(d.meta.display,{method:'original_preserved',fallbackReason:null,sourceFeatureCount:0,returnedFeatureCount:0,originalVertices:0,returnedVertices:0});d.meta.display.validation.coverageValid=null;
 assert.equal(api().validateCollection(d,plan,'01273',{level:'overview'}),d);
 const bbox=[122,-4.1,122.05,-4.02],viewport=structuredClone(d);Object.assign(viewport.meta.display,{level:'regional',toleranceMeters:10,bbox});
 assert.equal(api().validateCollection(viewport,plan,'01273',{level:'regional',bbox,inventory:d}),viewport);
 for(const mutate of [x=>x.meta.display.validation.coverageValid=true,x=>x.meta.display.validation.coverageValid=false,x=>x.meta.display.validation.geometryValid=false,x=>x.meta.display.originalVertices=4,x=>x.meta.display.returnedVertices=4,x=>x.meta.display.sourceFeatureCount=1,x=>x.meta.sourceBounds=[122,-4.1,122.1,-4],x=>x.meta.sourceCounts.returned=1]){
  const bad=structuredClone(d);mutate(bad);assert.throws(()=>api().validateCollection(bad,plan,'01273',{level:'overview'}),String(mutate));
 }
});
test('empty source rejects fallback, simplification and nonzero source-count contradictions',()=>{
 const empty=fixture();empty.features=[];empty.meta.counts={matched:0,returned:0,excludedInvalid:0};empty.meta.sourceCounts={...empty.meta.counts};empty.meta.sourceBounds=null;
 Object.assign(empty.meta.display,{method:'original_preserved',fallbackReason:null,sourceFeatureCount:0,returnedFeatureCount:0,originalVertices:0,returnedVertices:0});empty.meta.display.validation.coverageValid=null;
 for(const mutate of [
  x=>{x.meta.display.fallbackReason='coverage_invalid';x.meta.display.validation.coverageValid=false;},
  x=>{x.meta.display.fallbackReason='quality_validation_failed';},
  x=>{x.meta.display.method='coverage_simplify';x.meta.display.validation.coverageValid=true;},
  x=>{x.meta.counts={matched:1,returned:0,excludedInvalid:1};x.meta.sourceCounts={...x.meta.counts};}
 ]){
  const bad=structuredClone(empty);mutate(bad);
  for(const bbox of [null,[122,-4.2,122.2,-3.9]]){bad.meta.display.bbox=bbox;assert.throws(()=>api().validateCollection(bad,plan,'01273',{level:'overview',bbox}),String(mutate));}
 }
});
test('nonempty original-preserved source still requires an explicit fallback reason',()=>{
 const d=fixture();Object.assign(d.meta.display,{method:'original_preserved',fallbackReason:null});d.meta.display.validation.coverageValid=null;
 assert.throws(()=>api().validateCollection(d,plan,'01273',{level:'overview'}));
 d.meta.display.fallbackReason='quality_validation_failed';assert.equal(api().validateCollection(d,plan,'01273',{level:'overview'}),d);
});
function detail(d=fixture()) {return {schemaVersion:1,planId:d.meta.plan.id,objectId:d.features[0].id,snapshotId:d.meta.snapshotId,sourceBounds:d.features[0].properties.source_bounds,properties:{...d.features[0].properties,regulation:'UNIT ONLY'},meta:{...d.meta}};}
test('attribute detail is explicitly bound to source identity, snapshot, bounds and unknown permission',()=>{
 const d=fixture(),value=detail(d);assert.equal(api().validateDetail(value,plan,'01273',d.features[0],d),value);
 for(const mutate of [x=>x.snapshotId='b'.repeat(64),x=>x.planId=registry.plans[1].id,x=>x.objectId=1,x=>x.properties.permission='allowed',x=>x.meta.sourceCounts.returned=99,x=>x.sourceBounds=[121,-5,122,-4],x=>x.geometry={type:'Polygon'},x=>x.properties.zone_name='wrong snapshot property']){const x=detail(d);mutate(x);assert.throws(()=>api().validateDetail(x,plan,'01273',d.features[0],d),String(mutate));}
});
test('detail accepts original sanitized source attributes without synthesized display-only properties',()=>{
 const d=fixture(),v=detail(d);delete v.properties.source_bounds;delete v.properties.subzone_name;delete v.meta.display;delete v.meta.snapshotId;delete v.meta.sourceBounds;
 assert.equal(api().validateDetail(v,plan,'01273',d.features[0],d),v);
});
for(const [field,mutate] of [
 ['filterZoneCodes',m=>m.filterZoneCodes.push('BOGUS')],
 ['sourceBounds',m=>m.sourceBounds=[0,0,1,1]],
 ['limitations',m=>m.limitations=['Contradictory source limitations']]
])test(`detail rejects conflicting inventory metadata: ${field}`,()=>{
 const d=fixture(),v=structuredClone(detail(d));mutate(v.meta);
 assert.throws(()=>api().validateDetail(v,plan,'01273',d.features[0],d));
});
test('detail preserves matching metadata, optional legacy navigation and independent legacy source dates',()=>{
 const d=fixture(),v=structuredClone(detail(d)),before=structuredClone(v);
 assert.equal(api().validateDetail(v,plan,'01273',d.features[0],d),v);assert.deepEqual(v,before);
 delete v.meta.sourceBounds;delete v.meta.snapshotId;delete v.meta.display;delete v.properties.source_bounds;delete v.properties.subzone_name;
 v.meta.source.retrievedAt='2026-10-26T09:00:00Z';
 assert.equal(api().validateDetail(v,plan,'01273',d.features[0],d),v);
 assert.equal(d.meta.source.retrievedAt,'2026-10-25T09:00:00Z');assert.equal(v.properties.permission,'unknown');
});
test('display loader fetches all 16 overviews with a strict three-request ceiling, independent errors, no zones fallback',async()=>{
 let active=0,peak=0;const urls=[],updates=[];
 const loader=api().createLoader({timeoutMs:100,onUpdate:r=>updates.push([...r.values()].filter(x=>x.status==='ready').length),fetchImpl:async(url,{signal})=>{urls.push(url);active++;peak=Math.max(peak,active);await new Promise(r=>setTimeout(r,2));active--;assert.equal(signal.aborted,false);const p=registry.plans.find(p=>url.includes('plan='+p.id+'&'));return {ok:p!==plan,status:502,json:async()=>fixture(p)};}});
 const records=await loader.start(registry.plans,'01273');assert.equal(urls.length,16);assert.equal(peak,3);assert.equal([...records.values()].filter(x=>x.status==='ready').length,15);assert.ok(updates.some(n=>n>0&&n<15));assert.ok(urls.every(u=>/^\/api\/display\?plan=74\d{8}:\d{3}&kbli=01273&level=overview$/.test(u)));
});
for(const [name,malformed] of [
 ['empty object',()=>JSON.parse('{}')],
 ['missing snapshot',d=>{delete d.meta.snapshotId;return d;}],
 ['short snapshot',d=>{d.meta.snapshotId='b'.repeat(63);return d;}],
 ['nonhex snapshot',d=>{d.meta.snapshotId='g'.repeat(64);return d;}],
 ['nonstring snapshot',d=>{d.meta.snapshotId=null;return d;}]
])test(`display loader reports malformed viewport ${name} as a generic contract error, not snapshot_changed`,async()=>{
 const bbox=[122,-4.2,122.2,-3.9];let response=fixture();
 const loader=api().createLoader({fetchImpl:async()=>({ok:true,json:async()=>response})});
 const inventories=await loader.start([plan],'01273');assert.equal(inventories.get(plan.id).status,'ready');
 const before=structuredClone(inventories.get(plan.id));response=fixture();response.meta.display.bbox=bbox;response=malformed(response);
 const records=await loader.start([plan],'01273',{bbox,inventories});
 assert.deepEqual(records.get(plan.id),{status:'error',error:'Kontrak tampilan tidak valid atau konteks/snapshot berubah.'});
 assert.deepEqual(inventories.get(plan.id),before);
});
test('viewport plan selection uses source bounds only, and cancelled revisions never publish old bbox/zoom data',async()=>{
 const p2=registry.plans.filter(p=>p.activity)[1],inventory=new Map([[plan.id,{status:'ready',data:fixture()}],[p2.id,{status:'ready',data:fixture(p2)}]]);
 assert.deepEqual(api().viewportPlans(registry.plans,inventory,[120,-6,121,-5]),[]);
 assert.equal(api().viewportPlans(registry.plans,inventory,[122,-4.2,122.2,-3.9]).length,2);
 const updates=[];let release;
 const loader=api().createLoader({onUpdate:r=>updates.push(r),fetchImpl:async url=>{if(url.includes('level=overview'))await new Promise(r=>release=r);const d=fixture();if(url.includes('level=detail')){d.meta.display.level='detail';d.meta.display.toleranceMeters=1;d.meta.display.bbox=[122,-4.2,122.2,-3.9];}return {ok:true,json:async()=>d};}});
 const old=loader.start([plan],'01273');await new Promise(r=>setImmediate(r));const fresh=await loader.start([plan],'01273',{level:'detail',bbox:[122,-4.2,122.2,-3.9],inventories:inventory});const n=updates.length;release();await old;await new Promise(r=>setImmediate(r));assert.equal(updates.length,n);assert.equal(fresh.get(plan.id).data.meta.display.level,'detail');
 const timed=api().createLoader({timeoutMs:5,fetchImpl:()=>new Promise(()=>{})});assert.equal((await timed.start([plan],'01273')).get(plan.id).error,'timeout');
});
test('detail request is literal snapshot-bound, superseded selection is ignored and 409 explicitly requires reload',async()=>{
 const d=fixture(),urls=[];let release;
 const loader=api().createDetailLoader({fetchImpl:async(url,{signal})=>{urls.push(url);await new Promise(r=>release=r);return {ok:true,json:async()=>detail(d)};}});
 const late=loader.start(plan,'01273',d.features[0],d);await new Promise(r=>setImmediate(r));loader.cancel();release();assert.equal(await late,null);
 assert.equal(urls[0],`/api/feature-detail?plan=${plan.id}&kbli=01273&objectId=17&snapshot=${'a'.repeat(64)}`);
 const conflict=api().createDetailLoader({fetchImpl:async()=>({ok:false,status:409})});await assert.rejects(conflict.start(plan,'01273',d.features[0],d),/snapshot_changed/);
});
test('schema3 configuration explicitly separates catalog/available/loaded/drawn and excludes all hostile metadata',()=>{
 const d=fixture(),records=new Map([[plan.id,{status:'ready',data:d}]]),applied={kbli:'01273',regions:[plan.regionId]};Object.assign(d.meta.counts,{geometry:{coordinates:[1]},extraCount:999});d.meta.display.rawfeature=d.features[0];
 const value=api().configuration(registry,require('../prototype/region-data.js').entries,applied,records,true,'ready',{state:'ready',level:'regional',records:new Map(),renderer:'svg'});
 assert.equal(value.schemaVersion,3);assert.equal(value.overlay.catalogPlanCount,2);assert.equal(value.overlay.loadedFeatureCount,1);assert.equal(value.overlay.availableFeatureCount,null);assert.equal(value.overlay.drawnFeatureCount,0);assert.equal(value.overlay.viewport.level,'regional');
 const before=JSON.stringify(value);d.meta.counts.returned=999;applied.regions=[];assert.equal(JSON.stringify(value),before);assert.doesNotMatch(before,/"(?:geometry|coordinates|source_bounds|rawfeature|extraCount|features)"/);
});
test('geometry budgets and original-preserved labels are reconciled against the complete source inventory',()=>{
 for(const mutate of [x=>x.meta.display.originalVertices=2000001,x=>x.meta.display.originalVertices=0,x=>{x.meta.display.originalVertices=8;x.meta.display.method='original_preserved';x.meta.display.fallbackReason='coverage_invalid';x.meta.display.validation.coverageValid=false;},x=>{x.meta.sourceCounts={matched:20001,returned:20001,excludedInvalid:0};x.meta.counts={...x.meta.sourceCounts};x.meta.display.sourceFeatureCount=20001;x.meta.display.bbox=[122,-4.1,122.05,-4.01];}]){const x=fixture();mutate(x);assert.throws(()=>api().validateCollection(x,plan,'01273',{level:'overview',bbox:x.meta.display.bbox}),String(mutate));}
});
test('source availability stays unknown without mappable snapshots, rather than inventing zero RDTR coverage',()=>{
 const value=api().configuration(registry,require('../prototype/region-data.js').entries,{kbli:'01273',regions:['local:sultra:muna']},new Map(),true);
 assert.equal(value.overlay.availableFeatureCount,null);assert.equal(value.overlay.loadedFeatureCount,0);assert.equal(value.overlay.drawnFeatureCount,0);assert.equal(value.overlay.notListedRegionCount,1);
});
test('viewport comparison ignores property insertion order but binds original vertex counts and all source attributes',()=>{
 const inventory=fixture(),d=fixture(),bbox=[122,-4.2,122.2,-3.9];d.features[0].properties=Object.fromEntries(Object.entries(d.features[0].properties).reverse());d.meta.display.bbox=bbox;
 assert.equal(api().validateCollection(d,plan,'01273',{level:'overview',bbox,inventory}),d);
 d.meta.display.originalVertices=8;assert.throws(()=>api().validateCollection(d,plan,'01273',{level:'overview',bbox,inventory}));
});
test('detail rejects nested geometry smuggling and inconsistent optional navigation bounds',()=>{
 for(const mutate of [x=>x.properties.geometry={type:'Polygon',coordinates:[1]},x=>x.properties.source_bounds=[121,-5,122,-4],x=>x.properties.rawfeature={geometry:{}}]){const d=fixture(),v=detail(d);mutate(v);assert.throws(()=>api().validateDetail(v,plan,'01273',d.features[0],d),String(mutate));}
});
test('overview, viewport and details share one three-request transport ceiling',async()=>{
 let active=0,peak=0;const selected=registry.plans.filter(p=>p.activity),d=fixture();
 const transport=api().createTransport({fetchImpl:async url=>{active++;peak=Math.max(peak,active);await new Promise(r=>setTimeout(r,2));active--;const q=new URL(url,'http://unit.test').searchParams,p=selected.find(p=>p.id===q.get('plan'));if(url.startsWith('/api/feature-detail'))return {ok:true,json:async()=>detail(d)};const value=fixture(p);if(q.get('level')==='regional'){value.meta.display.level='regional';value.meta.display.toleranceMeters=10;}return {ok:true,json:async()=>value};}});
 const overview=api().createLoader({transport}),viewport=api().createLoader({transport}),attribute=api().createDetailLoader({transport});
 const [a,b,c]=await Promise.all([overview.start(selected.slice(0,2),'01273'),viewport.start(selected.slice(2,4),'01273',{level:'regional'}),attribute.start(plan,'01273',d.features[0],d)]);assert.equal(peak,3);assert.ok([...a.values(),...b.values()].every(x=>x.status==='ready'));assert.equal(c.objectId,17);
});
function transportFixture(){
 const requests=[];let active=0,peak=0;
 const transport=api().createTransport({timeoutMs:1000,fetchImpl:(url,{signal})=>new Promise((resolve,reject)=>{
  active++;peak=Math.max(peak,active);let done=false;
  const finish=()=>settle(null),abort=()=>settle(new Error('aborted'));
  function settle(error){if(done)return;done=true;active--;signal.removeEventListener('abort',abort);if(error)reject(error);else resolve({ok:true,json:async()=>url});}
  signal.addEventListener('abort',abort,{once:true});requests.push({url,finish});
 })});
 return {transport,requests,get active(){return active;},get peak(){return peak;},finishAll(){requests.forEach(r=>r.finish());}};
}
for(const saturated of [false,true])test(`transport rejects pre-aborted jobs without dispatch, saturated=${saturated}`,async()=>{
 const h=transportFixture(),controllers=Array.from({length:saturated?3:0},()=>new AbortController());
 const active=controllers.map((c,i)=>h.transport.json('/active-'+i,{signal:c.signal}));
 const controller=new AbortController();controller.abort();let reason;
 const queued=h.transport.json('/pre-aborted',{signal:controller.signal}).catch(e=>{reason=e.message;});
 await new Promise(r=>setImmediate(r));const observed=reason;
 h.finishAll();await Promise.all([...active,queued]);
 assert.equal(observed,'aborted');assert.equal(h.requests.some(r=>r.url==='/pre-aborted'),false);
 assert.equal(require('node:events').getEventListeners(controller.signal,'abort').length,0);
});
test('transport immediately removes saturated queued aborts and cleans listeners without exceeding slots',async()=>{
 const {getEventListeners}=require('node:events'),h=transportFixture();
 const controllers=Array.from({length:3},()=>new AbortController()),active=controllers.map((c,i)=>h.transport.json('/active-'+i,{signal:c.signal}));
 const cancelled=new AbortController(),next=new AbortController();let reason;
 const queued=h.transport.json('/cancelled',{signal:cancelled.signal}).catch(e=>{reason=e.message;});
 const survivor=h.transport.json('/survivor',{signal:next.signal});cancelled.abort();
 await new Promise(r=>setImmediate(r));
 const observed={reason,listeners:getEventListeners(cancelled.signal,'abort').length,active:h.active,dispatched:h.requests.length};
 h.requests[0].finish();await new Promise(r=>setImmediate(r));
 const nextObserved={active:h.active,dispatched:h.requests.map(r=>r.url),listeners:getEventListeners(next.signal,'abort').length};
 h.finishAll();await Promise.all([...active,queued,survivor]);await new Promise(r=>setImmediate(r));
 assert.deepEqual(observed,{reason:'aborted',listeners:0,active:3,dispatched:3});
 assert.deepEqual(nextObserved,{active:3,dispatched:['/active-0','/active-1','/active-2','/survivor'],listeners:1});
 assert.equal(h.peak,3);assert.equal(h.active,0);
 for(const c of [...controllers,cancelled,next])assert.equal(getEventListeners(c.signal,'abort').length,0);
});
test('transport cleans active abort listeners and reuses the cancelled slot',async()=>{
 const {getEventListeners}=require('node:events'),h=transportFixture(),controllers=Array.from({length:4},()=>new AbortController());
 const results=controllers.map((c,i)=>h.transport.json('/request-'+i,{signal:c.signal}).catch(e=>e.message));
 controllers[0].abort();await new Promise(r=>setImmediate(r));
 const observed={active:h.active,dispatched:h.requests.length};h.finishAll();const values=await Promise.all(results);
 assert.equal(values[0],'aborted');assert.deepEqual(observed,{active:3,dispatched:4});assert.equal(h.peak,3);
 for(const c of controllers)assert.equal(getEventListeners(c.signal,'abort').length,0);
});
module.exports={fixture,plan,detail};
