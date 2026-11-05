import { sendWithPrivacy } from '../dist/send.js';

const names = [{kind:'person',value:'Mira Vale'},{kind:'company',value:'Canal Works'}];
let calls=0;
// A local fake sender makes the exact boundary inspectable. Replace this
// function with your provider call, keeping its argument as the only input.
async function sender(text){ calls++; console.log('Sender receives:',text); return {accepted:true}; }
for (const text of ['Mira Vale paid €120 to Canal Works.', 'Mira Vale paid €120 to Canal Works. Reference 123456.']) {
  const result=await sendWithPrivacy({text,names},sender);
  console.log(result.blocked ? 'Withheld: sender was not called.' : 'Sanitized text sent to the local example.');
}
console.log('Sender calls:',calls); // 1
