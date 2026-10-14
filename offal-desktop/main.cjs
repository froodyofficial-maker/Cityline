// OFFAL desktop app (Electron). Runs the single-file build in its own window with
// GPU-friendly settings: the high-performance graphics card, no background throttling,
// and the GPU blocklist ignored so older laptop drivers still get WebGL2 acceleration.
const {app,BrowserWindow,shell}=require('electron');
const path=require('path');

app.commandLine.appendSwitch('force_high_performance_gpu');
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-background-timer-throttling');

function createWindow(){
 const win=new BrowserWindow({
  width:1600,height:900,minWidth:960,minHeight:540,
  backgroundColor:'#000000',title:'OFFAL',show:false,autoHideMenuBar:true,
  icon:path.join(__dirname,'icon.png'),
  webPreferences:{backgroundThrottling:false,contextIsolation:true,sandbox:true,spellcheck:false}
 });
 win.removeMenu();
 win.once('ready-to-show',()=>{win.maximize();win.show()});
 // F11 / Alt+Enter toggle fullscreen, Ctrl+Shift+I opens devtools for debugging
 win.webContents.on('before-input-event',(e,i)=>{
  if(i.type!=='keyDown')return;
  if(i.key==='F11'||(i.alt&&i.key==='Enter')){win.setFullScreen(!win.isFullScreen());e.preventDefault()}
  else if(i.control&&i.shift&&i.key.toLowerCase()==='i')win.webContents.toggleDevTools();
 });
 // never navigate away from the game; open external links in the browser
 win.webContents.setWindowOpenHandler(({url})=>{shell.openExternal(url);return{action:'deny'}});
 win.webContents.on('will-navigate',e=>e.preventDefault());
 win.loadFile(path.join(__dirname,'game','offal.html'));
}

app.whenReady().then(createWindow);
app.on('window-all-closed',()=>app.quit());
