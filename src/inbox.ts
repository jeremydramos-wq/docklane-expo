
export type InboxFilter='all'|'unread'|'read';
export type InboxItem={id:string;kind:string;title:string;body:string;link:{view?:string;ref?:string};created_at:string;read:boolean};
export type InboxPage={unread:number;items:InboxItem[]};
export type ExpiryItem={doc_id:string;owner_name:string;org_name:string;name:string;expires_on:string|null;state:string;required:boolean};
const obj=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
const str=(v:unknown)=>typeof v==='string'?v:'';
export function normaliseInbox(value:unknown):InboxPage{
  const root=obj(value);if(!Array.isArray(root.items))throw new Error('The inbox response could not be read.');
  return{unread:Number(root.unread)||0,items:root.items.map(raw=>{const x=obj(raw),link=obj(x.link);
    if(!str(x.id)||!Number.isFinite(Date.parse(str(x.created_at))))throw new Error('An inbox item is missing required details.');
    return{id:str(x.id),kind:str(x.kind),title:str(x.title),body:str(x.body),link:{view:str(link.view),ref:str(link.ref)},created_at:str(x.created_at),read:x.read===true};
  })};
}
export function mergeInbox(existing:InboxItem[],next:InboxItem[]):InboxItem[]{
  const byId=new Map(existing.map(x=>[x.id,x]));for(const x of next)byId.set(x.id,x);
  return [...byId.values()].sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at));
}
export const expiryLabel=(state:string)=>({nearing:'Nearing expiry',expired:'Expired',renewal_pending:'Renewal in review',rejected:'Renewal rejected',changes_requested:'Changes requested'}[state]??state.replaceAll('_',' '));
