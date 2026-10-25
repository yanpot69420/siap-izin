'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const catalog = require('../prototype/region-data.js');

test('Katalog eksplorasi lengkap: 15 kabupaten dan 2 kota, identitas sumber tidak dikarang', () => {
  const expected = ['Kabupaten Bombana','Kabupaten Buton','Kabupaten Buton Selatan','Kabupaten Buton Tengah','Kabupaten Buton Utara','Kabupaten Kolaka','Kabupaten Kolaka Timur','Kabupaten Kolaka Utara','Kabupaten Konawe','Kabupaten Konawe Kepulauan','Kabupaten Konawe Selatan','Kabupaten Konawe Utara','Kabupaten Muna','Kabupaten Muna Barat','Kabupaten Wakatobi','Kota Baubau','Kota Kendari'];
  assert.deepEqual(catalog.entries.map(x => x.name), expected);
  assert.equal(new Set(catalog.entries.map(x => x.id)).size, 17);
  assert.equal(catalog.entries.filter(x => x.type === 'kabupaten').length, 15);
  assert.equal(catalog.entries.filter(x => x.type === 'kota').length, 2);
  assert.equal(catalog.entries.filter(x => x.gistaruId !== null).length, 11);
  for (const entry of catalog.entries) {
    assert.ok(Object.isFrozen(entry));
    if (entry.gistaruId === null) {
      assert.match(entry.id, /^local:sultra:[a-z-]+$/);
      assert.equal(entry.idNamespace, 'internal');
    } else {
      assert.match(entry.id, /^74\d{8}$/);
      assert.equal(entry.id, entry.gistaruId);
      assert.equal(entry.idNamespace, 'gistaru');
    }
  }
  assert.equal(catalog.entries.find(x => x.name === 'Kabupaten Kolaka Timur').id, '7411000000');
  assert.equal(catalog.entries.find(x => x.name === 'Kabupaten Kolaka').id, '7401000000');
  assert.equal(catalog.entries.find(x => x.name === 'Kabupaten Konawe').id, '7402000000');
  assert.equal(catalog.entries.find(x => x.name === 'Kabupaten Konawe Selatan').id, '7405000000');
  assert.ok(Object.isFrozen(catalog.entries));
});
