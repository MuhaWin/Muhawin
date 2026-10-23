const Module=require('module');const orig=Module._load;let tum=[];let jsSonuc='';
class W{constructor(o){this.o=o||{};this.url='';this.d=false;this.min=false;this.max=false;this.h={};this.wh={};tum.push(this);const self=this;
  this.webContents={getURL:()=>this.url,on:(e,f)=>{(self.wh[e]=self.wh[e]||[]).push(f);},once:(e,f)=>{(self.wh[e]=self.wh[e]||[]).push(f);},setWindowOpenHandler:()=>{},executeJavaScript:async()=>null,
    mainFrame:{get framesInSubtree(){return [{executeJavaScript:async()=>jsSonuc}];}},session:{webRequest:{onBeforeRequest(){},onCompleted(){}}}};}
  removeMenu(){} setTitle(){} on(e,f){this.h[e]=f;} once(e,f){this.h[e]=f;} loadURL(u){this.url=u;} isDestroyed(){return this.d;} isMinimized(){return this.min;} restore(){this.min=false;} show(){} focus(){} maximize(){this.max=true;} setAlwaysOnTop(){} moveTop(){} minimize(){this.min=true;} isVisible(){return true;} close(){this.d=true;this.h.closed&&this.h.closed();}}
Module._load=function(r,...a){if(r==='electron')return {BrowserWindow:W,session:{fromPartition:()=>({clearStorageData:async()=>{}})}};return orig.call(this,r,...a);};
const L=require(''+require('path').join(__dirname,'..','..','luca.js')+'');const olay=[];L.init({parent:null,notify:(e,d)=>olay.push(e)});
const cocuk=(w,url)=>{const c=new W({});c.url=url;(w.wh['did-create-window']||[]).forEach(f=>f(c));return c;};
(async()=>{
  L.openLogin();const g=tum[0];g.url='https://agiris.luca.com.tr/LUCASSO/main.erp';
  const app=cocuk(g,'https://auygs.luca.com.tr/Luca/luca.do');
  console.log('bagli',(await L.status()).loggedIn);
  // 1) düğme bulunamadı → elle; kullanıcı Luca'daki düğmeye basınca açılan pencere çalışma penceresi olur
  jsSonuc='';const r1=await L.calis();console.log('elle',JSON.stringify(r1));
  const yeni=cocuk(app,'https://auygs.luca.com.tr/Luca/luca.do');console.log('sahiplenildi ve tam ekran',yeni.max);
  console.log('appWindow çalışma penceresi değil',(await L.status()).url===app.url);
  const r2=await L.calis();console.log('ikinci basış mevcut',JSON.stringify(r2),tum.length);
  // 2) çalışma penceresi kapandı; program düğmeye basar, açılan pencere sahiplenilir
  yeni.close();jsSonuc='<a onclick=...>';const p=L.calis();setTimeout(()=>cocuk(app,'https://auygs.luca.com.tr/Luca/luca.do'),300);const r3=await p;console.log('otomatik',JSON.stringify(r3),tum[tum.length-1].max);
  // 3) sahiplenme dışında Luca'nın açtığı ek pencere programa döndürmez (programaDon atlar) ve tam ekran zorlanmaz
  const ek=cocuk(app,'https://auygs.luca.com.tr/Luca/rapor.do');console.log('ek pencere tam ekran değil',!ek.max);
  process.exit(0);
})().catch(e=>{console.log('ERR',e);process.exit(1);});
