
import {test} from 'node:test';import assert from 'node:assert/strict';
import {canAccept,remainingMs,mmss,clockOffset,normaliseJobs,orderJobs,directionsUrl} from '../src/jobs.ts';
const t=Date.parse('2026-11-20T12:00:00Z');
const job={id:'a',pickup_area:'Dublin',delivery_area:'Cork',pickup_from:'2026-11-21T08:00:00Z',pickup_until:'2026-11-21T09:00:00Z',deliver_by:'2026-11-21T12:00:00Z',acknowledged_at:null,accept_by:'2026-11-20T12:10:00Z',acceptance_state:'awaiting_acceptance',source:'marketplace'};
test('server-owned deadline survives refresh and closes at exact boundary',()=>{assert.equal(mmss(remainingMs(job.accept_by,t)),'10:00');assert.equal(mmss(remainingMs(job.accept_by,t+599999)),'00:01');assert.equal(canAccept(job,t+600000),false);assert.equal(canAccept(job,t+599999),true);});
test('server clock offset compensates for a wrong device clock',()=>{const offset=clockOffset('2026-11-20T12:00:00Z',t+120000,t+120000);assert.equal(mmss(remainingMs(job.accept_by,t+120000,offset)),'10:00');});
test('accepted-on-behalf work never offers another acceptance',()=>{assert.equal(canAccept({...job,on_behalf:true,acknowledged_at:'2026-11-20T12:00:10Z',acceptance_state:'accepted_on_behalf'},t+600001),false);});
test('marketplace collection start closes acceptance even with timer left',()=>{assert.equal(canAccept({...job,pickup_from:'2026-11-20T12:01:00Z'},t+60000),false);});
test('operator acknowledgements do not invent a marketplace deadline',()=>{assert.equal(canAccept({...job,source:'operator',acceptance_state:'awaiting_driver',accept_by:null,pickup_from:'2026-11-19T08:00:00Z'},t),true);});
test('future jobs needing acceptance appear before accepted work today',()=>{assert.equal(orderJobs([{...job,id:'accepted',acknowledged_at:'x',acceptance_state:'accepted',pickup_from:'2026-11-20T13:00:00Z'},job])[0].id,'a');});
test('legacy fallback supplies no fabricated deadline',()=>{const s=normaliseJobs([{...job,accept_by:undefined}],true);assert.equal(s.items[0].accept_by,null);assert.equal(s.items[0].acceptance_state,'awaiting_driver');});
test('unsupported server states fail closed',()=>{assert.throws(()=>normaliseJobs({server_now:new Date(t).toISOString(),items:[{...job,acceptance_state:'something_new'}]}),/unsupported/);});
test('directions cannot inject extra URL parameters',()=>{assert.equal(new URL(directionsUrl('a&origin=private')).searchParams.get('destination'),'a&origin=private');});
