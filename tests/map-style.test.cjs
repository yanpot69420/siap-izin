'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const target=path.join(__dirname,'../prototype/map-style.js');
function api(){assert.ok(fs.existsSync(target),'Adaptive map style module missing');return require(target);}
test('Adaptive style reduces overview clutter and never communicates permission through green/red',()=>{
 const {styleForZoom,levelForZoom}=api();
 assert.equal(levelForZoom(7),'overview');assert.equal(levelForZoom(11),'regional');assert.equal(levelForZoom(16),'detail');
 const overview=styleForZoom(7),regional=styleForZoom(11),detail=styleForZoom(16);
 assert.equal(overview.stroke,false);assert.equal(overview.weight,0);
 assert.ok(overview.fillOpacity>=.20&&overview.fillOpacity<=.25,'overview fill stays legible without restoring internal outlines');
 assert.equal(regional.stroke,true);assert.ok(regional.weight<=1);assert.ok(detail.weight<=1.2);
 for(const style of [overview,regional,detail]){assert.equal(style.color,'#286aa6');assert.equal(style.fillColor,'#4b8cce');assert.equal(style.dashArray,null);}
 const hover=styleForZoom(7,{hovered:true}),selected=styleForZoom(7,{selected:true});
 assert.equal(hover.stroke,true);assert.ok(hover.fillOpacity>overview.fillOpacity);
 assert.equal(selected.stroke,true);assert.ok(selected.weight>hover.weight);assert.ok(selected.fillOpacity>=hover.fillOpacity);
 assert.deepEqual(styleForZoom(7),overview,'Transient state never mutates a reusable base style');
 assert.throws(()=>levelForZoom(NaN));assert.throws(()=>styleForZoom(Infinity));
});
