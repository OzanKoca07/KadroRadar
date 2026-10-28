import {createContext, useContext, useEffect, useRef, useState, type ComponentProps, type PropsWithChildren} from 'react';
import {AccessibilityInfo, Animated, LayoutAnimation, Linking, Pressable, ScrollView, Text, TextInput, View, type StyleProp, type ViewStyle} from 'react-native';
import {official} from '../lib/official';
import Ionicons from '@expo/vector-icons/Ionicons';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {colors, radius, space, ui} from './theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];
export const Icon = ({name, size=22, color=colors.primary}: {name: IconName; size?: number; color?: string}) => <Ionicons name={name} size={size} color={color} accessible={false}/>;
const MotionContext=createContext(true);
export function MotionProvider({children}:PropsWithChildren) {
  const [reduced, setReduced] = useState(true);
  useEffect(() => {let active=true;void AccessibilityInfo.isReduceMotionEnabled().then(value=>{if(active)setReduced(value);}).catch(()=>{});const subscription=AccessibilityInfo.addEventListener('reduceMotionChanged',setReduced);return()=>{active=false;subscription.remove();};},[]);
  return <MotionContext.Provider value={reduced}>{children}</MotionContext.Provider>;
}
export const useReducedMotion=()=>useContext(MotionContext);
export function FadeIn({children, style}: PropsWithChildren<{style?: StyleProp<ViewStyle>}>) {
  const reduced=useReducedMotion(), opacity=useRef(new Animated.Value(1)).current;
  useEffect(()=>{if(reduced){opacity.setValue(1);return;}opacity.setValue(0);const animation=Animated.timing(opacity,{toValue:1,duration:180,useNativeDriver:true});animation.start();return()=>animation.stop();},[reduced,opacity]);
  return <Animated.View style={[{opacity},style]}>{children}</Animated.View>;
}
export function Screen({children,safeTop=false}: PropsWithChildren<{safeTop?:boolean}>) {const insets=useSafeAreaInsets();return <ScrollView style={ui.root} contentContainerStyle={[ui.content,safeTop&&{paddingTop:insets.top+space.lg}]} keyboardShouldPersistTaps="handled">{children}</ScrollView>;}
export function Heading({title, description, eyebrow}: {title: string; description?: string; eyebrow?: string}) {return <View style={{gap:space.sm}}>{eyebrow&&<Text style={[ui.label,{color:colors.primary}]}>{eyebrow}</Text>}<Text accessibilityRole="header" style={ui.title}>{title}</Text>{description&&<Text style={ui.muted}>{description}</Text>}</View>;}
export function Card({children,style}:PropsWithChildren<{style?:StyleProp<ViewStyle>}>) {return <View style={[ui.card,style]}>{children}</View>;}
export function Button({title,onPress,variant='primary',icon,disabled=false,busy=false}: {title:string;onPress:()=>void;variant?:'primary'|'secondary'|'ghost'|'danger';icon?:IconName;disabled?:boolean;busy?:boolean}) {
  const reduced=useReducedMotion(),scale=useRef(new Animated.Value(1)).current;
  const animate=(toValue:number)=>{if(!reduced)Animated.timing(scale,{toValue,duration:90,useNativeDriver:true}).start();};
  const solid=variant==='primary',foreground=solid?'#FFFFFF':variant==='danger'?colors.error:colors.primary;
  return <Animated.View style={{transform:[{scale}]}}><Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityState={{disabled:disabled||busy,busy}} disabled={disabled||busy} onPress={onPress} onPressIn={()=>animate(.98)} onPressOut={()=>animate(1)} style={({pressed})=>({minHeight:48,paddingHorizontal:16,paddingVertical:12,borderRadius:radius.sm,backgroundColor:solid?colors.primary:variant==='secondary'?colors.primarySoft:pressed?'#F0F0EF':'transparent',opacity:(disabled||busy)?0.45:1,flexDirection:'row',gap:8,alignItems:'center',justifyContent:'center'})}>{icon&&<Icon name={icon} size={19} color={foreground}/>}<Text style={[ui.label,{color:foreground,flexShrink:1,textAlign:'center'}]}>{busy?'Lütfen bekleyin…':title}</Text></Pressable></Animated.View>;
}
export function Field({label,...props}: ComponentProps<typeof TextInput>&{label:string}) {return <View style={{gap:6}}><Text style={ui.label}>{label}</Text><TextInput placeholderTextColor={colors.muted} {...props} accessibilityLabel={label} style={[ui.input,props.style]}/></View>;}
export function Chip({label,selected,onPress}: {label:string;selected:boolean;onPress:()=>void}) {return <Pressable accessibilityRole="button" accessibilityState={{selected}} onPress={onPress} style={({pressed})=>({minHeight:44,justifyContent:'center',paddingHorizontal:14,borderRadius:radius.pill,borderWidth:1,borderColor:selected?colors.primary:colors.border,backgroundColor:selected?colors.primarySoft:pressed?'#F0F0EF':colors.surface})}><Text style={[ui.label,{color:selected?colors.primary:colors.muted}]}>{label}</Text></Pressable>;}
export function Badge({text,tone='neutral'}:{text:string;tone?:'neutral'|'success'|'warning'}) {return <View style={{alignSelf:'flex-start',backgroundColor:tone==='success'?colors.successSoft:tone==='warning'?colors.warningSoft:colors.infoSoft,paddingHorizontal:10,paddingVertical:5,borderRadius:8}}><Text style={[ui.caption,{fontWeight:'600',color:tone==='success'?colors.success:tone==='warning'?colors.warning:colors.info}]}>{text}</Text></View>;}
export function Notice({children,title}: PropsWithChildren<{title?:string}>) {return <View style={{padding:14,gap:4,borderRadius:radius.sm,backgroundColor:colors.infoSoft}}>{title&&<Text style={[ui.label,{color:colors.info}]}>{title}</Text>}<Text style={[ui.caption,{color:colors.info}]}>{children}</Text></View>;}
export function EmptyState({title,description,icon='file-tray-outline',action}: {title:string;description:string;icon?:IconName;action?:{title:string;onPress:()=>void}}) {return <FadeIn style={{paddingVertical:32,paddingHorizontal:16,alignItems:'center',gap:12}}><View style={{padding:18,backgroundColor:colors.primarySoft,borderRadius:24}}><Icon name={icon} size={30}/></View><Text accessibilityRole="header" style={[ui.heading,{textAlign:'center'}]}>{title}</Text><Text style={[ui.muted,{textAlign:'center',maxWidth:340}]}>{description}</Text>{action&&<Button {...action} variant="secondary"/>}</FadeIn>;}
export function ErrorState({message,onRetry}:{message:string;onRetry:()=>void}) {return <FadeIn style={[ui.card,{borderColor:'#E3BCC1'}]}><Text accessibilityRole="alert" style={[ui.label,{color:colors.error}]}>İşlem tamamlanamadı</Text><Text style={ui.muted}>{message}</Text><Button title="Tekrar dene" icon="refresh-outline" variant="secondary" onPress={onRetry}/></FadeIn>;}
export function SkeletonCards({count=3}:{count?:number}) {
  const reduced=useReducedMotion(),opacity=useRef(new Animated.Value(1)).current;
  useEffect(()=>{if(reduced){opacity.setValue(1);return;}const loop=Animated.loop(Animated.sequence([Animated.timing(opacity,{toValue:.5,duration:700,useNativeDriver:true,isInteraction:false}),Animated.timing(opacity,{toValue:1,duration:700,useNativeDriver:true,isInteraction:false})]));loop.start();return()=>loop.stop();},[reduced,opacity]);
  return <Animated.View accessibilityLabel="İçerik yükleniyor" accessibilityState={{busy:true}} style={{gap:12,opacity}}>{Array.from({length:count},(_,index)=><View key={index} style={ui.card}>{[75,95,48].map((width,i)=><View key={i} style={{height:i===0?20:13,width:`${width}%`,borderRadius:5,backgroundColor:colors.skeleton}}/>)}</View>)}</Animated.View>;
}
export function FilterPanel({children,activeCount=0}:{children:React.ReactNode;activeCount?:number}) {
 const [open,setOpen]=useState(false),reduced=useReducedMotion();
 return <View style={{gap:12}}><Button title={`${open?'Filtreleri gizle':'Filtrele'}${activeCount?` · ${activeCount}`:''}`} icon="options-outline" variant="secondary" onPress={()=>{if(!reduced)LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);setOpen(!open);}}/>{open&&<FadeIn><Card>{children}</Card></FadeIn>}</View>;
}
export function Pagination({page,pages,loading,onChange}:{page:number;pages:number;loading:boolean;onChange:(page:number)=>void}) {return <View style={[ui.between,{paddingVertical:12}]}><Button title="Önceki" variant="secondary" disabled={loading||page<=1} onPress={()=>onChange(page-1)}/><Text accessibilityLiveRegion="polite" style={ui.caption}>{pages?`${page} / ${pages}`:'—'}</Text><Button title="Sonraki" variant="secondary" disabled={loading||page>=pages} onPress={()=>onChange(page+1)}/></View>;}
export function Fact({label,value}:{label:string;value:string|number}) {return <View style={[ui.between,{paddingVertical:9,borderBottomWidth:1,borderBottomColor:colors.border}]}><Text style={[ui.muted,{flex:1}]}>{label}</Text><Text style={[ui.label,{flex:1,textAlign:'right'}]}>{value}</Text></View>;}
export const Independence=()=> <Text style={[ui.caption,{paddingVertical:8}]}>KadroRadar bağımsız bir ilan takip platformudur. ÖSYM veya herhangi bir kamu kurumunun resmî uygulaması değildir.</Text>;
export function OfficialLink({url,title='Resmî siteye git'}:{url:string|null|undefined;title?:string}){const [error,setError]=useState('');if(!url||!official(url))return <Text style={ui.caption}>Resmî bağlantı doğrulanmamış.</Text>;return <View style={{gap:6}}><Button title={title} icon="open-outline" variant="secondary" onPress={()=>{setError('');void Linking.openURL(url).catch(()=>setError('Bağlantı açılamadı. Daha sonra tekrar deneyebilirsin.'));}}/><Text style={ui.caption}>{new URL(url).hostname}</Text>{!!error&&<Text accessibilityRole="alert" style={{color:colors.error}}>{error}</Text>}</View>;}
