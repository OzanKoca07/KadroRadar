import {router} from 'expo-router';
import {Pressable,Text,View} from 'react-native';
import {Badge,Button,Card,Heading,Icon,Independence,Screen,type IconName} from '../ui/components';
import {colors,ui} from '../ui/theme';
export default function Home(){
 const shortcuts: {title:string;description:string;icon:IconName;route:'/announcements'|'/matches'|'/saved'|'/profile'}[]=[
  {title:'Güncel ilanlar',description:'Resmî kaynakları takip et',icon:'megaphone-outline',route:'/announcements'},
  {title:'Bana uygun',description:'Kadro koşullarını karşılaştır',icon:'checkmark-circle-outline',route:'/matches'},
  {title:'Kaydedilenler',description:'İlanlarını bir arada tut',icon:'bookmark-outline',route:'/saved'},
  {title:'Aday profilim',description:'Bilgilerini güncel tut',icon:'person-outline',route:'/profile'},
 ];
 return <Screen safeTop><View style={ui.between}><View style={ui.row}><View style={{padding:9,borderRadius:12,backgroundColor:colors.primary}}><Icon name="school-outline" color="#FFFFFF"/></View><Text style={ui.heading}>KadroRadar</Text></View><Button title="Bildirimler" icon="notifications-outline" variant="ghost" onPress={()=>router.push('/notifications')}/></View>
  <Heading eyebrow="HEDEFİNE BİR ADIM DAHA" title="Merhaba, hoş geldin." description="Kamu kariyerini planlarken güvenilir bilgiyle ilerle."/>
  <Card style={{backgroundColor:colors.primarySoft,borderColor:'#EED3D7',padding:22}}><Badge text="ÖSYM · Geçmiş yerleştirmeler"/><Text style={ui.title}>Tercihlerini verilerle şekillendir.</Text><Text style={ui.body}>Geçmiş taban ve tavan puanlarını incele. Eğitim düzeyine göre kadroları keşfet.</Text><Button title="Geçmiş atamaları incele" icon="arrow-forward-outline" onPress={()=>router.push('/historical')}/><Text style={ui.caption}>İncelemek için hesap açman gerekmez.</Text></Card>
  <Text accessibilityRole="header" style={ui.heading}>Bugün ne yapmak istersin?</Text>
  <View style={{flexDirection:'row',flexWrap:'wrap',gap:12}}>{shortcuts.map(item=><Pressable key={item.route} accessibilityRole="button" accessibilityLabel={item.title} onPress={()=>router.push(item.route)} style={({pressed})=>({width:'48%',flexGrow:1,padding:16,gap:10,borderRadius:16,borderWidth:1,borderColor:colors.border,backgroundColor:pressed?colors.primarySoft:colors.surface})}><Icon name={item.icon}/><Text style={ui.label}>{item.title}</Text><Text style={ui.caption}>{item.description}</Text></Pressable>)}</View>
  <Text accessibilityRole="header" style={ui.heading}>Eğitim düzeyinden başla</Text>
  <Card>{[['BACHELOR','Lisans','KPSS P3'],['ASSOCIATE','Önlisans','KPSS P93'],['HIGH_SCHOOL','Ortaöğretim','KPSS P94']].map(([education,label,scoreType])=><Pressable key={education} accessibilityRole="button" accessibilityLabel={label+', geçmiş atamaları incele'} onPress={()=>router.push({pathname:'/historical',params:{education}})} style={({pressed})=>[ui.between,{minHeight:64,paddingHorizontal:8,borderRadius:10,backgroundColor:pressed?colors.primarySoft:'transparent'}]}><View style={ui.row}><Icon name="book-outline"/><View><Text style={ui.label}>{label}</Text><Text style={ui.caption}>{scoreType}</Text></View></View><Icon name="chevron-forward-outline" size={18} color={colors.muted}/></Pressable>)}</Card>
  <Card><View style={ui.row}><Icon name="shield-checkmark-outline" color={colors.success}/><Text style={ui.label}>Bilgiye kaynağından ulaş</Text></View><Text style={ui.muted}>Doğrulanmış temel bilgileri incele; başvurunu her zaman ilgili kurumun resmî platformunda yap. Eksik koşullar kesin uygunluk sayılmaz.</Text></Card>
  <Button title="Gizlilik ve uygulama hakkında" variant="ghost" onPress={()=>router.push('/about')}/><Independence/>
 </Screen>;
}
