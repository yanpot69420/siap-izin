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
test('App renders every loaded plan as its own collection and uses plan:object identity for details',async()=>{
 const h=appHarness(async url=>{const p=registry.plans.find(p=>url.includes('plan='+p.id+'&'));return {ok:true,json:async()=>collection(p)};});await h.settle();
 const layers=[];h.context.window.testMap={removeLayer:()=>{},fitBounds:()=>{},setView:()=>{}};
 h.context.window.L={featureGroup:()=>({addTo(){return this;},addLayer(l){layers.push(l);},getBounds:()=>({isValid:()=>true}),clearLayers:()=>{layers.length=0;}}),geoJSON:(data,options)=>{
  const children=data.features.map(feature=>{const layer={feature,handlers:{},on(type,cb){this.handlers[type]=cb;},setStyle:()=>{},getBounds:()=>({isValid:()=>true})};options.onEachFeature(feature,layer);return layer;});
  return {data,getLayers:()=>children,getBounds:()=>({isValid:()=>true}),resetStyle:()=>{}};
 }};
 await h.run('map = window.testMap; loadZones()');await h.settle();
 assert.equal(h.requests.filter(u=>u.startsWith('/api/zones')).length,16);
 assert.equal(layers.length,16);assert.ok(layers.every(l=>l.data.meta.plan.id));
 assert.equal(h.el('zoneCount').textContent,'16');assert.equal(h.el('zoneList').children.length,16);
 const buttons=h.el('zoneList').children;assert.equal(new Set(buttons.map(b=>b.dataset.zoneId)).size,16);
 buttons[1].click();assert.match(h.el('zoneDetailContent').textContent,new RegExp(registry.plans[1].name));
 assert.match(h.el('zoneDetailContent').textContent,/KODSZN/);assert.match(h.el('zoneDetailContent').textContent,/034/);
 assert.match(h.el('coverageStatus').textContent,/16/);assert.match(h.el('zoneStatus').textContent,/parsial/i);
 const config=h.run('configuration()');assert.equal(config.schemaVersion,3);assert.equal(config.overlay.loadedPlanCount,16);assert.equal(config.overlay.unmappedPlanCount,2);
});
test('Paginated source list reaches features beyond 200 with provenance, stable controls, focus and applied reset',async()=>{
 const mappable=registry.plans.filter(p=>p.activity),first=mappable[0];
 const h=appHarness(async url=>{
  const p=mappable.find(p=>url.includes('plan='+p.id+'&')),d=collection(p,1);
  if(p===first){d.features=Array.from({length:201},(_,i)=>collection(p,i+1).features[0]);d.meta.counts={matched:201,returned:201,excludedInvalid:0};}
  return {ok:true,json:async()=>d};
 });await h.settle();
 const layers=[];h.context.window.testMap={removeLayer:()=>{},fitBounds:()=>{},setView:()=>{}};
 h.context.window.L={featureGroup:()=>({addTo(){return this;},addLayer(l){layers.push(l);},getBounds:()=>({isValid:()=>true})}),geoJSON:(data,options)=>{
  for(const f of data.features)options.onEachFeature(f,{on:()=>{},getBounds:()=>({isValid:()=>true})});return {data};
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
 h.el('zoneList').children[0].click();assert.match(h.el('zoneDetailContent').textContent,new RegExp(`${first.id}:201`));
 h.el('zoneDialog').close();h.el('zoneList').children[1].click();assert.match(h.el('zoneDetailContent').textContent,new RegExp(mappable[1].id));h.el('zoneDialog').close();
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
function appHarness(fetchZones){
 const vm=require('node:vm');const elements=new Map(),inputs=[],tabs=[],requests=[];
 class Element{
  constructor(tag='div'){this.tagName=tag;this.children=[];this.listeners={};this.attributes={};this.dataset={};this._text='';this.checked=false;this.hidden=false;this.open=false;}
  set textContent(v){this._text=String(v);this.children=[];}get textContent(){return this._text+this.children.map(c=>c.textContent||'').join('');}
  append(...items){this.children.push(...items);for(const i of items){if(i.name==='region')inputs.push(i);}}
  replaceChildren(...items){this.children=[];this._text='';this.append(...items);}
  addEventListener(type,cb){(this.listeners[type]??=[]).push(cb);}dispatchEvent(e){for(const cb of this.listeners[e.type]||[])cb(e);return true;}
  setAttribute(k,v){this.attributes[k]=String(v);}getAttribute(k){return this.attributes[k];}
  showModal(){this.open=true;}close(){this.open=false;}focus(){document.activeElement=this;}remove(){}click(){if(!this.disabled)this.dispatchEvent({type:'click'});}
  reset(){inputs.forEach(i=>{i.checked=true;});}requestSubmit(){this.dispatchEvent({type:'submit',currentTarget:this,preventDefault:()=>{}});}
 }
 const html=fs.readFileSync(require('node:path').join(__dirname,'../prototype/index.html'),'utf8');
 for(const [,id]of html.matchAll(/id="([^"]+)"/g))elements.set(id,new Element());
 for(const name of ['zones','audit','export']){const t=elements.get('tab-'+name);t.dataset.tab=name;tabs.push(t);}
 const document={querySelector:s=>elements.get(s.slice(1))||null,querySelectorAll:s=>s==='[role=tab]'?tabs:s==='[data-close]'?[]:s==='[name=region]:checked'?inputs.filter(i=>i.checked):s==='[name=region]'?inputs:[],createElement:tag=>new Element(tag),createTextNode:s=>({textContent:s}),head:new Element(),body:new Element()};
 const fetchImpl=async url=>{requests.push(url);if(url.startsWith('/api/catalog'))return {ok:true,json:async()=>structuredClone(registry)};if(url==='audit-summary.json')return {ok:true,json:async()=>({schemaVersion:1,plans:[]})};if(fetchZones)return fetchZones(url);throw new Error('unexpected fetch '+url);};
 const context=vm.createContext({console,window:{RegionData:{entries},ProvinceData:api(),ZoneData:require('../prototype/zone-data.js')},document,fetch:fetchImpl,AbortController,URL,Blob,Event,setTimeout,clearTimeout,FormData:class{constructor(){this.get=()=> '01273';this.getAll=()=>inputs.filter(i=>i.checked).map(i=>i.value);}}});
 // Browser checkbox defaultChecked also sets checked before dirty selection.
 const create=document.createElement;document.createElement=tag=>{const e=create(tag);Object.defineProperty(e,'defaultChecked',{set(v){this.checked=v;}});return e;};
 vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../prototype/app.js'),'utf8'),context);
 return {context,el:id=>elements.get(id),inputs,requests,settle:async()=>{for(let i=0;i<10;i++)await new Promise(r=>setImmediate(r));},run:code=>vm.runInContext(code,context)};
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
