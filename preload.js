const { contextBridge, ipcRenderer } = require('electron');
const LEGACY_KEY='vyaparCounterDB_v2';
let legacyValue=null;try{legacyValue=window.localStorage.getItem(LEGACY_KEY)}catch(e){}
const localStore={
 getItem(k){return ipcRenderer.sendSync('db:get-sync',String(k))},
 setItem(k,v){ipcRenderer.sendSync('db:set-sync',String(k),String(v))},
 removeItem(k){ipcRenderer.sendSync('db:remove-sync',String(k))},
 clear(){ipcRenderer.sendSync('db:clear-sync')},
 key(i){const a=JSON.parse(ipcRenderer.sendSync('db:keys-sync')||'[]');return a[i]??null},
 get length(){return Number(ipcRenderer.sendSync('db:count-sync')||0)}
};
try{Object.defineProperty(window,'localStorage',{value:localStore,configurable:false})}catch(e){}
contextBridge.exposeInMainWorld('vyaparDesktop',{exportDatabase:()=>ipcRenderer.invoke('db:export'),importDatabase:()=>ipcRenderer.invoke('db:import'),openBackupFolder:()=>ipcRenderer.invoke('backup:open-folder'),getLastAutoBackup:()=>ipcRenderer.invoke('backup:last-auto'),getDataLocation:()=>ipcRenderer.invoke('data:get-location'),chooseDataLocation:()=>ipcRenderer.invoke('data:choose-location'),openDataLocation:()=>ipcRenderer.invoke('data:open-location')});
if(legacyValue){try{ipcRenderer.send('db:migrate-sync',LEGACY_KEY,legacyValue)}catch(e){}}
