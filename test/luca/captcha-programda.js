// Gizli girişte doğrulama kodu resmi programa alınır, kullanıcının yazdığı kod Luca'ya girilip yalnız "Giriş" basılır
const {chromium}=require('playwright');const fs=require('fs'),path=require('path');
const src=fs.readFileSync(path.join(__dirname,'..','..','luca.js'),'utf8');
const cut=(a,b)=>src.slice(src.indexOf(a),src.indexOf(b,src.indexOf(a)));
eval(cut('const CAPTCHA_BUL_JS','function girisPenceresi').replace(/^const /gm,'var '));
(async()=>{const b=await chromium.launch();const p=await b.newPage();let ok=true;const t=(ad,v)=>{console.log(v?'✓':'✗',ad);ok=ok&&v;};
 await p.setContent(`<a href=# onclick='window.yanlis=1'>E-İmza ile Giriş</a><form onsubmit="window.gonder=1;return false"><input id=musteriNo value=1><input id=kullaniciAdi value=a><input id=parola type=password value=p>
  <canvas id=c width=120 height=40></canvas><input id=guvenlikKodu placeholder="Güvenlik Kodu"><button type=button onclick="window.tamam=1">Tamam</button><button type=button id=g onclick="window.basildi=guvenlikKodu.value">GİRİŞ</button></form>
  <script>const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,120,40);x.fillStyle='#000';x.font='20px sans-serif';x.fillText('7K3P',20,28);</script>`);
 const r=await p.evaluate(CAPTCHA_BUL_JS);
 t('kod kutusu bulundu',r.cap===true&&r.giris===true);t('resim alındı',/^data:image\/png;base64,/.test(r.resim)&&r.resim.length>200);
 t('Giriş sonucu',await p.evaluate(GIRIS_BAS_JS(' 7K3P '.trim()))==='basildi');
 t('kod yazılıp GİRİŞ basıldı',await p.evaluate(()=>window.basildi)==='7K3P');
 t('E-İmza / Tamam basılmadı',await p.evaluate(()=>!window.yanlis&&!window.tamam));
 await p.setContent(`<form><input id=musteriNo><input id=parola type=password><button type=button onclick="window.b=1">Giriş Yap</button></form>`);
 const r2=await p.evaluate(CAPTCHA_BUL_JS);t('kodsuz form tanınır',r2.cap===false&&r2.giris===true);
 t('kodsuz Giriş basılır',await p.evaluate(GIRIS_BAS_JS(null))==='basildi'&&await p.evaluate(()=>window.b===1));
 await b.close();process.exit(ok?0:1);})();
