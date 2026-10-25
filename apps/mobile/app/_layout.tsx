import {Stack,router} from 'expo-router';
import {useEffect} from 'react';
import * as Notifications from 'expo-notifications';
export default function Layout(){useEffect(()=>{const subscription=Notifications.addNotificationResponseReceivedListener(response=>{const id=response.notification.request.content.data.announcementId;if(typeof id==='string' && /^[a-zA-Z0-9_-]+$/.test(id))router.push({pathname:'/announcement/[id]',params:{id}});});return ()=>subscription.remove();},[]);return <Stack screenOptions={{headerStyle:{backgroundColor:'#121D46'},headerTintColor:'#fff'}}/>}
