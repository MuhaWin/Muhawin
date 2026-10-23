const Module=require('module');const orig=Module._load;let tum=[];
const cookies=[{name:'JSESSIONID',value:'s1',domain:'auygs.luca.com.tr',hostOnly:true,path:'/Luca',secure:true,httpOnly:true,session:true,sameSite:'unspecified'},
 {name:'SSO',value:'s2',domain:'.luca.com.tr',hostOnly:false,path:'/',secure:true,httpOnly:false,session:false,expirationDate:1893456000.5,sameSite:'no_restriction'},
 {name:'x',value:'y',domain:'.google.com',hostOnly:false,path:'/'}];
class W{constructor(){this.url='';this.d=false;this.min=false;this.h={};this.wh={};tum.push(this);const self=this;
  this.webContents={getURL:()=>this.url,on:(e,f)=>{(self.wh[e]=self.wh[e]||[]).push(f);},once:(e,f)=>{(self.wh[e]=self.wh[e]||[]).push(f);},setWindowOpenHandler:()=>{},executeJavaScript:async()=>null,
    mainFrame:{framesInSubtree:[]},session:{webRequest:{onBeforeRequest(){},onCompleted(){}}}};}
  removeMenu(){} setTitle(){} on(e,f){this.h[e]=f;} once(){} loadURL(u){this.url=u;} isDestroyed(){return this.d;} isMinimized(){return this.min;} restore(){this.min=false;} show(){} focus(){this.focused=Date.now();} maximize(){} setAlwaysOnTop(){} moveTop(){} minimize(){this.min=true;} isVisible(){return !this.min;} close(){this.d=true;}}
Module._load=function(r,...a){if(r==='electron')return {BrowserWindow:W,session:{fromPartition:()=>({cookies:{get:async()=>cookies},clearStorageData:async()=>{}})}};return orig.call(this,r,...a);};
const L=require(''+require('path').join(__dirname,'..','..','luca.js')+'');const parent=new W();tum=[];L.init({parent,notify:()=>{}});
(async()=>{
  console.log(JSON.stringify(await L.oturumCerezleri()));
  L.openLogin();const g=tum[0];g.url='https://agiris.luca.com.tr/LUCASSO/main.erp';
  const app=new W();app.url='https://auygs.luca.com.tr/Luca/luca.do';(g.wh['did-create-window']||[]).forEach(f=>f(app));
  const t0=Date.now();(app.wh['did-navigate']||[]).forEach(f=>f());
  await new Promise(r=>setTimeout(r,50));
  console.log('programa dönüş (ms):', parent.focused? parent.focused-t0 : 'yok', 'luca küçültüldü:', app.min&&g.min);
  process.exit(0);
})();
