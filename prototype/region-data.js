(function(root,factory){
  const catalog=factory();
  if(typeof module==='object'&&module.exports)module.exports=catalog;
  else root.RegionData=catalog;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  // Daftar administratif lengkap; ID GISTARU hanya untuk 11 entri yang benar-benar dikembalikan sumber.
  // local:sultra:* adalah kunci aplikasi, bukan kode wilayah resmi atau bukti ketiadaan RDTR.
  const rows=[
    ['7406000000','Kabupaten Bombana','kabupaten'],
    ['7404000000','Kabupaten Buton','kabupaten'],
    ['local:sultra:buton-selatan','Kabupaten Buton Selatan','kabupaten'],
    ['7414000000','Kabupaten Buton Tengah','kabupaten'],
    ['local:sultra:buton-utara','Kabupaten Buton Utara','kabupaten'],
    ['7401000000','Kabupaten Kolaka','kabupaten'],
    ['7411000000','Kabupaten Kolaka Timur','kabupaten'],
    ['local:sultra:kolaka-utara','Kabupaten Kolaka Utara','kabupaten'],
    ['7402000000','Kabupaten Konawe','kabupaten'],
    ['7412000000','Kabupaten Konawe Kepulauan','kabupaten'],
    ['7405000000','Kabupaten Konawe Selatan','kabupaten'],
    ['7409000000','Kabupaten Konawe Utara','kabupaten'],
    ['local:sultra:muna','Kabupaten Muna','kabupaten'],
    ['local:sultra:muna-barat','Kabupaten Muna Barat','kabupaten'],
    ['7407000000','Kabupaten Wakatobi','kabupaten'],
    ['local:sultra:baubau','Kota Baubau','kota'],
    ['7471000000','Kota Kendari','kota']
  ];
  const entries=Object.freeze(rows.map(([id,name,type])=>Object.freeze({id,name,type,gistaruId:id.startsWith('local:')?null:id,idNamespace:id.startsWith('local:')?'internal':'gistaru'})));
  return Object.freeze({entries});
});
