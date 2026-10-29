'use strict';
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MapStyle=api;})(globalThis,()=>{
 function levelForZoom(zoom){if(!Number.isFinite(zoom))throw new Error('Zoom tidak valid.');return zoom<=9?'overview':zoom<=13?'regional':'detail';}
 function styleForZoom(zoom,{selected=false,hovered=false}={}){
  const level=levelForZoom(zoom),base={color:'#286aa6',fillColor:'#4b8cce',fill:true,dashArray:null,lineCap:'round',lineJoin:'round',stroke:level!=='overview',weight:level==='overview'?0:level==='regional'?.8:1,opacity:.6,fillOpacity:level==='overview'?.22:level==='regional'?.16:.10};
  if(selected)return {...base,stroke:true,weight:2.2,opacity:1,fillOpacity:.34};
  if(hovered)return {...base,stroke:true,weight:1.5,opacity:.9,fillOpacity:.28};
  return base;
 }
 return {levelForZoom,styleForZoom};
});
