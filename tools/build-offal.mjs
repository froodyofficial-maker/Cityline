// Builds dist/offal.html: the horror game as one self-contained file (three.js, game, CSS, icon inlined)
// that runs straight from disk. Usage: `npm run build:offal`.
import {build} from 'esbuild';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=join(dirname(fileURLToPath(import.meta.url)),'..');
const rd=(p,enc='utf8')=>readFile(join(root,p),enc);
const t0=Date.now();

const js=(await build({entryPoints:[join(root,'offal/src/main.js')],bundle:true,minify:true,format:'iife',write:false,legalComments:'none',target:'es2020',
 plugins:[{name:'three-vendor',setup(b){b.onResolve({filter:/^three$/},()=>({path:join(root,'vendor/three/build/three.module.min.js')}))}}]})).outputFiles[0].text;

const icon='data:image/svg+xml;base64,'+(await rd('offal/icon.svg',null)).toString('base64');
let html=(await rd('offal/index.html')).replace(/\r\n/g,'\n');/* Windows checkouts may use CRLF */
const swap=(from,to)=>{if(!html.includes(from))throw new Error('build: offal/index.html is missing '+from);html=html.replace(from,()=>to)};
swap('<link rel="icon" href="icon.svg" type="image/svg+xml">','<link rel="icon" href="'+icon+'" type="image/svg+xml">');
swap('<link rel="stylesheet" href="offal.css">','<style>'+await rd('offal/offal.css')+'</style>');
html=html.replace(/<script type="importmap">[\s\S]*?<\/script>\n?/,'');
swap('<script type="module" src="src/main.js"></script>','<script>'+js.replace(/<\/script/gi,'<\\/script')+'</script>');

await mkdir(join(root,'dist'),{recursive:true});
await writeFile(join(root,'dist/offal.html'),html);
console.log(`dist/offal.html  ${(Buffer.byteLength(html)/1048576).toFixed(2)} MB  (${Date.now()-t0} ms)`);
