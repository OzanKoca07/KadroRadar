import {Text,View} from 'react-native';
import {router} from 'expo-router';
import {careerCardFacts} from '../lib/career-card';
import {dateText,type Announcement} from '../lib/presentation';
import {Button,Card,OfficialLink} from './components';
import {ui} from './theme';

// Opt-in source presentation; no copied logo, image download or hotlink.
// Logo assets and production activation require a separate verified scope decision.
export function CareerSourceCard({item}:{item:Announcement}){
 const facts=careerCardFacts(item);if(!facts)return null;
 return <Card><View style={{borderBottomWidth:2,borderColor:'#0A79B4',paddingBottom:8,gap:4}}><Text style={{...ui.label,color:'#064890'}}>Kamu İşe Alım İlanları</Text><Text style={ui.caption}>Kaynak: Kariyer Kapısı</Text></View><Text style={{...ui.label,fontSize:17}}>{facts.organization}</Text><Text accessibilityLabel={facts.fullTitle} style={ui.body}>{facts.title}</Text><Text style={ui.caption}>{facts.category}</Text><Text style={ui.caption}>Yayın · {dateText(facts.announcedAt)}</Text><Text style={ui.label}>Son başvuru · {dateText(facts.deadline)}</Text><Button title="İlanı incele" onPress={()=>router.push({pathname:'/announcement/[id]',params:{id:item.id}})}/><OfficialLink url={item.sourceUrl} title="Resmî kaynağı aç"/></Card>;
}
