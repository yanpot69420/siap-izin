'use strict';
const $ = selector => document.querySelector(selector);
const regionEntries = window.RegionData.entries;
const regions = Object.fromEntries(regionEntries.map(region=>[region.id,region.name]));
let catalog = null;
let catalogState = 'idle';
let catalogRevision = 0;
let catalogRequest = null;
let plans = [];
let applied = {kbli:'01273',regions:Object.keys(regions)};
let audit = new Map();
let checkedAt = null;
let map = null;
let zoneLayerFeatureGroup = null;
const layerMapper = new Set();
const featureLayers = new Map();
const regionBeaconLayers = new Map();
let regionBeaconGroup = null,regionBeaconsVisible = false,regionBeaconSignature = '';
let planRecords = new Map();
let inventorySummary = null;
let selectedFeatureKey = null;
let exportSnapshot = null;
const zonePageSize = 200;
let zonePage = 0;
let loadRevision = 0;
let detailRevision = 0;
let userMoved = false;
let autoFitDone = false;
let pendingApplyFocus = false;
let cameraRevision = 0;
let overviewReady = false;
let detailState = 'idle';
let snapshotReloadRequired = false;
let viewportRecords = new Map();
let viewportPhase = 'idle';
let viewportLevel = 'overview';
let viewportBBox = null;
let viewportRevision = 0;
let viewportTimer = null;
let autoFitting = false;
let mapMoving = false;

