// Görev 18: kayıtlı Luca bilgisiyle gizli açılan giriş penceresi hiçbir durumda görünmez kalmamalı
const Module=require('module');const orig=Module._load;const tum=[];let jsSonuc=null;
class W{constructor(o){this.o=o||{};this.url='';this.d=false;this.gor=o&&o.show!==false;this.gosterildi=0;this.wh={};tum.push(this);const self=this;
  this.webContents={getURL:()=>this.url,on:(e,f)=>{(self.wh[e]=self.wh[e]||[]).push(f);},once:(e,f)=>{(self.wh[e]=self.wh[e]||[]).push(f);},setWindowOpenHandler:()=>{},
    executeJavaScript:async()=>jsSonuc,capturePage:async()=>({isEmpty:()=>true}),mainFrame:{framesInSubtree:[]},session:{webRequest:{onBeforeRequest(){},onCompleted(){}}}};}
  removeMenu(){} setTitle(){} on(){} once(){} loadURL(u){this.url=u;} isDestroyed(){return this.d;} isMinimized(){return false;} restore(){} show(){this.gor=true;this.gosterildi++;} focus(){} isVisible(){return this.gor;}}
Module._load=function(r,...a){if(r==='electron')return {BrowserWindow:W,session:{fromPartition:()=>({clearStorageData:async()=>{}})}};return orig.call(this,r,...a);};
const L=require(require('path').join(__dirname,'..','..','luca.js'));const olay=[];
L.init({parent:null,notify:(e,d)=>olay.push([e,d]),getCreds:()=>({uyeno:'1',kullanici:'a',parola:'p'})});
const yay=(w,e,...a)=>(w.wh[e]||[]).forEach(f=>f({},...a));
let ok=true;const t=(ad,v)=>{console.log(v?'✓':'✗',ad);ok=ok&&v;};
(async()=>{
  // 1) giriş sayfası yüklendi ama form tanınmadı (Luca sayfası değişmiş): pencere gösterilir, programdaki kutu kapanır
  const r=L.openLogin();const w=tum[0];
  t('kayıtlı bilgiyle pencere gizli açılır',r.gizli===true&&!w.gor);
  jsSonuc=null;yay(w,'did-finish-load');await new Promise(x=>setTimeout(x,11500));
  t('form tanınmazsa pencere gösterilir',w.gor&&w.gosterildi>0);
  t('programa "kod resmi yok" bildirilir',olay.some(([e,d])=>e==='captcha'&&d&&d.yok));
  w.d=true;yay(w,'closed');
  // 2) giriş sayfası hiç yüklenemedi (ağ hatası): pencere gösterilir
  tum.length=0;const r2=L.openLogin();const w2=tum[tum.length-1];
  t('ikinci açılış gizli',r2.gizli===true&&!w2.gor);
  yay(w2,'did-fail-load',-106,'ERR_INTERNET_DISCONNECTED','https://agiris.luca.com.tr/LUCASSO/giris.erp',true);
  t('yüklenemezse pencere gösterilir',w2.gor);
  // 3) form ve doğrulama kodu bulundu: pencere gizli kalır, kod programda sorulur (mevcut davranış)
  w2.d=true;tum.length=0;L.openLogin();const w3=tum[tum.length-1];olay.length=0;
  jsSonuc={cap:true,giris:true,hata:'',resim:'data:image/png;base64,AAAA'};yay(w3,'did-finish-load');await new Promise(x=>setTimeout(x,900));
  t('kod bulununca pencere gizli kalır ve kod programda sorulur',!w3.gor&&olay.some(([e,d])=>e==='captcha'&&d&&d.resim));
  process.exit(ok?0:1);
})().catch(e=>{console.log('ERR',e);process.exit(1);});
