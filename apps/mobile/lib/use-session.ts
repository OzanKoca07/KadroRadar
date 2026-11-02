import {useSyncExternalStore} from 'react';
import {hasSession,subscribeSession} from './account';
export function useSession(){return useSyncExternalStore(subscribeSession,hasSession,()=>false);}
