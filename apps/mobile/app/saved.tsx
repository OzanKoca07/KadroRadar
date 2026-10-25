import {useCallback,useState} from 'react';
import {useFocusEffect,Link} from 'expo-router';
import {FlatList,Text,Pressable,View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {accountRequest} from '../lib/account';
export default function Saved(){const [rows,setRows]=useState<any[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const load=useCallback(async()=>{setBusy(true);setError('');try{setRows(await accountRequest('/account/saved'));}catch(e){setError(String(e));}finally{setBusy(false);}},[]);
 useFocusEffect(useCallback(()=>{void load();},[load]));
 return <SafeAreaView edges={['bottom']} style={{flex:1,padding:20}}><Text style={{fontSize:26,fontWeight:'800'}}>Kaydedilenler</Text>{error?<Pressable onPress={load}><Text>{error} Tekrar dene</Text></Pressable>:<FlatList data={rows} keyExtractor={r=>r.announcementId} refreshing={busy} onRefresh={load} ListEmptyComponent={<Text>{busy?'Yükleniyor…':'Henüz kaydedilen ilan yok.'}</Text>} renderItem={({item})=><View style={{padding:16,marginVertical:8,backgroundColor:'#F3F6FB',borderRadius:12}}><Link href={{pathname:'/announcement/[id]',params:{id:item.announcementId}}}>{item.announcement.title}</Link><Text>{item.announcement.status==='WITHDRAWN'?'İlan geri çekildi':item.announcement.status}</Text><Text>Son başvuru: {item.announcement.applicationEndAt?new Date(item.announcement.applicationEndAt).toLocaleString('tr-TR',{timeZone:'Europe/Istanbul'}):'Doğrulanmamış'}</Text><Pressable onPress={async()=>{try{await accountRequest('/account/saved/'+item.announcementId,'DELETE');await load();}catch(e){setError(String(e));}}}><Text>Kaydı kaldır</Text></Pressable></View>}/>}</SafeAreaView>;
}
