import {useEffect,useState} from 'react';
import {Text} from 'react-native';
import {useLocalSearchParams} from 'expo-router';
import {educationLabel,errorText,scoreText,type Placement} from '../../lib/presentation';
import {Badge,Card,ErrorState,Fact,Heading,Independence,Notice,OfficialLink,Screen,SkeletonCards} from '../../ui/components';
import {ui} from '../../ui/theme';
export default function PlacementDetails(){
 const {id,score}=useLocalSearchParams<{id:string;score?:string}>();
 const [item,setItem]=useState<Placement|null>(null),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 useEffect(()=>{const controller=new AbortController();let active=true;setItem(null);setError('');const timer=setTimeout(()=>controller.abort(),15000);
  const base=process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/,'');
  Promise.resolve().then(async()=>{if(!base)throw Error('API adresi yapılandırılmamış.');if(!id)throw Error('Kadro bulunamadı.');const response=await fetch(base+'/historical/placements/'+encodeURIComponent(id),{signal:controller.signal});if(!response.ok)throw Error(response.status===404?'Kayıt bulunamadı veya henüz onaylanmamış.':'Kayıt yüklenemedi.');const data=await response.json();if(active)setItem(data);}).catch(e=>{if(active)setError(controller.signal.aborted?'İstek zaman aşımına uğradı.':errorText(e));}).finally(()=>clearTimeout(timer));
  return()=>{active=false;clearTimeout(timer);controller.abort();};
 },[id,retry]);
 const number=Number(score?.replace(',','.')),delta=item?.minScore!=null&&score?.trim()&&Number.isFinite(number)&&number>=0&&number<=100?number-Number(item.minScore):null;
 return <Screen>{error?<ErrorState message={error} onRetry={()=>setRetry(k=>k+1)}/>:!item?<SkeletonCards/>:<>
  <Badge text={'ÖSYM · '+item.round.year+'/'+item.round.sequenceNo+' · '+educationLabel(item.round.educationLevel)}/>
  <Heading title={item.title} description={item.institutionRawName}/>
  <Card><Text style={ui.heading}>Yerleştirme bilgileri</Text>{[['Kadro kodu',item.positionCode],['Şehir',item.city||'Belirtilmemiş'],['Kontenjan',item.quota],['Yerleşen',item.placedCount],['Boş kontenjan',item.vacantCount],['Taban puan',scoreText(item.minScore)],['Tavan puan',scoreText(item.maxScore)]].map(([label,value])=><Fact key={String(label)} label={String(label)} value={value}/>)}</Card>
  {delta!==null&&<Card><Text style={ui.heading}>Puan karşılaştırman</Text><Text style={ui.metric}>{scoreText(number)}</Text><Text style={ui.muted}>Geçmiş taban puanın {scoreText(Math.abs(delta))} puan {delta>=0?'üzerinde':'altında'}.</Text></Card>}
  <Notice title="Nitelik kodları doğrulanmamış">Geçmiş puanlar yerleşme garantisi değildir. Nitelik kodları doğrulanmadan uygunluk sonucu verilmez.</Notice>
  <Card><Text style={ui.heading}>Kaynak bilgisi</Text><Text style={ui.body}>{item.sourceDocument.sourceOrganization}</Text><Text style={ui.caption}>{item.sourceDocument.originalFilename} · PDF sayfa {item.sourcePage}</Text><OfficialLink url={item.sourceDocument.originalUrl} title="ÖSYM kaynak belgesine git"/></Card><Independence/>
 </>}</Screen>;
}
