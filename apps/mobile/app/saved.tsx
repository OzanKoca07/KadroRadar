import {useCallback,useRef,useState} from 'react';
import {useFocusEffect,router} from 'expo-router';
import {FlatList,Text,View} from 'react-native';
import {accountRequest,hasSession} from '../lib/account';
import {publicItems} from '../lib/source-policy';
import {announcementStatus,dateText,errorText,type Announcement} from '../lib/presentation';
import {Badge,Button,Card,EmptyState,ErrorState,Heading,SkeletonCards} from '../ui/components';
import {ui} from '../ui/theme';
type SavedRow={announcementId:string;announcement:Announcement};
export default function Saved(){
 const [rows,setRows]=useState<SavedRow[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(true),[removing,setRemoving]=useState(''),request=useRef(0);
 const load=useCallback(async()=>{const current=++request.current;setBusy(true);setError('');try{const result=await accountRequest('/account/saved');if(current===request.current)setRows(publicItems(result));}catch(e){if(current===request.current)setError(errorText(e));}finally{if(current===request.current)setBusy(false);}},[]);
 useFocusEffect(useCallback(()=>{void load();return()=>{request.current++;};},[load]));
 return <View style={ui.root}><FlatList data={busy||error?[]:rows} keyExtractor={r=>r.announcementId} contentContainerStyle={ui.content} refreshing={busy} onRefresh={load}
  ListHeaderComponent={<View style={{gap:16}}><Heading title="Aklındaki fırsatlar, bir arada." description="Kaydettiğin ilanların son başvuru tarihlerini ve güncel durumlarını takip et."/>{error?<ErrorState message={error} onRetry={load}/>:busy?<SkeletonCards/>:null}{!hasSession()&&<Button title="Profilimden giriş yap" onPress={()=>router.push('/profile')} variant="secondary"/>}</View>}
  ListEmptyComponent={!busy&&!error?<EmptyState icon="bookmark-outline" title="İlk ilanını kaydet" description="İlan detayındaki kaydet düğmesiyle ilgilendiğin fırsatları burada toplayabilirsin." action={{title:'İlanları keşfet',onPress:()=>router.push('/announcements')}}/>:null}
  renderItem={({item})=><Card><Badge text={announcementStatus(item.announcement)}/><Text style={ui.muted}>{item.announcement.organization}</Text><Text style={ui.heading}>{item.announcement.title}</Text><Text style={ui.label}>Son başvuru · {dateText(item.announcement.applicationEndAt)}</Text><Button title="İlanı incele" variant="secondary" onPress={()=>router.push({pathname:'/announcement/[id]',params:{id:item.announcementId}})}/><Button title="Kaydı kaldır" icon="bookmark-outline" variant="ghost" busy={removing===item.announcementId} disabled={!!removing} onPress={()=>{setRemoving(item.announcementId);void accountRequest('/account/saved/'+encodeURIComponent(item.announcementId),'DELETE').then(load).catch(e=>setError(errorText(e))).finally(()=>setRemoving(''));}}/></Card>}
 /></View>;
}
