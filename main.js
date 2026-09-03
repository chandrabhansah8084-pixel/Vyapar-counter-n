const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;
let store = {};
let currentDataDir = '';
let saveTimer = null;

function configPath(){ return path.join(app.getPath('userData'), 'data-location.json'); }
function defaultDataDir(){ return path.join(app.getPath('userData'), 'data'); }
function configuredDataDir(){
  try {
    const o = JSON.parse(fs.readFileSync(configPath(),'utf8'));
    if(o && o.path && fs.existsSync(o.path) && fs.statSync(o.path).isDirectory()) return path.resolve(o.path);
  } catch(e) {}
  return defaultDataDir();
}
function dataFile(dir=currentDataDir){ return path.join(dir,'vyapar-data.json'); }
function ensureDir(dir){ fs.mkdirSync(dir,{recursive:true}); }
function loadStore(){
  currentDataDir = configuredDataDir(); ensureDir(currentDataDir);
  try { store = JSON.parse(fs.readFileSync(dataFile(currentDataDir),'utf8')) || {}; }
  catch(e){ store = {}; }
}
function saveStore(){
  ensureDir(currentDataDir);
  const tmp = dataFile(currentDataDir)+'.tmp';
  fs.writeFileSync(tmp, JSON.stringify(store), 'utf8');
  fs.renameSync(tmp, dataFile(currentDataDir));
}
function scheduleSave(){ clearTimeout(saveTimer); saveTimer=setTimeout(()=>{try{saveStore()}catch(e){console.error(e)}},100); }
function backupDir(){ return path.join(app.getPath('documents'),'Vyapar Counter Backups'); }
function createBackup(reason='manual'){
  ensureDir(backupDir());
  const stamp=new Date().toISOString().replace(/[:.]/g,'-');
  const file=path.join(backupDir(),`Vyapar-Counter-${reason}-${stamp}.json`);
  fs.copyFileSync(dataFile(),file); return file;
}
function dailyBackup(){
  try{
    const dir=backupDir(); ensureDir(dir); const marker=path.join(dir,'.last-auto-backup');
    const today=new Date().toISOString().slice(0,10);
    let last=''; try{last=fs.readFileSync(marker,'utf8').trim()}catch(e){}
    if(last===today)return;
    createBackup('auto-daily'); fs.writeFileSync(marker,today,'utf8');
  }catch(e){console.error('Auto backup failed',e)}
}

