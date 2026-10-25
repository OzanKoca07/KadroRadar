import { useEffect, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Linking, Pressable, ScrollView, Text } from 'react-native';
import {accountRequest} from '../../lib/account';
import {official} from '../../lib/official';

export default function Detail() {
  const {id} = useLocalSearchParams<{id: string}>();
  const [item, setItem] = useState<any>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [matches,setMatches]=useState<any>(null);
  const [accountMessage,setAccountMessage]=useState('');
  useEffect(() => {
    const controller = new AbortController(); let active = true;
    setError(''); setItem(null);
    const timer = setTimeout(() => controller.abort(), 15000);
    fetch(`${process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '')}/announcements/${encodeURIComponent(id)}`, {signal: controller.signal})
      .then(async r => {if (!r.ok) throw new Error('İlan yüklenemedi'); return r.json();})
      .then(value => {if (active) setItem(value);}).catch(() => {if (active) setError('İlan yüklenemedi. Bağlantınızı kontrol edin.');}).finally(() => clearTimeout(timer));
    return () => {active = false; clearTimeout(timer); controller.abort();};
  }, [id, retry]);
  return <ScrollView contentContainerStyle={{padding: 24, gap: 16}}>
    {error ? <Pressable accessibilityRole="button" onPress={() => setRetry(retry + 1)}><Text>{error} Tekrar dene</Text></Pressable> : !item ? <ActivityIndicator /> : <>
      <Text style={{fontSize: 25, fontWeight: '800'}}>{item.title}</Text><Text>{item.organization}</Text>
      {item.sourceEvidence?.kind==='OFFICIAL_GAZETTE'&&<Text>Kaynak: T.C. Resmî Gazete · {item.sourceEvidence.gazetteDate} · Sayı {item.sourceEvidence.gazetteNumber}{'\n'}Sayfa {item.sourceEvidence.pageStart}–{item.sourceEvidence.pageEnd}{'\n'}PDF SHA-256: {item.sourceEvidence.pdfSha256}{!item.sourceUrl?'\nÇevrimiçi kaynak bağlantısı doğrulanmamış; belge bilgileri kaynak referansıdır.':''}</Text>}
      {item.sourceEvidence?.dateSuggestions?.length>0&&<Text>Kaynakta görülen başvuru dönemi (kesin saatler doğrulanmalı):{'\n'}{item.sourceEvidence.dateSuggestions.map((entry:any)=>`Sayfa ${entry.page}: ${entry.text}`).join('\n')}</Text>}
      <Pressable accessibilityRole="button" onPress={async()=>{try{await accountRequest('/account/saved/'+encodeURIComponent(id),'PUT',{});setAccountMessage('İlan kaydedildi.');}catch(e){setAccountMessage(String(e));}}}><Text style={{color:'#2855AB'}}>İlanı kaydet</Text></Pressable>
      <Pressable accessibilityRole="button" onPress={async()=>{try{setMatches(await accountRequest('/account/matches/'+encodeURIComponent(id)));}catch(e){setAccountMessage(String(e));}}}><Text style={{color:'#2855AB'}}>Kadroları profilimle karşılaştır</Text></Pressable>
      <Text accessibilityRole="alert">{accountMessage}</Text>
      {matches && <><Text>{matches.emptyReason}</Text>{matches.items.map((position:any)=><Text key={position.positionId}>{position.title}: {({ELIGIBLE:'UYGUN',INELIGIBLE:'UYGUN DEĞİL',UNKNOWN:'BELİRSİZ / DOĞRULAMA GEREKLİ'} as any)[position.outcome]}{'\n'}{position.reasons.map((reason:any)=>reason.reason).join('\n')}</Text>)}</>}
      {['positionTitle', 'city', 'educationLevel', 'summary', 'requirements'].map(key => item[key] ? <Text key={key}>{item[key]}</Text> : null)}
      {(item.positions??[]).map((position:any)=><Text key={position.id}>{position.title} · {position.city??'Şehir belirtilmemiş'} · Kontenjan: {position.quota??'Belirtilmemiş'}{'\n'}{position.verifiedAt?'Kadro kaynaktan kontrol edilmiş.':'Kadro koşulları doğrulanmamış.'}{'\n'}Eğitim: {position.requirements.educationLevels?.join(', ')??'Belirtilmemiş'}{'\n'}KPSS: {position.requirements.kpssRequired===false?'Aranmıyor':`${position.requirements.kpssScoreType??'Puan türü belirsiz'} · ${position.requirements.kpssMinimumScore??'Taban puan belirsiz'}`}</Text>)}
      <Text>Başlangıç: {item.applicationStartAt?new Date(item.applicationStartAt).toLocaleString('tr-TR',{timeZone:'Europe/Istanbul'}):'Doğrulanmamış'}{'\n'}Bitiş: {item.applicationEndAt?new Date(item.applicationEndAt).toLocaleString('tr-TR',{timeZone:'Europe/Istanbul'}):'Doğrulanmamış'}</Text>
      <Text>Son doğrulama: {item.sourceCheckedAt ? new Date(item.sourceCheckedAt).toLocaleString('tr-TR', {timeZone: 'Europe/Istanbul'}) : 'Doğrulanmamış'}</Text>
      {(['sourceUrl', 'applicationUrl'] as const).map(key => item[key] && official(item[key]) ? <Pressable key={key} accessibilityRole="link" onPress={() => Linking.openURL(item[key]).catch(() => setError('Bağlantı açılamadı.'))}><Text style={{color: '#2855AB'}}>{key === 'sourceUrl' ? 'Resmî duyuruyu görüntüle' : 'Resmî başvuru platformuna git'}{ '\n'}{item[key]}</Text></Pressable> : null)}
      <Text>KadroRadar herhangi bir kamu kurumunun resmî uygulaması değildir. Başvurular ilgili kurumların resmî platformlarından yapılır.</Text>
    </>}
  </ScrollView>;
}
