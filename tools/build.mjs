// Builds dist/ember-city.html: one self-contained file (three.js, game code, CSS, fonts, icon all inlined)
// that runs straight from disk with no server. Usage: `npm run build`.
import {build} from 'esbuild';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const root=join(dirname(fileURLToPath(import.meta.url)),'..');
const rd=(p,enc='utf8')=>readFile(join(root,p),enc);
const t0=Date.now();

// 1. bootstrap + three.js + addons -> one minified IIFE (import map aliases resolved to the vendored copy)
const boot=await build({entryPoints:[join(root,'src/boot.js')],bundle:true,minify:true,format:'iife',write:false,legalComments:'none',target:'es2020',
 plugins:[{name:'three-vendor',setup(b){
  b.onResolve({filter:/^three$/},()=>({path:join(root,'vendor/three/build/three.module.min.js')}));
  b.onResolve({filter:/^three\/addons\//},a=>({path:join(root,'vendor/three/examples/jsm',a.path.slice('three/addons/'.length))}));
 }}]});
const bootJs=boot.outputFiles[0].text;

// 2. game sources, concatenated in manifest order exactly as boot.js does at runtime
const {GAME_FILES}=await import(pathToFileURL(join(root,'src/manifest.js')).href);
let game='';for(const f of GAME_FILES)game+='\n;/* ===== src/'+f+' ===== */\n'+await rd('src/'+f);

// 3. CSS with fonts inlined as data URIs
let css=await rd('css/ui.css');
const fontRefs=[...new Set([...css.matchAll(/url\(\.\.\/(assets\/fonts\/[^)]+\.woff2)\)/g)].map(m=>m[1]))];
for(const f of fontRefs)css=css.split('url(../'+f+')').join('url(data:font/woff2;base64,'+(await rd(f,null)).toString('base64')+')');

// 4. assemble the page from index.html
const icon='data:image/svg+xml;base64,'+(await rd('assets/icon.svg',null)).toString('base64');
const safe=s=>s.replace(/<\/script/gi,'<\\/script');
let html=(await rd('index.html')).replace(/\r\n/g,'\n');/* Windows checkouts may use CRLF */
const swap=(from,to)=>{if(!html.includes(from))throw new Error('build: index.html is missing '+from);html=html.replace(from,()=>to)};
swap('<head>\n','<head>\n<script>window.__EMBER_BUNDLE__=1</script>\n');
swap('<link rel="icon" href="assets/icon.svg" type="image/svg+xml">','<link rel="icon" href="'+icon+'" type="image/svg+xml">');
swap('<link rel="stylesheet" href="css/ui.css">','<style>'+css+'</style>');
html=html.replace(/<script type="importmap">[\s\S]*?<\/script>\n?/,'');
swap('<script type="module" src="src/boot.js"></script>',
 '<script type="text/plain" id="ember-game">'+safe(game)+'\n//# sourceURL=ember-city-game.js</script>\n<script>'+safe(bootJs)+'</script>');

await mkdir(join(root,'dist'),{recursive:true});
await writeFile(join(root,'dist/ember-city.html'),html);
console.log(`dist/ember-city.html  ${(Buffer.byteLength(html)/1048576).toFixed(2)} MB  (${Date.now()-t0} ms)`);
