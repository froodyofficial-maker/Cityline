// Syntax-checks the game exactly as it runs: all sources concatenated in manifest order. Usage: `npm run check`.
import {readFile} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import vm from 'node:vm';
const root=join(dirname(fileURLToPath(import.meta.url)),'..');
const {GAME_FILES}=await import(pathToFileURL(join(root,'src/manifest.js')).href);
let ok=true;
for(const f of GAME_FILES){try{new vm.Script(await readFile(join(root,'src',f),'utf8'),{filename:'src/'+f})}catch(e){ok=false;console.error('src/'+f+': '+e.message)}}
let all='';for(const f of GAME_FILES)all+='\n;'+await readFile(join(root,'src',f),'utf8');
try{new vm.Script(all,{filename:'ember-city-game.js'})}catch(e){ok=false;console.error('combined: '+e.message)}
console.log(ok?`ok: ${GAME_FILES.length} files`:'syntax errors found');process.exit(ok?0:1);
