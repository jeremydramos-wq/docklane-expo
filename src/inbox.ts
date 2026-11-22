
export type InboxFilter='all'|'unread'|'read';
export type InboxItem={id:string;kind:string;title:string;body:string;link:{view?:string;ref?:string};created_at:string;read:boolean};
export type InboxPage={unread:number;items:InboxItem[]};
export type DriverDestination =
  | { view: 'documents' }
  | { view: 'jobs'; assignment?: string; notice?: string };

export function notificationDestination(item: Pick<InboxItem, 'link' | 'kind'>): DriverDestination {
  const { view, ref } = item.link;
  if (['fleet_document', 'document', 'documents', 'driver_documents'].includes(view ?? '') ||
      /^(expiry|renewal)(_|$)/.test(item.kind)) return { view: 'documents' };

  if (['driver_jobs', 'assignment', 'booking'].includes(view ?? '') && ref) {
    return { view: 'jobs', assignment: ref };
  }
  if (item.kind.endsWith('_timed_out')) return { view: 'jobs', notice: 'The acceptance window for this award has closed.' };
  if (/_(released|cancelled|expired)$/.test(item.kind)) return { view: 'jobs', notice: 'This award is no longer available to accept.' };
  return { view: 'jobs', notice: 'This update has no link to a current driver assignment.' };
}

// These links carry an assignment reference only. The signed-in driver feed supplies the job.
export function driverDestinationFromUrl(value: string | null | undefined): DriverDestination | null {
  if (!value) return null;
  let link: URL;
  try { link = new URL(value); } catch { return null; }
  if (link.protocol !== 'docklane:' || link.hostname !== 'driver' || link.username || link.password || link.port) return null;
  if (/^\/documents\/?$/.test(link.pathname)) return { view: 'documents' };
  const match = /^\/jobs\/([a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12})\/?$/i.exec(link.pathname);
  return match ? { view: 'jobs', assignment: match[1].toLowerCase() } : null;
}
export type ExpiryItem={doc_id:string;owner_name:string;org_name:string;name:string;expires_on:string|null;state:string;required:boolean};
const obj=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
const str=(v:unknown)=>typeof v==='string'?v:'';
export function normaliseInbox(value:unknown):InboxPage{
  const root=obj(value);if(!Array.isArray(root.items))throw new Error('Notifications could not be loaded.');
  return{unread:Number(root.unread)||0,items:root.items.map(raw=>{const x=obj(raw),link=obj(x.link);
    if(!str(x.id)||!Number.isFinite(Date.parse(str(x.created_at))))throw new Error('A notification is missing required details.');
    return{id:str(x.id),kind:str(x.kind),title:str(x.title),body:str(x.body),link:{view:str(link.view),ref:str(link.ref)},created_at:str(x.created_at),read:x.read===true};
  })};
}
export function mergeInbox(existing:InboxItem[],next:InboxItem[]):InboxItem[]{
  const byId=new Map(existing.map(x=>[x.id,x]));for(const x of next)byId.set(x.id,x);
  return [...byId.values()].sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at));
}
export const expiryLabel=(state:string)=>({nearing:'Nearing expiry',expired:'Expired',renewal_pending:'Renewal in review',rejected:'Renewal rejected',changes_requested:'Changes requested'}[state]??state.replaceAll('_',' '));
