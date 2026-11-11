import {useEffect,useState} from 'react';
import {Text} from 'react-native';
import {accountRequest} from '../lib/account';
import {Button,Card,Field,Heading,Screen} from '../ui/components';
import {errorText} from '../lib/presentation';
export default function AccountRecovery(){
 const [available,setAvailable]=useState(false),[email,setEmail]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('Hesap kurtarma durumu kontrol ediliyor.');
 useEffect(()=>{let active=true;void accountRequest('/account/capabilities').then(c=>{if(active){setAvailable(c.passwordReset===true);setMessage(c.passwordReset===true?'E-postandaki güvenli bağlantıyla yeni şifreni belirleyebilirsin.':'Hesap kurtarma şu anda kullanılamıyor.');}}).catch(e=>{if(active)setMessage(errorText(e));});return()=>{active=false;};},[]);
 async function request(){if(busy)return;setBusy(true);try{await accountRequest('/account/password-reset/request','POST',{email});setMessage('Adres uygunsa işlem bağlantısı gönderilecektir. E-postanı kontrol et.');}catch(e){setMessage(errorText(e));}finally{setBusy(false);}}
 return <Screen><Heading title="Şifremi unuttum"/><Card><Text accessibilityRole="alert">{message}</Text>{available&&<><Field label="E-posta" value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email"/><Button title="Bağlantı iste" onPress={()=>void request()} busy={busy}/></>}</Card></Screen>;
}
