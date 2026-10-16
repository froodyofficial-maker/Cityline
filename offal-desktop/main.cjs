// OFFAL desktop app (Electron): the game in its own window, with its own copy of Chromium, so nothing depends on
// the browser installed on the PC. Kept deliberately careful with the graphics card:
// - no graphics flags: Chromium decides what the GPU and its driver can safely do
// - its compiled-shader caches are thrown away on every start (a crash mid-write leaves them corrupt, and then
//   every launch crashes)
// - safe graphics (drawn on the processor, the graphics driver never touched) when started with --safe, when the
//   last session ended without the window closing (the PC went down), or when the GPU process keeps dying;
//   --gpu turns it back off
// - if the page itself crashes it's reloaded, and the game puts you back exactly where you were
const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const fs = require('fs');

const ud = app.getPath('userData');
const running = path.join(ud, 'running'), safeFile = path.join(ud, 'safe-graphics');
const has = (a) => process.argv.some((x) => x.toLowerCase() === a);
try { fs.mkdirSync(ud, { recursive: true }); } catch {}
if (has('--gpu')) { try { fs.rmSync(safeFile, { force: true }); } catch {} }
else if (fs.existsSync(running)) { try { fs.writeFileSync(safeFile, 'The last session ended without the window closing.\nStart OFFAL with --gpu to use the graphics card again.\n'); } catch {} }
const safe = has('--safe') || fs.existsSync(safeFile);
if (safe) { app.disableHardwareAcceleration(); app.commandLine.appendSwitch('enable-unsafe-swiftshader'); } // 3D drawn on the processor (SwiftShader)
for (const c of ['GPUCache', 'ShaderCache', 'GrShaderCache', 'GraphiteDawnCache', 'DawnGraphiteCache', 'DawnWebGPUCache', 'Code Cache']) {
  try { fs.rmSync(path.join(ud, c), { recursive: true, force: true }); } catch {}
}
// saves from the old launcher (it ran the game in Edge with its own profile): bring them over the first time
try {
  const mine = path.join(ud, 'Local Storage');
  const old = path.join(process.env.LOCALAPPDATA || '', 'OFFAL', 'profile', 'Default', 'Local Storage');
  if (!fs.existsSync(mine) && process.env.LOCALAPPDATA && fs.existsSync(old)) fs.cpSync(old, mine, { recursive: true });
} catch {}
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-background-timer-throttling');

let win = null, gpuDeaths = 0;
function createWindow() {
  win = new BrowserWindow({
    width: 1600, height: 900, minWidth: 960, minHeight: 540,
    backgroundColor: '#000000', title: 'OFFAL', show: false, autoHideMenuBar: true,
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: { backgroundThrottling: false, contextIsolation: true, sandbox: true, spellcheck: false },
  });
  win.removeMenu();
  win.once('ready-to-show', () => { win.maximize(); win.show(); });
  // F11 / Alt+Enter toggle fullscreen, Ctrl+Shift+I opens devtools for debugging
  win.webContents.on('before-input-event', (e, i) => {
    if (i.type !== 'keyDown') return;
    if (i.key === 'F11' || (i.alt && i.key === 'Enter')) { win.setFullScreen(!win.isFullScreen()); e.preventDefault(); }
    else if (i.control && i.shift && i.key.toLowerCase() === 'i') win.webContents.toggleDevTools();
  });
  // never navigate away from the game; open external links in the browser
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e) => e.preventDefault());
  // the page crashed: load it again (the game saves the exact moment every few seconds)
  win.webContents.on('render-process-gone', (e, d) => { if (d.reason !== 'clean-exit') setTimeout(() => win && !win.isDestroyed() && load(), 500); });
  load();
}
function load() { win.loadFile(path.join(__dirname, 'game', 'offal.html'), safe ? { query: { safe: '1' } } : {}); }
// the graphics process keeps dying: from now on, safe graphics, and start again in it
app.on('child-process-gone', (e, d) => {
  if (d.type !== 'GPU' || safe || d.reason === 'clean-exit') return;
  if (++gpuDeaths >= 2) {
    try { fs.writeFileSync(safeFile, 'The graphics process kept crashing.\nStart OFFAL with --gpu to use the graphics card again.\n'); fs.rmSync(running, { force: true }); } catch {}
    app.relaunch({ args: process.argv.slice(1).filter((a) => a !== '--gpu') });
    app.exit(0);
  }
});

app.whenReady().then(() => { try { fs.writeFileSync(running, '1'); } catch {} createWindow(); });
app.on('window-all-closed', () => { try { fs.rmSync(running, { force: true }); } catch {} app.quit(); });
