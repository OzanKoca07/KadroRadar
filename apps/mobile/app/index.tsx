import { Link } from 'expo-router';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';
export default function Home() { return <SafeAreaView style={styles.root}><View style={styles.container}>
  <Text style={styles.brand}>KadroRadar</Text><Text style={styles.kicker}>KAMU KARİYER REHBERİN</Text>
  <Text style={styles.title}>Tercihlerine veriyle yön ver.</Text>
  <Text style={styles.body}>Geçmiş ÖSYM yerleştirme puanlarını incele, kadroları karşılaştır ve sonraki adımlarını daha bilinçli planla.</Text>
  <Link href="/historical" style={styles.button}>Geçmiş atamaları keşfet →</Link>
  <View style={styles.box}><Text style={styles.boxTitle}>Yakında: Akıllı İlan Eşleştirme</Text><Text style={styles.boxBody}>Nitelik kodları ve resmî ilan kaynakları doğrulandığında profil bazlı kadro uygunluğu sunulacak.</Text></View>
  <Text style={styles.disclaimer}>Bağımsız bilgi ve karar destek uygulamasıdır. ÖSYM veya kamu kurumlarının resmî uygulaması değildir.</Text>
</View></SafeAreaView>; }
const styles=StyleSheet.create({root:{flex:1,backgroundColor:'#F3F6FB'},container:{padding:24,flex:1,justifyContent:'center'},brand:{fontSize:22,fontWeight:'900',color:'#172758'},kicker:{fontSize:11,letterSpacing:2,color:'#4775BA',fontWeight:'800',marginTop:9},title:{fontSize:34,lineHeight:42,fontWeight:'900',color:'#132248',marginTop:26},body:{fontSize:15,lineHeight:24,color:'#60708C',marginTop:13},button:{backgroundColor:'#172758',color:'white',fontSize:15,fontWeight:'800',overflow:'hidden',borderRadius:12,padding:17,marginTop:28},box:{padding:18,backgroundColor:'white',borderRadius:15,marginTop:24},boxTitle:{fontSize:16,fontWeight:'800',color:'#172758'},boxBody:{marginTop:8,fontSize:12,lineHeight:19,color:'#62718B'},disclaimer:{fontSize:11,lineHeight:17,color:'#8B96A8',marginTop:24}});
