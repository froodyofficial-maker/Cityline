// Builds dist/vespers.html: the horror game as one self-contained file (three.js + game inlined)
// that runs straight from disk. Usage: `npm run build:vespers`.
import {build} from 'esbuild';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=join(dirname(fileURLToPath(import.meta.url)),'..');
const t0=Date.now();
const out=await build({entryPoints:[join(root,'vespers/src/main.js')],bundle:true,minify:true,format:'iife',write:false,legalComments:'none',target:'es2020',
 plugins:[{name:'three-vendor',setup(b){b.onResolve({filter:/^three$/},()=>({path:join(root,'vendor/three/build/three.module.min.js')}));}}]});
const js=out.outputFiles[0].text.replace(/<\/script/gi,'<\\/script');
let html=(await readFile(join(root,'vespers/index.html'),'utf8')).replace(/\r\n/g,'\n');
const swap=(from,to)=>{if(!html.includes(from))throw new Error('build: vespers/index.html is missing '+from);html=html.replace(from,()=>to)};
html=html.replace(/<script type="importmap">[\s\S]*?<\/script>\n?/,'');
swap('<script type="module" src="src/main.js"></script>','<script>'+js+'</script>');
await mkdir(join(root,'dist'),{recursive:true});
await writeFile(join(root,'dist/vespers.html'),html);
console.log(`dist/vespers.html  ${(Buffer.byteLength(html)/1048576).toFixed(2)} MB  (${Date.now()-t0} ms)`);
