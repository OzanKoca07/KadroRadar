import {useState,useCallback,useRef} from 'react';
import {useFocusEffect,router} from 'expo-router';
import {FlatList,Text,View} from 'react-native';
import {accountRequest,hasSession} from '../lib/account';
import {verifiedReferences} from '../lib/announcement-api';
import {dateText,errorText} from '../lib/presentation';
import {AuthGate,Button,Card,EmptyState,ErrorState,Heading,SkeletonCards} from '../ui/components';
import {ui} from '../ui/theme';
type Notification={id:string;announcementId:string;title:string;createdAt:string;status:string};
export default function Inbox(){
 const [rows,setRows]=useState<Notification[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(true),request=useRef(0);
 const load=useCallback(async()=>{const current=++request.current;setBusy(true);setError('');if(!hasSession()){setBusy(false);return;}try{await accountRequest('/account/notifications/refresh','POST',{});const result=await accountRequest('/account/notifications');const allowed=await verifiedReferences<Notification>(result,item=>item.announcementId);if(current===request.current)setRows(allowed);}catch(e){if(current===request.current)setError(errorText(e));}finally{if(current===request.current)setBusy(false);}},[]);
 useFocusEffect(useCallback(()=>{void load();return()=>{request.current++;};},[load]));
 if(!hasSession())return <AuthGate title="Bildirimler" destination="/notifications" message="Bildirimlerini görmek için giriş yap."/>;
 return <View style={ui.root}><FlatList data={busy||error?[]:rows} keyExtractor={item=>item.id} contentContainerStyle={ui.content} refreshing={busy} onRefresh={load}
  ListHeaderComponent={<View style={{gap:16}}><Heading title="Bildirimler" description="Kaynağı kontrol edilebilen ilan güncellemeleri burada. Bildirim iznin ve tercihlerin kontrolün altında."/><Button title="Bildirim tercihlerimi yönet" variant="secondary" onPress={()=>router.push('/profile')}/>{error?<ErrorState message={error} onRetry={load}/>:busy?<SkeletonCards/>:null}</View>}
  ListEmptyComponent={!busy&&!error?<EmptyState icon="notifications-outline" title="Bildirim yok" description="Yeni bildirimler burada yer alacak. İzinlerini Profil ekranından yönetebilirsin."/>:null}
  renderItem={({item})=><Card><Text style={ui.caption}>{dateText(item.createdAt)}</Text><Text style={ui.heading}>{item.title}</Text><Text style={ui.muted}>{item.status==='PROVIDER_ACCEPTED'?'Sağlayıcıya iletildi':item.status==='ACCEPTED'?'Gönderim kuyruğunda':'Uygulama içi güncelleme'}</Text><Button title="İlanı incele" variant="secondary" onPress={()=>router.push({pathname:'/announcement/[id]',params:{id:item.announcementId}})}/></Card>}
 /></View>;
}
