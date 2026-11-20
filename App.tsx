
import {useCallback,useEffect,useRef,useState} from 'react';
import {ActivityIndicator,Alert,AppState,KeyboardAvoidingView,Linking,Platform,Pressable,RefreshControl,ScrollView,StatusBar,StyleSheet,Text,TextInput,View} from 'react-native';
import {SafeAreaProvider,SafeAreaView} from 'react-native-safe-area-context';
import type {Session} from '@supabase/supabase-js';
import {acknowledge,driverJobs,supabase,watchAuthRefresh} from './src/supabase';
import {acceptanceText,canAccept,clockOffset,directionsUrl,irishTime,mmss,orderJobs,remainingMs} from './src/jobs';
import type {DriverJob} from './src/jobs';

const explain=(e:unknown)=>e instanceof Error?e.message:'The request could not be completed. Try again.';
function Button({title,onPress,disabled=false,secondary=false}:{title:string;onPress:()=>void;disabled?:boolean;secondary?:boolean}){
  return <Pressable accessibilityRole="button" accessibilityState={{disabled}} disabled={disabled} onPress={onPress}
    style={({pressed})=>[s.button,secondary&&s.secondary,disabled&&s.disabled,pressed&&s.pressed]}>
    <Text style={[s.buttonText,secondary&&s.secondaryText]}>{title}</Text>
  </Pressable>;
}
function Brand(){return <View><Text style={s.brand}>docklane<Text style={s.lime}>.</Text></Text><Text style={s.eyebrow}>DRIVER</Text></View>;}
function Auth(){
  const[email,setEmail]=useState(''),[password,setPassword]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
  async function signIn(){if(busy)return;setBusy(true);setError('');
    try{const {error}=await supabase.auth.signInWithPassword({email:email.trim(),password});if(error)throw error;}
    catch(e){setError(explain(e));}finally{setBusy(false);}
  }
  return <KeyboardAvoidingView style={s.fill} behavior={Platform.OS==='ios'?'padding':undefined}>
    <ScrollView contentContainerStyle={s.auth} keyboardShouldPersistTaps="handled">
      <Brand/><Text accessibilityRole="header" style={s.hero}>Your next move,<Text style={s.lime}> connected.</Text></Text>
      <Text style={s.muted}>Sign in with the account your haulier invited.</Text>
      <Text style={s.label}>Email</Text><TextInput accessibilityLabel="Email" style={s.input} value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" textContentType="emailAddress" editable={!busy}/>
      <Text style={s.label}>Password</Text><TextInput accessibilityLabel="Password" style={s.input} value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoCorrect={false} autoComplete="current-password" textContentType="password" editable={!busy} onSubmitEditing={()=>void signIn()}/>
      {!!error&&<Text accessibilityRole="alert" style={s.error}>{error}</Text>}
      <Button title={busy?'Signing in…':'Sign in'} disabled={busy||!email.trim()||!password} onPress={()=>void signIn()}/>
      <Text style={s.footnote}>Need access or a password reset? Contact your transport manager or Docklane Operations.</Text>
    </ScrollView>
  </KeyboardAvoidingView>;
}
function JobCard({job,now,offset,open}:{job:DriverJob;now:number;offset:number;open:()=>void}){
  const pending=job.acceptance_state==='awaiting_acceptance'&&!job.acknowledged_at;
  const left=remainingMs(job.accept_by,now,offset),ready=canAccept(job,now,offset);
  return <Pressable accessibilityRole="button" accessibilityLabel={job.pickup_area+' to '+job.delivery_area+', '+acceptanceText(job)} onPress={open} style={[s.card,pending&&s.urgent]}>
    <View style={s.row}><Text style={s.tag}>{pending?'ACTION REQUIRED':acceptanceText(job).toUpperCase()}</Text>{pending&&<Text accessibilityRole="timer" accessibilityLiveRegion="none" style={[s.timer,left===0&&s.error]}>{mmss(left)}</Text>}</View>
    <Text accessibilityRole="header" style={s.route}>{job.pickup_area}<Text style={s.muted}> → </Text>{job.delivery_area}</Text>
    <Text style={s.meta}>Collection · {irishTime(job.pickup_from)}</Text>
    {!!job.haulier_name&&<Text style={s.meta}>{job.haulier_name}</Text>}
    <Text style={[s.cardAction,pending&&s.lime]}>{pending?(ready?'Review & accept →':'Acceptance window closed · refreshing…'):job.on_behalf?'Accepted by your haulier · View job →':'View job →'}</Text>
  </Pressable>;
}
function Detail({job,now,offset,busy,accept}:{job:DriverJob;now:number;offset:number;busy:boolean;accept:()=>void}){
  const pending=job.acceptance_state==='awaiting_acceptance'&&!job.acknowledged_at;
  const navigate=(address:string)=>void Linking.openURL(directionsUrl(address)).catch(()=>Alert.alert('Maps unavailable','Open your maps app and enter the address shown.'));
  return <View style={s.gap}>
    <View style={[s.card,pending&&s.urgent]}>
      <Text style={s.tag}>{acceptanceText(job).toUpperCase()}</Text>
      {pending&&<><Text accessibilityRole="timer" accessibilityLiveRegion="none" style={s.bigTimer}>{mmss(remainingMs(job.accept_by,now,offset))}</Text>
        <Text style={s.muted}>Time left to accept · deadline {irishTime(job.accept_by!)}</Text></>}
      <Text accessibilityRole="header" style={s.route}>{job.pickup_area} → {job.delivery_area}</Text>
      <Text style={s.meta}>All times shown in Irish time.</Text>
    </View>
    <View style={s.card}><Text style={s.label}>COLLECTION</Text><Text style={s.address}>{job.pickup_address||job.pickup_area}</Text>
      <Text style={s.meta}>{irishTime(job.pickup_from)} – {irishTime(job.pickup_until)}</Text>
      {!!job.pickup_address&&<Button secondary title="Directions to collection" onPress={()=>navigate(job.pickup_address!)}/>}
      <View style={s.divider}/><Text style={s.label}>DELIVERY</Text><Text style={s.address}>{job.delivery_address||job.delivery_area}</Text>
      <Text style={s.meta}>By {irishTime(job.deliver_by)}</Text>
      {!!job.delivery_address&&<Button secondary title="Directions to delivery" onPress={()=>navigate(job.delivery_address!)}/>}
    </View>
    <View style={s.card}><Text style={s.label}>LOAD</Text><Text style={s.address}>{job.equipment.replaceAll('_',' ')} · {job.pallets} pallets</Text><Text style={s.meta}>{job.weight_kg.toLocaleString('en-IE')} kg{job.haulier_name?' · '+job.haulier_name:''}</Text></View>
    {canAccept(job,now,offset)&&<><Button title={busy?'Accepting…':'Accept job'} disabled={busy} onPress={accept}/><Text style={s.footnote}>Acceptance acknowledges this assignment. It is not a signed carriage contract or permission to dispatch.</Text></>}
    {!job.acknowledged_at&&!canAccept(job,now,offset)&&<Text accessibilityRole="alert" style={s.warning}>This award can no longer be accepted. Pull down to refresh your assignments.</Text>}
    {job.acknowledged_at&&<View style={s.card}><Text style={s.lime}>{job.on_behalf?'Your haulier accepted this assignment on your behalf.':'You accepted this assignment.'}</Text><Text style={s.meta}>{irishTime(job.acknowledged_at)}</Text></View>}
  </View>;
}
function DriverWorkspace(){
  const[jobs,setJobs]=useState<DriverJob[]>([]),[offset,setOffset]=useState(0),[now,setNow]=useState(Date.now()),[busy,setBusy]=useState(true),[loaded,setLoaded]=useState(false),[accepting,setAccepting]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[selected,setSelected]=useState<string|null>(null);
  const mounted=useRef(true),loading=useRef(false),expired=useRef(new Set<string>());
  const refresh=useCallback(async()=>{
    if(loading.current)return;loading.current=true;if(mounted.current)setBusy(true);
    try{const sent=Date.now(),snapshot=await driverJobs(),received=Date.now();if(!mounted.current)return;
      setJobs(orderJobs(snapshot.items));setOffset(clockOffset(snapshot.server_now,sent,received));setNow(received);setError('');setLoaded(true);
      setSelected(current=>current&&snapshot.items.some(j=>j.id===current)?current:null);
    }catch(e){if(mounted.current)setError(explain(e));}finally{loading.current=false;if(mounted.current)setBusy(false);}
  },[]);
  useEffect(()=>{
    mounted.current=true;void refresh();
    let active=AppState.currentState==='active';
    const tick=setInterval(()=>{if(active)setNow(Date.now());},1000);
    const poll=setInterval(()=>{if(active)void refresh();},15000);
    const listener=AppState.addEventListener('change',state=>{active=state==='active';if(active){setNow(Date.now());void refresh();}});
    return()=>{mounted.current=false;clearInterval(tick);clearInterval(poll);listener.remove();};
  },[refresh]);
  useEffect(()=>{
    for(const job of jobs)if(!job.acknowledged_at&&job.accept_by&&remainingMs(job.accept_by,now,offset)===0&&!expired.current.has(job.id)){
      expired.current.add(job.id);void refresh();break;
    }
  },[jobs,now,offset,refresh]);
  async function accept(job:DriverJob){if(accepting||!canAccept(job,Date.now(),offset))return;setAccepting(true);setError('');
    try{await acknowledge(job.id);if(mounted.current)setNotice('Assignment accepted. Your transport manager can see the update.');}
    catch(e){if(mounted.current)setError(explain(e));}finally{await refresh();if(mounted.current)setAccepting(false);}
  }
  const selectedJob=jobs.find(j=>j.id===selected);
  const confirmAccept=()=>{if(selectedJob)Alert.alert('Accept this assignment?','This acknowledges the job. It does not sign a carriage contract or grant permission to dispatch.',[{text:'Go back',style:'cancel'},{text:'Accept job',onPress:()=>void accept(selectedJob)}]);};
  return <View style={s.fill}>
    <View style={s.header}><Brand/><Pressable accessibilityRole="button" onPress={()=>Alert.alert('Sign out?','You will be signed out on this device.',[{text:'Stay signed in',style:'cancel'},{text:'Sign out',onPress:()=>void supabase.auth.signOut({scope:'local'}).then(({error})=>{if(error)setError(error.message);})}])}><Text style={s.link}>Sign out</Text></Pressable></View>
    <ScrollView contentContainerStyle={s.content} refreshControl={<RefreshControl refreshing={busy&&loaded} onRefresh={()=>void refresh()} tintColor="#c6f888"/>}>
      {selectedJob?<Button secondary title="← All jobs" onPress={()=>setSelected(null)}/>:<View><Text accessibilityRole="header" style={s.title}>Your jobs</Text><Text style={s.muted}>{jobs.filter(j=>j.acceptance_state==='awaiting_acceptance').length} awaiting acceptance · Irish time</Text></View>}
      {!!notice&&<Text accessibilityRole="alert" style={s.notice}>{notice}</Text>}
      {!!error&&<View style={s.errorPanel}><Text accessibilityRole="alert" style={s.error}>{error}</Text><Button secondary title="Refresh" onPress={()=>void refresh()}/></View>}
      {busy&&!loaded&&<ActivityIndicator accessibilityLabel="Loading assigned jobs" color="#c6f888" size="large"/>}
      {loaded&&!jobs.length&&<View style={s.card}><Text style={s.address}>No assigned jobs</Text><Text style={s.meta}>Your next assignment will appear here. Contact your transport manager if you expected a job.</Text><Button secondary title="Refresh jobs" onPress={()=>void refresh()}/></View>}
      {selectedJob?<Detail job={selectedJob} now={now} offset={offset} busy={accepting} accept={confirmAccept}/>:jobs.map(job=><JobCard key={job.id} job={job} now={now} offset={offset} open={()=>{setSelected(job.id);setNotice('');}}/>)}
      <Text style={s.footnote}>Pull down to refresh. Deadlines are controlled by Docklane; changing the phone clock does not extend an award.</Text>
    </ScrollView>
  </View>;
}
export default function App(){
  const[session,setSession]=useState<Session|null|undefined>(),[error,setError]=useState('');
  useEffect(()=>{let active=true;const stop=watchAuthRefresh();
    void supabase.auth.getSession().then(({data,error})=>{if(active){setSession(data.session);if(error)setError(error.message);}}).catch(e=>{if(active){setError(explain(e));setSession(null);}});
    const{data}=supabase.auth.onAuthStateChange((_event,next)=>{if(active)setSession(next);});
    return()=>{active=false;stop();data.subscription.unsubscribe();};
  },[]);
  return <SafeAreaProvider><SafeAreaView style={s.safe}><StatusBar barStyle="light-content" backgroundColor="#101711"/>
    {!!error&&<Text accessibilityRole="alert" style={s.error}>{error}</Text>}
    {session===undefined?<ActivityIndicator accessibilityLabel="Loading account" color="#c6f888" style={s.fill}/>:session?<DriverWorkspace key={session.user.id}/>:<Auth/>}
  </SafeAreaView></SafeAreaProvider>;
}
const s=StyleSheet.create({
  safe:{flex:1,backgroundColor:'#101711'},fill:{flex:1},header:{padding:22,flexDirection:'row',alignItems:'center',justifyContent:'space-between',borderBottomWidth:1,borderColor:'#293529'},
  brand:{fontSize:30,fontWeight:'800',letterSpacing:-1.5,color:'#f3f6ef'},lime:{color:'#c6f888'},eyebrow:{fontSize:10,letterSpacing:4,color:'#bac5b4',marginTop:3},
  hero:{fontSize:40,lineHeight:46,fontWeight:'700',color:'#f3f6ef',marginTop:40,marginBottom:18},title:{fontSize:30,fontWeight:'700',color:'#f3f6ef',marginBottom:8},
  auth:{flexGrow:1,padding:28,justifyContent:'center',gap:15},content:{padding:20,gap:18,paddingBottom:50},gap:{gap:18},
  muted:{color:'#aebba7',fontSize:15,lineHeight:23},label:{color:'#b6c4ae',fontSize:12,fontWeight:'700',letterSpacing:1.2,marginTop:6,marginBottom:8},
  input:{borderWidth:1,borderColor:'#42523b',borderRadius:12,padding:16,color:'#f3f6ef',fontSize:17,backgroundColor:'#1a251a'},
  button:{backgroundColor:'#c6f888',borderRadius:14,paddingVertical:17,paddingHorizontal:20,alignItems:'center',justifyContent:'center',minHeight:54},
  secondary:{backgroundColor:'#243321',borderWidth:1,borderColor:'#42523b'},buttonText:{color:'#11200c',fontSize:16,fontWeight:'700'},secondaryText:{color:'#e6eddf'},disabled:{opacity:0.5},pressed:{opacity:0.78},
  card:{backgroundColor:'#1b271a',borderWidth:1,borderColor:'#35442d',borderRadius:20,padding:21,gap:8},urgent:{borderColor:'#b4dc7b',borderWidth:1.5},
  row:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:12},tag:{color:'#c6f888',fontSize:11,letterSpacing:1.2,fontWeight:'700',flexShrink:1},
  timer:{color:'#d9ffaf',fontSize:28,fontWeight:'800',fontVariant:['tabular-nums']},bigTimer:{color:'#c6f888',fontSize:64,fontWeight:'800',fontVariant:['tabular-nums']},
  route:{fontSize:25,lineHeight:33,color:'#f3f6ef',fontWeight:'700',marginTop:5},meta:{color:'#b3c0ab',fontSize:14,lineHeight:22},cardAction:{color:'#dfe8d7',fontSize:14,fontWeight:'700',marginTop:12},
  address:{color:'#f3f6ef',fontSize:19,lineHeight:28,fontWeight:'600'},divider:{height:1,backgroundColor:'#35442d',marginVertical:14},
  link:{color:'#d0dfc4',fontSize:14,padding:10},footnote:{fontSize:12,lineHeight:20,color:'#99a990',marginTop:12},error:{color:'#ffb4a5',fontSize:14,lineHeight:22},
  warning:{color:'#ffd194',fontSize:15,lineHeight:23},notice:{color:'#d2f6b3',backgroundColor:'#263b20',padding:16,borderRadius:12,fontSize:14,lineHeight:22},errorPanel:{backgroundColor:'#38251f',padding:16,borderRadius:14,gap:12},
});
