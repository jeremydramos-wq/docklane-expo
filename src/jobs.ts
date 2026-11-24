
export type AcceptanceState = 'awaiting_acceptance' | 'awaiting_driver' | 'accepted' | 'accepted_on_behalf' | 'timed_out' | 'released' | 'expired';
export type DriverJob = {
  id: string; pickup_area: string; delivery_area: string; pickup_address: string | null; delivery_address: string | null;
  pickup_from: string; pickup_until: string; deliver_by: string; equipment: string; pallets: number; weight_kg: number;
  acknowledged_at: string | null; accept_by: string | null; on_behalf: boolean; acceptance_state: AcceptanceState;
  haulier_name: string | null; source: 'marketplace' | 'operator' | 'legacy';
};
export type Snapshot = { server_now: string; items: DriverJob[] };

// A notification starts a new read even while an older poll is in flight. Only the
// latest read may deliver jobs or resolve the requested assignment. A failed read
// leaves the target available for Retry.
export function createJobLoader(read: () => Promise<Snapshot>) {
  let sequence = 0;
  let loading = false;
  let target: string | null = null;
  return {
    cancelTarget() { target = null; },
    stop() { sequence++; loading = false; target = null; },
    async refresh(assignment?: string) {
      if (assignment) target = assignment;
      else if (loading) return;
      const request = ++sequence;
      const sent = Date.now();
      loading = true;
      try {
        const snapshot = await read();
        if (request !== sequence) return;
        const requested = target;
        target = null;
        return { snapshot, requested, sent, received: Date.now() };
      } catch (error) {
        if (request === sequence) throw error;
      } finally {
        if (request === sequence) loading = false;
      }
    },
  };
}

export function resolveJobTarget(items: DriverJob[], requested: string) {
  if (items.some(job => job.id === requested)) return { selected: requested, notice: '' };
  return { selected: null, notice: 'This assignment is no longer on your jobs list. It may have expired or been reassigned.' };
}
const states = new Set<AcceptanceState>(['awaiting_acceptance','awaiting_driver','accepted','accepted_on_behalf','timed_out','released','expired']);
const record = (v: unknown): Record<string, unknown> => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {};
const str = (v: unknown) => typeof v === 'string' ? v : '';
const nullable = (v: unknown) => typeof v === 'string' && v ? v : null;
const instant = (v: unknown) => typeof v === 'string' && Number.isFinite(Date.parse(v));
export function normaliseJobs(value: unknown, legacy = false): Snapshot {
  const root = record(value);
  const items = legacy ? value : root.items;
  if (!Array.isArray(items) || (!legacy && !instant(root.server_now))) throw new Error('The driver jobs response could not be read. Refresh and try again.');
  return { server_now: legacy ? new Date().toISOString() : str(root.server_now), items: items.map(item => {
    const v=record(item);
    if (!str(v.id) || !instant(v.pickup_from) || !instant(v.pickup_until) || !instant(v.deliver_by)) throw new Error('A job is missing its required schedule. Contact Operations.');
    const ack=nullable(v.acknowledged_at);
    const state=legacy ? ack ? 'accepted' : 'awaiting_driver' : str(v.acceptance_state) as AcceptanceState;
    if (!states.has(state)) throw new Error('This job uses an unsupported acceptance state. Refresh the app.');
    return {
      id:str(v.id), pickup_area:str(v.pickup_area),delivery_area:str(v.delivery_area),
      pickup_address:nullable(v.pickup_address),delivery_address:nullable(v.delivery_address),
      pickup_from:str(v.pickup_from),pickup_until:str(v.pickup_until),deliver_by:str(v.deliver_by),equipment:str(v.equipment),
      pallets:Number(v.pallets)||0,weight_kg:Number(v.weight_kg)||0,acknowledged_at:ack,
      accept_by:instant(v.accept_by)?str(v.accept_by):null,on_behalf:v.on_behalf===true,acceptance_state:state,
      haulier_name:nullable(v.haulier_name),source:legacy?'legacy':v.source==='operator'?'operator':'marketplace',
    };
  }) };
}
export function remainingMs(deadline: string | null, now: number, offset=0): number {
  if (!deadline) return 0;
  const result=Date.parse(deadline)-(now+offset);
  return Number.isFinite(result)?Math.max(0,result):0;
}
export function mmss(ms: number): string {
  const seconds=Math.ceil(Math.max(0,ms)/1000);
  return String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');
}
export function canAccept(job: DriverJob, now: number, offset=0): boolean {
  if (job.acknowledged_at || !['awaiting_acceptance','awaiting_driver'].includes(job.acceptance_state)) return false;
  if (job.acceptance_state==='awaiting_acceptance' && (!job.accept_by || remainingMs(job.accept_by,now,offset)===0)) return false;
  return job.source!=='marketplace' || Date.parse(job.pickup_from)>now+offset;
}
export const acceptanceText=(job:DriverJob) => job.on_behalf || job.acceptance_state==='accepted_on_behalf' ? 'Accepted by your haulier'
  : job.acknowledged_at ? 'Accepted' : job.acceptance_state==='timed_out' ? 'Acceptance window closed'
  : job.acceptance_state==='expired' ? 'Collection time has passed' : job.acceptance_state==='released' ? 'Award released' : job.acceptance_state==='awaiting_acceptance' ? 'Awaiting your acceptance' : 'Awaiting acknowledgement';
export const orderJobs=(items:DriverJob[])=>[...items].sort((a,b)=>{
  const x=a.acceptance_state==='awaiting_acceptance'?0:1,y=b.acceptance_state==='awaiting_acceptance'?0:1;
  return x-y || Date.parse(x===0?a.accept_by??a.pickup_from:a.pickup_from)-Date.parse(y===0?b.accept_by??b.pickup_from:b.pickup_from);
});
export function clockOffset(serverNow:string,sent:number,received:number):number {
  return Date.parse(serverNow)-(sent+received)/2;
}
export const irishTime=(value:string)=>new Intl.DateTimeFormat('en-IE',{timeZone:'Europe/Dublin',dateStyle:'medium',timeStyle:'short'}).format(new Date(value));
export const directionsUrl=(address:string)=>'https://www.google.com/maps/dir/?api=1&destination='+encodeURIComponent(address);

/** The overview follows the collection schedule. The separate jobs list still prioritises awards needing a response. */
export function nextCollection(jobs: readonly DriverJob[], serverNow: number): DriverJob | undefined {
  let next: DriverJob | undefined;
  let earliest = Number.POSITIVE_INFINITY;
  for (const job of jobs) {
    const confirmed = job.acceptance_state === 'accepted' || job.acceptance_state === 'accepted_on_behalf';
    if (!confirmed || Date.parse(job.pickup_until) <= serverNow) continue;
    const starts = Date.parse(job.pickup_from);
    if (starts < earliest || (starts === earliest && next && job.id < next.id)) {
      next = job;
      earliest = starts;
    }
  }
  return next;
}
