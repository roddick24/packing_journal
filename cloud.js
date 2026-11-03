/* 雲端同步：每次操作以版本交易寫入，偵測其他裝置修改並避免直接覆蓋。 */
(async()=>{
 const ui=id=>document.getElementById('cloud-'+id),app=window.packingApp;
 const status=(text,error=false)=>{ui('status').textContent=text;ui('bar').dataset.error=String(error);};
 ui('backup').onclick=()=>app.exportData();
 const config=window.PACKING_FIREBASE_CONFIG;
 if(!config?.apiKey||!config?.projectId||!config?.authDomain||!config?.appId){status('本機模式｜尚未填入 Firebase 設定，資料不會跨裝置同步。');return;}
 let user=null,ref=null,revision=0,ready=false,busy=false,stop=null,loadToken=0;
 window.packingCloud={canWrite:()=>ready&&!busy&&navigator.onLine,push};
 let auth,db,authSDK,fs;
 const valid=d=>d&&Array.isArray(d.trips)&&d.trips.every(t=>typeof t.id==='string'&&typeof t.name==='string'&&Array.isArray(t.categories)&&Array.isArray(t.items)&&t.categories.every(c=>typeof c.id==='string'&&typeof c.name==='string')&&t.items.every(i=>typeof i.id==='string'&&typeof i.name==='string'&&typeof i.category==='string'));
 const fail=e=>{if(stop){stop();stop=null;}ready=false;busy=false;status('同步尚未完成｜本機修改已保留，請下載備份再重新讀取雲端。',true);ui('refresh').hidden=!user;app.toast(e.code==='packing/conflict'?'另一個裝置已更新清單，已暫停寫入，請備份後重新讀取。':`雲端連線失敗：${e.code||e.message||'請檢查網路與 Firebase 設定'}`);};
 try{
  const base='https://www.gstatic.com/firebasejs/13.1.0/';
  const [core,a,f]=await Promise.all([import(base+'firebase-app.js'),import(base+'firebase-auth.js'),import(base+'firebase-firestore.js')]);
  authSDK=a;fs=f;const firebaseApp=core.initializeApp(config);auth=a.getAuth(firebaseApp);db=f.getFirestore(firebaseApp);
  await a.setPersistence(auth,a.browserLocalPersistence);
  ui('login').hidden=false;
  ui('login').onclick=async()=>{try{const provider=new a.GoogleAuthProvider();provider.setCustomParameters({prompt:'select_account'});await a.signInWithPopup(auth,provider);}catch(e){status('登入未完成｜請允許登入視窗，並確認已設定授權網域。',true);app.toast(e.code||'登入未完成');}};
  ui('logout').onclick=async()=>{if(busy){app.toast('請等待同步完成再登出');return;}try{await a.signOut(auth);}catch(e){fail(e);}};
  ui('refresh').onclick=()=>{if(busy)return;confirmReload();};
  function confirmReload(){if(confirm('重新讀取會以雲端資料更新目前畫面。若有尚未同步的修改，請先點「下載備份」保留。確定重新讀取？'))load();}
  ui('upload').onclick=async()=>{
   if(!window.packingCloud.canWrite())return;
   try{const raw=localStorage.getItem('packing_journal_v1');if(!raw){app.toast('沒有原本的本機清單');return;}const old=JSON.parse(raw);if(!valid(old))throw Error('本機清單格式不正確');if(!confirm('將原本本機清單加入目前帳號？同 ID 的旅程會略過，不會取代雲端內容。'))return;const next=app.getData();for(const t of old.trips)if(!next.trips.some(x=>x.id===t.id))next.trips.push(t);await push(next);if(ready)app.applyRemote(next);}catch(e){fail(e);}
  };
  a.onAuthStateChanged(auth,async next=>{
   if(stop){stop();stop=null;}loadToken++;ready=false;busy=false;user=next;ui('login').hidden=!!user;ui('logout').hidden=!user;ui('upload').hidden=!user;ui('refresh').hidden=!user;
   if(!user){ref=null;app.switchAccount(null,{trips:[]});status('請登入 Google，開啟你的私人雲端清單。');return;}
   ref=f.doc(db,'packingUsers',user.uid);await load();
  });
 }catch(e){status('無法啟動雲端｜請檢查網路及 Firebase 設定，資料未上傳。',true);app.toast(e.code||e.message);}
 async function load(){
  if(!user||busy)return;const token=++loadToken,account=user.uid;ready=false;if(stop){stop();stop=null;}status('正在讀取雲端清單…');
  try{const snap=await fs.getDocFromServer(ref);if(token!==loadToken)return;const remote=snap.exists()?snap.data():{trips:[],revision:0};if(!valid(remote))throw Error('雲端資料格式不正確');revision=remote.revision||0;app.switchAccount(account,{trips:remote.trips});ready=true;status('已同步 · '+(user.email||'私人帳號'));
   stop=fs.onSnapshot(ref,{includeMetadataChanges:true},snap=>{if(token!==loadToken||busy||snap.metadata.hasPendingWrites||snap.metadata.fromCache)return;const d=snap.exists()?snap.data():{trips:[],revision:0};if(!valid(d)){fail(Error('雲端資料格式不正確'));return;}if((d.revision||0)>revision){revision=d.revision;app.applyRemote({trips:d.trips});status('已接收另一個裝置的更新');}},fail);
  }catch(e){if(token===loadToken)fail(e);}
 }
 async function push(next){
  if(!window.packingCloud.canWrite()){app.toast('目前無法同步，請等待同步完成或檢查網路');return;}
  const account=user.uid,documentRef=ref,expected=revision;busy=true;status('正在同步，請稍候…');
  try{await fs.runTransaction(db,async tx=>{const snap=await tx.get(documentRef);const actual=snap.exists()?(snap.data().revision||0):0;if(actual!==expected){const error=Error('資料版本已更新');error.code='packing/conflict';throw error;}tx.set(documentRef,{trips:next.trips,revision:actual+1,updatedAt:fs.serverTimestamp()});});if(user?.uid!==account)return;revision=expected+1;busy=false;ready=true;status('已同步 · '+(user.email||'私人帳號'));
   // 重建監聽，接收寫入等待期間其他裝置可能產生的更新。
   if(stop){stop();stop=null;}
   const token=loadToken;stop=fs.onSnapshot(ref,{includeMetadataChanges:true},snap=>{if(token!==loadToken||busy||snap.metadata.hasPendingWrites||snap.metadata.fromCache||!snap.exists())return;const d=snap.data();if(!valid(d)){fail(Error('雲端資料格式不正確'));return;}if(d.revision>revision){revision=d.revision;app.applyRemote({trips:d.trips});status('已接收另一個裝置的更新');}},fail);
  }catch(e){if(user?.uid===account)fail(e);}
 }
 window.addEventListener('offline',()=>status('目前離線｜已暫停編輯，連線後可繼續。',true));
 window.addEventListener('online',()=>{if(user&&ready&&!busy)load();});
 window.addEventListener('beforeunload',e=>{if(busy){e.preventDefault();e.returnValue='';}});
})();
