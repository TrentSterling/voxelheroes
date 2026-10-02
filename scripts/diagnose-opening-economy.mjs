import {firefox} from 'playwright';
import {mkdirSync,writeFileSync,existsSync} from 'node:fs';
import {launch} from './playtest.mjs';
import economy from './scenarios/economy.mjs';
const arg=n=>process.argv.find(a=>a.startsWith(`--${n}=`))?.slice(n.length+3);
const out=arg('out')??`playtest-out/economy-diagnostic-${Date.now()}`;
if(existsSync(`${out}/result.json`))throw Error('Choose a fresh output folder to preserve receipts.');
mkdirSync(out,{recursive:true});
const browser=await firefox.launch({headless:true,firefoxUserPrefs:{'media.volume_scale':'0.0'}});let t;
const report={startedUtc:new Date().toISOString(),fights:[],walks:[],scope:'Muted diagnostic only; existing economy scenario fixtures and native bot controls. Extra observations do not advance game time.'};
try {
  t=await launch({url:arg('url')??'http://127.0.0.1:5173/',out,seed:Number(arg('seed')??1),browser});
  const fight=t.fight.bind(t),walk=t.walkTo.bind(t);
  t.fight=async opts=>{const before=await t.state(),r=await fight(opts);report.fights.push({screen:before.key,result:r,after:await t.state()});console.log('FIGHT '+before.key+' '+JSON.stringify(r));return r;};
  t.walkTo=async(x,z,opts)=>{const before=await t.state(),r=await walk(x,z,opts);report.walks.push({screen:before.key,x,z,result:r,coinsBefore:before.gems,coinsAfter:(await t.state()).gems});return r;};
  await economy(t);report.ok=true;
}catch(e){report.ok=false;report.error={message:e.message,stack:e.stack};process.exitCode=1;console.error(e.message);}
finally{report.log=t?.log;report.completedUtc=new Date().toISOString();writeFileSync(`${out}/result.json`,JSON.stringify(report,null,2));await t?.close();await browser.close();}
