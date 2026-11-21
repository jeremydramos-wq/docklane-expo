
import {useCallback,useEffect,useRef,useState} from 'react';
import {ActivityIndicator,AppState,Pressable,RefreshControl,ScrollView,StyleSheet,Text,View} from 'react-native';
import {supabase} from './supabase';
import {irishTime} from './jobs';
import {expiryLabel,mergeInbox,normaliseInbox} from './inbox';
import type {ExpiryItem,InboxFilter,InboxItem} from './inbox';
import {colour,font} from './brand';
function useRefresh(run:()=>void){const ref=useRef(run);ref.current=run;useEffect(()=>{const listener=AppState.addEventListener('change',state=>{if(state==='active')ref.current();});const id=setInterval(()=>{if(AppState.currentState==='active')ref.current();},30000);return()=>{listener.remove();clearInterval(id);};},[]);}
const errorText=(e:unknown)=>e instanceof Error?e.message:'Refresh and try again.';
export function DriverInbox({open,changed}:{open:(item:InboxItem)=>void;changed:(count:number)=>void}){
  const[filter,setFilter]=useState<InboxFilter>('unread'),[items,setItems]=useState<InboxItem[]>([]),[busy,setBusy]=useState(false),[loaded,setLoaded]=useState(false),[error,setError]=useState(''),[more,setMore]=useState(false);
  const generation=useRef(0),mounted=useRef(true);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;generation.current++;};},[]);
  const load=useCallback(async(older=false)=>{
    const request=++generation.current;setBusy(true);
    try{const before=older?items.at(-1)?.created_at:null;
      const{data,error}=await supabase.rpc('docklane_inbox',{p_filter:filter,p_limit:50,p_before:before??null});if(error)throw error;
      const page=normaliseInbox(data);if(!mounted.current||request!==generation.current)return;
      setItems(current=>older?mergeInbox(current,page.items):page.items);setMore(page.items.length===50);changed(page.unread);setError('');setLoaded(true);
    }catch(e){if(mounted.current&&request===generation.current)setError(errorText(e));}
    finally{if(mounted.current&&request===generation.current)setBusy(false);}
  },[filter,items,changed]);
  const latest=useRef(load);latest.current=load;
  useEffect(()=>{setItems([]);setLoaded(false);void latest.current();},[filter]);
  useRefresh(()=>void latest.current());
  async function mark(item:InboxItem,read:boolean,go=false){setError('');
    const{error}=await supabase.rpc('docklane_inbox_mark',{p_ids:[item.id],p_read:read});
    if(error){setError(error.message);return;}if(go)open(item);else void latest.current();
  }
  async function allRead(){const{error}=await supabase.rpc('docklane_inbox_mark_all_read');if(error)setError(error.message);else void latest.current();}
  return <ScrollView contentContainerStyle={s.content} refreshControl={<RefreshControl refreshing={busy&&loaded} onRefresh={()=>void latest.current()} tintColor={colour.cobalt}/> }>
    <Text accessibilityRole="header" style={s.title}>Inbox</Text>
    <View style={s.row}>{(['unread','all','read'] as const).map(key=><Pressable key={key} accessibilityRole="tab" accessibilityState={{selected:filter===key}} onPress={()=>setFilter(key)} style={[s.small,filter===key&&s.selected]}><Text style={s.text}>{key[0].toUpperCase()+key.slice(1)}</Text></Pressable>)}</View>
    <Pressable accessibilityRole="button" onPress={()=>void allRead()} style={s.small}><Text style={s.accent}>Mark all read</Text></Pressable>
    {!!error&&<Text accessibilityRole="alert" style={s.error}>{error}</Text>}
    {!loaded&&busy&&<ActivityIndicator color={colour.cobalt}/>}
    {loaded&&!items.length&&<Text style={s.muted}>{filter==='unread'?'No unread updates.':'No updates yet.'}</Text>}
    {items.map(item=><View key={item.id} style={s.card}><Text style={s.heading}>{item.read?'':'● '}{item.title}</Text><Text style={s.text}>{item.body}</Text><Text style={s.muted}>{irishTime(item.created_at)}</Text>
      <View style={s.row}><Pressable accessibilityRole="button" onPress={()=>void mark(item,true,true)} style={s.small}><Text style={s.accent}>Open update</Text></Pressable>
        <Pressable accessibilityRole="button" onPress={()=>void mark(item,!item.read)} style={s.small}><Text style={s.text}>{item.read?'Mark unread':'Mark read'}</Text></Pressable></View></View>)}
    {more&&<Pressable accessibilityRole="button" disabled={busy} onPress={()=>void latest.current(true)} style={s.small}><Text style={s.accent}>Load earlier updates</Text></Pressable>}
  </ScrollView>;
}
export function DriverDocuments(){
  const[items,setItems]=useState<ExpiryItem[]>([]),[busy,setBusy]=useState(true),[error,setError]=useState('');const mounted=useRef(true);
  const load=useCallback(async()=>{setBusy(true);try{const{data,error}=await supabase.rpc('docklane_driver_expiries');if(error)throw error;
    if(!data||!Array.isArray(data.items))throw new Error('Document status could not be read.');
    if(mounted.current){setItems(data.items);setError('');}
  }catch(e){if(mounted.current)setError(errorText(e));}finally{if(mounted.current)setBusy(false);}},[]);
  useEffect(()=>{mounted.current=true;void load();return()=>{mounted.current=false;};},[load]);useRefresh(()=>void load());
  return <ScrollView contentContainerStyle={s.content} refreshControl={<RefreshControl refreshing={busy} onRefresh={()=>void load()} tintColor={colour.cobalt}/> }>
    <Text accessibilityRole="header" style={s.title}>Your documents</Text>
    <Text style={s.muted}>Ask your haulier to upload renewals. Nearing expiry starts three calendar months before the expiry date. A pending renewal is still awaiting review.</Text>
    {!!error&&<Text accessibilityRole="alert" style={s.error}>{error}</Text>}
    {!busy&&!error&&!items.length&&<Text style={s.text}>No document renewals need your attention.</Text>}
    {items.map(item=><View key={item.doc_id} style={s.card}><Text style={s.heading}>{item.name}</Text><Text style={item.state==='expired'||item.state==='rejected'?s.error:item.state==='nearing'||item.state==='changes_requested'?s.warning:s.accent}>{expiryLabel(item.state)}</Text><Text style={s.text}>{item.owner_name} · {item.org_name}</Text>
      {!!item.expires_on&&<Text style={s.muted}>Expires {new Intl.DateTimeFormat('en-IE',{timeZone:'Europe/Dublin',dateStyle:'medium'}).format(new Date(item.expires_on+'T12:00:00Z'))}</Text>}
      {!item.required&&<Text style={s.muted}>Optional · information only</Text>}</View>)}
  </ScrollView>;
}
const s=StyleSheet.create({
  content:{padding:20,gap:16,paddingBottom:32},title:{fontFamily:font.semibold,fontSize:30,color:colour.ink},
  card:{padding:20,borderRadius:12,backgroundColor:colour.white,borderColor:colour.line,borderWidth:1,gap:10},
  heading:{fontFamily:font.bold,fontSize:18,color:colour.ink},text:{fontFamily:font.regular,fontSize:15,lineHeight:24,color:colour.ink},
  muted:{fontFamily:font.regular,fontSize:13,lineHeight:21,color:colour.slate},accent:{fontFamily:font.semibold,color:colour.cobalt,fontSize:14,lineHeight:22},
  warning:{fontFamily:font.semibold,color:colour.warning,fontSize:14,lineHeight:22},error:{fontFamily:font.medium,color:colour.danger,fontSize:14,lineHeight:22},
  row:{flexDirection:'row',gap:10,flexWrap:'wrap'},small:{padding:12,minHeight:44,justifyContent:'center',borderRadius:6,borderWidth:1,borderColor:colour.line,backgroundColor:colour.cloud},selected:{borderColor:colour.cobalt,backgroundColor:colour.softBlue},
});
