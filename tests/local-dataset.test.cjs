'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const registry=require('../tools/rdtr-plans.json'),{entries}=require('../prototype/region-data.js');
const Province=require('../prototype/province-data.js');
const hash='a'.repeat(64),releaseId='11111111-1111-4111-8111-111111111111',version='22222222-2222-4222-8222-222222222222',mapping='33333333-3333-4333-8333-333333333333';
function pin(h=hash){const snapshotId=crypto.createHash('sha256').update(JSON.stringify({algorithmVersion:'coverage-lod-v1',mappingId:mapping,planVersionId:version,releaseHash:h})).digest('hex');return {available:true,releaseId,releaseHash:h,planVersionId:version,mappingId:mapping,snapshotId,geometryScope:'filtered_subset',rulesScope:'filter_membership_only'};}
function catalog(h=hash){const c=structuredClone(registry);c.localDataset={sourceKind:'local_dataset',releaseId,releaseHash:h,partial:true};c.plans.forEach(p=>p.localDataset={available:false,releaseHash:h});c.plans.find(p=>p.activity).localDataset=pin(h);return c;}
test('local bootstrap validates every explicit descriptor and rejects malformed or mixed release pins',()=>{
 const c=catalog();assert.equal(Province.validateCatalog(c,entries,'01273'),c);assert.equal(c.plans.filter(p=>p.activity).length,16);
 for(const change of [x=>x.localDataset.partial=false,x=>x.localDataset.sourceKind='live',x=>x.localDataset.releaseHash='A'.repeat(64),x=>x.localDataset.releaseId='1',x=>x.localDataset.releaseId='00000000-0000-0000-0000-000000000000',x=>x.localDataset.geometry={},x=>delete x.plans[1].localDataset,x=>x.plans[0].localDataset.available='true',x=>x.plans[0].localDataset.releaseHash='b'.repeat(64),x=>x.plans[0].localDataset.planVersionId=version.toUpperCase().replace('2222','zzzz'),x=>x.plans[0].localDataset.mappingId=null,x=>delete x.plans[0].localDataset.snapshotId,x=>x.plans[0].localDataset.snapshotId='f'.repeat(64),x=>x.plans[0].localDataset.geometryScope='complete_layer',x=>x.plans[1].localDataset.mappingId=mapping,x=>delete x.localDataset]){const d=catalog();change(d);assert.throws(()=>Province.validateCatalog(d,entries,'01273'),String(change));}
});
function fixture(p=catalog().plans[0]){
 const layer='https://gistaru-proxy.atrbpn.go.id/proxy.ashx?https://gistaru.atrbpn.go.id/arcgis/rest/services/'+p.servicePath+'/'+p.sublayer,b=[122,-4.1,122.1,-4];
 return {type:'FeatureCollection',features:[{type:'Feature',id:17,properties:{object_id:17,plan_id:p.id,activity_id:p.activity.id,activity_name:p.activity.name,zone_code:'P-3',filter_value:'P-3',zone_name:'SYNTHETIC ONLY',zone_group:'UNIT',subzone_name:null,permission:'unknown',evidence_status:'unreviewed_mapping',source_bounds:b},geometry:{type:'Polygon',coordinates:[[[122,-4],[122.1,-4],[122.1,-4.1],[122,-4]]]}}],meta:{plan:{id:p.id,name:p.name,regionId:p.regionId},activity:{id:p.activity.id,name:p.activity.name,filterField:p.filterField,mappingReviewed:false},kbli:{code:'01273',version:'2025',scope:'budidaya-kakao',scopeConfirmed:false,mappingReviewed:false},filterZoneCodes:['P-3'],coverage:'loaded-plan-matching-zones-only',geometryPurpose:'display',limitations:['SYNTHETIC ONLY'],counts:{matched:1,returned:1,excludedInvalid:0},sourceCounts:{matched:1,returned:1,excludedInvalid:0},sourceBounds:b,snapshotId:p.localDataset.snapshotId,dataset:Object.fromEntries(Object.entries({sourceKind:'local_dataset',...p.localDataset}).filter(([k])=>!['available','snapshotId'].includes(k))),source:{status:'local_dataset',retrievedAt:'2026-10-26T09:00:00Z',activitiesUrl:p.activitiesUrl,metadataUrl:layer+'?f=pjson',geometryQueryUrl:layer+'/query',nativeWkid:p.nativeWkid,outputWkid:4326},display:{algorithmVersion:'coverage-lod-v1',purpose:'display-only-not-analysis-or-export',level:'overview',toleranceMeters:100,method:'coverage_simplify',fallbackReason:null,sourceFeatureCount:1,returnedFeatureCount:1,originalVertices:4,returnedVertices:4,bbox:null,validation:{featureIdsPreserved:true,geometryValid:true,coverageValid:true}}}};
}
function detail(d){return {schemaVersion:1,planId:d.meta.plan.id,objectId:17,snapshotId:d.meta.snapshotId,sourceBounds:d.meta.sourceBounds,properties:{...d.features[0].properties,regulation:null},meta:structuredClone(d.meta)};}
test('zone, display and detail require the exact local bootstrap identity and reject source/geometry smuggling',()=>{
 const Display=require('../prototype/display-data.js'),Zone=require('../prototype/zone-data.js'),p=catalog().plans[0],d=fixture(p);
 assert.equal(Display.validateCollection(d,p,'01273',{level:'overview'}),d);const v=detail(d);assert.equal(Display.validateDetail(v,p,'01273',d.features[0],d),v);
 const zone=x=>Zone.validateCollection({...x,features:x.features.map(f=>({...f,properties:{...f.properties,regulation:null}}))},p.id,'01273',p);
 assert.ok(zone(d));
 for(const change of [x=>x.meta.source.status='live',x=>x.meta.source.status='cached_snapshot',x=>delete x.meta.dataset,x=>x.meta.dataset.releaseHash='b'.repeat(64),x=>x.meta.dataset.releaseId=version,x=>x.meta.dataset.planVersionId=mapping,x=>x.meta.dataset.mappingId=version,x=>x.meta.dataset.geometryScope='complete_layer',x=>x.meta.dataset.rulesScope='full_rules',x=>x.meta.dataset.sourceKind='live',x=>x.meta.snapshotId='e'.repeat(64),x=>x.meta.dataset.geometry={coordinates:[]},x=>x.meta.rawMetadata={},x=>x.meta.source.credentials='secret',x=>x.features[0].properties.raw_properties={geometry:{}},x=>x.meta.plan.geometry={},x=>x.meta.counts.geometry={}]){const x=fixture(p);change(x);assert.throws(()=>Display.validateCollection(x,p,'01273',{level:'overview'}),String(change));assert.throws(()=>zone(x),String(change));const v=detail(x);assert.throws(()=>Display.validateDetail(v,p,'01273',d.features[0],d),String(change));}
 const extra=fixture(p);extra.features[0].geometry.secret='secret';assert.throws(()=>zone(extra));assert.throws(()=>Display.validateCollection(extra,p,'01273',{level:'overview'}));
 const live=fixture(p);delete live.meta.dataset;live.meta.source.status='live';assert.throws(()=>Display.validateCollection(live,p,'01273',{level:'overview'}));const legacy=structuredClone(p);delete legacy.localDataset;assert.throws(()=>Display.validateCollection(d,legacy,'01273',{level:'overview'}));
});
test('local overview, viewport and detail append literal release pins and keep old release after pointer moves',async()=>{
 const Display=require('../prototype/display-data.js'),c=catalog(),p=c.plans[0],urls=[];let active=catalog('b'.repeat(64));
 const transport=Display.createTransport({fetchImpl:async url=>{urls.push(url);assert.ok(active.localDataset.releaseHash!==p.localDataset.releaseHash);const d=fixture(p),q=new URL(url,'http://test').searchParams;if(q.has('bbox'))Object.assign(d.meta.display,{bbox:q.get('bbox').split(',').map(Number),level:'regional',toleranceMeters:10});return {ok:true,json:async()=>url.startsWith('/api/feature-detail')?detail(d):d};}});
 const loader=Display.createLoader({transport}),records=await loader.start(c.plans,'01273');assert.equal(urls.length,1);assert.equal(records.get(p.id).status,'ready');assert.equal(records.get(c.plans[1].id).status,'unavailable');assert.equal(records.get(c.plans[1].id).reason,'not_in_release');
 const inventory=records.get(p.id).data,bbox=[121,-5,123,-3];await loader.start([p],'01273',{level:'regional',bbox,inventories:records});await Display.createDetailLoader({transport}).start(p,'01273',inventory.features[0],inventory);
 assert.deepEqual(urls,[`/api/display?plan=${p.id}&kbli=01273&level=overview&release=${hash}`,`/api/display?plan=${p.id}&kbli=01273&level=regional&bbox=121,-5,123,-3&release=${hash}`,`/api/feature-detail?plan=${p.id}&kbli=01273&objectId=17&snapshot=${pin().snapshotId}&release=${hash}`]);
 let calls=0;const failed=Display.createLoader({fetchImpl:async()=>{calls++;return {ok:false,status:404};}});assert.equal((await failed.start([p],'01273')).get(p.id).status,'error');assert.equal(calls,1,'never retries with active release or zones');
 const mixed=structuredClone(c.plans.slice(0,2));delete mixed[1].localDataset;await assert.rejects(loader.start(mixed,'01273'));assert.equal(urls.length,3);
 const localLegacy=await Province.createLoader({validateCollection:require('../prototype/zone-data.js').validateCollection,fetchImpl:async url=>{assert.match(url,/^\/api\/display\?/);assert.ok(url.endsWith('&release='+hash));return {ok:true,json:async()=>fixture(p)};}}).start(c.plans,'01273');assert.equal(localLegacy.get(p.id).status,'ready');
});
test('local loaders freeze pins before await and suppress superseded display/detail responses',async()=>{
 const Display=require('../prototype/display-data.js'),p=catalog().plans[0],old=fixture(p);let release;const updates=[],urls=[];
 const loader=Display.createLoader({onUpdate:r=>updates.push(r),fetchImpl:async url=>{urls.push(url);await new Promise(r=>release=r);return {ok:true,json:async()=>old};}});
 const pending=loader.start([p],'01273');await new Promise(r=>setImmediate(r));p.localDataset=pin('b'.repeat(64));release();assert.equal((await pending).get(p.id).status,'ready','in-flight validation uses captured descriptor');
 const p2=catalog().plans[0],late=loader.start([p2],'01273');await new Promise(r=>setImmediate(r));loader.cancel();const n=updates.length;release();await late;assert.equal(updates.length,n);
 const attribute=Display.createDetailLoader({fetchImpl:async()=>{await new Promise(r=>release=r);return {ok:true,json:async()=>detail(old)};}});const response=attribute.start(p2,'01273',old.features[0],old);await new Promise(r=>setImmediate(r));attribute.cancel();release();assert.equal(await response,null);
});
test('not-imported plans are explicit partial gaps, never missing activity mappings or successful zero',()=>{
 const Display=require('../prototype/display-data.js'),c=catalog(),p=c.plans[0],records=new Map([[p.id,{status:'ready',data:fixture(p)}]]),applied={kbli:'01273',regions:[p.regionId]};
 const s=Province.aggregate(c,applied.regions,records,true);assert.equal(s.state,'partial');assert.equal(s.unmappedPlanCount,0);assert.equal(s.notImportedPlanCount,1);assert.equal(s.failedPlanCount,0);assert.equal(s.plans[1].status,'unavailable');assert.equal(s.plans[1].reason,'not_in_release');assert.equal(s.plans[1].counts,undefined);
 const value=Display.configuration(c,entries,applied,records,true);assert.equal(value.overlay.availableFeatureCount,null);assert.equal(value.overlay.notImportedPlanCount,1);assert.equal(value.overlay.plans[1].reason,'not_in_release');
 const p2=c.plans.find(x=>x.activity&&x.regionId!==p.regionId);assert.equal(Province.aggregate(c,[p2.regionId],new Map(),true).state,'unavailable');
});
test('configuration allowlists detached release provenance even with hostile non-provenance metadata',()=>{
 const Display=require('../prototype/display-data.js'),c=catalog(),p=c.plans[0],d=fixture(p),records=new Map([[p.id,{status:'ready',data:d}]]),applied={kbli:'01273',regions:[p.regionId]};
 d.meta.rawMetadata={credentials:'secret',geometry:{coordinates:[1]}};d.meta.source.password='secret';d.meta.display.geometry={};d.meta.counts.geometry={};
 const value=Display.configuration(c,entries,applied,records,true),legacy=Province.configuration(c,entries,applied,records,true);
 for(const v of [value,legacy]){assert.deepEqual(v.catalog.localDataset,c.localDataset);assert.equal(v.overlay.plans[0].dataset.releaseHash,hash);assert.equal(v.overlay.plans[0].dataset.mappingId,mapping);assert.equal(v.overlay.plans[0].snapshotId,pin().snapshotId);assert.equal(v.overlay.plans[0].dataset.geometryScope,'filtered_subset');assert.doesNotMatch(JSON.stringify(v),/"(?:geometry|coordinates|rawMetadata|password|credentials|source_bounds|display|features)"/);}
 const before=JSON.stringify(value);p.localDataset.releaseHash='c'.repeat(64);d.meta.dataset.releaseHash='d'.repeat(64);d.meta.counts.returned=5;applied.regions=[];assert.equal(JSON.stringify(value),before);
});
function appHarness(c,fetcher){
 // Reuse the unchanged legacy Node VM DOM harness, not a real browser.
 const fs=require('node:fs'),path=require('node:path'),source=fs.readFileSync(path.join(__dirname,'province-data.test.cjs'),'utf8'),start=source.indexOf('function appHarness(fetchZones){'),end=source.indexOf("\ntest('Schema v3",start);
 return Function('require','fs','registry','entries','api','__dirname','return ('+source.slice(start,end)+')')(require,fs,c,entries,()=>Province,__dirname)(fetcher);
}
test('browser helper order and optional legacy loading both work without Node crypto',()=>{
 const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),html=fs.readFileSync(path.join(__dirname,'../prototype/index.html'),'utf8');
 const scripts=[...html.matchAll(/<script src="([^"]+)" defer><\/script>/g)].map(x=>x[1]);assert.ok(scripts.indexOf('local-dataset.js')>=0);assert.ok(scripts.indexOf('local-dataset.js')<scripts.indexOf('zone-data.js'));
 for(const helper of [true,false]){const ctx=vm.createContext({URL});for(const file of ['local-dataset.js','zone-data.js','province-data.js','display-data.js'])if(helper||file!=='local-dataset.js')vm.runInContext(fs.readFileSync(path.join(__dirname,'../prototype',file),'utf8'),ctx);assert.equal(ctx.ProvinceData.validateCatalog(registry,entries,'01273'),registry);if(helper)assert.equal(ctx.ProvinceData.validateCatalog(catalog(),entries,'01273').localDataset.releaseHash,hash);else assert.throws(()=>ctx.ProvinceData.validateCatalog(catalog(),entries,'01273'));}
});
test('app VM labels source observation 26 October, local subset gaps and unknown review without claiming live freshness',async()=>{
 const c=catalog(),p=c.plans[0],h=appHarness(c,async url=>({ok:true,json:async()=>fixture(p)}));await h.settle();assert.equal(h.inputs.length,17);
 h.context.window.testMap={removeLayer(){},fitBounds(){},setView(){},getZoom:()=>7,getBounds:()=>({getWest:()=>120,getSouth:()=>-6,getEast:()=>121,getNorth:()=>-5})};h.context.window.L={featureGroup:()=>({addTo(){return this;},addLayer(){}}),geoJSON:()=>({})};
 await h.run('map=window.testMap;loadZones()');await h.settle();assert.equal(h.requests.filter(u=>u.startsWith('/api/display')).length,1);assert.match(h.el('coverageStatus').textContent,/Dataset lokal/);assert.match(h.el('catalogGaps').textContent,/17.*belum diimpor|17.*belum tersedia dalam rilis/);assert.match(h.el('catalogStatus').textContent,/Dataset lokal/);assert.match(h.run('planStatus(plans[1])'),/belum diimpor|belum tersedia dalam rilis/);assert.match(h.run('planStatus(plans[0])'),/Dataset lokal.*2026-10-26/);
 h.context.window.data=fixture(p);h.run('renderZoneDetail(window.data.features[0],window.data)');assert.match(h.el('zoneDetailContent').textContent,/Dataset lokal.*pengamatan sumber.*2026-10-26/);assert.match(h.el('zoneDetailContent').textContent,/unknown/);assert.match(h.el('zoneDetailContent').textContent,/belum direview/);assert.doesNotMatch(h.el('zoneDetailContent').textContent,/hari ini|2026-10-28|cached_snapshot/);
 await h.run('requestViewport()');assert.equal(h.run('viewportPhase'),'partial');assert.equal(h.run('configuration().overlay.availableFeatureCount'),null);assert.doesNotMatch(h.el('viewportStatus').textContent,/0 fitur pada viewport/);h.run('clearZones()');
});
test('local viewport and detail reject conflicting source observation metadata despite a matching snapshot',()=>{
 const Display=require('../prototype/display-data.js'),p=catalog().plans[0],d=fixture(p),bbox=[121,-5,123,-3];
 for(const change of [x=>x.source.retrievedAt='2026-10-28T09:00:00Z',x=>x.source.status='live',x=>x.dataset.releaseId=version]){const v=fixture(p);v.meta.display.bbox=bbox;change(v.meta);assert.throws(()=>Display.validateCollection(v,p,'01273',{level:'overview',bbox,inventory:d}),String(change));const a=detail(d);change(a.meta);assert.throws(()=>Display.validateDetail(a,p,'01273',d.features[0],d),String(change));}
});
test('export refuses hostile values in otherwise allowlisted scalar fields',()=>{
 const Display=require('../prototype/display-data.js');for(const key of ['sourceStatus','checkedAt']){const c=catalog();c[key]={geometry:{coordinates:[1]},credentials:'secret'};assert.throws(()=>Display.configuration(c,entries,{kbli:'01273',regions:[]},new Map(),false));}
});
test('optional-helper absence refuses local loaders before any unpinned request',async()=>{
 const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ctx=vm.createContext({URL,AbortController,setTimeout,clearTimeout});for(const file of ['zone-data.js','province-data.js','display-data.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../prototype',file),'utf8'),ctx);
 const p=catalog().plans[0],d=fixture(p);let calls=0;const transport={json:async()=>{calls++;throw new Error('unexpected network');}};
 await assert.rejects(ctx.DisplayData.createLoader({transport}).start([p],'01273'));
 await assert.rejects(ctx.ProvinceData.createLoader({fetchImpl:async()=>{calls++;throw new Error('unexpected network');}}).start([p],'01273'));
 await assert.rejects(ctx.DisplayData.createDetailLoader({transport}).start(p,'01273',d.features[0],d));assert.equal(calls,0);
});
test('local zone adapter rejects nested payloads in allowlisted optional display/navigation fields',()=>{
 const Zone=require('../prototype/zone-data.js'),p=catalog().plans[0];for(const change of [x=>x.meta.sourceBounds={geometry:{}},x=>x.meta.sourceCounts.returned={geometry:{}},x=>x.features[0].properties.subzone_name={geometry:{}},x=>x.features[0].properties.source_bounds={geometry:{}},x=>x.meta.display.fallbackReason={geometry:{}},x=>x.meta.display.algorithmVersion={geometry:{}},x=>x.meta.display.validation.coverageValid={geometry:{}}]){const d=fixture(p);change(d);assert.throws(()=>Zone.validateCollection(d,p.id,'01273',p),String(change));}
});
for(const [field,mutate] of [
 ['filterZoneCodes',m=>m.filterZoneCodes.push('BOGUS')],
 ['sourceBounds',m=>m.sourceBounds=[0,0,1,1]],
 ['limitations',m=>m.limitations=['Contradictory source limitations']]
])test(`local detail rejects conflicting sealed metadata: ${field}`,()=>{
 const Display=require('../prototype/display-data.js'),p=catalog().plans[0],d=fixture(p),v=detail(d);mutate(v.meta);
 assert.throws(()=>Display.validateDetail(v,p,'01273',d.features[0],d));
});
test('local detail preserves matching immutable metadata and rejects unknown metadata or permission roles',()=>{
 const Display=require('../prototype/display-data.js'),p=catalog().plans[0],d=fixture(p),v=detail(d),before=structuredClone(v);
 assert.equal(Display.validateDetail(v,p,'01273',d.features[0],d),v);assert.deepEqual(v,before);
 assert.equal(v.meta.source.retrievedAt,'2026-10-26T09:00:00Z');assert.equal(v.properties.permission,'unknown');
 for(const mutate of [x=>x.meta.unrecognized='extra',x=>x.meta.source.unrecognized='extra',x=>x.properties.permission='allowed']){const bad=detail(d);mutate(bad);assert.throws(()=>Display.validateDetail(bad,p,'01273',d.features[0],d));}
});
module.exports={catalog,pin,fixture,detail};
