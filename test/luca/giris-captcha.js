const {chromium}=require('playwright');
const Module=require('module');const orig=Module._load;let js=null;
Module._load=function(r,...a){if(r==='electron')return {BrowserWindow:class{},session:{}};return orig.call(this,r,...a);};
const L=require(''+require('path').join(__dirname,'..','..','luca.js')+'');L.init({parent:null,getCreds:()=>({uyeno:'1',kullanici:'a',parola:'p'}),getRequiredUye:()=>''});
// autofillLogin dışa açık değil: modül kaynağından çalıştırılacak JS'yi kur
(async()=>{const b=await chromium.launch();const p=await b.newPage();
 await p.setContent(`<a href=# id=eimza onclick='window.yanlis=1'>E-İmza ile Giriş</a><form onsubmit="return false"><input id=musteriNo><input id=kullaniciAdi><input id=parola type=password><img src="data:,"><input id=guvenlikKodu placeholder="Güvenlik Kodu"><button type=button id=g onclick="window.basildi=1">GİRİŞ</button></form>`);
 const wc={getURL:()=>'https://agiris.luca.com.tr/LUCASSO/giris.erp',executeJavaScript:(s)=>p.evaluate(s)};
 // luca.js içindeki autofillLogin'e erişim için kaynaktan eval
 const src=require('fs').readFileSync(''+require('path').join(__dirname,'..','..','luca.js')+'','utf8');
 const fn=src.slice(src.indexOf('function autofillLogin'),src.indexOf('// Luca boşta kalınca'));
 const getCreds=()=>({uyeno:'1',kullanici:'a',parola:'p'}),getRequiredUye=()=>'',normUye=x=>String(x||'').replace(/\D/g,'');
 eval(fn+';autofillLogin(wc)');await p.waitForTimeout(300);
 console.log('odak',await p.evaluate(()=>document.activeElement.id),'dolu',await p.evaluate(()=>[musteriNo.value,kullaniciAdi.value,!!parola.value].join()));
 await p.keyboard.type('7K3P');await p.keyboard.press('Enter');
 console.log('giriş basıldı',await p.evaluate(()=>window.basildi===1),'e-imza basılmadı',await p.evaluate(()=>!window.yanlis));await b.close();})();
