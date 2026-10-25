import { Link } from 'expo-router';
import { StyleSheet, Text, View, ScrollView } from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
export default function Home() { return <SafeAreaView style={styles.root}><ScrollView contentContainerStyle={styles.container}>
  <Text style={styles.brand}>KadroRadar</Text><Text style={styles.kicker}>KAMU KARİYER REHBERİN</Text>
  <Text style={styles.title}>Tercihlerine veriyle yön ver.</Text>
  <Text style={styles.body}>Geçmiş ÖSYM yerleştirme puanlarını incele, kadroları karşılaştır ve sonraki adımlarını daha bilinçli planla.</Text>
  <Link href="/announcements" style={styles.button}>Güncel kamu ilanları →</Link>
  <Link href="/saved" style={styles.button}>Kaydedilen ilanlar →</Link>
  <Link href="/matches" style={styles.button}>Bana uygun kadrolar →</Link>
  <Link href="/profile" style={styles.button}>Profil ve giriş →</Link>
  <Link href="/notifications" style={styles.button}>Bildirimler →</Link>
  <Link href="/historical" style={styles.button}>Geçmiş ÖSYM atamaları →</Link>
  <Link href="/about" style={styles.button}>Gizlilik, destek ve uygulama bilgisi →</Link>
  <View style={styles.box}><Text style={styles.boxTitle}>Her kadronun koşulunu ayrı incele</Text><Text style={styles.boxBody}>Profilinle doğrulanmış koşulları karşılaştır. Eksik bilgi varsa sonuç belirsiz gösterilir; başvurmadan önce resmî kaynağı kontrol et.</Text></View>
  <Text style={styles.disclaimer}>Bağımsız bilgi ve karar destek uygulamasıdır. ÖSYM veya kamu kurumlarının resmî uygulaması değildir.</Text>
</ScrollView></SafeAreaView>; }
const styles=StyleSheet.create({root:{flex:1,backgroundColor:'#F3F6FB'},container:{padding:24,flexGrow:1,justifyContent:'center'},brand:{fontSize:22,fontWeight:'900',color:'#172758'},kicker:{fontSize:11,letterSpacing:2,color:'#4775BA',fontWeight:'800',marginTop:9},title:{fontSize:34,lineHeight:42,fontWeight:'900',color:'#132248',marginTop:26},body:{fontSize:15,lineHeight:24,color:'#60708C',marginTop:13},button:{backgroundColor:'#172758',color:'white',fontSize:15,fontWeight:'800',overflow:'hidden',borderRadius:12,padding:17,marginTop:28},box:{padding:18,backgroundColor:'white',borderRadius:15,marginTop:24},boxTitle:{fontSize:16,fontWeight:'800',color:'#172758'},boxBody:{marginTop:8,fontSize:12,lineHeight:19,color:'#62718B'},disclaimer:{fontSize:11,lineHeight:17,color:'#8B96A8',marginTop:24}});
