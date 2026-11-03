import { createHash, randomBytes } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const args=process.argv.slice(2),values={}
for(let i=0;i<args.length;i+=2){
  if(!['--id','--url','--output','--registry-output','--registry-input'].includes(args[i])||!args[i+1]||values[args[i]])throw new Error('Invalid provisioning options')
  values[args[i]]=args[i+1]
}
const id=values['--id'],url=new URL(values['--url'])
if(!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(id||'')||url.protocol!=='https:'||url.pathname!=='/api/live/token'||url.username||url.password||url.search||url.hash)throw new Error('Use a device ID and HTTPS token endpoint')
const output=path.resolve(values['--output']),registryOutput=path.resolve(values['--registry-output'])
const registry=values['--registry-input']?JSON.parse(readFileSync(values['--registry-input'],'utf8')):{}
if(!registry||Array.isArray(registry)||typeof registry!=='object'||Object.hasOwn(registry,id))throw new Error('Device already registered or invalid registry')
const secret=randomBytes(32).toString('base64url')
registry[id]={enabled:true,sha256:createHash('sha256').update(secret).digest('hex')}
mkdirSync(path.dirname(output),{recursive:true,mode:0o700})
mkdirSync(path.dirname(registryOutput),{recursive:true,mode:0o700})
writeFileSync(output,JSON.stringify({url:url.href,deviceId:id,secret},null,2)+'\n',{flag:'wx',mode:0o600})
writeFileSync(registryOutput,JSON.stringify(registry,null,2)+'\n',{flag:'wx',mode:0o600})
console.log(`Created private credentials for ${id}; only the hash registry goes to Secret Manager`)
