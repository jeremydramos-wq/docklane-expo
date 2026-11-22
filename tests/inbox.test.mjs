
import {test} from 'node:test';import assert from 'node:assert/strict';import {mergeInbox,normaliseInbox,expiryLabel} from '../src/inbox.ts';
import {driverDestinationFromUrl, notificationDestination} from '../src/inbox.ts';
test('inbox updates merge without duplicates and preserve latest read state',()=>{const a={id:'a',created_at:'2026-11-20T12:00:00Z',read:false},b={id:'b',created_at:'2026-11-20T11:00:00Z',read:true};const result=mergeInbox([a],[{...a,read:true},b]);assert.equal(result.length,2);assert.equal(result[0].read,true);});
test('notification projection retains only intended link fields',()=>{const value=normaliseInbox({unread:1,items:[{id:'a',kind:'award',title:'New job',body:'Dublin to Cork',created_at:'2026-11-20T12:00:00Z',read:false,private_address:'Hidden',link:{view:'driver_jobs',ref:'job',url:'https://untrusted.invalid'}}]});assert.equal(value.items[0].private_address,undefined);assert.equal(value.items[0].link.url,undefined);});
test('expiry status distinguishes unapproved renewal from expiry warning',()=>{assert.equal(expiryLabel('renewal_pending'),'Renewal in review');assert.equal(expiryLabel('nearing'),'Nearing expiry');});

const assignment='1d72f9ee-351d-4f3b-93a6-572e082a2f73';
test('cold-start job links and award reminders select the same assignment',()=>{
  const expected={view:'jobs', assignment};
  assert.deepEqual(driverDestinationFromUrl('docklane://driver/jobs/'+assignment),expected);
  assert.deepEqual(notificationDestination({kind:'acceptance_reminder',link:{view:'driver_jobs',ref:assignment}}),expected);
});
test('both legacy expiry links and renewal links lead to driver documents',()=>{
  assert.deepEqual(notificationDestination({kind:'expiry_nearing',link:{view:'driver_jobs'}}),{view:'documents'});
  assert.deepEqual(notificationDestination({kind:'renewal_reminder',link:{view:'fleet_document',ref:'document-id'}}),{view:'documents'});
  assert.deepEqual(driverDestinationFromUrl('docklane://driver/documents'),{view:'documents'});
});
test('an old alert with no assignment reference explains a closed award',()=>{
  const destination=notificationDestination({kind:'driver_award_timed_out',link:{view:'driver_jobs'}});
  assert.equal(destination.assignment,undefined);
  assert.match(destination.notice,/closed/);
});
test('unrelated links never select an assignment',()=>{
  for(const url of [null,'','other://driver/jobs/'+assignment,'docklane://other/jobs/'+assignment,'docklane://driver/jobs/no-id']){
    assert.equal(driverDestinationFromUrl(url),null);
  }
  assert.equal(notificationDestination({kind:'case',link:{view:'reviews',ref:assignment}}).assignment,undefined);
});
