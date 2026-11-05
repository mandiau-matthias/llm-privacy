import {test} from 'node:test';
import assert from 'node:assert/strict';
import {sendWithPrivacy} from '../dist/send.js';
const names=[{kind:'person',value:'Mira Vale'},{kind:'company',value:'Canal Works'}];
test('sender receives one sanitized string and no reversible maps',async()=>{
  let seen;
  const result=await sendWithPrivacy({text:'Mira Vale paid €120 to Canal Works.',names},async(...args)=>{seen=args;return 'ok';});
  assert.deepEqual(result,{blocked:false,response:'ok'});
  assert.equal(seen.length,1);assert.equal(typeof seen[0],'string');
  for(const original of ['Mira','120','Canal'])assert.ok(!seen[0].includes(original));
});
test('a blocked payload never reaches the sender or return value',async()=>{
  let calls=0;
  const result=await sendWithPrivacy({text:'Mira Vale reference 123456',names},async()=>{calls++;});
  assert.equal(calls,0);assert.deepEqual(result,{blocked:true,reason:'residual_patterns'});
  assert.ok(!JSON.stringify(result).includes('123456'));
});
test('a failed sender is not retried with original text',async()=>{
  let calls=0;const failure=new Error('provider unavailable');
  await assert.rejects(sendWithPrivacy({text:'Mira Vale paid €120.',names},async()=>{calls++;throw failure;}),failure);
  assert.equal(calls,1);
});