function text(tag,value,className){const el=document.createElement(tag);el.textContent=value;if(className)el.className=className;return el;}
function sourceLink(label,url){
 const a=text('a',label+' ↗');
 try{const u=new URL(url);if(u.protocol!=='https:'||!['gistaru.atrbpn.go.id','gistaru-proxy.atrbpn.go.id'].includes(u.hostname)||u.username||u.password)return text('span',label+' — tautan sumber tidak valid');a.href=u.href;}
 catch{return text('span',label+' — tautan sumber tidak tersedia');}
 a.target='_blank';a.rel='noopener';return a;
}
function fact(label,value){const d=text('div','','detail-fact');d.append(text('strong',label),text('p',value));return d;}
function showDialog(id){const dialog=$('#'+id);if(!dialog.open)dialog.showModal();}
function updateRegionSelectionCount(){
 const count=document.querySelectorAll('[name=region]:checked').length;
 $('#regionSelectionCount').textContent=`${count} dari ${regionEntries.length} kabupaten/kota dipilih`;
}
function renderRegionOptions(){
 const list=$('#regionOptions');list.replaceChildren();
 for(const region of regionEntries){
  const label=text('label','','check');const input=document.createElement('input');
  input.type='checkbox';input.name='region';input.value=region.id;input.defaultChecked=true;
  label.append(input,document.createTextNode(region.name));list.append(label);
 }
 updateRegionSelectionCount();
}
for(const [id,checked] of [['selectAllRegions',true],['clearRegions',false]])$('#'+id).addEventListener('click',()=>{
 document.querySelectorAll('[name=region]').forEach(input=>{input.checked=checked;});
 $('#regionOptions').dispatchEvent(new Event('input',{bubbles:true}));
});
for(const close of document.querySelectorAll('[data-close]'))close.addEventListener('click',()=>$('#'+close.dataset.close).close());
$('#aboutButton').addEventListener('click',()=>showDialog('aboutDialog'));
function activateTab(name,focus=false){
 for(const tab of document.querySelectorAll('[role=tab]')){const active=tab.dataset.tab===name;tab.setAttribute('aria-selected',String(active));tab.tabIndex=active?0:-1;$('#view-'+tab.dataset.tab).hidden=!active;if(active&&focus)tab.focus();}
}
const tabs=[...document.querySelectorAll('[role=tab]')];
for(const tab of tabs){tab.addEventListener('click',()=>activateTab(tab.dataset.tab));tab.addEventListener('keydown',event=>{
 let next=tabs.indexOf(tab);
 if(event.key==='ArrowRight')next=(next+1)%tabs.length;
 else if(event.key==='ArrowLeft')next=(next+tabs.length-1)%tabs.length;
 else if(event.key==='Home')next=0;
 else if(event.key==='End')next=tabs.length-1;
 else return;
 event.preventDefault();activateTab(tabs[next].dataset.tab,true);
});}
for(const id of ['inspectEvidence','openSources'])$('#'+id).addEventListener('click',()=>activateTab('audit',true));
function sourceLabel(source){return source.status==='local_dataset'?`Dataset lokal · pengamatan sumber ${source.retrievedAt} · bukan pembacaan live`:`${source.status} · ${source.retrievedAt}`;}
function planStatus(plan){
 if(plan.localDataset?.available===false)return 'unavailable · belum diimpor / belum tersedia dalam rilis dataset lokal; cakupan tidak diketahui';
 if(!plan.activity)return 'unavailable · relasi kegiatan belum tersedia';
 const entry=planRecords.get(plan.id);
 if(entry?.status==='ready')return `ready · ${entry.data.features.length} polygon · ${sourceLabel(entry.data.meta.source)}`;
 if(entry?.status==='error')return entry.error==='timeout'?'error · waktu tunggu sumber habis':'error · API/sumber tidak tersedia atau kontrak tidak valid';
 if(entry?.status==='unavailable')return 'unavailable · API tidak menyediakan kegiatan ini';
 return map&&catalog?(entry?.status==='loading'?'loading · sedang dimuat / antre':'idle · belum diminta'):'idle · menunggu aktivasi peta';
}
function renderAudit(){
 const visible=plans.filter(p=>applied.regions.includes(p.regionId));
 $('#auditCount').textContent=catalog?String(visible.length):'—';
 $('#regionSummary').textContent=`KBLI ${applied.kbli} · ${applied.regions.length} kabupaten/kota diterapkan · ${catalog?visible.length+' rencana katalog':'katalog belum tersedia'}`;
 $('#mapTitle').textContent=`Sulawesi Tenggara / ${applied.regions.length===1?regions[applied.regions[0]]:'Eksplorasi zona'}`;
 $('#auditEmpty').hidden=!catalog||visible.length!==0;
 const focused=document.activeElement?.dataset?.plan;
 $('#auditList').replaceChildren();
 $('#catalogStatus').textContent=catalog?`${catalog.localDataset?'Dataset lokal · rilis parsial '+catalog.localDataset.releaseHash+' · ':''}Snapshot katalog lokal · ${catalog.sourceStatus} · diperiksa ${catalog.checkedAt} · ${catalog.plans.length} rencana dalam ${catalog.regions.filter(r=>r.planIds.length).length} dari ${catalog.regions.length} wilayah administratif. Bukan katalog live.`:catalogState==='error'?'Katalog lokal gagal atau tidak valid. Inventaris ditutup; tidak memakai fallback.':'Memuat snapshot katalog lokal…';
 $('#retryCatalog').hidden=catalogState!=='error';
 const missing=catalog?.regions.filter(r=>applied.regions.includes(r.id)&&r.catalogStatus==='not_listed_in_public_catalog')||[];
 const unmapped=visible.filter(p=>!p.activity),notImported=visible.filter(p=>p.localDataset?.available===false);
 $('#catalogGaps').textContent=catalog?`${missing.length} wilayah tidak tercantum pada snapshot katalog publik: ${missing.map(r=>r.name).join('; ')||'tidak ada pada pilihan ini'}. Bukan bukti tidak ada RDTR. ${unmapped.length} rencana belum memiliki relasi kegiatan: ${unmapped.map(p=>p.name).join('; ')||'tidak ada pada pilihan ini'}.${catalog.localDataset?' '+notImported.length+' rencana belum diimpor / belum tersedia dalam rilis; hitungan zona dan cakupan belum diketahui.':''}`:'Cakupan belum dapat dihitung tanpa katalog valid.';
 for(const [index,p] of visible.entries()){
  const row=text('button','','audit-row');row.type='button';row.dataset.plan=p.id;
  const main=text('span','','row-main');main.append(text('strong',p.name),text('span',`${regions[p.regionId]} · ${planStatus(p)}`,'small'));
  row.append(text('span',String(index+1).padStart(2,'0'),'row-number'),main,text('span','↗'));
  row.addEventListener('click',()=>openPlan(p));$('#auditList').append(row);
  if(focused===p.id)row.focus();
 }
}
async function loadCatalog(){
 const revision=++catalogRevision;
 if(catalogRequest)catalogRequest.abort();
 zoneLoader.cancel();clearZones();catalogState='loading';catalog=null;plans=[];renderAudit();renderZoneState();
 const controller=new AbortController();catalogRequest=controller;
 const timer=setTimeout(()=>controller.abort(),20000);
 try{
  const response=await fetch('/api/catalog?kbli=01273',{signal:controller.signal,cache:'no-store'});
  if(!response.ok)throw new Error('catalog_unavailable');
  const validated=window.ProvinceData.validateCatalog(await response.json(),regionEntries,'01273');
  if(revision!==catalogRevision)return;
  catalog=validated;plans=catalog.plans;catalogState='ready';
 }catch{if(revision!==catalogRevision)return;catalog=null;plans=[];catalogState='error';}
 finally{clearTimeout(timer);if(revision===catalogRevision){catalogRequest=null;renderAudit();loadZones();}}
 if(catalog)loadAudit();
}
$('#retryCatalog').addEventListener('click',loadCatalog);
function openPlan(p){
 $('#detailTitle').textContent=p.name;
 const body=$('#detailContent');body.replaceChildren();
 body.append(fact('Kabupaten/kota / ID rencana',`${regions[p.regionId]} / ${p.id}`),fact('Snapshot katalog',`${catalog.sourceStatus} · ${catalog.checkedAt}; bukan discovery live.`),fact('Status pemuatan geometri',planStatus(p)),fact('Calon relasi kegiatan — belum direview',p.activity?`${p.activity.id} — ${p.activity.name} · filter ${p.filterField} · ${p.activity.basis}`:'Belum tersedia. Tidak meminta geometri dengan kegiatan rencana lain.'),fact('Status sumber katalog / integrasi',`${p.sourceStatus} / ${p.integrationDate||'Tanggal tidak tersedia'}. Ketercantuman katalog bukan jaminan kesiapan pengajuan.`),fact('Yang belum terbukti','Pemetaan exact-KBLI 01273, semua syarat/blok, ITBX seluruh bidang dan penerimaan pengajuan OSS.'));
 const entry=planRecords.get(p.id);
 if(entry?.data){const m=entry.data.meta;body.append(fact('Sumber geometri',sourceLabel(m.source)),fact('Hasil filter sumber',`${m.counts.matched} cocok · ${m.counts.returned} fitur sumber valid · ${m.counts.excludedInvalid} dikarantina. Jumlah ini bukan jumlah fitur yang sedang tergambar. Nol hasil bukan dilarang.`),fact('Filter sumber',`${m.activity.filterField} IN (${m.filterZoneCodes.join(', ')})`));for(const limit of m.limitations)body.append(text('p',limit,'small'));}
 const extra=audit.get(p.id);
 if(extra){body.append(fact('Audit historis — bukan evaluasi seluruh bidang',extra.summary),fact('Waktu audit historis',checkedAt||'Tidak dicantumkan'),fact('Status review ringkasan',extra.reviewStatus||'Belum dicantumkan'));if(extra.unknowns.length)body.append(fact('Ketidakpastian audit',extra.unknowns.join(' · ')));}
 const links=text('div','','source-links');links.append(sourceLink('Katalog GISTARU',p.catalogUrl),sourceLink('Daftar kegiatan lokal',p.activitiesUrl));
 if(entry?.data)links.append(sourceLink('Metadata layer resmi',entry.data.meta.source.metadataUrl),sourceLink('Query geometri sumber',entry.data.meta.source.geometryQueryUrl));
 body.append(links);showDialog('detailDialog');
}
function clearZones(){
 clearRegionBeacons();
 cancelViewport();viewportRecords=new Map();viewportPhase='idle';viewportLevel='overview';viewportBBox=null;
 loadRevision++;detailRevision++;detailLoader.cancel();overviewReady=false;detailState='idle';snapshotReloadRequired=false;
 if(zoneLayerFeatureGroup&&map)map.removeLayer(zoneLayerFeatureGroup);
 zoneLayerFeatureGroup=null;layerMapper.clear();featureLayers.clear();planRecords=new Map();inventorySummary=null;
 selectedFeatureKey=null;zonePage=0;renderZonePage([]);$('#zoneCount').textContent='—';
 $('#zoneSummary').textContent='Belum ada geometri sumber yang dimuat.';
 $('#coverageStatus').textContent='Cakupan hanya zona hasil filter dari rencana yang berhasil dimuat; bukan seluruh daratan Sulawesi Tenggara.';
 $('#mapKey').textContent='Biru = relevan untuk ditelaah, status izin unknown. Bukan persetujuan OSS. Lingkaran emas = navigasi wilayah; klik atau sentuh untuk memperbesar area sumber.';
 for(const id of ['zoneDialog','detailDialog'])if($('#'+id).open)$('#'+id).close();
}
function setZoneMessage(phase,title,message){
 $('#zoneHeading').textContent=title;$('#zoneStatus').textContent=message;
 $('#zoneLoading').hidden=phase!=='loading';$('#retryZones').hidden=phase!=='error';
}
async function openZone(feature,data){
 const inventory=planRecords.get(data.meta.plan.id)?.data;
 if(!inventory||inventory.meta.snapshotId!==data.meta.snapshotId)return;
 const original=inventory.features.find(f=>f.id===feature.id),plan=plans.find(p=>p.id===data.meta.plan.id);
 if(!original||!plan)return;
 const revision=++detailRevision,context=loadRevision;
 selectFeature(window.ProvinceData.featureKey(plan.id,feature.id));
 detailState='loading';$('#zoneDetailTitle').textContent=`${original.properties.zone_name} · #${feature.id}`;
 $('#zoneDetailContent').replaceChildren(text('p','Memuat atribut sumber terikat snapshot…','detail-note'));showDialog('zoneDialog');
 try{
  const value=await detailLoader.start(plan,applied.kbli,original,inventory);
  if(!value||revision!==detailRevision||context!==loadRevision||planRecords.get(plan.id)?.data!==inventory)return;
  detailState='ready';renderZoneDetail({...original,properties:value.properties},{meta:value.meta});
 }catch(error){
  if(revision!==detailRevision||context!==loadRevision)return;
  detailState=error.message==='snapshot_changed'?'reload-required':'error';
  $('#zoneDetailContent').replaceChildren(text('p',detailState==='reload-required'?'Snapshot sumber berubah (409). Muat ulang overview melalui tombol Coba muat zona lagi; atribut baru tidak dipasangkan dengan peta lama.':'Atribut sumber gagal atau kontrak tidak valid. Tidak memakai endpoint geometri sebagai pengganti.','detail-note'));
  if(detailState==='reload-required'){snapshotReloadRequired=true;viewportPhase='reload-required';$('#retryZones').hidden=false;renderViewportState();}
 }
}
function renderZoneDetail(feature,data){
 const p=feature.properties,m=data.meta;
 selectFeature(window.ProvinceData.featureKey(m.plan.id,p.object_id));
 $('#zoneDetailTitle').textContent=`${p.zone_name} · ${p.zone_code} · #${p.object_id}`;
 const body=$('#zoneDetailContent');body.replaceChildren();
 body.append(text('p','Relevan untuk ditelaah — bukan indikasi diizinkan atau hasil kesesuaian KBLI terverifikasi. Status izin: unknown.','detail-note'),fact('Rencana / identitas fitur',`${m.plan.name} · ${m.plan.id} / ${window.ProvinceData.featureKey(m.plan.id,p.object_id)}`),fact('Kabupaten/kota',regions[m.plan.regionId]),fact('KBLI dan asumsi ruang lingkup',`${m.kbli.code} · versi ${m.kbli.version} · ${m.kbli.scope}; ruang lingkup belum dikonfirmasi`),fact('Dasar sorotan',`ID kegiatan lokal ${m.activity.id} — ${m.activity.name}. Filter ${m.activity.filterField} = ${p.filter_value}; kode subzona asli KODSZN = ${p.zone_code}. Nilai filter terdapat pada daftar kegiatan sumber; bukan keputusan izin.`),fact('Status kegiatan/zona','unreviewed_mapping · unknown. Pemetaan KBLI belum direview; daftar filter dapat memuat kategori terbatas dan/atau bersyarat. ITBX sampel historis bukan evaluasi seluruh bidang.'),fact('Peraturan dari atribut sumber',p.regulation||'Belum tersedia; dokumen belum ditelaah lengkap.'),fact('Waktu dan metode pembacaan',sourceLabel(m.source)),fact('Cakupan / tujuan geometri',`${m.coverage} · ${m.geometryPurpose}. Hanya polygon hasil filter rencana ini; bukan seluruh kabupaten, bidang proyek atau batas hak.`),fact('Rekonsiliasi sumber',`${m.counts.matched} cocok filter · ${m.counts.returned} fitur sumber valid · ${m.counts.excludedInvalid} dikarantina. Bukan jumlah fitur pada viewport.`));
 const limits=text('ul','','zone-limits');for(const item of m.limitations)limits.append(text('li',item));body.append(limits);
 const links=text('div','','source-links');links.append(sourceLink('Kegiatan lokal resmi',m.source.activitiesUrl),sourceLink('Metadata layer resmi',m.source.metadataUrl),sourceLink('Query geometri sumber',m.source.geometryQueryUrl));body.append(links);showDialog('zoneDialog');
}
function applyFeatureStyle(layer,hovered=false){
 const key=window.ProvinceData.featureKey(layer.feature.properties.plan_id,layer.feature.id);
 layer.setStyle(window.MapStyle.styleForZoom(map?.getZoom?.()??7,{selected:key===selectedFeatureKey,hovered}));
}
function selectFeature(key){
 if(key===selectedFeatureKey)return;
 const previous=featureLayers.get(selectedFeatureKey);
 selectedFeatureKey=key;
 if(previous)applyFeatureStyle(previous);
 const selected=featureLayers.get(key);if(selected)applyFeatureStyle(selected);
}
function refreshZoneStyles(){for(const layer of featureLayers.values())applyFeatureStyle(layer);}
function drawPlan(data){
 if(!zoneLayerFeatureGroup)zoneLayerFeatureGroup=window.L.featureGroup().addTo(map);
 const style=feature=>window.MapStyle.styleForZoom(map?.getZoom?.()??7,{selected:window.ProvinceData.featureKey(data.meta.plan.id,feature.id)===selectedFeatureKey});
 const layer=window.L.geoJSON(data,{
  style,
  onEachFeature:(feature,child)=>{
   featureLayers.set(window.ProvinceData.featureKey(data.meta.plan.id,feature.id),child);
   child.on('click',()=>openZone(feature,data));
   child.on('mouseover',()=>applyFeatureStyle(child,true));
   child.on('mouseout',()=>applyFeatureStyle(child));
  }
 });
 layerMapper.add(data.meta.plan.id);zoneLayerFeatureGroup.addLayer(layer);
}
function zoomAll(){
 const bounds=[...planRecords.values()].filter(e=>e.status==='ready'&&e.data.features.length&&window.DisplayData.bounds(e.data.meta.sourceBounds)).map(e=>e.data.meta.sourceBounds);
 if(bounds.length)fitSourceBounds(bounds.reduce(mergeSourceBounds));
}
function mergeSourceBounds(a,b){return [Math.min(a[0],b[0]),Math.min(a[1],b[1]),Math.max(a[2],b[2]),Math.max(a[3],b[3])];}
function fitSourceBounds(b){map.fitBounds([[b[1],b[0]],[b[3],b[2]]],{padding:[28,28],maxZoom:14,animate:false});}
function clearRegionBeacons(){
 if(regionBeaconGroup&&map)map.removeLayer(regionBeaconGroup);
 regionBeaconGroup=null;regionBeaconLayers.clear();regionBeaconsVisible=false;regionBeaconSignature='';
}
function updateRegionBeaconVisibility(){
 const visible=Boolean(regionBeaconGroup&&(map?.getZoom?.()??7)<=9);
 if(visible===regionBeaconsVisible)return;
 regionBeaconsVisible=visible;
 if(visible)regionBeaconGroup.addTo(map);else map.removeLayer(regionBeaconGroup);
}
function renderRegionBeacons(){
 if(!map||!catalog)return;
 const grouped=new Map();
 for(const p of plans){
  const entry=planRecords.get(p.id),b=entry?.data?.meta.sourceBounds;
  if(!applied.regions.includes(p.regionId)||!p.activity||p.localDataset?.available===false||entry?.status!=='ready'||!entry.data.features.length||!window.DisplayData.bounds(b))continue;
  grouped.set(p.regionId,grouped.has(p.regionId)?mergeSourceBounds(grouped.get(p.regionId),b):b);
 }
 const signature=JSON.stringify([...grouped]);if(signature===regionBeaconSignature)return;
 clearRegionBeacons();regionBeaconSignature=signature;if(!grouped.size)return;
 regionBeaconGroup=window.L.featureGroup();
 for(const [id,b]of grouped){
  const label=`${regions[id]} — perbesar area sumber tersedia; indeks navigasi, bukan batas kabupaten/kota atau hasil izin.`;
  const circle=window.L.circleMarker([(b[1]+b[3])/2,(b[0]+b[2])/2],{className:'region-beacon',radius:16,weight:2,color:'#285d83',fillColor:'#f1c76c',fillOpacity:.92,bubblingMouseEvents:false});
  const navigate=()=>fitSourceBounds(b);
  const decorate=()=>{const node=circle.getElement();if(!node||node.dataset.region)return;node.dataset.region=id;node.setAttribute('role','button');node.setAttribute('tabindex','0');node.setAttribute('aria-label',label);node.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();event.stopPropagation();navigate();}});};
  circle.bindTooltip(text('span',label));circle.on('click',navigate);circle.on('add',decorate);
  regionBeaconLayers.set(id,circle);regionBeaconGroup.addLayer(circle);decorate();
 }
 updateRegionBeaconVisibility();
}
function clearDrawing(){
 if(zoneLayerFeatureGroup&&map)map.removeLayer(zoneLayerFeatureGroup);
 zoneLayerFeatureGroup=null;layerMapper.clear();featureLayers.clear();
}
function cancelViewport(){viewportRevision++;clearTimeout(viewportTimer);viewportTimer=null;viewportLoader.cancel();}
function viewportBounds(){
 const b=map.getBounds();return [Math.max(-180,b.getWest()),Math.max(-90,b.getSouth()),Math.min(180,b.getEast()),Math.min(90,b.getNorth())].map(n=>Number(n.toFixed(6)));
}
function scheduleViewport(){
 clearTimeout(viewportTimer);viewportTimer=null;if(overviewReady&&!mapMoving&&map?.getBounds)viewportTimer=setTimeout(()=>requestViewport(),250);
}
function onMapMovementStart(){
 mapMoving=true;
 if(!autoFitting){userMoved=true;cameraRevision++;pendingApplyFocus=false;}
 cancelViewport();detailRevision++;detailLoader.cancel();detailState='idle';
 if($('#zoneDialog').open)$('#zoneDialog').close();
 if(overviewReady){viewportPhase=snapshotReloadRequired?'reload-required':'loading';renderViewportState();}
}
function bindMapEvents(){
 map.on('zoomend',()=>{refreshZoneStyles();updateRegionBeaconVisibility();});map.on('movestart',onMapMovementStart);map.on('zoomstart',onMapMovementStart);map.on('moveend',()=>{mapMoving=false;scheduleViewport();});
}
function renderViewportState(){
 const values=[...viewportRecords.values()],ready=values.filter(e=>e.status==='ready'),failed=values.filter(e=>e.reason!=='not_in_release'&&['error','unavailable'].includes(e.status)),pending=values.filter(e=>e.status==='loading');
 const drawn=featureLayers.size,original=ready.filter(e=>e.data.meta.display.method==='original_preserved').length;
 const tolerance={overview:100,regional:10,detail:1}[viewportLevel];
 const label={idle:'belum dimuat',loading:'loading — area belum selesai dimuat',ready:drawn?'siap':'0 fitur pada viewport',partial:'parsial — area belum lengkap',unavailable:'belum tersedia — cakupan sumber tidak diketahui',error:'error — geometri area gagal dimuat','reload-required':'snapshot berubah — muat ulang overview, tanpa mencampur atribut/geometri'}[viewportPhase];
 $('#viewportStatus').textContent=`Tampilan ${viewportLevel} · ${drawn} fitur tergambar pada viewport · ${ready.length}/${values.length} rencana area dimuat · ${pending.length} menunggu · ${failed.length} gagal · ${label}. Parameter generalisasi ${tolerance} m, bukan ketelitian atau jaminan deviasi; ${original} rencana memakai geometri asli karena tidak aman disederhanakan. Geometri tampilan tidak untuk analisis atau ekspor. Hasil 0 viewport bukan tidak ada RDTR; area di luar polygon belum dievaluasi. Daftar tetap memakai inventaris overview lengkap.`;
}
async function requestViewport(){
 clearTimeout(viewportTimer);viewportTimer=null;
 if(!overviewReady||!map?.getBounds||!catalog)return;
 if(snapshotReloadRequired){viewportPhase='reload-required';renderDrawingState();return;}
 cancelViewport();const revision=viewportRevision,context=loadRevision;
 viewportBBox=viewportBounds();viewportLevel=window.MapStyle.levelForZoom(map.getZoom());clearDrawing();
 if(!window.DisplayData.bounds(viewportBBox)){viewportRecords=new Map();viewportPhase='error';renderDrawingState();return;}
 const selected=window.DisplayData.viewportPlans(plans.filter(p=>applied.regions.includes(p.regionId)),planRecords,viewportBBox);
 viewportPhase='loading';
 await viewportLoader.start(selected,applied.kbli,{level:viewportLevel,bbox:viewportBBox,inventories:planRecords});
 if(revision!==viewportRevision||context!==loadRevision)return;
 const values=[...viewportRecords.values()],failed=values.filter(e=>e.status!=='ready'&&e.reason!=='not_in_release');
 if(values.some(e=>e.error==='snapshot_changed'))snapshotReloadRequired=true;
 const knownOutside=[...planRecords.values()].some(e=>e.status==='ready'&&!window.DisplayData.intersects(e.data.meta.sourceBounds,viewportBBox));
 const summary=inventorySummary;
 viewportPhase=snapshotReloadRequired?'reload-required':!summary.requestedPlanCount||!summary.loadedPlanCount&&summary.notImportedPlanCount?'unavailable':failed.length?(values.some(e=>e.status==='ready')||summary.failedPlanCount&&knownOutside?'partial':'error'):summary.unmappedPlanCount||summary.notListedRegionCount||summary.notImportedPlanCount?'partial':'ready';renderDrawingState();
}
function renderDrawingState(){
 const summary=inventorySummary;
 if(summary){
  $('#zoneSummary').textContent=`${plans.filter(p=>applied.regions.includes(p.regionId)).length} rencana katalog · ${summary.loadedPlanCount}/${summary.requestedPlanCount} rencana mappable dimuat · ${summary.requestedPlanCount>0&&summary.loadedPlanCount===summary.requestedPlanCount?summary.highlightedFeatureCount:'belum diketahui'} fitur sumber tersedia · ${summary.highlightedFeatureCount} fitur overview dimuat · ${featureLayers.size} fitur tergambar saat ini · ${summary.counts.excludedInvalid} geometri dikarantina · bukan jumlah lokasi sesuai`;
  $('#retryZones').hidden=!map||summary.failedPlanCount===0;
 }
 renderViewportState();
 if(['error','partial','reload-required'].includes(viewportPhase)||snapshotReloadRequired)$('#retryZones').hidden=false;
}
function renderZoneState(){
 if(!catalog){
  const failed=catalogState==='error';setZoneMessage(failed?'error':catalogState,'Katalog sumber '+(failed?'tidak tersedia':'sedang dimuat'),failed?'Inventaris dan geometri ditutup karena katalog API gagal atau tidak valid. Tidak ada geometri pengganti. Coba muat katalog melalui tab Bukti RDTR.':'Menunggu snapshot katalog lokal, bukan melakukan discovery katalog live.');
  $('#retryZones').hidden=true;$('#coverageStatus').textContent='Cakupan belum dapat dihitung tanpa katalog valid.';return;
 }
 // Refresh only at inventory transitions; loaders mutate their Map in place.
 const summary=inventorySummary=window.ProvinceData.aggregate(catalog,applied.regions,planRecords,Boolean(map));
 renderRegionBeacons();
 const {state,requestedPlanCount:requested,loadedPlanCount:loaded,failedPlanCount:failed,unmappedPlanCount:unmapped,notListedRegionCount:notListed,pendingPlanCount:pending}=summary;
 $('#zoneCount').textContent=loaded?String(summary.highlightedFeatureCount):'—';
 const live=summary.plans.filter(p=>p.source?.status==='live').length,cached=summary.plans.filter(p=>p.source?.status==='cached_snapshot').length;
 $('#coverageStatus').textContent=`${loaded}/${requested} rencana mappable dimuat; ${map?pending:0} belum selesai; ${failed} gagal; ${unmapped} relasi kegiatan belum tersedia; ${notListed} wilayah tidak tercantum di snapshot katalog publik. Sumber hasil dimuat: ${catalog.localDataset?'Dataset lokal · '+loaded+' rencana; pengamatan sumber asli per rencana, bukan pembacaan live':live+' live, '+cached+' cached_snapshot (waktu sumber per rencana)'}.${catalog.localDataset?' '+summary.notImportedPlanCount+' rencana belum diimpor / belum tersedia dalam rilis, bukan hasil nol.':''} Hanya zona hasil filter yang dimuat, bukan seluruh daratan Sulawesi Tenggara. Area di luar polygon belum dievaluasi.`;
 const title={idle:'Aktifkan peta untuk melihat sorotan',loading:'Memuat polygon sumber…',ready:summary.highlightedFeatureCount?'Zona relevan untuk ditelaah':'Hasil filter sumber kosong',partial:'Hasil parsial — cakupan belum lengkap',unavailable:'Belum ada geometri yang dapat diminta',error:'Geometri sumber gagal dimuat'}[state];
 const message=!map?'Persetujuan peta diperlukan. Setelah aktif, semua rencana dengan calon relasi kegiatan pada wilayah terapan diminta melalui API lokal.':state==='partial'?`Hasil parsial: ${loaded} rencana berhasil, ${pending} belum selesai, ${failed} gagal, ${unmapped} relasi belum tersedia, ${notListed} wilayah tidak tercantum. Tidak menyatakan cakupan penuh. Biru tetap unknown, bukan izin.`:state==='loading'?`Menunggu ${pending} rencana; maksimum 3 permintaan bersamaan. Hasil akan tampil bertahap. Tidak membuat polygon pengganti.`:state==='unavailable'?'Rencana belum diimpor / belum tersedia dalam rilis, wilayah tidak tercantum pada snapshot katalog publik atau relasi kegiatan belum tersedia. Hitungan dan cakupan tidak diketahui; bukan bukti tidak ada RDTR atau kegiatan dilarang.':state==='error'?'Tidak ada rencana yang berhasil dimuat. API/sumber tidak tersedia, waktu tunggu habis atau respons ditolak. Tidak ada fallback geometri.':'Hasil kosong tidak berarti dilarang. Biru menandai relevansi untuk ditelaah, bukan status diizinkan. Klik polygon atau daftar untuk provenance per rencana.';
 setZoneMessage(state,title,message);$('#zoneLoading').hidden=!map||pending===0;$('#retryZones').hidden=!map||failed===0;
 renderZonePage(summary.features);
 renderDrawingState();
 renderAudit();
}
function renderZonePage(features){
 const previous=$('#zonePrevious'),next=$('#zoneNext'),status=$('#zonePageStatus'),list=$('#zoneList');
 const active=document.activeElement,focused=active?.dataset?.zoneId;
 // Incremental plan arrivals can move a focused feature across the page boundary.
 const focusedIndex=focused?features.findIndex(({feature,data})=>window.ProvinceData.featureKey(data.meta.plan.id,feature.id)===focused):-1;
 if(focusedIndex>=0)zonePage=Math.floor(focusedIndex/zonePageSize);
 const total=features.length,pages=Math.ceil(total/zonePageSize);
 zonePage=Math.max(0,Math.min(zonePage,pages-1));
 const start=zonePage*zonePageSize;
 previous.disabled=zonePage===0;next.disabled=zonePage+1>=pages;
 status.textContent=`Halaman ${pages?zonePage+1:0} dari ${pages} · fitur ${total?start+1+'–'+Math.min(start+zonePageSize,total):0} dari ${total}`;
 list.replaceChildren();
 for(const {feature,data} of features.slice(start,start+zonePageSize)){
  const p=feature.properties,key=window.ProvinceData.featureKey(data.meta.plan.id,p.object_id);
  const button=text('button',`${data.meta.plan.name} · ${p.zone_code} · ${p.zone_name} · #${p.object_id}`,'zone-row');button.type='button';button.dataset.zoneId=key;
  button.addEventListener('click',()=>{const b=p.source_bounds;map.fitBounds([[b[1],b[0]],[b[3],b[2]]],{padding:[28,28],maxZoom:16,animate:false});openZone(feature,data);});list.append(button);
  if(focused===key)button.focus();
 }
 // Never strand keyboard focus on a removed row or a newly disabled control.
 if((focused&&focusedIndex<0)||(active===previous&&previous.disabled)||(active===next&&next.disabled)){
  const target=!next.disabled?next:!previous.disabled?previous:list.children[0]||status;target.focus();
 }
}
for(const [id,step] of [['zonePrevious',-1],['zoneNext',1]])$('#'+id).addEventListener('click',()=>{zonePage+=step;renderZoneState();});
const displayTransport=window.DisplayData.createTransport({fetchImpl:(...args)=>fetch(...args),timeoutMs:120000});
const detailLoader=window.DisplayData.createDetailLoader({transport:displayTransport});
$('#zoneDialog').addEventListener('close',()=>{
 detailRevision++;detailLoader.cancel();detailState='idle';
 const row=Array.from($('#zoneList').children).find(e=>e.dataset.zoneId===selectedFeatureKey);if(row)row.focus();
});
const viewportLoader=window.DisplayData.createLoader({transport:displayTransport,onUpdate:records=>{
 const unknown=plans.filter(p=>p.activity&&applied.regions.includes(p.regionId)&&planRecords.get(p.id)?.status!=='ready').map(p=>[p.id,planRecords.get(p.id)||{status:'loading'}]);
 viewportRecords=new Map([...unknown,...records]);
 for(const [id,entry]of records)if(entry.status==='ready'&&!layerMapper.has(id))drawPlan(entry.data);
 renderDrawingState();
}});
const zoneLoader=window.DisplayData.createLoader({transport:displayTransport,onUpdate:records=>{
 planRecords=records;
 viewportRecords=new Map([...records].filter(([id])=>plans.find(p=>p.id===id)?.activity));viewportPhase='loading';
 for(const [id,entry]of records)if(entry.status==='ready'&&!layerMapper.has(id))drawPlan(entry.data);
 renderZoneState();
}});
async function loadZones({focus=false}={}){
 if(focus)pendingApplyFocus=true;
 zoneLoader.cancel();clearZones();
 const revision=loadRevision;
 if(!catalog||!map){renderZoneState();return;}
 const explicitFocus=pendingApplyFocus,focusRevision=cameraRevision;
 const selected=plans.filter(p=>applied.regions.includes(p.regionId));
 const records=await zoneLoader.start(selected,applied.kbli);
 if(revision!==loadRevision||planRecords!==records)return;
 overviewReady=true;
 viewportPhase=inventorySummary.state;renderDrawingState();
 if(explicitFocus&&focusRevision===cameraRevision||!autoFitDone&&!userMoved){pendingApplyFocus=false;autoFitDone=true;autoFitting=true;try{zoomAll();if(explicitFocus)$('#map').scrollIntoView({block:'nearest',behavior:'auto'});}finally{autoFitting=false;}}
 scheduleViewport();
}
$('#retryZones').addEventListener('click',loadZones);
$('#criteriaForm').addEventListener('input',()=>{updateRegionSelectionCount();$('#formStatus').textContent='Ada perubahan draf. Peta dan ekspor masih memakai kriteria terakhir yang diterapkan.';$('#formError').hidden=true;});
$('#criteriaForm').addEventListener('submit',event=>{
 event.preventDefault();const data=new FormData(event.currentTarget);const chosen=data.getAll('region');let error='';
 if(data.get('kbli')!=='01273')error='Pilih KBLI 01273. Eksplorasi ini hanya mencakup kakao.';
 else if(!chosen.length||new Set(chosen).size!==chosen.length||chosen.some(id=>!Object.hasOwn(regions,id)))error='Pilih setidaknya satu kabupaten/kota Sulawesi Tenggara yang tersedia.';
 if(error){$('#formError').textContent=error;$('#formError').hidden=false;return;}
 applied={kbli:'01273',regions:chosen};$('#formError').hidden=true;
 $('#formStatus').textContent='Kriteria diterapkan. Data lama dibersihkan; sorotan tetap berstatus belum direview.';
 updateRegionSelectionCount();renderAudit();loadZones({focus:true});
});
$('#resetButton').addEventListener('click',()=>{$('#criteriaForm').reset();$('#criteriaForm').requestSubmit();});
function configuration(){return window.DisplayData.configuration(catalog,regionEntries,applied,planRecords,Boolean(map),catalogState,{state:viewportPhase,level:viewportLevel,records:viewportRecords,renderer:map?.options?.preferCanvas?'canvas':'svg'});}
function previewExport(){exportSnapshot=configuration();$('#jsonPreview').textContent=JSON.stringify(exportSnapshot,null,2);$('#downloadStatus').textContent='';showDialog('exportDialog');}
for(const id of ['exportTop','exportConfig'])$('#'+id).addEventListener('click',previewExport);
$('#downloadConfig').addEventListener('click',()=>{
 if(!exportSnapshot)return;
 const blob=new Blob([JSON.stringify(exportSnapshot,null,2)+'\n'],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='siap-izin-konfigurasi-eksplorasi.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);$('#downloadStatus').textContent='Unduhan konfigurasi yang dipratinjau diminta ke browser. Tidak memuat geometri.';
});
async function loadAudit(){
 try{
  const response=await fetch('audit-summary.json');if(!response.ok)throw new Error('unavailable');
  const data=await response.json();if(data.schemaVersion!==1||!Array.isArray(data.plans))throw new Error('schema');
  const known=new Set(plans.map(p=>p.id));const validated=new Map();
  for(const item of data.plans){
   if(!known.has(item.id)||typeof item.summary!=='string'||!item.summary.trim()||item.summary.length>4000||validated.has(item.id))throw new Error('invalid');
   if(item.unknowns!==undefined&&(!Array.isArray(item.unknowns)||item.unknowns.some(s=>typeof s!=='string'||s.length>1000)))throw new Error('invalid');
   validated.set(item.id,{summary:item.summary,reviewStatus:typeof item.reviewStatus==='string'?item.reviewStatus.slice(0,300):null,unknowns:item.unknowns||[]});
  }
  audit=validated;checkedAt=typeof data.checkedAt==='string'?data.checkedAt.slice(0,100):null;
  $('#auditSummaryStatus').textContent=audit.size?`Ringkasan audit historis: ${audit.size} entri. Terpisah dari katalog ${plans.length} rencana dan waktu pembacaan geometri; sampel ITBX bukan penilaian seluruh bidang.`:'Belum ada ringkasan audit turunan; yang tampil hanya snapshot katalog.';
 }catch{audit=new Map();$('#auditSummaryStatus').textContent='Ringkasan audit historis tidak tersedia atau tidak valid. Tidak ada penilaian baru.';}
}
function resource(tag,url,integrity){return new Promise((resolve,reject)=>{
 const el=document.createElement(tag);if(tag==='link'){el.rel='stylesheet';el.href=url;}else el.src=url;
 el.integrity=integrity;el.crossOrigin='anonymous';const timer=setTimeout(()=>{el.remove();reject(new Error('timeout'));},12000);
 el.onload=()=>{clearTimeout(timer);resolve();};el.onerror=()=>{clearTimeout(timer);el.remove();reject(new Error('resource'));};document.head.append(el);
});}
function mapProblem(message){$('#mapAlert').hidden=false;$('#mapAlert').textContent=message;$('#mapStatus').textContent='Peta dasar gagal atau hanya sebagian tersedia; lihat status geometri secara terpisah.';}
$('#loadMap').addEventListener('click',async()=>{
 const button=$('#loadMap');button.disabled=true;button.textContent='Memuat peta…';$('#mapAlert').hidden=true;$('#mapStatus').textContent='Memuat peta publik…';
 try{
  await resource('link','https://unpkg.com/leaflet@1.9.4/dist/leaflet.css','sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=');
  if(!window.L)await resource('script','https://unpkg.com/leaflet@1.9.4/dist/leaflet.js','sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=');
  map=window.L.map('map',{scrollWheelZoom:false}).setView([-4.05,122.1],7);
  bindMapEvents();
  $('#mapGate').hidden=true;$('#mapKey').hidden=false;
  const layer=window.L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a>',keepBuffer:0});
  let loaded=0,errors=0;let waitTimer;
  layer.on('loading',()=>{loaded=0;errors=0;$('#mapStatus').textContent='Memuat tile untuk area tampilan…';clearTimeout(waitTimer);waitTimer=setTimeout(()=>mapProblem('Peta dasar belum selesai dimuat. Bukti dan status geometri tetap dapat diperiksa.'),15000);});
  layer.on('tileload',()=>{loaded++;});layer.on('tileerror',()=>{errors++;mapProblem('Sebagian atau semua tile gagal dimuat. Sorotan bukan jaminan peta dasar lengkap.');});
  layer.on('load',()=>{clearTimeout(waitTimer);if(loaded&&!errors){$('#mapAlert').hidden=true;$('#mapStatus').textContent='Peta dasar publik dimuat · status sorotan terpisah di tab Zona.';}else mapProblem('Tile peta tidak tersedia lengkap. Tidak ada peta pengganti yang direka.');});
  layer.addTo(map);$('#resetMap').disabled=false;map.invalidateSize();loadZones();
 }catch{
  zoneLoader.cancel();clearZones();if(map){map.remove();map=null;}
  renderZoneState();$('#mapGate').hidden=false;$('#mapKey').hidden=true;$('#resetMap').disabled=true;
  mapProblem('Peta publik gagal dimuat. Periksa jaringan; bukti dan konfigurasi tetap tersedia.');button.disabled=false;button.textContent='Coba muat peta lagi';
 }
});
$('#resetMap').addEventListener('click',zoomAll);
renderRegionOptions();clearZones();renderAudit();loadCatalog();
