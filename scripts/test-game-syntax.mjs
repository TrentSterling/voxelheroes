import assert from 'node:assert/strict';
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { parseSync } from 'rolldown/utils';
const out=process.argv.find(a=>a.startsWith('--out='))?.slice(6)??'playtest-out/game-syntax';
const walk=d=>readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(d,e.name)):[join(d,e.name)]);
const files=walk('src').filter(f=>f.endsWith('.js')), fp=createHash('sha256');
for(const file of [...walk('src'),...walk('public/voices'),'index.html','package.json','package-lock.json'].sort()){fp.update(file.replaceAll('\\','/')+'\0');fp.update(readFileSync(file));}
for(const file of files){const parsed=parseSync(file,readFileSync(file,'utf8'));assert.equal(parsed.errors.length,0,`${file}: ${JSON.stringify(parsed.errors)}`);}
mkdirSync(out,{recursive:true});writeFileSync(join(out,'result.json'),JSON.stringify({ok:true,sourceSha256:fp.digest('hex'),files:files.length,utc:new Date().toISOString(),browsersLaunched:0},null,2));
console.log(`PASS ${files.length} game JavaScript modules parse; no browsers or audio launched.`);
