import assert from 'node:assert/strict';
import {readFileSync,readdirSync,statSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const data=JSON.parse(readFileSync(path.join(root,'dist/data.json'),'utf8'));
assert.match(data.project.repository,/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/);
const walk=dir=>readdirSync(dir).flatMap(name=>{const full=path.join(dir,name);return statSync(full).isDirectory()?['.git','__pycache__','artifacts','node_modules'].includes(name)?[]:walk(full):[full];});
for(const file of walk(root)){
 const name=path.relative(root,file).replaceAll('\\','/');
 assert(!name.startsWith('.openai/')&&!name.startsWith('.obsidian/'),'Non-public workspace state: '+name);
 if(!/\.(mjs|js|json|md|html|css|svg|cff|py|yml|txt)$/.test(name))continue;
 const text=readFileSync(file,'utf8');
 if(name==='scripts/check-project.mjs')continue;
 assert(!/[A-Z]:[\\/]Users[\\/]|appgprj_[a-z0-9]+|gh[pousr]_[A-Za-z0-9]{30,}/i.test(text),'Local path / hosting identity / credential in '+name);
 assert(!text.includes('\uFFFD'),'Invalid UTF-8 text in '+name);
}
for(const entry of data.frameworkIndex.entries)for(const e of entry.evidence)if(e.level==='architecture'){
 assert(e.configUrl,'Architecture matches need the inspected configuration URL');
}
for(const name of ['LICENSE','CONTRIBUTING.md','README.en.md','docs/MAINTENANCE.md','.github/workflows/ci.yml','.github/workflows/pages.yml','.github/workflows/source-audit.yml','.github/workflows/release.yml'])assert(statSync(path.join(root,name)).isFile());
console.log(JSON.stringify({projectCheck:'ok',repository:data.project.repository,publicFilesOnly:true}));
