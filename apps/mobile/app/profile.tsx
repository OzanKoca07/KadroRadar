import {useState} from 'react';
import {ScrollView,Text,TextInput,Pressable,Alert} from 'react-native';
import {accountRequest,setSession,hasSession} from '../lib/account';
import {enablePush,disablePush} from '../lib/push';
export default function Profile(){
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[profile,setProfile]=useState<any>({}),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[logged,setLogged]=useState(hasSession());
 async function run(work:()=>Promise<void>){setBusy(true);try{await work();setMessage('İşlem tamamlandı.');}catch(e){setMessage(String(e));}finally{setBusy(false);}}
 const button=(title:string,work:()=>Promise<void>)=><Pressable accessibilityRole="button" disabled={busy} onPress={()=>run(work)} style={{padding:16,backgroundColor:'#172758',borderRadius:12,marginVertical:8}}><Text style={{color:'white'}}>{title}</Text></Pressable>;
 return <ScrollView contentContainerStyle={{padding:24,gap:12,paddingBottom:48}} keyboardShouldPersistTaps="handled"><Text style={{fontSize:26,fontWeight:'800'}}>Profilim</Text><Text>İlanlara giriş yapmadan göz atabilirsiniz. Doğum tarihi, cinsiyet ve belge dosyası istemiyoruz.</Text>
 {!logged?<><TextInput accessibilityLabel="E-posta" placeholder="E-posta" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address"/><TextInput accessibilityLabel="Parola" placeholder="Parola" secureTextEntry value={password} onChangeText={setPassword}/>{button('Giriş yap',async()=>{const result=await accountRequest('/account/login','POST',{email,password});setSession(result.token);setPassword('');setLogged(true);setProfile(await accountRequest('/account/profile')??{});})}{button('Hesap oluştur',async()=>{await accountRequest('/account/register','POST',{email,password});setPassword('');})}</>:<>
 {button('Profili getir',async()=>setProfile(await accountRequest('/account/profile')??{}))}
 {button('Bildirimlere izin ver ve etkinleştir',enablePush)}
 {button('Bildirimleri kapat',disablePush)}
 {(['educationLevel','exactDegreeProgramCode','kpssScoreType','kpssScore','examYear','ydsScore'] as const).map(key=><TextInput key={key} accessibilityLabel={key} placeholder={{educationLevel:'Eğitim düzeyi (ör. LISANS)',exactDegreeProgramCode:'Doğrulanmış bölüm kodu',kpssScoreType:'KPSS puan türü (ör. P3)',kpssScore:'KPSS puanı',examYear:'Sınav yılı',ydsScore:'YDS puanı'}[key]} value={profile[key]==null?'':String(profile[key])} onChangeText={value=>setProfile({...profile,[key]:value})} style={{padding:12,backgroundColor:'#F3F6FB'}}/>)}
 <TextInput accessibilityLabel="Tercih edilen iller" placeholder="İller (virgülle ayırın)" value={(profile.preferredCities??[]).join(', ')} onChangeText={value=>setProfile({...profile,preferredCities:value.split(',').map(x=>x.trim())})}/>
 <TextInput accessibilityLabel="Belge ve sertifika kodları" placeholder="Belge kodları (isteğe bağlı, virgülle ayırın)" value={(profile.certificates??[]).join(', ')} onChangeText={value=>setProfile({...profile,certificates:value.split(',').map(x=>x.trim()).filter(Boolean)})}/>
 {button('Profili kaydet',async()=>{const data={...profile};for(const key of ['kpssScore','ydsScore','examYear'])data[key]=data[key]==null||data[key]===''?null:Number(String(data[key]).replace(',','.'));setProfile(await accountRequest('/account/profile','PUT',data));})}
 {button('Çıkış yap',async()=>{await accountRequest('/account/logout','POST',{});setSession(null);setLogged(false);setProfile({});})}
 {button('Hesabımı ve profilimi sil',async()=>{Alert.alert('Hesap silme','Profil ve kaydedilen ilanlar kaldırılacak.',[{text:'Vazgeç'},{text:'Sil',style:'destructive',onPress:()=>run(async()=>{await accountRequest('/account','DELETE');setSession(null);setLogged(false);setProfile({});})}]);})}
 </>}<Text accessibilityRole="alert">{message}</Text><Text>Uygunluk bilgilendirme amaçlıdır; başvuru kararı resmî metne göre verilir.</Text></ScrollView>;
}
