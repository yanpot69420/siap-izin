'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {spawnSync}=require('node:child_process');
const vm=require('node:vm');
const original=path.join(__dirname,'rdtr-local-browser.mjs');
function fixture(t){
 const scratch=process.env.TMPDIR||path.join(os.homedir(),'.hermes/cache/scratch');
 const temp=fs.mkdtempSync(path.join(scratch,'rdtr-output-guard-'));
 t.after(()=>fs.rmSync(temp,{recursive:true,force:true}));
 const repo=path.join(temp,'renamed-checkout');fs.mkdirSync(path.join(repo,'tests'),{recursive:true});
 const harness=path.join(repo,'tests/rdtr-local-browser.mjs');fs.copyFileSync(original,harness);
 return {temp,repo,harness};
}
function run(f,output){
 return spawnSync(process.execPath,[f.harness],{encoding:'utf8',timeout:10000,
  env:{...process.env,SIAP_IZIN_URL:'http://127.0.0.1:8769/prototype/',SIAP_IZIN_TEST_OUTPUT:output,SIAP_IZIN_SOURCE_DIR:path.join(f.temp,'missing-source')}});
}
test('local browser refuses output at relocated repository root or descendants before capture',t=>{
 const f=fixture(t);
 for(const output of [f.repo,path.join(f.repo,'evidence'),path.join(f.repo,'tests','..')]){
  const r=run(f,output);assert.notEqual(r.status,0);assert.match(r.stderr,/Output harus privat di luar repo/);
 }
 assert.equal(fs.existsSync(path.join(f.repo,'evidence')),false,'Reject repository descendants before creating output');
});
test('local browser refuses an outside symlink resolving into the repository',t=>{
 const f=fixture(t),alias=path.join(f.temp,'outside-alias');fs.symlinkSync(f.repo,alias,'dir');
 const r=run(f,alias);assert.notEqual(r.status,0);assert.match(r.stderr,/Output harus privat di luar repo/);
});
test('local browser rejects a symlink ancestor before creating repository descendants',t=>{
 const f=fixture(t),alias=path.join(f.temp,'outside-alias');fs.symlinkSync(f.repo,alias,'dir');
 const output=path.join(alias,'new-evidence','nested'),r=run(f,output);
 assert.notEqual(r.status,0);assert.match(r.stderr,/Output harus privat di luar repo/);
 assert.equal(fs.existsSync(path.join(f.repo,'new-evidence')),false,'Validation must precede mkdir through a symlink ancestor');
});
test('local browser permits an outside private output and proceeds to explicit source validation',t=>{
 const f=fixture(t),output=path.join(f.temp,'private-evidence');const r=run(f,output);
 assert.notEqual(r.status,0);assert.doesNotMatch(r.stderr,/Output harus privat di luar repo/);
 assert.match(r.stderr,/ENOENT/);assert.equal(fs.existsSync(output),true);
});
function nativeApplyFixture(deliverClick){
 const source=fs.readFileSync(original,'utf8'),start=source.indexOf('async function applyCriteriaNative(){'),end=source.indexOf('\ntry{',start);
 assert(start>=0&&end>start);
 const context=vm.createContext({loadRevision:5,document:{querySelector:()=>({textContent:'Kriteria diterapkan',scrollIntoView(){},getBoundingClientRect:()=>({left:0,top:0,width:40,height:20})})},delay:async()=>{}});
 context.evaluate=async expression=>vm.runInContext(expression,context);
 context.send=async(method,params)=>{if(deliverClick&&params.type==='mouseReleased')context.loadRevision++;};
 context.waitFor=async expression=>{if(!vm.runInContext(expression,context))throw new Error('native_apply_not_observed');};
 vm.runInContext(source.slice(start,end),context);return context;
}
test('native apply proof rejects ignored clicks despite stale applied/loaded state',async()=>{
 const context=nativeApplyFixture(false);await assert.rejects(context.applyCriteriaNative(),/native_apply_not_observed/);
});
test('native apply proof accepts a delivered click starting a new generation',async()=>{
 const context=nativeApplyFixture(true);await context.applyCriteriaNative();assert.equal(context.loadRevision,6);
});
test('browser oracle explicitly selects all sixteen imported sources without inventing IDs or paths',()=>{
 const source=fs.readFileSync(original,'utf8'),start=source.indexOf('function selectSourceFiles('),end=source.indexOf('\nconst selected=',start);
 assert(start>=0&&end>start,'Explicit source selection helper required');
 const context=vm.createContext({assert});vm.runInContext(source.slice(start,end),context);
 const checks=require('../tools/rdtr-plans.json').plans.filter(p=>p.activity!==null).map(p=>({planId:p.id}));
 assert.equal(checks.length,16);
 const value=JSON.parse(JSON.stringify(context.selectSourceFiles(checks,'all-imported')));
 assert.equal(Object.keys(value).length,16);assert.equal(value['7411000000:001'],'tirawuta-01273.json');assert.equal(value['7401000000:001'],'7401000000-001-01273.json');
 assert.equal(Object.keys(context.selectSourceFiles(checks,'two')).length,2);
 assert.throws(()=>context.selectSourceFiles(checks,'world'));
 assert.throws(()=>context.selectSourceFiles([...checks.slice(1),checks[1]],'all-imported'));
 assert.throws(()=>context.selectSourceFiles([{planId:'../../private'}],'all-imported'));
});
test('browser resource measurements use actual CDP values and keep unsupported metrics unknown',async()=>{
 const source=fs.readFileSync(original,'utf8'),start=source.indexOf('async function resourceSnapshot('),end=source.indexOf('\ntry{',start);
 assert(start>=0&&end>start,'Resource measurement helper required');
 const methods=[],context=vm.createContext({send:async method=>{methods.push(method);return {metrics:[{name:'JSHeapUsedSize',value:123456},{name:'Nodes',value:42}]};}});
 vm.runInContext(source.slice(start,end),context);
 const sample=await context.resourceSnapshot('fixture');assert.equal(sample.jsHeapBytes,123456);assert.equal(sample.domNodes,42);assert.equal(sample.layoutCount,null);assert.deepEqual(methods,['Performance.getMetrics']);
});
