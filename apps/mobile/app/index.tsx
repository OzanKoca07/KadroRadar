import {router} from 'expo-router';
import {Pressable,ScrollView,Text,View} from 'react-native';
import {Button,Card,Icon,IconButton,Independence,Screen,type IconName} from '../ui/components';
import {NewsSlider} from '../ui/news-slider';
import {colors,ui} from '../ui/theme';
export default function Home(){
 const shortcuts:{title:string;icon:IconName;route:'/announcements'|'/matches'|'/saved'}[]=[{title:'Güncel ilanlar',icon:'megaphone-outline',route:'/announcements'},{title:'Bana uygun',icon:'checkmark-circle-outline',route:'/matches'},{title:'Kaydedilenler',icon:'bookmark-outline',route:'/saved'}];
 return <Screen safeTop><View style={ui.between}><Text style={ui.heading}>KadroRadar</Text><IconButton label="Bildirimler" name="notifications-outline" onPress={()=>router.push('/notifications')}/></View><NewsSlider/>
 <Card><Text accessibilityRole="header" style={ui.heading}>Geçmiş atamalar</Text><Text style={ui.muted}>ÖSYM taban ve tavan puanları</Text><Button title="Geçmiş atamaları incele" icon="arrow-forward-outline" onPress={()=>router.push('/historical')}/><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:8}}>{[['BACHELOR','Lisans'],['ASSOCIATE','Önlisans'],['HIGH_SCHOOL','Ortaöğretim']].map(([education,label])=><Pressable key={education} accessibilityRole="button" accessibilityLabel={label+', geçmiş atamalar'} onPress={()=>router.push({pathname:'/historical',params:{education}})} style={{minHeight:48,justifyContent:'center',paddingHorizontal:10}}><Text style={[ui.label,{color:colors.primary}]}>{label}</Text></Pressable>)}</ScrollView></Card>
 <Card>{shortcuts.map(item=><Pressable key={item.route} accessibilityRole="button" accessibilityLabel={item.title} onPress={()=>router.push(item.route)} style={({pressed})=>[ui.between,{minHeight:56,padding:8,borderRadius:10,backgroundColor:pressed?colors.primarySoft:'transparent'}]}><View style={ui.row}><Icon name={item.icon}/><Text style={ui.label}>{item.title}</Text></View><Icon name="chevron-forward-outline" size={18}/></Pressable>)}</Card>
 <Button title="Uygulama hakkında" variant="ghost" onPress={()=>router.push('/about')}/><Independence/></Screen>;
}
