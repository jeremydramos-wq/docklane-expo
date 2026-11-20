
import 'react-native-url-polyfill/auto';
import { AppState, Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { createClient, processLock } from '@supabase/supabase-js';
import { createSecureStorage } from './secure-storage';
import { normaliseJobs } from './jobs';
const url=process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://dhrjegacsnrhyckhwikj.supabase.co';
const key=process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_p4Jyqa-KaM_z0sdfAH0DRA_QcQYoyIe';
const memory=new Map<string,string>();
const storage=Platform.OS==='web'?{getItem:async(k:string)=>memory.get(k)??null,setItem:async(k:string,v:string)=>{memory.set(k,v);},removeItem:async(k:string)=>{memory.delete(k);}}:createSecureStorage(SecureStore);
export const supabase=createClient(url,key,{auth:{storage,persistSession:Platform.OS!=='web',autoRefreshToken:true,detectSessionInUrl:false,lock:processLock}});
export function watchAuthRefresh() {
  const sync=(state:string|null|undefined)=>state==='active'?supabase.auth.startAutoRefresh():supabase.auth.stopAutoRefresh();
  sync(AppState.currentState);
  const listener=AppState.addEventListener('change',sync);
  return ()=>{listener.remove();supabase.auth.stopAutoRefresh();};
}
export async function driverJobs() {
  const result=await supabase.rpc('docklane_driver_assignments_v2');
  if(!result.error)return normaliseJobs(result.data);
  if(!['PGRST202','42883'].includes(result.error.code))throw new Error(result.error.message);
  const legacy=await supabase.rpc('docklane_driver_assignments');
  if(legacy.error)throw new Error(legacy.error.message);
  return normaliseJobs(legacy.data,true);
}
export async function acknowledge(id:string) {
  const {error}=await supabase.rpc('docklane_acknowledge',{p_assignment:id});
  if(error)throw new Error(error.message);
}
