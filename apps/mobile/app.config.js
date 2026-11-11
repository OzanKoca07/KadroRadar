module.exports = ({ config }) => {
  const production = process.env.EAS_BUILD_PROFILE === 'production';
  const release = production || process.env.EAS_BUILD_PROFILE === 'preview';
  if (release) {
    let url;
    try { url = new URL(process.env.EXPO_PUBLIC_API_URL); } catch { throw new Error('Production EXPO_PUBLIC_API_URL required'); }
    if (url.protocol !== 'https:' || url.username || url.password || url.hostname === 'localhost' || url.hostname.includes(':') || /^\d+\.\d+\.\d+\.\d+$/.test(url.hostname)) throw new Error('Public HTTPS API required');
    if(url.search||url.hash||url.port&&url.port!=='443'||url.pathname.replace(/\/$/,'')!=='/api/v1')throw new Error('Clean HTTPS /api/v1 endpoint required');
    for(const key of ['EXPO_PUBLIC_PRIVACY_URL','EXPO_PUBLIC_ACCOUNT_DELETION_URL']){if(!production&&!process.env[key])continue;let value;try{value=new URL(process.env[key]);}catch{throw new Error(key+' required');}if(value.protocol!=='https:'||value.username||value.password||['localhost','127.0.0.1'].includes(value.hostname))throw new Error(key+' public HTTPS required');}
    if(production&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(process.env.EXPO_PUBLIC_SUPPORT_EMAIL||''))throw new Error('EXPO_PUBLIC_SUPPORT_EMAIL required');
  }
  const plugins=config.plugins.map(plugin => Array.isArray(plugin) && plugin[0] === 'expo-build-properties' ? [plugin[0], {...plugin[1], android: {...plugin[1].android, usesCleartextTraffic: !release, ...(release ? {targetSdkVersion: 36, compileSdkVersion: 36} : {})}}] : plugin);
  if(!plugins.some(plugin=>(Array.isArray(plugin)?plugin[0]:plugin)==='expo-notifications'))plugins.push('expo-notifications');
  return {...config, android:{...config.android,blockedPermissions:['android.permission.RECORD_AUDIO','android.permission.CAMERA','android.permission.READ_EXTERNAL_STORAGE','android.permission.WRITE_EXTERNAL_STORAGE','com.google.android.gms.permission.AD_ID','android.permission.SYSTEM_ALERT_WINDOW'],...(process.env.GOOGLE_SERVICES_JSON?{googleServicesFile:process.env.GOOGLE_SERVICES_JSON}:{})}, plugins};
};
