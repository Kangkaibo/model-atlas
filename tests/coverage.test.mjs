import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {coverageAudit} from '../data/coverage.mjs';

test('Coverage joins exact repositories without counting pending variants as reviewed models',()=>{
 const raw={inventories:[{publisher:'Author',complete:true,entries:[{repo:'Author/Main'},{repo:'Author/Main-FP8'},{repo:'Author/Main-MTP'}]}]};
 const models=[{id:'main',repo:'Author/Main',name:'Main',card:'s1'}];
 const index={entries:[{key:'main',repo:'author/main',modelId:'main',evidence:[{framework:'vLLM',level:'example',url:'https://docs.vllm.ai/en/latest/models/supported_models/'}]}]};
 const result=coverageAudit(raw,models,index,{s1:{url:'https://huggingface.co/Author/Main'}});
 assert.equal(result.entries.length,3);
 assert.equal(result.entries.filter(x=>x.modelId).length,1);
 assert.equal(result.entries.find(x=>x.repo==='Author/Main-FP8').queueType,'variant_hint');
 assert.equal(result.entries.find(x=>x.repo==='Author/Main-MTP').queueType,'draft_hint');
 assert.equal(result.entries.find(x=>x.modelId).frameworks.length,1);
});

test('Every publicly listed pending record retains discovery evidence and no parameter fields',()=>{
 const data=JSON.parse(readFileSync(new URL('../dist/data.json',import.meta.url),'utf8'));
 const ids=new Set(data.models.map(x=>x.id));
 assert(data.coverage.inventories.length>=33);
 assert(data.coverage.entries.length>2600);
 assert.equal(new Set(data.coverage.entries.map(x=>(x.repo||x.name).toLowerCase())).size,data.coverage.entries.length);
 for(const x of data.coverage.entries){assert(x.url.startsWith('https://'));assert(!x.fields);if(x.modelId)assert(ids.has(x.modelId));}
 for(const repo of ['internlm/Atria-Dawn-Preview','internlm/Intern-S2-397B'])assert(data.coverage.entries.find(x=>x.repo===repo)?.modelId);
 assert.equal(data.models.find(x=>x.repo==='LiquidAI/LFM2.5-24B-A2B').fields.active.value,2.45);
 assert.match(data.models.find(x=>x.repo==='internlm/Intern-S2-Mobius').fields.routed.scope,/全局/);
 assert.equal(data.models.find(x=>x.repo==='ibm-granite/granite-switch-4.1-30b').fields.arch.value,'Dense');
 assert.equal(data.models.find(x=>x.repo==='InternScience/Agents-A1').fields.active.scope,'官方发布型号35B-A3B的标称口径；未另列精确统计');
 const oldEvidence=data.frameworkIndex.entries.find(x=>x.name==='A.X-K1').evidence;
 assert(oldEvidence.every(e=>e.checked==='2026-10-15'));
});
