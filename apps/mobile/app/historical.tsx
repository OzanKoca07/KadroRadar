import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';

type Placement = { id: string; positionCode: string; title: string; institutionRawName: string; city: string | null; minScore: string | null; maxScore: string | null; quota: number; placedCount: number; vacantCount: number; round: { year: number; sequenceNo: number; educationLevel: string } };
type ApiPage = { items: Placement[]; total: number; page: number; pages: number; qualificationNote: string };
type Round = { id: string; year: number; sequenceNo: number; educationLevel: string };
const BASE = process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:3000/api/v1';
const showScore = (v: string | null) => v == null ? '—' : Number(v).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 5 });

export default function Historical() {
  const [rows, setRows] = useState<Placement[]>([]);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [selected, setSelected] = useState<Round | null>(null);
  const [query, setQuery] = useState('');
  const [city, setCity] = useState('');
  const [score, setScore] = useState('83,50');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let alive = true;
    fetch(`${BASE}/historical/rounds`).then(async r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((data: Round[]) => { if (alive) setRounds(data); })
      .catch(() => { if (alive) setError('Dönem bilgileri alınamadı. İnternet bağlantını kontrol et.'); });
    return () => { alive = false; };
  }, [refreshKey]);

  useEffect(() => { setPage(1); }, [query, city, selected?.id]);
  useEffect(() => {
    let alive = true;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true); setError('');
      try {
        const params = new URLSearchParams({ page: String(page), limit: '20', educationLevel: selected?.educationLevel || 'BACHELOR' });
        if (selected) { params.set('year', String(selected.year)); params.set('round', String(selected.sequenceNo)); }
        if (query.trim()) params.set('title', query.trim());
        if (city.trim()) params.set('city', city.trim());
        const res = await fetch(`${BASE}/historical/placements?${params.toString()}`, { signal: controller.signal });
        if (!res.ok) throw new Error(`Sunucu hatası (${res.status})`);
        const body: ApiPage = await res.json();
        if (alive) { setRows(body.items); setTotal(body.total); setPages(body.pages); }
      } catch (e) {
        if (alive && !controller.signal.aborted) setError(e instanceof Error ? e.message : 'Veriler yüklenemedi');
      } finally { if (alive) { setLoading(false); setRefreshing(false); } }
    }, 300);
    return () => { alive = false; clearTimeout(timer); controller.abort(); };
  }, [page, query, city, selected?.id, refreshKey]);

  const parsedScore = Number(score.replace(',', '.'));
  const hasScore = score.trim() !== '' && Number.isFinite(parsedScore) && parsedScore >= 0 && parsedScore <= 100;
  const reload = useCallback(() => { setRefreshing(true); setRefreshKey(k => k + 1); }, []);

  return <SafeAreaView style={styles.root}>
    <FlatList
      data={rows}
      keyExtractor={x => x.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} />}
      ListHeaderComponent={<View>
        <Text style={styles.eyebrow}>KADRORADAR / RESMÎ GEÇMİŞ VERİLER</Text>
        <Text style={styles.heading}>Geçmiş Atamalar</Text>
        <Text style={styles.sub}>ÖSYM yerleştirme sonuçlarını incele, kendi puanınla karşılaştır.</Text>
        <View style={styles.form}>
          <Text style={styles.fieldTitle}>KPSS puanın (karşılaştırma için)</Text>
          <TextInput style={styles.input} value={score} onChangeText={setScore} keyboardType="decimal-pad" placeholder="Örn. 83,50" accessibilityLabel="KPSS puanın" />
          <Text style={styles.fieldTitle}>Dönem</Text>
          <View style={styles.chips}>
            <Pressable onPress={() => setSelected(null)} style={[styles.chip, !selected && styles.chipActive]}><Text style={[styles.chipText, !selected && styles.chipTextActive]}>Tüm lisans dönemleri</Text></Pressable>
            {rounds.filter(r => r.educationLevel === 'BACHELOR').map(r => <Pressable key={r.id} onPress={() => setSelected(r)} style={[styles.chip, selected?.id === r.id && styles.chipActive]}><Text style={[styles.chipText, selected?.id === r.id && styles.chipTextActive]}>{r.year}/{r.sequenceNo}</Text></Pressable>)}
          </View>
          <Text style={styles.fieldTitle}>Unvan ara</Text>
          <TextInput style={styles.input} placeholder="Örn. Memur, mühendis" value={query} onChangeText={setQuery} accessibilityLabel="Unvan ara" />
          <Text style={styles.fieldTitle}>Şehir filtresi</Text>
          <TextInput style={styles.input} placeholder="Tüm şehirler" value={city} onChangeText={setCity} accessibilityLabel="Şehir filtresi" />
        </View>
        <View style={styles.notice}><Text style={styles.noticeTitle}>Tarihsel veriler · Güncel ilan değil</Text><Text style={styles.noticeText}>Bu kayıtlar geçmiş yerleştirmeleri gösterir. Nitelik kodları doğrulanmadığından başvuru uygunluğu veya yerleşme ihtimali hesaplanmaz.</Text></View>
        <View style={styles.resultHead}><Text style={styles.count}>{total.toLocaleString('tr-TR')} kayıt</Text><Text style={styles.pageInfo}>Sayfa {page} / {Math.max(1, pages)}</Text></View>
        {error ? <View style={styles.error}><Text style={styles.errorText}>{error}</Text><Pressable onPress={reload}><Text style={styles.retry}>Tekrar dene</Text></Pressable></View> : null}
        {loading ? <ActivityIndicator size="large" color="#2458B4" style={{ marginVertical: 20 }} /> : null}
      </View>}
      contentContainerStyle={styles.content}
      ListEmptyComponent={!loading && !error ? <View style={styles.empty}><Text style={styles.emptyTitle}>Kayıt bulunamadı</Text><Text style={styles.sub}>Filtreleri değiştirebilir veya sayfayı yenileyebilirsin.</Text></View> : null}
      renderItem={({ item }) => {
        const compare = hasScore && item.minScore !== null ? parsedScore - Number(item.minScore) : null;
        return <Pressable style={styles.card} onPress={() => router.push({ pathname: '/placement/[id]', params: { id: item.id, score } })} accessibilityRole="button" accessibilityLabel={`${item.title}, ${item.institutionRawName}, ayrıntıları aç`}>
          <View style={styles.topLine}><Text style={styles.title} numberOfLines={2}>{item.title}</Text><Text style={styles.period}>{item.round.year}/{item.round.sequenceNo}</Text></View>
          <Text style={styles.institution}>{item.institutionRawName}</Text>
          <View style={styles.metrics}><View><Text style={styles.metricLabel}>En küçük puan</Text><Text style={styles.metricValue}>{showScore(item.minScore)}</Text></View><View><Text style={styles.metricLabel}>Kontenjan</Text><Text style={styles.metricValue}>{item.quota}</Text></View></View>
          {compare !== null && <Text style={styles.comparison}>{compare >= 0 ? `Puanın geçmiş en düşük puanın ${showScore(compare.toString())} üzerinde` : `Puanın geçmiş en düşük puanın ${showScore(Math.abs(compare).toString())} altında`}</Text>}
          <Text style={styles.open}>Kadro detayını gör  →</Text>
        </Pressable>;
      }}
      ListFooterComponent={<View style={styles.footer}><Pressable disabled={page <= 1 || loading} onPress={() => setPage(p => p - 1)} style={[styles.pageButton, (page <= 1 || loading) && styles.disabled]}><Text style={styles.pageButtonText}>← Önceki</Text></Pressable><Pressable disabled={page >= pages || loading} onPress={() => setPage(p => p + 1)} style={[styles.pageButton, (page >= pages || loading) && styles.disabled]}><Text style={styles.pageButtonText}>Sonraki →</Text></Pressable></View>}
    />
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F3F6FB' }, content: { padding: 18, paddingBottom: 45 }, eyebrow: { color: '#4775BA', fontSize: 11, letterSpacing: 1.1, fontWeight: '700', marginBottom: 8 }, heading: { fontSize: 30, fontWeight: '800', color: '#111E43' }, sub: { fontSize: 13, color: '#66758E', lineHeight: 20, marginTop: 6 }, form: { backgroundColor: 'white', borderRadius: 16, padding: 16, marginTop: 20, gap: 8 }, fieldTitle: { fontWeight: '700', fontSize: 12, color: '#283655', marginTop: 4 }, input: { backgroundColor: '#F4F6FA', borderRadius: 9, paddingHorizontal: 12, paddingVertical: 12, color: '#182541', borderWidth: 1, borderColor: '#E2E8F1' }, chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 5 }, chip: { borderRadius: 18, borderWidth: 1, borderColor: '#CAD6E8', paddingHorizontal: 12, paddingVertical: 9 }, chipActive: { backgroundColor: '#172758', borderColor: '#172758' }, chipText: { fontSize: 12, color: '#203151' }, chipTextActive: { color: '#FFFFFF' }, notice: { backgroundColor: '#E8F0FE', borderRadius: 12, padding: 14, marginTop: 15 }, noticeTitle: { color: '#174590', fontSize: 13, fontWeight: '800' }, noticeText: { color: '#39577D', fontSize: 12, lineHeight: 18, marginTop: 6 }, resultHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 22, marginBottom: 12 }, count: { fontWeight: '800', color: '#172758', fontSize: 17 }, pageInfo: { color: '#687997', fontSize: 12 }, card: { padding: 16, borderRadius: 14, backgroundColor: '#FFFFFF', marginBottom: 12, borderWidth: 1, borderColor: '#E7EBF3' }, topLine: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 }, title: { color: '#16254A', fontSize: 16, fontWeight: '800', flex: 1 }, period: { color: '#315B9F', backgroundColor: '#EDF3FF', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 7, overflow: 'hidden', alignSelf: 'flex-start', fontSize: 11 }, institution: { fontSize: 12, lineHeight: 18, marginTop: 8, color: '#66758E' }, metrics: { flexDirection: 'row', gap: 35, marginTop: 14 }, metricLabel: { color: '#8490A3', fontSize: 11 }, metricValue: { color: '#14254D', fontWeight: '800', fontSize: 17, marginTop: 3 }, comparison: { fontSize: 11, color: '#53667E', marginTop: 11 }, open: { marginTop: 14, fontSize: 12, fontWeight: '700', color: '#2458B4' }, empty: { padding: 28, alignItems: 'center' }, emptyTitle: { color: '#14254D', fontWeight: '800', fontSize: 17 }, error: { borderRadius: 10, padding: 12, backgroundColor: '#FDE9E9', marginTop: 10 }, errorText: { color: '#982D36' }, retry: { color: '#1D4F9D', fontWeight: '700', marginTop: 6 }, footer: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 10, paddingBottom: 12 }, pageButton: { backgroundColor: '#172758', paddingHorizontal: 17, paddingVertical: 12, borderRadius: 9 }, pageButtonText: { color: 'white', fontWeight: '700' }, disabled: { opacity: .35 },
});
