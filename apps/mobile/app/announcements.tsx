import {useEffect,useRef,useState} from 'react';
import {FlatList,Text,View} from 'react-native';
import {router} from 'expo-router';
import {announcementRequest} from '../lib/announcement-api';
import {announcementStatus,dateText,errorText,type Announcement} from '../lib/presentation';
import {Badge,Button,Card,Chip,EmptyState,ErrorState,Field,FilterPanel,Heading,Independence,Notice,OfficialLink,Pagination,SkeletonCards} from '../ui/components';
import {ui} from '../ui/theme';
import {CareerSourceCard} from '../ui/career-source-card';
import {careerCategoryLabels} from '../lib/career-card';
export default function Announcements(){
 const list=useRef<FlatList<Announcement>>(null);
 const [view,setView]=useState('open'),[q,setQ]=useState(''),[page,setPage]=useState(1),[reload,setReload]=useState(0);
 const [filters,setFilters]=useState<Record<string,string>>({}),[draft,setDraft]=useState<Record<string,string>>({});
 const [data,setData]=useState<{items:Announcement[];pages:number}>({items:[],pages:0}),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const filter=(key:string,value:string)=>setDraft(current=>({...current,[key]:value,...(key==='kpssRequired'&&value==='false'?{kpssScore:'',kpssScoreType:''}:{}),...(['kpssScore','kpssScoreType'].includes(key)&&value?{kpssRequired:'true'}:{})}));
 useEffect(()=>{const controller=new AbortController();let active=true;setLoading(true);setError('');setData({items:[],pages:0});
  const timer=setTimeout(async()=>{try{const search=new URLSearchParams({view,q,page:String(page),limit:'20'});for(const [key,value] of Object.entries(filters))if(value.trim())search.set(key,value.trim());const result=await announcementRequest('/announcements?'+search,controller.signal);if(active)setData(result);}catch(e){if(active&&!controller.signal.aborted)setError(errorText(e));}finally{if(active)setLoading(false);}},300);
  return()=>{active=false;controller.abort();clearTimeout(timer);};
 },[view,q,page,reload,filters]);
 const options=(label:string,key:string,values:string[][])=><View style={{gap:8}}><Text style={ui.label}>{label}</Text><View style={ui.row}>{values.map(([value,title])=><Chip key={value} label={title} selected={(draft[key]||'')===value} onPress={()=>filter(key,value)}/>)}</View></View>;
 return <View style={ui.root}><FlatList ref={list} data={data.items} keyExtractor={item=>item.id} contentContainerStyle={ui.content} keyboardShouldPersistTaps="handled" refreshing={loading} onRefresh={()=>setReload(k=>k+1)} initialNumToRender={6}
  ListHeaderComponent={<View style={{gap:16}}>
   <View style={ui.row}>{[['open','Güncel'],['upcoming','Yakında'],['archive','Arşiv']].map(([value,label])=><Chip key={value} label={label} selected={view===value} onPress={()=>{setView(value);setPage(1);}}/>)}</View>
   <Field label="İlan ara" placeholder="Kurum, unvan veya kadro" value={q} onChangeText={value=>{setQ(value);setPage(1);}} returnKeyType="search"/>
   <FilterPanel activeCount={Object.values(filters).filter(Boolean).length}>
    <Text style={ui.heading}>İlan filtreleri</Text>
    {options('Eğitim düzeyi','educationLevel',[['','Tümü'],['LISANS','Lisans'],['ONLISANS','Önlisans'],['ORTAOGRETIM','Ortaöğretim']])}
    {options('KPSS şartı','kpssRequired',[['','Tümü'],['true','Gerekli'],['false','Aranmıyor · doğrulanmış']])}
    {options('Puan türü','kpssScoreType',[['','Tümü'],['P3','P3'],['P93','P93'],['P94','P94']])}
    {options('İstihdam türü','employmentType',[['','Tümü'],['CIVIL_SERVANT','Memur'],['CONTRACTED','Sözleşmeli'],['WORKER','İşçi'],['ACADEMIC','Akademik']])}
    {[['kpssScore','KPSS puanın'],['degreeCode','Doğrulanmış bölüm kodu'],['city','Şehir'],['organization','Kurum'],['positionTitle','Kadro unvanı'],['deadlineBefore','Son başvuru en geç (YYYY-AA-GG)']].map(([key,label])=><Field key={key} label={label} value={draft[key]||''} onChangeText={value=>filter(key,value)} keyboardType={key==='kpssScore'?'decimal-pad':'default'}/>)}
    <Notice>Filtre sonuçları uygunluk kararı değildir. Belirsiz koşullar doğrulanmış kabul edilmez.</Notice>
    <Button title="Filtreleri uygula" onPress={()=>{setFilters({...draft});setPage(1);}}/><Button title="Temizle" variant="ghost" onPress={()=>{setDraft({});setFilters({});setPage(1);}}/>
   </FilterPanel>
   {error?<ErrorState message={error} onRetry={()=>setReload(k=>k+1)}/>:loading?<SkeletonCards/>:null}
  </View>}
  ListEmptyComponent={!loading&&!error?<EmptyState title={view==='archive'?'Arşivde ilan bulunmuyor.':view==='upcoming'?'Yakında başlayacak ilan bulunmuyor.':'Şu anda yayımlanmış ilan bulunmuyor.'} action={{title:'Geçmiş atamaları incele',onPress:()=>router.push('/historical')}}/>:null}
  renderItem={({item})=>process.env.EXPO_PUBLIC_CAREER_CARD_ENABLED==='true'&&item.sourceEvidence?.sourceId==='career'&&item.sourceEvidence?.categoryCode==='PERSONNEL'?<CareerSourceCard item={item}/>:<Card><Badge text={announcementStatus(item)} tone={announcementStatus(item)==='Başvuru açık'?'success':'neutral'}/><Text style={ui.muted}>{item.organization}</Text><Text style={ui.heading}>{item.title}</Text>{item.sourceEvidence?.sourceId==='career'&&<><Text style={ui.caption}>{careerCategoryLabels[String(item.sourceEvidence.categoryCode)]||'Duyuru'}</Text><Text style={ui.caption}>Yayın · {dateText(item.announcedAt)}</Text></>}<Text style={ui.body}>{item.positionTitle||'Kadro bilgisi detayda'} · {item.city||'Şehir belirtilmemiş'}</Text><Text style={ui.muted}>Kontenjan: {item.quota??'Belirtilmemiş'}</Text><Text style={ui.label}>Son başvuru · {dateText(item.applicationEndAt)}</Text><Button title="İlanı incele" icon="arrow-forward-outline" onPress={()=>router.push({pathname:'/announcement/[id]',params:{id:item.id}})}/><OfficialLink url={item.sourceUrl}/></Card>}
  ListFooterComponent={<View style={{gap:12}}><Pagination page={page} pages={data.pages} loading={loading} onChange={value=>{setPage(value);list.current?.scrollToOffset({offset:0,animated:false});}}/><Independence/></View>}
 /></View>;
}
