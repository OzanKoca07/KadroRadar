import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

type Placement = { id: string; positionCode: string; title: string; institutionRawName: string; city: string | null; quota: number; placedCount: number; vacantCount: number; minScore: string | null; maxScore: string | null; sourcePage: number; round: { year: number; sequenceNo: number; educationLevel: string }; sourceDocument: { originalUrl: string | null; originalFilename: string; sourceOrganization: string } };
const BASE = process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:3000/api/v1';
const fmt = (v: string | null) => v === null ? '—' : Number(v).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 5 });
export default function PlacementDetails() {
  const { id, score } = useLocalSearchParams<{ id: string; score?: string }>();
  const [item, setItem] = useState<Placement | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { let alive = true; const controller = new AbortController(); if (!id) return;
    fetch(`${BASE}/historical/placements/${encodeURIComponent(id)}`, { signal: controller.signal })
      .then(async r => { if (!r.ok) throw new Error(r.status === 404 ? 'Kayıt bulunamadı veya henüz onaylanmamış.' : 'Kayıt yüklenemedi.'); return r.json(); })
      .then((data: Placement) => { if (alive) setItem(data); }).catch(e => { if (alive && !controller.signal.aborted) setError(e.message); });
    return () => { alive = false; controller.abort(); };
  }, [id]);
  const numberScore = score ? Number(score.replace(',', '.')) : NaN;
  const delta = item?.minScore != null && Number.isFinite(numberScore) && numberScore >= 0 && numberScore <= 100 ? numberScore - Number(item.minScore) : null;
  if (error) return <View style={styles.center}><Text style={styles.error}>{error}</Text></View>;
  if (!item) return <View style={styles.center}><ActivityIndicator size="large" color="#2458B4" /></View>;
  return <ScrollView style={styles.root} contentContainerStyle={styles.content}>
    <Text style={styles.eyebrow}>ÖSYM · {item.round.year}/{item.round.sequenceNo} · {item.round.educationLevel}</Text>
    <Text style={styles.title}>{item.title}</Text>
    <Text style={styles.institution}>{item.institutionRawName}</Text>
    <View style={styles.panel}>
      <Text style={styles.h2}>Yerleştirme bilgileri</Text>
      {([['Kadro kodu', item.positionCode], ['Şehir', item.city || 'Belirtilmemiş'], ['Kontenjan', String(item.quota)], ['Yerleşen', String(item.placedCount)], ['Boş kontenjan', String(item.vacantCount)], ['En küçük puan', fmt(item.minScore)], ['En büyük puan', fmt(item.maxScore)]] as [string, string][]).map(([label, value]) => <View key={label} style={styles.line}><Text style={styles.label}>{label}</Text><Text style={styles.value}>{value}</Text></View>)}
    </View>
    {delta !== null ? <View style={styles.panel}><Text style={styles.h2}>Puan karşılaştırman</Text><Text style={styles.big}>{fmt(numberScore.toString())}</Text><Text style={styles.note}>Geçmiş en düşük puandan {fmt(Math.abs(delta).toString())} puan {delta >= 0 ? 'yüksek' : 'düşük'}.</Text></View> : null}
    <View style={styles.warning}><Text style={styles.warningTitle}>Önemli bilgi</Text><Text style={styles.note}>Bu kayıt geçmiş bir yerleştirmeye aittir, aktif ilan değildir. İlgili kadronun nitelik kodları doğrulanmadı. Geçmiş puanın üzerinde olmak başvuru uygunluğu veya gelecekte yerleşme garantisi sağlamaz.</Text></View>
    <View style={styles.panel}><Text style={styles.h2}>Resmî kaynak bilgisi</Text><Text style={styles.note}>{item.sourceDocument.sourceOrganization} · {item.sourceDocument.originalFilename} · PDF sayfa {item.sourcePage}</Text>{item.sourceDocument.originalUrl && /^https:\/\//i.test(item.sourceDocument.originalUrl) ? <Text style={styles.link} onPress={() => Linking.openURL(item.sourceDocument.originalUrl!)}>Kaynak bağlantısını aç ↗</Text> : <Text style={styles.note}>Bu kayda ait doğrudan kaynak bağlantısı kaydedilmemiş.</Text>}</View>
    <Text style={styles.footer}>KadroRadar bağımsız bir karar destek uygulamasıdır; ÖSYM veya herhangi bir kamu kurumunun resmî uygulaması değildir.</Text>
  </ScrollView>;
}
const styles = StyleSheet.create({root:{flex:1,backgroundColor:'#F3F6FB'},content:{padding:18,paddingBottom:40},center:{flex:1,justifyContent:'center',alignItems:'center',padding:25},error:{color:'#A42438'},eyebrow:{fontSize:12,fontWeight:'800',color:'#4775BA'},title:{fontSize:27,fontWeight:'800',color:'#152551',marginTop:12},institution:{color:'#62718B',fontSize:14,lineHeight:21,marginTop:8,marginBottom:16},panel:{backgroundColor:'white',padding:17,borderRadius:14,marginTop:14},h2:{fontSize:16,fontWeight:'800',color:'#172758',marginBottom:12},line:{flexDirection:'row',justifyContent:'space-between',gap:16,paddingVertical:9,borderBottomColor:'#E7EDF5',borderBottomWidth:1},label:{fontSize:12,color:'#77849A'},value:{fontSize:12,fontWeight:'700',color:'#1F2C4B',textAlign:'right',flexShrink:1},big:{fontSize:29,color:'#172758',fontWeight:'800'},note:{fontSize:12,color:'#53627A',lineHeight:19,marginTop:5},warning:{backgroundColor:'#E7EFFE',padding:16,borderRadius:12,marginTop:16},warningTitle:{color:'#174A9C',fontWeight:'800'},link:{color:'#2458B4',fontWeight:'800',fontSize:13,marginTop:14},footer:{color:'#7F8CA2',fontSize:11,lineHeight:17,marginTop:24}});
