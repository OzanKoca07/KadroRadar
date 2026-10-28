import {useCallback,useEffect,useRef,useState} from 'react';
import {FlatList,RefreshControl,Text,View} from 'react-native';
import {router,useLocalSearchParams} from 'expo-router';
import {historicalRequest} from '../lib/historical-api';
import {educationOptions,scoreText,errorText,type Placement} from '../lib/presentation';
import {Badge,Button,Card,Chip,EmptyState,ErrorState,Field,FilterPanel,Heading,Notice,Pagination,SkeletonCards} from '../ui/components';
import {colors,ui} from '../ui/theme';

type Round={id:string;year:number;sequenceNo:number;educationLevel:string};
type Filters={year:string;round:string;city:string;institution:string;minimum:string;maximum:string;ceilingMinimum:string;ceilingMaximum:string};
const blank:Filters={year:'',round:'',city:'',institution:'',minimum:'',maximum:'',ceilingMinimum:'',ceilingMaximum:''};
export default function Historical(){
 const params=useLocalSearchParams<{education?:string}>(),list=useRef<FlatList<Placement>>(null);
 const validEducation=(value:string|undefined)=>educationOptions.some(([key])=>key===value)?value!:'BACHELOR';
 const [education,setEducation]=useState(()=>validEducation(params.education));
 const [maxScoreSupported,setMaxScoreSupported]=useState(false);
 const [rows,setRows]=useState<Placement[]>([]),[rounds,setRounds]=useState<Round[]>([]);
 const [filters,setFilters]=useState<Filters>(blank),[draft,setDraft]=useState<Filters>(blank),[filterError,setFilterError]=useState('');
 const [query,setQuery]=useState(''),[score,setScore]=useState(''),[page,setPage]=useState(1),[total,setTotal]=useState(0),[pages,setPages]=useState(0);
 const [loading,setLoading]=useState(true),[refreshing,setRefreshing]=useState(false),[error,setError]=useState(''),[roundError,setRoundError]=useState(''),[refreshKey,setRefreshKey]=useState(0);
 useEffect(()=>{setEducation(validEducation(params.education));setPage(1);setFilters(blank);setDraft(blank);},[params.education]);
 useEffect(()=>{const controller=new AbortController();setRoundError('');historicalRequest('/historical/rounds',controller.signal).then(setRounds).catch(()=>{if(!controller.signal.aborted)setRoundError('Dönemler alınamadı. Listeyi yenileyerek tekrar deneyebilirsin.');});return()=>controller.abort();},[refreshKey]);
 useEffect(()=>{
  const controller=new AbortController();let active=true;setLoading(true);setError('');setRows([]);
  const timer=setTimeout(async()=>{try{
   const search=new URLSearchParams({page:String(page),limit:'20',educationLevel:education});
   for(const key of ['year','round','city','institution'] as const)if(filters[key])search.set(key,filters[key].trim());
   if(query.trim())search.set('title',query.trim());
   if(filters.minimum)search.set('minScoreGte',filters.minimum.replace(',','.'));
   if(filters.maximum)search.set('minScoreLte',filters.maximum.replace(',','.'));
   if(filters.ceilingMinimum)search.set('maxScoreGte',filters.ceilingMinimum.replace(',','.'));
   if(filters.ceilingMaximum)search.set('maxScoreLte',filters.ceilingMaximum.replace(',','.'));
   const result=await historicalRequest('/historical/placements?'+search,controller.signal);
   if(active){setRows(result.items);setTotal(result.total);setPages(result.pages);setMaxScoreSupported(result.filterCapabilities?.maxScoreRange===true);}
  }catch(e){if(active&&!controller.signal.aborted)setError(errorText(e));}finally{if(active){setLoading(false);setRefreshing(false);}}},300);
  return()=>{active=false;clearTimeout(timer);controller.abort();};
 },[education,filters,query,page,refreshKey]);
 const reload=useCallback(()=>{setRefreshing(true);setRefreshKey(k=>k+1);},[]);
 const changePage=(value:number)=>{setPage(value);list.current?.scrollToOffset({offset:0,animated:false});};
 const selectEducation=(value:string)=>{setEducation(value);setPage(1);setFilters(blank);setDraft(blank);};
 const apply=()=>{
  const values=[draft.minimum,draft.maximum,draft.ceilingMinimum,draft.ceilingMaximum].filter(Boolean).map(v=>Number(v.replace(',','.')));
  if(values.some(v=>!Number.isFinite(v)||v<0||v>100)||(draft.minimum&&draft.maximum&&Number(draft.minimum.replace(',','.'))>Number(draft.maximum.replace(',','.')))||(draft.ceilingMinimum&&draft.ceilingMaximum&&Number(draft.ceilingMinimum.replace(',','.'))>Number(draft.ceilingMaximum.replace(',','.')))){setFilterError('Puan aralığı 0–100 arasında, küçükten büyüğe olmalı.');return;}
  setFilterError('');setFilters({...draft});setPage(1);
 };
 const numberScore=Number(score.replace(',','.')),hasScore=score.trim()!==''&&Number.isFinite(numberScore)&&numberScore>=0&&numberScore<=100;
 return <View style={ui.root}><FlatList ref={list} data={rows} keyExtractor={item=>item.id} contentContainerStyle={ui.content} keyboardShouldPersistTaps="handled" initialNumToRender={6} windowSize={7}
  refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} tintColor={colors.primary} colors={[colors.primary]}/>}
  ListHeaderComponent={<View style={{gap:16}}>
   <Heading title="Puanları karşılaştır." description="ÖSYM yerleştirme sonuçlarını eğitim düzeyine ve döneme göre keşfet."/>
   <Field label="Kadro veya unvan ara" placeholder="Örn. mühendis, memur" value={query} onChangeText={value=>{setQuery(value);setPage(1);}} returnKeyType="search"/>
   <View style={ui.row}>{educationOptions.map(([key,label,type])=><Chip key={key} label={label+' · '+type} selected={education===key} onPress={()=>selectEducation(key)}/>)}</View>
   <FilterPanel activeCount={Object.values(filters).filter(Boolean).length}>
    <Text style={ui.heading}>Aramanı daralt</Text>
    {roundError&&<Notice>{roundError}</Notice>}
    <Text style={ui.label}>Yıl</Text><View style={ui.row}><Chip label="Tümü" selected={!draft.year} onPress={()=>setDraft({...draft,year:'',round:''})}/>{[...new Set(rounds.filter(r=>r.educationLevel===education).map(r=>r.year))].sort((a,b)=>b-a).map(year=><Chip key={year} label={String(year)} selected={draft.year===String(year)} onPress={()=>setDraft({...draft,year:String(year),round:''})}/>)}</View>
    <Text style={ui.label}>Dönem</Text><View style={ui.row}><Chip label="Tümü" selected={!draft.round} onPress={()=>setDraft({...draft,round:''})}/>{rounds.filter(r=>r.educationLevel===education&&(!draft.year||String(r.year)===draft.year)).map(r=><Chip key={r.id} label={r.year+'/'+r.sequenceNo} selected={draft.year===String(r.year)&&draft.round===String(r.sequenceNo)} onPress={()=>setDraft({...draft,year:String(r.year),round:String(r.sequenceNo)})}/>)}</View>
    <Field label="Şehir" placeholder="Tüm şehirler" value={draft.city} onChangeText={city=>setDraft({...draft,city})}/>
    <Field label="Kurum" placeholder="Kurum adı" value={draft.institution} onChangeText={institution=>setDraft({...draft,institution})}/>
    <Field label="Taban puan en az" placeholder="0–100" keyboardType="decimal-pad" value={draft.minimum} onChangeText={minimum=>setDraft({...draft,minimum})}/>
    <Field label="Taban puan en çok" placeholder="0–100" keyboardType="decimal-pad" value={draft.maximum} onChangeText={maximum=>setDraft({...draft,maximum})}/>
    {maxScoreSupported?<><Field label="Tavan puan en az" placeholder="0–100" keyboardType="decimal-pad" value={draft.ceilingMinimum} onChangeText={ceilingMinimum=>setDraft({...draft,ceilingMinimum})}/><Field label="Tavan puan en çok" placeholder="0–100" keyboardType="decimal-pad" value={draft.ceilingMaximum} onChangeText={ceilingMaximum=>setDraft({...draft,ceilingMaximum})}/></>:<Text style={ui.caption}>Bu API sürümünde tavan puan aralığı filtresi henüz desteklenmiyor. Tavan puanlarını kartlarda inceleyebilirsin.</Text>}
    <Text style={ui.caption}>Puan türü eğitim düzeyine bağlıdır. Puan aralığı geçmiş taban puanı filtreler; uygunluk sonucu üretmez.</Text>
    {!!filterError&&<Text accessibilityRole="alert" style={{color:colors.error}}>{filterError}</Text>}
   <Field label="Puanınla karşılaştır (isteğe bağlı)" placeholder="KPSS puanını gir" keyboardType="decimal-pad" value={score} onChangeText={setScore}/>
    <Button title="Filtreleri uygula" onPress={apply}/><Button title="Filtreleri temizle" variant="ghost" onPress={()=>{setDraft(blank);setFilters(blank);setFilterError('');setPage(1);}}/>
   </FilterPanel>
   <Text style={ui.caption}>Geçmiş yerleştirme verileri · Güncel ilan değildir. Puanlar yerleşme garantisi vermez.</Text>
   <View style={ui.between}><Text accessibilityLiveRegion="polite" style={ui.heading}>{loading?'Kayıtlar yükleniyor…':error?'Sonuçlar alınamadı':total.toLocaleString('tr-TR')+' kayıt'}</Text><Text style={ui.caption}>20 kayıt / sayfa</Text></View>
   {error?<ErrorState message={error} onRetry={reload}/>:loading?<SkeletonCards/>:null}
  </View>}
  ListEmptyComponent={!loading&&!error?<EmptyState title="Bu aramada kayıt yok" description="Farklı bir dönem veya daha geniş bir puan aralığı deneyebilirsin." action={{title:'Aramayı temizle',onPress:()=>{setQuery('');setFilters(blank);setDraft(blank);setPage(1);}}}/>:null}
  renderItem={({item})=>{const delta=hasScore&&item.minScore!==null?numberScore-Number(item.minScore):null;return <Card><View style={ui.between}><Badge text={item.round.year+'/'+item.round.sequenceNo}/><Text style={ui.caption}>{item.city||'Şehir belirtilmemiş'}</Text></View><Text style={ui.heading}>{item.title}</Text><Text style={ui.muted}>{item.institutionRawName}</Text><View style={ui.row}><View style={{flex:1}}><Text style={ui.caption}>Taban puan</Text><Text style={ui.metric}>{scoreText(item.minScore)}</Text></View><View style={{flex:1}}><Text style={ui.caption}>Tavan puan</Text><Text style={ui.metric}>{scoreText(item.maxScore)}</Text></View></View><Text style={ui.muted}>{item.quota} kontenjan · Kadro {item.positionCode}</Text>{delta!==null&&<Text style={ui.caption}>Puanın geçmiş taban puanın {scoreText(Math.abs(delta))} puan {delta>=0?'üzerinde':'altında'}.</Text>}<Button title="Kadro detaylarını incele" icon="arrow-forward-outline" variant="secondary" onPress={()=>router.push({pathname:'/placement/[id]',params:{id:item.id,score}})}/></Card>;}}
  ListFooterComponent={<Pagination page={page} pages={error?0:pages} loading={loading} onChange={changePage}/>}
 /></View>;
}
