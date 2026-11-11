import * as Notifications from 'expo-notifications';
import {Platform} from 'react-native';
import {accountRequest} from './account';
export async function enablePush(){
 if(Platform.OS==='android')await Notifications.setNotificationChannelAsync('default',{name:'İlan bildirimleri',importance:Notifications.AndroidImportance.DEFAULT});
 const permission=await Notifications.requestPermissionsAsync();
 if(permission.status!=='granted')throw new Error('Bildirim izni verilmedi. Ayarlardan istediğiniz zaman değiştirebilirsiniz.');
 const result=await Notifications.getExpoPushTokenAsync({projectId:'44bbc3b8-3306-4b9a-91c6-74a2eb2e0877'});
 await accountRequest('/account/push','PUT',{enabled:true,token:result.data});
}
export async function disablePush(){await accountRequest('/account/push','PUT',{enabled:false});}
