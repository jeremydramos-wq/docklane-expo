
import {useCallback,useEffect,useRef,useState} from 'react';
import {ActivityIndicator,Alert,AppState,KeyboardAvoidingView,Linking,Platform,Pressable,RefreshControl,ScrollView,StatusBar,StyleSheet,Text,TextInput,View} from 'react-native';
import {SafeAreaProvider,SafeAreaView} from 'react-native-safe-area-context';
import type {Session} from '@supabase/supabase-js';
import {acknowledge,driverJobs,recordAwardOpened,supabase,watchAuthRefresh} from './src/supabase';
import {acceptanceText,canAccept,clockOffset,createJobLoader,directionsUrl,irishTime,mmss,orderJobs,remainingMs,resolveJobTarget} from './src/jobs';
import type {DriverJob} from './src/jobs';
import { DriverNotifications, DriverDocuments } from './src/inbox-views';
import { driverDestinationFromUrl, notificationDestination } from './src/inbox';
import type { DriverDestination } from './src/inbox';
import {useFonts} from 'expo-font';
import {brandFonts,colour,font,HaullerWordmark} from './src/brand';

const explain=(e:unknown)=>e instanceof Error?e.message:'The request could not be completed. Try again.';
function Button({title,onPress,disabled=false,secondary=false}:{title:string;onPress:()=>void;disabled?:boolean;secondary?:boolean}){
  return <Pressable accessibilityRole="button" accessibilityState={{disabled}} disabled={disabled} onPress={onPress}
    style={({pressed})=>[s.button,secondary&&s.secondary,disabled&&s.disabled,pressed&&s.pressed]}>
    <Text style={[s.buttonText,secondary&&s.secondaryText]}>{title}</Text>
  </Pressable>;
}
function Brand(){return <View style={s.brand}><HaullerWordmark/><Text style={s.eyebrow}>Driver</Text></View>;}
function Auth(){
  const[email,setEmail]=useState(''),[password,setPassword]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
  async function signIn(){if(busy)return;setBusy(true);setError('');
    try{const {error}=await supabase.auth.signInWithPassword({email:email.trim(),password});if(error)throw error;}
    catch(e){setError(explain(e));}finally{setBusy(false);}
  }
  return <KeyboardAvoidingView style={s.fill} behavior={Platform.OS==='ios'?'padding':undefined}>
    <ScrollView contentContainerStyle={s.auth} keyboardShouldPersistTaps="handled">
      <Brand/><Text accessibilityRole="header" style={s.hero}>Haulage.{'\n'}Made simple.</Text>
      <Text style={s.muted}>Sign in with the account your haulier invited.</Text>
      <Text style={s.label}>Email</Text><TextInput accessibilityLabel="Email" style={s.input} value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" textContentType="emailAddress" editable={!busy}/>
      <Text style={s.label}>Password</Text><TextInput accessibilityLabel="Password" style={s.input} value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoCorrect={false} autoComplete="current-password" textContentType="password" editable={!busy} onSubmitEditing={()=>void signIn()}/>
      {!!error&&<Text accessibilityRole="alert" style={s.error}>{error}</Text>}
      <Button title={busy?'Signing in…':'Sign in'} disabled={busy||!email.trim()||!password} onPress={()=>void signIn()}/>
      <Text style={s.footnote}>Need access or a password reset? Contact your transport manager or Hauller Operations.</Text>
      <Text style={s.domain}>hauller.app</Text>
    </ScrollView>
  </KeyboardAvoidingView>;
}
function JobCard({job,now,offset,open}:{job:DriverJob;now:number;offset:number;open:()=>void}){
  const pending=job.acceptance_state==='awaiting_acceptance'&&!job.acknowledged_at;
  const left=remainingMs(job.accept_by,now,offset),ready=canAccept(job,now,offset);
  return <Pressable accessibilityRole="button" accessibilityLabel={job.pickup_area+' to '+job.delivery_area+', '+acceptanceText(job)} onPress={open} style={[s.card,pending&&s.urgent]}>
    <View style={s.row}><Text style={[s.tag,pending&&s.pendingTag]}>{pending?'Awaiting your confirmation':acceptanceText(job)}</Text>{pending&&<Text accessibilityRole="timer" accessibilityLiveRegion="none" style={[s.timer,left===0&&s.error]}>{mmss(left)}</Text>}</View>
    <Text accessibilityRole="header" style={s.route}>{job.pickup_area}<Text style={s.muted}> → </Text>{job.delivery_area}</Text>
    <Text style={s.meta}>Collection · {irishTime(job.pickup_from)}</Text>
    {!!job.haulier_name&&<Text style={s.meta}>{job.haulier_name}</Text>}
    <Text style={[s.cardAction,pending&&s.accent]}>{pending?(ready?'Review assignment':'Acceptance window closed · refreshing…'):job.on_behalf?'Accepted by your haulier · View job':'View job'}</Text>
  </Pressable>;
}
function Detail({job,now,offset,busy,accept}:{job:DriverJob;now:number;offset:number;busy:boolean;accept:()=>void}){
  const pending=job.acceptance_state==='awaiting_acceptance'&&!job.acknowledged_at;
  const navigate=(address:string)=>void Linking.openURL(directionsUrl(address)).catch(()=>Alert.alert('Maps unavailable','Open your maps app and enter the address shown.'));
  return <View style={s.gap}>
    <View style={[s.card,pending&&s.urgent]}>
      <Text style={[s.tag,pending&&s.pendingTag]}>{acceptanceText(job)}</Text>
      {pending&&job.accept_by&&<><Text accessibilityRole="timer" accessibilityLiveRegion="none" style={s.bigTimer}>{mmss(remainingMs(job.accept_by,now,offset))}</Text>
        <Text style={s.muted}>Time left to accept · deadline {irishTime(job.accept_by)}</Text></>}
      <Text accessibilityRole="header" style={s.route}>{job.pickup_area} → {job.delivery_area}</Text>
      <Text style={s.meta}>All times shown in Irish time.</Text>
    </View>
    <View style={s.card}><Text style={s.label}>Collection</Text><Text style={s.address}>{job.pickup_address||job.pickup_area}</Text>
      <Text style={s.meta}>{irishTime(job.pickup_from)} – {irishTime(job.pickup_until)}</Text>
      {!!job.pickup_address&&<Button secondary title="Directions to collection" onPress={()=>navigate(job.pickup_address!)}/>}
      <View style={s.divider}/><Text style={s.label}>Delivery</Text><Text style={s.address}>{job.delivery_address||job.delivery_area}</Text>
      <Text style={s.meta}>By {irishTime(job.deliver_by)}</Text>
      {!!job.delivery_address&&<Button secondary title="Directions to delivery" onPress={()=>navigate(job.delivery_address!)}/>}
    </View>
    <View style={s.card}><Text style={s.label}>Load</Text><Text style={s.address}>{job.equipment.replaceAll('_',' ')} · {job.pallets} pallets</Text><Text style={s.meta}>{job.weight_kg.toLocaleString('en-IE')} kg{job.haulier_name?' · '+job.haulier_name:''}</Text></View>
    {canAccept(job,now,offset)&&<><Button title={busy?'Accepting…':'Accept job'} disabled={busy} onPress={accept}/><Text style={s.footnote}>Acceptance acknowledges this assignment. It is not a signed carriage contract or permission to dispatch.</Text></>}
    {!job.acknowledged_at&&!canAccept(job,now,offset)&&<Text accessibilityRole="alert" style={s.warning}>This award can no longer be accepted. Pull down to refresh your assignments.</Text>}
    {job.acknowledged_at&&<View style={s.card}><Text style={s.accepted}>{job.on_behalf?'Your haulier accepted this assignment on your behalf.':'You accepted this assignment.'}</Text><Text style={s.meta}>{irishTime(job.acknowledged_at)}</Text></View>}
  </View>;
}
function DriverWorkspace({launchDestination,consumed}:{launchDestination:DriverDestination|null;consumed:()=>void}){
  const[jobs,setJobs]=useState<DriverJob[]>([]),[offset,setOffset]=useState(0),[now,setNow]=useState(Date.now()),[busy,setBusy]=useState(true),[loaded,setLoaded]=useState(false),[accepting,setAccepting]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[selected,setSelected]=useState<string|null>(null);
  const mounted=useRef(true),expired=useRef(new Set<string>()),acceptInFlight=useRef(false);
  const [jobLoader]=useState(()=>createJobLoader(driverJobs));
  const [tab,setTab]=useState<'jobs'|'notifications'|'documents'>('jobs'),[unread,setUnread]=useState(0);
  const refresh=useCallback(async(assignment?:string)=>{
    if (!mounted.current) return;
    setBusy(true);
    try {
      const result=await jobLoader.refresh(assignment);
      if (!result || !mounted.current) return;
      const {snapshot, requested, sent, received}=result;
      setJobs(orderJobs(snapshot.items));setOffset(clockOffset(snapshot.server_now,sent,received));setNow(received);setError('');setLoaded(true);
      if (requested) {
        const target=resolveJobTarget(snapshot.items,requested);
        setSelected(target.selected);setNotice(target.notice);
      } else {
        setSelected(current=>current&&snapshot.items.some(j=>j.id===current)?current:null);
      }
    } catch(e) {
      if (!mounted.current) return;
      setError(explain(e));setNotice('');
    }
    setBusy(false);
  },[jobLoader]);
  useEffect(()=>{
    mounted.current=true;void refresh();
    let active=AppState.currentState==='active';
    const tick=setInterval(()=>{if(active)setNow(Date.now());},1000);
    const poll=setInterval(()=>{if(active)void refresh();},15000);
    const listener=AppState.addEventListener('change',state=>{active=state==='active';if(active){setNow(Date.now());void refresh();}});
    return()=>{mounted.current=false;jobLoader.stop();clearInterval(tick);clearInterval(poll);listener.remove();};
  },[refresh,jobLoader]);
  useEffect(()=>{
    for(const job of jobs)if(!job.acknowledged_at&&job.accept_by&&remainingMs(job.accept_by,now,offset)===0&&!expired.current.has(job.id)){
      expired.current.add(job.id);void refresh();break;
    }
  },[jobs,now,offset,refresh]);
  async function accept(job:DriverJob){if(acceptInFlight.current||!canAccept(job,Date.now(),offset))return;acceptInFlight.current=true;setAccepting(true);setError('');
    try{await acknowledge(job.id);if(mounted.current)setNotice('Assignment accepted. Your transport manager can see the update.');}
    catch(e){if(mounted.current)setError(explain(e));}finally{await refresh();acceptInFlight.current=false;if(mounted.current)setAccepting(false);}
  }
  const selectedJob=jobs.find(j=>j.id===selected);
  const openDestination=useCallback((destination:DriverDestination)=>{
    jobLoader.cancelTarget();setSelected(null);setError('');setNotice('');setTab(destination.view);
    if(destination.view==='documents')return;
    if(destination.assignment){
      setNotice('Checking this assignment…');void refresh(destination.assignment);
    }else{
      setNotice(destination.notice??'');void refresh();
    }
  },[jobLoader,refresh]);
  useEffect(()=>{
    if(launchDestination){openDestination(launchDestination);consumed();}
  },[launchDestination,consumed,openDestination]);
  const measured=useRef(new Set<string>());
  useEffect(()=>{
    if(tab!=='jobs'||!selectedJob||selectedJob.source!=='marketplace'||selectedJob.acceptance_state!=='awaiting_acceptance'||
       !canAccept(selectedJob,Date.now(),offset)||measured.current.has(selectedJob.id))return;
    const id=selectedJob.id;
    measured.current.add(id);
    void recordAwardOpened(id).catch(()=>measured.current.delete(id));
  },[tab,selectedJob,offset]);
  const confirmAccept=()=>{if(selectedJob)Alert.alert('Confirm this assignment?','This acknowledges the job. It does not sign a carriage contract or grant permission to dispatch.',[{text:'Go back',style:'cancel'},{text:'Confirm assignment',onPress:()=>void accept(selectedJob)}]);};
  return <View style={s.fill}>
    <View style={s.header}><Brand/><Pressable accessibilityRole="button" onPress={()=>Alert.alert('Sign out?','You will be signed out on this device.',[{text:'Stay signed in',style:'cancel'},{text:'Sign out',onPress:()=>void supabase.auth.signOut({scope:'local'}).then(({error})=>{if(error)setError(error.message);})}])}><Text style={s.link}>Sign out</Text></Pressable></View>
    {tab==='notifications'?<DriverNotifications open={item=>openDestination(notificationDestination(item))} changed={setUnread}/>:tab==='documents'?<DriverDocuments/>:
    <ScrollView contentContainerStyle={s.content} refreshControl={<RefreshControl refreshing={busy&&loaded} onRefresh={()=>void refresh()} tintColor={colour.cobalt}/> }>
      {selectedJob?<Button secondary title="All jobs" onPress={()=>{jobLoader.cancelTarget();setSelected(null);}}/>:<View><Text accessibilityRole="header" style={s.title}>Your jobs</Text><Text style={s.muted}>{jobs.filter(j=>j.acceptance_state==='awaiting_acceptance').length} awaiting acceptance · Irish time</Text></View>}
      {!!notice&&<Text accessibilityRole="alert" style={s.notice}>{notice}</Text>}
      {!!error&&<View style={s.errorPanel}><Text accessibilityRole="alert" style={s.error}>{error}</Text><Button secondary title="Refresh" onPress={()=>void refresh()}/></View>}
      {busy&&!loaded&&<ActivityIndicator accessibilityLabel="Loading assigned jobs" color={colour.cobalt} size="large"/>}
      {loaded&&!jobs.length&&<View style={s.card}><Text style={s.address}>No assigned jobs</Text><Text style={s.meta}>Your next assignment will appear here. Contact your transport manager if you expected a job.</Text><Button secondary title="Refresh jobs" onPress={()=>void refresh()}/></View>}
      {selectedJob?<Detail job={selectedJob} now={now} offset={offset} busy={accepting} accept={confirmAccept}/>:jobs.map(job=><JobCard key={job.id} job={job} now={now} offset={offset} open={()=>{jobLoader.cancelTarget();setSelected(job.id);setNotice('');}}/>)}
      <Text style={s.footnote}>Pull down to refresh. Deadlines are controlled by Hauller; changing the phone clock does not extend an award.</Text>
    </ScrollView>}
    <View accessibilityRole="tablist" style={s.navigation}>{(['jobs','notifications','documents'] as const).map(key=><Pressable key={key} accessibilityRole="tab" accessibilityState={{selected:tab===key}} onPress={()=>{jobLoader.cancelTarget();setNotice('');setTab(key);}} style={[s.navItem,tab===key&&s.navSelected]}><Text style={[s.navText,tab===key&&s.navTextSelected]}>{key==='jobs'?'Jobs':key==='notifications'?'Notifications'+(unread?' ('+unread+')':''):'Documents'}</Text></Pressable>)}</View>
  </View>;
}
export default function App(){
  const[fontsLoaded,fontError]=useFonts(brandFonts);
  const[session,setSession]=useState<Session|null|undefined>(),[error,setError]=useState('');
  const[launchDestination,setLaunchDestination]=useState<DriverDestination|null>(null);
  const consumed=useCallback(()=>setLaunchDestination(null),[]);
  useEffect(()=>{
    let active=true,receivedLink=false;
    const listener=Linking.addEventListener('url',({url})=>{
      const next=driverDestinationFromUrl(url);
      if(next){receivedLink=true;setLaunchDestination(next);}
    });
    void Linking.getInitialURL().then(url=>{
      if(active&&!receivedLink){const next=driverDestinationFromUrl(url);if(next)setLaunchDestination(next);}
    }).catch(()=>{});
    return()=>{active=false;listener.remove();};
  },[]);
  useEffect(()=>{let active=true;const stop=watchAuthRefresh();
    void supabase.auth.getSession().then(({data,error})=>{if(active){setSession(data.session);if(error)setError(error.message);}}).catch(e=>{if(active){setError(explain(e));setSession(null);}});
    const{data}=supabase.auth.onAuthStateChange((_event,next)=>{if(active)setSession(next);});
    return()=>{active=false;stop();data.subscription.unsubscribe();};
  },[]);
  return <SafeAreaProvider><SafeAreaView style={s.safe}><StatusBar barStyle="dark-content"/>
    {!!error&&<Text accessibilityRole="alert" style={s.error}>{error}</Text>}
    {(!fontsLoaded&&!fontError)||session===undefined?<ActivityIndicator accessibilityLabel="Loading account" color={colour.cobalt} style={s.fill}/>:session?<DriverWorkspace key={session.user.id} launchDestination={launchDestination} consumed={consumed}/>:<Auth/>}
  </SafeAreaView></SafeAreaProvider>;
}
const s=StyleSheet.create({
  safe:{flex:1,backgroundColor:colour.white},fill:{flex:1},header:{paddingHorizontal:20,paddingVertical:18,flexDirection:'row',alignItems:'center',justifyContent:'space-between',borderBottomWidth:1,borderColor:colour.line},
  brand:{gap:6},accent:{color:colour.cobalt},eyebrow:{fontFamily:font.medium,fontSize:13,color:colour.slate},
  hero:{fontFamily:font.semibold,fontSize:40,lineHeight:46,color:colour.ink,marginTop:32,marginBottom:12},title:{fontFamily:font.semibold,fontSize:30,color:colour.ink,marginBottom:8},
  auth:{flexGrow:1,padding:24,justifyContent:'center',gap:16,maxWidth:520,width:'100%',alignSelf:'center'},content:{padding:20,gap:20,paddingBottom:32},gap:{gap:18},
  muted:{fontFamily:font.regular,color:colour.slate,fontSize:15,lineHeight:24},label:{fontFamily:font.semibold,color:colour.slate,fontSize:14,marginTop:6,marginBottom:8},
  input:{fontFamily:font.regular,borderWidth:1,borderColor:colour.line,borderRadius:6,padding:16,color:colour.ink,fontSize:17,backgroundColor:colour.white,minHeight:54},
  button:{backgroundColor:colour.ink,borderRadius:6,paddingVertical:16,paddingHorizontal:20,alignItems:'center',justifyContent:'center',minHeight:52},
  secondary:{backgroundColor:colour.cloud,borderWidth:1,borderColor:colour.line},buttonText:{fontFamily:font.bold,color:colour.white,fontSize:16},secondaryText:{color:colour.ink},disabled:{opacity:0.5},pressed:{opacity:0.78},
  card:{backgroundColor:colour.white,borderWidth:1,borderColor:colour.line,borderRadius:12,padding:20,gap:10},urgent:{borderColor:colour.cobalt,borderWidth:1.5},
  row:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:12,flexWrap:'wrap'},tag:{fontFamily:font.semibold,color:colour.slate,fontSize:13,flexShrink:1},pendingTag:{color:colour.cobalt,backgroundColor:colour.softBlue,paddingVertical:6,paddingHorizontal:10,borderRadius:6},
  timer:{fontFamily:font.extrabold,color:colour.cobalt,fontSize:26,fontVariant:['tabular-nums']},bigTimer:{fontFamily:font.extrabold,color:colour.cobalt,fontSize:56,fontVariant:['tabular-nums']},
  route:{fontFamily:font.bold,fontSize:24,lineHeight:33,color:colour.ink,marginTop:5},meta:{fontFamily:font.regular,color:colour.slate,fontSize:14,lineHeight:23},cardAction:{fontFamily:font.bold,color:colour.ink,fontSize:14,marginTop:12},
  address:{fontFamily:font.semibold,color:colour.ink,fontSize:19,lineHeight:28},divider:{height:1,backgroundColor:colour.line,marginVertical:14},
  accepted:{fontFamily:font.medium,color:colour.success,fontSize:15,lineHeight:24},link:{fontFamily:font.semibold,color:colour.slate,fontSize:14,padding:12,minHeight:44},footnote:{fontFamily:font.regular,fontSize:12,lineHeight:20,color:colour.slate,marginTop:12},domain:{fontFamily:font.semibold,color:colour.cobalt,fontSize:14,marginTop:8},error:{fontFamily:font.medium,color:colour.danger,fontSize:14,lineHeight:23},
  warning:{fontFamily:font.medium,color:colour.warning,backgroundColor:colour.warningBg,padding:16,borderRadius:6,fontSize:15,lineHeight:24},notice:{fontFamily:font.medium,color:colour.success,backgroundColor:colour.successBg,padding:16,borderRadius:6,fontSize:14,lineHeight:23},errorPanel:{backgroundColor:colour.dangerBg,padding:16,borderRadius:6,gap:12},
  navigation:{flexDirection:'row',borderTopWidth:1,borderColor:colour.line,padding:10,gap:8,backgroundColor:colour.white},navItem:{flex:1,minHeight:48,alignItems:'center',justifyContent:'center',borderRadius:6,padding:8},navSelected:{backgroundColor:colour.softBlue},navText:{fontFamily:font.semibold,color:colour.slate,fontSize:14,textAlign:'center'},navTextSelected:{color:colour.cobalt},
});
