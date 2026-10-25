'use strict';
const $ = selector => document.querySelector(selector);
const regionEntries = window.RegionData.entries;
const regions = Object.fromEntries(regionEntries.map(region=>[region.id,region.name]));
const plans = [
 ['7411000000','001','RDTR Kawasan Perkotaan Tirawuta','041','Perkebunan tanaman aromatik/penyegar'],
 ['7411000000','002','RDTR Kawasan Agropolitan Mowewe, Lalolae, Tinondo','041','Perkebunan tanaman aromatik/penyegar'],
 ['7401000000','001','RDTR Kawasan Perkotaan Kolaka','025','Perkebunan Tanaman Aromatik/Penyegar'],
 ['7401000000','002','RDTR Kawasan Perkotaan Wolo','034','Perkebunan Tanaman Aromatik/Penyegar'],
 ['7402000000','003','RDTR Wilayah Perencanaan Routa','043','Perkebunan Tanaman Aromatik/Penyegaran'],
 ['7402000000','002','RDTR Pondidaha','016','PERKEBUNAN TANAMAN AROMATIK/PENYEGAR'],
 ['7405000000','002','RDTR Wilayah Perencanaan Laonti','044','Perkebunan Tanaman Aromatik/Penyegar'],
 ['7405000000','001','RDTR Wilayah Perencanaan Angata','044','Perkebunan Tanaman Aromatik/Penyegar']
].map(([region,rtr,name,activity,activityName]) => ({id:`${region}:${rtr}`,region,rtr,name,activity,activityName}));
const PILOT_PLAN_ID = '7411000000:001';
let applied = {kbli:'01273',regions:Object.keys(regions)};
let audit = new Map();
let checkedAt = null;
let map = null;
let zoneLayer = null;
let zoneData = null;
let zoneRequest = null;
let zoneRevision = 0;
let zonePhase = 'idle';
let exportSnapshot = null;

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
function renderAudit(){
 const visible=plans.filter(p=>applied.regions.includes(p.region));
 $('#auditCount').textContent=visible.length;
 $('#regionSummary').textContent=`KBLI ${applied.kbli} · ${applied.regions.length} kabupaten/kota dipilih · ${visible.length} entri metadata`;
 $('#mapTitle').textContent=`Sulawesi Tenggara / ${applied.regions.length===1?regions[applied.regions[0]]:'Eksplorasi zona'}`;
 $('#auditEmpty').hidden=visible.length!==0;
 $('#auditList').replaceChildren();
 for(const [index,p] of visible.entries()){
  const row=text('button','','audit-row');row.type='button';row.dataset.plan=p.id;
  const main=text('span','','row-main');main.append(text('strong',p.name),text('span',`${regions[p.region]} · ${p.id===PILOT_PLAN_ID?'Pilot geometri; mapping belum direview':'Metadata saja; geometri belum diaktifkan'}`,'small'));
  row.append(text('span',String(index+1).padStart(2,'0'),'row-number'),main,text('span','↗'));
  row.addEventListener('click',()=>openPlan(p));$('#auditList').append(row);
 }
}
function openPlan(p){
 $('#detailTitle').textContent=p.name;
 const body=$('#detailContent');body.replaceChildren();
 body.append(fact('Kabupaten/kota / ID rencana',`${regions[p.region]} / ${p.id}`),fact('Bukti terdokumentasi','Inventaris katalog dan daftar kegiatan; geometri yang diaktifkan dibaca melalui API lokal dengan waktu sumber tersendiri.'),fact('Calon relasi kegiatan — belum direview',`${p.activity} — ${p.activityName}`),fact('Yang belum terbukti','Pemetaan exact-KBLI 01273, semua syarat/blok dan penerimaan pengajuan OSS.'));
 if(p.name.endsWith('Wolo'))body.append(text('p','Wolo: muncul pada katalog tidak berarti sudah terintegrasi atau siap pengajuan.','detail-note'));
 const extra=audit.get(p.id);
 if(extra){body.append(fact('Ringkasan audit historis — bukan hasil evaluasi lokasi',extra.summary),fact('Waktu audit historis',checkedAt||'Tidak dicantumkan'),fact('Status review ringkasan',extra.reviewStatus||'Belum dicantumkan'));if(extra.unknowns.length)body.append(fact('Ketidakpastian audit',extra.unknowns.join(' · ')));}
 const links=text('div','','source-links');links.append(sourceLink('Katalog GISTARU',`https://gistaru.atrbpn.go.id/rdtrinteraktif/api/interactive/rdtr/${p.region}`),sourceLink('Daftar kegiatan lokal',`https://gistaru.atrbpn.go.id/rdtrinteraktif/api/interactive/activities?id_wilayah=${p.region}&id_rtr=${p.rtr}`));body.append(links);showDialog('detailDialog');
}
function clearZones(){
 if(zoneLayer&&map)map.removeLayer(zoneLayer);
 zoneLayer=null;zoneData=null;
 $('#zoneList').replaceChildren();
 $('#zoneCount').textContent='—';
 $('#zoneSummary').textContent='Belum ada geometri sumber yang dimuat.';
 $('#coverageStatus').textContent='Pilot geometri: Tirawuta saja; tujuh rencana lain masih metadata. Area di luar polygon dimuat belum dievaluasi.';
 $('#mapKey').textContent='Biru putus-putus = relevan untuk ditelaah, bukan diizinkan. Tidak ada hasil kesesuaian terverifikasi.';
}
function setZoneMessage(phase,title,message){
 zonePhase=phase;$('#zoneHeading').textContent=title;$('#zoneStatus').textContent=message;
 $('#zoneLoading').hidden=phase!=='loading';$('#retryZones').hidden=phase!=='error';
}
function openZone(feature){
 if(!zoneData)return;
 const p=feature.properties,m=zoneData.meta;
 $('#zoneDetailTitle').textContent=`${p.zone_name} · ${p.zone_code} · #${p.object_id}`;
 const body=$('#zoneDetailContent');body.replaceChildren();
 body.append(text('p','Relevan untuk ditelaah — belum merupakan indikasi diizinkan atau hasil kesesuaian KBLI terverifikasi.','detail-note'),fact('Rencana / fitur',`${m.plan.name} / ${p.object_id}`),fact('KBLI dan asumsi ruang lingkup',`${m.kbli.code} · versi ${m.kbli.version} · ${m.kbli.scope}; ruang lingkup belum dikonfirmasi`),fact('Dasar sorotan',`ID kegiatan lokal ${p.activity_id} — ${p.activity_name}. Kode subzona ${p.zone_code} terdapat pada daftar filter kegiatan sumber.`),fact('Status kegiatan/zona','Belum dapat dipastikan. Pemetaan KBLI belum direview; daftar filter dapat memuat kategori terbatas dan/atau bersyarat.'),fact('Peraturan dari atribut sumber',p.regulation||'Belum tersedia; dokumen belum ditelaah lengkap.'),fact('Waktu dan metode pembacaan',`${m.source.retrievedAt} · ${m.source.status==='live'?'pembacaan sumber':'snapshot cache; bukan pembacaan live'}`),fact('Batas cakupan','Polygon sumber untuk satu rencana/subzona yang dimuat; bukan seluruh kabupaten, bukan bidang proyek, bukan batas hak.'));
 const limits=text('ul','','zone-limits');for(const item of m.limitations)limits.append(text('li',item));body.append(limits);
 const links=text('div','','source-links');links.append(sourceLink('Kegiatan lokal resmi',m.source.activitiesUrl),sourceLink('Metadata layer resmi',m.source.metadataUrl),sourceLink('Query geometri sumber',m.source.geometryQueryUrl));body.append(links);showDialog('zoneDialog');
}
function drawZones(data){
 const style={color:'#286aa6',weight:2,fillColor:'#4b8cce',fillOpacity:0.26,dashArray:'6 4'};
 zoneLayer=window.L.geoJSON(data,{
  style:()=>style,
  onEachFeature:(feature,layer)=>{
   layer.on('click',()=>openZone(feature));
   layer.on('mouseover',()=>layer.setStyle({weight:3,fillOpacity:0.4}));
   layer.on('mouseout',()=>{if(zoneLayer)zoneLayer.resetStyle(layer);});
  }
 }).addTo(map);
 zoneData=data;
 const m=data.meta;
 $('#zoneCount').textContent=String(data.features.length);
 $('#zoneSummary').textContent=`${m.counts.returned} polygon sumber · ${m.counts.excludedInvalid} geometri dikarantina · bukan jumlah lokasi sesuai`;
 $('#coverageStatus').textContent=`${m.plan.name} · subzona filter ${m.filterZoneCodes.join(', ')} saja. Sumber ${m.source.status==='live'?'dibaca':'cache'}: ${m.source.retrievedAt}. Rencana lain dan area di luar polygon ini belum dievaluasi.`;
 for(const feature of data.features.slice(0,200)){
  const p=feature.properties;const button=text('button',`${p.zone_code} · ${p.zone_name} · #${p.object_id}`,'zone-row');button.type='button';button.dataset.zoneId=String(p.object_id);
  button.addEventListener('click',()=>{const layer=zoneLayer?.getLayers().find(x=>String(x.feature.id)===String(feature.id));if(layer)map.fitBounds(layer.getBounds(),{padding:[28,28],maxZoom:16});openZone(feature);});
  $('#zoneList').append(button);
 }
 if(data.features.length>200)$('#zoneList').append(text('p','Daftar menampilkan 200 fitur pertama; seluruh geometri respons tetap dapat diklik pada peta.','small'));
 if(data.features.length)map.fitBounds(zoneLayer.getBounds(),{padding:[28,28],maxZoom:15});
 setZoneMessage('ready',data.features.length?'Zona relevan untuk ditelaah':'Tidak ada polygon pada hasil filter sumber',data.features.length?'Biru bukan status diizinkan. Klik polygon atau pilih daftar untuk membaca dasar sorotan dan batas buktinya.':'Hasil kosong tidak berarti dilarang. Hanya satu rencana dan filter kegiatan yang diperiksa.');
}
async function loadZones(){
 const revision=++zoneRevision;
 if(zoneRequest)zoneRequest.abort();zoneRequest=null;clearZones();
 if(!map){setZoneMessage('idle','Aktifkan peta untuk melihat sorotan','Peta memerlukan persetujuan memuat layanan eksternal. Setelah aktif, geometri pilot dibaca melalui API lokal.');return;}
 if(!applied.regions.includes('7411000000')){map.setView([-4.05,122.1],7);setZoneMessage('unavailable','Sorotan belum diaktifkan pada wilayah terpilih','Geometri aktif baru Tirawuta, Kabupaten Kolaka Timur. Inventaris RDTR wilayah lain belum lengkap; ini bukan kesimpulan bahwa tidak ada RDTR atau kegiatan dilarang.');return;}
 setZoneMessage('loading','Memuat polygon sumber…','Mengambil geometri nyata untuk pilot Tirawuta. Tidak membuat polygon pengganti jika sumber gagal.');
 const controller=new AbortController();zoneRequest=controller;
 const timer=setTimeout(()=>controller.abort(),45000);
 try{
  // Pilot API accepts only these allowlisted literal identifiers.
  const query=`plan=${PILOT_PLAN_ID}&kbli=${applied.kbli}`;
  const response=await fetch(`/api/zones?${query}`,{signal:controller.signal,cache:'no-store'});
  if(!response.ok)throw new Error('Sumber atau API lokal belum tersedia.');
  const data=window.ZoneData.validateCollection(await response.json(),PILOT_PLAN_ID,applied.kbli);
  if(revision!==zoneRevision)return;
  drawZones(data);
 }catch(error){
  if(revision!==zoneRevision)return;
  clearZones();setZoneMessage('error','Sorotan tidak dapat dimuat',error.name==='AbortError'?'Waktu tunggu sumber habis. Tidak ada geometri pengganti; coba lagi.':'API/sumber geometri tidak tersedia atau respons tidak valid. Jalankan server eksplorasi sesuai README; data kosong tidak dianggap sesuai atau dilarang.');
 }finally{clearTimeout(timer);if(revision===zoneRevision)zoneRequest=null;}
}
$('#retryZones').addEventListener('click',loadZones);
$('#criteriaForm').addEventListener('input',()=>{updateRegionSelectionCount();$('#formStatus').textContent='Ada perubahan draf. Peta dan ekspor masih memakai kriteria terakhir yang diterapkan.';$('#formError').hidden=true;});
$('#criteriaForm').addEventListener('submit',event=>{
 event.preventDefault();const data=new FormData(event.currentTarget);const chosen=data.getAll('region');let error='';
 if(data.get('kbli')!=='01273')error='Pilih KBLI 01273. Pilot ini hanya mencakup kakao.';
 else if(!chosen.length||chosen.some(id=>!Object.hasOwn(regions,id)))error='Pilih setidaknya satu kabupaten/kota Sulawesi Tenggara yang tersedia.';
 if(error){$('#formError').textContent=error;$('#formError').hidden=false;return;}
 applied={kbli:'01273',regions:chosen};$('#formError').hidden=true;
 $('#formStatus').textContent='Kriteria eksplorasi diterapkan. Sorotan mempertahankan status belum direview; inventaris bukti diperbarui.';
 updateRegionSelectionCount();renderAudit();loadZones();
});
$('#resetButton').addEventListener('click',()=>{$('#criteriaForm').reset();$('#criteriaForm').requestSubmit();});
function configuration(){return {
 schemaVersion:2,artifactType:'zone-exploration-configuration',module:'zone-exploration',status:'eksplorasi-pilot-pemetaan-belum-direview',
 kbli:{code:applied.kbli,version:'2025',scope:'budidaya-kakao',scopeConfirmed:false},regions:applied.regions.map(id=>{const region=regionEntries.find(item=>item.id===id);return {id,name:region.name,idNamespace:region.idNamespace,gistaruId:region.gistaruId};}),
 assessments:{zoning:'belum-dinilai'},evaluatedZoneCount:0,containsGeometry:false,
 overlay:{state:zonePhase,planId:zoneData?PILOT_PLAN_ID:null,highlightedFeatureCount:zoneData?.features.length??0,mappingReviewed:false,source:zoneData?{status:zoneData.meta.source.status,retrievedAt:zoneData.meta.source.retrievedAt}:null},
 limitations:['Konfigurasi saja, bukan GeoJSON atau hasil kesesuaian.','Sorotan adalah relevansi kelompok kegiatan lokal; bukan penerimaan exact-KBLI atau izin OSS.','Cakupan pilot Tirawuta saja; wilayah lain belum dievaluasi.','Luas, jalan dan pembuatan polygon merupakan modul terpisah.']
};}
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
  $('#auditSummaryStatus').textContent=audit.size?`Ringkasan audit historis tersedia untuk ${audit.size} dari 8 entri. Ini terpisah dari waktu pembacaan geometri pilot.`:'Belum ada ringkasan audit turunan; yang tampil hanya inventaris discovery.';
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
  if(map){map.remove();map=null;}
  clearZones();$('#mapGate').hidden=false;$('#mapKey').hidden=true;$('#resetMap').disabled=true;
  mapProblem('Peta publik gagal dimuat. Periksa jaringan; bukti dan konfigurasi tetap tersedia.');button.disabled=false;button.textContent='Coba muat peta lagi';
 }
});
$('#resetMap').addEventListener('click',()=>{if(zoneLayer&&zoneData?.features.length)map.fitBounds(zoneLayer.getBounds(),{padding:[28,28],maxZoom:15});else if(map)map.setView([-4.05,122.1],7);});
renderRegionOptions();renderAudit();loadAudit();clearZones();setZoneMessage('idle','Aktifkan peta untuk melihat sorotan','Pilot geometri Tirawuta; pemetaan exact-KBLI dan kondisi izin belum direview.');
