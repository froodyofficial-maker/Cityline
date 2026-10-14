// Copies the single-file game build (../dist/ember-city.html, made by `npm run build` in the repo root) into the app.
const fs=require('fs'),path=require('path');
const src=path.join(__dirname,'..','dist','ember-city.html'),dst=path.join(__dirname,'game','ember-city.html');
if(!fs.existsSync(src)){console.error('dist/ember-city.html not found - run `npm run build` in the repo root first');process.exit(1)}
fs.mkdirSync(path.dirname(dst),{recursive:true});fs.copyFileSync(src,dst);console.log('game copied ('+(fs.statSync(dst).size/1048576).toFixed(2)+' MB)');
