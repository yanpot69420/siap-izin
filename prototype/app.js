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
const layerMapper = new Map();
const featureLayers = new Map();
let planRecords = new Map();
let zonePhase = 'idle';
let exportSnapshot = null;
const zonePageSize = 200;
let zonePage = 0;

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
function planStatus(plan){
 if(!plan.activity)return 'unavailable · relasi kegiatan belum tersedia';
 const entry=planRecords.get(plan.id);
 if(entry?.status==='ready')return `ready · ${entry.data.features.length} polygon · ${entry.data.meta.source.status} · ${entry.data.meta.source.retrievedAt}`;
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
 $('#catalogStatus').textContent=catalog?`Snapshot katalog lokal · ${catalog.sourceStatus} · diperiksa ${catalog.checkedAt} · ${catalog.plans.length} rencana dalam ${catalog.regions.filter(r=>r.planIds.length).length} dari ${catalog.regions.length} wilayah administratif. Bukan katalog live.`:catalogState==='error'?'Katalog lokal gagal atau tidak valid. Inventaris ditutup; tidak memakai fallback.':'Memuat snapshot katalog lokal…';
 $('#retryCatalog').hidden=catalogState!=='error';
 const missing=catalog?.regions.filter(r=>applied.regions.includes(r.id)&&r.catalogStatus==='not_listed_in_public_catalog')||[];
 const unmapped=visible.filter(p=>!p.activity);
 $('#catalogGaps').textContent=catalog?`${missing.length} wilayah tidak tercantum pada snapshot katalog publik: ${missing.map(r=>r.name).join('; ')||'tidak ada pada pilihan ini'}. Bukan bukti tidak ada RDTR. ${unmapped.length} rencana belum memiliki relasi kegiatan: ${unmapped.map(p=>p.name).join('; ')||'tidak ada pada pilihan ini'}.`:'Cakupan belum dapat dihitung tanpa katalog valid.';
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
 if(entry?.data){const m=entry.data.meta;body.append(fact('Sumber geometri',`${m.source.status} · ${m.source.retrievedAt}`),fact('Hasil filter',`${m.counts.matched} cocok · ${m.counts.returned} ditampilkan · ${m.counts.excludedInvalid} dikarantina. Nol hasil bukan dilarang.`),fact('Filter sumber',`${m.activity.filterField} IN (${m.filterZoneCodes.join(', ')})`));for(const limit of m.limitations)body.append(text('p',limit,'small'));}
 const extra=audit.get(p.id);
 if(extra){body.append(fact('Audit historis — bukan evaluasi seluruh bidang',extra.summary),fact('Waktu audit historis',checkedAt||'Tidak dicantumkan'),fact('Status review ringkasan',extra.reviewStatus||'Belum dicantumkan'));if(extra.unknowns.length)body.append(fact('Ketidakpastian audit',extra.unknowns.join(' · ')));}
 const links=text('div','','source-links');links.append(sourceLink('Katalog GISTARU',p.catalogUrl),sourceLink('Daftar kegiatan lokal',p.activitiesUrl));
 if(entry?.data)links.append(sourceLink('Metadata layer resmi',entry.data.meta.source.metadataUrl),sourceLink('Query geometri sumber',entry.data.meta.source.geometryQueryUrl));
 body.append(links);showDialog('detailDialog');
}
function clearZones(){
 if(zoneLayerFeatureGroup&&map)map.removeLayer(zoneLayerFeatureGroup);
 zoneLayerFeatureGroup=null;layerMapper.clear();featureLayers.clear();planRecords=new Map();
 zonePage=0;renderZonePage([]);$('#zoneCount').textContent='—';
 $('#zoneSummary').textContent='Belum ada geometri sumber yang dimuat.';
 $('#coverageStatus').textContent='Cakupan hanya zona hasil filter dari rencana yang berhasil dimuat; bukan seluruh daratan Sulawesi Tenggara.';
 $('#mapKey').textContent='Biru putus-putus = relevan untuk ditelaah, status izin unknown. Bukan persetujuan OSS.';
 for(const id of ['zoneDialog','detailDialog'])if($('#'+id).open)$('#'+id).close();
}
function setZoneMessage(phase,title,message){
 zonePhase=phase;$('#zoneHeading').textContent=title;$('#zoneStatus').textContent=message;
 $('#zoneLoading').hidden=phase!=='loading';$('#retryZones').hidden=phase!=='error';
}
function openZone(feature,data){
 // Each event/list entry binds to its original collection, never the last global response.
 if(planRecords.get(data.meta.plan.id)?.data!==data)return;
 const p=feature.properties,m=data.meta;
 $('#zoneDetailTitle').textContent=`${p.zone_name} · ${p.zone_code} · #${p.object_id}`;
 const body=$('#zoneDetailContent');body.replaceChildren();
 body.append(text('p','Relevan untuk ditelaah — bukan indikasi diizinkan atau hasil kesesuaian KBLI terverifikasi. Status izin: unknown.','detail-note'),fact('Rencana / identitas fitur',`${m.plan.name} · ${m.plan.id} / ${window.ProvinceData.featureKey(m.plan.id,p.object_id)}`),fact('Kabupaten/kota',regions[m.plan.regionId]),fact('KBLI dan asumsi ruang lingkup',`${m.kbli.code} · versi ${m.kbli.version} · ${m.kbli.scope}; ruang lingkup belum dikonfirmasi`),fact('Dasar sorotan',`ID kegiatan lokal ${m.activity.id} — ${m.activity.name}. Filter ${m.activity.filterField} = ${p.filter_value}; kode subzona asli KODSZN = ${p.zone_code}. Nilai filter terdapat pada daftar kegiatan sumber; bukan keputusan izin.`),fact('Status kegiatan/zona','unreviewed_mapping · unknown. Pemetaan KBLI belum direview; daftar filter dapat memuat kategori terbatas dan/atau bersyarat. ITBX sampel historis bukan evaluasi seluruh bidang.'),fact('Peraturan dari atribut sumber',p.regulation||'Belum tersedia; dokumen belum ditelaah lengkap.'),fact('Waktu dan metode pembacaan',`${m.source.retrievedAt} · ${m.source.status==='live'?'live — pembacaan sumber':'cached_snapshot — snapshot cache, bukan pembacaan live'}`),fact('Cakupan / tujuan geometri',`${m.coverage} · ${m.geometryPurpose}. Hanya polygon hasil filter rencana ini; bukan seluruh kabupaten, bidang proyek atau batas hak.`),fact('Rekonsiliasi sumber',`${m.counts.matched} cocok filter · ${m.counts.returned} ditampilkan · ${m.counts.excludedInvalid} dikarantina.`));
 const limits=text('ul','','zone-limits');for(const item of m.limitations)limits.append(text('li',item));body.append(limits);
 const links=text('div','','source-links');links.append(sourceLink('Kegiatan lokal resmi',m.source.activitiesUrl),sourceLink('Metadata layer resmi',m.source.metadataUrl),sourceLink('Query geometri sumber',m.source.geometryQueryUrl));body.append(links);showDialog('zoneDialog');
}
function drawPlan(data){
 if(!zoneLayerFeatureGroup)zoneLayerFeatureGroup=window.L.featureGroup().addTo(map);
 const style={color:'#286aa6',weight:2,fillColor:'#4b8cce',fillOpacity:0.26,dashArray:'6 4'};
 const layer=window.L.geoJSON(data,{
  style:()=>style,
  onEachFeature:(feature,child)=>{
   featureLayers.set(window.ProvinceData.featureKey(data.meta.plan.id,feature.id),child);
   child.on('click',()=>openZone(feature,data));
   child.on('mouseover',()=>child.setStyle({weight:3,fillOpacity:0.4}));
   child.on('mouseout',()=>child.setStyle(style));
  }
 });
 layerMapper.set(data.meta.plan.id,layer);zoneLayerFeatureGroup.addLayer(layer);
}
function zoomAll(){
 const bounds=zoneLayerFeatureGroup?.getBounds();
 if(bounds?.isValid())map.fitBounds(bounds,{padding:[28,28],maxZoom:15});
 else if(map)map.setView([-4.05,122.1],7); // Viewport only, never a coverage boundary.
}
function renderZoneState(){
 if(!catalog){
  const failed=catalogState==='error';setZoneMessage(failed?'error':catalogState,'Katalog sumber '+(failed?'tidak tersedia':'sedang dimuat'),failed?'Inventaris dan geometri ditutup karena katalog API gagal atau tidak valid. Tidak ada geometri pengganti. Coba muat katalog melalui tab Bukti RDTR.':'Menunggu snapshot katalog lokal, bukan melakukan discovery katalog live.');
  $('#retryZones').hidden=true;$('#coverageStatus').textContent='Cakupan belum dapat dihitung tanpa katalog valid.';return;
 }
 const summary=window.ProvinceData.aggregate(catalog,applied.regions,planRecords,Boolean(map));
 const {state,requestedPlanCount:requested,loadedPlanCount:loaded,failedPlanCount:failed,unmappedPlanCount:unmapped,notListedRegionCount:notListed,pendingPlanCount:pending}=summary;
 $('#zoneCount').textContent=loaded?String(summary.highlightedFeatureCount):'—';
 $('#zoneSummary').textContent=`${loaded}/${requested} rencana mappable dimuat · ${summary.highlightedFeatureCount} polygon sumber · ${summary.counts.excludedInvalid} geometri dikarantina · bukan jumlah lokasi sesuai`;
 const live=summary.plans.filter(p=>p.source?.status==='live').length,cached=summary.plans.filter(p=>p.source?.status==='cached_snapshot').length;
 $('#coverageStatus').textContent=`${loaded}/${requested} rencana mappable dimuat; ${map?pending:0} belum selesai; ${failed} gagal; ${unmapped} relasi kegiatan belum tersedia; ${notListed} wilayah tidak tercantum di snapshot katalog publik. Sumber hasil dimuat: ${live} live, ${cached} cached_snapshot (waktu sumber per rencana). Hanya zona hasil filter yang dimuat, bukan seluruh daratan Sulawesi Tenggara. Area di luar polygon belum dievaluasi.`;
 const title={idle:'Aktifkan peta untuk melihat sorotan',loading:'Memuat polygon sumber…',ready:summary.highlightedFeatureCount?'Zona relevan untuk ditelaah':'Hasil filter sumber kosong',partial:'Hasil parsial — cakupan belum lengkap',unavailable:'Belum ada geometri yang dapat diminta',error:'Geometri sumber gagal dimuat'}[state];
 const message=!map?'Persetujuan peta diperlukan. Setelah aktif, semua rencana dengan calon relasi kegiatan pada wilayah terapan diminta melalui API lokal.':state==='partial'?`Hasil parsial: ${loaded} rencana berhasil, ${pending} belum selesai, ${failed} gagal, ${unmapped} relasi belum tersedia, ${notListed} wilayah tidak tercantum. Tidak menyatakan cakupan penuh. Biru tetap unknown, bukan izin.`:state==='loading'?`Menunggu ${pending} rencana; maksimum 3 permintaan bersamaan. Hasil akan tampil bertahap. Tidak membuat polygon pengganti.`:state==='unavailable'?'Wilayah tidak tercantum pada snapshot katalog publik atau relasi kegiatan belum tersedia. Bukan bukti tidak ada RDTR atau kegiatan dilarang.':state==='error'?'Tidak ada rencana yang berhasil dimuat. API/sumber tidak tersedia, waktu tunggu habis atau respons ditolak. Tidak ada fallback geometri.':'Hasil kosong tidak berarti dilarang. Biru menandai relevansi untuk ditelaah, bukan status diizinkan. Klik polygon atau daftar untuk provenance per rencana.';
 setZoneMessage(state,title,message);$('#zoneLoading').hidden=!map||pending===0;$('#retryZones').hidden=!map||failed===0;
 renderZonePage(summary.features);
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
  button.addEventListener('click',()=>{const layer=featureLayers.get(key);if(layer)map.fitBounds(layer.getBounds(),{padding:[28,28],maxZoom:16});openZone(feature,data);});list.append(button);
  if(focused===key)button.focus();
 }
 // Never strand keyboard focus on a removed row or a newly disabled control.
 if((focused&&focusedIndex<0)||(active===previous&&previous.disabled)||(active===next&&next.disabled)){
  const target=!next.disabled?next:!previous.disabled?previous:list.children[0]||status;target.focus();
 }
}
for(const [id,step] of [['zonePrevious',-1],['zoneNext',1]])$('#'+id).addEventListener('click',()=>{zonePage+=step;renderZoneState();});
const zoneLoader=window.ProvinceData.createLoader({fetchImpl:(...args)=>fetch(...args),validateCollection:window.ZoneData.validateCollection,timeoutMs:120000,onUpdate:records=>{
 planRecords=records;
 for(const [id,entry]of records)if(entry.status==='ready'&&!layerMapper.has(id))drawPlan(entry.data);
 renderZoneState();
}});
async function loadZones(){
 zoneLoader.cancel();clearZones();
 if(!catalog||!map){renderZoneState();return;}
 const selected=plans.filter(p=>applied.regions.includes(p.regionId));
 const records=await zoneLoader.start(selected,applied.kbli);
 if(planRecords===records)zoomAll();
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
 updateRegionSelectionCount();renderAudit();loadZones();
});
$('#resetButton').addEventListener('click',()=>{$('#criteriaForm').reset();$('#criteriaForm').requestSubmit();});
function configuration(){return window.ProvinceData.configuration(catalog,regionEntries,applied,planRecords,Boolean(map),catalogState);}
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
