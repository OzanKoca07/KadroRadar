import {useCallback,useRef,useState} from 'react';
import {useFocusEffect,router} from 'expo-router';
import {Text,FlatList,View} from 'react-native';
import {accountRequest,hasSession} from '../lib/account';
import {verifiedReferences} from '../lib/announcement-api';
import {errorText} from '../lib/presentation';
import {AuthGate,Badge,Button,Card,EmptyState,ErrorState,Heading,Notice,Pagination,SkeletonCards} from '../ui/components';
import {ui} from '../ui/theme';
type MatchItem={id:string;title:string;organization:string;positions:{id:string;title:string;outcome:string;reasons:{reason:string}[]}[]};
export default function Matches(){
 const [data,setData]=useState<{items:MatchItem[];pages:number}>({items:[],pages:0}),[page,setPage]=useState(1),[error,setError]=useState(''),[busy,setBusy]=useState(true),request=useRef(0),list=useRef<FlatList<MatchItem>>(null);
 const load=useCallback(async()=>{const current=++request.current;setBusy(true);setError('');if(!hasSession()){setBusy(false);return;}try{const result=await accountRequest('/account/matches?page='+page);const items=await verifiedReferences<MatchItem>(result.items,item=>item.id);if(current===request.current)setData({...result,items});}catch(e){if(current===request.current)setError(errorText(e));}finally{if(current===request.current)setBusy(false);}},[page]);
 useFocusEffect(useCallback(()=>{void load();return()=>{request.current++;};},[load]));
 if(!hasSession())return <AuthGate title="Bana uygun" destination="/matches" message="Kadro koşullarını karşılaştırmak için giriş yap."/>;
 return <View style={ui.root}><FlatList ref={list} data={busy||error?[]:data.items} keyExtractor={item=>item.id} refreshing={busy} onRefresh={load} contentContainerStyle={ui.content}
  ListHeaderComponent={<View style={{gap:16}}><Heading title="Bana uygun" description="Her kadro, profilindeki bilgilerle ayrı değerlendirilir. Sonucun nedenlerini tek tek inceleyebilirsin."/><Notice title="Belirsiz, uygun demek değildir">Eksik profil, doğrulanmamış bölüm kodu veya eksik ilan koşulu kesin uygunluk sayılmaz. Resmî ilanı kontrol et.</Notice><Button title={hasSession()?'Profilimi güncelle':'Giriş yap ve profilini oluştur'} variant="secondary" onPress={()=>router.push('/profile')}/>{error?<ErrorState message={error} onRetry={load}/>:busy?<SkeletonCards/>:null}</View>}
  ListEmptyComponent={!busy&&!error?<EmptyState icon="checkmark-circle-outline" title="Karşılaştırılacak ilan yok" description="Kaynağı kontrol edilebilen güncel ilanlar yayımlandığında burada kadro bazında değerlendirebilirsin." action={{title:'Güncel ilanları incele',onPress:()=>router.push('/announcements')}}/>:null}
  renderItem={({item})=><Card><Text style={ui.muted}>{item.organization}</Text><Text style={ui.heading}>{item.title}</Text>{item.positions.length===0?<Badge text="Kadro bilgisi doğrulanmamış" tone="warning"/>:item.positions.map(position=><View key={position.id} style={{gap:8}}><Text style={ui.label}>{position.title}</Text><Badge text={position.outcome==='ELIGIBLE'?'UYGUN':position.outcome==='INELIGIBLE'?'UYGUN DEĞİL':'BELİRSİZ / DOĞRULAMA GEREKLİ'} tone={position.outcome==='ELIGIBLE'?'success':'warning'}/>{position.reasons.map((reason,index)=><Text key={index} style={ui.muted}>• {reason.reason}</Text>)}</View>)}<Button title="Resmî ilan detayını incele" variant="secondary" onPress={()=>router.push({pathname:'/announcement/[id]',params:{id:item.id}})}/></Card>}
  ListFooterComponent={<Pagination page={page} pages={data.pages} loading={busy} onChange={value=>{setPage(value);list.current?.scrollToOffset({offset:0,animated:false});}}/>}
 /></View>;
}
