
export interface NativeVault {
  getItemAsync(key:string):Promise<string|null>;
  setItemAsync(key:string,value:string):Promise<void>;
  deleteItemAsync(key:string):Promise<void>;
}
type Manifest={v:1;g:string;n:number};
const manifest=(raw:string|null):Manifest|null=>{
  try { const x=JSON.parse(raw??'null'); return x?.v===1 && /^[a-z0-9]+$/.test(x.g) && Number.isInteger(x.n) && x.n>0 && x.n<=128 ? x:null; } catch {return null;}
};
export function splitUtf8(value:string,limit=1800):string[] {
  const out:string[]=[];let chunk='',bytes=0;
  for(const c of value) {const p=c.codePointAt(0)!;const n=p<=127?1:p<=2047?2:p<=65535?3:4;
    if(bytes+n>limit && chunk){out.push(chunk);chunk='';bytes=0;}chunk+=c;bytes+=n;}
  if(chunk || !out.length)out.push(chunk);return out;
}
/** Encrypted native storage, with an atomic manifest and UTF-8-sized chunks for large auth sessions. */
export function createSecureStorage(vault:NativeVault) {
  let queue=Promise.resolve();let sequence=0;
  function locked<T>(work:()=>Promise<T>):Promise<T> {
    const result=queue.then(work,work);queue=result.then(()=>undefined,()=>undefined);return result;
  }
  const base=(key:string)=>'docklane.'+key.replace(/[^a-zA-Z0-9._-]/g,c=>'_'+c.charCodeAt(0).toString(16)+'_');
  const part=(key:string,m:Manifest,index:number)=>key+'.'+m.g+'.'+index;
  async function clean(key:string,m:Manifest|null){if(m)for(let i=0;i<m.n;i++)await vault.deleteItemAsync(part(key,m,i)).catch(()=>undefined);}
  return {
    getItem:(key:string)=>locked(async()=>{
      const k=base(key),m=manifest(await vault.getItemAsync(k+'.manifest'));if(!m)return null;
      const chunks:string[]=[];for(let i=0;i<m.n;i++){const value=await vault.getItemAsync(part(k,m,i));if(value===null)return null;chunks.push(value);}return chunks.join('');
    }),
    setItem:(key:string,value:string)=>locked(async()=>{
      const k=base(key),old=manifest(await vault.getItemAsync(k+'.manifest')),chunks=splitUtf8(value);
      if(chunks.length>128)throw new Error('The authentication session is too large to store securely.');
      const m:Manifest={v:1,g:Date.now().toString(36)+(sequence++).toString(36)+Math.random().toString(36).slice(2),n:chunks.length};
      try {for(let i=0;i<chunks.length;i++)await vault.setItemAsync(part(k,m,i),chunks[i]!);await vault.setItemAsync(k+'.manifest',JSON.stringify(m));}
      catch(e){await clean(k,m);throw e;}await clean(k,old);
    }),
    removeItem:(key:string)=>locked(async()=>{const k=base(key),old=manifest(await vault.getItemAsync(k+'.manifest'));await vault.deleteItemAsync(k+'.manifest');await clean(k,old);}),
  };
}
