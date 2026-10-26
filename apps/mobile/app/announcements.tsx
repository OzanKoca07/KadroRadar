import { useEffect, useState } from 'react';
import { Link } from 'expo-router';
import { FlatList, Text, TextInput, Pressable, View, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {announcementRequest} from '../lib/announcement-api';

export default function Announcements() {
  const [archive, setArchive] = useState(false);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [reload, setReload] = useState(0);
  const [showFilters,setShowFilters]=useState(false);
  const [filters,setFilters]=useState<Record<string,string>>({});
  const [draftFilters,setDraftFilters]=useState<Record<string,string>>({});
  function filter(key:string,value:string){setDraftFilters(current=>({...current,[key]:value,...(key==='kpssRequired'&&value==='false'?{kpssScore:'',kpssScoreType:''}:{}),...(['kpssScore','kpssScoreType'].includes(key)&&value?{kpssRequired:'true'}:{})}));}
  const [data, setData] = useState<{items: any[]; pages: number}>({items: [], pages: 0});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setLoading(true); setError('');setData({items:[],pages:0});
    Promise.resolve().then(async () => {
      const extra=Object.entries(filters).filter(([key,v])=>key!=='applicationView'&&v.trim()).map(([k,v])=>`${k}=${encodeURIComponent(v.trim())}`).join('&');
      const result = await announcementRequest(`/announcements?view=${archive ? 'archive' : filters.applicationView||'open'}&q=${encodeURIComponent(q)}&page=${page}&${extra}`,controller.signal);
      if (active) setData(result);
    }).catch(e => { if (active) setError(e.name === 'AbortError' ? 'İstek zaman aşımına uğradı.' : e.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [archive, q, page, reload,filters]);
  const button = (label: string, action: () => void) => <Pressable accessibilityRole="button" onPress={action} style={{padding: 14}}><Text style={{color: '#2855AB'}}>{label}</Text></Pressable>;
  return <SafeAreaView edges={['bottom']} style={{flex: 1, backgroundColor: '#F3F6FB', padding: 16}}>
    <Text style={{fontSize: 26, fontWeight: '800'}}>Kamu İlanları</Text>
    {button(archive ? 'Güncel ilanlara geç' : 'Geçmiş ilan arşivi', () => {setArchive(!archive); setPage(1);})}
    <TextInput accessibilityLabel="İlan ara" placeholder="Kurum, başlık veya kadro ara" value={q} onChangeText={value => {setQ(value); setPage(1);}} style={{backgroundColor: 'white', padding: 14, borderRadius: 12}} />
    {button(showFilters?'Filtreleri gizle':'Kadro ve başvuru filtreleri',()=>setShowFilters(!showFilters))}
    {loading && <ActivityIndicator accessibilityLabel="Yükleniyor" />}
    {error && <View><Text accessibilityRole="alert">{error}</Text>{button('Tekrar dene', () => setReload(reload + 1))}</View>}{<FlatList
      data={loading || error ? [] : data.items} keyExtractor={item => item.id} refreshing={loading} onRefresh={() => setReload(reload + 1)}
      ListHeaderComponent={showFilters?<View style={{gap:8,padding:8}}>
        <Text>Başvuru durumu</Text><View style={{flexDirection:'row',flexWrap:'wrap'}}>{[['open','Başvurusu açık'],['upcoming','Yakında'],['date-unverified','Tarihi doğrulanmamış'],['all','Tüm yayımlananlar']].map(([value,label])=><Pressable key={value} accessibilityRole="button" accessibilityState={{selected:(draftFilters.applicationView||'open')===value}} onPress={()=>filter('applicationView',value)} style={{padding:10}}><Text>{label}</Text></Pressable>)}</View>
        <Text>KPSS şartı</Text><View style={{flexDirection:'row'}}>{[['','Tümü'],['true','KPSS gerekli'],['false',"KPSS’siz (doğrulanmış)"]].map(([value,label])=><Pressable key={value} accessibilityRole="button" accessibilityState={{selected:(draftFilters.kpssRequired||'')===value}} onPress={()=>filter('kpssRequired',value)} style={{padding:10}}><Text>{label}</Text></Pressable>)}</View>
        <Text>İstihdam türü</Text><View style={{flexDirection:'row',flexWrap:'wrap'}}>{[['','Tümü'],['CIVIL_SERVANT','Memur'],['CONTRACTED','Sözleşmeli'],['WORKER','İşçi'],['ACADEMIC','Akademik']].map(([value,label])=><Pressable key={value} accessibilityRole="button" accessibilityState={{selected:(draftFilters.employmentType||'')===value}} onPress={()=>filter('employmentType',value)} style={{padding:10}}><Text>{label}</Text></Pressable>)}</View>
        <Text>Eğitim düzeyi</Text><View style={{flexDirection:'row',flexWrap:'wrap'}}>{[['','Tümü'],['LISANS','Lisans'],['ONLISANS','Önlisans'],['ORTAOGRETIM','Ortaöğretim']].map(([value,label])=><Pressable key={value} accessibilityRole="button" accessibilityState={{selected:(draftFilters.educationLevel||'')===value}} onPress={()=>filter('educationLevel',value)} style={{padding:10,backgroundColor:(draftFilters.educationLevel||'')===value?'#DCE8FF':'white'}}><Text>{label}</Text></Pressable>)}</View>
        <Text>KPSS puan türü</Text><View style={{flexDirection:'row'}}>{['','P3','P93','P94'].map(value=><Pressable key={value} accessibilityRole="button" accessibilityState={{selected:(draftFilters.kpssScoreType||'')===value}} onPress={()=>filter('kpssScoreType',value)} style={{padding:10,backgroundColor:(draftFilters.kpssScoreType||'')===value?'#DCE8FF':'white'}}><Text>{value||'Tümü'}</Text></Pressable>)}</View>
        {[['kpssScore','KPSS puanınız'],['degreeCode','Doğrulanmış mezuniyet bölüm kodu'],['city','Şehir'],['organization','Kurum'],['positionTitle','Kadro unvanı'],['deadlineBefore','Son başvuru en geç (YYYY-AA-GG)']].map(([key,label])=><TextInput key={key} accessibilityLabel={label} placeholder={label} value={draftFilters[key]||''} onChangeText={value=>filter(key,value)} keyboardType={key==='kpssScore'?'decimal-pad':'default'} style={{backgroundColor:'white',padding:12,borderRadius:8}}/>)}
        <Text>Filtreler uygunluk kararı değildir. Eksik veya doğrulanmamış bölüm şartları eşleşme sayılmaz.</Text>{button('Filtreleri uygula',()=>{setFilters({...draftFilters});setPage(1);})}{button('Filtreleri temizle',()=>{setDraftFilters({});setFilters({});setPage(1);})}
      </View>:null}
      ListEmptyComponent={!loading && !error ? <Text style={{padding: 20}}>Bu görünümde yayımlanmış ilan bulunmuyor.</Text> : null}
      renderItem={({item}) => <View style={{backgroundColor: 'white', padding: 18, marginTop: 12, borderRadius: 14}}>
        <Text style={{color: '#50627D'}}>{item.organization}</Text><Text style={{fontSize: 18, fontWeight: '700', marginVertical: 8}}>{item.title}</Text>
        <Text>{item.city || 'Şehir belirtilmemiş'} · {item.positionTitle || 'Kadro belirtilmemiş'}</Text>
        <Text>Kontenjan: {item.quota ?? 'Belirtilmemiş'}</Text>
        <Text>Son başvuru: {item.applicationEndAt ? new Date(item.applicationEndAt).toLocaleString('tr-TR', {timeZone: 'Europe/Istanbul'}) : 'Doğrulanmamış'}</Text>
        <Link href={{pathname: '/announcement/[id]', params: {id: item.id}}} style={{paddingVertical: 12, color: '#2855AB'}}>İlan detayları →</Link>
      </View>} />}
    <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>{page > 1 && button('Önceki', () => setPage(page - 1))}<Text>Sayfa {page}</Text>{page < data.pages && button('Sonraki', () => setPage(page + 1))}</View>
    <Text style={{fontSize: 11, color: '#50627D'}}>KadroRadar bağımsız bir kamu kariyer bilgilendirme uygulamasıdır. Herhangi bir kamu kurumunun resmî uygulaması değildir. Başvurular ilgili kurumların resmî platformlarından yapılır.</Text>
  </SafeAreaView>;
}
