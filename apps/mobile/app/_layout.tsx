import {Stack,router,usePathname} from 'expo-router';
import {useEffect,useState} from 'react';
import {Keyboard,Pressable,Text,View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {StatusBar} from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import {Icon,MotionProvider,useReducedMotion,type IconName} from '../ui/components';
import {colors} from '../ui/theme';
const tabs:{path:'/'|'/announcements'|'/historical'|'/saved'|'/profile';label:string;icon:IconName}[]=[
 {path:'/',label:'Ana sayfa',icon:'home-outline'}, {path:'/announcements',label:'İlanlar',icon:'megaphone-outline'},
 {path:'/historical',label:'Atamalar',icon:'school-outline'}, {path:'/saved',label:'Kaydedilen',icon:'bookmark-outline'}, {path:'/profile',label:'Profil',icon:'person-outline'},
];
export default function Layout(){return <MotionProvider><AppLayout/></MotionProvider>;}
function AppLayout(){
 const pathname=usePathname(),reduced=useReducedMotion(),[keyboard,setKeyboard]=useState(false);
 useEffect(()=>{const show=Keyboard.addListener('keyboardDidShow',()=>setKeyboard(true)),hide=Keyboard.addListener('keyboardDidHide',()=>setKeyboard(false));const subscription=Notifications.addNotificationResponseReceivedListener(response=>{const id=response.notification.request.content.data.announcementId;if(typeof id==='string'&&/^[a-zA-Z0-9_-]+$/.test(id))router.push({pathname:'/announcement/[id]',params:{id}});});return()=>{show.remove();hide.remove();subscription.remove();};},[]);
 return <View style={{flex:1,backgroundColor:colors.canvas}}><StatusBar style="dark"/><Stack screenOptions={{headerStyle:{backgroundColor:colors.surface},headerTintColor:colors.primary,headerTitleStyle:{color:colors.text,fontWeight:'600'},headerShadowVisible:false,contentStyle:{backgroundColor:colors.canvas},animation:reduced?'none':'fade_from_bottom',headerBackTitle:'Geri'}}>
  <Stack.Screen name="index" options={{title:'KadroRadar',headerShown:false}}/>
  <Stack.Screen name="historical" options={{title:'Geçmiş atamalar'}}/>
  <Stack.Screen name="placement/[id]" options={{title:'Kadro detayları'}}/>
  <Stack.Screen name="announcements" options={{title:'Güncel ilanlar'}}/>
  <Stack.Screen name="announcement/[id]" options={{title:'İlan detayları'}}/>
  <Stack.Screen name="profile" options={{title:'Aday profilim'}}/>
  <Stack.Screen name="saved" options={{title:'Kaydedilenler'}}/>
  <Stack.Screen name="matches" options={{title:'Bana uygun'}}/>
  <Stack.Screen name="notifications" options={{title:'Bildirimler'}}/>
  <Stack.Screen name="about" options={{title:'KadroRadar hakkında'}}/>
 </Stack>{!keyboard&&<SafeAreaView edges={['bottom']} style={{backgroundColor:colors.surface,borderTopWidth:1,borderColor:colors.border}}><View style={{flexDirection:'row',paddingTop:5}}>{tabs.map(tab=>{const selected=tab.path==='/'?pathname==='/':pathname===tab.path||(tab.path==='/historical'&&pathname.startsWith('/placement/'))||(tab.path==='/announcements'&&pathname.startsWith('/announcement/'));return <Pressable key={tab.path} accessibilityRole="button" accessibilityLabel={tab.label} accessibilityState={{selected}} onPress={()=>router.navigate(tab.path)} style={({pressed})=>({flex:1,minHeight:58,alignItems:'center',justifyContent:'center',gap:4,backgroundColor:pressed?colors.primarySoft:'transparent'})}><Icon name={tab.icon} size={22} color={selected?colors.primary:colors.muted}/><Text style={{fontSize:10,lineHeight:15,color:selected?colors.primary:colors.muted,fontWeight:selected?'700':'500'}}>{tab.label}</Text></Pressable>;})}</View></SafeAreaView>}</View>;
}
