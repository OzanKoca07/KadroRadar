const registry:Record<string,{hosts:string[]}>=require('../../../packages/official-sources.json');
import {restrictedSource} from './source-policy';
export function official(value:string){try{const url=new URL(value);return !restrictedSource(value)&&url.protocol==='https:'&&!url.username&&!url.password&&(!url.port||url.port==='443')&&Object.values(registry).some(source=>source.hosts.includes(url.hostname));}catch{return false;}}
