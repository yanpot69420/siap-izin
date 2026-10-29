'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
// Identity/pixel-only synthetic harness fixture, never served as map data.
test('Canvas pointer oracle resolves the hit at integer client coordinates, not the pre-rounded layer grid',async()=>{
 const source=fs.readFileSync(path.join(__dirname,'display-browser.mjs'),'utf8');
 const start=source.indexOf('async function pointerInterior()'),end=source.indexOf('async function failClosedDetail',start);
 assert.ok(start>=0&&end>start);
 class Canvas{};const renderer=new Canvas();renderer._container={};
 const polygon=[{x:0,y:0},{x:100,y:0},{x:100,y:100},{x:0,y:100}];
 const b={options:{interactive:true},_renderer:renderer,_pxBounds:{min:{x:0,y:0},max:{x:100,y:100}},_parts:[polygon],_containsPoint:()=>true};
 const a={...b,_containsPoint:p=>p.x>4.1};
 const first={layer:b,prev:null},last={layer:a,prev:first};renderer._drawLast=last;
 const element={scrollIntoView(){},getBoundingClientRect:()=>({left:0,top:0,right:100,bottom:100})};
 const context=vm.createContext({document:{querySelector:()=>element,elementFromPoint:()=>renderer._container},innerWidth:100,innerHeight:100,featureLayers:new Map([['B',b],['A',a]]),SVGPathElement:class{},L:{Canvas,point:(x,y)=>({x,y})},map:{layerPointToContainerPoint:p=>p,mouseEventToLayerPoint:e=>({x:e.clientX,y:e.clientY})},delay:async()=>{}});
 context.evaluate=expression=>vm.runInContext(expression,context);
 vm.runInContext(source.slice(start,end),context);
 const point=await vm.runInContext('pointerInterior()',context);
 assert.equal(point.key,'B','The actual click at client x=4 hits B, although unrounded grid x=4.166 hits A');
 assert.ok(Number.isInteger(point.x)&&Number.isInteger(point.y),'Use exactly the coordinates resolved by the click oracle');
});
