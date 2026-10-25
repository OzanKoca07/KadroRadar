import { useEffect, useState } from 'react';
import { Link } from 'expo-router';
import { FlatList, Text, TextInput, Pressable, View, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function Announcements() {
  const [archive, setArchive] = useState(false);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [reload, setReload] = useState(0);
  const [data, setData] = useState<{items: any[]; pages: number}>({items: [], pages: 0});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setLoading(true); setError('');
    const timer = setTimeout(() => controller.abort(), 15000);
    const base = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '');
    Promise.resolve().then(async () => {
      if (!base) throw new Error('API adresi yapılandırılmamış.');
      const response = await fetch(`${base}/announcements?view=${archive ? 'archive' : 'open'}&q=${encodeURIComponent(q)}&page=${page}`, {signal: controller.signal});
      if (!response.ok) throw new Error('İlanlar yüklenemedi.');
      const result = await response.json();
      if (!Array.isArray(result.items)) throw new Error('Geçersiz API yanıtı.');
      if (active) setData(result);
    }).catch(e => { if (active) setError(e.name === 'AbortError' ? 'İstek zaman aşımına uğradı.' : e.message); })
      .finally(() => { clearTimeout(timer); if (active) setLoading(false); });
    return () => { active = false; clearTimeout(timer); controller.abort(); };
  }, [archive, q, page, reload]);
  const button = (label: string, action: () => void) => <Pressable accessibilityRole="button" onPress={action} style={{padding: 14}}><Text style={{color: '#2855AB'}}>{label}</Text></Pressable>;
  return <SafeAreaView edges={['bottom']} style={{flex: 1, backgroundColor: '#F3F6FB', padding: 16}}>
    <Text style={{fontSize: 26, fontWeight: '800'}}>Kamu İlanları</Text>
    {button(archive ? 'Güncel ilanlara geç' : 'Geçmiş ilan arşivi', () => {setArchive(!archive); setPage(1);})}
    <TextInput accessibilityLabel="İlan ara" placeholder="Kurum, başlık veya kadro ara" value={q} onChangeText={value => {setQ(value); setPage(1);}} style={{backgroundColor: 'white', padding: 14, borderRadius: 12}} />
    {loading && <ActivityIndicator accessibilityLabel="Yükleniyor" />}
    {error ? <View><Text accessibilityRole="alert">{error}</Text>{button('Tekrar dene', () => setReload(reload + 1))}</View> : <FlatList
      data={loading ? [] : data.items} keyExtractor={item => item.id} refreshing={loading} onRefresh={() => setReload(reload + 1)}
      ListEmptyComponent={!loading ? <Text style={{padding: 20}}>Bu görünümde yayımlanmış ilan bulunmuyor.</Text> : null}
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
