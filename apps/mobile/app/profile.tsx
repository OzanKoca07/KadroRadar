import {useCallback,useRef,useState} from 'react';
import {Alert,Text,TextInput,View} from 'react-native';
import {router,useFocusEffect,useLocalSearchParams} from 'expo-router';
import {accountRequest,setSession,hasSession,registrationPolicy,AccountError} from '../lib/account';
import {validateAuth,loginDestination,type AuthErrors} from '../lib/auth-form';
import {enablePush,disablePush} from '../lib/push';
import {errorText} from '../lib/presentation';
import {Button,Card,Chip,Field,Heading,Notice,Screen} from '../ui/components';
import {colors,ui} from '../ui/theme';
type ProfileData={educationLevel?:string;exactDegreeProgramCode?:string;kpssScoreType?:string;kpssScore?:string|number|null;examYear?:string|number|null;ydsScore?:string|number|null;preferredCities?:string[];certificates?:string[]};
export default function Profile(){
 const params=useLocalSearchParams<{returnTo?:string;returnAnnouncement?:string}>(),emailRef=useRef<TextInput>(null),passwordRef=useRef<TextInput>(null),inFlight=useRef(false);
 const [errors,setErrors]=useState<AuthErrors>({}),[visible,setVisible]=useState(false),[policy,setPolicy]=useState<'OPEN'|'CLOSED'|'UNKNOWN'>('UNKNOWN');
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[profile,setProfile]=useState<ProfileData>({});
 const [message,setMessage]=useState(''),[failed,setFailed]=useState(false),[busy,setBusy]=useState(false),[logged,setLogged]=useState(hasSession()),[mode,setMode]=useState('login');
 async function run(work:()=>Promise<string|void>){if(inFlight.current)return;inFlight.current=true;setBusy(true);setMessage('');setFailed(false);try{const result=await work();setMessage(result||'Değişikliklerin kaydedildi.');}catch(e){setFailed(true);setMessage(errorText(e));if(!hasSession())setLogged(false);}finally{inFlight.current=false;setBusy(false);}}
 useFocusEffect(useCallback(()=>{let active=true;setLogged(hasSession());void registrationPolicy().then(value=>{if(active){setPolicy(value);if(value!=='OPEN')setMode('login');}});if(hasSession())void accountRequest('/account/profile').then(value=>{if(active)setProfile(value??{});}).catch(e=>{if(active){setMessage(errorText(e));setFailed(true);setLogged(hasSession());}});return()=>{active=false;};},[]));
 const action=(title:string,work:()=>Promise<string|void>,variant:'primary'|'secondary'|'ghost'|'danger'='primary')=><Button title={title} onPress={()=>void run(work)} disabled={busy} variant={variant}/>;
 const save=async()=>{const data:Record<string,unknown>={};for(const key of ['educationLevel','exactDegreeProgramCode','kpssScoreType','preferredCities','certificates'] as const)if(profile[key]!==undefined)data[key]=profile[key];for(const key of ['preferredCities','certificates'] as const)if(profile[key]!==undefined)data[key]=profile[key]?.map(x=>x.trim()).filter(Boolean);for(const key of ['kpssScore','ydsScore','examYear'] as const){const value=profile[key];if(value==null||value==='')data[key]=null;else{const number=Number(String(value).replace(',','.'));if(!Number.isFinite(number))throw Error('Puan ve yıl alanlarını sayısal olarak gir.');data[key]=number;}}setProfile(await accountRequest('/account/profile','PUT',data));};
 async function submit(){
  if(inFlight.current)return;
  const found=validateAuth(email,password,mode==='register');setErrors(found);setMessage('');if(found.email){emailRef.current?.focus();return;}if(found.password){passwordRef.current?.focus();return;}
  if(mode==='register'&&policy!=='OPEN'){setMessage('Yeni hesap oluşturma şu anda kullanılamıyor.');setFailed(true);return;}
  await run(async()=>{try{
   if(mode==='register'){await accountRequest('/account/register','POST',{email:email.trim(),password});setPassword('');setMode('login');return 'Hesabın oluşturuldu. Giriş yapabilirsin.';}
   const result=await accountRequest('/account/login','POST',{email:email.trim(),password});setSession(result.token);setPassword('');setLogged(true);setProfile(await accountRequest('/account/profile')??{});const destination=loginDestination(params.returnTo);if(destination)router.replace(destination);else if(typeof params.returnAnnouncement==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(params.returnAnnouncement))router.replace({pathname:'/announcement/[id]',params:{id:params.returnAnnouncement}});return 'Giriş yapıldı.';
  }catch(error){if(error instanceof AccountError&&error.code==='REGISTRATION_DISABLED'){setPolicy('CLOSED');setMode('login');}throw error;}});
 }
 return <Screen><Heading title={logged?'Profil':'Giriş yap'}/>
 {!logged?<Card>{policy==='OPEN'&&<View style={ui.row}>{[['login','Giriş yap'],['register','Hesap oluştur']].map(([value,label])=><Chip key={value} label={label} selected={mode===value} onPress={()=>{if(!busy){setMode(value);setErrors({});setMessage('');}}}/>)}</View>}
  <Field ref={emailRef} label="E-posta" placeholder="E-posta adresin" value={email} error={errors.email} onChangeText={value=>{setEmail(value);setErrors(current=>({...current,email:undefined}));}} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" textContentType="emailAddress" editable={!busy} returnKeyType="next" onSubmitEditing={()=>passwordRef.current?.focus()}/>
  <Field ref={passwordRef} label="Şifre" placeholder="Şifreni gir" secureTextEntry={!visible} value={password} error={errors.password} onChangeText={value=>{setPassword(value);setErrors(current=>({...current,password:undefined}));}} autoCapitalize="none" autoCorrect={false} autoComplete={mode==='login'?'current-password':'new-password'} textContentType={mode==='login'?'password':'newPassword'} editable={!busy} returnKeyType="go" onSubmitEditing={()=>void submit()}/>
  <Button title={visible?'Şifreyi gizle':'Şifreyi göster'} variant="ghost" disabled={busy} onPress={()=>setVisible(value=>!value)}/>
  {!!message&&<Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={[ui.body,{color:failed?colors.error:colors.success}]}>{message}</Text>}
  <Button title={mode==='login'?'Giriş yap':'Hesap oluştur'} onPress={()=>void submit()} busy={busy}/>
  {policy!=='OPEN'&&<Text style={ui.caption}>{policy==='CLOSED'?'Yeni hesap oluşturma şu anda kullanılamıyor.':'Hesap oluşturma durumu doğrulanamadı.'}</Text>}
  <Button title="Giriş yapmadan incele" variant="ghost" onPress={()=>router.push('/historical')}/>
 </Card>:<>
  <Card><Text style={ui.heading}>Eğitim ve sınav bilgileri</Text><Text style={ui.label}>Eğitim düzeyi</Text><View style={ui.row}>{[['LISANS','Lisans'],['ONLISANS','Önlisans'],['ORTAOGRETIM','Ortaöğretim']].map(([value,label])=><Chip key={value} label={label} selected={profile.educationLevel===value} onPress={()=>setProfile({...profile,educationLevel:value})}/>)}</View>
   <Field label="Doğrulanmış mezuniyet bölüm kodu" placeholder="Bilmiyorsan boş bırak" value={profile.exactDegreeProgramCode||''} onChangeText={exactDegreeProgramCode=>setProfile({...profile,exactDegreeProgramCode})}/>
   <Text style={ui.label}>KPSS puan türü</Text><View style={ui.row}>{['P3','P93','P94'].map(value=><Chip key={value} label={value} selected={profile.kpssScoreType===value} onPress={()=>setProfile({...profile,kpssScoreType:value})}/>)}</View>
   {(['kpssScore','examYear','ydsScore'] as const).map(key=><Field key={key} label={{kpssScore:'KPSS puanı',examYear:'Sınav yılı',ydsScore:'YDS puanı (isteğe bağlı)'}[key]} placeholder="Boş bırakabilirsin" value={profile[key]==null?'':String(profile[key])} keyboardType={key==='examYear'?'number-pad':'decimal-pad'} onChangeText={value=>setProfile({...profile,[key]:value})}/>)}
  </Card>
  <Card><Text style={ui.heading}>Tercihlerin</Text><Field label="Tercih edilen iller" placeholder="İzmir, Ankara" value={(profile.preferredCities??[]).join(',')} onChangeText={value=>setProfile({...profile,preferredCities:value.split(',')})}/><Field label="Belge ve sertifika kodları (isteğe bağlı)" placeholder="Kodları virgülle ayır" value={(profile.certificates??[]).join(',')} onChangeText={value=>setProfile({...profile,certificates:value.split(',')})}/>{action('Profilimi kaydet',save)}<Button title="Bana uygun kadroları incele" variant="secondary" onPress={()=>router.push('/matches')}/></Card>
  <Card><Text style={ui.heading}>Bildirim tercihleri</Text><Text style={ui.muted}>İzin yalnızca isteğinle alınır. Bildirim gönderimi sunucudaki doğrulama ve tercih kurallarına bağlıdır.</Text>{action('İzin ver ve etkinleştir',async()=>{await enablePush();return 'Bildirim tercihin kaydedildi.';},'secondary')}{action('Bildirimleri kapat',async()=>{await disablePush();return 'Bildirimler kapatıldı.';},'ghost')}</Card>
  <Card><Text style={ui.heading}>Hesap işlemleri</Text>{action('Çıkış yap',async()=>{await accountRequest('/account/logout','POST',{});setSession(null);setLogged(false);setProfile({});return 'Oturumun kapatıldı.';},'secondary')}<Button title="Hesabımı ve profilimi sil" variant="danger" disabled={busy} onPress={()=>Alert.alert('Hesabını silmek istiyor musun?','Profilin ve kaydedilen ilanların kaldırılacak. Bu işlem geri alınamaz.',[{text:'Vazgeç',style:'cancel'},{text:'Hesabımı sil',style:'destructive',onPress:()=>void run(async()=>{await accountRequest('/account','DELETE');setSession(null);setLogged(false);setProfile({});return 'Hesabın silindi.';})}])}/></Card>
 </>}
 {!!message&&logged&&<Card><Text accessibilityRole="alert" style={[ui.body,{color:failed?colors.error:colors.success}]}>{message}</Text></Card>}
 <Notice title="Verilerin kontrolü sende">Profil bilgileri isteğe bağlıdır. Eksik koşullar kesin uygunluk sayılmaz. Uygulama yeniden başlatıldığında giriş gerekir.</Notice>
 </Screen>;
}
