import {useState,useCallback} from 'react';
import {useFocusEffect,Link} from 'expo-router';
import {FlatList,Text,Pressable,View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {accountRequest} from '../lib/account';
export default function Inbox(){const [rows,setRows]=useState<any[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const load=useCallback(async()=>{setBusy(true);setError('');try{await accountRequest('/account/notifications/refresh','POST',{});setRows(await accountRequest('/account/notifications'));}catch(e){setError(String(e));}finally{setBusy(false);}},[]);useFocusEffect(useCallback(()=>{void load();},[load]));
 return <SafeAreaView edges={['bottom']} style={{flex:1,padding:20}}><Text style={{fontSize:26,fontWeight:'800'}}>Bildirimler</Text>{error?<Pressable onPress={load}><Text>{error} Tekrar dene</Text></Pressable>:<FlatList refreshing={busy} onRefresh={load} data={rows} keyExtractor={r=>r.id} ListEmptyComponent={<Text>Henüz bildirim yok. İzin ve tercihlerinizi Profil ekranından yönetin.</Text>} renderItem={({item})=><View style={{padding:16}}><Link href={{pathname:'/announcement/[id]',params:{id:item.announcementId}}}>{item.title}</Link><Text>{new Date(item.createdAt).toLocaleString('tr-TR')} · {item.status==='PROVIDER_ACCEPTED'?'Bildirim sağlayıcısı kabul etti':item.status==='ACCEPTED'?'Gönderim kuyruğunda':'Uygulama içi kayıt'}</Text></View>}/>}</SafeAreaView>;
}
