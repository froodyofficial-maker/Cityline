// Builds offal-launcher/OFFAL.exe (and OFFAL-safe.exe, the same exe, which starts with safe graphics): a ~2 MB Windows launcher with the game embedded, which opens it in
// its own Edge/Chrome app window. Needs Go. Usage: `npm run launcher:win` (builds dist/offal.html first).
import {copyFile} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
const root=join(dirname(fileURLToPath(import.meta.url)),'..'),dir=join(root,'offal-launcher');
await copyFile(join(root,'dist/offal.html'),join(dir,'offal.html'));
execFileSync('go',['build','-trimpath','-ldflags','-H windowsgui -s -w','-o','OFFAL.exe','.'],{cwd:dir,stdio:'inherit',env:{...process.env,GOOS:'windows',GOARCH:'amd64',CGO_ENABLED:'0'}});
// the same exe under another name starts in safe graphics (no GPU): for PCs whose graphics driver can't cope
await copyFile(join(dir,'OFFAL.exe'),join(dir,'OFFAL-safe.exe'));
console.log('offal-launcher/OFFAL.exe, offal-launcher/OFFAL-safe.exe');
