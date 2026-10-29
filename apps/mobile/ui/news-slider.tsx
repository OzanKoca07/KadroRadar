import {useEffect,useRef,useState} from 'react';
import {FlatList,Pressable,Text,View} from 'react-native';
import {type NewsItem,loadNews} from '../lib/news';
import {dateText} from '../lib/presentation';
import {Card,OfficialLink,useReducedMotion} from './components';
import {colors,ui} from './theme';
export function NewsSlider(){
 const [items,setItems]=useState<NewsItem[]>([]),[width,setWidth]=useState(0),[page,setPage]=useState(0),list=useRef<FlatList<NewsItem>>(null),reduced=useReducedMotion();
 useEffect(()=>{const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),10000);void loadNews(controller.signal).then(value=>{if(!controller.signal.aborted){setItems(value);setPage(0);}}).catch(()=>{}).finally(()=>clearTimeout(timer));return()=>{clearTimeout(timer);controller.abort();};},[]);
 if(!items.length)return null;
 return <View onLayout={event=>setWidth(event.nativeEvent.layout.width)} style={{gap:4}}><Text accessibilityRole="header" style={ui.label}>Resmî duyurular</Text>{width>0&&<FlatList ref={list} horizontal pagingEnabled showsHorizontalScrollIndicator={false} data={items} keyExtractor={item=>item.id} extraData={width} getItemLayout={(_,index)=>({length:width,offset:width*index,index})} onMomentumScrollEnd={event=>setPage(Math.min(items.length-1,Math.max(0,Math.round(event.nativeEvent.contentOffset.x/width))))} renderItem={({item,index})=><View style={{width}} accessibilityLabel={`Duyuru ${index+1}, ${items.length}`}><Card><Text style={ui.caption}>{item.organization} · {dateText(item.date)}</Text><Text style={ui.label}>{item.title}</Text>{!!item.summary&&<Text style={ui.caption}>{item.summary}</Text>}<OfficialLink url={item.sourceUrl} title="Resmî kaynağı aç"/></Card></View>}/>}{items.length>1&&<View style={{flexDirection:'row',justifyContent:'center'}}>{items.map((item,index)=><Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`${index+1}. duyuru, toplam ${items.length}`} accessibilityState={{selected:page===index}} onPress={()=>{list.current?.scrollToIndex({index,animated:!reduced});setPage(index);}} style={{minWidth:48,minHeight:48,alignItems:'center',justifyContent:'center'}}><View style={{width:page===index?18:7,height:7,borderRadius:5,backgroundColor:page===index?colors.primary:colors.muted}}/></Pressable>)}</View>}</View>;
}
