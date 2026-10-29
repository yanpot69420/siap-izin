'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const registry=require('../tools/rdtr-plans.json');
const {entries}=require('../prototype/region-data.js');
const target=require('node:path').join(__dirname,'../prototype/province-data.js');
function api(){assert.ok(fs.existsSync(target),'Province catalog/state module is missing');return require(target);}
// Schema fixtures remain in tests, never in a production fallback.
function collection(plan,id=17){
 const layer='https://gistaru-proxy.atrbpn.go.id/proxy.ashx?https://gistaru.atrbpn.go.id/arcgis/rest/services/'+plan.servicePath+'/'+plan.sublayer;
 return {type:'FeatureCollection',features:[{type:'Feature',id,properties:{object_id:id,plan_id:plan.id,activity_id:plan.activity.id,activity_name:plan.activity.name,zone_code:'P-3',filter_value:plan.filterField==='KODUNK'?'P-3.01':'P-3',zone_name:'TEST ONLY',zone_group:'TEST ONLY',regulation:null,evidence_status:'unreviewed_mapping',permission:'unknown'},geometry:{type:'Polygon',coordinates:[[[122,-4],[122.1,-4],[122.1,-4.1],[122,-4]]]}}],meta:{plan:{id:plan.id,name:plan.name,regionId:plan.regionId},activity:{id:plan.activity.id,name:plan.activity.name,filterField:plan.filterField,mappingReviewed:false},kbli:{code:'01273',version:'2025',scope:'budidaya-kakao',scopeConfirmed:false,mappingReviewed:false},coverage:'loaded-plan-matching-zones-only',geometryPurpose:'display',filterZoneCodes:[plan.filterField==='KODUNK'?'P-3.01':'P-3'],counts:{matched:1,returned:1,excludedInvalid:0},source:{status:'live',retrievedAt:'2026-10-25T09:00:00Z',activitiesUrl:plan.activitiesUrl,metadataUrl:layer+'?f=pjson',geometryQueryUrl:layer+'/query'},limitations:['TEST ONLY — not evidence']}};
}
test('Static UI describes provincial exploration, not an active Tirawuta-only pilot',()=>{
 const html=fs.readFileSync(require('node:path').join(__dirname,'../prototype/index.html'),'utf8');
 assert.doesNotMatch(html,/Pilot Tirawuta|Tirawuta saja|hanya Tirawuta diaktifkan|baru aktif di Tirawuta|untuk pilot Tirawuta/);
 assert.match(html,/18 rencana/);
 assert.match(html,/6 wilayah/);
});
test('Catalog reconciles the curated snapshot with all administrative identities and plan references, fail closed',()=>{
 const {validateCatalog}=api();
 const d=structuredClone(registry);
 assert.equal(validateCatalog(d,entries,'01273'),d);
 assert.equal(d.regions.length,17);assert.equal(d.plans.length,18);
 assert.equal(d.plans.filter(p=>p.activity).length,16);
 assert.equal(d.regions.filter(r=>r.catalogStatus==='not_listed_in_public_catalog').length,6);
 const invalid=[
  x=>x.schemaVersion=2,x=>x.kbli='1273',x=>x.sourceStatus='live',x=>x.checkedAt='yesterday',
  x=>x.regions.pop(),x=>x.regions.push(structuredClone(x.regions[0])),x=>x.regions[0].id='unknown',
  x=>x.regions[0].name='Wrong',x=>x.regions[0].idNamespace='internal',x=>x.regions[0].gistaruId=null,
  x=>x.regions[0].planIds=[],x=>x.regions[2].catalogStatus='no_rdtr',
  x=>x.plans.push(structuredClone(x.plans[0])),x=>x.plans[0].id='7401000000:1',
  x=>x.plans[0].regionId='7406000000',x=>x.plans[0].activitiesUrl=x.plans[1].activitiesUrl,
  x=>x.plans[0].servicePath='https://evil.test/MapServer',x=>x.plans[0].activity.mappingReviewed=true,
  x=>x.plans[0].filterField='SQL',x=>x.plans[0].nativeWkid=12345,
  x=>x.plans[0].mappingStatus='reviewed',x=>x.plans.find(p=>p.activity===null).mappingStatus='unreviewed_relation'
 ];
 for(const mutate of invalid){const x=structuredClone(registry);mutate(x);assert.throws(()=>validateCatalog(x,entries,'01273'),String(mutate));}
});
test('Loader fetches every mappable plan at concurrency <=3 and retains independent failures',async()=>{
 const {createLoader}=api();assert.equal(typeof createLoader,'function');
 const {validateCollection}=require('../prototype/zone-data.js');let active=0,maxActive=0;const urls=[],updates=[];
 const loader=createLoader({validateCollection,onUpdate:records=>updates.push([...records.values()].filter(r=>r.status==='ready').length),fetchImpl:async(url,{signal})=>{
  assert.equal(signal.aborted,false);urls.push(url);active++;maxActive=Math.max(maxActive,active);
  await new Promise(resolve=>setTimeout(resolve,3));active--;
  const id=url.split('plan=')[1].split('&')[0];const p=registry.plans.find(p=>p.id===id);
  return {ok:id!==registry.plans[0].id,status:502,json:async()=>collection(p)};
 }});
 const records=await loader.start(registry.plans,'01273');
 assert.equal(urls.length,16);assert.equal(maxActive,3);assert.ok(updates.some(n=>n>0&&n<15));
 assert.equal([...records.values()].filter(r=>r.status==='ready').length,15);
 assert.equal(records.get(registry.plans[0].id).status,'error');
 assert.ok(urls.every(url=>/^\/api\/zones\?plan=74\d{8}:\d{3}&kbli=01273$/.test(url)));
 assert.equal(urls.some(url=>url.includes('7409000000:001')),false);
});
test('Loader abort/revision guard discards late old contexts and times out per plan without blocking the queue',async()=>{
 const {createLoader}=api();const {validateCollection}=require('../prototype/zone-data.js');const first=registry.plans[0],second=registry.plans[1];let resolveOld;const updates=[];
 const loader=createLoader({validateCollection,onUpdate:r=>updates.push([...r.keys()].join(',')),fetchImpl:async url=>{
  const p=url.includes(first.id)?first:second;if(p===first)await new Promise(resolve=>{resolveOld=resolve;});
  return {ok:true,json:async()=>collection(p)};
 }});
 const old=loader.start([first],'01273');await new Promise(resolve=>setImmediate(resolve));
 const fresh=await loader.start([second],'01273');const marker=updates.length;resolveOld();await old;await new Promise(resolve=>setImmediate(resolve));
 assert.equal(fresh.get(second.id).status,'ready');assert.equal(fresh.has(first.id),false);assert.equal(updates.length,marker);
 const timed=createLoader({validateCollection,timeoutMs:5,onUpdate:()=>{},fetchImpl:()=>new Promise(()=>{})});
 const records=await timed.start([first,second],'01273');assert.equal(records.get(first.id).error,'timeout');assert.equal(records.get(second.id).status,'error');
});
function displayCollection(p,id=17){
 const d=collection(p,id);for(const f of d.features){delete f.properties.regulation;f.properties.subzone_name=null;f.properties.source_bounds=[122,-4.1,122.1,-4];}
 d.meta.snapshotId='a'.repeat(64);d.meta.sourceCounts={...d.meta.counts};d.meta.sourceBounds=[122,-4.1,122.1,-4];d.meta.display={algorithmVersion:'coverage-lod-v1',purpose:'display-only-not-analysis-or-export',level:'overview',toleranceMeters:100,method:'coverage_simplify',fallbackReason:null,sourceFeatureCount:d.features.length,returnedFeatureCount:d.features.length,originalVertices:d.features.length*4,returnedVertices:d.features.length*4,bbox:null,validation:{featureIdsPreserved:true,geometryValid:true,coverageValid:true}};return d;
}
test('App renders every loaded plan as its own display overview and fetches snapshot-bound attributes on demand',async()=>{
 const h=appHarness(async url=>{const p=registry.plans.find(p=>url.includes('plan='+p.id+'&'));return {ok:true,json:async()=>displayCollection(p)};});await h.settle();
 const layers=[];h.context.window.testMap={removeLayer:()=>{},fitBounds:()=>{},setView:()=>{},getSize:()=>({x:900,y:600})};
 h.context.window.L={featureGroup:()=>({addTo(){return this;},addLayer(l){if(l.data)layers.push(l);},getBounds:()=>({isValid:()=>true}),clearLayers:()=>{layers.length=0;}}),geoJSON:(data,options)=>{
  const children=data.features.map(feature=>{const layer={feature,handlers:{},on(type,cb){this.handlers[type]=cb;},setStyle:()=>{},getBounds:()=>({isValid:()=>true})};options.onEachFeature(feature,layer);return layer;});
  return {data,getLayers:()=>children,getBounds:()=>({isValid:()=>true}),resetStyle:()=>{}};
 }};
 await h.run('map = window.testMap; loadZones()');await h.settle();
 assert.equal(h.requests.filter(u=>u.startsWith('/api/display')).length,16);
 assert.equal(h.requests.filter(u=>u.startsWith('/api/zones')).length,0);
 assert.equal(layers.length,16);assert.ok(layers.every(l=>l.data.meta.plan.id));
 assert.equal(h.el('zoneCount').textContent,'16');assert.equal(h.el('zoneList').children.length,16);
 const buttons=h.el('zoneList').children;assert.equal(new Set(buttons.map(b=>b.dataset.zoneId)).size,16);
 buttons[1].click();await h.settle();assert.match(h.el('zoneDetailContent').textContent,new RegExp(registry.plans[1].name));
 assert.match(h.el('zoneDetailContent').textContent,/KODSZN/);assert.match(h.el('zoneDetailContent').textContent,/034/);
 assert.match(h.el('coverageStatus').textContent,/16/);assert.match(h.el('zoneStatus').textContent,/parsial/i);
 const config=h.run('configuration()');assert.equal(config.schemaVersion,3);assert.equal(config.overlay.loadedPlanCount,16);assert.equal(config.overlay.unmappedPlanCount,2);
});
test('Paginated source list reaches features beyond 200 with provenance, stable controls, focus and applied reset',async()=>{
 const mappable=registry.plans.filter(p=>p.activity),first=mappable[0];
 const h=appHarness(async url=>{
  const p=mappable.find(p=>url.includes('plan='+p.id+'&')),d=displayCollection(p,1);
  if(p===first){d.features=Array.from({length:201},(_,i)=>displayCollection(p,i+1).features[0]);d.meta.counts={matched:201,returned:201,excludedInvalid:0};d.meta.sourceCounts={...d.meta.counts};Object.assign(d.meta.display,{sourceFeatureCount:201,returnedFeatureCount:201,originalVertices:804,returnedVertices:804});}
  return {ok:true,json:async()=>d};
 });await h.settle();
 const layers=[];h.context.window.testMap={removeLayer:()=>{},fitBounds:()=>{},setView:()=>{},getSize:()=>({x:900,y:600})};
 h.context.window.L={featureGroup:()=>({addTo(){return this;},addLayer(l){if(l.data)layers.push(l);},getBounds:()=>({isValid:()=>true})}),geoJSON:(data,options)=>{
  for(const f of data.features)options.onEachFeature(f,{feature:f,on:()=>{},setStyle:()=>{},getBounds:()=>({isValid:()=>true})});return {data};
 }};
 await h.run('map=window.testMap;loadZones()');await h.settle();
 const previous=h.el('zonePrevious'),next=h.el('zoneNext'),status=h.el('zonePageStatus');
 assert.ok(previous&&next&&status,'persistent native pagination controls and status exist');
 assert.equal(h.el('zoneList').children.length,200);assert.equal(previous.disabled,true);assert.equal(next.disabled,false);
 assert.match(status.textContent,/Halaman 1 dari 2/);assert.match(status.textContent,/1–200 dari 216/);
 assert.equal(layers.reduce((n,l)=>n+l.data.features.length,0),216,'map is never paginated');
 next.focus();next.click();
 assert.equal(h.el('zoneNext'),next,'same Next node survives renders');assert.equal(h.el('zonePrevious'),previous);
 assert.equal(h.el('zoneList').children.length,16);assert.match(status.textContent,/Halaman 2 dari 2/);assert.match(status.textContent,/201–216 dari 216/);
 assert.equal(next.disabled,true);assert.equal(previous.disabled,false);
 assert.equal(h.run('document.activeElement'),previous,'disabled last-page Next hands focus to usable Previous');
 const later=h.el('zoneList').children[0];assert.equal(later.dataset.zoneId,`${first.id}:201`);later.focus();
 h.run('renderZoneState()');assert.equal(h.run('document.activeElement').dataset.zoneId,`${first.id}:201`,'incremental update preserves focused feature and page');
 h.el('zoneList').children[0].click();await h.settle();assert.match(h.el('zoneDetailContent').textContent,new RegExp(`${first.id}:201`));
 h.el('zoneDialog').close();h.el('zoneList').children[1].click();await h.settle();assert.match(h.el('zoneDetailContent').textContent,new RegExp(mappable[1].id));h.el('zoneDialog').close();
 previous.focus();previous.click();assert.match(status.textContent,/Halaman 1 dari 2/);assert.equal(h.el('zoneList').children[0].dataset.zoneId,`${first.id}:1`);
 assert.equal(h.run('document.activeElement'),next,'disabled first-page Previous hands focus to usable Next');
 next.click();h.inputs.forEach(i=>i.checked=i.value===first.regionId);
 h.el('criteriaForm').dispatchEvent({type:'input'});assert.match(status.textContent,/Halaman 2 dari 2/,'draft does not reset applied page');
 h.el('criteriaForm').requestSubmit();await h.settle();assert.match(status.textContent,/Halaman 1 dari 2/,'applying criteria resets page');
 next.click();h.el('resetButton').click();await h.settle();assert.match(status.textContent,/Halaman 1 dari 2/,'reset criteria resets page');
 next.click();next.focus();h.run(`planRecords.delete(${JSON.stringify(first.id)});renderZoneState()`);
 assert.match(status.textContent,/Halaman 1 dari 1/);assert.match(status.textContent,/1–15 dari 15/,'shrinking records clamp page');
 assert.equal(previous.disabled,true);assert.equal(next.disabled,true);
 assert.equal(h.run('document.activeElement'),h.el('zoneList').children[0],'shrinking results never leave focus on a disabled pager');
 const shiftedKey=h.el('zoneList').children[0].dataset.zoneId;h.el('zoneList').children[0].focus();
 h.context.window.arrivingData=layers[0].data;h.run(`planRecords.set(${JSON.stringify(first.id)},{status:'ready',data:window.arrivingData});renderZoneState()`);
 assert.match(status.textContent,/Halaman 2 dari 2/,'earlier plan arrival moves the page to follow its focused source row');
 assert.equal(h.run('document.activeElement').dataset.zoneId,shiftedKey);
 h.run('clearZones()');assert.match(status.textContent,/Halaman 0 dari 0/);assert.match(status.textContent,/0 dari 0/);
 assert.equal(h.el('zoneList').children.length,0);assert.equal(previous.disabled,true);assert.equal(next.disabled,true);
});
test('App uses validated catalog for all plans, keeps audit historical and default full regions',async()=>{
 const h=appHarness();await h.settle();
 assert.equal(h.el('auditList').children.length,18);
 assert.equal(h.el('auditCount').textContent,'18');
 assert.equal(h.requests.filter(u=>u.startsWith('/api/catalog')).length,1);
 assert.equal(h.requests.filter(u=>u.startsWith('/api/zones')).length,0,'no geometry before map opt-in');
 assert.equal(h.inputs.length,17);assert.ok(h.inputs.every(i=>i.checked));
 assert.match(h.el('catalogStatus').textContent,/curated_source_snapshot/);
 assert.match(h.el('catalogGaps').textContent,/6/);
});
function mapHarness(h,{movementOnFit=false,width=900}={}){
 const handlers={},fits=[],fitOptions=[];let bbox=[122,-4.2,122.2,-3.9],zoom=7;
 const map={removeLayer:()=>{},fitBounds:(b,options)=>{fits.push(b);fitOptions.push(options);if(movementOnFit){const move=()=>{map.fire('zoomstart');map.fire('movestart');map.fire('moveend');};if(options?.animate===false)move();else setImmediate(move);}},setView:()=>{},getZoom:()=>zoom,getBounds:()=>({getWest:()=>bbox[0],getSouth:()=>bbox[1],getEast:()=>bbox[2],getNorth:()=>bbox[3]}),on:(name,fn)=>{(handlers[name]??=[]).push(fn);},fire:name=>(handlers[name]||[]).forEach(fn=>fn())};
 map.getSize=()=>({x:width,y:600});
 h.context.window.testMap=map;h.context.window.L={featureGroup:()=>({addTo(){return this;},addLayer(){},removeLayer(){}}),geoJSON:(data,options)=>{for(const f of data.features)options.onEachFeature(f,{feature:f,on(){},setStyle(){}});return {data};}};
 h.run('map=window.testMap;bindMapEvents()');return {fits,fitOptions,setView:(b,z)=>{bbox=b;zoom=z;},resize:w=>{width=w;map.fire('resize');},fire:map.fire};
}
test('viewport refresh keeps full keyboard inventory, renders only source-intersecting plans, never refits and reports empty viewport',async()=>{
 const h=appHarness(async url=>{const q=new URL(url,'http://unit.test').searchParams,p=registry.plans.find(p=>p.id===q.get('plan')),d=displayCollection(p);if(q.has('bbox')){d.meta.display.bbox=q.get('bbox').split(',').map(Number);d.meta.display.level=q.get('level');d.meta.display.toleranceMeters={overview:100,regional:10,detail:1}[q.get('level')];}return {ok:true,json:async()=>d};});await h.settle();
 const m=mapHarness(h);await h.run('loadZones()');await h.settle();assert.equal(h.run('featureLayers.size'),16);assert.equal(m.fits.length,1);
 const input=h.inputs[0],badge=h.el('regionOptions').children[0].children[2],badgeText=badge.textContent;input.checked=false;input.focus();
 h.run('window.coverageCalls=0;window.originalCoverage=renderRegionCoverage;renderRegionCoverage=()=>{window.coverageCalls++;window.originalCoverage();}');
 m.setView([120,-6,121,-5],14);await h.run('requestViewport()');await h.settle();
 assert.equal(h.run('window.coverageCalls'),0,'viewport never rerenders coverage');assert.equal(h.run('document.activeElement'),input);assert.equal(input.checked,false);assert.equal(h.el('regionOptions').children[0].children[2],badge);assert.equal(badge.textContent,badgeText);
 assert.equal(h.run('featureLayers.size'),0);assert.equal(h.run('layerMapper.size'),0);assert.equal(h.run('planRecords.size'),18);assert.equal(h.el('zoneList').children.length,16);assert.match(h.el('viewportStatus').textContent,/0.*viewport/i);assert.equal(m.fits.length,1);
 assert.match(h.el('zoneSummary').textContent,/18 rencana katalog.*16.*tersedia.*16.*overview dimuat.*0.*tergambar/);
 const config=h.run('configuration()');assert.equal(config.overlay.loadedFeatureCount,16);assert.equal(config.overlay.drawnFeatureCount,0);assert.equal(config.overlay.catalogPlanCount,18);assert.equal(config.overlay.availableFeatureCount,16);assert.equal(config.overlay.viewport.level,'detail');
 h.run('zoomAll()');assert.equal(m.fits.length,2);assert.deepEqual(JSON.parse(JSON.stringify(m.fits[1])),[[-4.1,122],[-4,122.1]]);
 m.setView([122,-4.2,122.2,-3.9],11);await h.run('requestViewport()');assert.equal(h.run('featureLayers.size'),16);assert.equal(h.run('viewportLevel'),'regional');assert.equal(m.fits.length,2);
 m.fire('movestart');m.setView([120,-6,121,-5],8);m.fire('moveend');assert.equal(h.run('userMoved'),true);await new Promise(r=>setTimeout(r,300));await h.settle();assert.equal(h.run('featureLayers.size'),0);assert.equal(m.fits.length,2);
 h.run('clearZones()');
});
test('all failed overviews remain error with unknown availability and visible failure counts after viewport refresh',async()=>{
 const h=appHarness(async()=>({ok:false,status:502}));await h.settle();mapHarness(h);await h.run('loadZones()');
 assert.equal(h.run('viewportPhase'),'error');
 await h.run('requestViewport()');
 assert.equal(h.run('viewportPhase'),'error');assert.equal(h.run('configuration().overlay.viewport.failedPlanCount'),16);
 assert.equal(h.run('configuration().overlay.availableFeatureCount'),null);assert.equal(h.run('configuration().overlay.drawnFeatureCount'),0);
 assert.match(h.el('viewportStatus').textContent,/16 gagal/);assert.doesNotMatch(h.el('viewportStatus').textContent,/0 fitur pada viewport/);
 assert.equal(h.el('retryZones').hidden,false);assert.equal(h.requests.filter(u=>u.includes('bbox=')).length,0);h.run('clearZones()');
});
test('known inventories outside viewport cannot turn missing source bounds into a complete empty result',async()=>{
 const p=registry.plans.find(p=>p.activity),h=appHarness(async url=>({ok:url.includes('plan='+p.id+'&'),status:502,json:async()=>displayCollection(p)}));
 await h.settle();h.run(`applied={kbli:'01273',regions:[${JSON.stringify(p.regionId)}]}`);const m=mapHarness(h);await h.run('loadZones()');
 const before=h.run('JSON.stringify([...planRecords])');m.setView([120,-6,121,-5],14);await h.run('requestViewport()');
 assert.equal(h.run('viewportPhase'),'partial');assert.equal(h.run('configuration().overlay.viewport.failedPlanCount'),1);
 assert.equal(h.run('configuration().overlay.availableFeatureCount'),null);assert.equal(h.run('configuration().overlay.drawnFeatureCount'),0);
 assert.match(h.el('viewportStatus').textContent,/1 gagal/);assert.match(h.el('viewportStatus').textContent,/parsial.*belum lengkap/);
 assert.doesNotMatch(h.el('viewportStatus').textContent,/0 fitur pada viewport/);assert.equal(h.run('JSON.stringify([...planRecords])'),before);
 assert.equal(h.requests.filter(u=>u.includes('bbox=')).length,0);h.run('clearZones()');
});
for(const [regionId,unmapped,notListed] of [['7471000000',1,0],['local:sultra:muna',0,1]])test(`viewport stays explicitly unavailable for unmapped/not-listed region ${regionId}`,async()=>{
 const h=appHarness();await h.settle();h.run(`applied={kbli:'01273',regions:[${JSON.stringify(regionId)}]}`);mapHarness(h);await h.run('loadZones()');
 assert.equal(h.run('viewportPhase'),'unavailable');await h.run('requestViewport()');
 assert.equal(h.run('viewportPhase'),'unavailable');assert.equal(h.run('configuration().overlay.viewport.state'),'unavailable');
 assert.equal(h.run('configuration().overlay.unmappedPlanCount'),unmapped);assert.equal(h.run('configuration().overlay.notListedRegionCount'),notListed);
 assert.equal(h.run('configuration().overlay.availableFeatureCount'),null);assert.equal(h.requests.filter(u=>u.startsWith('/api/display')).length,0);
 assert.match(h.el('viewportStatus').textContent,/belum tersedia/);assert.doesNotMatch(h.el('viewportStatus').textContent,/0 fitur pada viewport/);h.run('clearZones()');
});
test('outside-view loaded sources preserve catalog gaps while a fully known selection can report ready zero',async()=>{
 const p=registry.plans.find(p=>p.activity),h=appHarness(async url=>{const plan=registry.plans.find(p=>url.includes('plan='+p.id+'&'));return {ok:true,json:async()=>displayCollection(plan)};});
 await h.settle();const m=mapHarness(h);
 for(const gaps of [true,false]){
  h.context.window.selectedRegions=[p.regionId,...(gaps?['7471000000','local:sultra:muna']:[])];h.run(`applied={kbli:'01273',regions:window.selectedRegions}`);await h.run('loadZones()');
  m.setView([120,-6,121,-5],14);await h.run('requestViewport()');assert.equal(h.run('viewportPhase'),gaps?'partial':'ready');
  assert.equal(h.run('configuration().overlay.viewport.state'),gaps?'partial':'ready');assert.equal(h.run('configuration().overlay.drawnFeatureCount'),0);
  if(gaps){assert.match(h.el('coverageStatus').textContent,/1 relasi kegiatan belum tersedia; 1 wilayah tidak tercantum/);assert.doesNotMatch(h.el('viewportStatus').textContent,/0 fitur pada viewport/);}
  else assert.match(h.el('viewportStatus').textContent,/0 fitur pada viewport/);
 }
 h.run('clearZones()');
});
test('a failed area request remains error when only a different fully loaded source is outside the viewport',async()=>{
 const p=registry.plans.find(p=>p.activity),h=appHarness(async url=>{
  const q=new URL(url,'http://unit.test').searchParams,plan=registry.plans.find(p=>p.id===q.get('plan'));
  if(q.has('bbox'))return {ok:false,status:502};
  const d=displayCollection(plan);if(plan.id!==p.id){d.meta.sourceBounds=[124,-4.1,124.1,-4];d.features[0].properties.source_bounds=[...d.meta.sourceBounds];for(const point of d.features[0].geometry.coordinates[0])point[0]+=2;}
  return {ok:true,json:async()=>d};
 });
 await h.settle();h.run(`applied={kbli:'01273',regions:[${JSON.stringify(p.regionId)}]}`);mapHarness(h);await h.run('loadZones()');await h.run('requestViewport()');
 assert.equal(h.run('configuration().overlay.loadedPlanCount'),2);assert.equal(h.run('viewportPhase'),'error');
 assert.equal(h.run('configuration().overlay.viewport.failedPlanCount'),1);assert.equal(h.run('featureLayers.size'),0);h.run('clearZones()');
});
test('closing pending detail cancels the response, restores current list focus, and 409 never shows attributes',async()=>{
 let release,conflict=false;
 const h=appHarness(async url=>{const p=registry.plans.find(p=>url.includes('plan='+p.id+'&'));if(url.startsWith('/api/feature-detail')){if(conflict)return {ok:false,status:409};await new Promise(r=>release=r);}return {ok:true,json:async()=>displayCollection(p)};});await h.settle();mapHarness(h);await h.run('loadZones()');
 const row=h.el('zoneList').children[0];row.focus();row.click();await h.settle();assert.equal(h.el('zoneDialog').open,true);h.run('renderZoneState()');h.el('zoneDialog').close();release();await h.settle();
 assert.equal(h.el('zoneDialog').open,false);assert.equal(h.run('detailState'),'idle');assert.equal(h.run('document.activeElement').dataset.zoneId,row.dataset.zoneId);
 conflict=true;h.el('zoneList').children[0].click();await h.settle();assert.equal(h.run('detailState'),'reload-required');assert.match(h.el('zoneDetailContent').textContent,/409/);assert.doesNotMatch(h.el('zoneDetailContent').textContent,/KODSZN/);assert.equal(h.el('retryZones').hidden,false);h.el('zoneDialog').close();h.run('renderZoneState()');assert.equal(h.el('retryZones').hidden,false,'snapshot conflict survives dialog close and pagination renders');assert.equal(h.run('configuration().overlay.viewport.state'),'reload-required');h.run('clearZones()');
});
test('a failed viewport cannot reuse old layers and exposes retry; changed snapshots require explicit reload',async()=>{
 let mode='ok';
 const h=appHarness(async url=>{const q=new URL(url,'http://unit.test').searchParams,p=registry.plans.find(p=>p.id===q.get('plan')),d=displayCollection(p);if(q.has('bbox')){if(mode==='fail')return {ok:false,status:502};d.meta.snapshotId='b'.repeat(64);d.meta.display.bbox=q.get('bbox').split(',').map(Number);d.meta.display.level=q.get('level');d.meta.display.toleranceMeters=10;}return {ok:true,json:async()=>d};});await h.settle();const m=mapHarness(h);await h.run('loadZones()');mode='fail';m.setView([122,-4.2,122.2,-3.9],11);await h.run('requestViewport()');
 assert.equal(h.run('featureLayers.size'),0);assert.equal(h.run('viewportPhase'),'error');assert.equal(h.el('retryZones').hidden,false);assert.equal(h.el('zoneList').children.length,16);
 mode='snapshot';await h.run('requestViewport()');assert.equal(h.run('viewportPhase'),'reload-required');assert.equal(h.run('featureLayers.size'),0);assert.equal(h.run('planRecords.values().next().value.data.meta.snapshotId'),'a'.repeat(64));assert.equal(h.requests.some(u=>u.startsWith('/api/zones')),false);h.run('clearZones()');
});
test('row navigation preserves its own detail when animated fitBounds would queue movement after openZone',async()=>{
 let release;
 const h=appHarness(async url=>{const p=registry.plans.find(p=>url.includes('plan='+p.id+'&'));if(url.startsWith('/api/feature-detail'))await new Promise(r=>release=r);return {ok:true,json:async()=>displayCollection(p)};});
 await h.settle();const m=mapHarness(h,{movementOnFit:true});await h.run('loadZones()');await h.settle();
 // Leaflet's animate:false path emits movement synchronously before fitBounds returns.
 // Animated zoom can queue those same starts until after openZone has run.
 const row=h.el('zoneList').children[0];row.click();await h.settle();
 assert.equal(h.el('zoneDialog').open,true);assert.equal(h.run('detailState'),'loading');
 release();await h.settle();assert.equal(h.run('detailState'),'ready');assert.equal(h.el('zoneDialog').open,true);
 row.click();await h.settle();m.fire('movestart');assert.equal(h.el('zoneDialog').open,false);
 release();await h.settle();assert.equal(h.run('detailState'),'idle');assert.equal(h.el('zoneDialog').open,false);h.run('clearZones()');
});
test('late detail is invalidated by movement and criteria; offscreen rows navigate by source bounds without a drawn layer',async()=>{
 let release;
 const h=appHarness(async url=>{const p=registry.plans.find(p=>url.includes('plan='+p.id+'&'));if(url.startsWith('/api/feature-detail'))await new Promise(r=>release=r);return {ok:true,json:async()=>displayCollection(p)};});await h.settle();const m=mapHarness(h);await h.run('loadZones()');m.setView([120,-6,121,-5],14);await h.run('requestViewport()');
 const row=h.el('zoneList').children[0];row.focus();row.click();await h.settle();assert.deepEqual(JSON.parse(JSON.stringify(m.fits.at(-1))),[[-4.1,122],[-4,122.1]]);assert.equal(h.run('featureLayers.size'),0);m.fire('movestart');release();await h.settle();assert.equal(h.el('zoneDialog').open,false);
 h.el('zoneList').children[0].click();await h.settle();h.inputs.forEach(i=>i.checked=i.value==='local:sultra:muna');h.el('criteriaForm').requestSubmit();release();await h.settle();assert.equal(h.el('zoneDialog').open,false);assert.equal(h.run('planRecords.size'),0);assert.equal(h.run('featureLayers.size'),0);assert.equal(m.fits.length,3);h.run('clearZones()');
});
test('benchmark no-op viewport hook retains all 5994 synthetic inventory features across 16 overview layers and 30 pages',async()=>{
 const first=registry.plans.find(p=>p.activity);
 const h=appHarness(async url=>{const p=registry.plans.find(p=>url.includes('plan='+p.id+'&')),d=displayCollection(p,1);if(p.id===first.id){d.features=Array.from({length:5979},(_,i)=>displayCollection(p,i+1).features[0]);d.meta.counts={matched:5979,returned:5979,excludedInvalid:0};d.meta.sourceCounts={...d.meta.counts};Object.assign(d.meta.display,{sourceFeatureCount:5979,returnedFeatureCount:5979,originalVertices:23916,returnedVertices:23916});}return {ok:true,json:async()=>d};});await h.settle();mapHarness(h);h.run('requestViewport=async()=>{}');await h.run('loadZones()');
 assert.equal(h.run('layerMapper.size'),16);assert.equal(h.run('featureLayers.size'),5994);assert.equal(h.run('configuration().overlay.loadedFeatureCount'),5994);assert.match(h.el('zonePageStatus').textContent,/Halaman 1 dari 30/);h.run('zonePage=29;renderZoneState()');assert.equal(h.el('zoneList').children.length,194);assert.match(h.el('zonePageStatus').textContent,/5801–5994 dari 5994/);assert.equal(h.el('zoneNext').disabled,true);h.run('clearZones()');
});
test('selected styling survives a viewport redraw and configuration reports the actual Leaflet renderer',async()=>{
 const h=appHarness(async url=>{const p=registry.plans.find(p=>url.includes('plan='+p.id+'&'));return {ok:true,json:async()=>displayCollection(p)};});await h.settle();mapHarness(h);await h.run('loadZones()');
 h.context.window.testMap.options={preferCanvas:true};assert.equal(h.run('configuration().overlay.renderer'),'canvas');
 const selected=`${registry.plans[0].id}:17`;h.context.window.selected=selected;h.context.window.L.geoJSON=(data,options)=>{h.context.window.redrawnStyle=options.style(data.features[0]);return {data};};h.run('selectedFeatureKey=window.selected;clearDrawing();drawPlan(planRecords.values().next().value.data)');assert.equal(h.context.window.redrawnStyle.stroke,true);assert.equal(h.context.window.redrawnStyle.weight,2.2);h.run('clearZones()');
});
test('user movement during initial overview prevents autofocus and viewport requests wait for debounced moveend',async()=>{
 let release,gate=true;const first=registry.plans[0];
 const h=appHarness(async url=>{const p=registry.plans.find(p=>url.includes('plan='+p.id+'&'));if(gate&&p.id===first.id)await new Promise(r=>release=r);return {ok:true,json:async()=>displayCollection(p)};});await h.settle();const m=mapHarness(h);const pending=h.run('loadZones()');await h.settle();m.fire('movestart');gate=false;release();await pending;assert.equal(m.fits.length,0);assert.equal(h.run('viewportTimer'),null);assert.equal(h.run('featureLayers.size'),16);
 m.fire('moveend');assert.notEqual(h.run('viewportTimer'),null);h.run('clearZones()');
});
test('selection styles only changed layers, while zoom and hover retain their styles',async t=>{
 const h=appHarness(async url=>{const p=registry.plans.find(p=>url.includes('plan='+p.id+'&'));return {ok:true,json:async()=>displayCollection(p)};});
 await h.settle();const m=mapHarness(h);await h.run('loadZones()');h.run('cancelViewport()');
 const calls=[];for(const [key,layer]of h.run('featureLayers'))layer.setStyle=style=>calls.push({key,style});
 const rows=h.el('zoneList').children,counts=[];
 for(const row of [rows[0],rows[1],rows[1]]){calls.length=0;row.click();await h.settle();counts.push(calls.length);}
 t.diagnostic('selection setStyle counts '+JSON.stringify(counts));assert.deepEqual(counts,[1,2,0]);
 assert.equal(h.run('selectedFeatureKey'),rows[1].dataset.zoneId);assert.equal(h.el('zoneDialog').open,true);
 calls.length=0;m.setView([122,-4.2,122.2,-3.9],14);m.fire('zoomend');assert.equal(calls.length,16,'zoom restyles every drawn feature');
 assert.equal(calls.find(c=>c.key===rows[1].dataset.zoneId).style.stroke,true);
 calls.length=0;h.run('applyFeatureStyle(featureLayers.values().next().value,true)');assert.equal(calls.length,1);assert.equal(calls[0].style.stroke,true);
 h.run('applyFeatureStyle(featureLayers.values().next().value)');assert.deepEqual(calls.at(-1).style,require('../prototype/map-style.js').styleForZoom(14));
 h.context.window.oldSelection=rows[1].dataset.zoneId;h.run('featureLayers.delete(window.oldSelection)');calls.length=0;rows[2].click();await h.settle();assert.equal(calls.length,1,'offscreen previous selection needs no style write');
 h.el('zoneDialog').close();assert.equal(h.run('document.activeElement'),rows[2]);h.run('clearZones()');
});
test('viewport-only updates do no inventory aggregation or list/audit mutations; in-place arrivals still render',async t=>{
 const h=appHarness(async url=>{const q=new URL(url,'http://unit.test').searchParams,p=registry.plans.find(p=>p.id===q.get('plan')),d=displayCollection(p);if(q.has('bbox')){d.meta.display.bbox=q.get('bbox').split(',').map(Number);d.meta.display.level=q.get('level');d.meta.display.toleranceMeters=10;}return {ok:true,json:async()=>d};});
 await h.settle();const m=mapHarness(h);h.metrics.aggregate=0;await h.run('loadZones()');h.run('cancelViewport()');
 t.diagnostic('overview transition aggregate calls '+h.metrics.aggregate);assert.equal(h.metrics.aggregate,17,'initial publication plus each of 16 arrivals, no duplicate completion aggregate');
 const row=h.el('zoneList').children[0],auditRow=h.el('auditList').children[0];row.focus();
 h.metrics.aggregate=0;h.metrics.zoneList=0;h.metrics.auditList=0;
 m.setView([122,-4.2,122.2,-3.9],11);await h.run('requestViewport()');
 t.diagnostic('viewport counters '+JSON.stringify(h.metrics));
 assert.deepEqual(h.metrics,{aggregate:0,zoneList:0,auditList:0});
 assert.equal(h.el('zoneList').children[0],row);assert.equal(h.el('auditList').children[0],auditRow);assert.equal(h.run('document.activeElement'),row);
 assert.match(h.el('zoneSummary').textContent,/16 fitur tergambar/);assert.equal(h.run('configuration().overlay.viewport.level'),'regional');
 const before=h.run('planRecords');h.run('planRecords.delete(plans.find(p=>p.activity).id);renderZoneState()');
 assert.equal(h.run('planRecords'),before,'Map mutated in place');assert.equal(h.el('zoneList').children.length,15);assert.match(h.el('auditList').children[0].textContent,/idle/);
 assert.equal(h.metrics.aggregate,1,'one aggregation for an inventory transition');
 h.run('clearZones()');
});
test('NAV-01 explicit apply refocuses after initial load and repeated user pans, without source-list clicks',async()=>{
 const h=appHarness(async url=>{const p=registry.plans.find(p=>url.includes('plan='+p.id+'&'));return {ok:true,json:async()=>displayCollection(p)};});await h.settle();const m=mapHarness(h);
 await h.run('loadZones()');assert.equal(m.fits.length,1);
 for(let i=0;i<2;i++){m.fire('movestart');m.setView([120,-6,121,-5],7);m.fire('moveend');h.el('criteriaForm').requestSubmit();await h.settle();assert.equal(m.fits.length,i+2);assert.equal(h.el('zoneList').children.length,16);assert.equal(h.el('zoneDialog').open,false);}
 await h.run('requestViewport()');assert.equal(m.fits.length,3);h.run('clearZones()');
});
test('NAV-01 fresh apply scrolls map into view but user movement after apply cancels pending camera intention',async()=>{
 let release,gate=false;const first=registry.plans.find(p=>p.activity);
 const h=appHarness(async url=>{const p=registry.plans.find(p=>url.includes('plan='+p.id+'&'));if(gate&&p===first)await new Promise(r=>release=r);return {ok:true,json:async()=>displayCollection(p)};});await h.settle();const m=mapHarness(h,{movementOnFit:true});await h.run('loadZones()');assert.equal(h.el('map').scrolls.length,0);
 h.el('criteriaForm').requestSubmit();await h.settle();assert.equal(m.fits.length,2);assert.equal(h.el('map').scrolls.length,1);assert.equal(m.fitOptions.at(-1).animate,false);
 gate=true;h.el('criteriaForm').requestSubmit();await h.settle();m.fire('movestart');m.fire('moveend');gate=false;release();await h.settle();assert.equal(m.fits.length,2);assert.equal(h.el('map').scrolls.length,1);h.run('clearZones()');
});
test('NAV-02/03/04/07 beacons group ready source bounds, support pointer/keyboard and survive viewport without rebuilds',async t=>{
 const h=appHarness(async url=>{const q=new URL(url,'http://unit.test').searchParams,p=registry.plans.find(p=>p.id===q.get('plan')),d=displayCollection(p);if(q.has('bbox')){d.meta.display.bbox=q.get('bbox').split(',').map(Number);d.meta.display.level=q.get('level');d.meta.display.toleranceMeters=10;}return {ok:true,json:async()=>d};});await h.settle();const m=mapHarness(h);await h.run('loadZones()');h.run('cancelViewport()');
 const expected=new Set(registry.plans.filter(p=>p.activity).map(p=>p.regionId)).size;
 assert.equal(h.run('regionBeaconLayers.size'),expected);assert.ok(expected<=17);assert.equal(h.run('featureLayers.size'),16);
 const [region,beacon]=h.run('[...regionBeaconLayers][0]'),node=beacon.getElement();assert.equal(node.dataset.region,region);assert.equal(node.getAttribute('role'),'button');assert.equal(node.getAttribute('tabindex'),'0');assert.match(node.getAttribute('aria-label'),/sumber.*bukan batas/i);assert.equal(beacon.tooltip.tagName,'span');
 const before=h.requests.length;beacon.fire('click');assert.equal(m.fits.length,2);assert.deepEqual(JSON.parse(JSON.stringify(m.fits.at(-1))),[[-4.1,122],[-4,122.1]]);assert.equal(m.fitOptions.at(-1).animate,false);assert.equal(m.fitOptions.at(-1).maxZoom,14);
 for(const key of ['Enter',' ']){let prevented=false;node.dispatchEvent({type:'keydown',key,preventDefault(){prevented=true;},stopPropagation(){}});assert.equal(prevented,true);}assert.equal(m.fits.length,4);assert.equal(h.requests.length,before,'navigation adds no fetch');
 const created=h.circles.length;h.metrics.aggregate=0;h.metrics.zoneList=0;h.metrics.auditList=0;m.setView([122,-4.2,122.2,-3.9],11);m.fire('zoomend');assert.equal(h.run('regionBeaconsVisible'),false);await h.run('requestViewport()');
 assert.equal(h.circles.length,created);assert.deepEqual(h.metrics,{aggregate:0,zoneList:0,auditList:0});assert.equal(h.run('regionBeaconLayers.get('+JSON.stringify(region)+')'),beacon);
 m.setView([122,-4.2,122.2,-3.9],9);m.fire('zoomend');assert.equal(h.run('regionBeaconsVisible'),true);t.diagnostic(JSON.stringify({markers:expected,viewportBeaconRebuilds:h.circles.length-created,navigationFetches:0,viewportMutations:h.metrics}));h.run('clearZones()');assert.equal(h.run('regionBeaconLayers.size'),0);
});
test('NAV-mobile resize updates fixed pixel radii in place, without inventory, fetch or camera work',async t=>{
 const h=appHarness(async url=>{const p=registry.plans.find(p=>url.includes('plan='+p.id+'&'));return {ok:true,json:async()=>displayCollection(p)};});await h.settle();const m=mapHarness(h,{width:390});await h.run('loadZones()');h.run('cancelViewport()');
 const beacons=[...h.run('regionBeaconLayers.values()')],nodes=beacons.map(b=>b.getElement()),created=h.circles.length,requests=h.requests.length,fits=m.fits.length;
 assert.ok(beacons.length>0);assert.ok(beacons.every(b=>b.options.radius===12),'mobile targets retain 24px diameter');
 assert.ok(beacons.every(b=>b.options.pane==='markerPane'),'navigation stays above source polygons added by later viewport responses');
 h.metrics.aggregate=0;h.metrics.zoneList=0;h.metrics.auditList=0;
 h.run("for(const record of planRecords.values())if(record.data)record.data.features=new Proxy(record.data.features,{get(){throw Error('resize walked features');}})");
 m.resize(500);assert.ok(beacons.every(b=>b.options.radius===16));m.resize(499);assert.ok(beacons.every(b=>b.options.radius===12));
 assert.equal(h.circles.length,created);assert.ok(beacons.every((b,i)=>b.getElement()===nodes[i]));assert.equal(h.requests.length,requests);assert.equal(m.fits.length,fits);assert.deepEqual(h.metrics,{aggregate:0,zoneList:0,auditList:0});
 m.fire('zoomend');assert.equal(h.run('regionBeaconsVisible'),true);t.diagnostic(JSON.stringify({mobileRadius:12,desktopRadius:16,breakpoint:500,resizeRebuilds:0,resizeFetches:0,resizeCamera:0,resizeMutations:h.metrics}));h.run('clearZones()');
});
test('NAV-02 regional bounds union reads inventory metadata without walking feature coordinates',async()=>{
 const h=appHarness();await h.settle();const m=mapHarness(h),same=registry.plans.filter(p=>p.activity&&p.regionId===registry.plans.find(p=>p.activity).regionId);assert.ok(same.length>1);
 h.context.window.navInventories=same.map((p,i)=>{const d=displayCollection(p);if(i)d.meta.sourceBounds=[123,-5,124,-3];d.features=new Proxy(d.features,{get(target,key){if(key!=='length')throw new Error('navigation walked features');return target.length;}});return [p.id,{status:'ready',data:d}];});
 h.run('planRecords=new Map(window.navInventories);renderRegionBeacons()');assert.equal(h.run('regionBeaconLayers.size'),1);h.run('[...regionBeaconLayers.values()][0].fire("click")');assert.deepEqual(JSON.parse(JSON.stringify(m.fits[0])),[[-5,122],[-3,124]]);assert.equal(h.requests.filter(u=>u.startsWith('/api/display')).length,0);h.run('clearZones()');
});
test('NAV-05 stale loads cannot restore cleared beacons; unknown, empty, failed and unimported sources create none',async()=>{
 let release,gate=false;const first=registry.plans.find(p=>p.activity);
 const h=appHarness(async url=>{const p=registry.plans.find(p=>url.includes('plan='+p.id+'&'));if(gate&&p===first)await new Promise(r=>release=r);return {ok:true,json:async()=>displayCollection(p)};});await h.settle();const m=mapHarness(h);await h.run('loadZones()');
 gate=true;h.el('criteriaForm').requestSubmit();await h.settle();assert.ok(h.run('regionBeaconLayers.size')>0,'partial successful arrivals navigate honestly');h.inputs.forEach(i=>i.checked=i.value==='local:sultra:muna');h.el('criteriaForm').requestSubmit();assert.equal(h.run('regionBeaconLayers.size'),0);gate=false;release();await h.settle();assert.equal(h.run('regionBeaconLayers.size'),0);assert.equal(m.fits.length,1);
 h.context.window.navData=displayCollection(first);h.run(`applied.regions=[window.navData.meta.plan.regionId];planRecords=new Map([[window.navData.meta.plan.id,{status:'ready',data:window.navData}]]);regions[window.navData.meta.plan.regionId]='<img src=x onerror=alert(1)>';renderRegionBeacons()`);assert.equal(h.run('regionBeaconLayers.size'),1);assert.match(h.run('[...regionBeaconLayers.values()][0]').tooltip.textContent,/<img/);assert.equal(h.run('[...regionBeaconLayers.values()][0]').tooltip.children.length,0);
 for(const change of ["window.navData.features=[]","window.navData.features=[{}];window.navData.meta.sourceBounds=null","planRecords.get(window.navData.meta.plan.id).status='error'","planRecords.clear()"]){h.run(change+';renderRegionBeacons()');assert.equal(h.run('regionBeaconLayers.size'),0);}
 h.context.window.navData=displayCollection(first);h.run(`planRecords=new Map([[window.navData.meta.plan.id,{status:'ready',data:window.navData}]]);plans.find(p=>p.id===window.navData.meta.plan.id).localDataset={available:false};renderRegionBeacons()`);assert.equal(h.run('regionBeaconLayers.size'),0,'not-in-release does not become a circle');
 h.run('clearZones()');
});
test('NAV-01 apply before map opt-in retains explicit intention without network and fits once activated',async()=>{
 const h=appHarness(async url=>{const p=registry.plans.find(p=>url.includes('plan='+p.id+'&'));return {ok:true,json:async()=>displayCollection(p)};});await h.settle();h.el('criteriaForm').requestSubmit();await h.settle();assert.equal(h.requests.filter(u=>u.startsWith('/api/display')).length,0);assert.equal(h.run('pendingApplyFocus'),true);const m=mapHarness(h);h.run('userMoved=true');await h.run('loadZones()');assert.equal(m.fits.length,1);assert.equal(h.el('map').scrolls.length,1);assert.equal(h.run('pendingApplyFocus'),false);h.run('clearZones()');
});
test('NAV-03 overview explains gold navigation circles separately from blue relevance',async()=>{
 const h=appHarness(async url=>{const p=registry.plans.find(p=>url.includes('plan='+p.id+'&'));return {ok:true,json:async()=>displayCollection(p)};});
 await h.settle();mapHarness(h);await h.run('loadZones()');
 assert.match(h.el('mapKey').textContent,/Lingkaran emas.*klik.*sentuh.*sumber/i);h.run('clearZones()');
});
test('NAV-03 beacon keyboard focus has a visible nonanimated affordance',()=>{
 const css=fs.readFileSync(require('node:path').join(__dirname,'../prototype/zones.css'),'utf8');assert.match(css,/\.region-beacon:focus-visible/);assert.match(css,/\.region-beacon\{[^}]*cursor:pointer/);
});
test('regional coverage distinguishes storage, gaps and request overrides without replacing draft controls',async()=>{
 const h=appHarness();await h.settle();const badges=h.el('regionOptions').children.map(row=>row.children[2]);
 assert.equal(badges.length,17);assert.ok(badges.every(Boolean));assert.match(h.el('regionCoverageSummary').textContent,/6.*tidak tercantum/);
 assert.match(h.el('regionCoverageSummary').textContent,/2.*relasi kegiatan/);
 const input=h.inputs[0];input.checked=false;input.focus();h.run('renderAudit()');assert.equal(h.inputs[0],input);assert.equal(h.run('document.activeElement'),input);assert.equal(input.checked,false);
 assert.equal(h.el('regionOptions').children[0].children[2],badges[0]);
 const p=registry.plans[0],planBadge=badges[entries.findIndex(r=>r.id===p.regionId)];h.context.window.samplePlan=p;
 assert.equal(h.run("coveragePlanState({...window.samplePlan,localDataset:{available:true},localStorage:{state:'stored'}})"),'active');
 assert.equal(h.run("coveragePlanState({...window.samplePlan,localDataset:{available:false},localStorage:{state:'stored'}})"),'stored_not_active');
 assert.equal(h.run("coveragePlanState({...window.samplePlan,localDataset:{available:false},localStorage:{state:'not_stored'}})"),'not_stored');
 assert.equal(h.run('coveragePlanState(window.samplePlan)'),'unknown');
 h.run("planRecords.set(window.samplePlan.id,{status:'loading'});renderAudit()");assert.match(planBadge.textContent,/memuat/);
 h.run("planRecords.set(window.samplePlan.id,{status:'error'});renderAudit()");assert.match(planBadge.textContent,/gagal/);assert.match(h.el('regionCoverageSummary').textContent,/1.*gagal/);
 const before=h.requests.length;h.run('renderRegionCoverage()');assert.equal(h.requests.length,before);assert.equal(h.run('document.activeElement'),input);
 const gap=registry.regions.find(r=>!r.planIds.length);const badge=badges[entries.findIndex(r=>r.id===gap.id)];assert.match(badge.textContent,/tidak tercantum/);assert.doesNotMatch(badge.textContent,/tidak ada RDTR/);
});
function appHarness(fetchZones,catalogFixture=registry){
 const vm=require('node:vm');const elements=new Map(),inputs=[],tabs=[],requests=[],metrics={aggregate:0,zoneList:0,auditList:0};
 const mutation=el=>{for(const id of ['zoneList','auditList'])if(elements.get(id)===el)metrics[id]++;};
 class Element{
  constructor(tag='div'){this.tagName=tag;this.children=[];this.listeners={};this.attributes={};this.dataset={};this._text='';this.checked=false;this.hidden=false;this.open=false;this.scrolls=[];}
  scrollIntoView(options){this.scrolls.push(options);}
  set textContent(v){mutation(this);this._text=String(v);this.children=[];}get textContent(){return this._text+this.children.map(c=>c.textContent||'').join('');}
  append(...items){if(items.length)mutation(this);this.children.push(...items);for(const i of items){if(i.name==='region')inputs.push(i);}}
  replaceChildren(...items){mutation(this);this.children=[];this._text='';this.append(...items);}
  addEventListener(type,cb){(this.listeners[type]??=[]).push(cb);}dispatchEvent(e){for(const cb of this.listeners[e.type]||[])cb(e);return true;}
  setAttribute(k,v){this.attributes[k]=String(v);}getAttribute(k){return this.attributes[k];}
  showModal(){this.open=true;}close(){if(this.open){this.open=false;this.dispatchEvent({type:'close'});}}focus(){document.activeElement=this;}remove(){}click(){if(!this.disabled)this.dispatchEvent({type:'click'});}
  reset(){inputs.forEach(i=>{i.checked=true;});}requestSubmit(){this.dispatchEvent({type:'submit',currentTarget:this,preventDefault:()=>{}});}
 }
 const html=fs.readFileSync(require('node:path').join(__dirname,'../prototype/index.html'),'utf8');
 for(const [,id]of html.matchAll(/id="([^"]+)"/g))elements.set(id,new Element());
 for(const name of ['zones','audit','export']){const t=elements.get('tab-'+name);t.dataset.tab=name;tabs.push(t);}
 const document={querySelector:s=>elements.get(s.slice(1))||null,querySelectorAll:s=>s==='[role=tab]'?tabs:s==='[data-close]'?[]:s==='[name=region]:checked'?inputs.filter(i=>i.checked):s==='[name=region]'?inputs:[],createElement:tag=>new Element(tag),createTextNode:s=>({textContent:s}),head:new Element(),body:new Element()};
 const fetchImpl=async(url,options)=>{requests.push(url);if(url.startsWith('/api/catalog'))return {ok:true,json:async()=>structuredClone(catalogFixture)};if(url==='audit-summary.json')return {ok:true,json:async()=>({schemaVersion:1,plans:[]})};if(fetchZones){const response=await fetchZones(url,options);if(url.startsWith('/api/feature-detail')&&response.ok){const d=await response.json();if(d.schemaVersion===1)return {ok:true,json:async()=>d};const oid=Number(new URL(url,'http://unit.test').searchParams.get('objectId')),f=d.features.find(f=>f.id===oid);return {ok:true,json:async()=>({schemaVersion:1,planId:d.meta.plan.id,objectId:oid,snapshotId:d.meta.snapshotId,properties:{...f.properties,regulation:null},sourceBounds:f.properties.source_bounds,meta:d.meta})};}return response;}throw new Error('unexpected fetch '+url);};
 const context=vm.createContext({console,window:{DisplayData:require('../prototype/display-data.js'),MapStyle:require('../prototype/map-style.js'),RegionData:{entries},ProvinceData:{...api(),aggregate:(...args)=>{metrics.aggregate++;return api().aggregate(...args);}},ZoneData:require('../prototype/zone-data.js')},document,fetch:fetchImpl,AbortController,URL,Blob,Event,setTimeout,clearTimeout,FormData:class{constructor(){this.get=()=> '01273';this.getAll=()=>inputs.filter(i=>i.checked).map(i=>i.value);}}});
 const circles=[];let leaflet;
 Object.defineProperty(context.window,'L',{get:()=>leaflet,set:value=>{leaflet={...value,circleMarker:(center,options)=>{const node=new Element('path'),handlers={};const circle={center,options,setRadius(radius){this.options.radius=radius;return this;},on(type,fn){handlers[type]=fn;return this;},fire(type){handlers[type]?.();},bindTooltip(content){this.tooltip=content;return this;},getElement:()=>node};circles.push(circle);return circle;}};}});
 // Browser checkbox defaultChecked also sets checked before dirty selection.
 const create=document.createElement;document.createElement=tag=>{const e=create(tag);Object.defineProperty(e,'defaultChecked',{set(v){this.checked=v;}});return e;};
 vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../prototype/app.js'),'utf8'),context);
 return {context,metrics,circles,el:id=>elements.get(id),inputs,requests,settle:async()=>{for(let i=0;i<10;i++)await new Promise(r=>setImmediate(r));},run:code=>vm.runInContext(code,context)};
}
test('Schema v3 export is an immutable applied preview, contains no geometry or draft criteria',()=>{
 const {configuration}=api();const records=new Map();const p=registry.plans[0];records.set(p.id,{status:'ready',data:collection(p)});
 const applied={kbli:'01273',regions:['7401000000']};
 const snapshot=configuration(registry,entries,applied,records,true);
 assert.equal(snapshot.schemaVersion,3);assert.equal(snapshot.containsGeometry,false);
 assert.equal(snapshot.kbli.mappingReviewed,false);assert.equal(snapshot.kbli.scopeConfirmed,false);
 assert.equal(snapshot.overlay.requestedPlanCount,2);assert.equal(snapshot.overlay.loadedPlanCount,1);assert.equal(snapshot.overlay.state,'partial');
 assert.equal(snapshot.overlay.plans[0].source.status,'live');assert.equal(snapshot.overlay.plans[1].source,null);
 assert.equal(snapshot.regions[0].name,'Kabupaten Kolaka');assert.equal(snapshot.regions[0].idNamespace,'gistaru');
 const before=JSON.stringify(snapshot);applied.regions.push('7471000000');records.get(p.id).data.meta.source.status='cached_snapshot';records.get(p.id).data.meta.counts.returned=99;
 assert.equal(JSON.stringify(snapshot),before);
 for(const forbidden of ['coordinates','FeatureCollection','object_id','area','road','candidate'])assert.ok(!JSON.stringify(snapshot).includes(forbidden),forbidden);
 const unavailable=configuration(null,entries,{kbli:'01273',regions:['local:sultra:muna']},new Map(),false,'error');
 assert.equal(unavailable.overlay.state,'error');assert.equal(unavailable.overlay.requestedPlanCount,null,'unknown catalog totals must not masquerade as zero');
 assert.equal(unavailable.regions[0].gistaruId,null);
});
test('Copied and exported counts allow only numeric counters, never arbitrary source extras, without mutating source',()=>{
 const {aggregate,configuration}=api(),{validateCollection}=require('../prototype/zone-data.js');
 const p=registry.plans[0],data=collection(p);
 Object.assign(data.meta.counts,{geometry:{type:'Polygon',coordinates:[[[122,-4]]]},targetAreaM2:999,roadPreference:'malicious-extra'});
 const original=JSON.stringify(data);
 assert.equal(validateCollection(data,p.id,'01273',p),data);
 const records=new Map([[p.id,{status:'ready',data}]]),applied={kbli:'01273',regions:[p.regionId]};
 const summary=aggregate(registry,applied.regions,records,true);
 assert.deepEqual(summary.plans[0].counts,{matched:1,returned:1,excludedInvalid:0});
 const exported=configuration(registry,entries,applied,records,true);
 assert.deepEqual(exported.overlay.plans[0].counts,{matched:1,returned:1,excludedInvalid:0});
 assert.doesNotMatch(JSON.stringify(exported),/"(?:geometry|coordinates|targetAreaM2|roadPreference)"/);
 assert.equal(JSON.stringify(data),original,'validation, aggregation and export leave source data unchanged');
 summary.plans[0].counts.returned=0;
 assert.equal(JSON.stringify(data),original,'copied counts are detached from source');
 for(const bad of ['1',{},NaN,-1]){
  const invalid=collection(p);invalid.meta.counts.matched=bad;
  assert.throws(()=>aggregate(registry,applied.regions,new Map([[p.id,{status:'ready',data:invalid}]]),true));
 }
});
test('UI distinguishes display generalization parameters and original-preserved sources from full source counts',async()=>{
 const h=appHarness();await h.settle();const p=registry.plans.find(p=>p.activity),d=displayCollection(p);
 h.context.window.caseData=d;
 h.run(`viewportRecords=new Map([[window.caseData.meta.plan.id,{status:'ready',data:window.caseData}]]);viewportLevel='overview';viewportPhase='ready';renderViewportState()`);
 assert.match(h.el('viewportStatus').textContent,/parameter generalisasi 100 m/i);
 assert.match(h.el('viewportStatus').textContent,/bukan ketelitian|bukan jaminan deviasi/i);
 assert.match(h.el('viewportStatus').textContent,/tidak untuk analisis atau ekspor/i);
 d.meta.display.method='original_preserved';d.meta.display.fallbackReason='coverage_invalid';
 h.run('renderViewportState()');assert.match(h.el('viewportStatus').textContent,/1 rencana memakai geometri asli/i);
 h.run('planRecords.set(window.caseData.meta.plan.id,{status:"ready",data:window.caseData});openPlan(plans.find(p=>p.id===window.caseData.meta.plan.id))');
 assert.match(h.el('detailContent').textContent,/1 fitur sumber valid/);assert.doesNotMatch(h.el('detailContent').textContent,/1 ditampilkan/);
 h.run('renderZoneDetail(window.caseData.features[0],window.caseData)');
 assert.match(h.el('zoneDetailContent').textContent,/1 fitur sumber valid/);assert.doesNotMatch(h.el('zoneDetailContent').textContent,/1 ditampilkan/);
});
test('Aggregation preserves plan-local identities, coverage gaps and empty results without permission inference',()=>{
 const {aggregate,featureKey}=api();const selected=entries.map(r=>r.id);const records=new Map();
 let a=aggregate(registry,selected,records,false);assert.equal(a.state,'idle');assert.equal(a.requestedPlanCount,16);assert.equal(a.unmappedPlanCount,2);assert.equal(a.notListedRegionCount,6);
 a=aggregate(registry,selected,records,true);assert.equal(a.state,'loading');
 for(const p of registry.plans.filter(p=>p.activity))records.set(p.id,{status:'ready',data:collection(p)});
 a=aggregate(registry,selected,records,true);assert.equal(a.state,'partial');assert.equal(a.loadedPlanCount,16);assert.equal(a.highlightedFeatureCount,16);
 assert.equal(new Set(a.features.map(({feature,plan})=>featureKey(plan.id,feature.id))).size,16);
 assert.deepEqual(a.counts,{matched:16,returned:16,excludedInvalid:0});
 const kolaka=registry.plans.filter(p=>p.regionId==='7401000000');
 a=aggregate(registry,['7401000000'],records,true);assert.equal(a.state,'ready');assert.equal(a.features.length,2);
 records.set(kolaka[0].id,{status:'error',error:'timeout'});a=aggregate(registry,['7401000000'],records,true);assert.equal(a.state,'partial');assert.equal(a.failedPlanCount,1);assert.equal(a.loadedPlanCount,1);
 records.set(kolaka[1].id,{status:'error',error:'invalid'});assert.equal(aggregate(registry,['7401000000'],records,true).state,'error');
 assert.equal(aggregate(registry,['7471000000'],records,true).state,'unavailable');
 assert.equal(aggregate(registry,['local:sultra:muna'],records,true).state,'unavailable');
 assert.throws(()=>aggregate(registry,['unknown'],records,true));
 assert.throws(()=>aggregate(registry,['7401000000','7401000000'],records,true));
 const empty=collection(kolaka[0]);empty.features=[];empty.meta.counts={matched:0,returned:0,excludedInvalid:0};
 records.set(kolaka[0].id,{status:'ready',data:empty});records.set(kolaka[1].id,{status:'ready',data:empty});
 assert.throws(()=>aggregate(registry,['7401000000'],records,true),'cross-plan ready collection must fail closed');
});