function syncHandlers(){
  ipcMain.on('db:get-sync',(e,k)=>{e.returnValue=Object.prototype.hasOwnProperty.call(store,String(k))?store[String(k)]:null});
  ipcMain.on('db:set-sync',(e,k,v)=>{store[String(k)]=String(v); scheduleSave(); e.returnValue=true});
  ipcMain.on('db:remove-sync',(e,k)=>{delete store[String(k)]; scheduleSave(); e.returnValue=true});
  ipcMain.on('db:clear-sync',e=>{store={}; scheduleSave(); e.returnValue=true});
  ipcMain.on('db:keys-sync',e=>{e.returnValue=JSON.stringify(Object.keys(store))});
  ipcMain.on('db:count-sync',e=>{e.returnValue=Object.keys(store).length});
  ipcMain.on('db:migrate-sync',(e,k,v)=>{if(!Object.prototype.hasOwnProperty.call(store,String(k))&&v!=null){store[String(k)]=String(v);scheduleSave()} e.returnValue=true});
}
function asyncHandlers(){
  ipcMain.handle('db:get',(_e,k)=>Object.prototype.hasOwnProperty.call(store,String(k))?store[String(k)]:null);
  ipcMain.handle('db:set',(_e,k,v)=>{store[String(k)]=String(v);saveStore();return true});
  ipcMain.handle('db:remove',(_e,k)=>{delete store[String(k)];saveStore();return true});
  ipcMain.handle('db:clear',()=>{store={};saveStore();return true});
  ipcMain.handle('db:migrate',(_e,k,v)=>{if(!Object.prototype.hasOwnProperty.call(store,String(k))&&v!=null){store[String(k)]=String(v);saveStore();return true}return false});
  ipcMain.handle('db:export',()=>{try{saveStore();return createBackup('manual')}catch(e){return null}});
  ipcMain.handle('db:import',async()=>{
    const r=await dialog.showOpenDialog({properties:['openFile'],filters:[{name:'Vyapar Data',extensions:['json']}]});
    if(r.canceled||!r.filePaths[0])return false;
    try{const incoming=JSON.parse(fs.readFileSync(r.filePaths[0],'utf8')); if(!incoming||typeof incoming!=='object')throw Error('Invalid data file'); createBackup('before-restore'); store=incoming; saveStore(); return true}catch(e){console.error(e);return false}
  });
  ipcMain.handle('data:get-location',()=>currentDataDir);
  ipcMain.handle('data:choose-location',async()=>{
    const r=await dialog.showOpenDialog({title:'Vyapar Counter Data Folder चुनें',properties:['openDirectory','createDirectory']});
    if(r.canceled||!r.filePaths[0])return {ok:false,cancelled:true};
    const target=path.resolve(r.filePaths[0]);
    if(target.toLowerCase()===currentDataDir.toLowerCase())return {ok:true,path:target,same:true};
    try{
      ensureDir(target);
      const test=path.join(target,`.vyapar-test-${Date.now()}.tmp`); fs.writeFileSync(test,'ok'); fs.unlinkSync(test);
      const targetFile=dataFile(target);
      if(fs.existsSync(targetFile)){
        const q=await dialog.showMessageBox({type:'warning',buttons:['Use Existing','Replace with Current Data','Cancel'],defaultId:0,cancelId:2,title:'Data Folder में पहले से Data है',message:'इस folder में Vyapar Counter data पहले से मौजूद है।'});
        if(q.response===2)return {ok:false,cancelled:true};
        if(q.response===0){ store=JSON.parse(fs.readFileSync(targetFile,'utf8'))||{}; }
        else { saveStoreTo(target); }
      } else saveStoreTo(target);
      fs.writeFileSync(configPath(),JSON.stringify({path:target},null,2),'utf8');
      currentDataDir=target; loadStore(); return {ok:true,path:target,restart:false};
    }catch(e){console.error(e);return {ok:false,error:String(e.message||e)}}
  });
  ipcMain.handle('data:open-location',async()=>{ensureDir(currentDataDir);await shell.openPath(currentDataDir);return currentDataDir});
  ipcMain.handle('backup:open-folder',async()=>{ensureDir(backupDir());await shell.openPath(backupDir());return backupDir()});
  ipcMain.handle('backup:last-auto',()=>{const d=backupDir();if(!fs.existsSync(d))return null;const a=fs.readdirSync(d).filter(f=>f.startsWith('Vyapar-Counter-auto-daily-')&&f.endsWith('.json')).sort().reverse();return a[0]?path.join(d,a[0]):null});
}
function saveStoreTo(dir){ensureDir(dir);const tmp=path.join(dir,'vyapar-data.json.tmp');fs.writeFileSync(tmp,JSON.stringify(store),'utf8');fs.renameSync(tmp,path.join(dir,'vyapar-data.json'))}
function createWindow(){mainWindow=new BrowserWindow({width:1400,height:900,minWidth:1050,minHeight:700,backgroundColor:'#eef3f8',webPreferences:{preload:path.join(__dirname,'preload.js'),contextIsolation:true,nodeIntegration:false}});mainWindow.loadFile(path.join(__dirname,'index.html'));}
app.whenReady().then(()=>{loadStore();syncHandlers();asyncHandlers();createWindow();setTimeout(dailyBackup,1500);app.on('activate',()=>{if(BrowserWindow.getAllWindows().length===0)createWindow()})});
app.on('before-quit',()=>{try{clearTimeout(saveTimer);saveStore()}catch(e){}});
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit()});
