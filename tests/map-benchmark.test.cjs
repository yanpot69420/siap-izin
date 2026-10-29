'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
// Synthetic identity-only unit fixture; never used as benchmark/source geometry.
test('Fixed-overview retention accepts 16 loaded plans plus 2 explicitly unavailable catalog entries',()=>{
 const source=fs.readFileSync(path.join(__dirname,'display-performance-benchmark.mjs'),'utf8');
 const a=source.indexOf('const retentionFunction='),b=source.indexOf('const bannerFunction=',a);
 assert.ok(a>=0&&b>a);
 const extract=vm.createContext({});vm.runInContext(source.slice(a,b)+';globalThis.fn=retentionFunction;',extract);
 const plans=require('../tools/rdtr-plans.json').plans,ready=plans.filter(p=>p.activity),planRecords=new Map(),layerMapper=new Map(),featureLayers=new Map(),requests=[];
 ready.forEach((plan,index)=>{
  const count=index===0?5979:1,features=Array.from({length:count},(_,id)=>({id,properties:{plan_id:plan.id}}));
  const children=features.map(feature=>({feature}));
  features.forEach((f,i)=>featureLayers.set(plan.id+':'+f.id,children[i]));
  planRecords.set(plan.id,{status:'ready',data:{features,meta:{display:{level:'overview'}}}});
  layerMapper.set(plan.id,{getLayers:()=>children});requests.push({id:plan.id,features:count,featureIds:features.map(f=>String(f.id)).sort()});
 });
 for(const plan of plans.filter(p=>!p.activity))planRecords.set(plan.id,{status:'unavailable'});
 assert.equal(planRecords.size,18);assert.equal(featureLayers.size,5994);
 const context=vm.createContext({__bench:{requests},planRecords,layerMapper,featureLayers,map:{hasLayer:g=>[...layerMapper.values()].includes(g)}});
 vm.runInContext(extract.fn,context);
 assert.equal(vm.runInContext('retention().retentionVerified',context),true);
 planRecords.delete(ready[0].id);assert.equal(vm.runInContext('retention().retentionVerified',context),false,'Missing loaded inventory must still fail closed');
});
