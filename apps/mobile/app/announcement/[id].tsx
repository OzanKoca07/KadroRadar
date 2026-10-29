import {useEffect,useState} from 'react';
import {router,useLocalSearchParams} from 'expo-router';
import {Text,View} from 'react-native';
import {accountRequest,hasSession} from '../../lib/account';
import {announcementDetailRequest} from '../../lib/announcement-api';
import {announcementStatus,dateTimeText,educationLabel,errorText,type Announcement} from '../../lib/presentation';
import {Badge,Button,Card,ErrorState,Fact,Heading,Independence,Notice,OfficialLink,Screen,SkeletonCards} from '../../ui/components';
import {ui} from '../../ui/theme';
type Match={positionId:string;title:string;outcome:string;reasons:{reason:string}[]};
export default function Detail(){
 const {id}=useLocalSearchParams<{id:string}>();
 const [item,setItem]=useState<Announcement|null>(null),[error,setError]=useState(''),[retry,setRetry]=useState(0),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const [matches,setMatches]=useState<{items:Match[];emptyReason?:string}|null>(null);
 useEffect(()=>{const controller=new AbortController();let active=true;setError('');setItem(null);setMatches(null);setMessage('');announcementDetailRequest(id,controller.signal).then(value=>{if(active)setItem(value);}).catch(e=>{if(active)setError(errorText(e));});return()=>{active=false;controller.abort();};},[id,retry]);
 async function action(work:()=>Promise<void>){setBusy(true);setMessage('');try{await work();}catch(e){setMessage(errorText(e));}finally{setBusy(false);}}
 return <Screen>{error?<ErrorState message={error} onRetry={()=>setRetry(k=>k+1)}/>:!item?<SkeletonCards/>:<>
  <Badge text={announcementStatus(item)} tone={announcementStatus(item)==='Başvuru açık'?'success':'warning'}/><Heading title={item.title} description={item.organization}/>
  <Card><Text style={ui.heading}>Bir bakışta</Text><Fact label="Kadro" value={item.positionTitle||'Belirtilmemiş'}/><Fact label="Şehir" value={item.city||'Belirtilmemiş'}/><Fact label="Kontenjan" value={item.quota??'Belirtilmemiş'}/>{item.educationLevel&&<Fact label="Eğitim" value={educationLabel(item.educationLevel)}/>}<Fact label="Başvuru başlangıcı" value={dateTimeText(item.applicationStartAt)}/><Fact label="Son başvuru" value={dateTimeText(item.applicationEndAt)}/></Card>
  {hasSession()?<>  <Button title="İlanı kaydet" icon="bookmark-outline" disabled={busy} onPress={()=>void action(async()=>{await accountRequest('/account/saved/'+encodeURIComponent(id),'PUT',{});setMessage('İlan kaydedildi. Değişikliklerini Kaydedilenler ekranından takip edebilirsin.');})}/>
  <Button title="Profilimle karşılaştır" icon="checkmark-circle-outline" variant="secondary" disabled={busy} onPress={()=>void action(async()=>setMatches(await accountRequest('/account/matches/'+encodeURIComponent(id))))}/>
  </>:<Button title="Kaydetmek veya karşılaştırmak için giriş yap" onPress={()=>router.push({pathname:'/profile',params:{returnAnnouncement:id}})}/>}
  {!!message&&<Text accessibilityRole="alert" style={ui.body}>{message}</Text>}
  {matches&&<Card><Text style={ui.heading}>Kadro bazında sonuçların</Text>{matches.emptyReason&&<Text style={ui.muted}>{matches.emptyReason}</Text>}{matches.items.map(position=><View key={position.positionId} style={{gap:8}}><Text style={ui.label}>{position.title}</Text><Badge tone={position.outcome==='ELIGIBLE'?'success':'warning'} text={position.outcome==='ELIGIBLE'?'UYGUN':position.outcome==='INELIGIBLE'?'UYGUN DEĞİL':'BELİRSİZ / DOĞRULAMA GEREKLİ'}/>{position.reasons.map((reason,index)=><Text key={index} style={ui.muted}>• {reason.reason}</Text>)}</View>)}</Card>}
  {(item.positions??[]).map(position=><Card key={position.id}><Text style={ui.heading}>{position.title}</Text><Text style={ui.muted}>{position.city||'Şehir belirtilmemiş'} · {position.quota??'Belirtilmemiş'} kontenjan</Text><Badge text={position.verifiedAt?'Kaynaktan kontrol edilmiş':'Koşullar doğrulanmamış'} tone={position.verifiedAt?'neutral':'warning'}/><Fact label="Eğitim" value={position.requirements.educationLevels?.map(educationLabel).join(', ')||'Belirtilmemiş'}/><Fact label="KPSS" value={position.requirements.kpssRequired===false?'Aranmıyor':(position.requirements.kpssScoreType||'Puan türü belirsiz')+' · '+(position.requirements.kpssMinimumScore??'Taban puan belirsiz')}/></Card>)}
  <Notice title="Başvurudan önce resmî koşulları kontrol et">KadroRadar temel bilgileri indeksler. Tam ilan metni ve tüm koşullar ilgili kurumun resmî sayfasındadır. Belirsiz koşullar başvuru hakkı anlamına gelmez.</Notice>
  <Card><Text style={ui.heading}>Resmî kaynak ve başvuru</Text><Fact label="Son doğrulama" value={dateTimeText(item.sourceCheckedAt)}/>{item.sourceEvidence?.kind==='OFFICIAL_GAZETTE'&&<Text style={ui.muted}>T.C. Resmî Gazete · {String(item.sourceEvidence.gazetteDate??'Tarih belirtilmemiş')} · Sayı {String(item.sourceEvidence.gazetteNumber??'Belirtilmemiş')}</Text>}<OfficialLink url={item.sourceUrl} title="Resmî duyuruyu görüntüle"/><OfficialLink url={item.applicationUrl} title="Resmî başvuru platformuna git"/>{(item.sourceReferences??[]).filter(ref=>ref.sourceUrl!==item.sourceUrl).map(ref=><OfficialLink key={ref.sourceUrl} url={ref.sourceUrl} title="Diğer resmî kaynağı incele"/>)}</Card><Independence/>
 </>}</Screen>;
}
