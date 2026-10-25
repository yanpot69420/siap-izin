'use strict';
const $ = (selector) => document.querySelector(selector);
const regions = {'7411000000':'Kolaka Timur','7401000000':'Kolaka','7402000000':'Konawe','7405000000':'Konawe Selatan'};
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
let applied = {kbli:'01273',regions:Object.keys(regions),area:5000,road:'preferred'};
let audit = new Map();
let checkedAt = null;
let map = null;
const numberFormat = new Intl.NumberFormat('id-ID',{maximumFractionDigits:4});
function text(tag, value, className) {const el=document.createElement(tag);el.textContent=value;if(className)el.className=className;return el;}
function sourceLink(label, url) {const a=text('a',label+' ↗');a.href=url;a.target='_blank';a.rel='noopener';return a;}
function fact(label, value) {const d=text('div','','detail-fact');d.append(text('strong',label),text('p',value));return d;}
function showDialog(id) {const dialog=$('#'+id);if(!dialog.open)dialog.showModal();}
for(const close of document.querySelectorAll('[data-close]'))close.addEventListener('click',()=>$('#'+close.dataset.close).close());
$('#aboutButton').addEventListener('click',()=>showDialog('aboutDialog'));
function activateTab(name, focus=false) {
 for(const tab of document.querySelectorAll('[role=tab]')) {const active=tab.dataset.tab===name;tab.setAttribute('aria-selected',String(active));tab.tabIndex=active?0:-1;$('#view-'+tab.dataset.tab).hidden=!active;if(active&&focus)tab.focus();}
}
const tabs=[...document.querySelectorAll('[role=tab]')];
for(const tab of tabs){tab.addEventListener('click',()=>activateTab(tab.dataset.tab));tab.addEventListener('keydown',(event)=>{let next=tabs.indexOf(tab);if(event.key==='ArrowRight')next=(next+1)%tabs.length;else if(event.key==='ArrowLeft')next=(next+tabs.length-1)%tabs.length;else if(event.key==='Home')next=0;else if(event.key==='End')next=tabs.length-1;else return;event.preventDefault();activateTab(tabs[next].dataset.tab,true);});}
for(const id of ['inspectEvidence','openSources'])$('#'+id).addEventListener('click',()=>activateTab('audit',true));
function renderAudit() {
 const visible=plans.filter(p=>applied.regions.includes(p.region));
 $('#auditCount').textContent=visible.length;
 $('#regionSummary').textContent=`${applied.regions.length} kabupaten dipilih · ${visible.length} entri metadata`;
 $('#auditList').replaceChildren();
 for(const [index,p] of visible.entries()) {
  const row=text('button','','audit-row');row.type='button';row.dataset.plan=p.id;
  const main=text('span','','row-main');main.append(text('strong',p.name),text('span',`${regions[p.region]} · Metadata dirujuk · penilaian bidang belum ada`,'small'));
  row.append(text('span',String(index+1).padStart(2,'0'),'row-number'),main,text('span','↗'));
  row.addEventListener('click',()=>openPlan(p));$('#auditList').append(row);
 }
}
function openPlan(p) {
 $('#detailTitle').textContent=p.name;
 const body=$('#detailContent');body.replaceChildren();
 body.append(fact('Kabupaten / ID rencana',`${regions[p.region]} / ${p.region}:${p.rtr}`),fact('Bukti terdokumentasi','Entri katalog dan daftar kegiatan dirujuk oleh docs/discovery/pilot-kakao.md. Bukan pembacaan live dalam mockup.'),fact('Calon relasi kegiatan — belum direview',`${p.activity} — ${p.activityName}`),fact('Yang belum terbukti','Penerimaan exact-KBLI 01273, ketentuan seluruh bidang proyek, cakupan polygon rencana dan keberlakuan untuk pengajuan.'));
 if(p.name.endsWith('Wolo'))body.append(text('p','Wolo: muncul pada katalog tidak berarti sudah terintegrasi atau siap pengajuan.','detail-note'));
 const extra=audit.get(p.id);
 if(extra){body.append(fact('Ringkasan audit turunan — bukan hasil evaluasi lokasi',extra.summary),fact('Waktu pemeriksaan sumber (dari ringkasan)',checkedAt||'Tidak dicantumkan'),fact('Status review ringkasan',extra.reviewStatus||'Belum dicantumkan'));if(extra.unknowns?.length)body.append(fact('Ketidakpastian dari audit',extra.unknowns.join(' · ')));}
 const links=text('div','','source-links');links.append(sourceLink('Sumber katalog GISTARU',`https://gistaru.atrbpn.go.id/rdtrinteraktif/api/interactive/rdtr/${p.region}`),sourceLink('Daftar kegiatan lokal',`https://gistaru.atrbpn.go.id/rdtrinteraktif/api/interactive/activities?id_wilayah=${p.region}&id_rtr=${p.rtr}`));body.append(links,text('p','Kesamaan istilah bukan pemetaan KBLI. Tidak ada polygon resmi yang direproduksi di sini.','detail-note'));showDialog('detailDialog');
}
$('#criteriaForm').addEventListener('input',()=>{$('#formStatus').textContent='Ada perubahan draf. Terapkan sebelum mengekspor.';$('#formError').hidden=true;});
$('#criteriaForm').addEventListener('submit',(event)=>{
 event.preventDefault();const form=event.currentTarget;const data=new FormData(form);const chosen=data.getAll('region');const area=Number(data.get('area'));let error='';
 if(data.get('kbli')!=='01273')error='Pilih KBLI 01273. Mockup ini hanya mencakup pilot kakao.';
 else if(!chosen.length)error='Pilih setidaknya satu kabupaten pilot. Tidak ada wilayah yang dipilih otomatis.';
 else if(!Number.isFinite(area)||area<=0)error='Masukkan luas target yang lebih besar dari nol.';
 if(error){$('#formError').textContent=error;$('#formError').hidden=false;return;}
 applied={kbli:'01273',regions:chosen,area,road:data.get('road')};$('#formError').hidden=true;
 $('#targetSummary').textContent=`Target ${numberFormat.format(area)} m² / kandidat`;
 $('#formStatus').textContent='Kriteria diterapkan. 0 kandidat dievaluasi; analisis tidak dijalankan.';renderAudit();
});
$('#resetButton').addEventListener('click',()=>{$('#criteriaForm').reset();$('#criteriaForm').requestSubmit();});
function configuration(){return {schemaVersion:1,artifactType:'search-configuration',status:'mockup-perencanaan-bukan-hasil-rekomendasi',kbli:{code:applied.kbli,version:'2025',scope:'budidaya-kakao',scopeConfirmed:false},regions:applied.regions.map(id=>({id,name:regions[id]})),targetAreaM2:applied.area,areaTolerance:null,road:{role:'preference',enabled:applied.road==='preferred',maximumDistanceM:null,method:null,weight:null},assessments:{zoning:'belum-dinilai',agronomy:'belum-dinilai'},evaluatedCandidateCount:0,containsGeometry:false,limitations:['Konfigurasi saja, bukan GeoJSON atau hasil analisis.','Tidak siap untuk unggah OSS.','Geometri, aturan per bidang dan rubrik belum divalidasi.']};}
function previewExport(){$('#jsonPreview').textContent=JSON.stringify(configuration(),null,2);$('#downloadStatus').textContent='';showDialog('exportDialog');}
for(const id of ['exportTop','exportConfig'])$('#'+id).addEventListener('click',previewExport);
$('#downloadConfig').addEventListener('click',()=>{const blob=new Blob([JSON.stringify(configuration(),null,2)+'\n'],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='siap-izin-konfigurasi-pencarian.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);$('#downloadStatus').textContent='Unduhan konfigurasi diminta ke browser. Berkas tidak memuat polygon.';});
async function loadAudit(){
 try {
  const response=await fetch('audit-summary.json');if(!response.ok)throw new Error('unavailable');
  const data=await response.json();if(data.schemaVersion!==1||!Array.isArray(data.plans))throw new Error('schema');
  const known=new Set(plans.map(p=>p.id));const validated=new Map();
  for(const item of data.plans){if(!known.has(item.id)||typeof item.summary!=='string'||!item.summary.trim()||item.summary.length>4000||validated.has(item.id))throw new Error('invalid');
   if(item.unknowns!==undefined&&(!Array.isArray(item.unknowns)||item.unknowns.some(s=>typeof s!=='string'||s.length>1000)))throw new Error('invalid');
   validated.set(item.id,{summary:item.summary,reviewStatus:typeof item.reviewStatus==='string'?item.reviewStatus.slice(0,300):null,unknowns:item.unknowns||[]});
  }
  audit=validated;checkedAt=typeof data.checkedAt==='string'?data.checkedAt.slice(0,100):null;
  $('#auditSummaryStatus').textContent=audit.size?`Ringkasan audit turunan tersedia untuk ${audit.size} dari 8 entri. Tidak mengaktifkan penilaian kandidat.`:'Belum ada ringkasan audit turunan. Yang tampil hanya metadata dari dokumen discovery.';
 }catch{audit=new Map();$('#auditSummaryStatus').textContent='Ringkasan audit lokal tidak tersedia atau formatnya tidak valid. Metadata discovery tetap ditampilkan; tidak ada penilaian baru.';}
}
function resource(tag,url,integrity){return new Promise((resolve,reject)=>{const el=document.createElement(tag);if(tag==='link'){el.rel='stylesheet';el.href=url;}else el.src=url;el.integrity=integrity;el.crossOrigin='anonymous';const timer=setTimeout(()=>{el.remove();reject(new Error('timeout'));},12000);el.onload=()=>{clearTimeout(timer);resolve();};el.onerror=()=>{clearTimeout(timer);el.remove();reject(new Error('resource'));};document.head.append(el);});}
function mapProblem(message){$('#mapAlert').hidden=false;$('#mapAlert').textContent=message;$('#mapStatus').textContent='Peta gagal atau hanya sebagian tersedia · bukan hasil analisis';}
$('#loadMap').addEventListener('click',async()=>{
 const button=$('#loadMap');button.disabled=true;button.textContent='Memuat peta…';$('#mapAlert').hidden=true;$('#mapStatus').textContent='Memuat dependensi peta publik…';
 try{
  await resource('link','https://unpkg.com/leaflet@1.9.4/dist/leaflet.css','sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=');
  if(!window.L)await resource('script','https://unpkg.com/leaflet@1.9.4/dist/leaflet.js','sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=');
  $('#mapGate').hidden=true;$('#mapKey').hidden=false;
  // Koordinat ini hanya pusat viewport regional, bukan titik kandidat atau batas wilayah.
  map=window.L.map('map',{scrollWheelZoom:false}).setView([-4.05,122.1],7);
  const layer=window.L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a>',keepBuffer:0});
  let loaded=0,errors=0;let waitTimer;
  layer.on('loading',()=>{loaded=0;errors=0;$('#mapStatus').textContent='Memuat tile untuk area tampilan…';clearTimeout(waitTimer);waitTimer=setTimeout(()=>mapProblem('Peta belum selesai dimuat. Jaringan mungkin tidak tersedia. Anda tetap dapat memakai kriteria, bukti dan ekspor konfigurasi.'),15000);});
  layer.on('tileload',()=>{loaded++;});layer.on('tileerror',()=>{errors++;mapProblem('Sebagian atau semua tile peta gagal dimuat. Tidak ada peta hasil pengganti. Bukti dan konfigurasi tetap dapat digunakan.');});
  layer.on('load',()=>{clearTimeout(waitTimer);if(loaded&&!errors){$('#mapAlert').hidden=true;$('#mapStatus').textContent='Peta dasar publik dimuat · tidak ada overlay penilaian';}else mapProblem('Tile peta tidak tersedia lengkap. Tampilan bukan hasil evaluasi lokasi. Coba kembali saat jaringan pulih.');});
  layer.addTo(map);$('#resetMap').disabled=false;map.invalidateSize();
 }catch{mapProblem('Peta publik gagal dimuat. Periksa jaringan atau gunakan kriteria dan panel bukti tanpa peta. Tidak ada peta/kandidat pengganti.');button.disabled=false;button.textContent='Coba muat peta lagi';}
});
$('#resetMap').addEventListener('click',()=>{if(map)map.setView([-4.05,122.1],7);});
renderAudit();loadAudit();
