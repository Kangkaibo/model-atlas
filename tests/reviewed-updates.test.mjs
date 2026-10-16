import {test} from 'node:test';
import assert from 'node:assert/strict';
import {applyReviewedUpdates} from '../data/reviewed-updates.mjs';
const fixture=()=>({models:[{repo:'Qwen/example',checked:'2026-10-15',fields:{total:{value:null,status:'not_found',checked:'2026-10-15',sources:['old'],locator:'README'},shared:{value:null,status:'not_found',checked:'2026-10-15',sources:['old'],locator:'config'}}}],sources:{old:{url:'https://huggingface.co/Qwen/example',checked:'2026-10-15'}}});
test('Reviewing one field retains the old dates and unknown values of other fields',()=>{
 const {models,sources}=fixture();const snapshot=applyReviewedUpdates(models,sources,[{repo:'Qwen/example',checked:'2026-10-16',fields:{total:{value:7,status:'verified',locator:'Model overview',sources:[{url:'https://huggingface.co/Qwen/example',title:'Author card',vendor:'Qwen'}]}}}]);
 assert.equal(snapshot,'2026-10-16');assert.equal(models[0].fields.total.checked,'2026-10-16');assert.equal(models[0].fields.shared.checked,'2026-10-15');assert.equal(models[0].fields.shared.value,null);assert.equal(sources.old.checked,'2026-10-15');assert.notEqual(models[0].fields.total.sources[0],'old');
});
test('A source observation without field evidence cannot fabricate a numeric fact',()=>{
 const {models,sources}=fixture();assert.throws(()=>applyReviewedUpdates(models,sources,[{repo:'Qwen/example',checked:'2026-10-16',fields:{active:{value:1,status:'derived',locator:'expert ratio',sources:['old']}}}]),/scope and premises/);
});
