// Copies the single-file build (../dist/offal.html, made by `npm run build:offal` in the repo root) into the app.
const fs=require('fs'),path=require('path');
const src=path.join(__dirname,'..','dist','offal.html'),dst=path.join(__dirname,'game','offal.html');
if(!fs.existsSync(src)){console.error('dist/offal.html not found - run `npm run build:offal` in the repo root first');process.exit(1)}
fs.mkdirSync(path.dirname(dst),{recursive:true});fs.copyFileSync(src,dst);
// --cinema: the OFFAL Cinema app is the same game with its shot list switched on
if(process.argv.includes('--cinema')){const h=fs.readFileSync(dst,'utf8').replace('<head>','<head><script>window.OFFAL_CINEMA=true</script>');fs.writeFileSync(dst,h);console.log('cinema build');}
console.log('game copied ('+(fs.statSync(dst).size/1048576).toFixed(2)+' MB)');
