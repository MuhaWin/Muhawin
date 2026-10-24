/* MuhaWin arayüz betiği (Görev 28: renderer/index.html içindeki satır içi betikten ayrıldı; CSP script-src 'self') */
(function(){
'use strict';
/* ---------- tema ---------- */
const SKINS=[
  ['muhawin','MuhaWin','Lacivert · turkuaz (varsayılan)',['#eef2f7','#ffffff','#16325C','#12B5A0']],
  ['defter','Defter','Açık · yeşil vurgu',['#eef2f0','#ffffff','#0d5c4f']],
  ['kirmizi','Kırmızı','Açık · canlı kırmızı ağırlıklı',['#f6dde0','#ffffff','#c8102e','#8f0b20']],
  ['kum','Kum','Açık · krem, bakır vurgu',['#f6f2ea','#fffdf8','#9a5b13']],
  ['grafit','Grafit','Koyu · mavi vurgu',['#111317','#191c22','#7aa7ff']],
  ['kontrast','Yüksek kontrast','Okunabilirlik için güçlü renkler',['#ffffff','#f0f0f0','#0039b3']]
];
function applySkin(id){if(id)document.documentElement.setAttribute('data-skin',id);else document.documentElement.removeAttribute('data-skin');}
let curSkin='muhawin';try{const v=localStorage.getItem('ekstre-luca-skin');if(v!==null)curSkin=v;}catch(e){}
// birbirine yakın temalar kaldırıldı (Görev 17): eski seçim en yakın kalan temaya düşer
{const ESKI={lacivert:'muhawin',zumrut:'defter',bordo:'kirmizi',gece:'grafit'};if(ESKI[curSkin]){curSkin=ESKI[curSkin];try{localStorage.setItem('ekstre-luca-skin',curSkin);}catch(e){}}}
if(!SKINS.some(s=>s[0]===curSkin))curSkin='muhawin';applySkin(curSkin);   // 'Sistem' teması 2.9.6'da kaldırıldı
/* ---------- yardımcılar ---------- */
const $=(s,r=document)=>r.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const N=s=>String(s??'').toLocaleUpperCase('tr-TR').replace(/İ/g,'I').replace(/Ş/g,'S').replace(/Ğ/g,'G').replace(/Ü/g,'U').replace(/Ö/g,'O').replace(/Ç/g,'C').replace(/[ÂÀÁ]/g,'A').replace(/[ÎÌÍ]/g,'I').replace(/[ÛÙÚ]/g,'U').replace(/[^A-Z0-9]+/g,' ').trim();
// Kural ifadesi: "A | B" → A ya da B; "KİRA + OCAK" → ikisi de geçmeli (sırası/yeri önemsiz). 3 harf ve kısası tam kelime.
const kuralParcalari=k=>String(k||'').split('|').map(a=>a.split('+').map(N).filter(Boolean)).filter(x=>x.length);
const parcaTutar=(parts,d)=>parts.every(a=>a.length<=3?d.includes(' '+a+' '):d.includes(a));
// Kural şartları (Görev 21): k = 1. şart, ek = 2., 3. … şartlar; hepsi birlikte tutmalı (VE). Her şartın içinde | = ya da, + = hepsi.
// Eski kurallarda ek yok: tek şart, bugünkü gibi. eylem: '' / 'kaydet' = karşı hesaba kaydet · 'atla' = hiç kaydetme (fişe alma)
const kuralSartlari=r=>[r.k,...(Array.isArray(r.ek)?r.ek:[])].map(x=>String(x||'').trim()).filter(x=>kuralParcalari(x).length);
const kuralMetni=r=>kuralSartlari(r).join('  VE  ');
const kuralAtla=r=>r&&r.eylem==='atla';
const kuralTutar=(k,metinN)=>{const d=' '+metinN+' ';return kuralParcalari(k).some(p=>parcaTutar(p,d));};
const fmt=n=>(+n).toLocaleString('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:2});
const pad=n=>String(n).padStart(2,'0');
const fmtD=d=>d?`${pad(d.getDate())}.${pad(d.getMonth()+1)}.${d.getFullYear()}`:'';
const r2=n=>Math.round(n*100)/100;
const uid=()=>Math.random().toString(36).slice(2,9)+Date.now().toString(36).slice(-5);
let toastT;
const toastK=[];                      // {msg,n}
function toast(msg){msg=String(msg==null?'':msg);const t=$('#toast');const son=toastK[toastK.length-1];
  if(son&&son.msg===msg)son.n++;else toastK.push({msg,n:1});while(toastK.length>3)toastK.shift();
  t.innerHTML=toastK.map(x=>`<div>${esc(x.msg)}${x.n>1?` <span class="note">×${x.n}</span>`:''}</div>`).join('');t.hidden=false;
  clearTimeout(toastT);toastT=setTimeout(()=>{t.hidden=true;toastK.length=0;},msg.length>90?5200:3600);}
// arayüz hataları günlüğe (Belgeler\MuhaWin Günlük\hatalar.log)
window.addEventListener('error',e=>{try{window.desktop.hata.yaz((e.message||'')+' @'+(e.filename||'').split('/').pop()+':'+e.lineno+' '+(e.error&&e.error.stack||'').slice(0,600));}catch(x){}});
window.addEventListener('unhandledrejection',e=>{try{const r=e.reason;window.desktop.hata.yaz('promise: '+String(r&&r.message||r)+' '+(r&&r.stack||'').slice(0,600));}catch(x){}});

const AYLAR={OCAK:1,SUBAT:2,MART:3,NISAN:4,MAYIS:5,HAZIRAN:6,TEMMUZ:7,AGUSTOS:8,EYLUL:9,EKIM:10,KASIM:11,ARALIK:12};
const mk=(y,mo,d)=>{if(mo<1||mo>12||d<1||d>31||y<1990||y>2100)return null;const dt=new Date(y,mo-1,d);return dt.getDate()===d?dt:null;};
function parseDate(v){
  if(v==null||v==='')return null;
  if(v instanceof Date)return isNaN(v)?null:new Date(v.getFullYear(),v.getMonth(),v.getDate());
  if(typeof v==='number'){if(v>20000&&v<80000&&window.XLSX){const p=XLSX.SSF.parse_date_code(v);return mk(p.y,p.m,p.d);}return null;}
  const s=String(v).trim();let m;
  if((m=s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4}|\d{2})(?!\d)/))){let y=+m[3];if(y<100)y+=2000;return mk(y,+m[2],+m[1]);}
  if((m=s.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})/)))return mk(+m[1],+m[2],+m[3]);
  const n=N(s);if((m=n.match(/^(\d{1,2}) ([A-Z]+) (\d{4})/))&&AYLAR[m[2]])return mk(+m[3],AYLAR[m[2]],+m[1]);
  return null;
}
function parseAmount(v){
  if(v==null||v==='')return null;
  if(typeof v==='number')return isFinite(v)?{v,neg:v<0,flag:null}:null;
  let s=String(v).trim();if(!s)return null;
  let flag=null,neg=false;
  const fm=s.match(/\(?\s*([BAba])\s*\)?$/);
  if(fm&&/\d/.test(s.slice(0,fm.index))){flag=fm[1].toUpperCase();s=s.slice(0,fm.index).trim();}
  s=s.replace(/TL|TRY|₺|USD|EUR|\s/gi,'');
  if(/^\(.*\)$/.test(s)){neg=true;s=s.slice(1,-1);}
  if(/^-|-$/.test(s))neg=true;
  s=s.replace(/^[-+]+|-+$/g,'');
  if(!/^[\d.,]+$/.test(s)||!/\d/.test(s))return null;
  const lc=s.lastIndexOf(','),ld=s.lastIndexOf('.');let num;
  if(lc>=0&&ld>=0)num=lc>ld?s.replace(/\./g,'').replace(',','.'):s.replace(/,/g,'');
  else if(lc>=0){const p=s.split(',');num=(p.length===2&&p[1].length!==3)?s.replace(',','.'):s.replace(/,/g,'');}
  else if(ld>=0){const p=s.split('.');num=(p.length>2||p[1].length===3)?s.replace(/\./g,''):s;}
  else num=s;
  let n=parseFloat(num);if(!isFinite(n))return null;if(neg)n=-n;
  return {v:n,neg,flag};
}
function signedVal(a){if(!a)return null;let v=a.v;if(a.flag==='B')v=-Math.abs(v);else if(a.flag==='A')v=Math.abs(v);return v;}

const BANKS=[['ZIRAAT KATILIM','Ziraat Katılım'],['VAKIF KATILIM','Vakıf Katılım'],['EMLAK KATILIM','Emlak Katılım'],['ZIRAAT','Ziraat Bankası'],['HALKBANK','Halkbank'],['HALK BANKASI','Halkbank'],['VAKIFBANK','VakıfBank'],['VAKIFLAR BANKASI','VakıfBank'],['IS BANKASI','İş Bankası'],['ISBANK','İş Bankası'],['ISCEP','İş Bankası'],['GARANTI','Garanti BBVA'],['YAPI KREDI','Yapı Kredi'],['YAPI VE KREDI','Yapı Kredi'],['AKBANK','Akbank'],['QNB','QNB'],['FINANSBANK','QNB'],['DENIZBANK','DenizBank'],['KUVEYT TURK','Kuveyt Türk'],['KUVEYTTURK','Kuveyt Türk'],['KUVEYT','Kuveyt Türk'],['ALBARAKA','Albaraka Türk'],['TURKIYE FINANS','Türkiye Finans'],['EKONOMI BANKASI','TEB'],['TEB','TEB'],['ING','ING'],['SEKERBANK','Şekerbank'],['ENPARA','Enpara'],['ODEABANK','Odeabank'],['FIBABANKA','Fibabanka'],['ANADOLUBANK','Anadolubank'],['HSBC','HSBC']];
function detectBank(text){const all=N(text);const t=' '+(all.length>12000?all.slice(0,6000)+' '+all.slice(-6000):all)+' ';for(const [k,v] of BANKS){if(t.includes(' '+k+' ')||(k.length>=6&&t.includes(k)))return v;}return '';}
// banka tahmini: dosya adı ve ekstre başlığı (hareketlerden önceki satırlar) öncelikli; hareket açıklamalarında geçen (EFT yapılan) bankalar az sayılır
function bankaTahmin(ad,ust,govde){const say=(t,k)=>{const x=' '+N(t||'')+' ';let n=0,i=0;const a=k.length>=6?k:' '+k+' ';while((i=x.indexOf(a,i))>=0){n++;i+=a.length;}return n;};
  let en='',ep=0;for(const [k,v] of BANKS){const p=(say(ad,k)?6:0)+(say(ust,k)?4:0)+Math.min(say(govde,k),6)*0.3;if(p>ep){ep=p;en=v;}}
  return en;}

/* ---------- Excel ekstre ---------- */
function scoreHeader(cells){
  const c=cells.map(N).filter(Boolean);const has=re=>c.some(x=>re.test(x));let s=0;
  if(has(/TARIH/))s+=2; if(has(/ACIKLAMA|DETAY|ISLEM ADI|ISLEM TURU/))s+=1; if(has(/TUTAR/))s+=2;
  if(has(/^BORC|CIKAN|GIDEN|CEKILEN|PARA CIKIS/)&&has(/^ALACAK|GIREN|GELEN|YATAN|PARA GIRIS/))s+=2;
  if(has(/BAKIYE/))s+=1; return s;
}
function autoMap(h){
  const c=h.map(N);const find=p=>c.findIndex(p);
  const m={date:-1,desc:[],amount:-1,out:-1,inn:-1,bal:-1,doc:-1,dc:-1};
  m.date=find(x=>/ISLEM TARIHI/.test(x));if(m.date<0)m.date=find(x=>/TARIH/.test(x)&&!/VALOR/.test(x));if(m.date<0)m.date=find(x=>/TARIH|VALOR/.test(x));
  c.forEach((x,i)=>{if(/ACIKLAMA|DETAY|ISLEM ADI|ISLEM TURU|ISLEM TIPI|KARSI TARAF|KARSI HESAP|GONDEREN|ALICI|UNVAN|AD SOYAD/.test(x)&&!/TARIH|TUTAR|BAKIYE|IBAN|HESAP NO|NUMARA/.test(x))m.desc.push(i);});
  m.dc=find(x=>/^B A$|^BORC ALACAK$|ISLEM YONU|^YON$|^B A /.test(x));
  m.out=find(x=>/^BORC|CIKAN|GIDEN|CEKILEN|PARA CIKIS/.test(x)&&!/BAKIYE|ALACAK/.test(x));
  m.inn=find(x=>/^ALACAK|GIREN|GELEN|YATAN|PARA GIRIS/.test(x)&&!/BAKIYE|BORC/.test(x));
  m.amount=find(x=>/ISLEM TUTARI/.test(x));if(m.amount<0)m.amount=find(x=>/TUTAR/.test(x)&&!/BAKIYE|BLOKE|DOVIZ/.test(x));
  if(m.amount>=0&&m.out>=0&&m.inn>=0)m.amount=-1;
  m.bal=find(x=>/^BAKIYE$/.test(x));if(m.bal<0)m.bal=find(x=>/BAKIYE/.test(x)&&!/BLOKE|KULLANILABILIR|DEVREDEN/.test(x));
  m.doc=find(x=>/DEKONT|FIS NO|REFERANS|ISLEM NO|EVRAK NO|BELGE NO/.test(x));
  return m;
}
function sheetRows(ws){return XLSX.utils.sheet_to_json(ws,{header:1,raw:true,defval:''});}
function decodeText(bytes){
  let st=0;if(bytes[0]===0xEF&&bytes[1]===0xBB&&bytes[2]===0xBF)st=3;
  const b=bytes.subarray(st);
  if(bytes[0]===0xFF&&bytes[1]===0xFE)return new TextDecoder('utf-16le').decode(bytes.subarray(2));
  let t=new TextDecoder('utf-8').decode(b);
  const metaCs=(t.slice(0,2000).match(/charset\s*=\s*["']?([\w-]+)/i)||[])[1];
  if(t.includes(String.fromCharCode(0xFFFD))||(metaCs&&/1254|8859-9|latin5/i.test(metaCs))){try{t=new TextDecoder('windows-1254').decode(b);}catch(e){}}
  return t;
}
function htmlToWorkbook(text){
  const doc=new DOMParser().parseFromString(text,'text/html');
  const tables=[...doc.querySelectorAll('table')].filter(t=>!t.querySelector('table'));
  if(!tables.length)throw new Error('Dosyada tablo bulunamadı.');
  const wb={SheetNames:[],Sheets:{}};
  tables.forEach((tb,ti)=>{
    const aoa=[];
    for(const tr of tb.rows){const row=[];for(const c of tr.cells){row.push(c.textContent.replace(/\s+/g,' ').trim());const span=Math.min(+c.colSpan||1,30);for(let k=1;k<span;k++)row.push('');}aoa.push(row);}
    const name='Tablo'+(ti+1);wb.SheetNames.push(name);wb.Sheets[name]=XLSX.utils.aoa_to_sheet(aoa);
  });
  return wb;
}
async function readWorkbook(file){
  const buf=await file.arrayBuffer();
  const bytes=new Uint8Array(buf);
  const head=new TextDecoder('utf-8').decode(bytes.subarray(0,1024)).replace(/^\uFEFF/,'').trimStart().toLowerCase();
  if(head.startsWith('<')){
    const text=decodeText(bytes);
    if(/urn:schemas-microsoft-com:office:spreadsheet/i.test(text.slice(0,3000))&&!/<table/i.test(text.slice(0,5000)))return XLSX.read(text,{type:'string',raw:true});
    return htmlToWorkbook(text);
  }
  if(/\.(csv|txt)$/i.test(file.name)){
    let text=new TextDecoder('utf-8').decode(buf);
    if(text.includes(String.fromCharCode(0xFFFD)))text=new TextDecoder('windows-1254').decode(buf);
    return XLSX.read(text,{type:'string',raw:true});
  }
  return XLSX.read(buf,{type:'array'});
}
function locateTable(wb){
  let best=null;
  for(const name of wb.SheetNames){
    const rows=sheetRows(wb.Sheets[name]);
    for(let i=0;i<Math.min(rows.length,80);i++){const s=scoreHeader(rows[i]);if(s>=4&&(!best||s>best.score))best={score:s,rows,hIdx:i,sheet:name};}
  }
  return best;
}
function inferSigns(rows,opening){
  if(rows.every(r=>r.signed))return;
  const near=(a,b)=>Math.abs(a-b)<0.011;
  const sc=dir=>{let s=0;rows.forEach((r,i)=>{const nb=dir>0?rows[i-1]:rows[i+1];if(nb&&r.bal!=null&&nb.bal!=null&&near(Math.abs(r.bal-nb.bal),Math.abs(r.amt)))s++;});return s;};
  const dir=sc(1)>=sc(-1)?1:-1;
  rows.forEach((r,i)=>{
    if(r.signed)return;
    const nb=dir>0?rows[i-1]:rows[i+1];let prev=nb?nb.bal:null;
    if(prev==null&&dir>0&&i===0&&opening!=null)prev=opening;
    if(r.bal!=null&&prev!=null&&near(Math.abs(r.bal-prev),Math.abs(r.amt))&&r.bal!==prev){r.amt=Math.sign(r.bal-prev)*Math.abs(r.amt);r.signed=true;}
    else r.unsure=true;
  });
}
function finishRows(rows,opening){
  if(S.cardParse){if(rows.length>1&&rows[0].date>rows[rows.length-1].date)rows.reverse();return rows;}
  if(rows.some(r=>r.amt<0))rows.forEach(r=>r.signed=true);
  inferSigns(rows,opening);
  if(rows.length>1&&rows[0].date>rows[rows.length-1].date)rows.reverse();
  return rows;
}
function shiftMap(m,d){const sh=i=>i<0?i:i+d;return {...m,date:sh(m.date),desc:m.desc.map(sh),amount:sh(m.amount),out:sh(m.out),inn:sh(m.inn),bal:sh(m.bal),doc:sh(m.doc),dc:sh(m.dc)};}
function alignMap(t,m){
  // Başlık satırı veri satırlarından bir-iki hücre kaymış olabilir (birleştirilmiş başlık hücreleri)
  const sample=t.rows.slice(t.hIdx+1,t.hIdx+40);
  const score=mm=>sample.filter(r=>parseDate(r[mm.date])&&((mm.amount>=0&&parseAmount(r[mm.amount]))||(mm.out>=0&&parseAmount(r[mm.out]))||(mm.inn>=0&&parseAmount(r[mm.inn])))).length;
  let best=m,bs=score(m);
  for(const d of [-1,1,-2,2]){const mm=shiftMap(m,d);if(mm.date<0)continue;const sc=score(mm);if(sc>bs){best=mm;bs=sc;}}
  return best;
}
function parseExcelTable(t,map){
  const out=[];const rows=t.rows;
  for(let i=t.hIdx+1;i<rows.length;i++){
    const r=rows[i];const d=parseDate(r[map.date]);if(!d)continue;
    let amt=null,signed=false;
    if(map.amount>=0){
      const a=parseAmount(r[map.amount]);
      if(a){amt=signedVal(a);signed=!!(a.neg||a.flag);}
      if(amt!=null&&map.dc>=0){const f=N(r[map.dc]);if(/^B|BORC|^-/.test(f)){amt=-Math.abs(amt);signed=true;}else if(/^A|ALACAK/.test(f)){amt=Math.abs(amt);signed=true;}}
    }else{
      const o=parseAmount(r[map.out]),n=parseAmount(r[map.inn]);const ov=o?Math.abs(o.v):0,nv=n?Math.abs(n.v):0;
      if(ov||nv){amt=nv-ov;signed=true;}
    }
    if(amt==null||Math.abs(amt)<0.005)continue;
    const desc=map.desc.map(j=>String(r[j]??'').trim()).filter(Boolean).filter((v,k,a)=>a.indexOf(v)===k).join(' / ');
    const b=map.bal>=0?parseAmount(r[map.bal]):null;
    out.push({date:d,desc,amt:r2(amt),signed,bal:b?signedVal(b):null,doc:map.doc>=0?String(r[map.doc]??'').trim():''});
  }
  return finishRows(out,null);
}

/* ---------- PDF okuyucu (pdf.js 5.x, ES modülü; Görev 30) ----------
   Kütüphane ilk PDF okunurken yüklenir; worker ayrı modül dosyası (CSP: script-src 'self', worker-src 'self'). Her getDocument
   çağrısı isEvalSupported:false ile (yazı tipi gliflerinde kod derlenmez). */
let pdfYuk=null;
function pdfKutuphane(){
  if(!pdfYuk)pdfYuk=import('./vendor/pdf.min.mjs').then(m=>{m.GlobalWorkerOptions.workerSrc=new URL('vendor/pdf.worker.min.mjs',location.href).href;window.pdfjsLib=m;return m;})
    .catch(e=>{pdfYuk=null;throw new Error('PDF okuyucu yüklenemedi: '+(e&&e.message||e));});
  return pdfYuk;}
/* ---------- PDF ekstre ---------- */
async function readPdfLines(file){
  const pdfjsLib=await pdfKutuphane();
  const pdf=await pdfjsLib.getDocument({data:new Uint8Array(await file.arrayBuffer()),isEvalSupported:false}).promise;
  const lines=[];
  for(let p=1;p<=pdf.numPages;p++){
    const page=await pdf.getPage(p);const tc=await page.getTextContent();
    const items=tc.items.filter(i=>i.str&&i.str.trim()).map(i=>({s:i.str,x:i.transform[4],y:i.transform[5],w:i.width||0}));
    items.sort((a,b)=>b.y-a.y||a.x-b.x);
    const groups=[];
    for(const it of items){let g=null;for(let k=groups.length-1;k>=0&&k>=groups.length-4;k--){if(Math.abs(groups[k].y-it.y)<=2.5){g=groups[k];break;}}if(g)g.items.push(it);else groups.push({y:it.y,items:[it]});}
    for(const g of groups){g.items.sort((a,b)=>a.x-b.x);let t='',end=null;for(const it of g.items){if(end!=null){const gap=it.x-end;t+=gap>8?'  ':(gap>0.8?' ':'');}t+=it.s;end=it.x+it.w;}lines.push({t:t.trim(),page:p,y:g.y,items:g.items.map(it=>({s:it.s.trim(),x:it.x,r:it.x+it.w})).filter(it=>it.s)});}
  }
  return lines;
}
const AMT=/^[-+]?\(?\d{1,3}(?:[.,]\d{3})*[.,]\d{2}\)?-?$|^[-+]?\d+[.,]\d{2}-?$/;
const DATE_RE=/(\d{1,2}[./-]\d{1,2}[./-]\d{4})(?:[ T-]+\d{1,2}:\d{2}(?::\d{2})?)?/;
function splitTail(text){
  const toks=text.split(/\s+/).filter(Boolean);const amts=[];let i=toks.length-1;
  while(i>=0){
    const t=toks[i];
    if(/^(TL|TRY|₺)$/i.test(t)){i--;continue;}
    if(/^\(?[BA]\)?$/.test(t)&&i>0&&AMT.test(toks[i-1])){amts.unshift({s:toks[i-1],f:t.replace(/[()]/g,'')});i-=2;continue;}
    const m=t.match(/^(.*\d)\(?([BA])\)?$/);if(m&&AMT.test(m[1])){amts.unshift({s:m[1],f:m[2]});i--;continue;}
    if(AMT.test(t)){let s=t;if(i>0&&toks[i-1]==='-'){s='-'+s;i--;}amts.unshift({s});i--;continue;}
    break;
  }
  return {head:toks.slice(0,i+1).join(' '),amts};
}
const DATE_ONLY=/^\d{1,2}[./-]\d{1,2}[./-]\d{4}(?:[ T-]+\d{1,2}:\d{2}(?::\d{2})?)?$|^\d{1,2}:\d{2}(?::\d{2})?$/;
const HEADER_RE=/(TARIH.*(ACIKLAMA|TUTAR|BAKIYE))|((ACIKLAMA|TUTAR|BAKIYE).*TARIH)/;
const FOOT_RE=/SAYFA \d|TOPLAM|CEKILEN TUTAR|BANKA KAYITLARI|TICARET SICIL|WWW |MERSIS|ISLEM SAATLERI|DEVREDEN|KAPANIS|SON BAKIYE/;
function isAnchor(L){const t=L.t;const dm=t.match(DATE_RE);return !!(dm&&dm.index<=24&&/^[\s\d]*$/.test(t.slice(0,dm.index))&&parseDate(dm[1])&&!HEADER_RE.test(N(t)));}
function amtItem(s){const c=s.replace(/\s?(TL|TRY|₺)$/i,'').trim();const m=c.match(/^(.*\d)\s?\(?([BA])\)?$/);if(m&&AMT.test(m[1]))return {s:m[1],f:m[2]};return AMT.test(c)?{s:c}:null;}
// Sütun konumlarına göre okuma: tutar/bakiye sütunları bakiyenin tutarlılığından bulunur; açıklama satır üstüne/altına taşmış olabilir
function parsePdfStructured(lines){
  if(!lines.length||!lines[0].items)return [];
  const anchors=[];
  lines.forEach((L,i)=>{if(!isAnchor(L))return;
    const amts=[],others=[];
    for(const it of L.items){if(DATE_ONLY.test(it.s))continue;const a=amtItem(it.s);if(a)amts.push({...a,x:it.x,r:it.r});else others.push(it);}
    anchors.push({i,L,date:parseDate(L.t.match(DATE_RE)[1]),amts,others,extra:[]});});
  if(anchors.length<2)return [];
  // tutar sütunlarını sağ kenara göre kümele
  const rs=anchors.flatMap(a=>a.amts.map(x=>x.r)).sort((a,b)=>a-b);if(!rs.length)return [];
  const cols=[];for(const r of rs){const c=cols[cols.length-1];if(c&&r-c.max<=14){c.max=r;c.sum+=r;c.n++;}else cols.push({min:r,max:r,sum:r,n:1});}
  cols.forEach(c=>c.r=c.sum/c.n);
  const vals=anchors.map(a=>{const v=cols.map(()=>null);for(const x of a.amts){let bi=-1,bd=1e9;cols.forEach((c,ci)=>{const d=Math.abs(c.r-x.r);if(d<bd){bd=d;bi=ci;}});if(bi>=0&&bd<=16){const p=parseAmount(x.s);if(p)v[bi]=signedVal({...p,flag:x.f||p.flag});}}return v;});
  const n=anchors.length,near=(a,b)=>Math.abs(a-b)<0.011;
  const amtOf=(v,cfg)=>cfg.split?((v[cfg.a]?Math.abs(v[cfg.a]):0)+(v[cfg.b]?Math.abs(v[cfg.b]):0)):(v[cfg.a]==null?null:Math.abs(v[cfg.a]));
  const score=cfg=>{let best=0;for(const dir of [1,-1]){let s=0;for(let i=0;i<n;i++){const j=i-dir;if(j<0||j>=n)continue;const bi=vals[i][cfg.bal],bj=vals[j][cfg.bal],a=amtOf(vals[i],cfg);if(bi!=null&&bj!=null&&a&&near(Math.abs(bi-bj),a))s++;}best=Math.max(best,s);}return best;};
  let best=null;
  for(let b=0;b<cols.length;b++){for(let a=0;a<cols.length;a++){if(a===b)continue;const cfg={a,bal:b};const sc=score(cfg);if(!best||sc>best.sc)best={...cfg,sc};
    for(let c=a+1;c<cols.length;c++){if(c===b)continue;const both=vals.filter(v=>v[a]&&v[c]).length;if(both>n*0.2)continue;const cf={a,b:c,split:true,bal:b};const s2=score(cf);if(s2>best.sc)best={...cf,sc:s2};}}}
  if(!best||best.sc<Math.max(1,Math.floor((n-1)*0.5))){
    // bakiye yoksa: tek sütun tutar
    if(cols.length===1)best={a:0,bal:-1,sc:0};else return [];
  }
  // açıklama taşmaları: tutar bölgesiyle çakışmayan, tutarsız satırları en yakın işlem satırına bağla
  const zx=Math.min(...anchors.flatMap(a=>a.amts.map(x=>x.x))),zr=Math.max(...cols.map(c=>c.max));
  const anchorIdx=new Set(anchors.map(a=>a.i));
  const byPage={};anchors.forEach(a=>{(byPage[a.L.page]=byPage[a.L.page]||[]).push(a);});
  const gaps=[];Object.values(byPage).forEach(arr=>{for(let k=1;k<arr.length;k++)gaps.push(Math.abs(arr[k-1].L.y-arr[k].L.y));});
  gaps.sort((a,b)=>a-b);const gap=gaps.length?gaps[Math.floor(gaps.length/2)]:14;
  lines.forEach((L,i)=>{
    if(anchorIdx.has(i)||!L.items||!L.items.length)return;
    const n2=N(L.t);if(HEADER_RE.test(n2)||FOOT_RE.test(n2))return;
    if(L.items.some(it=>amtItem(it.s)))return;
    if(L.items.some(it=>it.x<zr-2&&it.r>zx+2))return;
    const arr=byPage[L.page];if(!arr)return;
    let bestA=null,bd=1e9;for(const a of arr){const d=Math.abs(a.L.y-L.y);if(d<bd){bd=d;bestA=a;}}
    if(bestA&&bd<=gap*1.15)bestA.extra.push(L);
  });
  const out=anchors.map((a,k)=>{
    const v=vals[k];let amt,signed=false;
    if(best.split){const x=v[best.a],y=v[best.b];amt=(x?Math.abs(x):0)+(y?Math.abs(y):0);}
    else{amt=v[best.a];if(amt!=null&&amt<0)signed=true;}
    const lead=a.others.filter(it=>it.r<=zx+2),tail=a.others.filter(it=>it.r>zx+2);
    const parts=[...a.extra,{y:a.L.y,items:tail}].sort((p,q)=>q.y-p.y);
    const desc=[lead.map(it=>it.s).join(' '),...parts.map(p=>p.items.map(it=>it.s).join(' '))].join(' ').replace(DATE_RE,'').replace(/\s+/g,' ').trim();
    return {date:a.date,desc,amt:amt==null?null:r2(amt),signed,bal:best.bal>=0?v[best.bal]:null,doc:''};
  }).filter(r=>r.amt!=null&&Math.abs(r.amt)>=0.005);
  if(best.split)out.forEach(r=>r.signed=false);
  return finishRows(out,null);
}
function parsePdfLines(lines){
  const raw=[];let opening=null,cur=null,cont=0;
  const STOP=/SAYFA|TOPLAM|IBAN|MUSTERI NO|HESAP NO|SUBE|ADRES|TARIH ARALIGI|KAPANIS|SON BAKIYE|MERSIS|WWW /;
  for(const L of lines){
    const t=L.t;const n=N(t);if(!t)continue;
    if(/DEVREDEN|ONCEKI BAKIYE|ACILIS BAKIYE|BASLANGIC BAKIYE|ONCEKI DONEM/.test(n)){const {amts}=splitTail(t);if(amts.length){const a=parseAmount(amts[amts.length-1].s);if(a)opening=signedVal({...a,flag:amts[amts.length-1].f||null});}cur=null;continue;}
    const dm=t.match(DATE_RE);
    if(dm&&dm.index<=24&&parseDate(dm[1])&&/^[\s\d]*$/.test(t.slice(0,dm.index))){
      if(/TARIH/.test(n)&&/ACIKLAMA|TUTAR|BAKIYE/.test(n)){cur=null;continue;}
      let rest=t.slice(dm.index+dm[0].length).trim();
      const v2=rest.match(new RegExp('^'+DATE_RE.source));if(v2)rest=rest.slice(v2[0].length).trim();
      const {head,amts}=splitTail(rest);
      cur={date:parseDate(dm[1]),desc:head.replace(/\s{2,}/g,' ').trim(),amts,page:L.page};raw.push(cur);cont=0;continue;
    }
    if(cur){
      if(STOP.test(n)||(/TARIH/.test(n)&&/ACIKLAMA|TUTAR/.test(n))){cur=null;continue;}
      const {head,amts}=splitTail(t);
      if(!cur.amts.length&&amts.length){cur.amts=amts;if(head)cur.desc+=' '+head;continue;}
      if(!amts.length&&cont<2&&t.length<140&&L.page===cur.page){cur.desc+=' '+t.replace(/\s{2,}/g,' ');cont++;continue;}
      cur=null;
    }
  }
  const out=[];
  for(const r of raw){
    if(!r.amts.length)continue;
    const a=r.amts.map(x=>{const p=parseAmount(x.s);return p?{...p,flag:x.f||p.flag}:null;}).filter(Boolean);if(!a.length)continue;
    let bal=null,am;
    if(a.length===1)am=a[0];else{bal=signedVal(a[a.length-1]);const body=a.slice(0,-1);am=body.find(x=>Math.abs(x.v)>0.004)||body[0];}
    const v=signedVal(am);if(!v||Math.abs(v)<0.005)continue;
    out.push({date:r.date,desc:r.desc.trim(),amt:r2(v),signed:!!(am.neg||am.flag),bal,doc:''});
  }
  return finishRows(out,opening);
}

/* ---------- mizan ---------- */
function parseMizan(rows){
  const acc=new Map();const CODE=/^\d{3}(?:[.\- ][0-9A-Za-zÇĞİÖŞÜçğıöşü]{1,8})*$/;
  for(const r of rows){for(let j=0;j<Math.min(r.length,6);j++){const v=String(r[j]??'').trim();if(CODE.test(v)){let name='';for(let k=j+1;k<r.length;k++){const w=r[k];if(typeof w==='string'&&w.trim()&&!/^[-\d.,\s]+$/.test(w)){name=w.trim();break;}}if(!acc.has(v)||(!acc.get(v)&&name))acc.set(v,name);break;}}}
  return [...acc.entries()];
}
// Mizan Excel'i (tutarlarla): başlıkta Borç / Alacak sütunları varsa [kod, ad, borç, alacak] döner (yoksa yalnız kod/ad)
function trSayi(v){if(typeof v==='number')return isFinite(v)?v:0;let t=String(v??'').replace(/TL|TRY|₺|\s/gi,'');if(!t)return 0;
  const neg=/^\(.*\)$/.test(t)||/^-/.test(t);t=t.replace(/[()\-+]/g,'');
  if(/,\d{1,2}$/.test(t)||(t.includes(',')&&t.includes('.')&&t.lastIndexOf(',')>t.lastIndexOf('.')))t=t.replace(/\./g,'').replace(',','.');else t=t.replace(/,/g,'');
  const x=parseFloat(t);return isFinite(x)?(neg?-x:x):0;}
function parseMizanTutar(rows){
  const acc=parseMizan(rows);if(!acc.length)return acc;
  const H=x=>N(String(x??''));let hi=-1,cb=-1,ca=-1;
  for(let i=0;i<Math.min(rows.length,40)&&hi<0;i++){const r=rows[i]||[];
    const b=r.findIndex(c=>/^BORC( TUTARI| TOPLAMI)?$/.test(H(c))),a=r.findIndex(c=>/^ALACAK( TUTARI| TOPLAMI)?$/.test(H(c)));
    if(b>=0&&a>=0){hi=i;cb=b;ca=a;}}
  if(hi<0)return acc;
  const CODE=/^\d{3}(?:[.\- ][0-9A-Za-zÇĞİÖŞÜçğıöşü]{1,8})*$/;const tut=new Map();
  for(const r of rows.slice(hi+1)){const k=(r||[]).slice(0,6).map(x=>String(x??'').trim()).find(x=>CODE.test(x));if(k&&!tut.has(k))tut.set(k,[trSayi(r[cb]),trSayi(r[ca])]);}
  return acc.map(([k,n])=>tut.has(k)?[k,n,...tut.get(k)]:[k,n]);
}
function mizanIndex(accounts){
  const parents=new Set();
  for(const [c] of accounts){const p=c.split(/[.\- ]/);for(let i=1;i<p.length;i++)parents.add(p.slice(0,i).join('.'));}
  const norm=c=>c.split(/[.\- ]/).join('.');
  const leaf=new Set(accounts.filter(([c])=>!parents.has(norm(c))).map(([c])=>c));
  return {accounts,leaf,byCode:new Map(accounts)};
}

/* ---------- eşleştirme ---------- */
const STOPW=new Set('LTD STI SIRKETI SIRKET TIC SAN VE AS LIMITED ANONIM TICARET SANAYI SANAYII PAZ PAZARLAMA INS INSAAT ITH IHR ITHALAT IHRACAT MALZ MALZEMELERI HIZ HIZMETLERI HIZMET TUR TURIZM NAK NAKLIYAT LOJ LOJISTIK KOLL KOLLEKTIF BANKASI BANK SUBESI DIS IC TAAH TAAHHUT VB'.split(' '));
const GENERIC=new Set('EFT FAST HAVALE GELEN GIDEN ODEME ODEMESI ISLEM NO REF REFERANS TL TRY GONDEREN ALICI ACIKLAMA HESABA HESAPTAN HESAP VIRMAN IBAN TR INTERNET MOBIL SUBE ATM ILE PARA TRANSFERI TRANSFER EK SISTEM ISCEP UCRET TUTARI NET'.split(' '));
/* Banka açıklamasından karşı taraf ünvanı: "GÖNDEREN: …" / "ALICI: …" etiketi ya da şirket türü eki (LTD. ŞTİ., A.Ş. …) ile biten parça.
   Bulamazsa '' döner (POS, komisyon, vergi gibi hareketlerde cari önerilmez). */
const UNVAN_EK=/(?:LTD\.?\s*[ŞS]T[İI]\.?|L[İI]M[İI]TED\s+Ş[İI]RKET[İI]|ANON[İI]M\s+Ş[İI]RKET[İI]|(?:^|\s)A\.?\s?Ş\.?(?=\s|$)|KOLL\.?\s*[ŞS]T[İI]\.?|KOOPERAT[İI]F)/;
// 2.9.2: IBAN / hesap no / referans / tarih ayıklanır; ünvan şu sırayla aranır: etiket (GÖNDEREN, ALICI, KARŞI HESAP ÜNVANI …),
// şirket türü eki (LTD. ŞTİ., A.Ş. …), işlem sözcüğünden sonraki ad (FAST GELEN AHMET YILMAZ …), " - " / "/" ile ayrılmış parça.
// Kişi adlarında açıklama sözcükleri (KİRA, FATURA, AY adları …) ve banka işlem sözcükleri (POS, KOMİSYON, VERGİ …) ünvan sayılmaz.
const ACIK_SOZ=new Set(('ODEME ODEMESI ODEMESIDIR FATURA FATURASI FATURALAR FAT FT FTR BEDEL BEDELI BEDELIDIR KIRA KIRASI AIDAT AIDATI MAAS MAASI AVANS BORC BORCU '+
  'ALACAK ALACAGI CEK SENET TAKSIT TAKSITI SIPARIS ICIN NOLU NUMARALI AIT AITTIR HESABI HESABINA HESABINDAN HESABIMA TAHSILAT TAHSILATI IADE IADESI KAPORA DEPOZITO '+
  'MAHSUP ODENEN YATAN YATIRILAN GONDERILEN ALINAN SATIS ALIS MAL BEDELLERI OCAK SUBAT MART NISAN MAYIS HAZIRAN TEMMUZ AGUSTOS EYLUL EKIM KASIM ARALIK YIL AY AYI '+
  'DONEM DONEMI ACIKLAMA ACK REFERANS REF SORGU IBAN NO KARSILIGI KARSILIGINDA ICIN ISTINADEN HAKEDIS HAKEDISI PRIM PRIMI ISLEM ISLEMI TARIHLI TARIH SAAT').split(' '));
const BANKA_SOZ=/(^| )(POS|KOMISYON|KOMISYONU|MASRAF|MASRAFI|UCRET|UCRETI|FAIZ|FAIZI|VERGI|VERGISI|SGK|GIB|MALIYE|BSMV|KKDF|KESINTI|KESINTISI|KREDI|KARTI|KART|KMH|VADELI|MEVDUAT|DOVIZ|ARBITRAJ|STOPAJ|HARC|HARCI|ELEKTRIK|DOGALGAZ|ILETISIM|TELEKOM|TURKCELL|VODAFONE|OTOYOL|HGS|OGS|BELEDIYE|EMLAK|MTV|TRAFIK|CEZA|CEZASI|SIGORTA|BES|ATM|NAKIT|PARA|CEKME|YATIRMA|VIRMAN|HESAPLAR|ARASI|KENDI|KENDINE|DEVIR|ACILIS|KAPANIS|BAKIYE)( |$)/;
function unvanCikar(desc){
  let s=' '+String(desc||'').toLocaleUpperCase('tr-TR').replace(/\s+/g,' ').trim()+' ';if(s.trim().length<3)return '';
  // IBAN, uzun numaralar, tarihler, saatler → ayraç
  s=s.replace(/TR\s?\d{2}(?:\s?[\dA-Z]{4}){4,6}(?:\s?[\dA-Z]{1,4})?/g,' | ').replace(/\bTR\d{10,}\b/g,' | ').replace(/\d[\d\s.\-\/]{6,}\d/g,' | ')
    .replace(/\b\d{1,2}[.\/-]\d{1,2}[.\/-]\d{2,4}\b/g,' | ').replace(/\b\d{1,2}:\d{2}(:\d{2})?\b/g,' | ').replace(/\s+/g,' ');
  const sirket=UNVAN_EK;
  const temizle=(ad,sirketMi)=>{
    let tk=String(ad||'').replace(sirketMi?/[|;:*]+/g:/[|;:*\-\/]+/g,' | ').split(' ').filter(Boolean);
    while(tk.length&&(GENERIC.has(N(tk[0]))||/^[\d.,\-\/*|()]+$/.test(tk[0])||/^TR\d+$/.test(tk[0])||ACIK_SOZ.has(N(tk[0]))))tk.shift();
    const out=[];
    for(const t of tk){const n=N(t);
      if(t==='|')break;
      if(!sirketMi&&(ACIK_SOZ.has(n)||GENERIC.has(n)))break;
      if(/\d/.test(t)&&(t.replace(/\D/g,'').length>3||!/[A-ZÇĞİÖŞÜ]/.test(t)))break;            // numara / tutar: ad bitti
      out.push(t);if(sirketMi&&sirket.test(out.join(' '))&&/(ŞTİ\.?|STI\.?|Ş\.?|ŞİRKETİ|KOOPERATİFİ?|A\.Ş\.?)$/.test(t))break;
      if(!sirketMi&&out.length>=5)break;}
    return out.join(' ').replace(/[\s,\-.]+$/,m=>/\./.test(m)&&sirketMi?m.trim():'').replace(/^[\s,\-.]+/,'').trim();};
  const gecerli=(ad,sirketMi)=>{if(!ad)return false;
    const tk=ad.split(' ');const harf=tk.filter(t=>/^[A-ZÇĞİÖŞÜ&'.]{2,}$/.test(t)&&N(t).length>=2);
    const anlamli=harf.filter(t=>N(t).length>=3&&!STOPW.has(N(t))&&!GENERIC.has(N(t))&&!ACIK_SOZ.has(N(t)));
    if((ad.match(/\d/g)||[]).length>4)return false;
    if(sirketMi)return anlamli.length>=1&&!BANKA_SOZ.test(' '+N(ad.replace(sirket,''))+' ');
    if(anlamli.length<2||anlamli.length>4||tk.length>5)return false;
    if(BANKA_SOZ.test(' '+N(ad)+' '))return false;
    return harf.length===tk.length;};                                                         // kişi adında rakam / işaret olmaz
  const dene=(ad)=>{const sm=sirket.test(ad||'');const t=temizle(ad,sm);return gecerli(t,sirket.test(t))?t.slice(0,100):'';};
  // 1) etiket
  const et=s.match(/(?:GÖNDEREN|GONDEREN|GÖND\.?|GOND\.?|ALICI(?: ADI)?(?: SOYADI)?|ALAN|KARŞI TARAF|KARSI TARAF|KARŞI HESAP(?: SAHİBİ| ADI| ÜNVANI| UNVANI)?|KARSI HESAP(?: SAHIBI| ADI| UNVANI)?|KİMDEN|KIMDEN|KİME|KIME|ÜNVAN|UNVAN|AD[İI]? SOYAD[İI]?|HESAP SAHİBİ|HESAP SAHIBI)\s*[:\-]?\s*([^|]{3,120})/);
  if(et){const r=dene(et[1].split(/\s(?:IBAN|REF|AÇIKLAMA|ACIKLAMA|SORGU|TARİH|TARIH|ALICI|GÖNDEREN|GONDEREN|BANKA)\b/)[0]);if(r)return r;}
  // 2) şirket türü eki ile biten parça
  const m=s.match(/([A-ZÇĞİÖŞÜ0-9&.'\- ]{3,90}?(?:LTD\.?\s*[ŞS]T[İI]\.?|L[İI]M[İI]TED\s+Ş[İI]RKET[İI]|ANON[İI]M\s+Ş[İI]RKET[İI]|\sA\.?\s?Ş\.?(?=\s|$)|KOLL\.?\s*[ŞS]T[İI]\.?|KOOPERAT[İI]F[İI]?))/);
  if(m){const r=dene(m[1].split(/\s(?:GELEN|GİDEN|GIDEN|FAST|EFT|HAVALE)\s/).pop());if(r)return r;}
  // 3) işlem sözcüğünden sonra
  const is=s.match(/(?:FAST|EFT|HAVALE|HVL|SWIFT|VİRMAN|VIRMAN|GELEN TRANSFER)\s*(?:İLE\s*)?(?:GELEN|GİDEN|GIDEN|GÖNDERİLEN|GONDERILEN|ALINAN|ÇIKAN|CIKAN|İŞLEMİ|ISLEMI)?\s*[:\-\/]?\s*([^|]{3,120})/);
  if(is){const r=dene(is[1]);if(r)return r;}
  // 4) " - " ya da "/" ile ayrılmış parçalar
  for(const parca of s.split(/\s[-\/]\s|\s\/|\/\s|\s-\s?|\|/)){const r=dene(parca);if(r)return r;}
  return '';
}
function buildMatcher(firm,rules,miz){
  const rs=(rules||[]).map(r=>({...r,alts:kuralParcalari(r.k),sart:kuralSartlari(r).map(kuralParcalari)})).filter(r=>r.alts.length&&(r.acc||kuralAtla(r)));
  const uz=p=>p.reduce((t,x)=>t+x.length,0);
  // çok şartlı kural daha özeldir, önce denenir; şart sayısı eşitse en uzun kelimeli önce (eski sıra)
  rs.sort((a,b)=>(b.sart.length-a.sart.length)||(Math.max(...b.alts.map(uz))-Math.max(...a.alts.map(uz))));
  const cari=[];
  if(miz)for(const [code,name] of miz.accounts){
    if(!miz.leaf.has(code)||!name)continue;
    if(!/^(120|121|126|127|131|136|159|320|321|326|331|335|336|340)/.test(code))continue;
    const toks=N(name).split(' ').filter(t=>t.length>=3&&!STOPW.has(t)&&!/^\d+$/.test(t));
    const key=toks.length>=2?toks.slice(0,2):(toks[0]&&toks[0].length>=5?[toks[0]]:null);if(!key)continue;
    cari.push({code,name,key});
  }
  return row=>{
    const d=' '+N(row.desc)+' ';const dir=row.amt>=0?'in':'out';
    for(const r of rs){if(r.dir!=='all'&&r.dir!==dir)continue;if(!r.sart.every(alts=>alts.some(p=>parcaTutar(p,d))))continue;
      if(kuralAtla(r))return {acc:dir==='in'?(firm.askiIn||''):(firm.askiOut||''),src:'atla',why:kuralMetni(r),ld:''};
      return {acc:r.acc,src:'kural',why:kuralMetni(r),ld:r.ld||''};}
    let best=null;
    for(const c of cari){if(c.key.every(k=>d.includes(' '+k+' '))){const pref=dir==='in'?c.code[0]==='1':c.code[0]==='3';const sc=(pref?100:0)+c.key.join('').length;if(!best||sc>best.sc)best={...c,sc};}}
    if(best)return {acc:best.code,src:'cari',why:best.name};
    return {acc:dir==='in'?(firm.askiIn||''):(firm.askiOut||''),src:'aski',why:''};
  };
}
function suggestKeyword(desc){
  const words=String(desc).split(/[\s/,;:]+/).filter(w=>{const n=N(w);return n.length>=3&&!GENERIC.has(n)&&!STOPW.has(n)&&!/\d/.test(n);});
  const seen=new Set();return words.filter(w=>{const n=N(w);if(seen.has(n))return false;seen.add(n);return true;}).slice(0,2).join(' ');
}
const DIRL={all:'Giriş ve çıkış',in:'Giriş · karşı hesap ALACAK',out:'Çıkış · karşı hesap BORÇ'};
const DIRS={all:'giriş ve çıkış',in:'giriş · karşı hesap alacak',out:'çıkış · karşı hesap borç'};
const DIRL_KK={all:'Harcama ve ödeme',in:'Ödeme / iade · karşı hesap ALACAK',out:'Harcama · karşı hesap BORÇ'};
const dirOpts=sel=>Object.entries(isCard()?DIRL_KK:DIRL).map(([v,l])=>`<option value="${v}"${sel===v?' selected':''}>${l}</option>`).join('');
const isCard=()=>S.mode==='card';
function accts(){return isCard()?(S.firm.cards||[]):(S.firm.banks||[]);}
function ML(){return isCard()?{acc:'kart',Acc:'Kart',accs:'kredi kartı',In:'Ödeme / iade',Out:'Harcama',inS:'kart borç',outS:'kart alacak',in_:'ödeme/iade',out_:'harcama',
    p1:'Kredi kartı ekstreleri',drop:'Kredi kartı ekstrelerini buraya bırakın',accS:'ödeme → alacak · harcama → borç',
    p2:'Harcamada kart hesabı alacak, karşı hesap (gider, satıcı, 191…) borç; ödeme ve iadede tersi. Satıra yazdığınız kod o satıra özeldir, kalıcı yapmak için “Kural yap”.',
    fis:'{BANKA} KREDİ KARTI HAREKETLERİ',fisKey:'ekstre-luca-fisdesc-kk'}
  :{acc:'banka',Acc:'Banka',accs:'banka hesabı',In:'Giriş',Out:'Çıkış',inS:'102 borç',outS:'102 alacak',in_:'giriş',out_:'çıkış',
    p1:'Banka ekstreleri',drop:'Ekstre dosyalarını buraya bırakın',accS:'giriş → alacak · çıkış → borç',
    p2:'Girişte banka (102) borç, karşı hesap alacak; çıkışta tersi. Satıra yazdığınız kod o satıra özeldir, kalıcı yapmak için “Kural yap”.',
    fis:'{BANKA} HESAP HAREKETLERİ',fisKey:'ekstre-luca-fisdesc'};}
const KK_PAY=/(HESAPTAN|OTOMATIK|OTOMATIK HESAPTAN|KREDI KARTI|KART|NAKIT|SUBEDEN|SUBE|ATM|INTERNET|MOBIL|EFT|HAVALE|FAST) ?ODEME|ODEMENIZ|ODEME ICIN TESEKKUR|KART BORCU ODEME|^ODEME\b|BORC ODEME|TAHSILAT/;
const KK_REF=/\bIADE|IPTAL|GERI ODEME|CASHBACK|PUAN IADE/;
const KK_SUM=/HESAP KESIM|SON ODEME TARIHI|DONEM BORCU|ASGARI ODEME|ONCEKI DONEM|DEVREDEN|KART LIMITI|KULLANILABILIR LIMIT|TOPLAM BORC|DONEM ICI|EKSTRE BORCU/;
function cardSigns(f){
  f.rows=f.rows.filter(r=>!KK_SUM.test(N(r.desc)));
  const two=f.map&&f.map.amount<0&&(f.map.out>=0||f.map.inn>=0);
  if(!two&&!f.cardFinal){
    const anyNeg=f.rows.some(r=>r.amt<0);
    f.rows.forEach(r=>{const d=N(r.desc);
      if(anyNeg)r.amt=-r.amt;
      else r.amt=(KK_PAY.test(d)||KK_REF.test(d))?Math.abs(r.amt):-Math.abs(r.amt);});
  }
  f.rows.forEach(r=>{r.unsure=false;r.signed=true;r.bal=null;});
}
// Kredi kartı PDF okuyucu: "04 Eylül 2026  AÇIKLAMA  1.200,00  [kalan/taksit]  [puan]" · "+" ya da "-" işaretli tutar = ödeme/iade
const KK_DATE=/^(\d{1,2}[./-]\d{1,2}[./-]\d{2,4}|\d{1,2}\s+[A-Za-zÇĞİÖŞÜçğıöşü]{3,8}\.?\s+\d{4})\b/;
function parseCardPdf(lines){
  const out=[];let cur=null;
  for(const L of lines){
    const t=L.t.replace(/\s+/g,' ').trim();if(!t)continue;
    const m=t.match(KK_DATE);const d=m&&parseDate(m[1].replace(/\./g,m[1].includes(' ')?'':'.'));
    if(d){
      let rest=t.slice(m[0].length).trim();
      const m2=rest.match(KK_DATE);if(m2&&parseDate(m2[1]))rest=rest.slice(m2[0].length).trim(); // valör/ikinci tarih
      const toks=rest.split(' ');let ai=-1;
      for(let i=0;i<toks.length;i++){const k=toks[i].replace(/(TL|TRY|₺)$/i,'');if(AMT.test(k)&&/[.,]\d{2}[-+]?$/.test(k)){ai=i;break;}}
      if(ai<0){cur=null;continue;}
      let desc=toks.slice(0,ai).join(' ').trim();let raw=toks[ai].replace(/(TL|TRY|₺)$/i,'');
      if(ai>0&&(toks[ai-1]==='+'||toks[ai-1]==='-')){raw=toks[ai-1]+raw;desc=toks.slice(0,ai-1).join(' ').trim();}
      const a=parseAmount(raw);if(!a||Math.abs(a.v)<0.005){cur=null;continue;}
      const credit=/^[-+]|[-+]$/.test(raw)||a.neg;
      if(KK_SUM.test(N(desc))||/^TOPLAM\b/.test(N(desc))){cur=null;continue;}
      cur={date:d,desc,amt:r2(credit?Math.abs(a.v):-Math.abs(a.v)),signed:true,bal:null,doc:''};out.push(cur);continue;
    }
    cur=null;
  }
  return out;
}
function fileBankName(f){if(!f)return '';if(isCard()){const c=accts()[f.bankIdx];return (c&&c.label)||f.bank||'';}if(f.bank)return f.bank;const b=accts()[f.bankIdx];return b?(detectBank(b.label)||b.label||''):'';}
function rowBank(r){return String(fileBankName(S.files.find(x=>x.id===r.fileId))||'BANKA').toLocaleUpperCase('tr-TR');}
function lucaDesc(r){return r.ld?r.ld.replace(/\{BANKA\}/g,rowBank(r)):String(r.desc||'');}
function keepScroll(fn){const y=window.scrollY,tw=document.querySelector('.tablewrap'),ty=tw?tw.scrollTop:0;fn();window.scrollTo(0,y);if(tw)tw.scrollTop=ty;}
function ruleHits(k,dir){const alts=kuralParcalari(k);if(!alts.length)return 0;
  return S.rows.filter(r=>{if(dir!=='all'&&(r.amt>=0?'in':'out')!==dir)return false;const d=' '+N(r.desc)+' ';return alts.some(p=>parcaTutar(p,d));}).length;}
const modeRules=()=>(S.allRules||[]).filter(r=>(r.kind==='card')===isCard());
const STANDARD_KK=[
  {k:'DÖNEM FAİZİ|GECİKME FAİZİ|BSMV|KKDF|KART ÜCRETİ|ÜYELİK ÜCRETİ|İŞLEM ÜCRETİ',dir:'out',pre:'780',note:'Kart faiz ve masrafları'},
  {k:'SHELL|OPET|PETROL OFİSİ|BP|TOTAL|AYTEMİZ|AKARYAKIT|LUKOIL|ALPET',dir:'out',pre:'770',note:'Akaryakıt'},
  {k:'TURKCELL|VODAFONE|TÜRK TELEKOM|TTNET|SUPERONLINE',dir:'out',pre:'770',note:'Telefon / internet'},
  {k:'SGK',dir:'out',pre:'361',note:'SGK primleri'},
  {k:'VERGİ DAİRESİ|GİB|VERGİ',dir:'out',pre:'360',note:'Vergi ödemeleri'}
];
const STANDARD=[
  {k:'BSMV|MASRAF|KOMİSYON|EFT ÜCRET|HAVALE ÜCRET|FAST ÜCRET|İŞLETİM ÜCRET',dir:'out',pre:'780',note:'Banka masrafları'},
  {k:'SGK|SOSYAL GÜVENLİK',dir:'out',pre:'361',note:'SGK primleri'},
  {k:'GİB|VERGİ|KDV|MUHTASAR|DAMGA',dir:'out',pre:'360',note:'Vergi ödemeleri'},
  {k:'MAAŞ|PERSONEL ÜCRET',dir:'out',pre:'335',note:'Personel ödemeleri'},
  {k:'FAİZ|NEMA',dir:'in',pre:'642',note:'Faiz gelirleri'},
  {k:'POS|ÜYE İŞYERİ',dir:'in',pre:'108',note:'POS tahsilatları'}
];

/* ---------- Luca çıktı sütunları ---------- */
const DEFAULT_HEADERS=['Fiş No','Fiş Tarihi','Fiş Açıklama','Hesap Kodu','Evrak No','Evrak Tarihi','Detay Açıklama','Borç','Alacak','Miktar','Belge Türü','Para Birimi','Kur','Döviz Tutar','TC/Vergi No'];
const DEFAULT_SHEET='Fiş Aktarım Şablon';
function fieldOf(h){const n=N(h);
  if(/PARA BIRIM|DOVIZ CINS|DOVIZ TURU|DOVIZ KODU/.test(n))return 'paraBirimi';if(/DOVIZ TUTAR/.test(n))return 'dovizTutar';if(/^KUR$|^DOVIZ KURU?$|^KUR DEGERI$/.test(n))return 'kur';
  if(/FIS NO|FIS NUMARA/.test(n))return 'fisNo';if(/FIS TARIH/.test(n)||n==='TARIH')return 'fisTarihi';if(/FIS ACIKLAMA/.test(n))return 'fisAciklama';
  if(/HESAP KOD/.test(n))return 'hesapKodu';if(/EVRAK NO|BELGE NO/.test(n))return 'evrakNo';if(/EVRAK TARIH|BELGE TARIH/.test(n))return 'evrakTarihi';
  if(/BELGE TUR/.test(n))return 'belgeTuru';if(/ACIKLAMA/.test(n))return 'aciklama';if(/^BORC/.test(n))return 'borc';if(/^ALACAK/.test(n))return 'alacak';return null;}

/* ---------- döviz (2.9.0): dövizli banka hesapları ve karşı hesaplar ---------- */
// Para birimi: hesap adından (GARANTİ USD, EURO HESABI, $ …), yoksa ekstre başlığından ("Para Birimi: USD"), yoksa TL.
// Tutar ekstredeki döviz tutarıdır; TL karşılığı = döviz × TCMB döviz alış kuru (işlem tarihinden önceki son iş günü).
const PB_LISTE=['TRY','USD','EUR','GBP','CHF','JPY','SAR','AUD','CAD','SEK','NOK','DKK','RUB','CNY','AZN','KWD','QAR','RON','BGN'];
function pbBul(metin){const raw=String(metin||'');if(!raw.trim())return '';
  const n=' '+N(raw)+' ';
  if(/\$/.test(raw)||/ (USD|DOLAR|DOLARI|DOLLAR|USDOLAR) /.test(n))return 'USD';
  if(/€/.test(raw)||/ (EUR|EURO|AVRO) /.test(n))return 'EUR';
  if(/£/.test(raw)||/ (GBP|STERLIN|POUND) /.test(n))return 'GBP';
  if(/ (CHF|FRANK|ISVICRE FRANGI) /.test(n))return 'CHF';
  for(const k of PB_LISTE.slice(5))if(n.includes(' '+k+' '))return k;
  if(/ (TL|TRY|TURK LIRASI) /.test(n))return 'TRY';
  return '';}
function pbDosyadan(metin,ad,govde){const n=N(metin||'');
  const m=n.match(/(?:PARA BIRIMI|DOVIZ CINSI|DOVIZ TURU|DOVIZ KODU|HESAP CINSI|HESAP TURU|HESAP PARA BIRIMI|CURRENCY)\s+(TL|TRY|USD|EUR|EURO|GBP|CHF|DOLAR|AVRO|STERLIN|[A-Z]{3})\b/);
  const v=m?pbBul(m[1]):'';if(v)return v;
  const a=pbBul(String(ad||'').replace(/\.(xlsx?|csv|txt|pdf)$/i,''));if(a)return a;
  // başlıkta ve ilk hareketlerde geçen para birimleri sayılır (TL karşılığı sütunu olan döviz ekstrelerinde döviz öne alınır)
  const t=' '+N((metin||'')+' '+(govde||''))+' ',ham=(metin||'')+' '+(govde||'');
  const say=re=>(t.match(re)||[]).length;
  const c={USD:say(/ (USD|DOLAR|DOLARI|USDOLAR|ABD DOLARI) /g)+(ham.match(/\$/g)||[]).length,EUR:say(/ (EUR|EURO|AVRO) /g)+(ham.match(/€/g)||[]).length,GBP:say(/ (GBP|STERLIN) /g)+(ham.match(/£/g)||[]).length,CHF:say(/ (CHF|ISVICRE FRANGI) /g)};
  const tl=say(/ (TL|TRY|TURK LIRASI) /g)+(ham.match(/₺/g)||[]).length;
  const en=Object.entries(c).sort((x,y)=>y[1]-x[1])[0];
  if(en[1]>0&&(en[1]>=tl||/(DOVIZ|DÖVİZ) HESAB|VADESIZ (USD|EUR|DOLAR|EURO)/.test(t)))return en[0];
  return tl?'TRY':'';}
function hesapPB(kod){if(!kod)return '';const ad=S.miz&&S.miz.byCode?S.miz.byCode.get(String(kod).trim()):'';return pbBul(ad||'');}
function filePB(f){if(!f)return 'TRY';if(f.pbElle&&f.pb)return f.pb;if(f.pbDosya)return f.pbDosya;const b=accts()[f.bankIdx];
  const hb=b?(b.pb||pbBul(b.label)||hesapPB(b.code)):'';return hb||'TRY';}
const kurAnahtar=(pb,d)=>pb+'|'+isoOf(d);
function rowKur(r){const f=S.files.find(x=>x.id===r.fileId);const pb=filePB(f);if(pb==='TRY')return null;return S.kur&&S.kur[kurAnahtar(pb,r.date)]||{pb,kur:null};}
const fmtKur=k=>Number(k).toLocaleString('tr-TR',{minimumFractionDigits:4,maximumFractionDigits:6});
/** Dövizli ekstre satırlarının TCMB kurlarını getirir (eksik olanlar). sessiz: hata fırlatmaz. */
async function kurHazirla(sessiz){
  S.kur=S.kur||{};const ist=[];
  S.kurDenendi=S.kurDenendi||new Set();
  for(const r of S.rows){if(r.skip)continue;const f=S.files.find(x=>x.id===r.fileId);const pb=filePB(f);if(pb==='TRY')continue;const k=kurAnahtar(pb,r.date);if(!S.kur[k]&&!(sessiz&&S.kurDenendi.has(k))&&!ist.some(x=>x.k===k))ist.push({k,pb,tarih:isoOf(r.date)});}
  if(!ist.length)return 0;
  ist.forEach(x=>S.kurDenendi.add(x.k));
  if(!window.desktop||!window.desktop.tcmbKurlar){if(sessiz)return 0;throw new Error('Kur bilgisi yalnız MuhaWin masaüstü programında alınır.');}
  let r;try{r=await window.desktop.tcmbKurlar(ist.map(x=>({pb:x.pb,tarih:x.tarih})));}catch(e){if(sessiz)return 0;throw e;}
  Object.assign(S.kur,(r&&r.kurlar)||{});
  if(r&&r.hatalar&&r.hatalar.length&&!sessiz)throw new Error('TCMB kuru alınamadı: '+r.hatalar.slice(0,3).join(' · '));
  return ist.length;
}

const trTarih=g=>g?String(g).slice(0,10).split('-').reverse().join('.'):'';
function lucaDovizKod(pb){const m=(S.out&&S.out.lucaDoviz)||{};return m[pb]!=null&&m[pb]!==''?String(m[pb]):null;}
function dovizPBler(){return [...new Set(S.files.filter(f=>f.rows&&f.rows.length).map(filePB).filter(pb=>pb!=='TRY'))];}
function dovizKontrol(act){
  const pbs=dovizPBler();if(!pbs.length)return [];
  const eksik=act.filter(r=>{const k=rowKur(r);return k&&!k.kur;}).length;
  if(eksik&&!S._kurYuk){S._kurYuk=true;kurHazirla(true).then(n=>{S._kurYuk=false;if(n){try{detectFxVirman();}catch(e){}renderTable();renderOut();}}).catch(()=>{S._kurYuk=false;});}
  return [['warn',`Dövizli hesap: ${pbs.join(', ')} — ekstre tutarı döviz; TL karşılığı TCMB döviz alış kuruyla (işlem tarihinden önceki son iş günü) hesaplanır, fişe para birimi, kur ve döviz tutarı yazılır.`],
    eksik?['warn',`${eksik} dövizli hareketin kuru henüz alınmadı (internetten TCMB'den alınacak).`]:null];
}
function dovizKodHtml(){return '';   // 2.9.6: kullanıcıya gösterilmez; Luca'nın döviz numarası aktarımda kendiliğinden okunur
}
function dovizKodHtmlEski(){
  const pbs=dovizPBler();if(!pbs.length)return '';
  const eks=pbs.filter(pb=>!lucaDovizKod(pb));
  return `<details class="dvzkod"${eks.length?' open':''}><summary class="note" style="cursor:pointer">Luca döviz kodları ${eks.length?'<span class="chip aski">doğrudan aktarım için gerekli</span>':'<span class="chip kural">tanımlı</span>'}</summary>
    <p class="note" style="margin:6px 0">Dövizli fişi <b>Excel ile</b> aktarırken bu kodlar gerekmez (Luca şablonundaki Para Birimi / Kur / Döviz Tutar sütunları yeterli). Yalnız “Luca'ya aktar” ile doğrudan gönderirken Luca'nın iç döviz numarası kullanılır (TL = 0); bu numara Luca ekranında yazmaz. “Luca'dan bul” onu Luca'dan okumayı dener; bulamazsa Excel ile aktarın.</p>
    <div class="actions">${pbs.map(pb=>`<label class="note" for="dvz_${pb}">${pb}</label><input id="dvz_${pb}" data-lucadvz="${pb}" class="mono" style="width:70px" value="${esc(lucaDovizKod(pb)||'')}">`).join('')}<button class="btn small" id="dvzBul">Luca'dan bul</button></div></details>`;
}

/* ---------- örnek veri ---------- */
const EXAMPLE_ID='__ornek';
const EX_MIZAN=[['102','BANKALAR'],['102.01','TL HESAPLAR'],['102.01.001','GARANTİ BBVA TL HESABI'],['102.01.002','ZİRAAT BANKASI TL HESABI'],['108','DİĞER HAZIR DEĞERLER'],['108.01','POS TAHSİLATLARI'],['120','ALICILAR'],['120.01','YURTİÇİ ALICILAR'],['120.01.001','ATLAS YAPI MALZEMELERİ LTD ŞTİ'],['120.01.002','YILDIZ MOBİLYA SAN TİC AŞ'],['199','DİĞER ÇEŞİTLİ DÖNEN VARLIKLAR'],['199.99','ASKI - BANKA ÇIKIŞLARI'],['320','SATICILAR'],['320.01','YURTİÇİ SATICILAR'],['320.01.004','KORKMAZ AMBALAJ SAN TİC AŞ'],['320.01.007','EGE KIRTASİYE LTD ŞTİ'],['335','PERSONELE BORÇLAR'],['335.01','ÜCRET BORÇLARI'],['360','ÖDENECEK VERGİ VE FONLAR'],['360.01','ÖDENECEK KDV VE STOPAJ'],['361','ÖDENECEK SOSYAL GÜVENLİK KESİNTİLERİ'],['361.01','SGK PRİM BORÇLARI'],['399','DİĞER ÇEŞİTLİ YABANCI KAYNAKLAR'],['399.99','ASKI - BANKA GİRİŞLERİ'],['642','FAİZ GELİRLERİ'],['642.01','MEVDUAT FAİZ GELİRLERİ'],['780','FİNANSMAN GİDERLERİ'],['780.01','BANKA MASRAF VE KOMİSYONLARI']];
function exampleFirm(){return {id:EXAMPLE_ID,name:'Örnek Firma (kaydedilmez)',banks:[{label:'Garanti BBVA',code:'102.01.001'},{label:'Ziraat Bankası',code:'102.01.002'}],askiIn:'399.99',askiOut:'199.99',mizanInfo:{count:EX_MIZAN.length,file:'örnek mizan'}};}
function exampleRules(){return STANDARD.map(s=>({id:uid(),k:s.k,dir:s.dir,acc:s.pre+'.01',note:s.note}));}
function exampleFile(){
  const data=[['01.10.2026','FAST GELEN ATLAS YAPI MALZ. LTD. ŞTİ. EYLÜL FATURA ÖDEMESİ',48500,'D-88120'],['01.10.2026','EFT GİDEN KORKMAZ AMBALAJ SAN. TİC. A.Ş. FT-2026-118',-12740.5,'D-88121'],['01.10.2026','EFT ÜCRETİ',-6.5,'D-88122'],['01.10.2026','BSMV',-0.33,'D-88123'],['03.10.2026','SGK PRİM ÖDEMESİ 2026/09',-18322.4,'D-88301'],['05.10.2026','GİB VERGİ ÖDEMESİ KDV 2026/09',-9811,'D-88412'],['07.10.2026','POS ÜYE İŞYERİ SATIŞ YATAN 07.10',23415.8,'D-88533'],['10.10.2026','HAVALE GELEN DENİZ OTOMOTİV SERVİS HİZMETLERİ',7600,'D-88702'],['14.10.2026','MAAŞ ÖDEMESİ EKİM PERSONEL',-42000,'D-88910'],['15.10.2026','HESAP İŞLETİM ÜCRETİ',-95,'D-88955'],['15.10.2026','VADELİ HESAP FAİZ TAHAKKUKU',312.45,'D-88960']];
  let bal=150000;
  const rows=data.map(([d,desc,amt,doc])=>{bal=r2(bal+amt);return {date:parseDate(d),desc,amt,signed:true,bal,doc};});
  return {id:'ornek',name:'ornek-garanti-ekstre.xlsx',kind:'Örnek',bank:'Garanti BBVA',bankIdx:0,sample:true,rows};
}

/* ---------- durum ---------- */
const S={firms:[],firmId:EXAMPLE_ID,firm:exampleFirm(),rules:exampleRules(),miz:mizanIndex(EX_MIZAN),files:[],rows:[],filter:'all',
  out:{headers:DEFAULT_HEADERS.slice(),sheet:DEFAULT_SHEET,custom:false},group:'day',startNo:1,fisDesc:'{BANKA} HESAP HAREKETLERİ',
  db:null,dl:null,unsubRules:null,draftRule:null,exportParts:null};
const lsGet=(k,d)=>{try{const v=localStorage.getItem(k);return v?JSON.parse(v):d;}catch(e){return d;}};
const lsSet=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}};

/* ---------- depolama: paylaşılan veritabanı, yoksa bu tarayıcı ---------- */
const Store={
  cache:null,
  local(){if(!this.cache){let d=null;try{const r=window.desktop.loadData();d=r&&r.data;if(r&&!r.ok)this.loadError=r.error;}catch(e){}this.cache=d||{firms:{},rules:{},output:null};}return JSON.parse(JSON.stringify(this.cache));},
  saveLocal(d){this.cache=d;},
  chains:{},
  queue(key,fn){const p=(this.chains[key]||Promise.resolve()).then(fn,fn);this.chains[key]=p.catch(()=>{});return p;},
  subscribeFirms(cb){
    if(S.db)return S.db.collection('firms').onSnapshot(s=>cb(s.docs.map(d=>({id:d.id,...d.data()}))),e=>toast('Firma listesi okunamadı: '+e.message));
    const d=this.local();cb(Object.values(d.firms));return ()=>{};
  },
  saveFirm(f){
    const {id,...body}=f;body.updatedAt=new Date().toISOString();
    if(S.db)return this.queue('f'+id,()=>S.db.doc('firms/'+id).set(body));
    const d=this.local();d.firms[id]={id,...body};this.saveLocal(d);this.firmsSync();return Promise.resolve();
  },
  // yerel depoda firma listesi değişince üstteki firma seçimi de güncellenir (tüm modüller aynı listeyi kullanır)
  firmsSync(){try{const d=this.local();const liste=Object.values(d.firms||{});if(S.taslakId&&!d.firms[S.taslakId]){const t=(S.firms||[]).find(f=>f.id===S.taslakId);if(t)liste.push(t);}if(S.firm&&S.firm.id!==EXAMPLE_ID&&d.firms[S.firm.id])S.firm={...d.firms[S.firm.id]};
      S.firms=liste.sort((a,b)=>String(a.name).localeCompare(String(b.name),'tr'));if(typeof renderFirmSel==='function')renderFirmSel();}catch(e){}},
  async deleteFirm(id){
    if(S.db){const rs=await S.db.collection('firms/'+id+'/rules').get();for(const r of rs.docs)await S.db.doc('firms/'+id+'/rules/'+r.id).delete();
      const ms=await S.db.collection('firms/'+id+'/mizan').get();for(const m of ms.docs)await S.db.doc('firms/'+id+'/mizan/'+m.id).delete();
      await S.db.doc('firms/'+id).delete();return;}
    const d=this.local();delete d.firms[id];delete d.rules[id];delete d.mizan[id];this.saveLocal(d);this.firmsSync();
  },
  subscribeRules(fid,cb){
    if(S.db)return S.db.collection('firms/'+fid+'/rules').onSnapshot(s=>cb(s.docs.map(d=>({id:d.id,...d.data()}))),e=>toast('Kurallar okunamadı: '+e.message));
    const fire=()=>cb(Object.values(this.local().rules[fid]||{}));this.localRuleCb={fid,fire};fire();return ()=>{this.localRuleCb=null;};
  },
  notifyLocal(fid){if(this.localRuleCb&&this.localRuleCb.fid===fid)this.localRuleCb.fire();},
  addRule(fid,r){
    if(S.db)return S.db.doc('firms/'+fid+'/rules/'+r.id).set(r);
    const d=this.local();(d.rules[fid]=d.rules[fid]||{})[r.id]=r;this.saveLocal(d);this.notifyLocal(fid);return Promise.resolve();
  },
  delRule(fid,rid){
    if(S.db)return S.db.doc('firms/'+fid+'/rules/'+rid).delete();
    const d=this.local();if(d.rules[fid])delete d.rules[fid][rid];this.saveLocal(d);this.notifyLocal(fid);return Promise.resolve();
  },
  async getMizan(fid,parts){
    if(S.db){const out=[];for(let i=0;i<(parts||0);i++){const s=await S.db.doc('firms/'+fid+'/mizan/p'+i).get();if(s.exists)out.push(...(s.data().a||[]));}return out;}
    return this.local().mizan[fid]||[];
  },
  async saveMizan(fid,accounts){
    if(S.db){const CH=1500;let n=0;for(let i=0;i<accounts.length;i+=CH){await S.db.doc('firms/'+fid+'/mizan/p'+n).set({a:accounts.slice(i,i+CH)});n++;}return n;}
    const d=this.local();d.mizan[fid]=accounts;this.saveLocal(d);return 1;
  },
  async getOutput(){
    if(S.db){const s=await S.db.doc('settings/output').get();return s.exists?s.data():null;}
    return this.local().output;
  },
  saveOutput(o){
    if(S.db)return this.queue('out',()=>S.db.doc('settings/output').set(o));
    const d=this.local();d.output=o;this.saveLocal(d);return Promise.resolve();
  }
};

/* tarih kutuları: yıl yazılırken (2 → 20 → 202 → 2026) Chromium her adımda change üretir; 1900'den küçük yıl = yazım sürüyor, yoksay */
for(const ev of ['change','input'])document.addEventListener(ev,e=>{const t=e.target;if(t&&t.type==='date'&&t.value&&+t.value.slice(0,4)<1900)e.stopImmediatePropagation();},true);

/* ---- Türkçe tarih kutusu: her <input type=date> yanına gg.aa.yyyy yazılan metin kutusu eklenir (2 haneli yıl → 20yy, ↑/↓ gün,
   Alt+↓ / F4 ya da sağdaki simge: takvim). Asıl date kutusu görünmez kalır; kodun okuduğu/yazdığı değer yine odur (yyyy-aa-gg).
   data-notr olan kutular (ör. Fiş Girişi tablosu, kendi klavye gezintisi var) sarılmaz. ---- */
(function(){
  const desc=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value');
  Object.defineProperty(HTMLInputElement.prototype,'value',{configurable:true,enumerable:desc.enumerable,get(){return desc.get.call(this);},set(v){desc.set.call(this,v);if(this.__trGoster)this.__trGoster();}});
  const isoTr=v=>{const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(v||'');return m?`${m[3]}.${m[2]}.${m[1]}`:'';};
  const isoYaz=dt=>`${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
  function trIso(d){if(d.length<6)return null;const g=d.slice(0,2),a=d.slice(2,4);let y=d.slice(4);if(y.length===2)y='20'+y;if(y.length!==4||+y<1900)return null;
    const dt=new Date(+y,+a-1,+g);return (dt.getFullYear()===+y&&dt.getMonth()+1===+a&&dt.getDate()===+g)?isoYaz(dt):null;}
  function sar(n){
    if(n.__trGoster||n.dataset.notr!=null||n.closest('[data-notr]'))return;
    const t=document.createElement('input');t.type='text';t.className=n.className;if(n.getAttribute('style'))t.setAttribute('style',n.getAttribute('style'));t.classList.add('tr-tarih');
    t.placeholder='gg.aa.yyyy';t.inputMode='numeric';t.autocomplete='off';t.maxLength=10;t.title=(n.title?n.title+' · ':'')+'gg.aa.yyyy yazın · ↑/↓ gün · takvim: Alt+↓';
    const al=n.getAttribute('aria-label');if(al)t.setAttribute('aria-label',al);t.disabled=n.disabled;t.readOnly=n.readOnly;
    n.classList.add('tr-tarih-asil');n.tabIndex=-1;n.insertAdjacentElement('afterend',t);
    n.__trGoster=()=>{if(document.activeElement!==t){t.value=isoTr(desc.get.call(n));t.classList.remove('hata');}};n.__trGoster();
    let bekleyenChange=false;   // boşaltma: change olayı bırakınca (ekranı yeniden çizen dinleyiciler yazmayı kesmesin)
    const yaz=(iso,hemen=true)=>{if(desc.get.call(n)===iso)return;desc.set.call(n,iso);n.dispatchEvent(new Event('input',{bubbles:true}));if(hemen){bekleyenChange=false;n.dispatchEvent(new Event('change',{bubbles:true}));}else bekleyenChange=true;};
    const ac=()=>{try{n.showPicker();}catch(e){}};
    t.addEventListener('input',()=>{const d=t.value.replace(/\D/g,'').slice(0,8);let s=d.slice(0,2);if(d.length>2)s+='.'+d.slice(2,4);if(d.length>4)s+='.'+d.slice(4);t.value=s;
      if(d.length===8){const iso=trIso(d);t.classList.toggle('hata',!iso);if(iso)yaz(iso);}else if(!d.length){t.classList.remove('hata');yaz('',false);}});
    t.addEventListener('blur',()=>{const d=t.value.replace(/\D/g,'');if(d.length>=6&&d.length<8){const iso=trIso(d);if(iso)yaz(iso);}
      const iso=desc.get.call(n);t.value=isoTr(iso);t.classList.toggle('hata',!!(d.length&&!iso));
      if(bekleyenChange){bekleyenChange=false;n.dispatchEvent(new Event('change',{bubbles:true}));}});
    t.addEventListener('keydown',e=>{if((e.altKey&&e.key==='ArrowDown')||e.key==='F4'){e.preventDefault();ac();return;}
      if(e.key==='ArrowUp'||e.key==='ArrowDown'){const iso=desc.get.call(n);if(!iso)return;e.preventDefault();const dt=new Date(iso+'T00:00:00');dt.setDate(dt.getDate()+(e.key==='ArrowUp'?1:-1));yaz(isoYaz(dt));t.value=isoTr(desc.get.call(n));}});
    t.addEventListener('pointerdown',e=>{const r=t.getBoundingClientRect();if(e.clientX>r.right-28){e.preventDefault();t.focus();ac();}});
    n.addEventListener('change',()=>{if(document.activeElement!==t)t.value=isoTr(desc.get.call(n));});   // takvimden seçim
  }
  const tara=root=>{if(root.matches&&root.matches('input[type=date]'))sar(root);if(root.querySelectorAll)root.querySelectorAll('input[type=date]').forEach(sar);};
  new MutationObserver(ms=>{for(const m of ms)for(const nd of m.addedNodes)if(nd.nodeType===1)tara(nd);}).observe(document.documentElement,{childList:true,subtree:true});
  tara(document);
})();
/* Dinlenme Alanı (oyunlar) 2.7.12'de kaldırıldı: eski kayıtları temizle */
try{for(const k of ['muhawin-satranc','muhawin-sudoku','muhawin-kelime'])localStorage.removeItem(k);}catch(e){}
/* ---------- firma seçimi ---------- */
const isExample=()=>S.firmId===EXAMPLE_ID;
function onFirms(list){
  S.firms=list.sort((a,b)=>String(a.name).localeCompare(String(b.name),'tr'));
  if(!isExample()){const f=S.firms.find(x=>x.id===S.firmId);if(f){S.firm={...f};}else if(S.firms.length)selectFirm(S.firms[0].id);else selectFirm(EXAMPLE_ID);}
  else if(S.firms.length){const last=lsGet('ekstre-luca-firm',null);selectFirm(S.firms.some(f=>f.id===last)?last:S.firms[0].id);}
  renderFirmSel();renderSide();
}
async function selectFirm(id){
  if(S.unsubRules){S.unsubRules();S.unsubRules=null;}
  S.firmId=id;lsSet('ekstre-luca-firm',id);
  if(id===EXAMPLE_ID){S.firm=exampleFirm();S.allRules=exampleRules();S.rules=modeRules();S.miz=mizanIndex(EX_MIZAN);}
  else{
    const f=S.firms.find(x=>x.id===id);S.firm={...f};S.allRules=[];S.rules=[];S.miz=null;
    S.unsubRules=Store.subscribeRules(id,list=>{S.allRules=list;S.rules=modeRules();reassign();keepScroll(()=>{renderSide();renderTable();renderOut();});});
    const acc=await Store.getMizan(id,(f.mizanInfo||{}).parts);if(S.firmId!==id)return;
    S.miz=acc.length?mizanIndex(acc):null;
  }
  S.files.forEach(f=>{if(!f.sample)bankaEsle(f);});
  {const o=(S.wsStore||{})[isCard()?'bank':'card'];if(o)o.stale=true;}
  if(id!==EXAMPLE_ID)S.files=S.files.filter(f=>!f.sample);
  renderFirmSel();renderDatalist();rebuildRows();renderAll();
  // tek olay: modüller (FKUI, OKC, CEK, FISG, FISL, HESAP…) buna abone olur; yeni modül eklerken buraya dokunmak gerekmez
  document.dispatchEvent(new CustomEvent('mw:firma',{detail:{id,firm:S.firm}}));
}
/** Firma değişince çağrılacak işlev kaydeder; hata bir modülde kalır, diğerlerini durdurmaz. */
function firmaDinle(fn){document.addEventListener('mw:firma',e=>{try{const r=fn(e.detail);if(r&&r.catch)r.catch(err=>console.warn('firma olayı',err));}catch(err){console.warn('firma olayı',err);}});}
function saveFirmSoon(){
  if(isExample()){reassign();renderAll();return;}
  // Firma ayarları penceresinde değişiklikler "Kaydet"e basılana kadar yalnız ekranda kalır
  if(!$('#firmModal').hidden){S.firmKirli=true;reassign();renderAll();return;}
  firmaKalici();reassign();renderAll();
}
function firmaKalici(){const i=S.firms.findIndex(f=>f.id===S.firm.id);if(i>=0)S.firms[i]={...S.firm};
  return Store.saveFirm(S.firm).catch(e=>toast('Kaydedilemedi: '+e.message));}
async function firmaKaydet(){if(isExample()){closeModal(true);return;}
  S.firm.name=(S.firm.name||'').trim()||'Yeni firma';await firmaKalici();const yeni=S.taslakId===S.firm.id;
  S.firmKirli=false;S.taslakId=null;renderFirmSel();renderAll();closeModal(true);toast(yeni?'Firma kaydedildi.':'Firma ayarları kaydedildi.');}
async function firmaVazgec(){
  const id=S.firm&&S.firm.id;
  if(S.taslakId&&S.taslakId===id&&!((Store.local().firms||{})[id])){       // hiç kaydedilmemiş yeni firma: listeden çıkar
    S.firms=S.firms.filter(f=>f.id!==id);S.taslakId=null;S.firmKirli=false;
    const geri=S.oncekiFirm&&S.firms.some(f=>f.id===S.oncekiFirm)?S.oncekiFirm:(S.firms[0]&&S.firms[0].id)||EXAMPLE_ID;await selectFirm(geri);renderFirmSel();renderAll();return;}
  const kayitli=(Store.local().firms||{})[id];S.taslakId=null;S.firmKirli=false;
  if(kayitli){S.firm={...kayitli};const i=S.firms.findIndex(f=>f.id===id);if(i>=0)S.firms[i]={...kayitli};}
  reassign();renderFirmSel();renderAll();}
function pickBankIdx(bankName){
  const banks=accts();if(!banks.length)return -1;
  const nb=N(bankName);if(nb){const i=banks.findIndex(b=>N(b.label).includes(nb.split(' ')[0])||nb.includes(N(b.label).split(' ')[0]));if(i>=0)return i;}
  return 0;
}
/* Dosya adı + ekstre başlığındaki banka adı ve hesap/IBAN numaraları ile mizandaki 102 hesaplarını eşleştirir; güven puanı verir.
   100: banka adı tutuyor ve (hesap numarası da tutuyor ya da bankanın tek hesabı var). Daha azı "kontrol edin" uyarısıyla gösterilir. */
function bankaEsle(f){
  const banks=accts();if(!banks.length){f.bankIdx=-1;f.esle=null;return;}
  if(isCard()){f.bankIdx=f.bankIdx>=0?f.bankIdx:0;f.esle=null;return;}
  const adBanka=detectBank(f.name||'')||f.bank||'';const bankaK=N(adBanka);
  const ids=[...new Set([...(f.ids||[]),...extractIds(f.name||'')])].map(x=>String(x).replace(/\D/g,'')).filter(x=>x.length>=5);
  const puanla=b=>{const lab=N(b.label||'');const labD=String(b.label||'').replace(/\D+/g,' ').split(' ').filter(x=>x.length>=4);
    let p=0,neden=[];
    const bb=detectBank(b.label||'');
    if(bankaK&&bb&&N(bb)===bankaK){p+=55;neden.push('banka adı');}
    else if(bankaK&&(lab.includes(bankaK.split(' ')[0])||bankaK.includes(lab.split(' ')[0]||'§'))){p+=40;neden.push('banka adı (kısmi)');}
    const noEs=ids.some(id=>labD.some(d=>d.length>=4&&(id.endsWith(d)||d.endsWith(id.slice(-Math.min(id.length,d.length)))||id.includes(d)||d.includes(id))));
    if(noEs){p+=45;neden.push('hesap no');}
    const hpb=b.pb||pbBul(b.label||'')||hesapPB(b.code);       // ekstrenin para birimi hesabınkiyle tutuyor mu
    if(f.pbDosya&&hpb){if(hpb===f.pbDosya){if(p)p+=15;neden.push('para birimi');}else{p-=40;neden.push('para birimi farklı');}}
    else if(f.pbDosya&&f.pbDosya!=='TRY'&&!hpb){p-=15;}
    return {p,neden};};
  const sk=banks.map((b,i)=>({i,b,...puanla(b)})).filter(x=>x.b.code);
  if(!sk.length){f.bankIdx=0;f.esle={puan:0,neden:'mizanda 102 hesabı yok'};return;}
  sk.sort((x,y)=>y.p-x.p);const en=sk[0];const ayniBanka=sk.filter(x=>x.neden.includes('banka adı'));
  let puan=en.p;
  if(en.neden.includes('banka adı')&&!en.neden.includes('hesap no')&&ayniBanka.length===1)puan=100;        // bankanın tek hesabı
  if(en.p===100&&sk[1]&&sk[1].p===100)puan=70;                                                                  // iki hesap da tam tutuyor
  if(en.p<=0){f.bankIdx=pickBankIdx(f.bank);f.esle={puan:0,neden:'dosya adı ve başlıkta eşleşen banka / hesap no yok'};return;}
  f.bankIdx=en.i;f.esle={puan:Math.min(100,puan),neden:en.neden.join(' + ')+(puan===100&&!en.neden.includes('hesap no')?' (bankanın tek hesabı)':'')};
}
function esleRozet(f){if(isCard()||!f||!f.esle||!(accts()[f.bankIdx]||{}).code)return '';const e=f.esle;
  if(e.elle)return `<span class="chip cari" title="Hesabı siz seçtiniz">seçildi</span>`;
  if(e.puan>=100)return `<span class="chip cari" title="Eşleşme: ${esc(e.neden)}">%100</span>`;
  return `<span class="chip aski" title="Eşleşme: ${esc(e.neden||'zayıf')} — listeden doğru hesabı seçin">%${e.puan} · kontrol edin</span>`;}

/* ---------- satırlar ---------- */
/* ---------- bankalar arası virman ---------- */
function extractIds(text){
  const ids=new Set();const t=String(text||'');
  for(const m of t.matchAll(/TR\s?\d{2}(?:\s?\d){22}/gi)){const d=m[0].replace(/\D/g,'');ids.add(d.slice(-16));ids.add(d.slice(-12));}
  for(const m of t.matchAll(/(?<![\d.,/])\d{7,12}(?![\d.,/])/g))ids.add(m[0]);
  return [...ids];
}
const VKW=/VIRMAN|HESAPLAR ARASI|HESABIMA|KENDI HESAB|HESABA AKTAR|HESAPTAN AKTAR|EK NO|GONDEREN HESAP|ALICI HESAP|ARA HESAP/;
const fileCode=f=>(accts()[f.bankIdx]||{}).code||'';
function resetVirman(){
  for(const r of S.rows){if(r.src!=='virman')continue;r.src='';r.manual=false;r.vPair=null;if(r.vSkipped){r.skip=false;r.vSkipped=false;}}
}
function detectVirman(){
  if(isCard()||S.files.length<2)return 0;
  const fileOf=new Map(S.files.map(f=>[f.id,f]));
  const free=S.rows.filter(r=>!r.vNo&&!(r.manual&&r.src!=='virman'));
  const ins=new Map();free.forEach(r=>{if(r.amt>0){const k=Math.round(r.amt*100);(ins.get(k)||ins.set(k,[]).get(k)).push(r);}});
  const cand=[];
  for(const o of free){if(o.amt>=0)continue;const list=ins.get(Math.round(-o.amt*100));if(!list)continue;
    for(const i of list){if(i.fileId===o.fileId)continue;
      const dd=Math.round(Math.abs(i.date-o.date)/864e5);if(dd>1)continue;
      const fo=fileOf.get(o.fileId),fi=fileOf.get(i.fileId);
      const kw=VKW.test(N(o.desc))||VKW.test(N(i.desc));
      const dO=o.desc.replace(/\D/g,''),dI=i.desc.replace(/\D/g,'');
      const idm=(fi.ids||[]).some(x=>x.length>=7&&dO.includes(x))||(fo.ids||[]).some(x=>x.length>=7&&dI.includes(x));
      const sc=(dd===0?2:0)+(kw?2:0)+(idm?3:0);
      if(!kw&&!idm)continue; // aynı tutar ve tarih tek başına yetmez; açıklamada virman belirtisi ya da diğer hesabın numarası olmalı
      cand.push({o,i,sc});}}
  cand.sort((a,b)=>b.sc-a.sc);
  const used=new Set();let n=0;
  for(const c of cand){if(used.has(c.o.id)||used.has(c.i.id))continue;used.add(c.o.id);used.add(c.i.id);n++;
    const {o,i}=c;const fo=fileOf.get(o.fileId),fi=fileOf.get(i.fileId);
    const bo=fileBankName(fo)||'BANKA',bi=fileBankName(fi)||'BANKA';
    const ld=`VİRMAN ${bo} → ${bi}`.toLocaleUpperCase('tr-TR');
    o.src=i.src='virman';o.manual=i.manual=true;o.vPair=i.id;i.vPair=o.id;o.why=i.why='';o.ld=i.ld=ld;
    o.acc=fileCode(fi);i.acc=fileCode(fo);
    const keepIn=i.vChosen&&!o.vChosen;const keep=keepIn?i:o,drop=keepIn?o:i;
    keep.skip=false;keep.vSkipped=false;drop.skip=true;drop.vSkipped=true;}
  return n+detectFxVirman(used);
}
// döviz bozumu / arbitraj: farklı para birimli iki hesap arasında aynı gün (±1) ters yönlü hareket; tutarlar TCMB kuruyla en çok %8 farklı
const FXKW=/DOVIZ|BOZDUR|BOZUM|ARBITRAJ|KAMBIYO|EXCHANGE|\bFX\b|ALIS|SATIS|VIRMAN|HESAPLAR ARASI|HESABIMA|KENDI HESAB/;
function tlDeger(pb,amt,d){if(pb==='TRY')return Math.abs(amt);const k=S.kur&&S.kur[kurAnahtar(pb,d)];return k&&k.kur?Math.abs(amt)*k.kur:null;}
function detectFxVirman(used){
  if(isCard()||S.files.length<2)return 0;used=used||new Set(S.rows.filter(r=>r.vPair).map(r=>r.id));
  const fileOf=new Map(S.files.map(f=>[f.id,f]));const pbOf=new Map(S.files.map(f=>[f.id,filePB(f)]));
  if(new Set(pbOf.values()).size<2)return 0;
  const free=S.rows.filter(r=>!r.vNo&&!r.vPair&&!used.has(r.id)&&!(r.manual&&r.src!=='virman'));
  const cand=[];
  for(const o of free){if(o.amt>=0)continue;
    for(const i of free){if(i.amt<=0||i.fileId===o.fileId||pbOf.get(i.fileId)===pbOf.get(o.fileId))continue;
      const dd=Math.round(Math.abs(i.date-o.date)/864e5);if(dd>1)continue;
      const to=tlDeger(pbOf.get(o.fileId),o.amt,o.date),ti=tlDeger(pbOf.get(i.fileId),i.amt,i.date);if(to==null||ti==null)continue;
      const fark=Math.abs(to-ti)/Math.max(to,ti);if(fark>0.08)continue;
      const fo=fileOf.get(o.fileId),fi=fileOf.get(i.fileId);
      const kw=FXKW.test(N(o.desc))||FXKW.test(N(i.desc));
      const dO=o.desc.replace(/\D/g,''),dI=i.desc.replace(/\D/g,'');
      const idm=(fi.ids||[]).some(x=>x.length>=7&&dO.includes(x))||(fo.ids||[]).some(x=>x.length>=7&&dI.includes(x));
      if(!kw&&!idm)continue;
      cand.push({o,i,sc:(dd===0?2:0)+(kw?2:0)+(idm?3:0)+(1-fark)*2});}}
  cand.sort((a,b)=>b.sc-a.sc);let n=0;
  for(const c of cand){if(used.has(c.o.id)||used.has(c.i.id))continue;used.add(c.o.id);used.add(c.i.id);n++;
    const {o,i}=c;const fo=fileOf.get(o.fileId),fi=fileOf.get(i.fileId);
    const ld=`DÖVİZ ${pbOf.get(o.fileId)} → ${pbOf.get(i.fileId)} ${fileBankName(fo)||'BANKA'} → ${fileBankName(fi)||'BANKA'}`.toLocaleUpperCase('tr-TR');
    o.src=i.src='virman';o.manual=i.manual=true;o.vPair=i.id;i.vPair=o.id;o.why=i.why='';o.ld=i.ld=ld;o.acc=fileCode(fi);i.acc=fileCode(fo);
    // fişe TL tarafı (varsa) yazılır: TL tutarı hiç değişmez
    const tlO=pbOf.get(o.fileId)==='TRY',tlI=pbOf.get(i.fileId)==='TRY';
    const keep=tlI&&!tlO?i:(i.vChosen&&!o.vChosen?i:o),drop=keep===o?i:o;
    keep.skip=false;keep.vSkipped=false;drop.skip=true;drop.vSkipped=true;}
  return n;
}
// virman çiftinin iki tarafı farklı para biriminde: TL tutarı TL taraftaki tutardır (sabit); iki taraf da dövizse çıkan tarafın TCMB kuru;
// döviz tutarları olduğu gibi kalır, diğer tarafın kuru TL / döviz olur (fişte TL borç = alacak)
function virmanTL(r){
  if(r.src!=='virman'||!r.vPair)return null;const p=S.rows.find(x=>x.id===r.vPair);if(!p)return null;
  const fr=S.files.find(x=>x.id===r.fileId),fp=S.files.find(x=>x.id===p.fileId);const pr=filePB(fr),pp=filePB(fp);if(pr===pp)return null;
  const ar=Math.abs(r2(r.amt)),ap=Math.abs(r2(p.amt));let tl;
  if(pr==='TRY')tl=ar;else if(pp==='TRY')tl=ap;
  else{const cik=r.amt<0?r:p;const pbC=cik===r?pr:pp;const k=S.kur&&S.kur[kurAnahtar(pbC,cik.date)];if(!k||!k.kur)return {kurYok:true,pb:pbC};tl=r2(Math.abs(cik.amt)*k.kur);}
  const dv=(pb,fx)=>pb==='TRY'?{}:{pb,dvz:fx,kur:fx?Math.round(tl/fx*1e6)/1e6:null};
  return {tl,r:dv(pr,ar),p:dv(pp,ap),pr,pp};
}
function refreshVirman(){resetVirman();reassign();return detectVirman();}
function askConfirm(title,text,yes){
  return new Promise(res=>{const m=$('#askModal');$('#askTitle').textContent=title;$('#askText').textContent=text;$('#askYes').textContent=yes||'Evet, sil';
    const prev=document.activeElement;m.hidden=false;$('#askNo').focus();
    const done=v=>{m.hidden=true;document.removeEventListener('keydown',kd,true);$('#askYes').onclick=$('#askNo').onclick=null;m.onpointerdown=null;if(prev&&prev.focus)prev.focus({preventScroll:true});res(v);};
    const kd=e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();done(false);}};
    document.addEventListener('keydown',kd,true);
    $('#askYes').onclick=()=>done(true);$('#askNo').onclick=()=>done(false);m.onpointerdown=e=>{if(e.target===m)done(false);};});
}
/** Günlük iş özeti kaydı (Denetim › Günün özeti). tur: banka|fatura|okc|cek|fis|muavin|mizan|plan|beyanname; sessizce yazar. */
function gunlukYaz(tur,f,ek){try{window.desktop.dataOp('logGunluk',{kayit:{tur,fid:f&&f.id||'',firma:f&&f.name||'',...(ek||{})}}).then(d=>{Store.cache=d;}).catch(()=>{});}catch(e){}}
/** Tek satırlık metin sorar; null = vazgeçildi. */
function askText(title,label,def,yes){
  return new Promise(res=>{let m=$('#askTextModal');
    if(!m){document.body.insertAdjacentHTML('beforeend',`<div class="modal" id="askTextModal" hidden><div class="mbox" style="width:min(460px,100%)" role="dialog" aria-modal="true" aria-labelledby="atTitle">
      <div class="mhead"><h2 id="atTitle"></h2></div><div class="mbody"><label class="lbl" for="atInput" id="atLabel"></label><input id="atInput" type="text" autocomplete="off" style="font-size:15px;padding:9px 11px;width:100%;box-sizing:border-box">
      <div class="actions" style="justify-content:flex-end;margin-top:12px"><button class="btn" id="atNo">Vazgeç</button><button class="btn primary" id="atYes">Tamam</button></div></div></div></div>`);m=$('#askTextModal');}
    $('#atTitle').textContent=title;$('#atLabel').textContent=label||'';const i=$('#atInput');i.value=def||'';$('#atYes').textContent=yes||'Tamam';
    const prev=document.activeElement;m.hidden=false;setTimeout(()=>{i.focus();i.select();},20);
    const done=v=>{m.hidden=true;document.removeEventListener('keydown',kd,true);$('#atYes').onclick=$('#atNo').onclick=null;i.onkeydown=null;m.onpointerdown=null;if(prev&&prev.focus)prev.focus({preventScroll:true});res(v);};
    const kd=e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();done(null);}};document.addEventListener('keydown',kd,true);
    i.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();done(i.value.trim());}};
    $('#atYes').onclick=()=>done(i.value.trim());$('#atNo').onclick=()=>done(null);m.onpointerdown=e=>{if(e.target===m)done(null);};});
}
async function clearAllStatements(){
  const n=S.rows.length;if(!S.files.length){toast('Silinecek hareket yok.');return;}
  if(!(await askConfirm('Tüm hareketler silinsin mi?',`${S.files.length} ekstre ve ${n} hareket listeden silinecek. Firmalar, kurallar ve mizanlar silinmez. Bu işlem geri alınamaz.`,'Evet, hepsini sil')))return;
  S.files=[];S.period=null;S.pop=null;S.exportParts=null;S.filter='all';S.bankFilter='';S.cf={};S.ayF=[];S.sort=null;
  document.querySelectorAll('.frow [data-cf]').forEach(el=>el.value='');
  rebuildRows();renderAll();toast('Tüm hareketler silindi.');
}
const kurallimi=r=>r.src==='kural'||r.src==='atla';                 // "hiç kaydetme" kuralına uyanlar da kurallı
function eslesmeUygula(r,m){r.acc=m.acc;r.src=m.src;r.why=m.why;r.ld=m.ld||'';
  if(m.src==='atla'){if(!r.kSkipIptal&&!r.skip){r.skip=true;r.kSkip=true;}}
  else if(r.kSkip){r.skip=false;r.kSkip=false;r.kSkipIptal=false;}}
function rebuildRows(){
  const prev=new Map(S.rows.map(r=>[r.id,r]));S.rows=[];
  for(const f of S.files){f.rows.forEach((r,i)=>{const id=f.id+':'+i;const p=prev.get(id);if(p&&p.amtRaw===r.amt){S.rows.push(p);return;}const kp=isCard()&&r.amt>0&&KK_PAY.test(N(r.desc))&&!KK_REF.test(N(r.desc));S.rows.push({...r,id,fileId:f.id,amtRaw:r.amt,manual:false,skip:kp,kpay:kp});});}
  refreshVirman();
}
function reassign(){
  const match=buildMatcher(S.firm,S.rules,S.miz);
  const H=window.__hesap;const f=S.firm;const plan=(H&&f&&f.lucaId&&!isExample())?H.planHazir(f,()=>{if(S.firm&&S.firm.id===f.id){reassign();renderAll();}}):null;
  for(const r of S.rows){if(r.manual)continue;const m=match(r);eslesmeUygula(r,m);
    // mizanda bulunamayan karşı taraf: ünvanı açıklamadan çıkar → hesap planında ara → yoksa firmanın düzenine göre sıradaki kodla taslak cari
    if(m.src==='aski'&&plan){const ad=unvanCikar(r.desc);if(ad){const o=H.cariOner(f,plan,r.amt>=0?'120':'320',ad,'');
      if(o&&o.kod){r.acc=o.kod;r.src=o.yeni?'yeni':'cari';r.why=o.yeni?ad:(o.ad||ad);}}}}
}

/* ---------- çizim ---------- */
const AY=['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'];
const ymOf=d=>d.getFullYear()+'-'+pad(d.getMonth()+1);
const isoOf=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
const isoToDate=v=>{const m=String(v||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);return m?new Date(+m[1],+m[2]-1,+m[3]):null;};
function periodOn(){const p=S.period||{};return !!(p.from||p.to||(p.months&&p.months.length));}
function inPeriod(r){
  const p=S.period;if(!p)return true;
  const f=isoToDate(p.from),t=isoToDate(p.to);
  if(f&&r.date<f)return false;if(t&&r.date>t)return false;
  if(p.months&&p.months.length&&!p.months.includes(ymOf(r.date)))return false;
  return true;
}
function periodText(){
  const p=S.period||{};const parts=[];
  if(p.from||p.to)parts.push(`${p.from?fmtD(isoToDate(p.from)):'…'} – ${p.to?fmtD(isoToDate(p.to)):'…'}`);
  if(p.months&&p.months.length)parts.push(p.months.map(m=>AY[+m.slice(5)-1]+' '+m.slice(0,4)).join(', '));
  return parts.join(' · ')||'tüm tarihler';
}
function dataRange(){if(!S.rows.length)return null;let a=S.rows[0].date,b=a;for(const r of S.rows){if(r.date<a)a=r.date;if(r.date>b)b=r.date;}return [a,b];}
function renderPeriod(){
  const el=$('#periodbar');if(!el)return;
  if(!S.rows.length){el.hidden=true;return;}
  el.hidden=false;const p=S.period||{};const rg=dataRange();
  const cnt={};S.rows.forEach(r=>{const k=ymOf(r.date);cnt[k]=(cnt[k]||0)+1;});
  const months=Object.keys(cnt).sort();
  el.classList.toggle('on',periodOn());
  el.innerHTML=`<span class="lbl">Dönem</span>
    <input type="date" id="pFrom" value="${esc(p.from||'')}" min="${isoOf(rg[0])}" max="${isoOf(rg[1])}" aria-label="Başlangıç tarihi"><span class="muted">–</span>
    <input type="date" id="pTo" value="${esc(p.to||'')}" min="${isoOf(rg[0])}" max="${isoOf(rg[1])}" aria-label="Bitiş tarihi">
    <span class="mchips" role="group" aria-label="Aylar">${months.map(m=>`<button class="mchip" data-month="${m}" aria-pressed="${!!(p.months&&p.months.includes(m))}">${AY[+m.slice(5)-1]} ${m.slice(2,4)}<span class="n">${cnt[m]}</span></button>`).join('')}</span>
    ${periodOn()?`<button class="btn small ghost" id="pClear">Tüm dönem</button><span class="note">${S.rows.filter(inPeriod).length} / ${S.rows.length} hareket dönemde</span>`:`<span class="note">Ay seçerek ya da tarih aralığı girerek tabloyu ve Luca dosyasını daraltın.</span>`}`;
}
function setPeriod(patch){S.period={from:'',to:'',months:[],...(S.period||{}),...patch};S.exportParts=null;S.pop=null;renderPeriod();keepScroll(()=>{renderTable();renderOut();});}
function renderModeTabs(){
  const el=$('#modeTabs');if(!el)return;
  const cnt=m=>m===S.mode?S.rows.length:((S.wsStore||{})[m]?(S.wsStore[m].rows||[]).length:0);
  const T=[['bank','Banka ekstreleri','ic-bank'],['card','Kredi kartı ekstreleri','ic-card']];
  el.innerHTML=T.map(([m,l,ic])=>`<button class="modetab ${ic}" role="tab" data-mode="${m}" aria-selected="${S.view==='fatura'?m==='fatura':S.mode===m}">${l}${m!=='fatura'&&cnt(m)?` <span class="count">${cnt(m)}</span>`:''}</button>`).join('');
  const L=ML();const set=(id,v)=>{const x=$('#'+id);if(x)x.textContent=v;};
  set('p1Title',L.p1);set('dropTitle',L.drop);set('p2Note',L.p2);set('hBank',L.Acc);set('hIn',L.In);set('hInS',L.inS);set('hOut',L.Out);set('hOutS',L.outS);set('hAccS',L.accS);
}
function renderCards(){
  const el=$('#cardsBox');if(!el)return;
  if(!isCard()){el.hidden=true;el.innerHTML='';return;}
  const cs=S.firm.cards||[];el.hidden=false;
  el.innerHTML=`<div class="cardsed"><span class="lbl" style="margin:0">Kredi kartları · Luca hesap kodu</span>
    ${cs.map((c,i)=>{const nm=accName(c.code);return `<div class="bankrow"><input type="text" data-card="${i}" data-f="label" value="${esc(c.label)}" placeholder="Kart adı (örn. Garanti Bonus 4512)" aria-label="Kart adı"><input type="text" class="mono" list="accList" data-card="${i}" data-f="code" value="${esc(c.code)}" placeholder="309.01.001" aria-label="Kart hesap kodu"><span class="accn">${nm?esc(nm):nm===null&&c.code?'<span class="chip warn">mizanda yok</span>':''}</span><button class="btn small ghost" data-delcard="${i}" aria-label="Kartı sil">×</button></div>`;}).join('')}
    <div class="actions"><button class="btn small ic-plus" id="addCard">Kredi kartı ekle</button><span class="note">${cs.length?'Hesap kodunu elle yazın (örn. 300, 309 ya da firmanızın kredi kartı hesabı). Ekstreyi bırakınca kartı dosyanın yanından seçin.':'Önce kartı ve Luca\'daki hesap kodunu girin, sonra ekstresini aşağıya bırakın.'}</span></div></div>`;
}
const WS_KEYS=['files','rows','period','filter','bankFilter','cf','sort','pop','exportParts','fisDesc'];
function switchMode(m){
  if(m==='fatura'){if(typeof FKUI==='undefined')return;S.view='fatura';lsSet('ekstre-luca-view','fatura');renderModeTabs();{const h=$('#h1Mod');if(h)h.textContent='Muhasebe İşlemleri';}FKUI.show();return;}
  if(S.view==='fatura'){S.view=null;lsSet('ekstre-luca-view','');{const h=$('#h1Mod');if(h)h.textContent='Banka İşlemleri';}if(typeof FKUI!=='undefined')FKUI.hide();if(m===S.mode){renderModeTabs();return;}}
  if(m===S.mode)return;
  S.wsStore=S.wsStore||{};const cur={};WS_KEYS.forEach(k=>cur[k]=S[k]);S.wsStore[S.mode]=cur;
  S.mode=m;lsSet('ekstre-luca-mode',m);
  const ld=S.wsStore[m]||{files:[],rows:[],period:null,filter:'all',bankFilter:'',cf:{},sort:null,pop:null,exportParts:null,fisDesc:lsGet(ML().fisKey,ML().fis)};
  WS_KEYS.forEach(k=>S[k]=ld[k]);
  S.rules=modeRules();S.draftRule=null;S.ruleQ='';
  if(ld.stale){S.files=S.files.filter(f=>!f.sample);S.files.forEach(f=>{bankaEsle(f);});ld.stale=false;rebuildRows();}
  document.querySelectorAll('.frow [data-cf]').forEach(el=>el.value=(S.cf||{})[el.dataset.cf]||'');
  reassign();renderAll();
}
function saveCards(full){
  if(!isExample()){const i=S.firms.findIndex(f=>f.id===S.firm.id);if(i>=0)S.firms[i]={...S.firm};Store.saveFirm(S.firm).catch(e=>toast('Kaydedilemedi: '+e.message));}
  S.exportParts=null;reassign();
  if(full)renderAll();else{renderToolbar();renderFiles();renderTable();renderOut();renderModeTabs();
    const el=$('#cardsBox');if(el)el.querySelectorAll('[data-card][data-f="code"]').forEach(inp=>{const n=accName(inp.value.trim());const sp=inp.nextElementSibling;if(sp)sp.innerHTML=n?esc(n):n===null&&inp.value.trim()?'<span class="chip warn">mizanda yok</span>':'';});}
}
function renderAll(){renderModeTabs();renderCards();renderFirmSel();renderSide();renderFiles();renderPeriod();renderTable();renderOut();}
function renderFirmSel(){
  const sel=$('#firmSel');
  const opts=S.firms.map(f=>`<option value="${esc(f.id)}"${f.id===S.firmId?' selected':''}>${esc(f.name)}</option>`).join('');
  sel.innerHTML=(S.firms.length?'':`<option value="${EXAMPLE_ID}" selected>Örnek Firma (kaydedilmez)</option>`)+opts;
}
function renderDatalist(){
  const dl=$('#accList');if(!S.miz){dl.innerHTML='';return;}
  dl.innerHTML=S.miz.accounts.filter(([c])=>S.miz.leaf.has(c)).map(([c,n])=>`<option value="${esc(c)}">${esc(n)}</option>`).join('');
}
function accName(code){if(!code)return '';if(!S.miz)return '';const n=S.miz.byCode.get(code);return n==null?null:n;}
// programın önerdiği (Luca'da henüz açılmamış) taslak hesap mı?
const taslakMi=(kod,fid)=>{const H=window.__hesap;fid=fid||(S.firm&&S.firm.id);return !!(H&&fid&&H.taslakMi(fid,kod));};
const taslakAd=(kod,fid)=>{const H=window.__hesap;fid=fid||(S.firm&&S.firm.id);return H&&fid?H.taslakAd(fid,kod):'';};

function renderSide(){
  const f=S.firm;
  const rules=S.rules.slice().sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||'')));
  const q=N(S.ruleQ||'');
  const shown=q?rules.filter(r=>N(kuralMetni(r)+' '+r.acc+' '+(r.ld||'')+' '+(accName(r.acc)||'')).includes(q)):rules;
  const miz=f.mizanInfo;
  const dr=S.draftRule||{k:'',ek:[],dir:'all',acc:'',ld:'',eylem:''};const drEk=Array.isArray(dr.ek)?dr.ek:[];const drAtla=dr.eylem==='atla';
  $('#firmBody').innerHTML=`
      <div class="actions" style="justify-content:space-between"><span class="note">Bu ayarlar seçili firmaya kaydedilir.</span>${isExample()?'':`<button class="btn small ghost danger" id="delFirm">${S.confirmDel?'Silmeyi onayla':'Firmayı sil'}</button>`}</div>
      ${isExample()?`<div class="banner">Örnek veriyle açıldı. Kendi firmanız için <b>Ayarlar › Firmalar</b> bölümünden (Luca'dan firma ekle ya da Yeni firma) başlayın; mizan ve kurallar firmaya kaydedilir.</div>`:''}
      <div><label class="lbl" for="fName">Firma adı</label><input type="text" id="fName" value="${esc(f.name)}"></div>
      <div>
        <label class="lbl">Luca mizanı</label>
        <div class="actions">${typeof Desk!=='undefined'?Desk.firmMizanButton():''}<button class="btn" id="mizBtn">${S.miz?'Excel\'den yenile':'Excel\'den yükle'}</button><input type="file" id="mizIn" accept=".xlsx,.xls,.csv" hidden>
        <span class="note">${S.miz?`${S.miz.leaf.size} alt hesap · ${esc(miz&&miz.file||'')}${miz&&miz.at?' · '+esc(new Date(miz.at).toLocaleDateString('tr-TR')):''}`:'Luca → Raporlar → Mizan → Excel'}</span></div>
      </div>
      <div>
        <label class="lbl">Banka hesapları (102)</label>
        <div class="banks">${(f.banks||[]).map((b,i)=>`<div class="bankrow"><input type="text" data-bank="${i}" data-f="label" value="${esc(b.label)}" placeholder="Banka adı" aria-label="Banka adı"><input type="text" class="mono" list="accList" data-bank="${i}" data-f="code" value="${esc(b.code)}" placeholder="102.01.001" aria-label="Hesap kodu"><button class="btn small ghost" data-delbank="${i}" aria-label="Sil">×</button></div>`).join('')}
        <div><button class="btn small" id="addBank">+ Banka hesabı</button></div></div>
      </div>
      <div class="row2">
        <div><label class="lbl" for="askiIn">Askı · girişler</label><input type="text" class="mono" list="accList" id="askiIn" value="${esc(f.askiIn||'')}" placeholder="399.99"></div>
        <div><label class="lbl" for="askiOut">Askı · çıkışlar</label><input type="text" class="mono" list="accList" id="askiOut" value="${esc(f.askiOut||'')}" placeholder="199.99"></div>
      </div>
      <p class="note" style="margin:0">Hiçbir kurala ve mizandaki cari isimlere uymayan hareketler askı hesabına gider.</p>
      ${isExample()?'':`<div class="actions firm-kaydet" style="justify-content:flex-end;border-top:1px solid var(--line);padding-top:12px;margin-top:4px">${S.firmKirli||S.taslakId?`<span class="note" style="margin-right:auto;color:var(--aski-fg,#a15c00)">${S.taslakId?'Yeni firma henüz kaydedilmedi':'Kaydedilmemiş değişiklikler var'}</span>`:''}<button class="btn" type="button" id="firmVazgec">Vazgeç</button><button class="btn primary" type="button" id="firmKaydet">Kaydet</button></div>`}
`;
  {const rt=$('#rulesTitle');if(rt)rt.textContent=isCard()?'Eşleştirme kuralları · Kredi kartı':'Eşleştirme kuralları · Banka';}
  $('#tabAdd').setAttribute('aria-selected',S.rulesTab!=='list');
  $('#tabList').setAttribute('aria-selected',S.rulesTab==='list');
  $('#tabList').innerHTML='Kural listesi <span class="count">'+S.rules.length+'</span>';
  $('#rulesBody').innerHTML=S.rulesTab==='list'?`
      ${S.rules.length?'':'<div class="actions"><button class="btn small" id="stdRules">Standart kural setini ekle</button><span class="note">'+(isCard()?'Akaryakıt, telefon, kart faiz/masrafı, SGK, vergi':'Banka masrafı, SGK, vergi, maaş, faiz, POS')+'</span></div>'}
      ${S.rules.length>6?`<input type="text" id="ruleQ" placeholder="Kurallarda ara" value="${esc(S.ruleQ||'')}" aria-label="Kurallarda ara">`:''}
      ${shown.length?`<div class="rules">${shown.map(r=>{const nm=accName(r.acc);const sr=kuralSartlari(r);return `<div class="rule"><div class="k">${sr.length>1?sr.map((x,i)=>`${i?'<span class="ve">VE</span> ':''}${esc(x)}`).join(' '):esc(r.k)}</div><span class="rulebtns"><button class="btn small ghost" data-edrule="${esc(r.id)}" aria-label="Kuralı düzenle" title="Düzenle">✎ Düzenle</button><button class="btn small ghost" data-delrule="${esc(r.id)}" aria-label="Kuralı sil" title="Sil">×</button></span><div class="a">${kuralAtla(r)?'<span class="chip atla">hiç kaydetme</span> fişe alınmaz':`<span class="mono">${esc(r.acc)}</span> ${nm?esc(nm):nm===null?'<span class="chip warn">mizanda yok</span>':''}`} · ${DIRS[r.dir]||DIRS.all}${r.ld&&!kuralAtla(r)?'<br>Luca: '+esc(r.ld):''}</div></div>`;}).join('')}</div>`:`<p class="note" style="margin:0">${S.rules.length?'Aramaya uyan kural yok.':'Henüz kural yok. “Kural ekle” sekmesinden ya da tablodaki “Kural yap” düğmesiyle ekleyin.'}</p>`}
`:`
      <form class="ruleform" id="ruleForm">
        <div><label class="lbl" for="rK">1. şart · açıklamada geçen kelime / kod <span class="note">(| = ya da · + = hepsi geçmeli)</span></label><input type="text" id="rK" value="${esc(dr.k)}" placeholder="örn. SGK | SOSYAL GÜVENLİK · KİRA + OCAK" autocomplete="off"></div>
        ${drEk.map((x,i)=>`<div class="rsart"><label class="lbl" for="rEk${i}">${i+2}. şart <span class="note">(bu da tutmalı · VE)</span></label><div class="rsart-s"><input type="text" id="rEk${i}" data-rek="${i}" value="${esc(x)}" placeholder="örn. OCAK | ŞUBAT" autocomplete="off"><button class="btn small ghost" type="button" data-rekdel="${i}" aria-label="${i+2}. şartı kaldır" title="Şartı kaldır">×</button></div></div>`).join('')}
        ${drEk.length<4?`<div><button class="btn small" type="button" id="rEkle" title="Tüm şartlar birlikte tutarsa kural uygulanır (VE)">+ Şart ekle</button></div>`:''}
        <div class="row2" style="grid-template-columns:1fr">
          <div><label class="lbl" for="rDir">Yön (borç / alacak)</label><select id="rDir">${dirOpts(dr.dir)}</select></div>
          <div><label class="lbl" for="rEylem">Şartlar tutarsa</label><select id="rEylem"><option value=""${drAtla?'':' selected'}>Kaydet · karşı hesaba</option><option value="atla"${drAtla?' selected':''}>Hiç kaydetme · fişe alma</option></select></div>
          <div class="rkaydet"${drAtla?' hidden':''}><label class="lbl" for="rAcc">Karşı hesap</label><input type="text" class="mono" list="accList" id="rAcc" value="${esc(dr.acc)}" placeholder="320.01.004"></div>
        </div>
        <div class="rkaydet"${drAtla?' hidden':''}><label class="lbl" for="rLd">Luca'ya yazılacak açıklama</label><input type="text" id="rLd" value="${esc(dr.ld||'')}" placeholder="{BANKA} - SGK ÖDEMESİ · boşsa ekstre açıklaması"></div>
        <div class="actions"><button class="btn primary" type="submit">${dr.editId?'Kuralı güncelle':'Kuralı ekle'}</button>${dr.editId?'<button class="btn" type="button" id="ruleEditVaz">Vazgeç</button>':''}<span class="note">Birden çok kelime için | ile ayırın. Büyük/küçük harf ve Türkçe karakter fark etmez. Karşı hesap 335 ise açıklama “{BANKA} - MAAŞ ÖDEMESİ” olarak dolar.</span></div>
      </form>
      <p class="note" style="margin:0">Tablodaki bir satırda “Kural yap” ile de, satırın hemen altından kural ekleyebilirsiniz.</p>`;
  renderToolbar();
}

function renderToolbar(){
  const f=S.firm;const banks=accts().filter(b=>b.code).length;
  const sum=`${banks} ${ML().accs} · ${S.miz?S.miz.leaf.size+' hesaplık mizan':'mizan yok'} · askı ${esc(f.askiIn||'—')} / ${esc(f.askiOut||'—')}`;
  const btns=`<button class="btn ic-sync" data-luca="mizan">Mizanları güncelle</button><button class="btn ic-db" data-dataopen="1">Veri ve yedek</button><span class="tsep"></span><button class="btn ic-firm" data-open="firm">Firma ayarları</button><button class="btn ic-plus" data-open="add">Kural ekle</button><button class="btn ic-list" data-open="list">Kurallar <span class="count">${S.rules.length}</span></button>`;
  $('#toolbar').innerHTML=`${btns}<span class="sum">${isExample()?'<b>Örnek firma</b> · ':''}${sum}</span>`;
  $('#bottombar').innerHTML=`${btns}<button class="btn ghost" data-top="1">↑ Başa dön</button>`;
  Desk.renderLicenseFoot();
}
let modalOpener=null,downOnBackdrop=false;
document.addEventListener('pointerdown',e=>{downOnBackdrop=e.target.classList.contains('modal');});
function openModal(which){
  modalOpener=document.activeElement;
  $('#firmModal').hidden=which!=='firm';$('#rulesModal').hidden=which==='firm';
  if(which!=='firm')S.rulesTab=which==='list'?'list':'add';
  renderSide();document.documentElement.style.overflow='hidden';
  const first=which==='firm'?$('#fName'):which==='list'?($('#ruleQ')||$('#tabList')):$('#rK');
  if(first)first.focus({preventScroll:true});
}
function closeModal(zorla){
  if(zorla!==true&&!$('#firmModal').hidden&&(S.firmKirli||S.taslakId)&&!isExample()){
    askConfirm(S.taslakId?'Yeni firma kaydedilsin mi?':'Değişiklikler kaydedilsin mi?',S.taslakId?'Firma henüz kaydedilmedi. “Kaydet” derseniz firma eklenir; “Vazgeç” derseniz eklenmez.':'Firma ayarlarında kaydedilmemiş değişiklikler var. “Vazgeç” derseniz değişiklikler geri alınır.','Kaydet')
      .then(async ev=>{if(ev)await firmaKaydet();else{await firmaVazgec();closeModal(true);}});return;}
  $('#firmModal').hidden=true;$('#rulesModal').hidden=true;document.documentElement.style.overflow='';
  if(modalOpener&&modalOpener.focus)modalOpener.focus({preventScroll:true});
}
document.addEventListener('click',e=>{
  const o=e.target.closest('[data-open]');if(o){openModal(o.dataset.open);return;}
  if(e.target.closest('[data-top]')){window.scrollTo({top:0,behavior:'smooth'});return;}
  if(e.target.closest('[data-close]')||(e.target.classList.contains('modal')&&downOnBackdrop)){closeModal();return;}
  const rt=e.target.closest('[data-rtab]');if(rt){S.rulesTab=rt.dataset.rtab;renderSide();}
});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&(!$('#firmModal').hidden||!$('#rulesModal').hidden)){e.preventDefault();closeModal();}});

function filesHead(){
  const n=S.files.reduce((a,f)=>a+f.rows.length,0);
  return `<div class="actions" style="justify-content:space-between"><span class="note">${S.files.length} dosya · ${n} hareket</span><button class="btn small ghost danger" id="clearFiles">Ekstreleri temizle</button></div>`;
}
function renderFiles(){
  const el=$('#files');
  if(!S.files.length){el.innerHTML='';return;}
  const banks=accts();const L=ML();
  el.innerHTML=filesHead()+S.files.map(f=>{
    const ins=f.rows.filter(r=>r.amt>0).length,outs=f.rows.length-ins;
    let map='';
    if(f.table){
      const opts=(sel,allowNone)=>(allowNone?`<option value="-1"${sel<0?' selected':''}>—</option>`:'')+f.table.headers.map((h,i)=>`<option value="${i}"${i===sel?' selected':''}>${esc(h||('Sütun '+(i+1)))}</option>`).join('');
      const m=f.map;
      map=`<details class="mapgrid" style="display:block"><summary>Sütun eşleştirmesi (${esc(f.table.sheet)}, başlık satırı ${f.table.hIdx+1})</summary><div class="mapgrid" style="border:0">
      ${[['date','Tarih',false],['desc0','Açıklama',false],['amount','Tutar (tek sütun)',true],['out','Çıkan / Borç',true],['inn','Giren / Alacak',true],['bal','Bakiye',true],['doc','Dekont no',true]].map(([k,l,n])=>`<div><label class="lbl">${l}</label><select data-map="${k}" data-file="${esc(f.id)}">${opts(k==='desc0'?(m.desc[0]??-1):m[k],n)}</select></div>`).join('')}
      </div></details>`;
    }
    return `<div class="file">
      <div><div class="name">${esc(f.name)} ${f.sample?'<span class="chip warn">örnek</span>':''}</div>
      <div class="meta">${esc(f.kind)} · ${f.error?`<span class="err">${esc(f.error)}</span>`:`${f.rows.length} hareket (${ins} ${L.in_}, ${outs} ${L.out_})${f.rows.length?' · '+fmtD(f.rows[0].date)+' – '+fmtD(f.rows[f.rows.length-1].date):''}`}</div></div>
      <div class="ctl">
        ${isCard()?'':`<input type="text" list="bankNames" data-bankname="${esc(f.id)}" value="${esc(f.bank||'')}" placeholder="Banka seçin" title="Tıklayın: banka listesi açılır; yazarak da arayabilirsiniz" aria-label="Banka adı" class="${f.bank?'':'needbank'}" style="width:170px">`}
        <select data-filebank="${esc(f.id)}" aria-label="${L.Acc} hesabı">${banks.length?banks.map((b,i)=>`<option value="${i}"${i===f.bankIdx?' selected':''}>${esc(b.label||'Banka')} · ${esc(b.code||'kod yok')}</option>`).join(''):`<option value="-1">Önce ${L.accs} ekleyin</option>`}</select>${esleRozet(f)}
        <select data-filepb="${esc(f.id)}" aria-label="Para birimi" title="Ekstrenin para birimi (hesap adından / ekstre başlığından bulunur; değiştirebilirsiniz)" style="width:auto">${PB_LISTE.map(pb=>`<option value="${pb}"${filePB(f)===pb?' selected':''}>${pb==='TRY'?'TL':pb}</option>`).join('')}</select>
        <button class="btn small ghost" data-delfile="${esc(f.id)}" aria-label="Dosyayı kaldır">Kaldır</button>
      </div>${map}</div>`;
  }).join('');
}

function virmanInfo(r){const p=S.rows.find(x=>x.id===r.vPair);if(!p)return '';
  return `<div class="vinfo">↔ ${esc(bankOfRow(p))} · ${fmtD(p.date)} · ${p.amt>0?'+':'−'}${fmt(Math.abs(p.amt))}${r.skip?' · karşı kayıt, fişe alınmıyor':' · fişe bu kayıt alınıyor'}</div>`;}
function bankOfRow(r){const f=S.files.find(x=>x.id===r.fileId);return fileBankName(f)||'—';}
// kaynak rozeti tıklanabilir: "bu hareket aslında virman / cari / askı" denince karşı hesap ona göre yeniden bulunur
function srcChip(r){
  if(r.kpay&&r.skip)return `<span class="chip kpay" title="Kart borcu ödemesi">kart ödemesi</span>`;
  const b=(c,t,ti)=>`<button type="button" class="chip ${c} chipbtn" data-tur="${esc(r.id)}" title="${esc(ti||'')}${ti?' · ':''}Tıklayın: bu hareketin türünü siz söyleyin (virman / cari / askı)">${t}</button>`;
  if(r.src==='kural')return b('kural','kural',r.why);
  if(r.src==='atla')return b('atla','kaydetme',`Kural: ${r.why} → hiç kaydetme (fişe alınmaz)`);
  if(r.src==='cari')return b('cari','cari',r.why);
  if(r.src==='yeni')return b('yeni','yeni cari',`Mizanda yok; ${r.why} için firmanın hesap planı düzenine göre önerildi — Luca'ya aktarırken önce hesap planına açılır`);
  if(r.src==='elle')return b('elle','elle','');
  if(r.src==='virman')return b('virman','virman','');
  return b('aski','askı','');
}
async function turSoyle(r){
  const secim=await Desk.choose('Bu hareket aslında ne?',`${fmtD(r.date)} · ${fmt(Math.abs(r.amt))} TL · ${(r.desc||'').slice(0,90)}\n\nŞu an: ${r.src==='aski'||!r.src?'askı':r.src}. Doğrusunu seçin; karşı hesap ona göre yeniden bulunur.`,
    [{label:'Virman (firmanın kendi hesabı)',value:'virman'},{label:'Cari (müşteri / satıcı)',value:'cari'},{label:'Askı',value:'aski'},{label:'Vazgeç',value:null}]);
  if(!secim)return;
  if(secim==='aski'){r.acc=r.amt>=0?(S.firm.askiIn||''):(S.firm.askiOut||'');r.src='aski';r.why='';r.manual=true;if(r.vPair){const p=S.rows.find(x=>x.id===r.vPair);if(p){p.vPair=null;if(p.src==='virman'){p.src='';p.manual=false;}if(p.vSkipped){p.skip=false;p.vSkipped=false;}}r.vPair=null;if(r.vSkipped){r.skip=false;r.vSkipped=false;}}
    renderAll();toast('Askıya alındı.');return;}
  if(secim==='virman'){
    // 1) diğer ekstrelerde aynı tutarlı, ters yönlü, ±3 gün içindeki hareket (anahtar kelime aranmaz; siz söylediniz)
    const fileOf=new Map(S.files.map(f=>[f.id,f]));const pbR=filePB(fileOf.get(r.fileId));
    const es=S.rows.filter(x=>{if(x.id===r.id||x.fileId===r.fileId||x.vPair||Math.abs(x.date-r.date)/864e5>3||Math.sign(x.amt)===Math.sign(r.amt))return false;
      const pbX=filePB(fileOf.get(x.fileId));if(pbX===pbR)return Math.round(x.amt*100)===-Math.round(r.amt*100);
      const a=tlDeger(pbR,r.amt,r.date),b=tlDeger(pbX,x.amt,x.date);return a!=null&&b!=null&&Math.abs(a-b)/Math.max(a,b)<=0.1;});   // döviz bozumu: TCMB kuruyla en çok %10 farklı
    let karsi=null;
    if(es.length===1)karsi=es[0];
    else if(es.length>1){karsi=await Desk.choose('Karşı hareket hangisi?','Diğer ekstrelerde aynı tutarlı birden çok hareket var.',es.slice(0,6).map(x=>({label:`${fmtD(x.date)} · ${fileBankName(fileOf.get(x.fileId))||'banka'} · ${(x.desc||'').slice(0,50)}`,value:x})).concat([{label:'Hiçbiri — yalnız bu satırı virman yap',value:'yok'}]));if(karsi===null)return;if(karsi==='yok')karsi=null;}
    if(karsi){const fo=fileOf.get(r.fileId),fi=fileOf.get(karsi.fileId);const ld=`VİRMAN ${fileBankName(r.amt<0?fo:fi)||'BANKA'} → ${fileBankName(r.amt<0?fi:fo)||'BANKA'}`.toLocaleUpperCase('tr-TR');
      r.src=karsi.src='virman';r.manual=karsi.manual=true;r.vPair=karsi.id;karsi.vPair=r.id;r.why=karsi.why='';r.ld=karsi.ld=ld;r.acc=fileCode(fi);karsi.acc=fileCode(fo);
      r.skip=false;r.vSkipped=false;karsi.skip=true;karsi.vSkipped=true;renderAll();toast('Virman olarak eşlendi: '+ld);return;}
    // 2) karşı hareket yok: firmanın diğer 102 banka hesaplarından biri seçilir
    const banks=accts().map((b,i)=>({b,i})).filter(x=>x.b.code&&x.i!==(fileOf.get(r.fileId)||{}).bankIdx);
    const miz102=S.miz?[...S.miz.accounts].filter(([c])=>S.miz.leaf.has(c)&&/^10[28]/.test(c)&&!banks.some(x=>x.b.code===c)).slice(0,4).map(([c,n])=>({label:`${c} ${n}`,value:c})):[];
    const sec=await Desk.choose('Hangi hesaba virman?','Diğer ekstrede karşı hareket bulunamadı. Paranın gittiği / geldiği firmanın kendi hesabını seçin.',banks.map(x=>({label:`${x.b.code} ${x.b.label||''}`,value:x.b.code})).concat(miz102,[{label:'Vazgeç',value:null}]));
    if(!sec)return;r.acc=sec;r.src='virman';r.manual=true;r.why='';r.ld=`VİRMAN ${(fileBankName(fileOf.get(r.fileId))||'BANKA')}`.toLocaleUpperCase('tr-TR');renderAll();toast('Virman olarak işaretlendi: '+sec);return;}
  if(secim==='cari'){
    if(!S.miz){toast('Önce firmanın mizanını yükleyin; cari hesaplar mizandan bulunur.');return;}
    const d=' '+N(r.desc)+' ';const toks=d.split(' ').filter(t=>t.length>=4&&!STOPW.has(t)&&!/^\d+$/.test(t));
    const ad=[];for(const [code,name] of S.miz.accounts){if(!S.miz.leaf.has(code)||!name||!/^(120|121|126|127|131|136|159|320|321|326|331|335|336|340)/.test(code))continue;
      const nt=N(name).split(' ').filter(t=>t.length>=3);let sc=0;for(const t of toks){if(nt.some(x=>x===t))sc+=t.length*2;else if(nt.some(x=>x.startsWith(t.slice(0,4))||t.startsWith(x.slice(0,4))))sc+=2;}
      if(sc>=4)ad.push({code,name,sc:sc+((r.amt>=0?code[0]==='1':code[0]==='3')?1:0)});}
    ad.sort((a,b)=>b.sc-a.sc);
    const sec=await Desk.choose('Hangi cari?',ad.length?'Açıklamaya en yakın cari hesaplar:':'Açıklamaya uyan cari bulunamadı; hesabı satırdaki kutuya yazabilir ya da önce Luca\'da açabilirsiniz.',ad.slice(0,6).map(a=>({label:`${a.code} ${a.name}`,value:a.code})).concat([{label:'Vazgeç',value:null}]));
    if(!sec)return;const nm=S.miz.byCode.get(sec)||'';r.acc=sec;r.src='cari';r.why=nm;r.manual=true;
    if(r.vPair){const p=S.rows.find(x=>x.id===r.vPair);if(p){p.vPair=null;if(p.src==='virman'){p.src='';p.manual=false;}if(p.vSkipped){p.skip=false;p.vSkipped=false;}}r.vPair=null;if(r.vSkipped){r.skip=false;r.vSkipped=false;}}
    renderAll();toast('Cari olarak eşlendi: '+sec+' '+nm);}
}
function numFilter(q,v){
  q=String(q||'').trim();if(!q)return true;if(v==null)return false;let m;
  if((m=q.match(/^([\d.,]+)\s*-\s*([\d.,]+)$/))){const a=parseAmount(m[1]),b=parseAmount(m[2]);return !!(a&&b)&&v>=a.v-0.004&&v<=b.v+0.004;}
  if((m=q.match(/^(>=|<=|>|<|=)\s*(.+)$/))){const a=parseAmount(m[2]);if(!a)return true;const x=a.v;return m[1]==='>'?v>x:m[1]==='<'?v<x:m[1]==='>='?v>=x-0.004:m[1]==='<='?v<=x+0.004:Math.abs(v-x)<0.005;}
  const a=parseAmount(q);return fmt(v).includes(q)||(!!a&&Math.abs(v-a.v)<0.005);
}
function dateFilter(q,d){
  q=String(q||'').trim();if(!q)return true;const m=q.match(/^(\S+)\s*-\s*(\S+)$/);
  if(m){const a=parseDate(m[1]),b=parseDate(m[2]);if(a&&b)return d>=a&&d<=b;}
  return fmtD(d).includes(q);
}
function colFilterOk(r){
  const c=S.cf||{};const has=k=>c[k]&&String(c[k]).trim();
  if(has('date')&&!dateFilter(c.date,r.date))return false;
  if((has('dateBas')||has('dateBit'))&&r.date){const d=isoOf(r.date);if(has('dateBas')&&d<c.dateBas)return false;if(has('dateBit')&&d>c.dateBit)return false;}
  if(S.ayF&&S.ayF.length&&!(r.date&&S.ayF.includes(isoOf(r.date).slice(0,7))))return false;
  if(has('bank')&&!N(bankOfRow(r)).includes(N(c.bank)))return false;
  if(has('desc')&&!N(r.desc+' '+(r.ld?lucaDesc(r):'')+' '+(r.doc||'')).includes(N(c.desc)))return false;
  if(has('in')&&!numFilter(c.in,r.amt>0?r.amt:null))return false;
  if(has('out')&&!numFilter(c.out,r.amt<0?-r.amt:null))return false;
  if(has('acc')&&!N(r.acc+' '+(accName(r.acc)||'')).includes(N(c.acc)))return false;
  if(has('src')&&r.src!==c.src)return false;
  return true;
}
function sortRows(list){
  const so=S.sort;if(!so||!so.key)return list;
  const d=so.dir==='desc'?-1:1;const col=(a,b)=>String(a).localeCompare(String(b),'tr',{sensitivity:'base',numeric:true});
  const key={date:r=>r.date.getTime(),bank:r=>bankOfRow(r),desc:r=>r.desc,in:r=>r.amt>0?r.amt:null,out:r=>r.amt<0?-r.amt:null,acc:r=>r.acc||'',src:r=>r.src||''}[so.key];
  const idx=new Map(S.rows.map((r,i)=>[r,i]));
  return list.slice().sort((a,b)=>{const x=key(a),y=key(b);
    if(x==null&&y==null)return idx.get(a)-idx.get(b);if(x==null)return 1;if(y==null)return -1;
    const c=typeof x==='number'?x-y:col(x,y);return c?c*d:idx.get(a)-idx.get(b);});
}
function updateSortHeads(){
  document.querySelectorAll('.sorth').forEach(b=>{if(S.sort&&S.sort.key===b.dataset.sort)b.setAttribute('aria-sort',S.sort.dir==='desc'?'descending':'ascending');else b.removeAttribute('aria-sort');});
  document.querySelectorAll('.frow [data-cf]').forEach(el=>el.classList.toggle('on',!!String((S.cf||{})[el.dataset.cf]||'').trim()));
}
function renderTable(){
  const rows=S.rows.filter(inPeriod);const act=rows.filter(r=>!r.skip);
  const tin=act.filter(r=>r.amt>0).reduce((s,r)=>s+r.amt,0),tout=act.filter(r=>r.amt<0).reduce((s,r)=>s+r.amt,0);
  const cnt=k=>act.filter(r=>r.src===k).length;const uns=act.filter(r=>r.unsure).length;
  const L=ML();
  $('#stats').innerHTML=[['Hareket',act.length],[L.In+' · '+L.inS,fmt(tin),'pos'],[L.Out+' · '+L.outS,fmt(Math.abs(tout)),'neg'],['Kural / cari',cnt('kural')+cnt('cari')],['Askıda',cnt('aski')],isCard()?['Kart ödemesi',rows.filter(r=>r.kpay).length]:['Virman',rows.filter(r=>r.src==='virman').length/2],isCard()?null:['Yönü belirsiz',uns]].filter(Boolean).map(([k,v,c])=>`<div class="stat"><div class="k">${k}</div><div class="v ${c||''}">${v}</div></div>`).join('');
  const bosMu=r=>!r.acc||r.src==='aski';   // karşı hesap boş (askıda ya da hiç yok)
  const tabs=[['all','Tümü',rows.length],['bos','Boş',rows.filter(bosMu).length],['dolu','Dolu',rows.filter(r=>!bosMu(r)).length],['aski','Askıda',rows.filter(r=>r.src==='aski').length],['kural','Kurallı',rows.filter(kurallimi).length],['kuralsiz','Kuralsız',rows.filter(r=>!kurallimi(r)).length],['cari','Cari',rows.filter(r=>r.src==='cari').length],['elle','Elle',rows.filter(r=>r.src==='elle').length],...(isCard()?[['kpay','Kart ödemesi',rows.filter(r=>r.kpay).length]]:[['virman','Virman',rows.filter(r=>r.src==='virman').length/2],['unsure','Yönü belirsiz',rows.filter(r=>r.unsure).length]])];
  if(isCard()&&(S.filter==='virman'||S.filter==='unsure'))S.filter='all';
  $('#tabs').innerHTML=tabs.map(([k,l,n])=>`<button class="tab" data-tab="${k}" aria-pressed="${S.filter===k}">${l} <span class="mono">${n}</span></button>`).join('')+(rows.length?`<button class="btn small primary" id="kuralUygula" title="Kayıtlı kuralları şimdi tüm satırlara yeniden uygular">⟳ Kuralları Uygula</button>`:'');
  if(S.bankFilter&&!S.files.some(f=>f.id===S.bankFilter))S.bankFilter='';
  if(S.files.length>1)$('#tabs').insertAdjacentHTML('beforeend',`<select id="bankFilter" aria-label="Banka filtresi" style="width:auto;margin-left:auto;padding:3px 8px;font-size:12px"><option value="">${isCard()?'Tüm kartlar':'Tüm bankalar'}</option>${S.files.map(f=>`<option value="${esc(f.id)}"${S.bankFilter===f.id?' selected':''}>${esc(fileBankName(f)||f.name)} · ${f.rows.length}</option>`).join('')}</select>`);
  let vis=rows.filter(r=>(S.filter==='all'||((S.filter==='bos'||S.filter==='dolu')&&S.efTut&&S.efTut.has(r.id))||(S.filter==='bos'?bosMu(r):S.filter==='dolu'?!bosMu(r):S.filter==='unsure'?r.unsure:S.filter==='kpay'?r.kpay:S.filter==='kuralsiz'?!kurallimi(r):S.filter==='kural'?kurallimi(r):r.src===S.filter))&&(!S.bankFilter||r.fileId===S.bankFilter)&&colFilterOk(r));
  {// ay düğmeleri: ekstrelerde hangi aylar varsa (tıklayınca yalnız o ay; Ctrl ile birden çok)
    const aylar=new Map();for(const r of rows){if(!r.date)continue;const k=isoOf(r.date).slice(0,7);aylar.set(k,(aylar.get(k)||0)+1);}
    S.ayF=(S.ayF||[]).filter(k=>aylar.has(k));const ab=$('#ayBar');
    if(ab){ab.hidden=aylar.size<2&&!S.ayF.length;const AYAD=['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];const yillar=new Set([...aylar.keys()].map(k=>k.slice(0,4)));
      ab.innerHTML=`<span class="note">Ay</span><button class="btn small" data-ay="" aria-pressed="${!S.ayF.length}">Tümü <span class="mono">${rows.length}</span></button>`+[...aylar.keys()].sort().map(k=>`<button class="btn small" data-ay="${k}" aria-pressed="${S.ayF.includes(k)}" title="Yalnız bu ay · Ctrl+tık: birden çok ay">${AYAD[+k.slice(5)-1]}${yillar.size>1?' '+k.slice(0,4):''} <span class="mono">${aylar.get(k)}</span></button>`).join('');}}
  vis=sortRows(vis);
  updateSortHeads();
  const nf=Object.values(S.cf||{}).filter(Boolean).length;
  if(rows.length)$('#tabs').insertAdjacentHTML('beforeend',`<button class="btn small ghost danger ic-trash" id="clearAll" style="order:99">Tümünü sil</button>`);
  if(nf||S.filter!=='all'||S.bankFilter)$('#tabs').insertAdjacentHTML('beforeend',`<span class="note" style="${S.files.length>1?'':'margin-left:auto'}">Gösterilen ${vis.length} / ${rows.length}</span>`);
  if(!rows.length){$('#tbody').innerHTML=S.rows.length?`<tr><td colspan="9" class="empty">Seçilen dönemde (${esc(periodText())}) hareket yok.</td></tr>`:`<tr><td colspan="9" class="empty">${isCard()&&!accts().length?'Önce yukarıdan kredi kartını ve Luca hesap kodunu ekleyin, sonra ekstresini bırakın.':'Ekstre yükleyin; hareketler burada karşı hesaplarıyla listelenir.'}</td></tr>`;return;}
  $('#tbody').innerHTML=vis.map(r=>{
    const nm=accName(r.acc);
    return `<tr data-row="${esc(r.id)}" class="${r.skip?'skip':''} ${r.unsure?'unsure':''}">
      <td><input type="checkbox" data-inc="${esc(r.id)}" ${r.skip?'':'checked'} aria-label="Fişe dahil et"></td>
      <td class="mono">${fmtD(r.date)}</td>
      <td class="bankcol">${esc(bankOfRow(r))}</td>
      <td class="desc"><span class="dtext">${esc(r.desc)||'<span class="muted">(açıklama yok)</span>'}</span>${r.doc?` <span class="note mono">${esc(r.doc)}</span>`:''}${window.__aktChip?window.__aktChip(r):''}${r.ld?`<div class="ld">Luca: ${esc(lucaDesc(r))}</div>`:''}${r.src==='virman'?virmanInfo(r):''}${r.kpay?`<div class="vinfo">Kart borcu ödemesi · ${r.skip?'banka ekstresinde zaten kayıtlı olacağından fişe alınmıyor; gerekirse tikleyin':'fişe alınıyor'}</div>`:''}</td>
      ${(()=>{const flip=(r.unsure||isCard())?`<button class="sign" data-flip="${esc(r.id)}" title="${isCard()?'Harcama / ödeme yönünü değiştir':'Yönü belirlenemedi; giriş/çıkış değiştir'}">±</button>`:'';let v=fmt(Math.abs(r.amt));const vt=virmanTL(r);if(vt&&!vt.kurYok&&vt.r&&vt.r.pb){v+=`<span class="dvz" title="Döviz bozumu: TL tutarı ${vt.pr==='TRY'||vt.pp==='TRY'?'TL hesaptaki tutardır (değişmez)':'çıkan dövizin TCMB kuruyla'}; kur = TL / döviz ${fmtKur(vt.r.kur)}">${esc(vt.r.pb)} · ₺${fmt(vt.tl)} (bozum)</span>`;}else{const k=rowKur(r);if(k)v+=`<span class="dvz" title="${esc(k.kur?`${k.pb} · TCMB döviz alış ${fmtKur(k.kur)} (${trTarih(k.bulten)} bülteni) → TL ${fmt(r2(Math.abs(r.amt)*k.kur))}`:'TCMB kuru alınacak')}">${esc(k.pb)}${k.kur?' · ₺'+fmt(r2(Math.abs(r.amt)*k.kur)):''}</span>`;}return r.amt>0?`<td class="amt mono pos">${v}${flip}</td><td class="amt mono empty-amt">·</td>`:`<td class="amt mono empty-amt">·</td><td class="amt mono neg">${v}${flip}</td>`;})()}
      <td><div class="accin"><span class="dc">${r.amt>0?'Alacak':'Borç'}</span><input type="text" list="accList" data-acc="${esc(r.id)}" data-hsad="${esc(String(r.desc||'').slice(0,60))}" value="${esc(r.acc)}" aria-label="Karşı hesap"${taslakMi(r.acc)?' class="taslak"':''}><span class="accname">${taslakMi(r.acc)?`<span class="chip yeni" title="Yeni hesap: Luca'ya aktarırken önce hesap planına açılır">yeni</span> ${esc(taslakAd(r.acc))}`:nm?esc(nm):nm===null&&r.acc?'<span class="chip warn">mizanda yok</span>':''}</span></div></td>
      <td>${srcChip(r)}</td>
      <td><div class="rowbtns">${r.src==='virman'?`<button class="btn small" data-novir="${esc(r.id)}" title="Bu eşleşmeyi kaldır; iki kayıt ayrı ayrı değerlendirilsin">Virman değil</button>`:`<button class="btn small${r.manual&&r.src==='aski'?' aski-on':''}" data-aski="${esc(r.id)}" title="${r.manual&&r.src==='aski'?'Askıdan çıkar, kurallara göre eşleştir':'Bu satırı askı hesabına at'}">${r.manual&&r.src==='aski'?'Askıda ✓':'Askı'}</button>`}<button class="btn small${S.pop&&S.pop.rowId===r.id?' primary':''}" data-mkrule="${esc(r.id)}" aria-expanded="${!!(S.pop&&S.pop.rowId===r.id)}">Kural yap</button></div></td></tr>${S.pop&&S.pop.rowId===r.id?popHtml(r):''}`;
  }).join('')||`<tr><td colspan="9" class="empty bosliste">Bu filtrede hareket yok. Başka bir süzgeç seçin.</td></tr>`;
}

function revealPop(){
  const tw=$('.tablewrap'),pr=$('.poprow');if(!tw||!pr)return;
  tw.style.setProperty('--tw',tw.clientWidth+'px');
  const a=tw.getBoundingClientRect(),b=pr.getBoundingClientRect();
  if(b.bottom>a.bottom)tw.scrollTop+=Math.min(b.bottom-a.bottom+8,b.top-a.top-60);
}
function popHtml(r){
  const p=S.pop;const hits=ruleHits(p.k,p.dir);
  return `<tr class="poprow"><td colspan="9"><form class="ruleform pop" id="popForm">
    <div class="pophead"><b>Bu satırdan kural oluştur</b><span class="note">${esc(String(r.desc).slice(0,90))}</span></div>
    <div class="popgrid">
      <div><label class="lbl" for="pK">Açıklamada geçen kelime / kod <span class="note">(| ya da · + hepsi)</span></label><input type="text" id="pK" value="${esc(p.k)}" autocomplete="off" placeholder="örn. MEHMET DEMİR | M.DEMİR · KİRA + OCAK"></div>
      <div><label class="lbl" for="pDir">Yön (borç / alacak)</label><select id="pDir">${dirOpts(p.dir)}</select></div>
      <div><label class="lbl" for="pAcc">Karşı hesap</label><input type="text" class="mono" list="accList" id="pAcc" value="${esc(p.acc)}" placeholder="120.01.001"><div class="note" id="pAccName">${esc(accName(p.acc)||'')}</div></div>
      <div style="grid-column:1/-1"><label class="lbl" for="pLd">Luca'da fişe yazılacak açıklama</label><input type="text" id="pLd" value="${esc(p.ld)}" placeholder="BANKA - açıklama"></div>
    </div>
    <div class="actions"><button class="btn primary" type="submit">Kuralı kaydet</button><button class="btn" type="button" data-popclose="1">Vazgeç</button><span class="note" id="pHit">${hits} hareket bu kelimeyi içeriyor</span></div>
  </form></td></tr>`;
}

function renderOut(){
  const o=S.out;const p=$('#outPanel');
  const act=S.rows.filter(r=>!r.skip&&inPeriod(r));const outside=S.rows.filter(r=>!r.skip&&!inPeriod(r)).length;
  const rg=dataRange();const pp=S.period||{};
  const noBank=S.files.filter(f=>f.rows.length&&!(accts()[f.bankIdx]||{}).code);
  const noAcc=act.filter(r=>!String(r.acc||'').trim());
  const notInMiz=S.miz?act.filter(r=>r.acc&&!S.miz.byCode.has(r.acc)):[];
  const uns=act.filter(r=>r.unsure);
  const checks=[
    noBank.length?['err',`${noBank.length} dosya için ${ML().acc} hesap kodu seçilmedi.`]:['ok',`${ML().Acc} hesapları seçili.`],
    noAcc.length?['err',`${noAcc.length} hareketin karşı hesabı boş (askı hesaplarını doldurun).`]:['ok','Tüm hareketlerin karşı hesabı var.'],
    uns.length?['warn',`${uns.length} hareketin giriş/çıkış yönü bakiyeden doğrulanamadı; ± ile kontrol edin.`]:null,
    notInMiz.length?['warn',`${notInMiz.length} hareketin karşı hesabı mizanda yok; Luca'da hesap açılmamışsa aktarım hata verir.`]:null,
    ...dovizKontrol(act)
  ].filter(Boolean);
  p.innerHTML=`
    ${rg?`<div class="outperiod ${periodOn()?'on':''}"><span class="lbl" style="margin:0">Aktarılacak dönem</span>
      <input type="date" id="oFrom" value="${esc(pp.from||'')}" min="${isoOf(rg[0])}" max="${isoOf(rg[1])}" aria-label="Aktarım başlangıç tarihi"><span class="muted">–</span>
      <input type="date" id="oTo" value="${esc(pp.to||'')}" min="${isoOf(rg[0])}" max="${isoOf(rg[1])}" aria-label="Aktarım bitiş tarihi">
      <span class="note">${periodOn()?`<b>${esc(periodText())}</b> · ${act.length} hareket aktarılacak${outside?`, ${outside} hareket dönem dışında kalacak`:''}`:`Boş bırakılırsa ekstrelerdeki tüm tarihler (${fmtD(rg[0])} – ${fmtD(rg[1])}) aktarılır.`}</span>
      ${periodOn()?'<button class="btn small ghost" id="oClear">Tüm dönem</button>':''}</div>`:''}
    <div class="outgrid">
      <div><label class="lbl" for="grp">Fiş gruplama</label><select id="grp"><option value="day"${S.group==='day'?' selected':''}>Her gün ayrı fiş</option><option value="txn"${S.group==='txn'?' selected':''}>Her hareket ayrı fiş</option><option value="month"${S.group==='month'?' selected':''}>Ay sonuna tek fiş</option></select></div>
      <div><label class="lbl" for="startNo">İlk fiş no</label><input type="number" id="startNo" min="1" value="${S.startNo}"></div>
      <div><label class="lbl" for="belgeTuru">Belge türü</label><div style="display:flex;gap:8px;align-items:center"><input type="text" id="belgeTuru" value="${esc(S.belgeTuru)}" style="max-width:90px" class="mono"><span class="note">${esc(S.belgeTuru==='BE'?'Banka Ekstresi':S.belgeTuru?'Luca belge türü kodu':'boş bırakılacak')}</span></div></div>
      <div style="grid-column:1/-1;min-width:0"><label class="lbl" for="fisDesc">Fiş açıklaması</label><input type="text" id="fisDesc" value="${esc(S.fisDesc)}"><span class="note">${isCard()?'{BANKA} = kart adı':'{BANKA}'} ve {TARIH} yer tutucu</span></div>
    </div>
    <div>
      <label class="lbl">Sütunlar ${o.custom?'(yüklenen şablondan)':'(Luca fiş aktarım şablonu)'}</label>
      <div class="cols">${o.headers.map(h=>`<span class="col ${fieldOf(h)?'':'unk'}" title="${fieldOf(h)?'doldurulur':'boş bırakılır'}">${esc(h)}</span>`).join('')}</div>
      <div class="actions" style="margin-top:8px"><button class="btn small" id="tplBtn">Luca şablonunu yükle</button><input type="file" id="tplIn" accept=".xlsx,.xls" hidden>${o.custom?'<button class="btn small ghost" id="tplReset">Varsayılana dön</button>':''}<span class="note">Sütunlar Luca fiş aktarım şablonuna göre hazır. Luca şablonu değişirse yenisini yükleyin.</span></div>
    </div>
    <div class="checks">${checks.map(([c,t])=>`<div class="${c==='ok'?'ok':c==='err'?'err':''}">${c==='ok'?'✓':c==='err'?'✕':'!'} ${esc(t)}</div>`).join('')}</div>
    ${dovizKodHtml()}
    <div class="actions"><button class="btn primary" id="buildBtn" ${(!act.length||noBank.length||noAcc.length)?'disabled':''}>Luca Excel'ini oluştur</button>${Desk.aktarButtons(act.length&&!noBank.length&&!noAcc.length)}<span class="note">${act.length} hareket → ${act.length*2} fiş satırı. Luca tek seferde 50 fiş, mahsup fişinde 400 satır alır; dosya buna göre bölünür.</span></div>
    ${S.exportParts?`<div class="result"><div><b>${S.exportParts.fisCount} fiş, ${S.exportParts.lineCount} satır</b> · Borç ${fmt(S.exportParts.b)} = Alacak ${fmt(S.exportParts.c)} ${Math.abs(S.exportParts.b-S.exportParts.c)<0.005?'<span class="ok">✓</span>':'<span class="err">✕</span>'}</div><div class="actions">${S.exportParts.parts.map((pt,i)=>`<button class="btn" data-save="${i}">İndir: ${esc(pt.name)}</button>`).join('')}</div></div>`:''}`;
}

/* ---------- dosya okuma ---------- */
async function addFiles(list){
  if(!window.XLSX){toast('Excel okuyucu yüklenemedi; sayfayı yenileyin.');return;}
  S.files=S.files.filter(f=>!f.sample);
  S.cardParse=isCard();
  try{for(const file of list){
    const f={id:uid(),name:file.name,kind:'',bank:'',bankIdx:-1,rows:[]};
    try{
      if(/\.pdf$/i.test(file.name)){
        f.kind='PDF';const lines=await readPdfLines(file);
        const text=lines.map(l=>l.t).join('\n');
        const fa=lines.findIndex(isAnchor);f.ids=extractIds(lines.slice(0,fa>0?fa:15).map(l=>l.t).join(' '));
        f.pbDosya=pbDosyadan(lines.slice(0,fa>0?fa:15).map(l=>l.t).join(' '),file.name,lines.slice(fa>0?fa:15,(fa>0?fa:15)+40).map(l=>l.t).join(' '));
        f.bank=bankaTahmin(file.name,lines.slice(0,fa>0?fa:15).map(l=>l.t).join(' '),text);
        if(text.replace(/\s/g,'').length<40)throw new Error('PDF metin içermiyor (taranmış görüntü). Bankadan Excel ya da metinli PDF isteyin.');
        const rs1=parsePdfStructured(lines),rs2=parsePdfLines(lines);
        const good=rs=>rs.length-rs.filter(r=>r.unsure).length*0.5;
        f.rows=good(rs1)>=good(rs2)&&rs1.length?rs1:rs2;
        if(S.cardParse){const rk=parseCardPdf(lines);if(rk.length&&rk.length>=f.rows.length){f.rows=rk;f.cardFinal=true;}}
        if(!f.rows.length)throw new Error('PDF içinde tarih + tutar içeren hareket satırı bulunamadı.');
      }else{
        f.kind=/\.csv|\.txt$/i.test(file.name)?'CSV':'Excel';
        const wb=await readWorkbook(file);const t=locateTable(wb);
        if(t)f.ids=extractIds(t.rows.slice(0,t.hIdx).map(r=>r.join(' ')).join(' ')+' '+file.name);
        f.pbDosya=pbDosyadan(t?t.rows.slice(0,t.hIdx).map(r=>r.join(' ')).join(' '):'',file.name,t?t.rows.slice(t.hIdx,t.hIdx+40).map(r=>r.join(' ')).join(' '):'');
        const allText=wb.SheetNames.slice(0,2).map(n=>sheetRows(wb.Sheets[n]).slice(0,30).map(r=>r.join(' ')).join(' ')).join(' ');
        f.bank=bankaTahmin(file.name,t?t.rows.slice(0,t.hIdx).map(r=>r.join(' ')).join(' '):allText,allText);
        if(!t)throw new Error('Başlık satırı (Tarih, Açıklama, Tutar/Borç/Alacak) bulunamadı.');
        f.table={rows:t.rows,hIdx:t.hIdx,sheet:t.sheet,headers:t.rows[t.hIdx].map(x=>String(x??'').trim())};
        f.map=alignMap(f.table,autoMap(f.table.headers));
        f.rows=parseExcelTable(f.table,f.map);
        if(!f.rows.length)throw new Error('Başlık bulundu ama hareket satırı okunamadı; sütun eşleştirmesini kontrol edin.');
      }
      if(S.cardParse){cardSigns(f);if(!f.rows.length)throw new Error('Kart ekstresinde harcama/ödeme satırı bulunamadı.');}
    }catch(e){f.error=e.message||String(e);}
    bankaEsle(f);
    S.files.push(f);
  }}finally{S.cardParse=false;}
  S.exportParts=null;rebuildRows();renderAll();
  // mizan yoksa Luca'dan kendiliğinden çekilir; gelince karşı hesaplar yeniden bulunur
  if(S.firm&&!isExample()&&S.firm.lucaId&&!S.firm.mizanInfo&&S.files.some(f=>f.rows.length)){const d=(S.files.find(f=>f.rows.length).rows[0]||{}).date;
    const yen=()=>{bankaEsleHepsi();rebuildRows();renderAll();};if(await mizanOtoCek(S.firm,d?d.getFullYear():null,yen))yen();}
}
function autoBanks(f,acc,miz){if(!(f.banks||[]).length||!(f.banks||[]).some(b=>b.code)){f.banks=acc.filter(([c])=>/^102/.test(c)&&miz.leaf.has(c)).map(([c,n])=>({label:n||c,code:c}));}}
async function loadMizan(file){
  try{
    const wb=await readWorkbook(file);let acc=[];
    for(const n of wb.SheetNames){const a=parseMizan(sheetRows(wb.Sheets[n]));if(a.length>acc.length)acc=a;}
    if(acc.length<3)throw new Error('Dosyada hesap kodu (örn. 120.01.001) ve hesap adı bulunamadı.');
    S.miz=mizanIndex(acc);
    const f=S.firm;
    autoBanks(f,acc,S.miz);
    if(isExample()){f.mizanInfo={count:acc.length,file:file.name,at:new Date().toISOString()};toast(`${S.miz.leaf.size} alt hesap okundu (örnek firmada kaydedilmez).`);}
    else{const parts=await Store.saveMizan(f.id,acc);f.mizanInfo={count:acc.length,file:file.name,at:new Date().toISOString(),parts};await Store.saveFirm(f);toast(`Mizan kaydedildi: ${S.miz.leaf.size} alt hesap.`);}
    S.files.forEach(x=>{if(x.bankIdx<0||!(x.esle&&x.esle.elle))bankaEsle(x);});
    renderDatalist();reassign();renderAll();
  }catch(e){toast('Mizan okunamadı: '+(e.message||e));}
}
async function loadTemplate(file){
  try{
    const wb=await readWorkbook(file);const ws=wb.Sheets[wb.SheetNames[0]];const rows=sheetRows(ws);
    const h=(rows.find(r=>r.some(c=>String(c).trim()))||[]).map(c=>String(c).trim());
    while(h.length&&!h[h.length-1])h.pop();
    if(!h.length||!h.some(fieldOf))throw new Error('İlk satırda Hesap Kodu / Borç / Alacak gibi başlıklar yok.');
    S.out={headers:h,sheet:wb.SheetNames[0],custom:true};S.exportParts=null;
    await Store.saveOutput(S.out);renderOut();toast('Şablon sütunları kaydedildi.');
  }catch(e){toast('Şablon okunamadı: '+(e.message||e));}
}

/* ---------- Luca dosyası ---------- */
function buildLuca(){
  const banks=accts();const act=S.rows.filter(r=>!r.skip&&inPeriod(r));
  const groups=new Map();
  for(const r of act){const f=S.files.find(x=>x.id===r.fileId);const k=f.id+'|'+(S.group==='day'?fmtD(r.date):S.group==='month'?r.date.getFullYear()+'-'+r.date.getMonth():r.id);if(!groups.has(k))groups.set(k,{file:f,rows:[]});groups.get(k).rows.push(r);}
  const list=[...groups.values()].sort((a,b)=>a.rows[0].date-b.rows[0].date);
  const fisler=[];for(const g of list)for(let i=0;i<g.rows.length;i+=200)fisler.push({file:g.file,rows:g.rows.slice(i,i+200)});
  let no=+S.startNo||1;const lines=[];
  for(const f of fisler){
    f.no=no++;const bank=banks[f.file.bankIdx]||{};
    const fDate=S.group==='month'?f.rows[f.rows.length-1].date:f.rows[0].date;
    const fdesc=S.fisDesc.replace(/\{BANKA\}/g,(fileBankName(f.file)||bank.label||'BANKA').toLocaleUpperCase('tr-TR')).replace(/\{TARIH\}/g,fmtD(fDate));
    const pb=filePB(f.file);
    for(const r of f.rows){
      const fx=Math.abs(r2(r.amt));const inc=r.amt>0;
      const base={fis:f.no,date:fDate,fdesc,doc:r.doc||'',docDate:r.date,desc:lucaDesc(r).slice(0,250)};
      const vt=virmanTL(r);
      if(vt&&!vt.kurYok){   // döviz bozumu / arbitraj: iki satır aynı TL tutarı, her biri kendi döviz tutarı ve (TL / döviz) kuruyla
        const a=vt.tl;
        lines.push({...base,acc:bank.code,b:inc?a:0,c:inc?0:a,fis_:f,...vt.r});
        lines.push({...base,acc:String(r.acc).trim(),b:inc?0:a,c:inc?a:0,fis_:f,...vt.p});
        continue;
      }
      if(pb!=='TRY'){
        // dövizli hesap: tutar döviz; TL = döviz × kur (önceki iş günü TCMB döviz alış). Karşı hesap da aynı dövizdeyse döviz bilgisi ona da yazılır.
        const k=S.kur&&S.kur[kurAnahtar(pb,r.date)];const kur=k&&k.kur;const a=kur?r2(fx*kur):fx;
        const dv={pb,kur:kur||null,dvz:fx,kurYok:!kur};const acc=String(r.acc).trim();
        lines.push({...base,acc:bank.code,b:inc?a:0,c:inc?0:a,fis_:f,...dv});
        lines.push({...base,acc,b:inc?0:a,c:inc?a:0,fis_:f,...(hesapPB(acc)===pb?dv:{kurYok:!kur})});
        continue;
      }
      const a=fx;
      lines.push({...base,acc:bank.code,b:inc?a:0,c:inc?0:a,fis_:f});
      lines.push({...base,acc:String(r.acc).trim(),b:inc?0:a,c:inc?a:0,fis_:f});
    }
  }
  return {fisler,lines};
}
function toAoa(lines,headers){
  const F=headers.map(fieldOf);const aoa=[headers.slice()];
  const ser=d=>d?(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())-Date.UTC(1899,11,30))/86400000:'';
  for(const L of lines){const v={fisNo:String(L.fis),fisTarihi:ser(L.date),fisAciklama:L.fdesc,hesapKodu:L.acc,evrakNo:L.doc,evrakTarihi:ser(L.docDate),aciklama:L.desc,borc:L.b,alacak:L.c,belgeTuru:L.bt!=null?L.bt:(S.belgeTuru||''),
    paraBirimi:L.pb&&L.kur?L.pb:'',kur:L.pb&&L.kur?L.kur:'',dovizTutar:L.pb&&L.kur?L.dvz:''};aoa.push(F.map(f=>f?v[f]:''));}
  return aoa;
}
function makeWorkbook(lines){
  const aoa=toAoa(lines,S.out.headers);
  const ws=XLSX.utils.aoa_to_sheet(aoa);
  const F=S.out.headers.map(fieldOf);
  for(let r=1;r<aoa.length;r++)F.forEach((f,c)=>{const cell=ws[XLSX.utils.encode_cell({r,c})];if(!cell)return;if(f==='borc'||f==='alacak'||f==='dovizTutar')cell.z='#,##0.00';if(f==='kur')cell.z='#,##0.0000';if(f==='fisTarihi'||f==='evrakTarihi')cell.z='dd/mm/yyyy';if(f==='fisNo'||f==='hesapKodu'||f==='evrakNo'){cell.t='s';cell.v=String(cell.v);cell.z='@';}});
  ws['!cols']=S.out.headers.map(h=>({wch:Math.max(10,Math.min(48,/ACIKLAMA/.test(N(h))?40:h.length+4))}));
  const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,(S.out.sheet||DEFAULT_SHEET).slice(0,31));
  return XLSX.write(wb,{type:'array',bookType:'xlsx'});
}
function prepareExport(){
  const {fisler,lines}=buildLuca();
  const slug=N(S.firm.name).toLowerCase().replace(/ /g,'-').slice(0,30)||'firma';
  const parts=[];
  for(let i=0;i<fisler.length;i+=50){const set=new Set(fisler.slice(i,i+50));const ls=lines.filter(l=>set.has(l.fis_));const first=fisler[i].rows[0].date;const last=fisler[Math.min(i+50,fisler.length)-1].rows.slice(-1)[0].date;
    parts.push({name:`${slug}_luca-${isCard()?'kk-':''}fis_${fmtD(first).replace(/\./g,'')}-${fmtD(last).replace(/\./g,'')}${fisler.length>50?'_'+(parts.length+1):''}.xlsx`,lines:ls});}
  S.exportParts={parts,fisCount:fisler.length,lineCount:lines.length,b:r2(lines.reduce((s,l)=>s+l.b,0)),c:r2(lines.reduce((s,l)=>s+l.c,0))};
  renderOut();
  if(parts.length===1)saveFile(parts[0]);
}
async function saveFile(part){
  const buf=makeWorkbook(part.lines);
  {const y=[...new Set(part.lines.map(l=>l.acc).filter(k=>taslakMi(k)))];if(y.length)setTimeout(()=>toast(`Dosyada ${y.length} yeni cari kodu var (${y.slice(0,4).join(', ')}${y.length>4?'…':''}); Luca'ya içe aktarmadan önce bu hesapları hesap planına açın — "Luca'ya aktar" bunu kendisi yapar.`),400);}
  if(S.dl){try{await S.dl.save({filename:part.name,data:new Blob([buf])});toast('Kaydedildi: '+part.name);}catch(e){toast(e&&e.code==='declined'?'İndirme iptal edildi.':'İndirilemedi: '+(e&&e.message||e));}return;}
  try{const url=URL.createObjectURL(new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));const a=document.createElement('a');a.href=url;a.download=part.name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),4000);}
  catch(e){toast('Bu görünümde dosya indirme kullanılamıyor.');}
}

/* ---------- olaylar ---------- */
const drop=$('#drop'),fileIn=$('#fileIn');
drop.addEventListener('click',()=>fileIn.click());
drop.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();fileIn.click();}});
drop.addEventListener('dragover',e=>{e.preventDefault();drop.classList.add('over');});
drop.addEventListener('dragleave',()=>drop.classList.remove('over'));
drop.addEventListener('drop',e=>{e.preventDefault();drop.classList.remove('over');if(e.dataTransfer.files.length)addFiles([...e.dataTransfer.files]);});
fileIn.addEventListener('change',()=>{if(fileIn.files.length)addFiles([...fileIn.files]);fileIn.value='';});

$('#firmSel').addEventListener('change',e=>selectFirm(e.target.value));
$('#modeTabs').addEventListener('click',e=>{const b=e.target.closest('[data-mode]');if(b)switchMode(b.dataset.mode);});
$('#modeTabs').addEventListener('keydown',e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();switchMode(isCard()?'bank':'card');const b=$('#modeTabs [aria-selected=true]');if(b)b.focus();}});
$('#cardsBox').addEventListener('change',e=>{const t=e.target;if(t.dataset.card==null)return;const c=(S.firm.cards||[])[+t.dataset.card];if(!c)return;c[t.dataset.f]=t.value.trim();saveCards(false);});
$('#cardsBox').addEventListener('click',e=>{const t=e.target.closest('button');if(!t)return;
  if(t.id==='addCard'){S.firm.cards=[...(S.firm.cards||[]),{label:'',code:''}];S.files.forEach(f=>{if(f.bankIdx<0)f.bankIdx=0;});saveCards(true);const ins=$('#cardsBox').querySelectorAll('[data-f="label"]');if(ins.length)ins[ins.length-1].focus();}
  else if(t.dataset.delcard!=null){const i=+t.dataset.delcard;S.firm.cards.splice(i,1);const n=S.firm.cards.length;S.files.forEach(f=>{if(f.bankIdx===i)f.bankIdx=n?0:-1;else if(f.bankIdx>i)f.bankIdx--;});saveCards(true);}
});
// Yeni firma: Ayarlar › Firmalar'daki düğme ve komut paleti (üst şeritte değil)
document.addEventListener('click',e=>{if(e.target.closest('[data-yenifirma]'))yeniFirma();});
async function yeniFirma(){
  // yeni firma "Kaydet"e basılınca kaydedilir; pencere kaydetmeden kapatılırsa eklenmez
  const id=uid();const f={id,name:'Yeni firma '+(S.firms.length+1),banks:[],askiIn:'',askiOut:'',createdAt:new Date().toISOString()};
  S.oncekiFirm=S.firmId;S.firms.push(f);S.firmId=id;S.firm={...f};S.taslakId=id;
  await selectFirm(id);S.firmKirli=true;openModal('firm');setTimeout(()=>{const i=$('#fName');if(i){i.focus();i.select();}},50);
}

const side=$('#side');
side.addEventListener('change',e=>{
  const t=e.target;
  if(t.id==='fName'){S.firm.name=t.value.trim()||S.firm.name;saveFirmSoon();renderFirmSel();}
  else if(t.dataset.bank!=null){const b=S.firm.banks[+t.dataset.bank];b[t.dataset.f]=t.value.trim();saveFirmSoon();}
  else if(t.id==='askiIn'||t.id==='askiOut'){S.firm[t.id]=t.value.trim();saveFirmSoon();}
  else if(t.id==='mizIn'&&t.files.length){loadMizan(t.files[0]);t.value='';}
});
side.addEventListener('input',e=>{if(e.target.id==='ruleQ'){S.ruleQ=e.target.value;const pos=e.target.selectionStart;renderSide();const q=$('#ruleQ');if(q){q.focus();q.setSelectionRange(pos,pos);}}});
side.addEventListener('click',async e=>{
  const t=e.target.closest('button');if(!t)return;
  if(t.id==='firmKaydet'){await firmaKaydet();return;}
  if(t.id==='firmVazgec'){if(S.firmKirli||S.taslakId){await firmaVazgec();}closeModal(true);return;}
  if(t.id==='mizBtn')$('#mizIn').click();
  else if(t.id==='addBank'){S.firm.banks=[...(S.firm.banks||[]),{label:'',code:''}];if(isExample())renderSide();else saveFirmSoon();}
  else if(t.dataset.delbank!=null){S.firm.banks.splice(+t.dataset.delbank,1);if(!isCard())S.files.forEach(f=>{if(f.bankIdx>=S.firm.banks.length)f.bankIdx=S.firm.banks.length?0:-1;});saveFirmSoon();}
  else if(t.id==='ruleEditVaz'){S.draftRule=null;S.rulesTab='list';renderSide();}
  else if(t.id==='rEkle'||t.dataset.rekdel!=null){const d=kuralTaslak();if(t.id==='rEkle')d.ek.push('');else d.ek.splice(+t.dataset.rekdel,1);S.draftRule=d;renderSide();
    setTimeout(()=>{const i=t.id==='rEkle'?$('#rEk'+(d.ek.length-1)):$('#rK');if(i)i.focus();},30);}
  else if(t.dataset.edrule){const r=S.rules.find(x=>x.id===t.dataset.edrule);if(!r)return;S.draftRule={k:r.k,ek:Array.isArray(r.ek)?r.ek.slice():[],dir:r.dir||'all',acc:r.acc||'',ld:r.ld||'',eylem:r.eylem||'',editId:r.id};S.rulesTab='add';renderSide();setTimeout(()=>{const i=$('#rK');if(i)i.focus();},30);}
  else if(t.dataset.delrule){const id=t.dataset.delrule;if(isExample()){S.allRules=S.allRules.filter(r=>r.id!==id);S.rules=modeRules();reassign();renderAll();}else Store.delRule(S.firmId,id).catch(er=>toast('Silinemedi: '+er.message));}
  else if(t.id==='stdRules'){
    const leafs=S.miz?[...S.miz.leaf]:[];
    for(const s of (isCard()?STANDARD_KK:STANDARD)){const acc=leafs.find(c=>c.startsWith(s.pre))||s.pre;const r={id:uid(),k:s.k,dir:s.dir,acc,note:s.note,createdAt:new Date().toISOString(),...(isCard()?{kind:'card'}:{})};if(isExample()){S.allRules.push(r);S.rules=modeRules();}else await Store.addRule(S.firmId,r);}
    if(isExample()){reassign();renderAll();}toast('Standart kurallar eklendi; hesap kodlarını kontrol edin.');
  }
  else if(t.id==='delFirm'){
    S.confirmDel=false;const id=S.firmId;const ff=S.firms.find(x=>x.id===id);const o=ff&&await firmaSilSor([ff]);if(!o){renderSide();return;}
    await firmaSil(ff,o).catch(er=>toast('Silinemedi: '+er.message));
    S.firms=S.firms.filter(f=>f.id!==id);await selectFirm(S.firms[0]?S.firms[0].id:EXAMPLE_ID);toast('Firma silindi.');
  }
});
side.addEventListener('input',e=>{const t=e.target;
  if(t.id==='rAcc'&&/^335/.test(t.value.trim())){const l=$('#rLd');if(l&&(!l.value.trim()||l.dataset.oto==='1')){l.value='{BANKA} - MAAŞ ÖDEMESİ';l.dataset.oto='1';}}
  else if(t.id==='rAcc'){const l=$('#rLd');if(l&&l.dataset.oto==='1'){l.value='';l.dataset.oto='';}}
  else if(t.id==='rLd')t.dataset.oto='';});
// kural formundaki güncel değerler (yeniden çizimde kaybolmasın)
function kuralTaslak(){const v=id=>{const x=$('#'+id);return x?x.value:'';};
  return {k:v('rK'),ek:[...document.querySelectorAll('#ruleForm [data-rek]')].map(x=>x.value),dir:v('rDir')||'all',acc:v('rAcc'),ld:v('rLd'),eylem:v('rEylem'),editId:S.draftRule&&S.draftRule.editId};}
side.addEventListener('change',e=>{if(e.target.id!=='rEylem')return;const atla=e.target.value==='atla';document.querySelectorAll('#ruleForm .rkaydet').forEach(x=>x.hidden=atla);});
side.addEventListener('submit',async e=>{
  if(e.target.id!=='ruleForm')return;e.preventDefault();
  const k=$('#rK').value.trim(),dir=$('#rDir').value,ld=$('#rLd').value.trim(),eylem=$('#rEylem').value==='atla'?'atla':'';
  const acc=eylem?'':$('#rAcc').value.trim();
  const ek=[...document.querySelectorAll('#ruleForm [data-rek]')].map(x=>x.value.trim()).filter(x=>N(x));
  if(!N(k)){toast('Açıklamada aranacak kelimeyi yazın.');$('#rK').focus();return;}
  if(!acc&&!eylem){toast('Karşı hesap kodunu yazın.');$('#rAcc').focus();return;}
  const duz=S.draftRule&&S.draftRule.editId;S.draftRule=null;
  if(duz){const eski=S.rules.find(r=>r.id===duz)||{};const yeni={...eski,id:duz,k,ek,eylem,dir,acc,ld:eylem?'':(ld||''),updatedAt:new Date().toISOString()};
    if(isExample()){S.allRules=S.allRules.map(r=>r.id===duz?yeni:r);S.rules=modeRules();reassign();renderAll();}
    else{try{await Store.addRule(S.firmId,yeni);}catch(er){toast('Kural kaydedilemedi: '+er.message);return;}}
    S.rulesTab='list';renderSide();toast('Kural güncellendi.');return;}
  if(await saveRule(k,dir,acc,ld,{ek,eylem})){const i=$('#rK');if(i)i.focus({preventScroll:true});}
});
async function saveRule(k,dir,acc,ld,o){
  const ek=(o&&o.ek)||[],eylem=(o&&o.eylem)||'';
  const r={id:uid(),k,dir,acc,ld:eylem?'':(ld||''),...(ek.length?{ek}:{}),...(eylem?{eylem}:{}),createdAt:new Date().toISOString(),...(isCard()?{kind:'card'}:{})};
  S.rows.forEach(x=>{if(x.manual&&x.src==='elle'&&x.acc===acc)x.manual=false;});
  S.exportParts=null;
  if(isExample()){S.allRules.push(r);S.rules=modeRules();reassign();keepScroll(()=>{renderSide();renderTable();renderOut();});}
  else{try{await Store.addRule(S.firmId,r);}catch(er){toast('Kural kaydedilemedi: '+er.message);return false;}}
  const hit=S.rows.filter(x=>kurallimi(x)&&x.why===kuralMetni(r)).length;
  toast(`Kural eklendi · ${hit} hareket eşleşti${eylem?' (fişe alınmayacak)':''}.`);
  return true;
}

const tbody=$('#tbody');
tbody.addEventListener('change',e=>{
  const t=e.target;
  if(t.dataset.acc){const r=S.rows.find(x=>x.id===t.dataset.acc);r.acc=t.value.trim();r.manual=true;r.src='elle';r.why='';S.exportParts=null;keepScroll(()=>{renderTable();renderOut();});}
  else if(t.dataset.inc){const r=S.rows.find(x=>x.id===t.dataset.inc);r.skip=!t.checked;r.vSkipped=false;if(r.kSkip){r.kSkip=false;r.kSkipIptal=t.checked;}
    if(r.src==='virman'&&r.vPair){const pr=S.rows.find(x=>x.id===r.vPair);if(pr){if(t.checked){pr.skip=true;pr.vSkipped=true;r.vChosen=true;pr.vChosen=false;toast('Virmanın karşı kaydı fişten çıkarıldı.');}}}S.exportParts=null;keepScroll(()=>{renderTable();renderOut();});}
});
tbody.addEventListener('click',e=>{
  const t=e.target.closest('button');if(!t)return;
  if(t.dataset.tur){const r=S.rows.find(x=>x.id===t.dataset.tur);if(r)turSoyle(r);return;}
  if(t.dataset.flip){const r=S.rows.find(x=>x.id===t.dataset.flip);r.amt=-r.amt;r.unsure=false;if(r.kpay&&r.amt<0){r.kpay=false;r.skip=false;}if(!r.manual){eslesmeUygula(r,buildMatcher(S.firm,S.rules,S.miz)(r));}else if(r.src==='aski'){r.acc=r.amt>0?S.firm.askiIn:S.firm.askiOut;}S.exportParts=null;keepScroll(()=>{renderTable();renderOut();});}
  else if(t.dataset.mkrule){
    const r=S.rows.find(x=>x.id===t.dataset.mkrule);
    const sel=(pendingSel&&pendingSel.rowId===r.id&&Date.now()-pendingSel.at<60000)?pendingSel.text:'';pendingSel=null;
    if(S.pop&&S.pop.rowId===r.id&&!sel){S.pop=null;keepScroll(renderTable);return;}
    const k=sel||suggestKeyword(r.desc);
    S.pop={rowId:r.id,k,dir:r.amt>0?'in':'out',acc:r.src==='aski'?'':r.acc,ld:rowBank(r)+' - '+k,ldAuto:true};
    keepScroll(renderTable);revealPop();const i=$('#pK');if(i){i.focus({preventScroll:true});i.select();}
  }
  else if(t.dataset.novir){const r=S.rows.find(x=>x.id===t.dataset.novir);const p=S.rows.find(x=>x.id===r.vPair);[r,p].forEach(x=>{if(x){x.vNo=true;x.vChosen=false;}});refreshVirman();S.exportParts=null;keepScroll(()=>{renderTable();renderOut();});toast('Virman eşleşmesi kaldırıldı.');}
  else if(t.dataset.popclose){S.pop=null;keepScroll(renderTable);}
  else if(t.dataset.aski){
    const r=S.rows.find(x=>x.id===t.dataset.aski);
    if(r.manual&&r.src==='aski'){r.manual=false;eslesmeUygula(r,buildMatcher(S.firm,S.rules,S.miz)(r));}
    else{const acc=r.amt>0?S.firm.askiIn:S.firm.askiOut;if(!acc){toast('Önce firma ayarlarında askı hesaplarını girin.');return;}r.acc=acc;r.src='aski';r.why='';r.ld='';r.manual=true;}
    S.exportParts=null;keepScroll(()=>{renderTable();renderOut();});
  }
});
let pendingSel=null;
function descSelection(){
  const sel=window.getSelection();const text=String(sel||'').replace(/\s+/g,' ').trim();if(!text||!sel.anchorNode)return null;
  const el=sel.anchorNode.nodeType===1?sel.anchorNode:sel.anchorNode.parentElement;const td=el&&el.closest('td.desc');
  return td?{rowId:td.closest('tr').dataset.row,text:text.slice(0,120),at:Date.now()}:null;
}
tbody.addEventListener('pointerdown',e=>{if(e.target.closest('[data-mkrule]'))pendingSel=descSelection();});
tbody.addEventListener('input',e=>{
  if(!S.pop)return;const t=e.target;
  if(t.id==='pK')S.pop.k=t.value;else if(t.id==='pDir')S.pop.dir=t.value;else if(t.id==='pAcc'){S.pop.acc=t.value;const n=$('#pAccName');if(n)n.textContent=accName(t.value.trim())||'';}else if(t.id==='pLd'){S.pop.ld=t.value;S.pop.ldAuto=false;return;}else return;
  if(t.id==='pK'&&S.pop.ldAuto&&!S.pop.maas){const r=S.rows.find(x=>x.id===S.pop.rowId);S.pop.ld=rowBank(r)+' - '+t.value.trim();const l=$('#pLd');if(l)l.value=S.pop.ld;}
  // karşı hesap 335 (personele borçlar) → açıklama "BANKA - MAAŞ ÖDEMESİ"
  if(t.id==='pAcc'&&/^335/.test(S.pop.acc.trim())&&(S.pop.ldAuto||!String(S.pop.ld||'').trim())){const r=S.rows.find(x=>x.id===S.pop.rowId);S.pop.ld=rowBank(r)+' - MAAŞ ÖDEMESİ';S.pop.maas=true;const l=$('#pLd');if(l)l.value=S.pop.ld;}
  else if(t.id==='pAcc'&&S.pop.maas&&!/^335/.test(S.pop.acc.trim())){S.pop.maas=false;const r=S.rows.find(x=>x.id===S.pop.rowId);S.pop.ld=rowBank(r)+' - '+S.pop.k.trim();const l=$('#pLd');if(l)l.value=S.pop.ld;}
  const h=$('#pHit');if(h)h.textContent=ruleHits(S.pop.k,S.pop.dir)+' hareket bu kelimeyi içeriyor';
});
tbody.addEventListener('keydown',e=>{if(e.key==='Escape'&&S.pop&&e.target.closest('#popForm')){S.pop=null;keepScroll(renderTable);}});
tbody.addEventListener('submit',async e=>{
  if(e.target.id!=='popForm')return;e.preventDefault();
  const p=S.pop;const k=p.k.trim(),acc=p.acc.trim();
  if(!N(k)){toast('Açıklamada aranacak kelimeyi yazın.');$('#pK').focus({preventScroll:true});return;}
  if(!acc){toast('Karşı hesap kodunu yazın.');$('#pAcc').focus({preventScroll:true});return;}
  const row=S.rows.find(x=>x.id===p.rowId);const bl=row?rowBank(row):'';let ld=String(p.ld||'').trim();
  if(bl&&ld.startsWith(bl+' - '))ld='{BANKA} - '+ld.slice(bl.length+3);else if(bl&&ld===bl)ld='{BANKA}';
  S.pop=null;
  if(!(await saveRule(k,p.dir,acc,ld))){S.pop=p;}
  keepScroll(renderTable);
});
document.querySelector('.tablewrap thead').addEventListener('click',e=>{
  const b=e.target.closest('.sorth');
  if(b){const k=b.dataset.sort;const first=(k==='in'||k==='out')?'desc':'asc';
    if(S.sort&&S.sort.key===k){S.sort.dir=S.sort.dir==='asc'?'desc':'asc';}else S.sort={key:k,dir:first};
    keepScroll(renderTable);return;}
  if(e.target.closest('#cfClear')){S.ayF=[];S.cf={};document.querySelectorAll('.frow [data-cf]').forEach(el=>el.value='');S.sort=null;keepScroll(renderTable);}
});
let cfT;
$('#ayBar').addEventListener('click',e=>{const b=e.target.closest('[data-ay]');if(!b)return;const k=b.dataset.ay;
  if(!k)S.ayF=[];else if(e.ctrlKey||e.metaKey){S.ayF=(S.ayF||[]).includes(k)?S.ayF.filter(x=>x!==k):[...(S.ayF||[]),k];}
  else S.ayF=(S.ayF||[]).length===1&&S.ayF[0]===k?[]:[k];keepScroll(renderTable);});
document.querySelector('.tablewrap thead').addEventListener('input',e=>{const el=e.target.closest('[data-cf]');if(!el)return;S.cf=S.cf||{};S.cf[el.dataset.cf]=el.value;clearTimeout(cfT);cfT=setTimeout(()=>keepScroll(renderTable),150);});
$('#tabs').addEventListener('click',e=>{if(e.target.closest('#clearAll'))clearAllStatements();});
$('#periodbar').addEventListener('change',e=>{if(e.target.id==='pFrom')setPeriod({from:e.target.value});else if(e.target.id==='pTo')setPeriod({to:e.target.value});});
$('#periodbar').addEventListener('click',e=>{
  const m=e.target.closest('[data-month]');
  if(m){const cur=(S.period&&S.period.months)||[];const k=m.dataset.month;setPeriod({months:cur.includes(k)?cur.filter(x=>x!==k):[...cur,k].sort()});return;}
  if(e.target.closest('#pClear'))setPeriod({from:'',to:'',months:[]});
});
$('#tabs').addEventListener('change',e=>{if(e.target.id==='bankFilter'){S.bankFilter=e.target.value;renderTable();}});
$('#tabs').addEventListener('click',async e=>{
  if(e.target.closest('#kuralUygula')){
    const match=buildMatcher(S.firm,S.rules,S.miz);const elle=S.rows.filter(r=>r.manual&&match(r).src==='kural');
    let hepsi=false;if(elle.length)hepsi=await askConfirm('Kurallar uygulanacak',`Elle değiştirdiğiniz ${elle.length} satır da bir kurala uyuyor. Bu satırlara da kural uygulansın mı?\n\n“Hayır” derseniz yalnız elle değiştirilmemiş satırlar yenilenir.`,'Evet, hepsine uygula');
    if(hepsi)for(const r of elle)r.manual=false;
    const once=S.rows.filter(r=>r.src==='kural').length;reassign();keepScroll(()=>{renderSide();renderTable();renderOut();});
    toast(`Kurallar uygulandı: ${S.rows.filter(r=>r.src==='kural').length} satır kurallı${S.rows.filter(r=>r.src==='kural').length!==once?' (önce '+once+')':''}.`);return;}
  const t=e.target.closest('[data-tab]');if(!t)return;S.filter=t.dataset.tab;S.efTut=new Set();renderTable();});
// Boş / Dolu sekmesinde üzerinde çalışılan satır (tıklanan / düzenlenen) hemen öteki sekmeye geçmez; sekme yeniden seçilince yerine geçer
for(const ev of ['click','change','input','focusin'])document.addEventListener(ev,e=>{if(S.filter!=='bos'&&S.filter!=='dolu')return;
  const tr=e.target.closest&&e.target.closest('tr[data-row]');if(tr){(S.efTut=S.efTut||new Set()).add(tr.dataset.row);}},true);

document.addEventListener('change',e=>{const t=e.target;if(!t.dataset||!t.dataset.lucadvz)return;
  S.out.lucaDoviz={...(S.out.lucaDoviz||{}),[t.dataset.lucadvz]:t.value.trim()};Store.saveOutput(S.out).catch(()=>{});renderOut();});
async function dovizKodBul(sessiz){
  const api=window.__mwApi;if(!api||!api.luca||!api.luca.dovizKodlari){if(!sessiz)toast('Bu sürümde kullanılamıyor.');return 0;}
  try{const r=await api.luca.dovizKodlari();const bul=(r&&r.kodlar)||{};const n=Object.keys(bul).filter(k=>k!=='TRY').length;
    if(n){S.out.lucaDoviz={...(S.out.lucaDoviz||{}),...Object.fromEntries(Object.entries(bul).filter(([k])=>k!=='TRY'))};await Store.saveOutput(S.out);}
    if(!sessiz)toast(n?`Luca döviz kodları bulundu: ${Object.entries(bul).filter(([k])=>k!=='TRY').map(([k,v])=>k+'='+v).join(', ')}`:'Luca ekranlarında döviz listesi bulunamadı; kodları elle yazın ya da Excel ile aktarın.');
    renderOut();return n;}
  catch(e){if(!sessiz)toast(String(e&&e.message||e).replace(/^Error invoking remote method '[^']+': (Error: )?/,''));return 0;}
}
// banka adı kutusu: tıklanınca (değer doluyken de) tüm banka listesi açılır; seçilmeden çıkılırsa eski değer geri gelir
document.addEventListener('focusin',e=>{const t=e.target;if(!t.dataset||t.dataset.bankname==null)return;t.dataset.eski=t.value;t.placeholder=t.value||'Banka seçin';t.value='';try{t.showPicker();}catch(x){}});
document.addEventListener('mousedown',e=>{const t=e.target;if(!t.dataset||t.dataset.bankname==null||document.activeElement!==t)return;try{t.showPicker();}catch(x){}});
document.addEventListener('focusout',e=>{const t=e.target;if(!t.dataset||t.dataset.bankname==null)return;if(!t.value.trim()&&t.dataset.eski!=null){t.value=t.dataset.eski;}t.placeholder='Banka seçin';});
$('#files').addEventListener('change',e=>{
  const t=e.target;
  if(t.dataset.filepb){const f=S.files.find(x=>x.id===t.dataset.filepb);if(f){f.pb=t.value;f.pbElle=true;S.exportParts=null;renderFiles();renderTable();renderOut();}return;}
  if(t.dataset.filebank){const f=S.files.find(x=>x.id===t.dataset.filebank);f.bankIdx=+t.value;f.esle={puan:100,elle:true,neden:'elle seçildi'};refreshVirman();S.exportParts=null;renderFiles();renderTable();renderOut();}
  else if(t.dataset.bankname!=null){const f=S.files.find(x=>x.id===t.dataset.bankname);const v=t.value.trim();if(!v)return;   /* liste açılıp seçim yapılmadı */const known=BANKS.find(([k,n])=>N(n)===N(v)||k===N(v));f.bank=known?known[1]:v;if(f.bank)bankaEsle(f);refreshVirman();S.exportParts=null;renderFiles();renderTable();renderOut();}
  else if(t.dataset.map){const f=S.files.find(x=>x.id===t.dataset.file);const k=t.dataset.map,v=+t.value;
    if(k==='desc0'){f.map.desc=[v,...f.map.desc.filter(x=>x!==v)];}else f.map[k]=v;
    if(k==='amount'&&v>=0){f.map.out=-1;f.map.inn=-1;}if((k==='out'||k==='inn')&&v>=0)f.map.amount=-1;
    S.cardParse=isCard();try{f.rows=parseExcelTable(f.table,f.map);if(S.cardParse)cardSigns(f);}finally{S.cardParse=false;}f.error=f.rows.length?'':'Bu eşleştirmeyle hareket okunamadı.';
    S.exportParts=null;rebuildRows();renderFiles();renderTable();renderOut();}
});
$('#files').addEventListener('click',e=>{
  if(e.target.closest('#clearFiles')){clearAllStatements();return;}
  const t=e.target.closest('[data-delfile]');if(!t)return;S.files=S.files.filter(f=>f.id!==t.dataset.delfile);S.exportParts=null;rebuildRows();renderAll();});

const outP=$('#outPanel');
outP.addEventListener('change',e=>{
  const t=e.target;
  if(t.id==='grp'){S.group=t.value;S.exportParts=null;renderOut();}
  else if(t.id==='startNo'){S.startNo=Math.max(1,parseInt(t.value)||1);S.exportParts=null;}
  else if(t.id==='oFrom'){setPeriod({from:t.value});}
  else if(t.id==='oTo'){setPeriod({to:t.value});}
  else if(t.id==='belgeTuru'){S.belgeTuru=t.value.trim().toLocaleUpperCase('tr-TR');S.exportParts=null;lsSet('ekstre-luca-belge',S.belgeTuru);renderOut();}
  else if(t.id==='fisDesc'){S.fisDesc=t.value||ML().fis;S.exportParts=null;lsSet(ML().fisKey,S.fisDesc);}
  else if(t.id==='tplIn'&&t.files.length){loadTemplate(t.files[0]);t.value='';}
});
outP.addEventListener('click',async e=>{
  const t=e.target.closest('button');if(!t)return;
  if(t.id==='oClear'){setPeriod({from:'',to:'',months:[]});return;}
  if(t.id==='dvzBul'){dovizKodBul(false);return;}
  if(t.id==='buildBtn'){(async()=>{try{await kurHazirla();}catch(e){toast(String(e&&e.message||e).replace(/^Error invoking remote method '[^']+': (Error: )?/,''));return;}
    if(buildLuca().lines.some(l=>l.kurYok)){toast('Bazı dövizli hareketlerin kuru alınamadı; Excel oluşturulmadı.');return;}prepareExport();renderTable();})();}
  else if(t.dataset.save!=null)saveFile(S.exportParts.parts[+t.dataset.save]);
  else if(t.id==='tplBtn')$('#tplIn').click();
  else if(t.id==='tplReset'){S.out={headers:DEFAULT_HEADERS.slice(),sheet:DEFAULT_SHEET,custom:false};S.exportParts=null;await Store.saveOutput(S.out);renderOut();}
});

$('#bankNames').innerHTML=[...new Set(BANKS.map(b=>b[1]))].map(n=>`<option value="${esc(n)}">`).join('');
(function themeUI(){
  const btn=$('#themeBtn'),menu=$('#themeMenu');if(!btn)return;
  const draw=()=>{menu.innerHTML=SKINS.map(([id,n,d,c])=>`<button role="menuitemradio" aria-checked="${id===curSkin}" data-skin="${id}"><span class="sw">${c.map(x=>`<i style="background:${x}"></i>`).join('')}</span><span>${esc(n)}<span class="tdesc">${esc(d)}</span></span>${id===curSkin?'<span class="tick">✓</span>':''}</button>`).join('');};
  const close=()=>{menu.hidden=true;btn.setAttribute('aria-expanded','false');};
  btn.addEventListener('click',e=>{e.stopPropagation();if(menu.hidden){draw();menu.hidden=false;btn.setAttribute('aria-expanded','true');const c=menu.querySelector('[aria-checked=true]');if(c)c.focus();}else close();});
  menu.addEventListener('click',e=>{const b=e.target.closest('[data-skin]');if(!b)return;curSkin=b.dataset.skin;applySkin(curSkin);try{localStorage.setItem('ekstre-luca-skin',curSkin);}catch(_){}draw();close();toast('Tema: '+SKINS.find(s=>s[0]===curSkin)[1]);});
  document.addEventListener('click',e=>{if(!menu.hidden&&!e.target.closest('.themepick'))close();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!menu.hidden){close();btn.focus();}});
})();
/* ---------- masaüstü: lisans ve Luca bağlantısı ---------- */
const Desk=(()=>{
  // Luca oturumu düşünce (NO_SESSION) kullanıcıya sorup giriş penceresini açar, bağlanınca aynı isteği bir kez yineler.
  let lucaYenidenP=null;
  function lucaYenidenGiris(msg){
    if(lucaYenidenP)return lucaYenidenP;
    lucaYenidenP=(async()=>{try{
      const ok=await askConfirm('Luca oturumu düştü',(msg||'Luca oturumu kapanmış.')+' Luca penceresinde yeniden giriş yaparsanız yarım kalan işlem kendiliğinden devam eder.','Luca\'ya giriş yap');
      if(!ok)return false;await LucaBag.bekle();return true;}catch(e){toast(cleanErr(e));return false;}finally{lucaYenidenP=null;}})();
    return lucaYenidenP;}
  function lucaOturumSar(d){try{const L=d.luca;if(!L)return d;const sar={};
    for(const k of Object.keys(L)){const f=L[k];if(typeof f!=='function'||/^(open|status|logout|cred|kayit|on)/.test(k)){sar[k]=f;continue;}
      sar[k]=async(...a)=>{try{return await f(...a);}catch(e){const m=String(e&&e.message||e);if(!/oturumu kapanmış|oturumu açık değil|NO_SESSION/i.test(m))throw e;
        if(window.__mwArkaPlan>0)throw e;                       // arka plan yenilemeleri (kayıt sonrası mizan/plan) kullanıcıya sormaz
        if(!(await lucaYenidenGiris(m.replace(/^.*?Error: /,''))))throw e;return f(...a);}};}
    return Object.assign({},d,{luca:sar});}catch(e){return d;}}
  const api=lucaOturumSar(window.desktop);window.__mwApi=api;   // modüller aynı sarmalanmış api'yi kullanır (oturum yenileme tek yerde)
  let luca={loggedIn:false};let lic=null;let lucaFirms=null;let busy=false;
  const cleanErr=e=>String(e&&e.message||e).replace(/^Error invoking remote method '[^']+': (Error: )?/,'');
  const thisYear=new Date().getFullYear();
  const yearOpts=sel=>[thisYear,thisYear-1,thisYear-2].map(y=>`<option value="${y}"${+sel===y?' selected':''}>${y}</option>`).join('');

  function lucaLabel(){return luca.loggedIn?'Luca bağlı':'Luca\'ya bağlan';}
  function lucaClass(){return luca.loggedIn?'luca-on':'luca-off';}
  function markLucaBtn(){try{LucaBag.boya(luca);return;}catch(e){}document.querySelectorAll('[data-luca="connect"]').forEach(b=>{b.classList.toggle('luca-on',!!luca.loggedIn);b.classList.toggle('luca-off',!luca.loggedIn);});}
  // bağlantı açılınca, bağlantı bekleyen Luca penceresi (firma ekle / mizanları güncelle) kendiliğinden devam eder
  function lucaAyarla(d){if(d&&typeof d.loggedIn==='boolean'){const once=luca.loggedIn;luca=d;markLucaBtn();
    if(!once&&d.loggedIn&&!busy&&$('#lucaModal')&&!$('#lucaModal').hidden)render();}}
  async function refreshLuca(){
    try{luca=await api.luca.status();}catch(e){luca={loggedIn:false};}
    renderToolbar();markLucaBtn();
    return luca;
  }
  api.luca.on(()=>{refreshLuca().then(()=>{if(!$('#lucaModal').hidden&&mode==='connect')renderConnect();});});

  /* ---- lisans ---- */
  function licText(){
    if(!lic)return '';
    if(lic.type==='trial')return `Deneme sürümü · ${lic.daysLeft} gün kaldı`;
    if(lic.type==='pool')return `Lisanslı · bitiş ${(lic.expires||'').split('-').reverse().join('.')}${lic.daysLeft<=20?` (${lic.daysLeft} gün)`:''}`;
    if(lic.type==='key')return `Lisans: ${lic.name||''} · bitiş ${(lic.expires||'').split('-').reverse().join('.')}${lic.daysLeft<=20?` (${lic.daysLeft} gün)`:''}`;
    return '';
  }
  function renderLicenseFoot(){
    const tb=$('#toolbar');if(!tb||!lic||!lic.valid)return;
    const el=document.createElement('span');el.className='licfoot'+((lic.type==='trial'||lic.daysLeft<=20)?' warn':'');
    el.textContent=licText();
    tb.appendChild(el);
  }
  const MOD_NAMES={fatura:'Muhasebe İşlemleri',ekstre:'Banka İşlemleri',okc:'Belgeden Fiş',denetim:'Denetim ve Analiz',ozel:'Ofisinize Özel Çözümler',gecici:'Geçici Vergi İşlemleri',personel:'Personel'};
  async function tryActivate(input,onErr,want){
    let r;try{r=await api.license.activate(input);}catch(e){if(onErr)onErr(cleanErr(e));return false;}
    const got=r.activated_module||'ekstre';
    if(!r.valid&&!(r.activated_module&&r.module&&r.module.valid)){if(onErr)onErr(r.reason||'Kod kabul edilmedi.');return false;}
    try{lic=await api.license.status();}catch(e){}
    try{mods=await api.modules.list();}catch(e){}
    const m=(r.module)||{};
    toast(r.note||(`${MOD_NAMES[got]||got} lisansı etkinleştirildi`+(m.daysLeft?` · ${m.daysLeft} gün`:'')));
    renderToolbar();markLucaBtn();refreshLuca();if(!$('#regModal').hidden)renderReg();
    if(!$('#modGate').hidden)drawModules();

    return true;
  }
  /* ---- modül seçimi ---- */
  let mods=[];
  const MOD_INFO={
    ekstre:{d:'Banka ve kredi kartı ekstrelerini okur, karşı hesapları mizan ve kurallarla eşleştirip Luca\'ya fiş olarak aktarır.',i:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10l9-6 9 6M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 21h18"/></svg>'},
    fatura:{d:'Fatura – Muavin Kontrol: e-Fatura, e-Arşiv ve e-SMM belgelerini Luca\'dan indirip muavinle karşılaştırır; kayıtsız faturaları kurallarla Luca\'ya kaydeder; KDV2 raporu.',i:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2h9l5 5v15H6z"/><path d="M14 2v6h6"/><path d="M9 14l2 2 4-4"/></svg>'},
    gecici:{d:'Geçici vergi dönemi hesaplamaları ve beyanname hazırlığı.',i:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8M8 11h2M12 11h2M16 11h0M8 15h2M12 15h2M8 19h8"/></svg>'},
    okc:{d:'ÖKC (yazar kasa) fişlerini, Z raporlarını ve yurt dışı faturalarını (Meta, Google vb.; %15 stopaj ve sorumlu sıfatıyla KDV ile) okur, muhasebe fişine çevirip Luca\'ya işler.',i:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8M8 11h8M8 15h5"/></svg>'},
    ozel:{d:'Sadece sizin muhasebe ofisinize özel, sizin tarafınızdan talep edilmiş yazılımlar.',i:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="6" width="19" height="12" rx="2"/><path d="M6 10h7M6 14h4M16 13.5h2.5"/></svg>'},
    personel:{d:'İşe giriş – çıkış ve bordro işlemleri.',i:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5a6.5 6.5 0 0 1 3.5 5.5"/></svg>'},
    yonetim:{d:'Programa üye olanlar, fatura bilgileri, lisans ve deneme işlemleri, satış ve tahsilat, lisans kodları, duyuru.',i:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l8 3v6c0 4.5-3.4 8.2-8 9-4.6-.8-8-4.5-8-9V6z"/><path d="M9 12l2 2 4-4"/></svg>'},
    denetim:{d:'Ters bakiyeli hesaplar, banka bakiye mutabakatı (ekstre ↔ 102 muavini), günün iş özeti; cari mutabakat ve KDV iade listeleri geliştiriliyor.',i:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/></svg>'}
  };
  const trDate=x=>x?String(x).slice(0,10).split('-').reverse().join('.'):'';
  function modState(m){
    if(m.type==='free')return ['ok','Lisans gerekmez · herkese açık'];
    if(m.active===false||m.type==='soon')return ['soon','Yakında'];
    if(m.valid&&m.type==='pool')return ['ok','Lisanslı · bitiş '+trDate(m.expires)];
    if(m.valid)return ['trial','Deneme · '+m.daysLeft+' gün kaldı'];
    if(m.trialAvailable)return ['trial',(m.trial_days||7)+' gün ücretsiz deneyin'];
    if(m.type==='devices'||m.type==='disabled')return ['bad',m.reason||'Kullanılamıyor'];
    return ['bad',m.expired?'Lisans süresi doldu':'Deneme süresi doldu'];
  }
  function drawModules(){
    let liste=(mods.some(m=>m.id==='personel')?mods:[...mods,{id:'personel',name:'Personel',active:false,type:'soon'}]).filter(m=>m.type!=='gizli');
    {const m0=liste.find(m=>m.active!==false&&m.type!=='soon'&&m.type!=='free');const d=$('#modLisDurum');if(d){if(m0){const [c,t]=modState(m0);d.innerHTML=`<span class="ms ${c}">${esc(t)}</span>`;}else d.innerHTML='';}}
    $('#modGrid').innerHTML=liste.map(m=>{const inf=MOD_INFO[m.id]||{d:'',i:''};const [c,t]=modState(m);const soon=c==='soon';
      return `<button class="modcard${m.type==='free'?' free':''}" data-mod="${esc(m.id)}" ${soon?'disabled aria-disabled="true"':''}><span class="mi">${inf.i}</span><h2>${esc((m.id==='ozel'||m.id==='personel'||m.id==='oyun'||m.id==='okc'?MOD_NAMES[m.id]:'')||m.name||MOD_NAMES[m.id]||m.id)}</h2><p>${esc(inf.d)}</p>${c==='soon'?`<span class="ms ${c}">${esc(t)}</span>`:''}</button>`;}).join('')
      +(window.__admOk?`<button class="modcard admcard" data-mod="yonetim"><span class="mi">${MOD_INFO.yonetim.i}</span><h2>Yönetim</h2><p>${esc(MOD_INFO.yonetim.d)}</p><span class="ms ok">Yalnız program sahibi</span></button>`:'');
  }
  function moduleGate(){
    return new Promise(async resolve=>{
      try{mods=await api.modules.list();}catch(e){mods=[];}
      try{const a=await api.auth.status();let o=null;try{o=await api.office.get();}catch(x){}
        $('#modWho').textContent=(a&&a.email?a.email+' · ':'')+(o?o.name+' (Luca üye no '+o.luca_uye_no+') · ':'')+'Çalışmak istediğiniz modülü seçin.';}catch(e){}
      if(typeof ADM!=='undefined')ADM.hide();      // modül ekranına dönünce Yönetim kilitlenir (yeniden girişte şifre sorulur)
      try{window.__admOk=!!(await api.adminOk());}catch(e){window.__admOk=false;}
      window.__ozelListe=((mods||[]).find(m=>m.id==='ozel')||{}).ozel||[];
      drawModules();$('#modGate').hidden=false;document.documentElement.style.overflow='hidden';try{LucaBag.yenile();}catch(x){}
      if(typeof duyuruGoster==='function')duyuruGoster();
      $('#modLogout').onclick=()=>api.auth.logout();
      $('#modGrid').onclick=async e=>{
        const b=e.target.closest('[data-mod]');if(!b||b.disabled)return;
        const id=b.dataset.mod;
        $('#modGate').hidden=true;
        if(id==='yonetim'){if(await licenseGate('yonetim')){document.documentElement.style.overflow='';resolve(id);}else{toast('Yönetim yalnız program sahibi hesabıyla açılır.');$('#modGate').hidden=false;}return;}
        if(await licenseGate(id)){document.documentElement.style.overflow='';resolve(id);}
        else{try{mods=await api.modules.list();}catch(x){}drawModules();$('#modGate').hidden=false;}
      };
    });
  }
  function licenseGate(id){
    id=id||'ekstre';
    if(id==='yonetim')return (async()=>{try{lic=await api.license.status();}catch(e){}try{const x=!!(await api.adminOk());if(x){renderToolbar();refreshLuca();}return x;}catch(e){return false;}})();
    return new Promise(async resolve=>{
      let m;try{m=await api.modules.open(id);}catch(e){m={valid:false,reason:cleanErr(e)};}
      try{lic=await api.license.status();}catch(e){}
      if(id==='ozel')window.__ozelListe=m.ozel||[];
      if(m.type==='gizli'){toast(m.reason||'Bu bölüm ofisinize tanımlı değil.');resolve(false);return;}
      if(m.valid){$('#licGate').hidden=true;renderToolbar();refreshLuca();if(m.type==='trial'&&m.daysLeft>=(m.trial_days||7))toast(`${MOD_NAMES[id]||id}: ${m.daysLeft} günlük deneme süreniz başladı.`);resolve(true);return;}
      $('#licGate').hidden=false;$('#licErr').textContent='';$('#licKey').value='';
      $('#licTitle').textContent='MuhaWin lisansı';
      $('#licMsg').textContent=(m.reason||'Devam etmek için MuhaWin lisans kodunu girin.');
      $('#licBtn').onclick=async()=>{if(await tryActivate($('#licKey').value,x=>{$('#licErr').textContent=x;},id)){$('#licGate').hidden=true;resolve(true);}};
      $('#licBack').onclick=()=>{$('#licGate').hidden=true;resolve(false);};
      setTimeout(()=>$('#licKey').focus(),50);
    });
  }

  /* ---- Luca penceresi ---- */
  let mode='connect';
  const body=()=>$('#lucaBody');
  function openLuca(m){mode=m;$('#lucaModal').hidden=false;document.documentElement.style.overflow='hidden';
    $('#lucaTitle').textContent=m==='firms'?'Luca\'dan firma ekle':m==='mizan'?'Mizanları güncelle':'Luca bağlantısı';
    render();}
  function closeLuca(){if(busy){toast('İşlem bitene kadar bekleyin.');return;}$('#lucaModal').hidden=true;document.documentElement.style.overflow='';}
  async function render(){
    await refreshLuca();
    // Luca girişi tek yerden (üst şeritteki düğme): bu pencerede ayrı giriş düğmesi yok, üst şeritteki vurgulanır
    if(!luca.loggedIn){renderConnect();if(!luca.wrongUye)LucaBag.uyar('Luca bağlı değil. Üst şeritteki "Luca\'ya giriş" düğmesiyle bağlanın.');return;}
    if(mode==='firms')return renderFirms();
    if(mode==='mizan')return renderMizan();
    renderConnect();
  }
  function renderConnect(){
    body().innerHTML=(luca.wrongUye?`<div class="banner" style="background:var(--warn-bg);color:var(--warn)">${esc(luca.error||'')}</div>`:'')+(luca.loggedIn?`
      <div class="banner" style="background:var(--cari-bg);color:var(--cari-fg)">Luca oturumu açık. Firma listesini ve mizanları çekebilirsiniz.</div>
      <div class="actions"><button class="btn primary" data-lgo="firms">Luca'dan firma ekle</button><button class="btn" data-lgo="mizan">Mizanları güncelle</button><button class="btn ghost" data-lgo="show">Luca penceresini göster</button><button class="btn ghost danger" data-lgo="logout">Luca oturumunu kapat</button></div>`:`
      <div class="banner">Luca bağlı değil. Bağlanmak için üst şeritteki <b>Luca'ya giriş</b> düğmesini kullanın; bağlanınca bu pencere kendiliğinden devam eder.</div>
      <div class="actions"><button class="btn" data-lgo="check">Bağlantıyı kontrol et</button><span class="note">${luca.windows?'Luca penceresi açık, giriş bekleniyor…':'Luca penceresi kapalı.'}</span></div>`);
  }
  async function loadLucaFirms(force){
    if(lucaFirms&&!force)return lucaFirms;
    const list=await api.luca.firms();
    lucaFirms=list.map(x=>({id:String(x.value),name:String(x.label||'').trim()})).filter(x=>x.id).sort((a,b)=>a.name.localeCompare(b.name,'tr'));
    return lucaFirms;
  }
  const linked=()=>new Map(S.firms.filter(f=>f.lucaId).map(f=>[String(f.lucaId),f]));

  async function renderFirms(){
    body().innerHTML='<p class="muted">Luca firma listesi alınıyor…</p>';
    let list;try{list=await loadLucaFirms(true);}catch(e){body().innerHTML=`<p class="err">${esc(cleanErr(e))}</p><div class="actions"><button class="btn" data-lgo="connectview">Bağlantıya dön</button></div>`;return;}
    const have=linked();
    body().innerHTML=`
      <div class="actions"><input type="text" id="lfQ" placeholder="Firma ara" style="max-width:260px"><label class="note"><input type="checkbox" id="lfAll"> Görünenlerin hepsini seç</label><span class="note">${list.length} firma · ${have.size} tanesi programda</span></div>
      <div class="pick" id="lfList">${list.map(x=>{const h=have.get(x.id);return `<label class="${h?'done':''}" data-name="${esc(N(x.name))}"><input type="checkbox" value="${esc(x.id)}" ${h?'disabled checked':''}><span>${esc(x.name)}</span><span class="st" data-st="${esc(x.id)}">${h?'programda':''}</span></label>`;}).join('')}</div>
      <div class="actions"><label class="note"><input type="checkbox" id="lfMiz" checked> Eklenen firmaların mizanını da çek</label><label class="note">Dönem <select id="lfYear" style="width:auto">${yearOpts(thisYear)}</select></label></div>
      <div class="actions"><button class="btn primary" id="lfAdd">Seçilenleri ekle</button><span class="note" id="lfMsg"></span></div>`;
    $('#lfQ').oninput=e=>{const q=N(e.target.value);document.querySelectorAll('#lfList label').forEach(l=>l.hidden=!!q&&!l.dataset.name.includes(q));};
    $('#lfAll').onchange=e=>document.querySelectorAll('#lfList label:not([hidden]) input:not(:disabled)').forEach(c=>c.checked=e.target.checked);
    $('#lfAdd').onclick=addSelected;
  }
  async function addSelected(){
    const ids=[...document.querySelectorAll('#lfList input:checked:not(:disabled)')].map(c=>c.value);
    if(!ids.length){toast('Eklemek için firma seçin.');return;}
    busy=true;$('#lfAdd').disabled=true;
    const added=[];
    for(const id of ids){
      const lf=lucaFirms.find(x=>x.id===id);
      const f={id:uid(),name:lf.name,lucaId:id,banks:[],askiIn:'',askiOut:'',createdAt:new Date().toISOString()};
      await Store.saveFirm(f);added.push(f);
      const st=document.querySelector(`[data-st="${CSS.escape(id)}"]`);if(st){st.textContent='eklendi';st.className='st ok';}
      const cb=document.querySelector(`#lfList input[value="${CSS.escape(id)}"]`);if(cb)cb.disabled=true;
    }
    onFirms(Object.values(Store.local().firms));
    lastEmpty=new Set();
    if($('#lfMiz').checked){
      const year=+$('#lfYear').value;
      for(const f of added){
        const st=document.querySelector(`[data-st="${CSS.escape(f.lucaId)}"]`);
        if(st){st.textContent='mizan alınıyor…';st.className='st';}
        try{const n=await pullMizan(f,year);if(st){st.textContent=`eklendi · ${n} hesap`;st.className='st ok';}}
        catch(e){if(e.empty)lastEmpty.add(f.id);if(st){st.textContent='mizan gelmedi';st.className='st err';}}
      }
    }
    busy=false;$('#lfAdd').disabled=false;
    $('#lfMsg').textContent=`${added.length} firma eklendi.`;
    if(isExample()&&added[0])await selectFirm(added[0].id);
    renderAll();
    const empties=added.filter(f=>lastEmpty.has(f.id));
    if(empties.length)defterTespit(empties,year);
  }
  // Mizan gelmeyen firmalar: Luca'dan defter türü okunur (1. sınıf → bilanço; 2. sınıf → menüde "Ser.Mes.Defteri" varsa serbest meslek, yoksa işletme). Soru sorulmaz.
  async function defterTespit(firms,year){
    const say={isletme:0,serbest:0,bilanco:0,hata:0};
    await mwBusy.run('Defter türleri Luca\'dan okunuyor…',firms.length+' firma',async()=>{
      for(const f0 of firms){const f=S.firms.find(x=>x.id===f0.id)||f0;if(!f.lucaId)continue;
        try{const r=await api.luca.defterTuru({lucaId:f.lucaId,year:String(year||new Date().getFullYear())});
          if(r&&r.defter){say[r.defter]=(say[r.defter]||0)+1;const degisti=f.defter!==r.defter||f.defterOto||f.defterSinif!==(r.sinif||'');if(degisti){f.defter=r.defter;f.defterOto=true;f.defterSinif=r.sinif||'';f.defterZaman=new Date().toISOString().slice(0,10);await Store.saveFirm(f);defterBildir(f);}}}
        catch(e){say.hata++;}}});
    onFirms(Object.values(Store.local().firms));
    toast(`Defter türü: ${say.isletme} işletme, ${say.serbest} serbest meslek${say.bilanco?`, ${say.bilanco} bilanço`:''}${say.hata?` · ${say.hata} okunamadı`:''}. Ayarlar › Firmalar'dan değiştirebilirsiniz.`);
  }

  async function pullMizan(firm,year){
    const r=await api.luca.mizan({lucaId:firm.lucaId,year});
    const acc=r.rows.map(x=>[String(x[0]),String(x[1]||''),+x[3]||0,+x[4]||0]).filter(x=>x[0]);
    if(acc.length<3){
      const ff=S.firms.find(x=>x.id===firm.id)||firm;   // mizan gelmeyen firma işletme defteri sayılır (serbest meslek olanları kullanıcı değiştirir)
      if(ff.defter!=='serbest'&&ff.defter!=='isletme'){ff.defter='isletme';ff.defterOto=true;await Store.saveFirm(ff);defterBildir(ff);}
      const e=new Error('Mizan gelmedi (işletme defteri olabilir).');e.empty=true;throw e;}
    const miz=mizanIndex(acc);
    const f=S.firms.find(x=>x.id===firm.id)||firm;
    autoBanks(f,acc,miz);
    const parts=await Store.saveMizan(f.id,acc);
    f.mizanInfo={count:acc.length,file:`Luca ${r.year} dönemi`,at:new Date().toISOString(),parts,source:'luca',year:r.year};
    if(f.defter!=='bilanco'){f.defter='bilanco';f.defterOto=true;defterBildir(f);}
    await Store.saveFirm(f);
    if(S.firmId===f.id){S.firm={...f};S.miz=miz;renderDatalist();reassign();}
    return miz.leaf.size;
  }

  async function renderMizan(){
    let list=null,err='';
    try{list=await loadLucaFirms(false);}catch(e){err=cleanErr(e);}
    const firms=S.firms.slice();
    if(!firms.length){body().innerHTML=`<p class="muted">Programda henüz firma yok. Önce “Luca'dan firma ekle” ile firma ekleyin.</p><div class="actions"><button class="btn primary" data-lgo="firms">Luca'dan firma ekle</button></div>`;return;}
    const opts=list?list.map(x=>`<option value="${esc(x.id)}">${esc(x.name)}</option>`).join(''):'';
    body().innerHTML=`
      ${err?`<p class="err">${esc(err)}</p>`:''}
      <div class="actions"><label class="note"><input type="checkbox" id="lmAll"> Hepsini seç</label><label class="note">Dönem <select id="lmYear" style="width:auto">${yearOpts(thisYear)}</select></label></div>
      <div class="pick" id="lmList">${firms.map(f=>{const mi=f.mizanInfo;const info=mi?`${mi.source==='luca'?'Luca':'Excel'} · ${mi.at?new Date(mi.at).toLocaleDateString('tr-TR'):''}`:'mizan yok';
        return f.lucaId?`<label><input type="checkbox" value="${esc(f.id)}"><span>${esc(f.name)}</span><span class="st" data-ms="${esc(f.id)}">${esc(info)}</span></label>`
        :`<label class="done"><input type="checkbox" disabled><span>${esc(f.name)} <span class="note">· Luca firmasıyla eşleşmemiş</span>${list?`<select data-link="${esc(f.id)}" style="margin-top:4px"><option value="">Luca'daki karşılığını seçin…</option>${opts}</select>`:''}</span><span class="st">${esc(info)}</span></label>`;}).join('')}</div>
      <div class="actions"><button class="btn primary" id="lmGo">Seçilenlerin mizanını güncelle</button><span class="note" id="lmMsg">Mizan, seçilen dönemin tüm hesaplarıyla Luca'dan okunur; firmadaki eski mizanın yerine geçer.</span></div>`;
    $('#lmAll').onchange=e=>document.querySelectorAll('#lmList input:not(:disabled)').forEach(c=>c.checked=e.target.checked);
    document.querySelectorAll('[data-link]').forEach(sel=>sel.onchange=async()=>{
      if(!sel.value)return;const f=S.firms.find(x=>x.id===sel.dataset.link);f.lucaId=sel.value;await Store.saveFirm(f);onFirms(Object.values(Store.local().firms));toast(`${f.name} Luca firmasıyla eşleştirildi.`);renderMizan();
    });
    $('#lmGo').onclick=async()=>{
      const ids=[...document.querySelectorAll('#lmList input:checked:not(:disabled)')].map(c=>c.value);
      if(!ids.length){toast('Güncellenecek firmaları seçin.');return;}
      busy=true;$('#lmGo').disabled=true;const year=+$('#lmYear').value;let ok=0;lastEmpty=new Set();
      for(const id of ids){
        const f=S.firms.find(x=>x.id===id);const st=document.querySelector(`[data-ms="${CSS.escape(id)}"]`);
        if(st){st.textContent='alınıyor…';st.className='st';}
        try{const n=await pullMizan(f,year);ok++;if(st){st.textContent=`✓ ${n} hesap`;st.className='st ok';}}
        catch(e){if(e.empty)lastEmpty.add(f.id);if(st){st.textContent=cleanErr(e);st.className='st err';}}
      }
      const empties=ids.map(id=>S.firms.find(x=>x.id===id)).filter(f=>f&&lastEmpty.has(f.id));
      busy=false;$('#lmGo').disabled=false;$('#lmMsg').textContent=`${ok} / ${ids.length} firmanın mizanı güncellendi.`;
      onFirms(Object.values(Store.local().firms));renderAll();
      if(empties.length)defterTespit(empties,year);
    };
  }

  // mizan gelmeyen firmaların defter türü Luca'dan okunur (defterTespit); eski 'silme listesi' kaldırıldı
  let lastEmpty=new Set();


  document.addEventListener('click',async e=>{
    const t=e.target.closest('[data-luca],[data-lgo],[data-lclose]');if(!t)return;
    if(t.dataset.luca){openLuca(t.dataset.luca);return;}
    if(t.dataset.lclose){closeLuca();return;}
    const g=t.dataset.lgo;
    if(g==='check'){await render();if(!luca.loggedIn)toast('Henüz Luca ana ekranı açılmadı.');}
    else if(g==='show'){await api.luca.open();}
    else if(g==='logout'){await api.luca.logout();lucaFirms=null;await refreshLuca();renderConnect();}
    else if(g==='firms'||g==='mizan'){openLuca(g);}
    else if(g==='connectview'){mode='connect';renderConnect();}
  });
  $('#lucaModal').addEventListener('pointerdown',e=>{if(e.target.id==='lucaModal')closeLuca();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('#lucaModal').hidden)closeLuca();});

  function firmMizanButton(){
    if(isExample())return '<button class="btn" disabled title="Örnek firmada kullanılamaz">Mizanı Luca\'dan çek</button>';
    const f=S.firm;const y=(f.mizanInfo&&f.mizanInfo.year)||thisYear;
    return `<button class="btn primary" data-fmiz="1">Mizanı Luca'dan çek</button><select id="fmizYear" aria-label="Dönem" style="width:auto">${yearOpts(y)}</select>`;
  }
  document.addEventListener('click',async e=>{
    const b=e.target.closest('[data-fmiz]');if(!b)return;
    await refreshLuca();
    if(!luca.loggedIn){closeModal();openLuca('connect');LucaBag.uyar('Önce Luca\'ya bağlanın (üst şeritteki "Luca\'ya giriş").');return;}
    if(!S.firm.lucaId){closeModal();openLuca('mizan');toast('Bu firmayı listeden Luca\'daki karşılığıyla eşleştirin.');return;}
    const year=+($('#fmizYear')||{}).value||thisYear;
    b.disabled=true;b.textContent='Alınıyor…';busy=true;
    try{const n=await pullMizan(S.firm,year);toast(`Mizan Luca'dan alındı: ${n} alt hesap (${year}).`);}
    catch(err){toast('Mizan alınamadı: '+cleanErr(err));}
    finally{busy=false;onFirms(Object.values(Store.local().firms));renderAll();}
  });

  /* ---- veri deposu: her değişiklik tek işlem olarak diske (ya da ortak klasöre) yazılır ---- */
  const op=async(name,args)=>{try{const d=await api.dataOp(name,args);Store.cache=d;return d;}catch(e){toast('Kaydedilemedi: '+cleanErr(e));throw e;}};
  Store.saveFirm=async f=>{const {id,...body}=f;body.updatedAt=new Date().toISOString();const firm={id,...body};if(Store.cache)Store.cache.firms[id]=firm;const r=await op('saveFirm',{firm});Store.firmsSync();return r;};
  Store.deleteFirm=async(id,o={})=>{await op('deleteFirm',{id,kurallar:o.kurallar!==false,mizan:o.mizan!==false});Store.firmsSync();};
  Store.addRule=async(fid,r)=>{await op('addRule',{fid,rule:r});Store.notifyLocal(fid);};
  Store.delRule=async(fid,rid)=>{await op('delRule',{fid,rid});Store.notifyLocal(fid);};
  Store.getMizan=fid=>api.getMizan(fid);
  Store.saveMizan=async(fid,acc)=>{await op('saveMizan',{fid,acc});return 1;};
  Store.saveOutput=o=>op('saveOutput',{o});

  async function reloadAll(msg){
    const r=api.loadData();if(!r.ok){toast('Veriler okunamadı: '+r.error);return;}
    Store.cache=r.data;lucaFirms=null;
    const list=Object.values(r.data.firms);
    S.firms=list;
    const keep=list.some(f=>f.id===S.firmId)?S.firmId:(list[0]?list[0].id:EXAMPLE_ID);
    await selectFirm(keep);onFirms(list);renderAll();
    if(msg)toast(msg);
  }
  api.data.onChanged(async()=>{
    const r=api.loadData();if(!r.ok)return;
    const old=Store.cache||{firms:{}};Store.cache=r.data;
    const cf=r.data.firms[S.firmId],of=old.firms[S.firmId];
    onFirms(Object.values(r.data.firms));
    if(cf&&of&&((cf.mizanInfo||{}).at!==(of.mizanInfo||{}).at))await selectFirm(S.firmId);else Store.notifyLocal(S.firmId);
    toast('Başka bir bilgisayardaki değişiklikler yüklendi.');
  });

  function choose(title,text,opts){
    return new Promise(res=>{const m=$('#chooseModal');$('#chTitle').textContent=title;$('#chText').textContent=text;
      $('#chBtns').innerHTML=opts.map((o,i)=>`<button class="btn ${o.primary?'primary':''}" data-ch="${i}">${esc(o.label)}</button>`).join('');
      m.hidden=false;const done=v=>{m.hidden=true;document.removeEventListener('keydown',kd,true);res(v);};
      const kd=e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();done(null);}};document.addEventListener('keydown',kd,true);
      $('#chBtns').onclick=e=>{const b=e.target.closest('[data-ch]');if(b)done(opts[+b.dataset.ch].value);};
      const f=$('#chBtns button');if(f)f.focus();});
  }
  const fmtTs=t=>t?new Date(t).toLocaleString('tr-TR',{dateStyle:'short',timeStyle:'short'}):'—';
  function setStoreState(i){const el=$('#storeState');if(el)el.textContent=i.shared?'Veriler ortak klasörde · büro içinde paylaşılıyor':'Veriler bu bilgisayarda saklanıyor';}
  api.data.info().then(setStoreState).catch(()=>{});
  async function renderData(){
    const i=await api.data.info();setStoreState(i);
    $('#dataBody').innerHTML=`
      <div class="banner" style="background:${i.shared?'var(--cari-bg)':'var(--surface-2)'};color:${i.shared?'var(--cari-fg)':'var(--ink)'}">
        Veriler şu an <b>${i.shared?'ortak klasörde':'bu bilgisayarda'}</b> saklanıyor.<br><span class="mono" style="font-size:12px;overflow-wrap:anywhere">${esc(i.dir)}</span><br>
        <span class="note">${i.firms} firma · son kayıt ${esc(fmtTs(i.savedAt))}${i.savedBy?' · '+esc(i.savedBy):''}</span></div>
      <section style="display:grid;gap:8px"><h3 style="margin:0;font-family:var(--f-display);font-size:16px">Ortak klasör · büro içinde paylaşım</h3>
        <p class="note" style="margin:0">Büronuzun ortak ağ klasörünü ya da OneDrive / Google Drive / Dropbox klasörünü seçin. Aynı klasörü seçen bütün bilgisayarlar aynı firmaları, kuralları ve mizanları görür; birinin eklediği kural ötekilerde birkaç saniye içinde görünür. Her değişiklik ayrı kaydedildiği için iki kişinin aynı anda çalışması birbirinin kaydını silmez.</p>
        <div class="actions"><button class="btn primary" data-dact="shared">${i.shared?'Başka ortak klasör seç…':'Ortak klasör seç…'}</button>${i.shared?'<button class="btn" data-dact="local">Bu bilgisayara dön</button>':''}<button class="btn ghost" data-dact="open">Klasörü aç</button></div></section>
      <section style="display:grid;gap:8px"><h3 style="margin:0;font-family:var(--f-display);font-size:16px">Yedek dosyası · taşıma</h3>
        <p class="note" style="margin:0">Tüm firmaları, kuralları ve mizanları tek dosyaya kaydedin; başka bir bilgisayarda “İçe aktar” ile yükleyin. Yedek almak için de kullanabilirsiniz.</p>
        <div class="actions"><button class="btn" data-dact="export">Dışa aktar…</button><button class="btn" data-dact="import">İçe aktar…</button></div></section>
      <section style="display:grid;gap:8px"><h3 style="margin:0;font-family:var(--f-display);font-size:16px">Fatura – Muavin Kontrol verileri</h3>
        <p class="note" style="margin:0" id="fkStore">İndirilen e-belgeler, muavinler, kontrol raporları ve toplu özetler bu bilgisayarda, hesabınızın klasöründe tutulur.</p>
        <div class="actions"><button class="btn ghost" data-dact="fkopen">Klasörü aç</button><button class="btn ghost danger ic-trash" data-dact="fkwipe">Tüm sorgu sonuçlarını ve indirilen belgeleri sil</button></div></section>`;
    if(window.desktop.fk)window.desktop.fk.storage().then(d=>{const el=$('#fkStore');if(el)el.innerHTML=`İndirilen e-belgeler, muavinler, kontrol raporları ve toplu özetler: <span class="mono" style="font-size:12px;overflow-wrap:anywhere">${esc(d.klasor)}</span><br><span class="note">Firma belgeleri ${d.firmalar_mb} MB · toplu özetler ${d.toplu_mb} MB</span>`;}).catch(()=>{});
  }
  function openData(){$('#dataModal').hidden=false;document.documentElement.style.overflow='hidden';renderData();}
  function closeData(){$('#dataModal').hidden=true;document.documentElement.style.overflow='';}
  document.addEventListener('click',async e=>{
    if(e.target.closest('[data-dataopen]')){openData();return;}
    if(e.target.closest('[data-dclose]')){closeData();return;}
    const b=e.target.closest('[data-dact]');if(!b)return;const a=b.dataset.dact;
    try{
      if(a==='open')await api.openDataFolder();
      else if(a==='fkopen')await api.fk.openFolder();
      else if(a==='fkwipe'){
        if(!(await askConfirm('Fatura Kontrol verileri silinsin mi?','Tüm firmaların indirilen belgeleri, kontrol raporları ve toplu özetleri silinecek. Firma listesi ve seçimleriniz kalır.','Evet, sil')))return;
        await api.fk.wipe();toast('Fatura Kontrol verileri silindi.');if(typeof FKUI!=='undefined')FKUI.reset();renderData();
      }
      else if(a==='export'){const r=await api.data.exportFile();if(r.ok)toast(`${r.firms} firmanın verisi kaydedildi: ${r.path}`);}
      else if(a==='import'){
        const p=await api.data.importPick();if(!p.ok)return;
        const mode=await choose('Veri dosyası yüklensin mi?',`${p.file}\n${p.firms} firma, ${p.rules} kural, ${p.mizan} mizan${p.exportedAt?' · '+fmtTs(p.exportedAt):''}${p.host?' · '+p.host:''}\n\nBirleştir: buradaki verilere eklenir; aynı firma (aynı Luca firması) tek firmada toplanır, kurallar birleşir.\nDeğiştir: buradaki veriler silinip dosyadaki veriler yüklenir.`,
          [{label:'Vazgeç',value:null},{label:'Değiştir',value:'replace'},{label:'Birleştir',value:'merge',primary:true}]);
        if(!mode)return;
        if(mode==='replace'&&!(await askConfirm('Buradaki veriler silinsin mi?','Bu bilgisayardaki (ya da ortak klasördeki) firmalar, kurallar ve mizanlar silinip dosyadakiler yüklenecek.','Evet, değiştir')))return;
        await api.data.importApply(mode);await reloadAll(mode==='merge'?'Veriler birleştirildi.':'Veriler yüklendi.');renderData();
      }
      else if(a==='shared'){
        const p=await api.data.pickShared();if(!p.ok)return;
        let mode='copy';
        if(p.exists){mode=await choose('Bu klasörde zaten veri var',`${p.path}\n${p.firms} firma · son kayıt ${fmtTs(p.savedAt)}${p.savedBy?' · '+p.savedBy:''}\n\nBirleştir: bu bilgisayardaki firmalar ve kurallar ortak veriye eklenir (önerilir).\nOrtaktakini kullan: bu bilgisayardaki veriler ortak klasöre eklenmez.`,
          [{label:'Vazgeç',value:null},{label:'Ortaktakini kullan',value:'useShared'},{label:'Birleştir',value:'merge',primary:true}]);if(!mode)return;}
        await api.data.useShared(p.dir,mode);await reloadAll('Veriler artık ortak klasörde.');renderData();
      }
      else if(a==='local'){
        if(!(await askConfirm('Bu bilgisayara dönülsün mü?','Ortak klasördeki son veriler bu bilgisayara kopyalanır; bundan sonraki değişiklikler diğer bilgisayarlarla paylaşılmaz.','Evet, bu bilgisayara dön')))return;
        await api.data.useLocal();await reloadAll('Veriler artık bu bilgisayarda.');renderData();
      }
    }catch(err){toast(cleanErr(err));}
  });
  $('#dataModal').addEventListener('pointerdown',e=>{if(e.target.id==='dataModal')closeData();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('#dataModal').hidden&&$('#chooseModal').hidden&&$('#askModal').hidden)closeData();});
  if(Store.loadError)setTimeout(()=>toast('Ortak veri klasörüne ulaşılamadı: '+Store.loadError),800);

  /* ---- Ayarlar: büro bilgileri (e-posta) + Luca giriş (yerel) + firma listesi ---- */
  const REG_TO='bilgi@smmmantalya.com';
  const REG_FIELDS=[
    ['buro','Büro / firma adı',true,'örn. Yılmaz SMMM Bürosu'],
    ['vd','Vergi dairesi',false,'örn. Çankaya'],
    ['vkn','Vergi numarası (VKN/TCKN)',false,''],
    ['adres','Adres (fatura için)',false,'mahalle, cadde, no'],
    ['il','İl / ilçe',false,'örn. Muratpaşa / Antalya'],
    ['yetkili','Yetkili adı soyadı',true,''],
    ['telefon','Telefon',true,'05__ ___ __ __'],
    ['eposta','E-posta',true,'ornek@eposta.com']
  ];
  // ofis çalışanı (davetle katılan, ofis sahibi değil): yalnız ad soyad ve telefon; ofis ve e-posta kendiliğinden
  let ofisBilgi=null;
  const calisanMi=()=>!!(ofisBilgi&&!ofisBilgi.is_owner);
  const CALISAN_ALAN=[['yetkili','Adınız soyadınız',true,''],['telefon','Telefon',true,'05__ ___ __ __'],['eposta','E-posta',true,'']];
  const regAlanlar=()=>calisanMi()?CALISAN_ALAN:REG_FIELDS;
  async function ofisBilgiAl(){try{ofisBilgi=await api.office.call('office_info');}catch(e){}return ofisBilgi;}
  function regAlanHtml(r){const cal=calisanMi();
    return (cal?`<div class="banner" style="grid-column:1/-1;margin:0">Ofis: <b>${esc(ofisBilgi.name||'')}</b> — büro bilgileri (adres, vergi dairesi, vergi no …) ofis sahibince girilir; siz yalnız adınızı ve telefonunuzu yazın.</div>`:'')+
      regAlanlar().map(([k,l,req,ph])=>{const v=cal&&k==='eposta'?((acct&&acct.email)||r[k]||''):(r[k]||'');
        return `<div style="${k==='not'||k==='adres'?'grid-column:1/-1':''}"><label class="lbl" for="rg_${k}">${esc(l)}${req?' *':''}</label><input type="text" id="rg_${k}" value="${esc(v)}" placeholder="${esc(ph||'')}"${req?' required':''}${cal&&k==='eposta'?' readonly title="Üye olduğunuz e-posta"':''}></div>`;}).join('');}
  function regData(){return (Store.cache&&Store.cache.registration)||{};}
  function regText(r){
    const L=regAlanlar().map(([k,l])=>`${l}: ${r[k]||'-'}`);
    L.push('Lisans: '+(lic&&lic.name?lic.name+' · bitiş '+(lic.expires||''):'(henüz yok)'));
    return L.join('\n');
  }
  const tumFirmalar=()=>{let L={};try{L=Store.local().firms||{};}catch(e){}const m=new Map(S.firms.map(f=>[f.id,f]));for(const f of Object.values(L))if(!m.has(f.id))m.set(f.id,f);return [...m.values()];};
  function firmRows(){
    const fs=tumFirmalar().sort((a,b)=>String(a.name).localeCompare(String(b.name),'tr'));
    if(!fs.length)return '<div class="actions" style="margin:0"><span class="note">Henüz firma yok. Firmalarınızı Luca’dan ekleyebilirsiniz.</span><button class="btn small primary" type="button" data-luca="firms" data-regkapat="1">Luca’ya bağlan ve firma ekle</button></div>';
    return `<div class="rules" style="max-height:220px">${fs.map(f=>`<div class="rule"><div class="k" style="font-family:var(--f-body)">${esc(f.name)} ${f.lucaId?'<span class="chip cari">Luca</span>':'<span class="chip elle">elle</span>'}${f.mizanInfo?` <span class="note">· ${f.mizanInfo.count||0} hesap</span>`:' <span class="note">· mizan yok</span>'}</div>
      ${f.defterOto?`<span class="note" title="Luca Müşteri Listesi'nden okundu (SINIF=${esc(f.defterSinif||'?')}, ${esc(f.defterZaman||'')}). Yanlışsa yandaki listeden düzeltin; elle seçim Luca okumasını ezer.">Luca: sınıf ${esc(f.defterSinif||'?')}</span>`:''}
      <select data-defter="${esc(f.id)}" title="Defter türü" style="width:auto;min-width:0;padding:3px 6px;font-size:12px">${[['','Defter Türü ?'],['bilanco','Bilanço'],['isletme','İşletme Defteri'],['serbest','Serbest Meslek Defteri']].map(([k,l])=>`<option value="${k}"${(f.defter||'')===k?' selected':''}>${l}</option>`).join('')}</select>
      <input type="text" data-watel="${esc(f.id)}" value="${esc(f.waTel||'')}" placeholder="WhatsApp no (05xx…), virgülle" title="Bu firmanın fiş gönderen WhatsApp numaraları; ÖKC “WhatsApp'tan Al” fişleri bu numaraya göre firmaya düşürür" style="width:200px;min-width:0;padding:3px 6px;font-size:12px">
      <button class="btn small ghost danger ic-trash" data-delfirm="${esc(f.id)}">Sil</button></div>`).join('')}</div>
      <div class="actions" style="justify-content:flex-end;margin-top:8px"><button class="btn small dangerfill" id="delAllFirms" title="Programı sıfırlamak için tüm firmaları ve seçtiğiniz verilerini siler">Tüm Firmaları Sil (${fs.filter(f=>f.id!==EXAMPLE_ID).length})</button></div>`;
  }
  function licStateHtml(){
    // tek lisans: tüm modüller aynı durumu taşır; ilk etkin modülün durumu gösterilir
    const m0=(mods||[]).find(m=>m.active!==false&&m.type!=='soon'&&m.type!=='gizli'&&m.type!=='free');
    if(m0){const [c,t]=modState(m0);return `<div class="banner" style="display:flex;justify-content:space-between;gap:10px;align-items:center;margin:0"><b>MuhaWin lisansı · tüm modüller</b><span class="ms ${c}" style="font-size:12.5px;font-weight:600;padding:4px 10px;border-radius:999px">${esc(t)}</span></div>`;}
    return licStateHtmlOld();
  }
  function licStateHtmlOld(){
    const t=lic&&lic.type, warn=lic&&(lic.type==='trial'||(lic.daysLeft!=null&&lic.daysLeft<=20));
    const bg=lic&&lic.valid?(warn?'var(--aski-bg)':'var(--cari-bg)'):'var(--warn-bg)';
    const fg=lic&&lic.valid?(warn?'var(--aski-fg)':'var(--cari-fg)'):'var(--warn)';
    let msg=licText()||(lic&&lic.reason)||'';
    if(t==='pool')msg='Lisanslı (1 yıllık) · bitiş '+(lic.expires||'').split('-').reverse().join('.')+' · '+lic.daysLeft+' gün kaldı';
    else if(t==='trial')msg='Deneme sürümü · '+lic.daysLeft+' gün kaldı. Lisans kodu girerek 1 yıl devam edebilirsiniz.';
    return `<div class="banner" style="background:${bg};color:${fg}">${esc(msg)}</div>`;
  }
  function renderReg(){
    const r=regData();
    $('#regBody').innerHTML=accountHtml()+(setupMode?'':`<section style="display:grid;gap:10px;border-top:1px solid var(--line);padding-top:16px" id="ofisSec"><h3 style="margin:0;font-family:var(--f-display);font-size:16px">Ofis ve çalışanlar</h3><p class="note" style="margin:0">Yükleniyor…</p></section>`)+`
      <section style="display:grid;gap:10px;border-top:1px solid var(--line);padding-top:16px">
        <h3 style="margin:0;font-family:var(--f-display);font-size:16px">Lisans</h3>
        <div id="licState">${licStateHtml()}</div>
        <div class="actions"><input type="text" id="licInput" placeholder="50 haneli lisans kodu" autocomplete="off" style="max-width:420px;font-family:var(--f-mono)"><button class="btn primary" type="button" id="licActivate">Etkinleştir</button><span class="note err" id="licInErr"></span></div>
        <p class="note" style="margin:0">Tek lisans tüm modülleri açar. Lisans kodu girildiği tarihten itibaren 1 yıl geçerlidir ve yalnızca bir hesapta kullanılabilir. Süre bitmeden yeni kod girilirse süre eklenir.</p>
      </section>
      <section style="display:grid;gap:10px;border-top:1px solid var(--line);padding-top:16px">
        <h3 style="margin:0;font-family:var(--f-display);font-size:16px">Büro bilgileri</h3>
        <p class="note" style="margin:0">Bu bilgiler hesabınızla birlikte lisans sunucusunda saklanır. Luca giriş bilgileri, banka ekstreleri ve muhasebe verileri sunucuya <b>gönderilmez</b>.</p>
        <form id="regForm" class="outgrid" style="gap:12px">
          <div id="regAlan" style="display:contents">${regAlanHtml(r)}</div>
          <div class="actions" style="grid-column:1/-1"><button class="btn primary" type="submit">Kaydet</button><span class="note" id="regMsg"></span></div>
        </form>
      </section>
      <section style="display:grid;gap:10px;border-top:1px solid var(--line);padding-top:16px">
        <h3 style="margin:0;font-family:var(--f-display);font-size:16px">Luca giriş bilgileri <span class="note" style="font-weight:400">(isteğe bağlı)</span></h3>
        <p class="note" style="margin:0">Doldurursanız Luca'ya bağlanırken giriş kutuları otomatik dolar. Bu bilgiler <b>yalnızca bu bilgisayarda</b>, şifreli saklanır; e-posta ile ya da ortak klasöre <b>gönderilmez</b>. CAPTCHA/doğrulama kodunu ve girişi yine siz yaparsınız. Luca giriş bilgilerini doldurmazsanız girişlerde manuel de girebilirsiniz.</p>
        <div class="outgrid" style="gap:12px">
          <div><label class="lbl" for="lg_uyeno">Üye numarası</label><input type="text" id="lg_uyeno" autocomplete="off"><span class="note" id="lg_uyenot" hidden>Ofisinizin üye numarası; değiştirilemez.</span></div>
          <div><label class="lbl" for="lg_kullanici">Kullanıcı adı</label><input type="text" id="lg_kullanici" autocomplete="off"></div>
          <div><label class="lbl" for="lg_parola">Parola</label><div style="display:flex;gap:6px"><input type="password" id="lg_parola" autocomplete="off" placeholder=""><button class="btn small" type="button" id="lg_show" title="Göster/Gizle">👁</button></div></div>
        </div>
        <div class="actions"><button class="btn primary" type="button" id="lucaCredSave">Luca bilgilerini kaydet</button><button class="btn ghost danger" type="button" id="lucaCredClear">Kayıtlı bilgileri sil</button><span class="note" id="lgMsg"></span></div>
        <details style="margin-top:6px"><summary class="note">Luca İstek Kaydı (yeni özellik geliştirmek için)</summary>
          <p class="note" style="margin:6px 0">Luca'da elle yaptığınız bir işlemin (ör. hesap planına hesap ekleme) Luca'ya nasıl gönderildiğini kaydeder; dosyayı MuhaWin geliştiricisine iletirsiniz. Yalnız Luca'ya giden isteklerin adresi ve gönderilen alanlar tutulur; çerez ve parola kaydedilmez. Kayıt yalnız MuhaWin'in Luca penceresindeki işlemleri görür.</p>
          <div class="actions" style="margin:0"><button class="btn small" type="button" id="lkBaslat">Kaydı Başlat</button><button class="btn small" type="button" id="lkDurdur" disabled>Kaydı Durdur ve Dosyaya Yaz</button><span class="note" id="lkMsg"></span></div></details>
      </section>
      <section style="display:grid;gap:10px;border-top:1px solid var(--line);padding-top:16px">
        <h3 style="margin:0;font-family:var(--f-display);font-size:16px">Veri ve yedek</h3>
        <p class="note" style="margin:0">Programın verilerinin (firmalar, kurallar, mizanlar, fişler) bulunduğu klasör, ortak veri klasörü, yedek alma ve geri yükleme.</p>
        <div class="actions" style="margin:0"><button class="btn" type="button" data-dataopen="1" data-regkapat="1">Veri ve yedek ayarlarını aç</button></div>
      </section>
      <section style="display:grid;gap:10px;border-top:1px solid var(--line);padding-top:16px" id="waSec">
        <h3 style="margin:0;font-family:var(--f-display);font-size:16px">WhatsApp Fiş Kutusu</h3>
        <p class="note" style="margin:0">Mükellefler ÖKC fişlerinin fotoğrafını ofisin WhatsApp Business numarasına gönderir; fotoğraflar sunucuda toplanır, Belgeden Fiş ekranında “WhatsApp'tan Al” ile gönderen numaraya göre firmaya düşer. Numara → firma eşlemesi aşağıdaki Firmalar listesindeki “WhatsApp no” alanından yapılır.</p>
        <div class="actions" style="margin:0"><label class="note">Meta Phone number ID <input type="text" id="waPid" class="mono" style="width:190px" placeholder="1234567890123"></label><label class="note">Numara <input type="text" id="waDisp" style="width:150px" placeholder="+90 5xx xxx xx xx"></label><button class="btn small" type="button" id="waBagla">Ofise Bağla</button><span class="note" id="waMsg"></span></div>
        <details><summary class="note">Kurulum adımları (bir kez, ofis yöneticisi)</summary><ol class="note" style="margin:6px 0 0 18px;padding:0;display:grid;gap:4px">
          <li>business.facebook.com → WhatsApp Business hesabı açın, ofis için ayrı bir telefon numarası ekleyin (mevcut kişisel WhatsApp numarası kullanılamaz).</li>
          <li>developers.facebook.com → uygulama → WhatsApp → API Setup: <b>Phone number ID</b> ve <b>kalıcı erişim belirteci</b> (System User token) alın.</li>
          <li>Supabase panelinde <code>sunucu\supabase-whatsapp.sql</code> dosyasını çalıştırın; <code>sunucu\edge\whatsapp-webhook</code> ve <code>whatsapp-al</code> fonksiyonlarını yükleyin; secret olarak <code>WA_TOKEN</code> ve <code>WA_VERIFY_TOKEN</code> girin.</li>
          <li>Meta → Webhook: Callback URL <code>https://&lt;proje&gt;.supabase.co/functions/v1/whatsapp-webhook</code>, verify token = WA_VERIFY_TOKEN, alan: <b>messages</b>.</li>
          <li>Yukarıya Phone number ID'yi yazıp “Ofise Bağla” deyin. Gelen fotoğraflar Meta tarafında ücretsizdir; otomatik “alındı” yanıtı servis mesajıdır (numara başına ayda 1.000 ücretsiz, sonrası ~0,01 $).</li></ol></details>
      </section>
      <section style="display:grid;gap:10px;border-top:1px solid var(--line);padding-top:16px" id="yedekSec">
        <h3 style="margin:0;font-family:var(--f-display);font-size:16px">Yedekleme ve hata günlüğü</h3>
        <p class="note" style="margin:0">Yedek, bu bilgisayardaki tüm MuhaWin verilerini (firmalar, kurallar, mizan/muavin, fişler, ayarlar) seçtiğiniz klasöre <b>MuhaWin-yedek-tarih</b> adıyla kopyalar. Geri yükleme mevcut verilerin üzerine yazar (öncesinde otomatik iç yedek alınır). Hata günlüğü, programda oluşan beklenmedik hataları <code>Belgeler\MuhaWin Günlük\hatalar.log</code> dosyasına yazar; destek isterken bu dosyayı iletebilirsiniz. Günlükte parola ya da Luca verisi bulunmaz.</p>
        <div class="actions" style="margin:0"><button class="btn small" type="button" id="yedekAl">Yedek Al…</button><button class="btn small ghost danger" type="button" id="yedekGeri">Yedekten Geri Yükle…</button><button class="btn small" type="button" id="hataAc">Hata Günlüğünü Aç</button><button class="btn small ghost" type="button" id="hataGoster">Son Hataları Göster</button><span class="note" id="yedekMsg"></span></div>
        <pre class="mono note" id="hataListe" hidden style="max-height:200px;overflow:auto;white-space:pre-wrap;margin:0;padding:8px;border:1px solid var(--line);border-radius:8px"></pre>
      </section>
      <section style="display:grid;gap:10px;border-top:1px solid var(--line);padding-top:16px">
        <h3 style="margin:0;font-family:var(--f-display);font-size:16px">Firmalar <span class="note" style="font-weight:400">(${S.firms.length})</span></h3>
        <p class="note" style="margin:0">Programdaki firmalar. İstemediğiniz firmayı buradan silebilirsiniz (firmanın kuralları ve mizanı da silinir; Luca'daki kayda dokunulmaz).</p>
        <div class="actions" style="margin:0" id="regFirmEkle"><button class="btn small ic-add" type="button" data-luca="firms" data-regkapat="1">Luca'dan firma ekle</button><button class="btn small ic-plus" type="button" data-yenifirma="1" data-regkapat="1">Yeni firma</button></div>
        <div id="regFirms">${firmRows()}</div>
      </section>`;
    // Luca giriş alanlarını mevcut kayıttan doldur
    renderOffice();
    (async()=>{try{const n=await api.wa.numara();const m=$('#waMsg');if(m&&n&&n.length){m.textContent='Bağlı: '+n.map(x=>(x.display_phone||'')+' ('+x.phone_number_id+')').join(', ');const p=$('#waPid');if(p)p.value=n[0].phone_number_id;const d=$('#waDisp');if(d)d.value=n[0].display_phone||'';}}catch(e){}})();
    const wb=$('#waBagla');if(wb)wb.onclick=async()=>{const id=$('#waPid').value.trim();if(!/^\d{6,}$/.test(id)){$('#waMsg').textContent='Phone number ID yalnız rakamlardan oluşur.';return;}
      try{await api.wa.numaraBagla({id,display:$('#waDisp').value.trim()});$('#waMsg').textContent='Bağlandı. Mükellefler fiş gönderebilir.';toast('WhatsApp numarası ofise bağlandı.');}catch(x){$('#waMsg').textContent=cleanErr(x);}};
    api.info().then(i=>{const b=$('#regBody');if(!b||$('#hakkindaSec'))return;b.insertAdjacentHTML('beforeend',`<section class="hakkinda" id="hakkindaSec" style="display:grid;gap:8px;border-top:1px solid var(--line);padding-top:16px">
      <h3 style="margin:0;font-family:var(--f-display);font-size:16px">Hakkında</h3>
      <img src="gorsel/hakkinda_banner.png" srcset="gorsel/hakkinda_banner.png 1x, gorsel/hakkinda_banner@2x.png 2x" alt="MuhaWin — Muhasebede zaman kazandıran çözüm">
      <p class="note" style="margin:0">Sürüm ${esc(i.version||'')} · © ${new Date().getFullYear()} MuhaWin · SMMM Antalya</p>
      <div class="actions" style="margin:0"><span class="note" id="updDurum"></span><button class="btn small" id="updBtn">Güncellemeleri denetle</button></div></section>`);UPD.ciz();}).catch(()=>{});
    api.luca.credGet().then(c=>{if(!c)return;const u=$('#lg_uyeno'),k=$('#lg_kullanici'),pp=$('#lg_parola');if(u){u.value=c.uyeno||'';if(c.uyeKilitli){u.readOnly=true;u.style.opacity='.75';const n=$('#lg_uyenot');if(n)n.hidden=false;}}if(k)k.value=c.kullanici||'';if(pp&&c.hasParola)pp.placeholder='•••••• (kayıtlı · değiştirmek için yazın)';}).catch(()=>{});
  }
  function openReg(){const cb=document.querySelector('#regModal [data-rgclose]');if(cb)cb.hidden=setupMode;$('#regModal').hidden=false;document.documentElement.style.overflow='hidden';renderReg();setTimeout(()=>{const i=$('#rg_buro');if(i)i.focus();},40);}
  function closeReg(){if(setupMode){toast('Devam etmek için büro bilgilerini doldurup Kaydet\'e basın.');return;}$('#regModal').hidden=true;document.documentElement.style.overflow='';}
  function collectReg(){const r={...regData()};regAlanlar().forEach(([k])=>{const el=$('#rg_'+k);r[k]=el?el.value.trim():'';});
    if(calisanMi()){r.buro=ofisBilgi.name||r.buro||'';if(acct&&acct.email)r.eposta=acct.email;}delete r.kullanici;return r;}
  async function persistReg(r){try{await op('saveReg',{reg:r});}catch(e){}try{await api.reg.save(r);}catch(e){toast('Büro bilgileri sunucuya kaydedilemedi: '+cleanErr(e));}}
  document.addEventListener('click',async e=>{
    if(e.target.closest('[data-regopen]')){openReg();return;}
    if(e.target.closest('[data-regkapat]')){if(!setupMode){$('#regModal').hidden=true;}return;}
    if(e.target.closest('[data-rgclose]')){closeReg();return;}
    if(e.target.closest('#licActivate')){const ok=await tryActivate($('#licInput').value,m=>{$('#licInErr').textContent=m;});if(ok){$('#licInErr').textContent='';const s=$('#licState');if(s)s.innerHTML=licStateHtml();$('#licInput').value='';}return;}
    if(e.target.closest('#lg_show')){const pp=$('#lg_parola');if(pp)pp.type=pp.type==='password'?'text':'password';return;}
    if(e.target.closest('#lucaCredSave')){
      const c={uyeno:$('#lg_uyeno').value.trim(),kullanici:$('#lg_kullanici').value.trim(),parola:$('#lg_parola').value};
      try{await api.luca.credSet(c);$('#lg_parola').value='';$('#lg_parola').placeholder='•••••• (kayıtlı · değiştirmek için yazın)';const m=$('#lgMsg');if(m)m.textContent='Luca giriş bilgileri bu bilgisayara kaydedildi.';}
      catch(err){toast('Kaydedilemedi: '+cleanErr(err));}
      return;
    }
    if(e.target.closest('#lkBaslat')){try{const st=await api.luca.status();if(!st.loggedIn){await api.luca.open();}
        await api.luca.kayitBaslat();$('#lkBaslat').disabled=true;$('#lkDurdur').disabled=false;
        $('#lkMsg').textContent='Kayıt açık. Luca penceresinde işlemi yapın, sonra “Kaydı Durdur”a basın.';
        const t=setInterval(async()=>{const d=await api.luca.kayitDurum().catch(()=>null);if(!d||!d.acik){clearInterval(t);return;}const m=$('#lkMsg');if(m)m.textContent=`Kayıt açık · ${d.adet} istek. Luca penceresinde işlemi yapın, sonra “Kaydı Durdur”a basın.`;},2000);}
      catch(err){toast(cleanErr(err));}return;}
    if(e.target.closest('#lkDurdur')){try{const r=await api.luca.kayitDurdur();$('#lkBaslat').disabled=false;$('#lkDurdur').disabled=true;$('#lkMsg').textContent=`${r.adet} istek kaydedildi: ${r.dosya}`;}catch(err){toast(cleanErr(err));}return;}
    if(e.target.closest('#yedekAl')){try{const r=await mwBusy.run('Yedek alınıyor…','Veriler kopyalanıyor',()=>api.yedek.al());const m=$('#yedekMsg');if(r&&r.ok){if(m)m.textContent='Yedek alındı: '+r.path;toast('Yedek alındı.');}}catch(err){toast(cleanErr(err));}return;}
    if(e.target.closest('#yedekGeri')){if(!(await askConfirm('Yedekten geri yüklensin mi?','Seçeceğiniz yedek klasörü bu bilgisayardaki MuhaWin verilerinin üzerine yazılır. Mevcut veriler önce iç yedeğe alınır.','Evet, geri yükle')))return;
      try{const r=await mwBusy.run('Geri yükleniyor…','',()=>api.yedek.geriYukle());if(r&&r.ok){toast('Yedek geri yüklendi; program yeniden yükleniyor.');setTimeout(()=>location.reload(),900);}}catch(err){toast(cleanErr(err));}return;}
    if(e.target.closest('#hataAc')){try{await api.hata.ac();}catch(err){toast(cleanErr(err));}return;}
    if(e.target.closest('#hataGoster')){const pre=$('#hataListe');try{const t=await api.hata.oku();pre.textContent=t?t.split('\n').slice(-60).join('\n'):'Kayıtlı hata yok.';}catch(err){pre.textContent=cleanErr(err);}pre.hidden=!pre.hidden;return;}
    if(e.target.closest('#lucaCredClear')){
      if(!(await askConfirm('Luca giriş bilgileri silinsin mi?','Bu bilgisayarda kayıtlı Luca üye no, kullanıcı adı ve parola silinecek.','Evet, sil')))return;
      try{await api.luca.credClear();$('#lg_uyeno').value='';$('#lg_kullanici').value='';$('#lg_parola').value='';$('#lg_parola').placeholder='';const m=$('#lgMsg');if(m)m.textContent='Kayıtlı Luca bilgileri silindi.';}catch(err){toast(cleanErr(err));}
      return;
    }
    if(e.target.closest('#delAllFirms')){
      const sec=tumFirmalar().filter(f=>f.id!==EXAMPLE_ID);if(!sec.length){toast('Silinecek firma yok.');return;}
      const o=await firmaSilSor(sec);if(!o)return;
      const ne=[o.kurallar&&'kurallar',o.mizan&&'mizanlar',o.muavin&&'muavinler',o.belgeler&&'indirilen faturalar ve raporlar'].filter(Boolean);
      if(!(await askConfirm('Emin misiniz?',`${sec.length} firmanın tamamı programdan silinecek${ne.length?' ('+ne.join(', ')+' dahil)':''}. Luca'daki kayıtlara dokunulmaz. Bu işlem geri alınamaz.`,'Evet, tümünü sil')))return;
      let n=0,h=0;await mwBusy.run('Firmalar siliniyor…',`${sec.length} firma`,async()=>{for(const f of sec){try{await firmaSil(f,o);n++;}catch(err){h++;}}});
      await reloadAll(`${n} firma silindi${h?`, ${h} firma silinemedi`:''}.`);renderReg();
      return;
    }
    const df=e.target.closest('[data-delfirm]');
    if(df){
      const f=tumFirmalar().find(x=>x.id===df.dataset.delfirm);if(!f)return;
      const o=await firmaSilSor([f]);if(!o)return;
      try{await firmaSil(f,o);}catch(err){toast('Silinemedi: '+cleanErr(err));return;}
      await reloadAll('Firma silindi.');renderReg();
      return;
    }
  });
  document.addEventListener('change',async e=>{const wt=e.target.closest&&e.target.closest('[data-watel]');if(wt){const f=tumFirmalar().find(x=>x.id===wt.dataset.watel);if(f){await Store.saveFirm({...f,waTel:wt.value.trim()});toast('WhatsApp numarası kaydedildi.');}return;}
    const sel=e.target.closest&&e.target.closest('[data-defter]');if(!sel)return;
    const f=tumFirmalar().find(x=>x.id===sel.dataset.defter);if(!f)return;const y={...f,defter:sel.value,defterOto:false};await Store.saveFirm(y);
    const i=S.firms.findIndex(x=>x.id===y.id);if(i>=0)S.firms[i]=y;defterBildir(y);toast(`${f.name}: ${sel.selectedOptions[0].textContent}`);});
  document.addEventListener('submit',async e=>{
    if(e.target.id!=='regForm')return;e.preventDefault();
    const r=collectReg();
    const miss=regAlanlar().filter(([k,,req])=>req&&!r[k]);
    if(miss.length){toast(miss[0][1]+' alanı zorunlu.');const el=$('#rg_'+miss[0][0]);if(el)el.focus();return;}
    await persistReg(r);
    if(setupMode){setupMode=false;const cb=document.querySelector('#regModal [data-rgclose]');if(cb)cb.hidden=false;$('#regModal').hidden=true;document.documentElement.style.overflow='';toast('Kaydedildi. Hoş geldiniz'+(lic&&lic.type==='trial'?' · '+lic.daysLeft+' günlük deneme süreniz başladı.':'.'));}
    if(!setupMode)toast('Büro bilgileri kaydedildi.');
  });
  $('#regModal').addEventListener('pointerdown',e=>{if(e.target.id==='regModal')closeReg();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('#regModal').hidden)closeReg();});


  /* ---- program girişi (sunucu: Supabase): üyelik + e-posta kodu + giriş + şifre sıfırlama ---- */
  let acct=null;
  const PWHINT='en az 8 karakter, harf ve rakam';
  let pendingInvite='';
  function authGate(){
    return new Promise(async resolve=>{
      let st;try{st=await api.auth.status();}catch(e){st={};}
      if(st.authed){acct=st;resolve(true);return;}
      const g=$('#authGate'),box=$('#authBox');g.hidden=false;
      const yerlestir=()=>{const p=$('#authPanel'),k=$('#authKutu');if(!p||!k)return;const r=p.getBoundingClientRect();if(!r.width)return;
        const sc=Math.max(r.width/560,r.height/720);k.style.transform=`translate(0px,${(r.height-720*sc)/2}px) scale(${sc})`;
        const w=$('#authFeatW');if(w)w.style.width=Math.max(260,Math.min(470,r.width/sc-56-24))+'px';};
      yerlestir();setTimeout(yerlestir,50);window.addEventListener('resize',yerlestir);
      api.info().then(i=>{const v=$('#authSurum');if(v)v.textContent=`© ${new Date().getFullYear()} MuhaWin · Sürüm ${i.version||''}`;}).catch(()=>{});
      const done=async r=>{acct={email:r.email,offline:!!r.offline};g.hidden=true;box.innerHTML='';
        // üyelikte girilen ofis davet kodu (doğrulamadan sonra) kullanılır
        let inv=pendingInvite;if(!inv){try{const d=JSON.parse(localStorage.getItem('muhawin-davet')||'null');if(d&&d.email===r.email)inv=d.code;}catch(x){}}
        if(inv){try{await joinOffice(inv);}catch(x){toast('Ofise katılınamadı: '+cleanErr(x)+' Ayarlar → Ofis ve çalışanlar bölümünden yeniden deneyebilirsiniz.');}
          try{localStorage.removeItem('muhawin-davet');}catch(x){}pendingInvite='';}
        if(r.legacy){const take=await choose('Önceki sürümden kalan veriler',`Bu bilgisayarda hesapsız kullanılan önceki sürümden kalan ${r.legacy.firms} firma (kurallar, mizanlar ve Luca giriş bilgileri) var.\n\nBu veriler sizin mi? "Hesabıma aktar" derseniz bu hesapta görünür. Başka birinin verisiyse "Boş başla" deyin; veriler bu hesaba gelmez.`,[{label:'Boş başla',value:false},{label:'Hesabıma aktar',value:true,primary:true}]);
          try{await api.auth.claimLegacy(!!take);if(take)toast('Önceki veriler hesabınıza aktarıldı.');}catch(x){toast(cleanErr(x));}}
        resolve(true);};
      const head=sub=>`<img class="authlogo" alt="MuhaWin"><h2>Hoş geldiniz</h2><p class="muted" style="margin:0">${sub}</p>`;
      const form=(id,fields,btn,extra)=>`<form id="${id}" style="display:grid;gap:12px" autocomplete="off">${fields}<div class="actions"><button class="btn primary" type="submit">${btn}</button><span class="note err" id="au_err"></span></div></form>${extra||''}`;
      const fld=(id,label,type,val,ph)=>`<div><label class="lbl" for="${id}">${label}</label><input type="${type}" id="${id}" value="${esc(val||'')}" ${ph?`placeholder="${esc(ph)}"`:''} ${type==='text'&&/code/.test(id)?'inputmode="numeric" maxlength="10" style="letter-spacing:4px;font-family:var(--f-mono);font-size:18px"':''}></div>`;
      const link=(k,t)=>`<button type="button" class="btn small ghost" data-au="${k}">${t}</button>`;
      const busy=async(fn)=>{const b=box.querySelector('button[type=submit]'),err=$('#au_err');err.textContent='';b.disabled=true;try{await fn();}catch(x){err.textContent=cleanErr(x);b.disabled=false;}};
      const views={
        login(email){box.innerHTML=head('Devam etmek için giriş yapın.')+form('auF',fld('au_email','E-posta','email',email||st.lastEmail)+fld('au_pw','Şifre','password')+`<label class="note" for="au_hatirla" style="display:inline-flex;gap:8px;align-items:center;cursor:pointer;width:auto" title="Şifre yalnız bu bilgisayarda, Windows'un kullanıcıya özel şifrelemesiyle saklanır; bir dahaki açılışta şifre sorulmaz."><input type="checkbox" id="au_hatirla" style="width:auto;margin:0"${hatirla?' checked':''}> Beni hatırla</label>`,'Giriş yap',`<div class="actions" style="justify-content:space-between">${link('signup','Üye değilim, üye ol')}${link('forgot','Şifremi unuttum')}</div>`);
          $('#auF').onsubmit=e=>{e.preventDefault();const em=$('#au_email').value.trim(),pw=$('#au_pw').value;busy(async()=>{const hc=$('#au_hatirla');const r=await api.auth.login({email:em,password:pw,remember:hc?hc.checked:undefined});if(r.needCode){views.code(em,pw,'E-posta adresiniz henüz doğrulanmadı. Size gönderilen kodu girin.');return;}if(r.offline)toast('Sunucuya ulaşılamadı; çevrimdışı açıldı.');done(r);});};
          setTimeout(()=>$((email||st.lastEmail)?'#au_pw':'#au_email').focus(),40);},
        signup(){box.innerHTML=head('Programı kullanmak için üye olun. Üyelikten sonra 7 günlük deneme süreniz başlar.')+form('auF',fld('au_email','E-posta','email')+fld('au_pw','Şifre','password','',PWHINT)+fld('au_pw2','Şifre (tekrar)','password')+fld('au_invite','Ofis davet kodu (varsa)','text','','MW-XXXX-XXXX-XXXX'),'Üye ol',`<div class="actions">${link('login','Zaten üyeyim, giriş yap')}</div><p class="note" style="margin:0">Üye olduğunuzda e-posta adresinize 6 haneli bir doğrulama kodu gönderilir.</p>`);
          $('#auF').onsubmit=e=>{e.preventDefault();const em=$('#au_email').value.trim(),pw=$('#au_pw').value;if(pw!==$('#au_pw2').value){$('#au_err').textContent='Şifreler aynı değil.';return;}
            pendingInvite=($('#au_invite').value||'').trim();try{if(pendingInvite)localStorage.setItem('muhawin-davet',JSON.stringify({email:em,code:pendingInvite}));}catch(x){}
            busy(async()=>{const r=await api.auth.signup({email:em,password:pw});if(r.needCode)views.code(em,pw,em+' adresine gönderilen 6 haneli kodu girin.');else done(r);});};
          setTimeout(()=>$('#au_email').focus(),40);},
        code(email,pw,msg){pend={email,pw};box.innerHTML=head(esc(msg))+form('auF',fld('au_code','Doğrulama kodu','text','','______'),'Doğrula ve başla',`<div class="actions"><button type="button" class="btn" data-au="linked">E-postadaki bağlantıya tıkladım, devam et</button></div><div class="actions" style="justify-content:space-between">${link('resend','Kodu yeniden gönder')}${link('login','Giriş ekranına dön')}</div><p class="note" style="margin:0">E-postada kod yerine bağlantı geldiyse bağlantıya tıklayın (açılan sayfa boş kalabilir, sorun değil), sonra yukarıdaki düğmeye basın. E-posta gelmediyse gereksiz (spam) klasörüne de bakın.</p>`);
          box.dataset.email=email;
          $('#auF').onsubmit=e=>{e.preventDefault();busy(async()=>{const r=await api.auth.verify({email,code:$('#au_code').value,type:'signup',password:pw});done(r);});};
          setTimeout(()=>$('#au_code').focus(),40);},
        forgot(){box.innerHTML=head('Şifrenizi sıfırlamak için e-posta adresinizi girin; size 6 haneli bir kod gönderilir.')+form('auF',fld('au_email','E-posta','email',st.lastEmail),'Kod gönder',`<div class="actions">${link('login','Giriş ekranına dön')}</div>`);
          $('#auF').onsubmit=e=>{e.preventDefault();const em=$('#au_email').value.trim();busy(async()=>{await api.auth.recover({email:em});views.reset(em);});};
          setTimeout(()=>$('#au_email').focus(),40);},
        reset(email){box.innerHTML=head(esc(email)+' adresine gönderilen kodu ve yeni şifrenizi girin.')+form('auF',fld('au_code','Kod','text','','______')+fld('au_pw','Yeni şifre','password','',PWHINT)+fld('au_pw2','Yeni şifre (tekrar)','password'),'Şifreyi değiştir ve giriş yap',`<div class="actions">${link('login','Giriş ekranına dön')}</div>`);
          $('#auF').onsubmit=e=>{e.preventDefault();const pw=$('#au_pw').value;if(pw!==$('#au_pw2').value){$('#au_err').textContent='Şifreler aynı değil.';return;}
            busy(async()=>{await api.auth.verify({email,code:$('#au_code').value,type:'recovery'});await api.auth.newPassword({password:pw});toast('Şifreniz değiştirildi.');done({email});});};
          setTimeout(()=>$('#au_code').focus(),40);}
      };
      let pend=null;
      box.onclick=async e=>{const b=e.target.closest('[data-au]');if(!b)return;const k=b.dataset.au;
        if(k==='linked'){const err=$('#au_err');err.textContent='';b.disabled=true;
          try{const r=await api.auth.login({email:pend.email,password:pend.pw});if(r.needCode){err.textContent='E-posta henüz doğrulanmamış görünüyor. Bağlantıya tıkladığınızdan emin olun ya da kodu girin.';b.disabled=false;return;}pend=null;done(r);}
          catch(x){err.textContent=cleanErr(x);b.disabled=false;}return;}
        if(k==='resend'){try{await api.auth.resend({email:box.dataset.email});toast('Kod yeniden gönderildi.');}catch(x){$('#au_err').textContent=cleanErr(x);}return;}
        views[k]();};
      // "Beni hatırla" seçildiyse saklanan bilgilerle kendiliğinden giriş yapılır (şifre ana süreçte kalır)
      let hatirla=false;
      (async()=>{let rem=null;try{if(await api.auth.rememberAvailable())hatirla=true;rem=await api.auth.remembered();}catch(x){}
        if(!hatirla){hatirla=false;}else hatirla=!!rem;
        if(rem){box.innerHTML=head('Giriş yapılıyor…')+`<p class="note" style="margin:6px 0 0">${esc(rem.email)}</p>`;
          try{const r=await api.auth.loginRemembered();if(!r.needLogin){if(r.offline)toast('Sunucuya ulaşılamadı; çevrimdışı açıldı.');done(r);return;}views.login(r.email||rem.email);return;}
          catch(x){views.login(rem.email);const er=$('#au_err');if(er)er.textContent=cleanErr(x);return;}}
        st.lastEmail?views.login():views.signup();})();
    });
  }
  /* ---- Ofis: yönetici çalışanlarını davet eder; çalışanlar ofisin lisansını ve Luca üye numarasını kullanır ---- */
  const ROLE={yonetici:'Yönetici',calisan:'Çalışan'};
  let lastInvite=null;
  async function renderOffice(){
    const sec=$('#ofisSec');if(!sec)return;
    const H=`<h3 style="margin:0;font-family:var(--f-display);font-size:16px">Ofis ve çalışanlar</h3>`;
    let o=null;try{o=await api.office.call('office_info');const once=calisanMi();ofisBilgi=o;if(once!==calisanMi()){const ra=$('#regAlan');if(ra)ra.innerHTML=regAlanHtml(regData());}}catch(e){const m=cleanErr(e);
      sec.innerHTML=H+(/schema cache|Could not find the function|does not exist/i.test(m)
        ?`<div class="banner" style="margin:0;background:var(--warn-bg);color:var(--warn)">Ofis özelliği için lisans sunucusunun güncellenmesi gerekiyor. Supabase → SQL Editor'da <b>supabase-ofis.sql</b> dosyasını çalıştırın; ardından bu pencereyi kapatıp açın.</div>`
        :`<p class="note err" style="margin:0">${esc(m)}</p>`);return;}
    if(!o){
      sec.innerHTML=H+`<p class="note" style="margin:0">Programı muhasebe ofisi olarak kullanıyorsanız ofisinizi oluşturun ve çalışanlarınızı e-postayla davet edin. Çalışanlar <b>ofisin lisansını</b> kullanır (kullanıcı sınırı yok) ve Luca'ya yalnız <b>ofisin üye numarasıyla</b> girebilir; böylece yalnız ofisinizin mükellefleriyle işlem yaparlar.</p>
        <div class="outgrid" style="gap:12px"><div><label class="lbl" for="of_ad">Ofis adı</label><input type="text" id="of_ad" value="${esc((regData().buro)||'')}"></div>
          <div><label class="lbl" for="of_uye">Luca üye numarası</label><input type="text" id="of_uye" inputmode="numeric" class="mono"></div></div>
        <div class="actions"><button class="btn primary" type="button" data-of="create">Ofis oluştur</button></div>
        <details${lastInvite===false?' open':''}><summary class="note" style="cursor:pointer">Ofisimden davet kodu aldım</summary>
          <div class="actions" style="margin-top:10px"><input type="text" id="of_kod" placeholder="MW-XXXX-XXXX-XXXX" class="mono" style="max-width:260px;text-transform:uppercase"><button class="btn primary" type="button" data-of="join">Ofise katıl</button></div>
          <p class="note" style="margin:6px 0 0">Davet, programa üye olduğunuz e-posta adresine (${esc((acct&&acct.email)||'')}) gönderilmiş olmalı.</p></details>
        <span class="note err" id="ofErr"></span>`;
      return;
    }
    const head=`<div class="banner" style="margin:0;display:grid;gap:4px"><b>${esc(o.name)}</b><span>Luca üye numarası: <span class="mono">${esc(o.luca_uye_no)}</span> · rolünüz: ${ROLE[o.role]||o.role}${o.is_owner?' (ofis sahibi)':''}</span>${o.role!=='yonetici'?`<span class="note">Lisans ofisinizindir; lisans ve çalışan işlemleri için ofis yöneticisine başvurun${o.owner_email?' ('+esc(o.owner_email)+')':''}.</span>`:''}</div>`;
    if(o.role!=='yonetici'){sec.innerHTML=H+head;return;}
    const fmt=t=>t?new Date(t).toLocaleDateString('tr-TR'):'—';
    sec.innerHTML=H+head+`
      <details><summary class="note" style="cursor:pointer">Ofis bilgilerini değiştir</summary><div class="outgrid" style="gap:12px;margin-top:10px">
        <div><label class="lbl" for="of_ad">Ofis adı</label><input type="text" id="of_ad" value="${esc(o.name)}"></div>
        <div><label class="lbl" for="of_uye">Luca üye numarası</label><input type="text" id="of_uye" value="${esc(o.luca_uye_no)}" class="mono"></div>
        <div class="actions" style="grid-column:1/-1"><button class="btn" type="button" data-of="update">Kaydet</button></div></div></details>
      <div class="tablewrap" style="max-height:240px"><table><thead><tr><th>Çalışan</th><th>Rol</th><th>Katıldı</th><th>Son giriş</th><th></th></tr></thead><tbody>
        ${(o.members||[]).map(m=>`<tr><td><b>${esc(m.email)}</b>${m.name?'<br><span class="note">'+esc(m.name)+'</span>':''}</td><td>${ROLE[m.role]||m.role}${m.is_owner?' <span class="chip cari">sahip</span>':''}</td><td class="mono">${fmt(m.joined_at)}</td><td class="mono">${fmt(m.last_seen)}</td>
          <td>${m.is_owner?'':`<div class="rowbtns"><button class="btn small ghost" data-of="role" data-u="${esc(m.user_id)}" data-r="${m.role==='yonetici'?'calisan':'yonetici'}">${m.role==='yonetici'?'Çalışan yap':'Yönetici yap'}</button><button class="btn small ghost danger" data-of="remove" data-u="${esc(m.user_id)}" data-e="${esc(m.email)}">Çıkar</button></div>`}</td></tr>`).join('')}
      </tbody></table></div>
      ${(o.invites||[]).length?`<div class="note"><b>Bekleyen davetler:</b> ${o.invites.map(v=>`<span class="chip">${esc(v.email)} · ${fmt(v.expires_at)}'e kadar <button class="btn small ghost" data-of="revoke" data-id="${v.id}" title="Daveti iptal et" style="padding:0 4px">✕</button></span>`).join(' ')}</div>`:''}
      <div style="display:grid;gap:8px;background:var(--surface-2);border:1px solid var(--line);border-radius:8px;padding:12px">
        <b>Çalışan davet et</b>
        <div class="actions"><input type="email" id="of_email" placeholder="calisan@ofisiniz.com" style="max-width:300px"><select id="of_rol" style="width:auto"><option value="calisan">Çalışan</option><option value="yonetici">Yönetici</option></select><button class="btn primary" type="button" data-of="invite">Davet kodu oluştur</button></div>
        <p class="note" style="margin:0">Kod yalnız bu e-posta adresiyle kullanılabilir, 14 gün geçerlidir ve tek kullanımlıktır. E-posta programınızda hazır bir mesaj açılır; göndermeniz yeterli.</p>
        ${lastInvite?`<div class="banner" style="margin:0;background:var(--cari-bg);color:var(--cari-fg)">${esc(lastInvite.email)} için davet kodu: <b class="mono" style="font-size:16px;letter-spacing:1px">${esc(lastInvite.code)}</b>
          <div class="actions" style="margin-top:6px"><button class="btn small" type="button" data-of="copy">Kopyala</button><button class="btn small" type="button" data-of="mail">E-posta taslağını aç</button></div></div>`:''}
      </div>
      <span class="note err" id="ofErr"></span>`;
  }
  function inviteMail(v){
    const subj=`MuhaWin daveti · ${v.office}`;
    const body=`Merhaba,\n\n${v.office} sizi MuhaWin programına davet etti.\n\n1. MuhaWin'i kurun (kurulum dosyasını ofisinizden alın).\n2. Programı açıp "Üye ol" ekranında bu e-posta adresinizle (${v.email}) üye olun ve "Ofis davet kodu" kutusuna aşağıdaki kodu yazın.\n   (Üyeyseniz: Ayarlar → Ofis ve çalışanlar → "Ofisimden davet kodu aldım".)\n\nDavet kodu: ${v.code}\nGeçerlilik: ${new Date(v.expires_at).toLocaleDateString('tr-TR')} tarihine kadar, tek kullanımlık.\n\nLuca'ya ofisin üye numarasıyla (${v.luca_uye_no}) ve kendi Luca kullanıcı adınız/parolanızla gireceksiniz.\n\nİyi çalışmalar.`;
    return 'mailto:'+encodeURIComponent(v.email)+'?subject='+encodeURIComponent(subj)+'&body='+encodeURIComponent(body);
  }
  async function joinOffice(code){
    const r=await api.office.call('office_join',{p_code:code});
    if(!r||!r.ok)throw new Error((r&&r.reason)||'Ofise katılınamadı.');
    try{lic=await api.license.status();mods=await api.modules.list();}catch(e){}
    toast(`${r.joined} ofisine katıldınız. Ofisin lisansı ve Luca üye numarası kullanılacak.`);
    return r;
  }
  document.addEventListener('click',async e=>{
    const b=e.target.closest('[data-of]');if(!b)return;const k=b.dataset.of;const err=()=>$('#ofErr');
    try{
      if(err())err().textContent='';
      if(k==='create'){const ad=$('#of_ad').value.trim(),uye=$('#of_uye').value.trim();if(!ad||!uye){err().textContent='Ofis adını ve Luca üye numarasını yazın.';return;}
        if(!(await askConfirm('Ofis oluşturulsun mu?',`${ad} · Luca üye no ${uye}\n\nBundan sonra bu hesapla ve davet ettiğiniz çalışanlarla Luca'ya yalnız bu üye numarasıyla girilebilir. Lisanslarınız ofisin lisansı olur.`,'Evet, oluştur')))return;
        await api.office.call('office_create',{p_name:ad,p_luca_uye_no:uye});toast('Ofis oluşturuldu. Şimdi çalışanlarınızı davet edebilirsiniz.');}
      else if(k==='join'){await joinOffice($('#of_kod').value);}
      else if(k==='update'){await api.office.call('office_update',{p_name:$('#of_ad').value,p_luca_uye_no:$('#of_uye').value});toast('Ofis bilgileri kaydedildi.');}
      else if(k==='invite'){const em=$('#of_email').value.trim();if(!em){err().textContent='E-posta adresini yazın.';return;}
        lastInvite=await api.office.call('office_invite',{p_email:em,p_role:$('#of_rol').value});
        await renderOffice();try{await api.openMail(inviteMail(lastInvite));}catch(x){}return;}
      else if(k==='copy'){try{await navigator.clipboard.writeText(lastInvite.code);toast('Kod kopyalandı.');}catch(x){toast('Kopyalanamadı; kodu seçip kopyalayın.');}return;}
      else if(k==='mail'){await api.openMail(inviteMail(lastInvite));return;}
      else if(k==='revoke'){await api.office.call('office_revoke_invite',{p_id:+b.dataset.id});toast('Davet iptal edildi.');}
      else if(k==='role'){await api.office.call('office_set_role',{p_user:b.dataset.u,p_role:b.dataset.r});}
      else if(k==='remove'){if(!(await askConfirm('Çalışan çıkarılsın mı?',b.dataset.e+' ofisin lisansını ve Luca bağlantısını artık kullanamayacak. Hesabı silinmez.','Evet, çıkar')))return;
        await api.office.call('office_remove_member',{p_user:b.dataset.u});toast('Çalışan ofisten çıkarıldı.');}
      await renderOffice();
      if(/create|join|update/.test(k)){api.luca.credGet().then(c=>{const u=$('#lg_uyeno');if(u&&c){u.value=c.uyeno||'';if(c.uyeKilitli){u.readOnly=true;u.style.opacity='.75';const n=$('#lg_uyenot');if(n)n.hidden=false;}}}).catch(()=>{});refreshLuca();}
    }catch(x){const m=cleanErr(x);if(err())err().textContent=m;else toast(m);}
  });
  // İlk girişte büro bilgileri zorunlu (sunucuda kayıtlıysa oradan gelir)
  let setupMode=false;
  function regComplete(r){r=r||regData();return regAlanlar().every(([k,,req])=>!req||String(r[k]||'').trim()||(calisanMi()&&k==='eposta'&&acct&&acct.email));}
  async function ensureSetup(){
    try{Store.local();}catch(e){}
    await ofisBilgiAl();
    const srv=(lic&&lic.reg)||{};
    if(!regComplete()&&regComplete(srv)){try{await op('saveReg',{reg:srv});}catch(e){}}
    if(regComplete())return;
    setupMode=true;
    const r=regData();if(!r.eposta&&acct&&acct.email){Store.cache=Store.cache||{firms:{},rules:{}};Store.cache.registration={...(Store.cache.registration||{}),eposta:acct.email};}
    openReg();
  }
  function accountHtml(){
    return `<section style="display:grid;gap:10px">
        <h3 style="margin:0;font-family:var(--f-display);font-size:16px">Hesap</h3>
        ${setupMode?`<div class="banner" style="margin:0">Hoş geldiniz. Devam etmek için aşağıdaki <b>büro bilgilerini</b> doldurup <b>Kaydet</b>'e basın.${lic&&lic.type==='trial'?' '+lic.daysLeft+' günlük deneme süreniz başladı.':''}</div>`:''}
        <div class="actions" style="justify-content:space-between"><span>Giriş yapan: <b>${esc((acct&&acct.email)||'')}</b>${acct&&acct.offline?' <span class="chip aski">çevrimdışı</span>':''}</span>${setupMode?'':'<button class="btn ghost danger" type="button" id="authLogout">Çıkış yap</button>'}</div>
        ${setupMode||(acct&&acct.offline)?'':`<details><summary class="note" style="cursor:pointer">Şifre değiştir</summary><div class="outgrid" style="gap:12px;margin-top:10px">
          <div><label class="lbl" for="pw_cur">Mevcut şifre</label><input type="password" id="pw_cur" autocomplete="off"></div>
          <div><label class="lbl" for="pw_new">Yeni şifre</label><input type="password" id="pw_new" autocomplete="off" placeholder="${PWHINT}"></div>
          <div><label class="lbl" for="pw_new2">Yeni şifre (tekrar)</label><input type="password" id="pw_new2" autocomplete="off"></div>
          <div class="actions" style="grid-column:1/-1"><button class="btn" type="button" id="pwChange">Şifreyi değiştir</button><span class="note" id="pwMsg"></span></div></div></details>`}
      </section>`;
  }
  document.addEventListener('click',async e=>{
    if(e.target.closest('#authLogout')){if(!(await askConfirm('Çıkış yapılsın mı?','Programdan çıkış yapılacak; tekrar kullanmak için e-posta ve şifrenizle giriş yapmanız gerekir.','Çıkış yap')))return;await api.auth.logout();return;}
    if(e.target.closest('#pwChange')){const m=$('#pwMsg');const a=$('#pw_new').value;
      if(a!==$('#pw_new2').value){m.textContent='Yeni şifreler aynı değil.';return;}
      try{await api.auth.change({current:$('#pw_cur').value,next:a});['#pw_cur','#pw_new','#pw_new2'].forEach(s=>$(s).value='');m.textContent='Şifre değiştirildi.';}catch(x){m.textContent=cleanErr(x);}}
    if(e.target.closest('#adminOpen')){closeReg();if(await licenseGate('yonetim'))window.__enterModule('yonetim');}
  });

  /* ---- Luca'ya fiş aktarımı (kullanıcı onayıyla) + mükerrer koruması + rapor ---- */
  const dmy=d=>pad(d.getDate())+'/'+pad(d.getMonth()+1)+'/'+d.getFullYear();
  const aktLog=fid=>(((Store.cache||{}).aktarim||{})[fid])||{keys:{},batches:[]};
  function aktKeys(){
    const cnt={},m=new Map();
    for(const r of S.rows){const f=S.files.find(x=>x.id===r.fileId);const code=f?((accts()[f.bankIdx]||{}).code||''):'';
      const base=[S.mode,code,isoOf(r.date),Number(r.amtRaw!=null?r.amtRaw:r.amt).toFixed(2),N(r.desc).slice(0,120),r.doc||''].join('|');
      cnt[base]=(cnt[base]||0)+1;m.set(r.id,base+'#'+cnt[base]);}
    return m;
  }
  let aktKeyCache=null;
  function aktChip(r){
    if(isExample())return '';const log=aktLog(S.firmId);if(!log||!Object.keys(log.keys).length)return '';
    if(!aktKeyCache||aktKeyCache.n!==S.rows.length||aktKeyCache.mode!==S.mode)aktKeyCache={n:S.rows.length,mode:S.mode,m:aktKeys()};
    const k=log.keys[aktKeyCache.m.get(r.id)];
    return k?` <span class="chip kural" title="${esc('Luca\'ya aktarıldı · '+new Date(k.at).toLocaleString('tr-TR'))}">Luca fiş ${esc(k.n||'')}</span>`:'';
  }
  window.__aktChip=aktChip;
  function aktarButtons(enabled){
    const n=isExample()?0:aktLog(S.firmId).batches.length;
    return `<button class="btn ic-link" id="lucaAktarBtn" ${enabled?'':'disabled'} title="Fişleri bağlı Luca oturumunuza muhasebe fişi olarak keser">Luca'ya aktar</button>${n?`<button class="btn ghost ic-list" id="aktGecmisBtn">Aktarım raporları <span class="count">${n}</span></button>`:''}`;
  }
  function buildFisJson(){
    const {fisler,lines}=buildLuca();const bt=S.belgeTuru||'';
    const by=new Map();for(const L of lines){if(!by.has(L.fis_))by.set(L.fis_,[]);by.get(L.fis_).push(L);}
    return fisler.map(F=>{const ls=by.get(F)||[];const b=r2(ls.reduce((s,l)=>s+l.b,0)),c=r2(ls.reduce((s,l)=>s+l.c,0));
      return {F,rows:F.rows,year:ls[0].date.getFullYear(),date:ls[0].date,desc:ls[0].fdesc,b,c,
        json:{fisNo:String(F.no),fisTarihi:dmy(ls[0].date),fisAciklama:ls[0].fdesc,fisTipi:'3',borc:b,alacak:c,taslakId:'',
          detaylar:ls.map(L=>({hesapKodu:String(L.acc||'').trim(),evrakNo:bt?(String(L.doc||'').slice(0,50)||null):null,evrakTarihi:bt?dmy(L.docDate):null,
            ...(()=>{const kod=L.pb&&L.kur?lucaDovizKod(L.pb):null;if(kod)return {borc:L.b?r2(L.b):null,alacak:L.c?r2(L.c):null,miktar:null,belgeTuru:bt||null,doviz:kod,kur:L.kur,dovizTutar:r2(L.dvz),detayAciklama:L.desc||null,tcVergiNo:null};
              const ek=L.pb&&L.kur?` (${fmt(r2(L.dvz))} ${L.pb} x ${String(L.kur).replace('.',',')})`:'';   // döviz numarası yok: TL satır, döviz bilgisi açıklamada
              return {borc:L.b?r2(L.b):null,alacak:L.c?r2(L.c):null,miktar:null,belgeTuru:bt||null,doviz:'0',kur:null,dovizTutar:null,detayAciklama:((L.desc||'').slice(0,250-ek.length)+ek)||null,tcVergiNo:null};})()}))}};});
  }
  function openAkt(title){mode='aktar';$('#lucaModal').hidden=false;document.documentElement.style.overflow='hidden';$('#lucaTitle').textContent=title;}
  let aktStop=false;
  async function lucaAktar(){
    if(isExample()){toast('Örnek firma Luca\'ya aktarılamaz.');return;}
    const f=S.firm;
    if(!f.lucaId){toast('Bu firma Luca\'dan eklenmemiş. Önce "Luca\'dan firma ekle" ile ekleyin.');return;}
    await refreshLuca();
    if(!luca.loggedIn){openLuca('connect');LucaBag.uyar('Önce Luca\'ya bağlanın (üst şeritteki "Luca\'ya giriş"), sonra tekrar "Luca\'ya aktar" deyin.');return;}
    try{await kurHazirla();}catch(e){toast(cleanErr(e));return;}
    {const pbs=dovizPBler();if(pbs.some(pb=>!lucaDovizKod(pb)))await dovizKodBul(true);}
    const keys=aktKeys();const log=aktLog(f.id);
    const act=S.rows.filter(r=>!r.skip&&inPeriod(r));
    const done=act.filter(r=>log.keys[keys.get(r.id)]);
    const draw=withDone=>{
      const saved=done.map(r=>r.skip);if(!withDone)done.forEach(r=>r.skip=true);
      let fs=[];try{fs=buildFisJson();}finally{done.forEach((r,i)=>r.skip=saved[i]);}
      return fs;
    };
    const render=withDone=>{
      const fs=draw(withDone);const b=r2(fs.reduce((s,x)=>s+x.b,0)),c=r2(fs.reduce((s,x)=>s+x.c,0));
      const nl=fs.reduce((s,x)=>s+x.json.detaylar.length,0);
      const tumKod=[...new Set(fs.flatMap(x=>x.json.detaylar.map(d=>d.hesapKodu)))];const yeniK=tumKod.filter(k=>taslakMi(k,f.id));
      const miss=S.miz?tumKod.filter(k=>!S.miz.byCode.has(k)&&!yeniK.includes(k)):[];
      const years=[...new Set(fs.map(x=>x.year))];
      const dvzL=buildLuca().lines.filter(l=>l.pb);const dvzPB=[...new Set(dvzL.map(l=>l.pb))];
      const kurYok=dvzL.some(l=>l.kurYok);const kodYok=dvzPB.filter(pb=>!lucaDovizKod(pb));
      const dvzEngel=kurYok;   // döviz numarası okunamazsa engel değil: dövizli satırlar TL tutarıyla gider, döviz tutarı ve kur açıklamaya yazılır
      const dn=done.map(r=>log.keys[keys.get(r.id)].n).filter((v,i,a)=>a.indexOf(v)===i);
      body().innerHTML=`<div class="banner" style="margin:0"><b>${esc(f.name)}</b> firmasına, bağlı olduğunuz Luca oturumunda <b>muhasebe (mahsup) fişi</b> kesilecek.</div>
        <div class="stats" style="margin:0">${[['Fiş',fs.length],['Fiş satırı',nl],['Borç',fmt(b)],['Alacak',fmt(c)],['Dönem',years.join(', ')||'—']].map(([k,v])=>`<div class="stat"><div class="k">${k}</div><div class="v">${v}</div></div>`).join('')}</div>
        <div class="checks">
          <div class="${Math.abs(b-c)<0.005?'ok':'err'}">${Math.abs(b-c)<0.005?'✓':'✕'} Borç ${fmt(b)} ${Math.abs(b-c)<0.005?'=':'≠'} Alacak ${fmt(c)}</div>
          <div>! Kayıt türü: ${esc(ML().p1)} · ${esc(periodText())} · belge türü ${esc(S.belgeTuru||'boş')}</div>
          ${done.length?`<div class="${withDone?'err':''}">${withDone?'✕':'!'} ${done.length} hareket daha önce Luca'ya aktarılmış (fiş ${esc(dn.slice(0,6).join(', '))}${dn.length>6?'…':''}). ${withDone?'<b>Yine de tekrar aktarılacak — Luca\'da mükerrer kayıt oluşur.</b>':'Bunlar bu aktarıma alınmadı.'}</div>`:''}
          ${dvzPB.length?`<div class="${dvzEngel?'err':''}">${dvzEngel?'✕':'!'} Dövizli fiş satırları: ${esc(dvzPB.join(', '))} — TCMB döviz alış kuru (işlem tarihinden önceki iş günü), para birimi ve döviz tutarı yazılır.${kurYok?' <b>Bazı hareketlerin kuru alınamadı.</b>':''}${kodYok.length?` Luca'nın ${esc(kodYok.join(', '))} döviz numarası okunamadı: bu satırlar TL tutarlarıyla kaydedilir, döviz tutarı ve kur satır açıklamasına yazılır (döviz bakiyesi de izlenecekse “Luca Excel'ini oluştur” ile aktarın).`:''}</div>`:''}
          ${yeniK.length?`<div>! ${yeniK.length} yeni cari (${esc(yeniK.slice(0,6).join(', '))}${yeniK.length>6?'…':''}) fişlerden önce Luca hesap planına açılacak.</div>`:''}
          ${miss.length?`<div class="err">✕ ${miss.length} hesap kodu mizanda yok: ${esc(miss.slice(0,8).join(', '))}${miss.length>8?'…':''}. Luca'da açılmamışsa o fişler hata verir.</div>`:''}
        </div>
        ${done.length?`<label style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="aktWithDone" ${withDone?'checked':''}> Daha önce aktarılanları da tekrar aktar</label>`:''}
        <div class="actions" style="justify-content:flex-end"><button class="btn" data-lclose="1">Vazgeç</button><button class="btn primary" id="aktGo" ${fs.length&&Math.abs(b-c)<0.005&&!dvzEngel?'':'disabled'}>Luca'ya aktar (${fs.length} fiş)</button></div>
        <p class="note" style="margin:0">Fişler tek tek gönderilir; Luca her fiş için kendi fiş numarasını verir. Aktarılan hareketler işaretlenir, aynı hareket ikinci kez aktarılmaz.</p>`;
      $('#aktWithDone')&&($('#aktWithDone').onchange=e=>render(e.target.checked));
      $('#aktGo').onclick=()=>runAkt(fs,keys);
    };
    openAkt('Luca\'ya fiş aktarımı');render(false);
  }
  async function runAkt(fs,keys){
    const f=S.firm;
    {const kodlar=fs.flatMap(x=>x.json.detaylar.map(d=>d.hesapKodu));
      if(kodlar.some(k=>taslakMi(k,f.id))){let t;try{t=await HESAP.taslakHazirla(f,kodlar);}catch(e){toast(cleanErr(e));return;}
        if(!t.ok){toast(t.iptal?'Yeni cariler açılmadığı için aktarım yapılmadı.':`Şu hesaplar Luca'da açılamadı: ${t.hata.join(', ')} — aktarım yapılmadı.`);reassign();renderAll();return;}
        for(const x of fs)for(const d of x.json.detaylar)if(t.degis.has(d.hesapKodu))d.hesapKodu=t.degis.get(d.hesapKodu);
        for(const r of S.rows)if(t.degis.has(r.acc)){r.acc=t.degis.get(r.acc);}
        for(const r of S.rows)if(r.src==='yeni'&&!taslakMi(r.acc,f.id)){r.src='cari';}}}
    busy=true;aktStop=false;
    const batch={id:uid(),at:new Date().toISOString(),firm:f.name,lucaId:f.lucaId,kind:ML().p1,period:periodText(),fisler:fs.map(x=>({no:x.json.fisNo,date:isoOf(x.date),desc:x.desc,b:x.b,c:x.c,n:x.json.detaylar.length,st:'bekliyor'}))};
    const draw=()=>{const ok=batch.fisler.filter(x=>x.st==='ok').length,er=batch.fisler.filter(x=>x.st==='hata').length;
      body().innerHTML=`<div class="stats" style="margin:0">${[['Gönderilen',ok+er+' / '+fs.length],['Kesildi',ok],['Hata',er]].map(([k,v])=>`<div class="stat"><div class="k">${k}</div><div class="v">${v}</div></div>`).join('')}</div>
      <div class="pick">${batch.fisler.map(x=>`<label class="${x.st==='ok'?'done':''}"><span>${x.st==='ok'?'✓':x.st==='hata'?'✕':x.st==='gönderiliyor'?'…':'·'}</span><span>${esc(fmtD(isoToDate(x.date)))} · ${esc(x.desc)} · ${fmt(x.b)}</span><span class="st ${x.st==='ok'?'ok':x.st==='hata'?'err':''}">${x.st==='ok'?'Luca fiş '+esc(x.lucaNo):x.st==='hata'?esc(x.msg):esc(x.st)}</span></label>`).join('')}</div>
      <div class="actions" style="justify-content:flex-end">${busy?'<button class="btn" id="aktStopBtn">Durdur</button>':''}</div>`;
      const sb=$('#aktStopBtn');if(sb)sb.onclick=()=>{aktStop=true;sb.disabled=true;sb.textContent='Bu fişten sonra duracak…';};};
    draw();
    const prep={};
    try{
      for(let i=0;i<fs.length;i++){
        if(aktStop){for(let j=i;j<fs.length;j++)batch.fisler[j].st='durduruldu';break;}
        const x=fs[i],it=batch.fisler[i];it.st='gönderiliyor';draw();
        try{
          if(!prep[x.year]){prep[x.year]=await api.luca.prepareFis({lucaId:f.lucaId,year:x.year});batch.lucaFirm=prep[x.year].firmLabel;}
          const r=await api.luca.fisKes({donemId:prep[x.year].donemId,fis:x.json});
          if(r.ok){it.st='ok';it.lucaNo=r.fisNo;it.lucaId=r.fisId;
            const ks={};for(const row of x.rows){const k=keys.get(row.id);if(k)ks[k]={n:r.fisNo,id:r.fisId,at:new Date().toISOString(),b:batch.id};}
            await op('logAktarim',{fid:f.id,keys:ks,batch});}
          else{it.st='hata';it.msg=r.error||'Hata';await op('logAktarim',{fid:f.id,keys:{},batch});}
        }catch(err){it.st='hata';it.msg=cleanErr(err);
          if(/oturum|NO_SESSION|dönemi|bulunamadı|karşılığı/i.test(it.msg)){for(let j=i+1;j<fs.length;j++){batch.fisler[j].st='hata';batch.fisler[j].msg='gönderilmedi';}await op('logAktarim',{fid:f.id,keys:{},batch}).catch(()=>{});break;}}
        draw();
      }
    }finally{busy=false;aktKeyCache=null;}
    batch.done=true;await op('logAktarim',{fid:f.id,keys:{},batch}).catch(()=>{});
    {const okN=batch.fisler.filter(x=>x.st==='ok').length;if(okN)gunlukYaz('banka',f,{adet:okN,tutar:batch.fisler.filter(x=>x.st==='ok').reduce((t,x)=>t+(+x.b||0),0),ad:`${batch.kind} · ${batch.period}`,nolar:batch.fisler.filter(x=>x.st==='ok').map(x=>x.lucaNo||x.no).slice(0,20)});}
    S.exportParts=null;renderTable();renderOut();
    showReport(batch);
  }
  function reportAoa(b){
    const h=['Program fiş no','Luca fiş no','Fiş tarihi','Fiş açıklaması','Satır','Borç','Alacak','Durum','Mesaj'];
    return [[`Luca aktarım raporu · ${b.firm}${b.lucaFirm?' (Luca: '+b.lucaFirm+')':''} · ${new Date(b.at).toLocaleString('tr-TR')} · ${b.kind} · ${b.period}`],[],h,
      ...b.fisler.map(x=>[x.no,x.lucaNo||'',fmtD(isoToDate(x.date)),x.desc,x.n,x.b,x.c,x.st==='ok'?'Kesildi':x.st==='hata'?'Hata':x.st,x.msg||'']),[],
      ['','','','Toplam (kesilen)',b.fisler.filter(x=>x.st==='ok').reduce((s,x)=>s+x.n,0),r2(b.fisler.filter(x=>x.st==='ok').reduce((s,x)=>s+x.b,0)),r2(b.fisler.filter(x=>x.st==='ok').reduce((s,x)=>s+x.c,0))]];
  }
  function showReport(b){
    openAkt('Luca aktarım raporu');
    const ok=b.fisler.filter(x=>x.st==='ok'),er=b.fisler.filter(x=>x.st!=='ok');
    const nos=ok.map(x=>x.lucaNo).filter(Boolean);
    body().innerHTML=`<div class="banner" style="margin:0"><b>${esc(b.firm)}</b>${b.lucaFirm?' · Luca: '+esc(b.lucaFirm):''} · ${esc(new Date(b.at).toLocaleString('tr-TR'))}<br>${esc(b.kind)} · ${esc(b.period)}${b.removed?' · <b>kayıttan silindi</b>':''}</div>
      <div class="stats" style="margin:0">${[['Kesilen fiş',ok.length],['Hatalı / gönderilmeyen',er.length],['Luca fiş no',nos.length?(nos.length>1?nos[0]+' – '+nos[nos.length-1]:nos[0]):'—'],['Borç = Alacak',fmt(r2(ok.reduce((s,x)=>s+x.b,0)))]].map(([k,v])=>`<div class="stat"><div class="k">${k}</div><div class="v">${v}</div></div>`).join('')}</div>
      <div class="tablewrap" style="max-height:46vh"><table><thead><tr><th>Fiş</th><th>Luca no</th><th>Tarih</th><th>Açıklama</th><th style="text-align:right">Satır</th><th style="text-align:right">Borç</th><th style="text-align:right">Alacak</th><th>Durum</th></tr></thead><tbody>
      ${b.fisler.map(x=>`<tr><td class="mono">${esc(x.no)}</td><td class="mono"><b>${esc(x.lucaNo||'')}</b></td><td class="mono">${esc(fmtD(isoToDate(x.date)))}</td><td>${esc(x.desc)}${x.st!=='ok'&&x.msg?`<div class="note" style="color:var(--out)">${esc(x.msg)}</div>`:''}</td><td class="amt mono">${x.n}</td><td class="amt mono">${fmt(x.b)}</td><td class="amt mono">${fmt(x.c)}</td><td>${x.st==='ok'?'<span class="chip kural">kesildi</span>':`<span class="chip aski">${esc(x.st)}</span>`}</td></tr>`).join('')}
      </tbody></table></div>
      <div class="actions" style="justify-content:space-between"><span>${ok.length&&!b.removed?`<button class="btn small ghost danger" id="aktUnlog">Luca'da bu fişleri sildim, işaretleri kaldır</button>`:''}</span>
      <span class="actions"><button class="btn" id="aktXls">Raporu Excel olarak kaydet</button><button class="btn primary" data-lclose="1">Kapat</button></span></div>`;
    $('#aktXls').onclick=async()=>{const ws=XLSX.utils.aoa_to_sheet(reportAoa(b));ws['!cols']=[{wch:12},{wch:12},{wch:12},{wch:44},{wch:7},{wch:14},{wch:14},{wch:10},{wch:50}];const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'Aktarım raporu');
      const buf=XLSX.write(wb,{type:'array',bookType:'xlsx'});const slug=N(b.firm).toLowerCase().replace(/ /g,'-').slice(0,30);
      try{await S.dl.save({filename:`${slug}_luca-aktarim-raporu_${b.at.slice(0,10)}.xlsx`,data:new Blob([buf])});toast('Rapor kaydedildi.');}catch(e){toast('Kaydedilmedi.');}};
    const ub=$('#aktUnlog');if(ub)ub.onclick=async()=>{
      if(!(await askConfirm('İşaretler kaldırılsın mı?',`Bu aktarımdaki ${ok.length} fişin (${nos.join(', ')}) hareketleri "aktarıldı" işaretinden çıkarılacak ve tekrar aktarılabilecek. Bunu yalnızca bu fişleri Luca'dan sildiyseniz yapın.`,'Evet, kaldır')))return;
      const log=aktLog(S.firmId);const ks=Object.keys(log.keys).filter(k=>log.keys[k].b===b.id);
      b.removed=true;await op('unlogAktarim',{fid:S.firmId,keys:ks});await op('logAktarim',{fid:S.firmId,keys:{},batch:b});aktKeyCache=null;renderTable();renderOut();showReport(b);toast('İşaretler kaldırıldı.');};
  }
  function showHistory(){
    const bs=aktLog(S.firmId).batches;openAkt('Aktarım raporları · '+S.firm.name);
    body().innerHTML=bs.length?`<div class="pick">${bs.map((b,i)=>{const ok=b.fisler.filter(x=>x.st==='ok');const nos=ok.map(x=>x.lucaNo);return `<label data-aktrep="${i}" style="grid-template-columns:minmax(0,1fr) auto"><span><b>${esc(new Date(b.at).toLocaleString('tr-TR'))}</b> · ${esc(b.kind)} · ${esc(b.period)}<br><span class="note">${ok.length} fiş kesildi${nos.length?' ('+esc(nos[0])+(nos.length>1?' – '+esc(nos[nos.length-1]):'')+')':''}${b.fisler.length>ok.length?' · '+(b.fisler.length-ok.length)+' hatalı':''}${b.removed?' · işaretler kaldırıldı':''}</span></span><span class="st">Raporu aç ›</span></label>`;}).join('')}</div>`:'<p class="note">Bu firma için henüz aktarım yok.</p>';
    body().querySelectorAll('[data-aktrep]').forEach(el=>el.onclick=()=>showReport(bs[+el.dataset.aktrep]));
  }
  document.addEventListener('click',e=>{
    if(e.target.closest('#lucaAktarBtn')){lucaAktar();return;}
    if(e.target.closest('#aktGecmisBtn')){showHistory();return;}
  });

  return {openLuca,modlar:()=>mods,modState,pullMizan,authGate,ensureSetup,moduleGate,lucaLabel,lucaClass,licenseGate,renderLicenseFoot,refreshLuca,lucaAyarla,firmMizanButton,aktarButtons,aktChip,choose};
})();

/* ---------- Fatura Kontrol modülü (Python fatura_kontrol; program içinde arka planda çalışır) ---------- */
const FKUI=(()=>{
  let started=false,url=null;
  function mount(){
    if($('#fkPanel'))return;
    const sec=document.createElement('div');sec.id='fkPanel';sec.hidden=true;
    sec.innerHTML=`<nav class="fknav" id="fkNav" aria-label="Muhasebe işlemleri">
        <button class="btn small" data-fksayfa="toplu" aria-pressed="true">Toplu Kontrol</button>
        <button class="btn small" data-fksayfa="tek" aria-pressed="false">Tek Firma / Dosyadan Kontrol</button>
        <button class="btn small" data-fksayfa="fis" aria-pressed="false">Fiş Girişi</button>
        <button class="btn small" data-fksayfa="fisl" aria-pressed="false">Fiş Listesi</button>
        <button class="btn small" data-fksayfa="kdv" aria-pressed="false">KDV Beyannamesi</button></nav>
      <section id="fgPanel" class="fgpanel" hidden></section>
      <section id="flPanel" class="fgpanel" hidden></section>
      <div class="fkwait" id="fkWait"><div><img class="bimg" alt=""><b id="fkWaitT">Fatura Kontrol açılıyor…</b><p class="note" id="fkWaitN">İlk açılış birkaç saniye sürebilir.</p>
      <div class="actions" id="fkWaitA" hidden><button class="btn primary" id="fkRetry">Yeniden dene</button></div></div></div>
      <iframe id="fkFrame" title="Fatura Kontrol" hidden></iframe>`;
    document.body.appendChild(sec);
    $('#fkRetry').addEventListener('click',()=>{started=false;start(true);});
    window.addEventListener('resize',place);window.addEventListener('mw-hiza',place);
    $('#fkNav').addEventListener('click',e=>{const b=e.target.closest('[data-fksayfa]');if(b)sayfaAc(b.dataset.fksayfa);});
  }
  // Muhasebe İşlemleri alt sayfaları: Toplu Kontrol / Tek Firma (Fatura Kontrol penceresi), Fiş Girişi, KDV Beyannamesi
  let sayfa='toplu';
  function sayfaAc(k){sayfa=k;document.querySelectorAll('#fkNav [data-fksayfa]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.fksayfa===k)));
    const ifr=k!=='fis'&&k!=='fisl';
    $('#fgPanel').hidden=k!=='fis';$('#flPanel').hidden=k!=='fisl';
    if(!ifr){$('#fkFrame').hidden=true;$('#fkWait').hidden=true;document.body.classList.remove('fk-tek');if(k==='fis')FISG.show();else FISL.show();return;}
    if(!started||!url){$('#fkWait').hidden=false;start();return;}
    const f=$('#fkFrame');f.hidden=false;$('#fkWait').hidden=true;
    if(ifSayfa!==k){ifSayfa=k;f.src=url+SAYFA_YOL[k];}}
  const SAYFA_YOL={toplu:'/toplu',tek:'/',kdv:'/beyanname'};
  let ifSayfa='toplu';
  function place(){const p=$('#fkPanel');if(!p||p.hidden)return;const h=hizaKutu();
    if(h&&document.body.classList.contains('mod-fatura')){p.style.left=h.sol+'px';p.style.right=h.sag+'px';p.style.top=(h.alt+12)+'px';return;}
    p.style.left='';p.style.right=sagPay()+'px';const t=$('#modeTabs');const r=t?t.getBoundingClientRect():{bottom:0};p.style.top=Math.max(0,Math.round(r.bottom+6))+'px';}
  function wait(t,n,err){$('#fkWait').hidden=false;$('#fkFrame').hidden=true;$('#fkWaitT').textContent=t;$('#fkWaitN').textContent=n||'';$('#fkWaitA').hidden=!err;$('#fkWaitN').classList.toggle('mono',!!err);}
  async function start(restart){
    if(started&&url)return;
    wait('Fatura Kontrol açılıyor…','İlk açılış birkaç saniye sürebilir.');
    try{
      const api=window.desktop&&window.desktop.fk;if(!api)throw new Error('Bu bölüm yalnız MuhaWin masaüstü programında çalışır.');
      const r=restart?await api.restart():await api.start();
      url=r.url;started=true;
      const f=$('#fkFrame');ifSayfa=(sayfa==='fis'||sayfa==='fisl')?'toplu':sayfa;f.src=url+SAYFA_YOL[ifSayfa];f.hidden=sayfa==='fis'||sayfa==='fisl';$('#fkWait').hidden=true;
    }catch(e){started=false;url=null;wait('Fatura Kontrol açılamadı',String(e&&e.message||e).replace(/^Error invoking remote method '[^']+': (Error: )?/,''),true);}
  }
  function show(){mount();document.body.classList.add('fk-view');$('#fkPanel').hidden=false;document.querySelector('.app').hidden=true;
    const bb=$('#bottombar');if(bb)bb.hidden=true;const tb=$('#toolbar');if(tb)tb.hidden=true;place();
    if(sayfa==='fis'||sayfa==='fisl')setTimeout(()=>sayfaAc(sayfa),0);
    if(started&&url)syncFirms().then(r=>{if(r&&r.eklenen)post({tip:'firmalarYenile'});});
    start();}
  function hide(){document.body.classList.remove('fk-view','fk-tek');const p=$('#fkPanel');if(p)p.hidden=true;document.querySelector('.app').hidden=false;
    const bb=$('#bottombar');if(bb)bb.hidden=false;const tb=$('#toolbar');if(tb)tb.hidden=false;}
  // Tek firma kontrol sayfası: firma MuhaWin'in üstündeki ana firma seçiminden gelir
  // Tek firma kontrol: firma sayfadaki 1. adımdan seçilir; liste MuhaWin firmalarıdır ve seçim MuhaWin'in ana firmasını da değiştirir
  function firmaGonder(){const f=S.firm&&S.firm.id!==EXAMPLE_ID?S.firm:null;
    post({tip:'firma',mw:f?f.id:'',id:f&&f.lucaId?String(f.lucaId):'',ad:f?f.name:'',liste:(S.firms||[]).map(x=>({mw:x.id,id:x.lucaId?String(x.lucaId):'',ad:x.name}))});}
  function onFirm(){if(document.body.classList.contains('fk-tek')||ifSayfa==='kdv')firmaGonder();}
  firmaDinle(onFirm);
  let mvIs=false;
  async function muavinCek(m){
    if(mvIs)return;mvIs=true;const api=window.desktop;
    const durum=(x)=>post({tip:'muavinDurum',...x});
    try{await api.fk.muavinCek({id:String(m.id),ad:String(m.ad||''),ay:String(m.ay)});durum({calisiyor:true,mesaj:'Muavin Luca\'dan indiriliyor…'});
      const bekle=async()=>{let d={};try{d=await api.fk.topluDurum();}catch(e){}
        if(d.calisiyor){const il=d.ilerleme||{};durum({calisiyor:true,mesaj:(il.mesaj||'Muavin indiriliyor…')+(d.sessiz_sn>120?' — Chrome penceresinde açık bir uyarı olabilir':'')});setTimeout(bekle,3000);return;}
        mvIs=false;const s=(d.sonuclar||[]).find(x=>String(x.id)===String(m.id));const ok=!!(s&&(s.adimlar||[]).some(a=>a.kod==='muavin'&&a.durum==='tamam'));
        durum({bitti:true,ok,mesaj:ok?'✓ Muavin Luca\'dan alındı; “Luca\'dan çekilmiş muavin” seçildi.':'Muavin indirilemedi: '+(((d.gunluk||[]).slice(-1)[0])||'ayrıntı için Toplu Kontrol günlüğüne bakın')});};
      setTimeout(bekle,3000);
    }catch(e){mvIs=false;durum({bitti:true,ok:false,mesaj:clean(e)});}
  }
  function reset(){started=false;url=null;const f=$('#fkFrame');if(f)f.src='about:blank';}

  /* --- iframe ile haberleşme: tema, firma listesi, Luca'dan firma çekme --- */
  const frameWin=()=>{const f=$('#fkFrame');return f&&f.contentWindow;};
  const post=m=>{const w=frameWin();if(w)w.postMessage({muhawin:true,...m},'*');};
  const clean=e=>String(e&&e.message||e).replace(/^Error invoking remote method '[^']+': (Error: )?/,'');
  function fkTheme(){
    const map={muhawin:'muhawin',defter:'orman',grafit:'gece',kontrast:'lacivert',kum:'bordo',kirmizi:'kirmizi'};
    if(curSkin)return map[curSkin]||'muhawin';
    return window.matchMedia&&matchMedia('(prefers-color-scheme: dark)').matches?'gece':'muhawin';
  }
  // MuhaWin'de Luca'dan eklenmiş firmalar Fatura Kontrol'ün firma listesine eklenir (seçimler/notlar korunur)
  async function syncFirms(){
    const list=(S.firms||[]).filter(f=>f.lucaId).map(f=>({id:String(f.lucaId),ad:f.name,defter:f.defter||''}));
    if(!list.length)return null;
    try{return await window.desktop.fk.setFirms(list,false);}catch(e){return null;}
  }
  let pulling=false;
  async function pullFromLuca(){
    if(pulling)return;pulling=true;
    const api=window.desktop;          // kendi giriş bekleme akışı var; oturum sarmalayıcısı (yeniden giriş sorusu) kullanılmaz
    try{
      let st=await api.luca.status();
      if(st.wrongUye)throw new Error(st.error);
      if(!st.loggedIn){
        await api.luca.open();
        toast('Açılan Luca penceresinde giriş yapıp Mali Müşavir Paketi\'ni açın; firma listesi kendiliğinden gelecek.');
        const t0=Date.now();
        while(!st.loggedIn&&Date.now()-t0<15*60e3){await new Promise(r=>setTimeout(r,2000));st=await api.luca.status();if(st.wrongUye)throw new Error(st.error);}
        if(!st.loggedIn)throw new Error('Luca girişi yapılmadı. Tekrar deneyin.');
      }
      const list=await Busy.run('Firma listesi alınıyor…','Luca\'daki mükellef listesi okunuyor',()=>api.luca.firms());
      const r=await api.fk.setFirms(list.map(x=>({id:String(x.value),ad:String(x.label||'').trim()})),true);
      post({tip:'cekBitti'});
      toast(`Luca'dan ${r.toplam} firma alındı${r.eklenen?` (${r.eklenen} yeni)`:''}.`);
      if(typeof Desk!=='undefined')Desk.refreshLuca();
    }catch(e){post({tip:'cekBitti',hata:clean(e)});}
    finally{pulling=false;}
  }
  // Rapordaki "Luca'da aç" (Görev 37): Luca'da Fiş Listesi o fiş numarasıyla süzülmüş açılır; fişe dokunulmaz
  async function lucaFisAc(d){const lucaId=String(d.lucaId||''),year=String(d.yil||''),fisNo=String(d.fisNo||'');
    if(!lucaId){toast('Firmanın Luca karşılığı yok. Firmayı Ayarlar › Firmalar › "Luca\'dan firma ekle" ile ekleyin.');return;}
    if(!fisNo){toast('Bu satırın Luca fişi yok.');return;}
    try{await LucaBag.bekle();
      await mwBusy.run('Luca\'da fiş açılıyor…',`Fiş ${fisNo} · ${year}`,()=>window.__mwApi.luca.fisGoster({lucaId,year,fisNo}));
      toast(`Luca'da Fiş Listesi ${fisNo} numaralı fişle açıldı. Fişe girip kendiniz işlem yapabilirsiniz.`);}
    catch(x){toast(clean(x));}}
  let bekleyenYenile=null;
  function muavinYenile(id,ay){if(started&&url){post({tip:'muavinYenile',id,ay});}else{bekleyenYenile={id,ay};start();}}
  function sonucYenile(ay){if(started&&url)post({tip:'sonucYenile',ay});}
  const fkOrigin=()=>{try{return url?new URL(url).origin:null;}catch(x){return null;}};
  window.addEventListener('message',async e=>{
    if(!e.data||!e.data.fk||(e.source!==frameWin()&&e.origin!==fkOrigin()))return;
    if(e.data.tip==='faturaKaydet'&&e.data.id){FKAYIT.open(String(e.data.id));return;}
    if(e.data.tip==='lucaFisAc'){lucaFisAc(e.data);return;}
    if(e.data.tip==='defterKaydet'&&Array.isArray(e.data.liste)){   // Toplu kontrol › Firmalar: defter türü değişti → MuhaWin firma ayarına da yazılır
      for(const x of e.data.liste){const f=(S.firms||[]).find(y=>String(y.lucaId||'')===String(x.id));if(!f||(f.defter||'')===(x.defter||''))continue;
        const y={...f,defter:x.defter||'',defterOto:false};try{await Store.saveFirm(y);const i=S.firms.findIndex(z=>z.id===y.id);if(i>=0)S.firms[i]=y;}catch(err){}}
      return;}
    if(e.data.tip==='firmaSec'){const id=String(e.data.mw||'');if(id&&S.firms.some(x=>x.id===id)&&S.firmId!==id){await selectFirm(id);renderFirmSel();}else firmaGonder();return;}
    if(e.data.tip==='tekHazir'){sayfa='tek';ifSayfa='tek';document.querySelectorAll('#fkNav [data-fksayfa]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.fksayfa==='tek')));document.body.classList.add('fk-tek');post({tip:'tema',tema:fkTheme()});firmaGonder();return;}
    if(e.data.tip==='esc'){if(!document.querySelector(ESC_ACIK))geri();return;}
    if(e.data.tip==='ctrlF'){try{KOMUT.ac();}catch(x){}return;}
    if(e.data.tip==='muavinCek'){muavinCek(e.data);return;}
    if(e.data.tip==='pdfMetin'){const kid=e.data.kid;try{const pdfjsLib=await pdfKutuphane();
        const pdf=await pdfjsLib.getDocument({data:new Uint8Array(e.data.buf),isEvalSupported:false}).promise;const parcalar=[];
        for(let i=1;i<=Math.min(pdf.numPages,40);i++){const pg=await pdf.getPage(i);const tc=await pg.getTextContent();
          // satırları y konumuna göre birleştir (etiket ile tutar aynı satırda kalsın)
          const satir=new Map();for(const it of tc.items){if(!it.str)continue;const y=Math.round((it.transform?it.transform[5]:0)/3);if(!satir.has(y))satir.set(y,[]);satir.get(y).push({x:it.transform?it.transform[4]:0,s:it.str});}
          for(const y of [...satir.keys()].sort((a,b)=>b-a))parcalar.push(satir.get(y).sort((a,b)=>a.x-b.x).map(z=>z.s).join(' '));}
        post({tip:'pdfMetinSonuc',kid,metin:parcalar.join('\n')});}
      catch(x){post({tip:'pdfMetinSonuc',kid,hata:String(x&&x.message||x)});}return;}
    if(e.data.tip==='faturaPdf'&&e.data.id&&e.data.belge){faturaPdf(String(e.data.id),String(e.data.belge));return;}
    if(e.data.tip==='isletmeListeleri'){const geri=m=>{try{e.source.postMessage({muhawin:true,tip:'isletmeListeleriSonuc',...m},'*');}catch(x){}};
      try{const st=await window.desktop.luca.status();if(!st.loggedIn){await window.desktop.luca.open();geri({hata:"Luca penceresi açıldı: giriş yapıp işletme defteri fiş giriş ekranını açın, sonra yeniden 'Luca listelerini al'a basın."});return;}
        const lid=String(e.data.lucaId||'')||String(((S.firms||[]).find(f=>f.id===S.firmId)||{}).lucaId||'');
        const L=await mwBusy.run('Luca listeleri alınıyor…','İşletme / serbest meslek defteri fiş ekranlarındaki açılır listeler okunuyor',()=>window.desktop.luca.isletmeListeleri({lucaId:lid,year:+e.data.yil||new Date().getFullYear()}));
        geri(L&&L.length?{listeler:L}:{hata:"Luca'da açılır liste bulunamadı. Luca'da Çalış penceresinde İşletme / Ser.Mes.Defteri → gider (ya da gelir) fiş giriş ekranını açıp tekrar basın. Yine gelmezse: Ayarlar → Luca → \"Luca İstek Kaydı\"nı başlatıp o ekranı açın, kaydı durdurun ve dosyayı geliştiriciye gönderin."});}
      catch(x){geri({hata:clean(x)});}return;}
    if(e.data.tip==='htmlPdf'){try{await mwBusy.run('PDF hazırlanıyor…',e.data.ad||'',()=>window.desktop.htmlPdf({html:String(e.data.html||''),ad:String(e.data.ad||'Beyanname')}));}catch(x){toast(clean(x));}return;}
    if(e.data.tip==='beyanHazir'){sayfa='kdv';ifSayfa='kdv';document.querySelectorAll('#fkNav [data-fksayfa]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.fksayfa==='kdv')));document.body.classList.remove('fk-tek');firmaGonder();return;}
    if(e.data.tip==='hazir'){ifSayfa='toplu';if(sayfa==='tek'){sayfa='toplu';document.querySelectorAll('#fkNav [data-fksayfa]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.fksayfa==='toplu')));}document.body.classList.remove('fk-tek');post({tip:'tema',tema:fkTheme()});if(bekleyenYenile){post({tip:'muavinYenile',...bekleyenYenile});bekleyenYenile=null;}const r=await syncFirms();if(r&&r.eklenen)post({tip:'firmalarYenile'});}
    if(e.data.tip==='lucaFirmaCek')pullFromLuca();
  });
  // tema değişince Fatura Kontrol de uysun
  document.addEventListener('click',e=>{if(e.target.closest('[data-skin]'))setTimeout(()=>post({tip:'tema',tema:fkTheme()}),50);});
  return {show,hide,onFirm,reset,syncFirms,muavinYenile,sonucYenile,sayfaAc,_sayfa:()=>sayfa};
})();

/* ---------- başlangıç ---------- */
S.mode='bank';S.wsStore={};S.allRules=S.rules.slice();
S.fisDesc=lsGet('ekstre-luca-fisdesc',S.fisDesc);
S.belgeTuru=lsGet('ekstre-luca-belge','BE');
S.files=[];
rebuildRows();renderDatalist();renderAll();
// program her açılışta Banka Ekstreleri ile başlar; oturum içinde son seçilen (banka / kart) korunur
/* ---------- sayfalardaki "Luca'ya bağlan" düğmeleri ---------- */
/* Luca bağlantı durumu tek yerden: ana süreç durum değişince ("durum" olayı) ve 5 sn'de bir bakılır; programdaki bütün
   "Luca'ya bağlan" düğmeleri (her modül, panel, araç çubuğu) aynı anda yeşile döner. Bağlıyken düğme yeni giriş sayfası açmaz,
   açık Luca ekranını öne getirir. */
// Luca doğrulama kodu programda: Luca penceresi arka planda kalır, kodu kullanıcı okuyup yazar; program Luca'ya yazıp Giriş'e basar
function captchaKutu(d){let k=document.getElementById('lucaCap');
  // üst düzeyde: Desk / LucaBag içindeki api ve cleanErr burada görünmez (Görev 18: düğmeler "api is not defined" veriyordu)
  const api=window.desktop,cleanErr=e=>String(e&&e.message||e).replace(/^Error invoking remote method '[^']+': (Error: )?/,'');
  if(d.yok){if(k)k.remove();toast('Doğrulama kodu resmi alınamadı; Luca penceresinde girişi tamamlayın.');return;}
  if(!k){k=document.createElement('div');k.id='lucaCap';k.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:99999;display:flex;align-items:center;justify-content:center';
    k.innerHTML=`<div style="background:var(--bg,#fff);color:inherit;border-radius:12px;padding:20px;width:min(380px,92vw);box-shadow:0 10px 40px rgba(0,0,0,.3)">
      <h3 style="margin:0 0 6px">Luca doğrulama kodu</h3><div class="muted" id="lucaCapHata" style="font-size:13px;margin-bottom:8px"></div>
      <img id="lucaCapImg" alt="Doğrulama kodu" style="display:block;max-width:100%;min-height:40px;background:#fff;border:1px solid #ccc;border-radius:6px;margin:0 auto 10px">
      <input id="lucaCapKod" autocomplete="off" placeholder="Resimdeki kodu yazın" style="width:100%;box-sizing:border-box;padding:9px;font-size:16px">
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px;flex-wrap:wrap">
        <button class="btn" id="lucaCapVazgec" title="Kutuyu kapat (Luca girişi yapılmaz)">Vazgeç</button>
        <button class="btn" id="lucaCapGoster" title="Luca giriş penceresini ekrana getirir">Luca'yı göster</button>
        <button class="btn" id="lucaCapYenile">Yeni kod</button><button class="btn primary" id="lucaCapGir">Giriş</button></div></div>`;
    document.body.appendChild(k);
    const gir=async()=>{const kod=k.querySelector('#lucaCapKod').value.trim();if(!kod)return;const b=k.querySelector('#lucaCapGir');b.disabled=true;
      try{await api.luca.captchaGir(kod);k.remove();toast('Kod Luca\'ya girildi; bağlantı bekleniyor…');}catch(e){toast(cleanErr(e));}finally{b.disabled=false;}};
    k.querySelector('#lucaCapGir').onclick=gir;k.querySelector('#lucaCapKod').onkeydown=e=>{if(e.key==='Enter')gir();};
    k.querySelector('#lucaCapYenile').onclick=()=>{api.luca.captchaYenile().catch(()=>{});};
    k.querySelector('#lucaCapVazgec').onclick=()=>k.remove();
    k.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();k.remove();}});
    k.querySelector('#lucaCapGoster').onclick=()=>{api.luca.girisGoster().catch(()=>{});k.remove();};}
  k.querySelector('#lucaCapImg').src=d.resim||'';k.querySelector('#lucaCapHata').textContent=d.hata?('Luca: '+d.hata):'Kodu yazıp Giriş\'e basın; Luca ekrana gelmeden giriş yapılır.';
  const i=k.querySelector('#lucaCapKod');i.value='';setTimeout(()=>i.focus(),50);}
const LucaBag=(()=>{
  const api=window.desktop;let son={loggedIn:false},sorgu=null;
  function boya(d){son=d||{loggedIn:false};
    document.querySelectorAll('[data-lucabag]').forEach(b=>{b.classList.toggle('luca-on',!!son.loggedIn);b.classList.toggle('luca-off',!son.loggedIn);
      b.textContent=son.loggedIn?'● Luca bağlı':son.wrongUye?'Luca: yanlış üye no':'Luca\'ya giriş';b.title=son.error||(son.loggedIn?'Luca oturumu açık · Luca ekranını öne getir':'Luca giriş penceresini aç');
      if(son.loggedIn)b.classList.remove('vurgu');});
    try{if(typeof Desk!=='undefined'&&Desk.lucaAyarla&&Desk.lucaLabel()!==(son.loggedIn?'Luca bağlı':'Luca\'ya bağlan'))Desk.lucaAyarla(son);}catch(e){}
    modBoya();}
  async function yenile(){if(sorgu)return sorgu;
    sorgu=(async()=>{let d;try{d=await api.luca.status();}catch(e){d={loggedIn:false};}boya(d);return son;})();
    try{return await sorgu;}finally{sorgu=null;}}
  function modBoya(){
    // modül seçim ekranında yalnız durum yazar; Luca girişi tek yerden, üst şeritteki düğmeden yapılır
    const ml=document.getElementById('modLuca');
    if(ml){ml.hidden=false;ml.className='modluca'+(son.loggedIn?' bagli':'');
      ml.innerHTML=son.loggedIn?`<span>● <b>Luca bağlı</b> — fiş aktarımı, mizan / muavin çekme ve fatura kaydı hazır.</span>`
        :`<span><b>Luca bağlı değil.</b> ${son.wrongUye?esc(son.error||''):'Mizan / muavin çekme, fiş aktarımı ve fatura kaydı Luca oturumu ister. Modüle girdikten sonra üst şeritteki <b>Luca\'ya giriş</b> düğmesiyle bağlanın.'}</span>`;}}
  // Luca gerektiren işlem bağlantı yokken: açık uyarı + üst şeritteki giriş düğmesi vurgulanır (düğme tek; sayfalarda ayrı bağlan düğmesi yok)
  function uyar(msg){toast(msg||'Bu işlem için Luca\'ya bağlı olmalısınız. Üst şeritteki "Luca\'ya giriş" düğmesini kullanın.');
    const b=document.getElementById('lucaTopBtn');if(!b||son.loggedIn)return;b.classList.remove('vurgu');void b.offsetWidth;b.classList.add('vurgu');
    clearTimeout(uyar._t);uyar._t=setTimeout(()=>b.classList.remove('vurgu'),8000);}
  // Luca oturumu yoksa giriş penceresini açar ve bağlanana kadar bekler (en çok 15 dk)
  async function bekle(){let st=await yenile();if(st.loggedIn)return st;if(st.wrongUye)throw new Error(st.error);
    const ac=await api.luca.open();uyar('Luca bağlı değil. '+(ac&&ac.gizli?'Luca arka planda açılıyor; doğrulama kodu sorulursa açılan kutuya yazın.':'Luca penceresinde giriş yapıp Mali Müşavir Paketi\'ni açın; bağlanınca işlem kendiliğinden devam eder.')+' (Giriş düğmesi: üst şerit)');
    const t0=Date.now();while(!st.loggedIn&&Date.now()-t0<15*60e3){await new Promise(r=>setTimeout(r,2000));st=await yenile();if(st.wrongUye)throw new Error(st.error);}
    if(!st.loggedIn)throw new Error('Luca girişi yapılmadı.');return st;}
  document.addEventListener('click',async e=>{if(!e.target.closest('[data-lucabag]'))return;
    // bağlıysa yeniden giriş açılmaz: ana süreç açık Luca ekranını öne getirir
    try{const r=await api.luca.open();if(r&&r.bagli)boya({...son,loggedIn:true});}catch(x){}setTimeout(yenile,1500);});
  try{api.luca.on((ev,d)=>{if(ev==='durum'&&d){boya(d);if(d.loggedIn){const k=document.getElementById('lucaCap');if(k)k.remove();}}
    else if(ev==='muavineDon'){try{if(typeof MMUI!=='undefined')MMUI.open('muavin');}catch(x){}}   // Luca'da Çalış penceresindeki "Muavine dön"
    else if(ev==='captcha'){captchaKutu(d||{});}
    else yenile();});}catch(e){}
  setInterval(()=>{if(document.visibilityState!=='hidden')yenile();},5000);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState!=='hidden')yenile();});
  window.addEventListener('focus',()=>yenile());
  // ekranlar / modüller değişip yeni düğmeler çizildiğinde son durumla boyanır (bekletmeden)
  try{new MutationObserver(()=>{if(document.querySelector('[data-lucabag].luca-off')&&son.loggedIn||document.querySelector('[data-lucabag].luca-on')&&!son.loggedIn)boya(son);})
    .observe(document.body,{childList:true,subtree:true});}catch(e){}
  setTimeout(yenile,300);
  return {yenile,bekle,boya,uyar,durum:()=>son};
})();
window.__lucaBag=LucaBag;

/* ---------- veri eklenince mizan yoksa Luca'dan kendiliğinden çekilir (kullanıcının "Mizanı Luca'dan Çek"e basmasını beklemez) ---------- */
const mizanOtoDenendi=new Set();
function bankaEsleHepsi(){try{for(const f of S.files)if(!(f.esle&&f.esle.elle))bankaEsle(f);}catch(e){}}
async function mizanOtoCek(f,yil,sonra){
  if(!f||f.id===EXAMPLE_ID||!f.lucaId||f.mizanInfo||f.defter==='isletme'||f.defter==='serbest'||mizanOtoDenendi.has(f.id))return false;
  mizanOtoDenendi.add(f.id);
  yil=String(yil||new Date().getFullYear()).slice(0,4);
  const cek=async()=>{try{await Busy.run('Mizan Luca\'dan çekiliyor…',f.name+' · '+yil+' — hesaplar için mizan gerekiyor',()=>Desk.pullMizan(f,yil));toast(f.name+': mizan Luca\'dan kendiliğinden alındı.');return true;}
    catch(e){toast(f.name+': mizan alınamadı — '+String(e&&e.message||e).replace(/^Error invoking remote method '[^']+': (Error: )?/,'').slice(0,140));return false;}};
  let st={};try{st=await LucaBag.yenile();}catch(e){}
  if(st.loggedIn)return cek();
  // Luca bağlı değil: bağlanınca kendiliğinden çekilir (en çok 30 dk beklenir), sonra ekran yenilenir
  toast(f.name+' için mizan yok. Luca\'ya bağlandığınızda mizan kendiliğinden çekilecek.');
  (async()=>{const t0=Date.now();while(Date.now()-t0<30*60e3){await new Promise(r=>setTimeout(r,4000));let x={};try{x=await window.desktop.luca.status();}catch(e){}
      if(x.loggedIn){const fr=(()=>{try{return (Store.local().firms||{})[f.id];}catch(e){return null;}})()||f;if(fr.mizanInfo)return;if(await cek()&&typeof sonra==='function')try{await sonra();}catch(e){}return;}}})();
  return false;
}

/* ---------- firma silme: neyin silineceği sorulur ---------- */
// firmanın defter türü Fatura Kontrol'e (toplu kontrol: bilanço → muavin, işletme / serbest meslek → gelir-gider listesi)
function defterBildir(f){try{if(f&&f.lucaId&&window.desktop.fk)window.desktop.fk.setFirms([{id:String(f.lucaId),ad:f.name,defter:f.defter||''}],false).catch(()=>{});}catch(e){}}
function firmaSilSor(firmalar){
  const ad=firmalar.length===1?`"${firmalar[0].name}"`:`${firmalar.length} firma`;
  return new Promise(res=>{
    const m=$('#delFirmModal');
    $('#dfT').textContent=ad+' silinsin mi?';
    $('#dfB').innerHTML=`<p class="note" style="margin:0 0 10px">Firma programdan silinir; Luca'daki kayıtlara dokunulmaz. Firmayla birlikte silinecekleri seçin:</p>
      <label class="dfsec"><input type="checkbox" id="dfKural"> <span><b>Kuralları</b><small>Banka/kredi kartı eşleştirme kuralları ve fatura kuralları. Silinmezse firma yeniden eklendiğinde (aynı Luca firması) geri gelir.</small></span></label>
      <label class="dfsec"><input type="checkbox" id="dfMizan" checked> <span><b>Mizanı</b><small>Luca'dan çekilen mizan. Silinmezse firma yeniden eklendiğinde geri gelir.</small></span></label>
      <label class="dfsec"><input type="checkbox" id="dfMuavin"> <span><b>Muavinleri</b><small>Fatura – Muavin Kontrol için indirilen muavin dosyaları (tüm dönemler).</small></span></label>
      <label class="dfsec"><input type="checkbox" id="dfBelge"> <span><b>İndirilen faturalar ve kontrol raporları</b><small>Fatura – Muavin Kontrol'deki tüm dönem klasörü (muavinler dahil).</small></span></label>
      <div class="actions" style="justify-content:flex-end;margin-top:10px"><button class="btn" id="dfNo">Vazgeç</button><button class="btn dangerfill" id="dfYes">${firmalar.length===1?'Firmayı sil':'Firmaları sil'}</button></div>`;
    m.hidden=false;
    $('#dfBelge').onchange=e=>{if(e.target.checked)$('#dfMuavin').checked=true;};
    const done=v=>{m.hidden=true;res(v);};
    $('#dfNo').onclick=()=>done(null);
    $('#dfYes').onclick=()=>done({kurallar:$('#dfKural').checked,mizan:$('#dfMizan').checked,muavin:$('#dfMuavin').checked,belgeler:$('#dfBelge').checked});
  });
}
async function firmaSil(f,o){
  await Store.deleteFirm(f.id,o);
  if((o.muavin||o.belgeler)&&window.desktop.fk&&window.desktop.fk.firmaSil){
    const r=await window.desktop.fk.firmaSil({luca_id:f.lucaId||null,ad:f.name,muavin:!!o.muavin,belgeler:!!o.belgeler});
    if(r&&r.tamam===false)toast('Fatura Kontrol verisi silinemedi: '+r.hata);
  }
}

/* ---------- yükleme penceresi: uzun işlemlerde ("Mizan hazırlanıyor…") ---------- */
const Busy=(()=>{let n=0,t=null,iptal=null;const yigin=[];   // iç içe işler: biten iş bir öncekinin başlığını / düğmesini geri getirir
  function uygula(x){$('#mwBusyT').textContent=x.baslik||'Lütfen bekleyin…';$('#mwBusyS').textContent=x.alt||'Bu işlem birkaç saniye sürebilir.';
    iptal=(x.secenek&&x.secenek.iptal)||null;const b=$('#mwBusyIptal');if(b){b.hidden=!iptal;b.disabled=false;b.textContent=(x.secenek&&x.secenek.iptalAd)||'İptal';b.dataset.ad=(x.secenek&&x.secenek.iptalAd)||'';}}
  function show(baslik,alt,secenek){n++;const x={baslik,alt,secenek};yigin.push(x);uygula(x);
    clearTimeout(t);t=setTimeout(()=>{if(n>0)$('#mwBusy').hidden=false;},250);       // kısa işlemlerde hiç görünmez
    return x;}
  function hide(x){n=Math.max(0,n-1);const i=x?yigin.lastIndexOf(x):yigin.length-1;if(i>=0)yigin.splice(i,1);
    if(!n){clearTimeout(t);$('#mwBusy').hidden=true;iptal=null;yigin.length=0;}else if(yigin.length)uygula(yigin[yigin.length-1]);}
  function metin(alt){const s=$('#mwBusyS');if(s&&alt){s.textContent=alt;if(yigin.length)yigin[yigin.length-1].alt=alt;}}
  async function run(baslik,alt,fn,secenek){const x=show(baslik,alt,secenek);try{return await fn();}finally{hide(x);}}
  document.addEventListener('click',e=>{if(e.target.id==='mwBusyIptal'&&iptal){if(!e.target.dataset.ad){e.target.disabled=true;e.target.textContent='İptal ediliyor…';}try{iptal();}catch(x){}}});
  return {show,hide,run,metin};})();
window.mwBusy=Busy;

/* ---------- Mizan / Muavin görüntüleme: sıralama, sütun filtresi, arama, toplamlar ---------- */
/* ---------- Muavinden muhasebe fişleri (2.9.3) ----------
   Fiş = aynı fiş numarası. Devir / nakli yekün gibi numarasız satırlar fiş sayılmaz. Aynı numara farklı tarih / fiş tipinde
   ayrı ayrı denk fişler oluşturuyorsa (numaralandırma ay ya da tip bazında yeniden başlıyorsa) ayrı fiş kabul edilir; aksi
   hâlde tek fişte toplanır. Birden çok muavin dosyasından gelen aynı satır ve üst hesapta tekrarlanan alt hesap satırı bir kez sayılır. */
const fisNoN=x=>String(x??'').trim().replace(/\.0+$/,'').replace(/\s+/g,' ');
// nazım hesap çifti (KKEG izleme): 950'de (borç) ve 951'de (alacak) aynı adlı alt hesaplar. kodlar: alt hesap kodları, adF: kod → ad
const nzTok=a=>N(a).split(' ').filter(t=>t.length>=3&&!/^(VE|ILE|HESABI|HESAP|GIDER|GIDERI|GIDERLERI)$/.test(t));
function nazimCiftBul(kodlar,adF,re,refAd){
  const L=[...kodlar].sort((a,b)=>a.localeCompare(b,'tr',{numeric:true}));const l950=L.filter(c=>c.startsWith('950')),l951=L.filter(c=>c.startsWith('951'));
  if(!l950.length||!l951.length)return null;
  const ref=nzTok(refAd||'');const puan=c=>{const t=nzTok(adF(c));return (re&&re.test(N(adF(c)))?10:0)+ref.filter(x=>t.includes(x)).length;};
  const en=l=>l.map(c=>[c,puan(c)]).filter(x=>x[1]>0).sort((a,b)=>b[1]-a[1])[0];
  const a=en(l950);if(!a)return null;const ad=N(adF(a[0]));
  const b=l951.find(c=>N(adF(c))===ad)||(en(l951)||[])[0];if(!b)return null;
  return [a[0],b];}
function fisGrupla(satirlar){
  const r2_=v=>Math.round(v*100)/100;
  const by=new Map();
  (satirlar||[]).forEach((r,i)=>{const no=fisNoN(r.fis_no);if(!no||/^(DEV[İI]R|DEVREDEN|NAKL[İI]|AÇILIŞ DEV)/i.test(no))return;
    if(!by.has(no))by.set(no,[]);by.get(no).push({...r,_i:i});});
  const denk=L=>Math.abs(L.reduce((t,x)=>t+(+x.borc||0)-(+x.alacak||0),0))<0.01;
  const bol=(L,f)=>{const m=new Map();for(const x of L){const k=f(x);if(!m.has(k))m.set(k,[]);m.get(k).push(x);}return [...m.values()];};
  const temizle=L=>{
    // (a) farklı muavin dosyalarında aynı satır
    const dk=new Map();const a=[];
    for(const x of L){const k=[x.hesap_kodu,+x.borc||0,+x.alacak||0,x.aciklama||'',x.belge_no||'',x.tarih].join('|');const d=x.dosya||'';
      if(!dk.has(k))dk.set(k,d);if(dk.get(k)!==d)continue;a.push(x);}
    // (b) üst hesapta tekrarlanan alt hesap satırı
    return a.filter(x=>!a.some(y=>y!==x&&String(y.hesap_kodu).startsWith(String(x.hesap_kodu)+'.')&&(+y.borc||0)===(+x.borc||0)&&(+y.alacak||0)===(+x.alacak||0)&&(y.aciklama||'')===(x.aciklama||'')));};
  const enCok=(L,f)=>{const c=new Map();for(const x of L){const v=f(x);c.set(v,(c.get(v)||0)+1);}return [...c.entries()].sort((p,q)=>q[1]-p[1])[0][0];};
  const out=[];
  for(const [no,L0] of by){
    const L=temizle(L0);if(!L.length)continue;
    let parca=[L];
    const ince=bol(L,x=>(x.fis_tipi||'')+'|'+(x.tarih||''));
    if(ince.length>1){if(ince.every(denk))parca=ince;else{const t=bol(L,x=>x.fis_tipi||'');if(t.length>1&&t.every(denk))parca=t;}}
    for(const P of parca){
      const tarih=enCok(P,x=>x.tarih||''),tip=enCok(P,x=>x.fis_tipi||'');
      const borc=r2_(P.reduce((t,x)=>t+(+x.borc||0),0)),alacak=r2_(P.reduce((t,x)=>t+(+x.alacak||0),0));
      out.push({k:no+'|'+(parca.length>1?tip+'|'+tarih:''),no,tarih,tip,satir:P,borc,alacak,n:P.length,denk:Math.abs(borc-alacak)<0.01,
        ac:(P.find(x=>x.aciklama)||{}).aciklama||'',tarihler:[...new Set(P.map(x=>x.tarih))].length,hesaplar:[...new Set(P.map(x=>x.hesap_kodu))].sort((a,b)=>String(a).localeCompare(String(b),'tr',{numeric:true}))});
    }
  }
  return out;
}
window.__fisGrupla=fisGrupla;
const MMUI=(()=>{
  const st={tab:'mizan',firm:'',donem:'',q:'',f:{},sort:null,rows:[],cols:[],note:'',level:'all',grup:false,muavinCache:{},donemler:null,gorunum:'tumu'};
  const GORUNUM={calisan:'Sadece çalışan hesaplar',bakiyeli:'Bakiyeli hesaplar',tumu:'Tümü',ters:'Ters bakiyeli hesaplar'};
  const n2=v=>v==null||v===''?'':Number(v).toLocaleString('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:2});
  const trd=x=>x?String(x).slice(0,10).split('-').reverse().join('.'):'';
  const clean=e=>String(e&&e.message||e).replace(/^Error invoking remote method '[^']+': (Error: )?/,'');
  const NUMF=new Set(['borc','alacak','bb','ab']);
  // sayısal filtre: ">1000", "<500", "=200", "100..200"; metin: içerir (Türkçe büyük/küçük harf duyarsız)
  function match(v,f,num){
    f=f.trim();if(!f)return true;
    if(num){const x=+v||0;const p=s=>+String(s).replace(/\./g,'').replace(',','.');
      let m;if((m=f.match(/^(>=|<=|>|<|=)\s*(.+)$/))){const y=p(m[2]);return m[1]==='>'?x>y:m[1]==='<'?x<y:m[1]==='>='?x>=y:m[1]==='<='?x<=y:Math.abs(x-y)<0.005;}
      if((m=f.match(/^(.+)\.\.(.+)$/)))return x>=p(m[1])&&x<=p(m[2]);
      return n2(x).includes(f)||String(x).includes(f);}
    return N(String(v??'')).includes(N(f));
  }
  function planCols(){return [['kod','Hesap kodu'],['ad','Hesap adı'],['duzey','Düzey'],['alt','Alt hesap',1]];}
  function mizanCols(){return [['kod','Hesap kodu'],['ad','Hesap adı'],['borc','Borç',1],['alacak','Alacak',1],['bb','Borç bakiye',1],['ab','Alacak bakiye',1]];}
  function muavinCols(){if(st.hesapF&&!st.grup)return [['tarih','Tarih'],['fis_tipi','Fiş tipi'],['fis_no','Fiş no'],['hesap_kodu','Hesap kodu'],['aciklama','Açıklama'],['belge_no','Belge no'],['borc','Borç',1],['alacak','Alacak',1],['bakiye','Bakiye',1]];
    return st.grup?[['kod','Hesap kodu'],['ad','Hesap adı'],['adet','Hareket',1],['borc','Borç',1],['alacak','Alacak',1],['bb','Borç bakiye',1],['ab','Alacak bakiye',1]]
    :[['tarih','Tarih'],['fis_tipi','Fiş tipi'],['fis_no','Fiş no'],['hesap_kodu','Hesap kodu'],['hesap_adi','Hesap adı'],['aciklama','Açıklama'],['belge_no','Belge no'],['borc','Borç',1],['alacak','Alacak',1]];}
  const bak=(b,a)=>({bb:b>a?Math.round((b-a)*100)/100:0,ab:a>b?Math.round((a-b)*100)/100:0});
  // Tek düzen hesap planına göre hesabın normal bakiye yönü (B: borç, A: alacak; null: iki yönlü / bilinmiyor)
  const ALACAK_DUZELTICI=new Set(['103','122','124','129','137','139','158','222','224','229','237','239','241','243','244','246','247','249','257','268','278','298','299']);
  const BORC_DUZELTICI=new Set(['302','308','322','371','402','408','422','501','503','580','591']);
  function normalYon(kod){
    const a=String(kod).slice(0,3);if(!/^\d{3}$/.test(a))return null;const d=a[0];
    if(d==='1'||d==='2')return ALACAK_DUZELTICI.has(a)?'A':'B';
    if(d==='3'||d==='4'||d==='5')return BORC_DUZELTICI.has(a)?'B':'A';
    if(d==='6'){const n=+a;
      if(n<=602||(n>=640&&n<=649)||n===671||n===679)return 'A';
      if((n>=610&&n<=612)||(n>=620&&n<=623)||(n>=630&&n<=632)||(n>=653&&n<=661)||n===680||n===681||n===689||n===691)return 'B';
      return null;}
    if(d==='7')return a[2]==='0'?'B':a[2]==='1'?'A':null;      // 7x0 gider (borç), 7x1 yansıtma (alacak)
    return null;
  }
  const tersMi=r=>{if(r.bb==null)return false;const y=normalYon(r.kod);return (y==='B'&&r.ab>=0.005)||(y==='A'&&r.bb>=0.005);};
  // Muavinden mizan: seçilen aralıktaki hareketler hesap bazında toplanır, üst hesaplar alt hesaplardan türetilir
  async function muavindenMizan(f,mz){
    const api=window.desktop.fk;
    if(!f){st.rows=[];st.note='Firma seçin.';return;}
    if(!st.donemler){try{st.donemler=(await api.muavinList()).donemler||[];}catch(e){st.donemler=[];}}
    const ds=st.donemler.filter(d=>(f.lucaId&&String(d.luca_id||'')===String(f.lucaId))||N(d.firma)===N(f.name)).sort((a,b)=>String(b.zaman||'').localeCompare(String(a.zaman||'')));
    if(!ds.length){st.rows=[];st.note=`${esc(f.name)} için indirilmiş muavin yok. Muavin sekmesinden “Luca'dan çek” ile yılın muavinini indirin.`;return;}
    const d=ds[0];let m=st.muavinCache[d.id];
    if(!m){m=await Busy.run('Muavin hazırlanıyor…',f.name,()=>api.muavinGet(d.id));st.muavinCache[d.id]=m;}
    const yil=String(d.yil||new Date().getFullYear());let bas='',bit='';
    if(mz.ay==='aralik'){bas=mz.bas||'';bit=mz.bit||'';}
    else if(mz.ay){const a=String(mz.ay).padStart(2,'0');bas=`${yil}-${a}-01`;bit=`${yil}-${a}-${String(new Date(+yil,+mz.ay,0).getDate()).padStart(2,'0')}`;}
    const sat=m.satirlar.filter(r=>(!bas||String(r.tarih||'')>=bas)&&(!bit||String(r.tarih||'')<=bit));
    const plan=new Map();try{for(const r of await Store.getMizan(f.id+'__hp')||[])plan.set(String(r[0]),String(r[1]||''));}catch(e){}
    try{for(const r of await Store.getMizan(f.id,(f.mizanInfo||{}).parts)||[])if(r&&r[0]&&!plan.has(String(r[0])))plan.set(String(r[0]),String(r[1]||''));}catch(e){}
    const g=new Map();const ekle=(k,ad,b,a)=>{const x=g.get(k)||{kod:k,ad:ad||plan.get(k)||'',borc:0,alacak:0};if(!x.ad&&ad)x.ad=ad;x.borc+=b;x.alacak+=a;g.set(k,x);};
    for(const r of sat){const k=String(r.hesap_kodu);ekle(k,r.hesap_adi,r.borc||0,r.alacak||0);const p=k.split('.');for(let i=p.length-1;i>=1;i--)ekle(p.slice(0,i).join('.'),'',r.borc||0,r.alacak||0);}
    const kodlar=new Set(g.keys());
    st.rows=[...g.values()].map(x=>({...x,borc:Math.round(x.borc*100)/100,alacak:Math.round(x.alacak*100)/100,...bak(x.borc,x.alacak),_lv:x.kod.split('.').length,_leaf:![...kodlar].some(o=>o!==x.kod&&o.startsWith(x.kod+'.'))}))
      .sort((a,b)=>a.kod.localeCompare(b.kod,'tr',{numeric:true}));
    st.note=`Muavinden mizan · ${esc(m.firma||f.name)} · ${bas||bit?esc((trd(bas)||'dönem başı')+' – '+(trd(bit)||'dönem sonu')):'tüm yıl '+esc(yil)} · ${sat.length} hareket · muavin indirildi ${d.zaman?new Date(d.zaman).toLocaleString('tr-TR',{dateStyle:'short',timeStyle:'short'}):''}`;
  }
  async function loadMizan(){
    const mz=st.mz||{};
    let all;try{all=Object.values(Store.local().firms||{});}catch(e){all=S.firms||[];}
    const firms=all.filter(f=>f&&f.id&&f.id!==EXAMPLE_ID).sort((a,b)=>(!!b.mizanInfo-!!a.mizanInfo)||String(a.name).localeCompare(String(b.name),'tr'));
    if(!st.firm||!firms.some(f=>f.id===st.firm))st.firm=(S.firm&&firms.some(f=>f.id===S.firm.id&&f.mizanInfo))?S.firm.id:(firms[0]&&firms[0].id)||'';
    const f=firms.find(x=>x.id===st.firm);
    $('#mmBar').innerHTML=`<label class="note">Firma</label><select id="mmFirm">${firms.map(x=>`<option value="${esc(x.id)}"${x.id===st.firm?' selected':''}>${esc(x.name)}${x.mizanInfo?'':' · mizan yok'}</option>`).join('')||'<option value="">Firma yok</option>'}</select>
      <label class="note">Düzey</label><select id="mmLevel"><option value="all">Tümü</option><option value="1">Ana hesaplar (3 hane)</option><option value="2">Ana + 1. alt</option><option value="leaf">Yalnız muavin (en alt)</option></select>
      <label class="note">Görünüm</label><select id="mmGorunum" title="Mizan tablosunda sağ tıklayarak da seçebilirsiniz">${Object.entries(GORUNUM).map(([k,v])=>`<option value="${k}"${st.gorunum===k?' selected':''}>${v}</option>`).join('')}</select>
      <input type="search" id="mmQ" placeholder="Hesap kodu ya da adı ara" value="${esc(st.q)}">
      ${f&&f.lucaId?`<select id="mmYear" style="min-width:90px">${[0,1,2].map(i=>{const y=new Date().getFullYear()-i;return `<option${String((f.mizanInfo||{}).year||'')===String(y)?' selected':''}>${y}</option>`;}).join('')}</select><button class="btn small" id="mmPull">Luca'dan yeniden çek</button>`:''}
      <button class="btn small" data-mmyukle="mizan" title="Başka programdan ya da Luca'dan Excel olarak alınmış mizanı yükleyin">Excel'den yükle</button>
      <button class="btn small" id="mmHesapEkle" title="Luca'daki hesap planına yeni hesap aç">＋ Luca'ya Hesap Ekle</button>
      <span class="note" id="mmInfo"></span>
      <div class="mmbar-alt"><label class="note">Kaynak <select id="mmMzKaynak"><option value="luca"${mz.kaynak!=='muavin'?' selected':''}>Luca anlık mizanı</option><option value="muavin"${mz.kaynak==='muavin'?' selected':''}>Muavinden oluştur</option></select></label>
        ${mz.kaynak==='muavin'?`<label class="note">Dönem <select id="mmMzAy"><option value=""${!mz.ay?' selected':''}>Tüm yıl</option>${AYLAR.map((a,i)=>`<option value="${i+1}"${String(mz.ay)===String(i+1)?' selected':''}>${a}</option>`).join('')}<option value="aralik"${mz.ay==='aralik'?' selected':''}>Tarih aralığı…</option></select></label>
        ${mz.ay==='aralik'?`<label class="note"><input type="date" id="mmMzBas" value="${esc(mz.bas||'')}"> – <input type="date" id="mmMzBit" value="${esc(mz.bit||'')}"></label>`:''}<span class="note">Mizan, firmanın indirilmiş yıllık muavinindeki hareketlerden seçilen aralık için hesaplanır.</span>`:''}</div>`;
    $('#mmLevel').value=st.level;
    if(mz.kaynak==='muavin'){await muavindenMizan(f,mz);return;}
    if(!f){st.rows=[];st.note='Henüz firma yok. Ayarlar › Firmalar › “Luca\'dan firma ekle” ile firma ekleyin ya da “Excel\'den yükle” ile mizan yükleyin.';return;}
    if(!f.mizanInfo){st.rows=[];st.note=`${esc(f.name)} için mizan yok. ${f.lucaId?'“Luca\'dan yeniden çek” ile Luca\'dan alın ya da ':''}“Excel'den yükle” ile dosyadan yükleyin.`;return;}
    const acc=await Store.getMizan(f.id,(f.mizanInfo||{}).parts)||[];
    const has=acc.some(x=>x.length>=4);
    st.rows=acc.map(([kod,ad,b,a])=>{const lv=String(kod).split(/[.\- ]/).length;return {kod,ad,borc:has?+b||0:null,alacak:has?+a||0:null,...(has?bak(+b||0,+a||0):{bb:null,ab:null}),_lv:lv};});
    const kodlar=new Set(acc.map(x=>String(x[0]).split(/[.\- ]/).join('.')));
    st.rows.forEach(r=>{const k=String(r.kod).split(/[.\- ]/).join('.');r._leaf=![...kodlar].some(o=>o!==k&&o.startsWith(k+'.'));});
    const mi=f.mizanInfo||{};
    st.note=(mi.source==='luca'?`Luca ${mi.year||''} dönemi`:esc((mi.program?PROG_AD(mi.program)+' · ':'')+(mi.file||'Excel')))+' · '+(mi.at?new Date(mi.at).toLocaleString('tr-TR',{dateStyle:'short',timeStyle:'short'}):'')+(has?'':' · <b>bakiyeler yok</b> (bu mizan eski sürümle çekildi; “Luca\'dan yeniden çek” ile bakiyeleriyle gelir)');
  }
  // UTF-8 baytları windows-1254 sanılarak çözülmüş metni geri çevirir ("Ã‡" → "Ç")
  const mojibakeDuzelt=(()=>{let ters=null;return s=>{try{if(!ters){ters=new Map();const d=new TextDecoder('windows-1254');for(let b=0;b<256;b++)ters.set(d.decode(new Uint8Array([b])),b);}
    const bytes=[];for(const ch of s){const b=ters.get(ch);if(b==null)return s;bytes.push(b);}return new TextDecoder('utf-8',{fatal:true}).decode(new Uint8Array(bytes));}catch(e){return s;}};})();
  // Hesap planı: Luca'daki tam liste (hareketsiz hesaplar dahil); programda firma başına saklanır
  async function loadPlan(){
    let all;try{all=Object.values(Store.local().firms||{});}catch(e){all=S.firms||[];}
    const firms=all.filter(f=>f&&f.id&&f.id!==EXAMPLE_ID).sort((a,b)=>String(a.name).localeCompare(String(b.name),'tr'));
    if(!st.firm||!firms.some(f=>f.id===st.firm))st.firm=(S.firm&&firms.some(f=>f.id===S.firm.id))?S.firm.id:(firms[0]&&firms[0].id)||'';
    const f=firms.find(x=>x.id===st.firm);const hi=(f&&f.hesapPlaniInfo)||null;
    $('#mmBar').innerHTML=`<label class="note">Firma</label><select id="mmFirm">${firms.map(x=>`<option value="${esc(x.id)}"${x.id===st.firm?' selected':''}>${esc(x.name)}${x.hesapPlaniInfo?'':' · plan yok'}</option>`).join('')||'<option value="">Firma yok</option>'}</select>
      <label class="note">Düzey</label><select id="mmLevel"><option value="all">Tümü</option><option value="1">Ana hesaplar (3 hane)</option><option value="2">Ana + 1. alt</option><option value="leaf">Yalnız muavin (en alt)</option></select>
      <input type="search" id="mmQ" placeholder="Hesap kodu ya da adı ara" value="${esc(st.q)}">
      ${f&&f.lucaId?`<select id="mmPlanYil" style="min-width:90px">${[0,1,2].map(i=>{const y=new Date().getFullYear()-i;return `<option${String((hi||{}).year||(f.mizanInfo||{}).year||'')===String(y)?' selected':''}>${y}</option>`;}).join('')}</select><button class="btn small" id="mmPlanCek">Hesap Planını Luca'dan Çek</button>`:''}
      <button class="btn small primary" id="mmHesapEkle">＋ Hesap Ekle</button>
      <button class="btn small" id="mmPlanXls" title="Hesap kodu ve hesap adı sütunları olan bir Excel dosyasından hesap planını yükleyin">Excel'den Yükle</button><input type="file" id="mmPlanIn" accept=".xls,.xlsx,.csv" hidden>
      <span class="note" id="mmInfo"></span>`;
    $('#mmLevel').value=st.level;
    if(!f){st.rows=[];st.note='Henüz firma yok.';return;}
    let acc=await Store.getMizan(f.id+'__hp')||[];
    // önceki sürümde yanlış karakter kümesiyle çekilmiş adlar (Ã‡, Ä° gibi) onarılır
    if(acc.some(x=>/[ÃÄÅ][\u0080-\u00ff\u0152-\u017e\u2013-\u203a]/.test(String(x[1]||'')))){acc=acc.map(([k,a])=>[k,mojibakeDuzelt(String(a||''))]);try{await Store.saveMizan(f.id+'__hp',acc);}catch(e){}}
    if(!acc.length){st.rows=[];st.note=`${esc(f.name)} için hesap planı alınmadı. ${f.lucaId?'“Hesap Planını Luca\'dan Çek” ile Luca\'daki tam planı alın.':'Firmanın Luca karşılığı yok.'}`;return;}
    const kodlar=acc.map(x=>String(x[0]));const ust=new Map();
    for(const k of kodlar){const p=k.lastIndexOf('.');if(p>0){const u=k.slice(0,p);ust.set(u,(ust.get(u)||0)+1);}}
    st.rows=acc.map(([kod,ad])=>{const lv=String(kod).split('.').length;const alt=ust.get(String(kod))||0;return {kod,ad,_lv:lv,duzey:lv===1?'Ana hesap':alt?lv+'. düzey (ara)':'Muavin',alt,_leaf:!alt};});
    st.note=`Luca ${esc((hi||{}).year||'')} hesap planı${hi&&hi.kaynak==='rapor'?' (Raporlar › Excel Hesap Planı)':''} · ${acc.length} hesap · ${hi&&hi.at?new Date(hi.at).toLocaleString('tr-TR',{dateStyle:'short',timeStyle:'short'}):''} · sağ tıklayıp “Bu hesabın altına hesap ekle” ile başlayabilirsiniz`;
  }
  async function planCek(f,yil,o){
    await LucaBag.bekle();
    const is=()=>window.desktop.luca.hesapPlani({lucaId:f.lucaId,year:yil});
    const r=o&&o.sessiz?await is():await Busy.run('Hesap planı okunuyor…',f.name+' · '+yil,is);
    if(!r.hesaplar.length)throw new Error('Luca hesap planı okunamadı (liste boş geldi).');
    const rows=r.hesaplar.map(([k,a])=>[String(k),String(a||'')]).sort((a,b)=>a[0].localeCompare(b[0],'tr',{numeric:true}));
    await Store.saveMizan(f.id+'__hp',rows);
    const y={...f,hesapPlaniInfo:{year:r.year,at:new Date().toISOString(),count:rows.length,kaynak:r.kaynak||''}};await Store.saveFirm(y);
    if(r.kaynak==='liste'&&r.raporHata)toast('Excel Hesap Planı raporu alınamadı ('+r.raporHata+'); hesap planı Hesap Planı Listesi ekranından okundu.');
    return rows;
  }
  async function loadMuavin(){
    const api=window.desktop.fk;
    if(!st.donemler){try{st.donemler=(await api.muavinList()).donemler||[];}catch(e){st.donemler=[];st.note=esc(clean(e));}}
    const ds=st.donemler;
    // seçili dönem başka firmaya aitse (Excel'den yükleme vb.) firma dönemden alınır
    if(st.firmDonemden){st.firmDonemden=false;const d=ds.find(x=>x.id===st.donem);if(d){const f=storeFirmalar().find(y=>donemFirmasi(d,y));if(f)await firmaSec(f.id);else{st.firm='';st.dFirma=d.firma;}}}
    if(!st.firm&&!st.dFirma){const f=S.firm&&S.firm.id!==EXAMPLE_ID?S.firm:storeFirmalar()[0];if(f)st.firm=f.id;}
    const fObj=st.firm?storeFirmalar().find(y=>y.id===st.firm):null;
    const fds=ds.filter(d=>fObj?donemFirmasi(d,fObj):(st.dFirma&&N(d.firma)===N(st.dFirma))).sort((a,b)=>(+b.yil-+a.yil)||(+b.ay-+a.ay)||String(b.zaman||'').localeCompare(String(a.zaman||'')));
    // dönem seçimi: firmanın tüm muavin dosyaları birleştirilir (yeni indirilen dosya, kapsadığı aylarda eskilerin yerine geçer);
    // "Dönem" yalnız süzer: tüm dönemler · yıl · ay
    const yillar=[...new Set(fds.map(d=>String(d.yil)))].sort().reverse();
    {const g=fds.find(d=>d.id===st.donem);if(g){st.mvDonem=String(g.yil);}}          // Excel'den yükleme vb.: o yıl
    if(st.hesapYeni){st.hesapYeni=false;if(st.hesapYil&&yillar.includes(String(st.hesapYil)))st.mvDonem=String(st.hesapYil);}
    if(!st.mvDonem||(st.mvDonem!=='tum'&&!yillar.includes(String(st.mvDonem).slice(0,4))))st.mvDonem=yillar[0]||'';
    const mvYil=st.mvDonem==='tum'?null:String(st.mvDonem).slice(0,4),mvAy=/^\d{4}-\d{2}$/.test(st.mvDonem)?st.mvDonem:null;
    const fkey=st.firm?'s:'+st.firm:'d:'+(st.dFirma||'');
    const dosyalar=fds.filter(d=>!mvYil||String(d.yil)===mvYil);
    st.donem=dosyalar.length?'B|'+fkey+'|'+(mvYil||'tum'):'';
    $('#mmBar').innerHTML=(st.hesapF?`<span class="mmhesap" title="Mizandan seçilen hesabın muavini">Hesap <b class="mono">${esc(st.hesapF)}</b> ${esc(st.hesapAd||'')} <button class="x" data-mmhx="1" title="Tüm muavini göster">✕</button></span>${st.geriTab?`<button class="btn small" data-mmgeri="1" title="Esc">← ${st.geriTab==='plan'?'Hesap planına':'Mizana'} dön</button>`:''}`:'')+`<label class="note">Firma</label><select id="mmMvFirm">${tumFirmalar().map(x=>`<option value="${esc(x.key)}"${x.key===fkey?' selected':''}>${esc(x.ad)}${ds.some(d=>x.firm?donemFirmasi(d,x.firm):N(d.firma)===N(x.ad))?'':' · muavin yok'}</option>`).join('')}</select>
      <label class="note">Dönem</label><select id="mmDonem" title="Firmanın indirilmiş tüm muavinleri birleştirilir; buradan yıl ya da ay süzülür">${yillar.length?`${yillar.length>1?`<option value="tum"${st.mvDonem==='tum'?' selected':''}>Tüm dönemler</option>`:''}${yillar.map(y=>`<option value="${y}"${st.mvDonem===y?' selected':''}>${y} · tüm yıl</option>${AYLAR.map((a,i)=>{const v=y+'-'+String(i+1).padStart(2,'0');return `<option value="${v}"${st.mvDonem===v?' selected':''}>&nbsp;&nbsp;${a} ${y}</option>`;}).join('')}`).join('')}`:'<option value="">Muavin yok</option>'}</select>
      <label class="note">Tarih <input type="date" id="mmMvBas" value="${esc(st.mvBas||'')}" title="Başlangıç (boş: dönem başı)"> – <input type="date" id="mmMvBit" value="${esc(st.mvBit||'')}" title="Bitiş (boş: dönem sonu)"></label>
      <label class="note"><input type="checkbox" id="mmGrup"${st.grup?' checked':''}> Hesap bazında topla (mizan)</label>
      <input type="search" id="mmQ" placeholder="Açıklama, hesap, fiş, belge ara" value="${esc(st.q)}">
      <button class="btn small ghost" id="mmRefresh" title="Listeyi yenile">↻</button>
      <button class="btn small" data-mmcek="1" title="Bu firma ve dönemin muavinini Luca'dan yeniden indirir">Luca'dan yeniden çek</button>
      <button class="btn small" data-mmyukle="muavin" title="Muavin dökümünü Excel dosyasından yükleyin">Excel'den yükle</button><span class="note" id="mmInfo"></span>`;
    if(!st.donem&&(fObj||st.dFirma)){st.rows=[];st.note=`${esc(fObj?fObj.name:st.dFirma)} için indirilmiş muavin yok. “Luca'dan yeniden çek” ya da “Excel'den yükle” ile ekleyin.`;return;}
    if(!st.donem){st.rows=[];st.note=st.note||'Henüz muavin yok. “Luca\'dan yeniden çek” ya da “Excel\'den yükle” ile ekleyin; Fatura – Muavin Kontrol\'de kontrol yapılan dönemlerin muavinleri de burada görünür.';return;}
    let m=st.muavinCache[st.donem];
    if(!m){$('#mmInfo').textContent='Yükleniyor…';m=await Busy.run('Muavin hazırlanıyor…',(fObj?fObj.name:st.dFirma)+' · '+(mvYil||'tüm dönemler'),()=>muavinBirlestir(dosyalar));st.muavinCache[st.donem]=m;}
    const arl=r=>(!mvAy||String(r.tarih||'').slice(0,7)===mvAy)&&(!st.mvBas||String(r.tarih||'')>=st.mvBas)&&(!st.mvBit||String(r.tarih||'')<=st.mvBit);
    const sat=(mvAy||st.mvBas||st.mvBit)?m.satirlar.filter(arl):m.satirlar;
    if(st.grup){const g=new Map();for(const r of sat){const k=r.hesap_kodu;const x=g.get(k)||{kod:k,ad:r.hesap_adi,adet:0,borc:0,alacak:0};x.adet++;x.borc+=r.borc;x.alacak+=r.alacak;g.set(k,x);}
      st.rows=[...g.values()].map(x=>({...x,borc:Math.round(x.borc*100)/100,alacak:Math.round(x.alacak*100)/100,...bak(x.borc,x.alacak)})).sort((a,b)=>a.kod.localeCompare(b.kod,'tr',{numeric:true}));}
    else{let L=m.satirlar.map((r,i)=>({...r,_i:i}));
      if(st.hesapF){   // mizandan tıklanan hesap: yalnız onun (ve alt hesaplarının) hareketleri, tarih sırasıyla, yürüyen bakiye
        const k=String(st.hesapF);L=L.filter(r=>r.hesap_kodu===k||String(r.hesap_kodu).startsWith(k+'.'));
        L.sort((a,b)=>String(a.tarih).localeCompare(String(b.tarih))||String(a.fis_no).localeCompare(String(b.fis_no),'tr',{numeric:true})||a._i-b._i);
        let b=0;for(const r of L){b=Math.round((b+(+r.borc||0)-(+r.alacak||0))*100)/100;r.bakiye=b;}}
      st.rows=L.filter(arl);}
    const son=dosyalar.map(x=>x.zaman||'').sort().pop();
    st.note=`${esc(m.firma||'')} · ${sat.length}${sat.length!==m.satirlar.length?' / '+m.satirlar.length:''} hareket${mvAy?' · '+esc(AYLAR[+mvAy.slice(5)-1]+' '+mvAy.slice(0,4)):''}${(st.mvBas||st.mvBit)?' · '+esc(trd(st.mvBas)||'…')+' – '+esc(trd(st.mvBit)||'…'):''}${dosyalar.length>1?` · ${dosyalar.length} muavin dosyası birleştirildi`:''} · son indirme ${son?new Date(son).toLocaleString('tr-TR',{dateStyle:'short',timeStyle:'short'}):''}`;
  }
  // firmanın muavin dosyalarını birleştir: en son indirilen önce; daha eski bir dosyadan yalnız yeni dosyaların kapsamadığı ayların satırları alınır
  const muavinBirlestir=dosyalar=>muavinDosyaBirlestir(dosyalar,st.muavinCache);
  function filtered(){
    const cols=st.cols;let rows=st.rows;
    if((st.tab==='mizan'||st.tab==='plan')&&st.level!=='all')rows=rows.filter(r=>st.level==='leaf'?r._leaf:r._lv<=+st.level);
    if(st.tab==='mizan'&&st.gorunum==='calisan')rows=rows.filter(r=>r.borc==null||Math.abs(r.borc)>=0.005||Math.abs(r.alacak)>=0.005);
    if(st.tab==='mizan'&&st.gorunum==='ters')rows=rows.filter(tersMi);
    if(st.tab==='mizan'&&st.gorunum==='bakiyeli')rows=rows.filter(r=>r.bb==null||Math.abs(r.bb)>=0.005||Math.abs(r.ab)>=0.005);
    if(st.q){const q=N(st.q);rows=rows.filter(r=>N(cols.map(([k])=>r[k]??'').join(' ')).includes(q));}
    for(const [k,v] of Object.entries(st.f))if(v&&v.trim()){const num=cols.find(c=>c[0]===k&&c[2]);rows=rows.filter(r=>match(k==='tarih'?trd(r[k]):r[k],v,!!num));}
    if(st.sort){const {k,d}=st.sort;const num=st.cols.find(c=>c[0]===k&&c[2]);rows=rows.slice().sort((a,b)=>{const x=a[k],y=b[k];const c=num?((+x||0)-(+y||0)):String(x??'').localeCompare(String(y??''),'tr',{numeric:true});return d*c;});}
    return rows;
  }
  // Büyük muavinler: ilk 400 satır hemen, kalanı aşağı kaydırdıkça parça parça eklenir (toplamlar her zaman tümünden)
  const PARCA=400;let dahaGoz=null;
  function dahaKur(rows,satirHtml){const tb=$('#mmTable').tBodies[0];if(!tb||rows.length<=PARCA)return;let i=PARCA;
    const sent=document.createElement('tr');sent.className='mm-daha';sent.innerHTML=`<td colspan="${st.cols.length}" class="note" style="text-align:center;padding:10px">${rows.length-i} satır daha — aşağı kaydırınca yüklenir · <button class="btn small ghost" data-mmtumu="1">Tümünü göster</button></td>`;tb.appendChild(sent);
    const ekle=(n)=>{const parca=rows.slice(i,i+n);i+=parca.length;sent.insertAdjacentHTML('beforebegin',parca.map(satirHtml).join(''));
      if(i>=rows.length){sent.remove();if(dahaGoz){dahaGoz.disconnect();dahaGoz=null;}}else sent.firstElementChild.firstChild.textContent=`${rows.length-i} satır daha — aşağı kaydırınca yüklenir · `;};
    sent.addEventListener('click',e=>{if(e.target.closest('[data-mmtumu]'))ekle(rows.length);});
    if(dahaGoz)dahaGoz.disconnect();dahaGoz=new IntersectionObserver(es=>{if(es.some(x=>x.isIntersecting))ekle(PARCA);},{rootMargin:'400px'});dahaGoz.observe(sent);}
  function draw(){
    const cols=st.cols,rows=filtered();
    const arrow=k=>st.sort&&st.sort.k===k?(st.sort.d>0?' ▲':' ▼'):'';
    // mizanda üst ve alt hesap birlikte görünüyorsa toplam yalnız en üstteki hesaplardan alınır (çift sayılmaz)
    let tr=rows;
    if(st.tab==='mizan'){const nk=r=>String(r.kod).split(/[.\- ]/).join('.');const shown=new Set(rows.map(nk));
      tr=rows.filter(r=>{const p=nk(r).split('.');for(let i=1;i<p.length;i++)if(shown.has(p.slice(0,i).join('.')))return false;return true;});}
    const tot={};cols.filter(c=>c[2]).forEach(([k])=>tot[k]=tr.reduce((t,r)=>t+(+r[k]||0),0));
    const cell=(k,v,num,r)=>k==='bakiye'?(v==null?'':`<span class="${v<-0.004?'bkA':'bkB'}">${n2(Math.abs(v))} ${v>0.004?'B':v<-0.004?'A':''}</span>`):num?(k==='adet'||k==='alt'?(v??''):n2(v)):k==='tarih'||k==='belge_tarihi'?trd(v):(k==='fis_no'&&st.tab==='muavin'&&!st.grup&&v)?`<button class="fislink" data-mmfis="${r._i}" title="Fişi göster">${esc(v)}</button>`:esc(v??'');
    const satirHtml=r=>`<tr data-kod="${esc(r.kod||'')}"${st.tab==='mizan'||st.tab==='plan'?' data-mzhesap="1" title="Tıklayın: bu hesabın muavini"':''} class="${(st.tab==='mizan'||st.tab==='plan')&&st.level!=='leaf'?'lv'+Math.min(r._lv||3,3):''}${st.tab==='mizan'&&tersMi(r)?' ters':''}"${st.tab==='mizan'&&tersMi(r)?' title="Ters bakiye: bu hesap normalde '+(normalYon(r.kod)==='B'?'borç':'alacak')+' bakiyesi verir"':''}>${cols.map(([k,,num])=>`<td class="${num?'n':''}">${cell(k,r[k],num,r)}</td>`).join('')}</tr>`;
    $('#mmTable').innerHTML=`<thead><tr>${cols.map(([k,l,num])=>`<th class="${num?'n':''}"><button data-mmsort="${k}" title="Sırala">${esc(l)}${arrow(k)}</button></th>`).join('')}</tr>
      <tr class="flt">${cols.map(([k,l,num])=>`<th><input data-mmf="${k}" value="${esc(st.f[k]||'')}" placeholder="${num?'>1000 · <500 · 1..9':'filtre'}" aria-label="${esc(l)} filtresi"></th>`).join('')}</tr></thead>
      <tbody>${rows.slice(0,PARCA).map(satirHtml).join('')||`<tr><td colspan="${cols.length}" class="bosliste">${st.note&&!st.rows.length?st.note:'Bu görünümde kayıt yok. Süzgeçleri temizleyin ya da Luca\'dan çekin.'}</td></tr>`}</tbody>
      ${rows.length?`<tfoot><tr>${cols.map(([k,,num],i)=>`<td class="${num?'n':''}">${i===0?`Toplam · ${rows.length} satır`:k==='bakiye'?(()=>{const v=Math.round(((tot.borc||0)-(tot.alacak||0))*100)/100;return `<b>${n2(Math.abs(v))} ${v>0.004?'B':v<-0.004?'A':''}</b>`;})():num?(k==='adet'?tot[k]:k==='alt'?'':n2(tot[k])):''}</td>`).join('')}</tr></tfoot>`:''}`;
    const tn=st.tab==='mizan'?rows.filter(tersMi).length:0;
    const info=$('#mmInfo');if(info)info.innerHTML=(st.rows.length?st.note:'')+(tn?` · <span style="color:#c62828;font-weight:600">${tn} ters bakiyeli hesap</span>`:'')+(rows.length>PARCA?` · ilk ${PARCA} satır gösteriliyor, kaydırdıkça devamı gelir (toplamlar tümü için)`:'');
    dahaKur(rows,satirHtml);
  }
  async function load(){
    st.cols=st.tab==='mizan'?mizanCols():st.tab==='plan'?planCols():muavinCols();
    document.querySelectorAll('[data-mmtab]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mmtab===st.tab)));
    try{if(st.tab==='mizan')await loadMizan();else if(st.tab==='plan')await loadPlan();else await loadMuavin();}
    catch(e){st.rows=[];st.note=esc(clean(e));}
    st.cols=st.tab==='mizan'?mizanCols():st.tab==='plan'?planCols():muavinCols();
    draw();
  }
  // Fiş: aynı fiş numarası, fiş tarihi ve fiş tipindeki tüm muavin satırları (tüm hesaplar, 100–999)
  function showFis(i){
    const m=st.muavinCache[st.donem];if(!m)return;const r=m.satirlar[+i];if(!r)return;
    if(!m._fg){m._fg=fisGrupla(m.satirlar);m._fgIdx=new Map();for(const g of m._fg)for(const x of g.satir)m._fgIdx.set(x._i,g);}
    const g=m._fgIdx.get(+i);const fis=(g?g.satir:[{...r,_i:+i}]).map(x=>({...x,_j:x._i})).sort((a,b)=>(b.borc>0)-(a.borc>0)||String(a.hesap_kodu).localeCompare(String(b.hesap_kodu),'tr',{numeric:true}));
    const tb=fis.reduce((t,x)=>t+x.borc,0),ta=fis.reduce((t,x)=>t+x.alacak,0),denk=Math.abs(tb-ta)<0.005;
    st.fisAcik={r,fis,tb,ta,firma:m.firma||''};
    $('#mmFisT').textContent=`Fiş ${r.fis_no} · ${r.fis_tipi||''} · ${trd(r.tarih)}`;
    $('#mmFisB').innerHTML=`<div class="actions" style="margin-bottom:8px"><span class="chip ${denk?'cari':'aski'}">${denk?'Borç = alacak':'Fark '+n2(tb-ta)}</span><span class="note">${fis.length} satır · ${esc(m.firma||'')}${fis.length<2?' · muavinde bu fişin diğer satırları yok (muavin 100–999 indirilmemiş olabilir)':''}</span><span style="flex:1"></span><button class="btn small" id="mmFisPdf">PDF Yazdır</button><button class="btn small" id="mmFisXls">Excel'e Aktar</button></div>
      <div class="tablewrap"><table style="width:100%;font-size:13px"><thead><tr><th>Hesap kodu</th><th>Hesap adı</th><th>Açıklama</th><th>Belge no</th><th style="text-align:right">Borç</th><th style="text-align:right">Alacak</th></tr></thead>
      <tbody>${fis.map(x=>`<tr class="${x._j===+i?'sec':''}"><td class="mono">${esc(x.hesap_kodu)}</td><td>${esc(x.hesap_adi)}</td><td>${esc(x.aciklama)}</td><td class="mono">${esc(x.belge_no||'')}</td><td class="n mono" style="text-align:right">${x.borc?n2(x.borc):''}</td><td class="n mono" style="text-align:right">${x.alacak?n2(x.alacak):''}</td></tr>`).join('')}</tbody>
      <tfoot><tr><td colspan="4"><b>Toplam</b></td><td class="mono" style="text-align:right"><b>${n2(tb)}</b></td><td class="mono" style="text-align:right"><b>${n2(ta)}</b></td></tr></tfoot></table></div>`;
    $('#mmFis').hidden=false;$('#mmFisX').focus();
  }
  $('#mmFisX').onclick=()=>{$('#mmFis').hidden=true;};
  // PDF için sade sayfa (görüntüleyicide yazdır / kaydet)
  function pdfSayfa(baslik,alt,basliklar,satirlar,sag,toplam){
    const e=esc;return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>${e(baslik)}</title><style>
      body{font:11px/1.35 "Segoe UI",Arial,sans-serif;color:#111;margin:0}h1{font-size:16px;margin:0 0 2px}.alt{color:#555;margin:0 0 10px}
      table{width:100%;border-collapse:collapse}th{background:#eef2f7;text-align:left;font-weight:600;border-bottom:1px solid #999;padding:4px 6px}
      td{border-bottom:1px solid #ddd;padding:3px 6px;vertical-align:top}td.n,th.n{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}
      tfoot td{font-weight:700;border-top:1px solid #999;border-bottom:0}.kod{font-family:Consolas,monospace;white-space:nowrap}
      .ayak{margin-top:10px;color:#777;font-size:9px}</style></head><body><h1>${e(baslik)}</h1><p class="alt">${e(alt)}</p>
      <table><thead><tr>${basliklar.map((h,i)=>`<th class="${sag.has(i)?'n':''}">${e(h)}</th>`).join('')}</tr></thead>
      <tbody>${satirlar.map(r=>`<tr>${r.map((v,i)=>`<td class="${sag.has(i)?'n':i===0?'kod':''}">${e(v??'')}</td>`).join('')}</tr>`).join('')}</tbody>
      ${toplam?`<tfoot><tr>${toplam.map((v,i)=>`<td class="${sag.has(i)?'n':''}">${e(v??'')}</td>`).join('')}</tr></tfoot>`:''}</table>
      <p class="ayak">MuhaWin · ${e(new Date().toLocaleString('tr-TR'))}</p></body></html>`;}
  async function pdfAc(html,ad,yatay){try{await Busy.run('PDF hazırlanıyor…',ad,()=>window.desktop.htmlPdf({html,ad,yatay}));}catch(x){toast(clean(x));}}
  document.addEventListener('click',async e=>{
    if(e.target.id==='mmFisPdf'&&st.fisAcik){const {r,fis,tb,ta,firma}=st.fisAcik;
      pdfAc(pdfSayfa(`Fiş ${r.fis_no} · ${r.fis_tipi||''} · ${trd(r.tarih)}`,firma,['Hesap Kodu','Hesap Adı','Açıklama','Belge No','Borç','Alacak'],
        fis.map(x=>[x.hesap_kodu,x.hesap_adi,x.aciklama,x.belge_no||'',x.borc?n2(x.borc):'',x.alacak?n2(x.alacak):'']),new Set([4,5]),['','','','Toplam',n2(tb),n2(ta)]),'Fis_'+r.fis_no);return;}
    if(e.target.id==='mmFisXls'&&st.fisAcik){const {r,fis,tb,ta,firma}=st.fisAcik;
      const aoa=[[`Fiş ${r.fis_no} · ${r.fis_tipi||''} · ${trd(r.tarih)}`],[firma],[],['Hesap Kodu','Hesap Adı','Açıklama','Belge No','Borç','Alacak'],...fis.map(x=>[x.hesap_kodu,x.hesap_adi,x.aciklama,x.belge_no||'',+x.borc||0,+x.alacak||0]),['','','','Toplam',tb,ta]];
      const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(aoa),'Fiş');
      try{const x=await window.desktop.saveFile(('Fis_'+r.fis_no+'_'+trd(r.tarih)).replace(/[^\wÇĞİÖŞÜçğıöşü.-]+/g,'_')+'.xlsx',new Uint8Array(XLSX.write(wb,{type:'array',bookType:'xlsx'})));if(x.ok)toast('Kaydedildi: '+x.path);}catch(x){toast(clean(x));}return;}
    if(e.target.id==='mmPdf'){const rows=filtered();if(!rows.length){toast('Yazdırılacak satır yok.');return;}if(rows.length>6000&&!(await askConfirm('Çok satır',`${rows.length} satır PDF yapılacak; biraz sürebilir. Devam edilsin mi?`,'Devam')))return;
      const fad=(((S.firms||[]).find(x=>x.id===st.firm)||{}).name||'');const bas=st.tab==='mizan'?'Mizan':st.tab==='plan'?'Hesap Planı':'Muavin';
      const sag=new Set(st.cols.map((c,i)=>c[2]?i:-1).filter(i=>i>=0));
      pdfAc(pdfSayfa(bas+(fad?' · '+fad:''),st.tab==='muavin'?String(st.donem||''):'',st.cols.map(c=>c[1]),rows.map(r=>st.cols.map(([k,,num])=>num?(r[k]?n2(+r[k]):''):k==='tarih'?trd(r[k]):(r[k]??''))),sag),bas+'_'+fad,st.cols.length>6);return;}
    if(e.target.id==='mmPlanXls'){$('#mmPlanIn').click();return;}
  });
  document.addEventListener('change',async e=>{if(e.target.id!=='mmPlanIn')return;const file=e.target.files[0];e.target.value='';if(!file)return;
    const f=(Store.local().firms||{})[st.firm];if(!f)return;
    try{const wb=XLSX.read(new Uint8Array(await file.arrayBuffer()),{type:'array'});const rows=[];const gor=new Set();
      for(const ad of wb.SheetNames)for(const r of XLSX.utils.sheet_to_json(wb.Sheets[ad],{header:1,raw:false})){
        const i=(r||[]).findIndex(c=>/^\d{3}(\.[0-9A-Za-zÇĞİÖŞÜçğıöşü]+)*$/.test(String(c||'').trim()));if(i<0)continue;
        const kod=String(r[i]).trim();const adi=String((r.slice(i+1).find(c=>c!=null&&String(c).trim()&&!/^[\d.,\s-]+$/.test(String(c))))||'').trim();
        if(!adi||gor.has(kod))continue;gor.add(kod);rows.push([kod,adi]);}
      if(!rows.length){toast('Dosyada hesap kodu / hesap adı bulunamadı.');return;}
      rows.sort((a,b)=>a[0].localeCompare(b[0],'tr',{numeric:true}));
      if(!(await askConfirm('Hesap planı yüklensin mi?',`${f.name} için ${rows.length} hesap yüklenecek (${file.name}). Programdaki hesap planının yerine geçer; Luca'ya bir şey yazılmaz.`,'Evet, yükle')))return;
      await Store.saveMizan(f.id+'__hp',rows);await Store.saveFirm({...f,hesapPlaniInfo:{year:'Excel',at:new Date().toISOString(),count:rows.length,file:file.name}});
      toast(rows.length+' hesap yüklendi.');load();}catch(x){toast(clean(x));}});
  $('#mmFis').addEventListener('pointerdown',e=>{if(e.target.id==='mmFis')$('#mmFis').hidden=true;});
  /* ---- Excel'den yükleme (mizan / muavin) ve muavini Luca'dan yeniden çekme ---- */
  // Mizan programları: şimdilik Luca; başka programların mizan örnekleri geldikçe buraya okuyucu eklenir
  const MIZAN_PROG={luca:{ad:'Luca',uzantilar:['.xlsx','.xls','.csv'],ipucu:'Luca → Raporlar → Mizan → Excel (borç/alacak sütunlarıyla)',oku:rows=>parseMizanTutar(rows)}};
  let muavinProg=null;
  const PROG_AD=k=>(MIZAN_PROG[k]||(muavinProg||[]).find(p=>p.kod===k)||{ad:k}).ad;
  const AYLAR=['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
  function tumFirmalar(){let all;try{all=Object.values(Store.local().firms||{});}catch(x){all=S.firms||[];}
    const l=all.filter(f=>f&&f.id&&f.id!==EXAMPLE_ID).map(f=>({key:'s:'+f.id,ad:f.name,lucaId:f.lucaId||null,firm:f}));
    for(const d of st.donemler||[])if(!l.some(x=>(d.luca_id&&String(x.lucaId)===String(d.luca_id))||N(x.ad)===N(d.firma)))l.push({key:'d:'+d.firma,ad:d.firma,lucaId:d.luca_id||null});
    return l.sort((a,b)=>String(a.ad).localeCompare(String(b.ad),'tr'));}
  function secili(){
    if(st.tab==='mizan'||st.tab==='plan')return 's:'+st.firm;
    const d=(st.donemler||[]).find(x=>x.id===st.donem);if(!d)return st.firm?'s:'+st.firm:st.dFirma?'d:'+st.dFirma:'';
    const l=tumFirmalar();const x=l.find(y=>(d.luca_id&&String(y.lucaId)===String(d.luca_id))||N(y.ad)===N(d.firma));return x?x.key:'';}
  function donemSec(){const d=(st.donemler||[]).find(x=>x.id===st.donem);const now=new Date();const p=new Date(now.getFullYear(),now.getMonth()-1,1);
    const yil=d?+d.yil:p.getFullYear(),ay=d?+d.ay:p.getMonth()+1;
    return `<div class="grid2" style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><div><label class="lbl" for="mmYkYil">Yıl</label><select id="mmYkYil">${[0,1,2,3,4,5].map(i=>{const y=now.getFullYear()-i;return `<option${y===yil?' selected':''}>${y}</option>`;}).join('')}</select></div>
      <div><label class="lbl" for="mmYkAy">Ay</label><select id="mmYkAy">${st.yilSecenek?`<option value="0">Tüm Yıl</option>`:''}${AYLAR.map((a,i)=>`<option value="${i+1}"${i+1===ay?' selected':''}>${a}</option>`).join('')}</select></div></div>`;}
  // "Tüm Yıl": yılın son biten ayı (geçmiş yıllarda Aralık) — muavin zaten yılın tamamı indirilir
  function ayDegeri(){const y=+$('#mmYkYil').value;let a=+$('#mmYkAy').value;if(!a){const n=new Date();a=y<n.getFullYear()?12:Math.max(1,n.getMonth()+1);}return y+'-'+String(a).padStart(2,'0');}

  /* ---- Luca hesap planına hesap ekleme: geniş panel; kod yazdıkça planda o kodla başlayan hesaplar listelenir ---- */
  const hp={f:null,kodlar:new Map(),kaynak:'',odak:0,satirlar:[]};
  async function hpBilinen(f){hp.f=f;hp.kodlar=new Map();hp.kaynak='';
    const plan=await Store.getMizan(f.id+'__hp').catch(()=>[])||[];
    if(plan.length){for(const r of plan)hp.kodlar.set(String(r[0]),String(r[1]||''));hp.kaynak=`Luca hesap planı (${plan.length} hesap)`;}
    else{try{const m=await Store.getMizan(f.id,(f.mizanInfo||{}).parts)||[];for(const r of m)if(r&&r[0])hp.kodlar.set(String(r[0]),String(r[1]||''));}catch(e){}
      hp.kaynak=hp.kodlar.size?`mizandaki hesaplar (${hp.kodlar.size}) — tam liste için “Hesap Planını Luca'dan Çek”`:'hesap listesi yok';}}
  function sonrakiKod(ust){ust=String(ust||'').trim().replace(/\.+$/,'');if(!/^\d{3}/.test(ust))return '';
    const cocuk=[...hp.kodlar.keys()].filter(k=>k.startsWith(ust+'.')&&!k.slice(ust.length+1).includes('.'));
    const say=cocuk.map(k=>k.slice(ust.length+1)).filter(x=>/^\d+$/.test(x));
    const gen=say.length?Math.max(...say.map(x=>x.length)):(ust.split('.').length===1?2:3);
    let n=say.length?Math.max(...say.map(Number))+1:1;let k;do{k=ust+'.'+String(n).padStart(gen,'0');n++;}while(hp.kodlar.has(k));return k;}
  function hpDurum(x,gor){
    if(!x.kod&&!x.ad)return {m:'',c:''};
    if(!/^\d{3}([.][0-9A-Za-zÇĞİÖŞÜçğıöşü]+)*$/.test(x.kod))return {m:'Kod biçimi geçersiz (örn. 320.01.046)',c:'hata'};
    if(hp.kodlar.has(x.kod))return {m:'Bu kod planda var: '+hp.kodlar.get(x.kod),c:'hata'};
    if(gor.has(x.kod))return {m:'Listede iki kez yazılmış',c:'hata'};
    if(!x.ad)return {m:'Hesap adını yazın',c:'uyari'};
    const ust=x.kod.split('.').slice(0,-1).join('.');
    if(ust&&!hp.kodlar.has(ust)&&!hp.satirlar.some(y=>y.kod===ust))return {m:'Üst hesap '+ust+' planda yok — Luca reddedebilir',c:'uyari'};
    return {m:'Eklenebilir',c:'ok'};}
  function hpCiz(){
    const P=$('#hpPanel');if(!P)return;const gor=new Set();
    $('#hpRows').innerHTML=hp.satirlar.map((x,i)=>{const d=hpDurum(x,gor);if(x.kod)gor.add(x.kod);
      return `<div class="hp-row${i===hp.odak?' odak':''}" data-hpi="${i}"><span class="hp-no">${i+1}</span>
        <input class="mono hp-kod" data-hpk="${i}" value="${esc(x.kod)}" placeholder="Hesap kodu (örn. 320.01)" autocomplete="off">
        <input class="hp-ad" data-hpa="${i}" value="${esc(x.ad)}" placeholder="Hesap adı" autocomplete="off">
        <button class="btn small ghost" data-hponer="${i}" title="Yazdığınız üst hesabın altındaki ilk boş kodu getir">Sıradaki Kod</button>
        <button class="btn small ghost danger" data-hpsil="${i}" title="Satırı sil">✕</button>
        <div class="hp-durum ${d.c}" data-hpd="${i}">${esc(d.m)}</div></div>`;}).join('');
    hpListe();hpSayac();
  }
  function hpSayac(){const gor=new Set();const ok=hp.satirlar.filter(x=>{const d=hpDurum(x,gor);if(x.kod)gor.add(x.kod);return d.c==='ok'||d.c==='uyari'&&x.ad&&!/Hesap adını/.test(d.m);});
    $('#hpKaydet').disabled=!ok.length;$('#hpKaydet').textContent=`Luca'ya Aktar (${ok.length} Hesap)`;return ok;}
  function hpListe(){
    const x=hp.satirlar[hp.odak]||{kod:''};const q=String(x.kod||'').trim();
    const tum=[...hp.kodlar.entries()].sort((a,b)=>a[0].localeCompare(b[0],'tr',{numeric:true}));
    const eslesen=q?tum.filter(([k])=>k.startsWith(q)):[];
    const ust=q.replace(/\.+$/,'');const sonraki=/^\d{3}/.test(ust)&&(hp.kodlar.has(ust)||[...hp.kodlar.keys()].some(k=>k.startsWith(ust+'.')))?sonrakiKod(ust):'';
    $('#hpListeBaslik').innerHTML=q?`<b>${esc(q)}</b> ile başlayan hesaplar: <b>${eslesen.length}</b>${hp.kodlar.has(q)?` · <span class="hp-var">Bu kod planda var</span>`:eslesen.length?'':' · <span class="hp-bos">Planda yok — bu kodu kullanabilirsiniz</span>'}${sonraki?` · <button class="btn small" id="hpSonrakiAl">Sıradaki boş kod: <span class="mono">${esc(sonraki)}</span></button>`:''}`:'Kod yazmaya başlayın; planda o kodla başlayan hesaplar burada listelenir.';
    const L=eslesen.slice(0,400);
    $('#hpListe').innerHTML=L.length?`<table class="tg-yok"><thead><tr><th>Hesap Kodu</th><th>Hesap Adı</th></tr></thead><tbody>${L.map(([k,a])=>`<tr data-hpsec="${esc(k)}" title="Tıklayın: bu hesabın altına devam edin"><td class="mono"><b>${esc(k.slice(0,q.length))}</b>${esc(k.slice(q.length))}</td><td>${esc(a)}</td></tr>`).join('')}</tbody></table>${eslesen.length>L.length?`<p class="note">İlk ${L.length} hesap gösteriliyor; kodu biraz daha yazarak daraltın.</p>`:''}`
      :`<div class="hp-bosliste">${q?'Bu kodla başlayan hesap yok.':'—'}</div>`;
    const b=$('#hpSonrakiAl');if(b)b.onclick=()=>{hp.satirlar[hp.odak].kod=sonraki;hpCiz();const i=$(`[data-hpa="${hp.odak}"]`);if(i)i.focus();};
  }
  async function hesapEkleAc(baslangic){
    let all;try{all=Object.values(Store.local().firms||{});}catch(x){all=S.firms||[];}
    const f=all.find(x=>x.id===st.firm);if(!f){toast('Önce firma seçin.');return;}
    if(!f.lucaId){toast('Bu firmanın Luca karşılığı yok (Ayarlar › Firmalar › “Luca\'dan firma ekle”).');return;}
    await hpBilinen(f);hp.satirlar=[{kod:baslangic||'',ad:''}];hp.odak=0;
    const yil=String((f.hesapPlaniInfo&&f.hesapPlaniInfo.year)||(f.mizanInfo&&f.mizanInfo.year)||new Date().getFullYear());
    let P=$('#hpPanel');if(!P){document.body.insertAdjacentHTML('beforeend','<div class="modal" id="hpPanel" hidden></div>');P=$('#hpPanel');}
    P.innerHTML=`<div class="mbox hp-kutu" role="dialog" aria-modal="true" aria-labelledby="hpT">
      <div class="mhead"><div><h2 id="hpT">Hesap Planına Hesap Ekle</h2><div class="note">${esc(f.name)} · Luca <input id="hpYil" class="mono" value="${esc(yil)}" style="width:64px;padding:2px 6px"> dönemi · liste: <span id="hpKaynak">${esc(hp.kaynak)}</span> <button class="btn small ghost" id="hpOku">Luca'dan Yenile</button></div></div><button class="btn small ghost" id="hpKapat">✕ Kapat</button></div>
      <div class="hp-govde">
        <section class="hp-sol"><div class="hp-baslik">Açılacak Hesaplar</div><div id="hpRows"></div>
          <div class="actions" style="margin:10px 0 0"><button class="btn small" id="hpYeni">＋ Satır Ekle</button><span class="note">Kodu yazdıkça sağda planda o kodla başlayan hesaplar daralarak listelenir. Listeden bir hesaba tıklarsanız altına devam edilir.</span></div>
          <div id="hpSonuc"></div></section>
        <section class="hp-sag"><div class="hp-baslik" id="hpListeBaslik"></div><div class="hp-liste" id="hpListe"></div></section>
      </div>
      <div class="hp-alt"><span class="note">Hesaplar Luca'da Hesap Planı Listesi → + Yeni Hesap ile aynı biçimde açılır ve programdaki mizan / hesap planına da eklenir.</span><span style="flex:1"></span><button class="btn" id="hpIptal">Vazgeç</button><button class="btn primary" id="hpKaydet">Luca'ya Aktar</button></div></div>`;
    P.hidden=false;hpCiz();setTimeout(()=>{const i=$('[data-hpk="0"]');if(i){i.focus();i.setSelectionRange(i.value.length,i.value.length);}},30);
    const kapat=()=>{P.hidden=true;};
    $('#hpKapat').onclick=kapat;$('#hpIptal').onclick=kapat;
    P.onkeydown=e=>{if(e.key==='Escape'){e.stopPropagation();kapat();}};
    $('#hpYeni').onclick=()=>{hp.satirlar.push({kod:'',ad:''});hp.odak=hp.satirlar.length-1;hpCiz();const i=$(`[data-hpk="${hp.odak}"]`);if(i)i.focus();};
    $('#hpOku').onclick=async()=>{try{const rows=await planCek(f,$('#hpYil').value.trim());hp.kodlar=new Map(rows.map(r=>[r[0],r[1]]));hp.kaynak=`Luca hesap planı (${rows.length} hesap)`;$('#hpKaynak').textContent=hp.kaynak;hpCiz();}catch(e){toast(clean(e));}};
    $('#hpRows').oninput=e=>{const t=e.target;const k=t.dataset.hpk,a=t.dataset.hpa;
      if(k!=null){hp.satirlar[+k].kod=t.value.trim();hp.odak=+k;}if(a!=null){hp.satirlar[+a].ad=t.value;hp.odak=+a;}
      const gor=new Set();hp.satirlar.forEach((x,i)=>{const d=hpDurum(x,gor);if(x.kod)gor.add(x.kod);const el=$(`[data-hpd="${i}"]`);if(el){el.textContent=d.m;el.className='hp-durum '+d.c;}});
      document.querySelectorAll('#hpRows .hp-row').forEach(r=>r.classList.toggle('odak',+r.dataset.hpi===hp.odak));hpListe();hpSayac();};
    $('#hpRows').onfocusin=e=>{const i=e.target.closest('[data-hpi]');if(i&&+i.dataset.hpi!==hp.odak){hp.odak=+i.dataset.hpi;document.querySelectorAll('#hpRows .hp-row').forEach(r=>r.classList.toggle('odak',+r.dataset.hpi===hp.odak));hpListe();}};
    $('#hpRows').onclick=e=>{const o=e.target.closest('[data-hponer]');if(o){const i=+o.dataset.hponer;const y=sonrakiKod(hp.satirlar[i].kod);if(y){hp.satirlar[i].kod=y;hp.odak=i;hpCiz();const a=$(`[data-hpa="${i}"]`);if(a)a.focus();}else toast('Önce üst hesap kodunu yazın (örn. 320.01).');return;}
      const s2=e.target.closest('[data-hpsil]');if(s2){hp.satirlar.splice(+s2.dataset.hpsil,1);if(!hp.satirlar.length)hp.satirlar.push({kod:'',ad:''});hp.odak=Math.min(hp.odak,hp.satirlar.length-1);hpCiz();}};
    $('#hpListe').onclick=e=>{const r=e.target.closest('[data-hpsec]');if(!r)return;const x=hp.satirlar[hp.odak];x.kod=r.dataset.hpsec+'.';hpCiz();const i=$(`[data-hpk="${hp.odak}"]`);if(i){i.focus();i.setSelectionRange(i.value.length,i.value.length);}};
    $('#hpKaydet').onclick=async()=>{const l=hpSayac();if(!l.length)return;
      if(!(await askConfirm('Luca\'ya hesap eklensin mi?',`${f.name} firmasının ${$('#hpYil').value} dönemi hesap planına ${l.length} hesap açılacak:\n`+l.map(x=>x.kod+'  '+x.ad).join('\n'),'Evet, aktar')))return;
      try{await LucaBag.bekle();
        const r=await Busy.run('Hesaplar Luca\'ya ekleniyor…',f.name,()=>window.desktop.luca.hesapEkle({lucaId:f.lucaId,year:$('#hpYil').value.trim(),hesaplar:l.map(x=>({kod:x.kod,ad:x.ad.trim()}))}));
        const ok=r.filter(x=>x.ok);
        $('#hpSonuc').innerHTML=`<div class="hp-baslik" style="margin-top:14px">Sonuç</div><table class="mini" style="width:100%"><thead><tr><th>Kod</th><th>Ad</th><th>Sonuç</th></tr></thead><tbody>${r.map(x=>`<tr><td class="mono">${esc(x.kod)}</td><td>${esc(x.ad)}</td><td style="color:${x.ok?'var(--ok,#0a7)':'var(--out)'}">${x.ok?'✓ '+esc(x.mesaj||'Eklendi'):'✕ '+esc(x.hata||'')}</td></tr>`).join('')}</tbody></table>`;
        if(ok.length){for(const x of ok)hp.kodlar.set(x.kod,x.ad);
          try{const plan=await Store.getMizan(f.id+'__hp')||[];for(const x of ok)if(!plan.some(y=>String(y[0])===x.kod))plan.push([x.kod,x.ad]);
            if(plan.length){plan.sort((a,b)=>String(a[0]).localeCompare(String(b[0]),'tr',{numeric:true}));await Store.saveMizan(f.id+'__hp',plan);}
            const m=await Store.getMizan(f.id,(f.mizanInfo||{}).parts)||[];for(const x of ok)if(!m.some(y=>String(y[0])===x.kod))m.push([x.kod,x.ad,0,0]);
            m.sort((a,b)=>String(a[0]).localeCompare(String(b[0]),'tr',{numeric:true}));const parts=await Store.saveMizan(f.id,m);
            let cur=f;try{cur=Store.local().firms[f.id]||f;}catch(e){}
            await Store.saveFirm({...cur,mizanInfo:{...(cur.mizanInfo||{source:'luca',year:$('#hpYil').value.trim()}),count:m.length,parts,at:new Date().toISOString()}});}catch(e){}
          hp.satirlar=hp.satirlar.filter(x=>!ok.some(o=>o.kod===x.kod));if(!hp.satirlar.length)hp.satirlar=[{kod:'',ad:''}];hp.odak=0;hpCiz();
          toast(`${ok.length} hesap Luca'ya eklendi${r.length>ok.length?`, ${r.length-ok.length} hata`:''}.`);load();}
        else toast('Hesap eklenemedi: '+((r[0]&&r[0].hata)||''));}
      catch(e){toast(clean(e));}};
  }
  function ykAc(baslik,html){const mb=$('#mmYk .mbox');if(mb)mb.style.width='min(560px,100%)';$('#mmYkT').textContent=baslik;$('#mmYkB').innerHTML=html;$('#mmYk').hidden=false;const i=$('#mmYkB select,#mmYkB input');if(i)i.focus();}
  const ykKapat=()=>{$('#mmYk').hidden=true;};
  $('#mmYkX').onclick=ykKapat;
  $('#mmYk').addEventListener('pointerdown',e=>{if(e.target.id==='mmYk')ykKapat();});
  async function yukleAc(tur){
    if(tur==='muavin'&&!muavinProg){try{muavinProg=(await window.desktop.fk.muavinProgramlar()).programlar||[];}catch(e){toast(clean(e));return;}}
    const progs=tur==='mizan'?Object.entries(MIZAN_PROG).map(([kod,p])=>({kod,...p})):muavinProg;
    const firmalar=tur==='mizan'?tumFirmalar().filter(x=>x.firm):tumFirmalar();const sec=secili();
    if(!firmalar.length){toast('Önce firma ekleyin (Ayarlar › Firmalar › Luca\'dan firma ekle ya da Yeni firma).');return;}
    ykAc(tur==='mizan'?'Mizanı Excel\'den yükle':'Muavini Excel\'den yükle',`
      <label class="lbl" for="mmYkProg">Bu ${tur} hangi programa ait?</label>
      <select id="mmYkProg"><option value="">— Program seçin —</option>${progs.map(p=>`<option value="${esc(p.kod)}">${esc(p.ad)}</option>`).join('')}</select>
      <p class="note" id="mmYkIpucu" style="margin:4px 0 0">Şimdilik yalnız Luca; diğer programlar eklendikçe listede görünecek.</p>
      <label class="lbl" for="mmYkFirma">Firma</label>
      <select id="mmYkFirma">${firmalar.map(x=>`<option value="${esc(x.key)}"${x.key===sec?' selected':''}>${esc(x.ad)}</option>`).join('')}</select>
      ${tur==='muavin'?donemSec():''}
      <label class="lbl" for="mmYkDosya">Dosya</label>
      <input type="file" id="mmYkDosya" disabled>
      <p class="note" style="margin:6px 0 0">${tur==='mizan'?'Firmanın kayıtlı mizanının yerine geçer (Ekstre eşleştirmesi ve fatura kaydı da bu mizanı kullanır).':'Seçilen dönemin muavininin yerine geçer; faturalar ve raporlar korunur. Kontrolü yenilemek için Fatura – Muavin Kontrol\'de “Kontrol et”.'}</p>
      <div class="actions" style="justify-content:flex-end;margin-top:12px"><span class="note err" id="mmYkHata"></span><button class="btn" id="mmYkIptal">Vazgeç</button><button class="btn primary" id="mmYkTamam" data-tur="${tur}" disabled>Yükle</button></div>`);
    const prog=$('#mmYkProg'),dosya=$('#mmYkDosya'),ok=$('#mmYkTamam');
    const guncel=()=>{const p=progs.find(x=>x.kod===prog.value);dosya.disabled=!p;if(p){dosya.accept=p.uzantilar.join(',');$('#mmYkIpucu').textContent=p.ipucu||'';}ok.disabled=!(p&&dosya.files.length);};
    prog.onchange=guncel;dosya.onchange=guncel;$('#mmYkIptal').onclick=ykKapat;
    guncel();
    ok.onclick=async()=>{const hata=$('#mmYkHata');hata.textContent='';ok.disabled=true;
      const file=dosya.files[0],program=prog.value,fk=firmalar.find(x=>x.key===$('#mmYkFirma').value);
      try{
        if(tur==='mizan'){
          const wb=await readWorkbook(file);let acc=[];
          for(const n of wb.SheetNames){const a=MIZAN_PROG[program].oku(sheetRows(wb.Sheets[n]));if(a.length>acc.length)acc=a;}
          if(acc.length<3)throw new Error('Dosyada hesap kodu (örn. 120.01.001) ve hesap adı bulunamadı.');
          const f=fk.firm;const parts=await Store.saveMizan(f.id,acc);
          f.mizanInfo={count:acc.length,file:file.name,at:new Date().toISOString(),parts,source:'excel',program};
          const miz=mizanIndex(acc);autoBanks(f,acc,miz);await Store.saveFirm(f);
          if(S.firmId===f.id){S.firm={...f};S.miz=miz;try{renderDatalist();reassign();}catch(x){}}
          st.firm=f.id;ykKapat();toast(`${f.name}: mizan yüklendi (${miz.leaf.size} alt hesap${acc.some(x=>x.length>=4)?'':', tutarsız'}).`);load();
        }else{
          const yil=+$('#mmYkYil').value,ay=+$('#mmYkAy').value;
          const r=await Busy.run('Muavin yükleniyor…',fk.ad+' · '+String(ay).padStart(2,'0')+'.'+yil,async()=>window.desktop.fk.muavinYukle({ad:fk.ad,luca_id:fk.lucaId,yil,ay,program,dosya_adi:file.name,veri:new Uint8Array(await file.arrayBuffer())}));
          ykKapat();toast(`${fk.ad}: ${r.satir} muavin satırı yüklendi.`);st.donemler=null;st.muavinCache={};st.donem=r.id;st.firmDonemden=true;load();
        }
      }catch(e){hata.textContent=clean(e);ok.disabled=false;}};
  }
  function cekAc(){
    const firmalar=tumFirmalar().filter(x=>x.lucaId);const sec=secili();
    if(!firmalar.length){toast('Luca firma numarası bilinen firma yok. Ayarlar › Firmalar › “Luca\'dan firma ekle” ile ekleyin.');return;}
    st.yilSecenek=true;ykAc('Muavini Luca\'dan çek',`
      <label class="lbl" for="mmYkFirma">Firma</label>
      <select id="mmYkFirma">${firmalar.map(x=>`<option value="${esc(x.key)}"${x.key===sec?' selected':''}>${esc(x.ad)}</option>`).join('')}</select>
      ${donemSec()}
      <p class="note" style="margin:8px 0 0">Muavin her zaman <b>seçilen yılın tamamı</b> olarak indirilir (fatura kaydı önerileri tüm yılın kayıtlarından öğrenir); kontrol, seçilen ayın içinden süzülerek yapılır. “Tüm Yıl” seçerseniz yılın son biten ayının kontrolü yenilenir. Muavin, Fatura – Muavin Kontrol modülünde Luca'dan indirilir (Luca girişi orada açılır) ve o dönemin kontrolü yenilenir. Bitince bu sayfada görünür.</p>
      <div class="actions" style="justify-content:flex-end;margin-top:12px"><button class="btn" id="mmYkIptal">Vazgeç</button><button class="btn primary" id="mmYkCek">Muavini çek</button></div>`);
    st.yilSecenek=false;$('#mmYkIptal').onclick=ykKapat;
    $('#mmYkCek').onclick=()=>{const fk=firmalar.find(x=>x.key===$('#mmYkFirma').value);const ay=ayDegeri();ykKapat();muavinCekYerinde(fk,ay);};
  }
  // uzun iş: ekranda bekler; "Arka planda bekle" denirse pencere kapanır, iş sürer, bitince haber verilir
  function arkaPlanli(baslik,alt,fn,isAd){
    let ayr=false,isId=null,ayrildi,bk=null;const ayrilma=new Promise(r=>ayrildi=r);
    bk=Busy.show(baslik,alt,{iptalAd:'Arka planda bekle',iptal:()=>{if(ayr)return;ayr=true;Busy.hide(bk);isId=Isler.basla(isAd||baslik);toast('İş arka planda sürüyor; bitince haber verilecek. Bu ekranda çalışmaya devam edebilirsiniz.');ayrildi();}});
    const durum=t=>{if(ayr){if(isId)Isler.guncelle(isId,(isAd||baslik)+' · '+t);}else Busy.metin(t);};
    const p=Promise.resolve().then(()=>fn(durum));
    p.then(()=>{},()=>{}).finally(()=>{if(ayr){if(isId)Isler.bitir(isId);}else Busy.hide(bk);});
    return Promise.race([p.then(v=>({v})),ayrilma.then(()=>({arka:true,p}))]);
  }
  const yilAyi=yil=>{const n=new Date();return String(yil)+'-'+String(+yil<n.getFullYear()?12:n.getMonth()+1).padStart(2,'0');};
  const firmaOf=fk=>fk&&(fk.firm||storeFirmalar().find(x=>String(x.lucaId)===String(fk.lucaId)))||null;
  // muavin: açık Luca oturumuyla bu ekrandan çıkmadan (Excel Liste); işletme defterinde ya da Luca ekranı açılamazsa Fatura Kontrol'ün Luca otomasyonu arka planda
  async function muavinHam(fk,ay){
    const f=firmaOf(fk);
    // işletme / serbest meslek defteri: Gelir ve Gider Listesi de aynı Luca oturumuyla (gizli pencerede) alınır
    try{const r=await window.desktop.luca.muavinIndir({lucaId:String(fk.lucaId),ad:fk.ad,ay,defter:(f&&f.defter)||''});return {...r,yol:'luca'};}
    catch(e){const m=clean(e);if(/oturum|NO_SESSION|giriş|üye numara/i.test(m))throw e;return muavinYedek(fk,ay,m);}
  }
  async function muavinYedek(fk,ay,neden){
    const api=window.desktop.fk;await api.setFirms([{id:String(fk.lucaId),ad:fk.ad}],false).catch(()=>{});
    let s0={};try{s0=await api.topluDurum();}catch(e){}if(s0.calisiyor)throw new Error('Fatura Kontrol\'de başka bir Luca indirmesi sürüyor; bitince yeniden deneyin.');
    await api.muavinCek({id:String(fk.lucaId),ad:fk.ad,ay});
    for(;;){await new Promise(r=>setTimeout(r,3000));let d={};try{d=await api.topluDurum();}catch(e){}
      if(d.calisiyor)continue;
      const x=(d.sonuclar||[]).find(y=>String(y.id)===String(fk.lucaId));const ok=!!(x&&(x.adimlar||[]).some(a=>a.kod==='muavin'&&a.durum==='tamam'));
      if(!ok)throw new Error('Muavin indirilemedi'+(neden?' ('+neden+')':'')+': '+(((d.gunluk||[]).slice(-1)[0])||'ayrıntı Toplu Kontrol günlüğünde'));
      return {yol:'otomasyon'};}
  }
  function muavinBitti(fk,r){st.donemler=null;st.muavinCache={};const f=firmaOf(fk);if(f&&f.id!==st.firm){st.firm=f.id;st.dFirma='';}
    try{gunlukYaz('muavin',firmaOf(fk)||{id:'',name:fk.ad},{ad:'Muavin Luca\'dan indirildi'});}catch(x){}
    if(!$('#mmPanel').hidden)load();}
  async function muavinCekYerinde(fk,ay){
    if(!fk||!fk.lucaId){toast('Firmanın Luca karşılığı yok.');return;}
    try{await LucaBag.bekle();}catch(e){toast(clean(e));return;}
    const ad='Muavin çekiliyor · '+fk.ad;const bitti=r=>{muavinBitti(fk,r);toast(`${fk.ad}: muavin Luca'dan alındı${r&&r.satir?` (${r.satir} satır)`:''}.`);};
    try{const r=await arkaPlanli('Muavin Luca\'dan çekiliyor…',`${fk.ad} · ${ay.slice(0,4)} yılının tamamı. Luca raporu hazırlıyor; büyük firmalarda birkaç dakika sürebilir.`,()=>muavinHam(fk,ay),ad);
      if(r.arka){r.p.then(bitti,e=>toast(fk.ad+': '+clean(e)));return;}bitti(r.v);}
    catch(e){toast(fk.ad+': '+clean(e));}
  }
  // Tümünü Luca'dan çek: hesap planı → muavin → mizan (seçili firma, seçili yıl)
  async function tumunuCek(){
    const f=storeFirmalar().find(x=>x.id===st.firm)||(S.firm&&S.firm.id!==EXAMPLE_ID?S.firm:null);
    if(!f||!f.lucaId){toast('Önce Luca\'dan eklenmiş bir firma seçin.');return;}
    const sel=$('#mmYear')||$('#mmPlanYil');const yil=String((sel&&sel.value)||(f.mizanInfo||{}).year||new Date().getFullYear());
    try{await LucaBag.bekle();}catch(e){toast(clean(e));return;}
    const fk={ad:f.name,lucaId:f.lucaId,firm:f};const sonuc=[];
    const is=async durum=>{
      durum('1/3 · Hesap planı');try{const rows=await planCek(f,yil,{sessiz:true});sonuc.push(`hesap planı ${rows.length}`);}catch(e){sonuc.push('hesap planı alınamadı ('+clean(e)+')');}
      durum('2/3 · Muavin');try{const r=await muavinHam(fk,yilAyi(yil));sonuc.push(`muavin${r&&r.satir?' '+r.satir+' satır':''}`);muavinBitti(fk,r);}catch(e){sonuc.push('muavin alınamadı ('+clean(e)+')');}
      durum('3/3 · Mizan');try{const ff=storeFirmalar().find(x=>x.id===f.id)||f;await Desk.pullMizan(ff,yil);sonuc.push('mizan');}catch(e){sonuc.push('mizan alınamadı ('+clean(e)+')');}
      return sonuc;};
    const bitti=()=>{toast(`${f.name} ${yil}: ${sonuc.join(' · ')}.`);if(!$('#mmPanel').hidden)load();};
    try{const r=await arkaPlanli('Tümü Luca\'dan çekiliyor…',`${f.name} · ${yil}: hesap planı, muavin ve mizan sırayla alınıyor.`,is,'Luca\'dan çekiliyor · '+f.name);
      if(r.arka){r.p.then(bitti,e=>toast(clean(e)));return;}bitti();}
    catch(e){toast(clean(e));}
  }
  // Hesap Planı / Muavin / Mizan sekmeleri tek firmayı paylaşır; firma değişince programın ana firması da değişir (diğer modüller aynı firmayla açılır)
  const storeFirmalar=()=>{let all;try{all=Object.values(Store.local().firms||{});}catch(x){all=S.firms||[];}return all.filter(f=>f&&f.id&&f.id!==EXAMPLE_ID);};
  const donemFirmasi=(d,f)=>(f.lucaId&&d.luca_id&&String(d.luca_id)===String(f.lucaId))||N(d.firma)===N(f.name);
  async function firmaSec(id){st.firm=id;st.dFirma='';
    if(id&&S.firmId!==id&&(S.firms||[]).some(x=>x.id===id)){st.anaDegistiriyor=true;try{await selectFirm(id);renderFirmSel();}catch(e){}finally{st.anaDegistiriyor=false;}}}
  firmaDinle(({id})=>{if(st.anaDegistiriyor||$('#mmPanel').hidden||!id||id===EXAMPLE_ID||st.firm===id)return;st.firm=id;st.dFirma='';load();});
  function open(tab,o){if(tab)st.tab=tab;if(S.firm&&S.firm.id!==EXAMPLE_ID){st.firm=S.firm.id;st.dFirma='';}if(o&&o.ters){st.gorunum='ters';st.level='all';}LucaBag.yenile();$('#mmPanel').hidden=false;document.documentElement.style.overflow='hidden';st.donemler=null;load();}
  function close(){$('#mmPanel').hidden=true;document.documentElement.style.overflow='';}
  $('#mmClose').onclick=close;
  const menu=document.createElement('div');menu.className='mmmenu';menu.hidden=true;menu.setAttribute('role','menu');document.body.appendChild(menu);
  const menuKapat=()=>{menu.hidden=true;};
  $('#mmPanel').addEventListener('contextmenu',e=>{
    if((st.tab!=='mizan'&&st.tab!=='plan')||!e.target.closest('#mmTable'))return;e.preventDefault();
    const tr=e.target.closest('tr[data-kod]');const kod=tr&&tr.dataset.kod;
    const ekle=kod?`<button role="menuitem" data-hpek="${esc(kod)}"><span class="mk">＋</span>Bu hesabın altına hesap ekle (<span class="mono">${esc(kod)}</span>)</button>`:'';
    menu.innerHTML=st.tab==='plan'?(ekle||'<button disabled>Bir hesap satırına sağ tıklayın</button>')
      :Object.entries(GORUNUM).map(([k,v],i)=>`<button role="menuitemradio" aria-checked="${st.gorunum===k}" data-gor="${k}"><span class="mk">${st.gorunum===k?'✓':''}</span>${i+1}. ${esc(v)}</button>`).join('')+(ekle?'<hr style="margin:4px 0;border:0;border-top:1px solid var(--line)">'+ekle:'');
    menu.hidden=false;const W=menu.offsetWidth,H=menu.offsetHeight;
    menu.style.left=Math.min(e.clientX,innerWidth-W-8)+'px';menu.style.top=Math.min(e.clientY,innerHeight-H-8)+'px';menu.querySelector('button').focus();});
  menu.addEventListener('click',e=>{const he=e.target.closest('[data-hpek]');if(he){menuKapat();hesapEkleAc(he.dataset.hpek+'.');return;}
    const b=e.target.closest('[data-gor]');if(!b)return;st.gorunum=b.dataset.gor;const sel=$('#mmGorunum');if(sel)sel.value=st.gorunum;menuKapat();draw();});
  document.addEventListener('click',e=>{if(!menu.hidden&&!e.target.closest('.mmmenu'))menuKapat();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!menu.hidden){e.stopPropagation();menuKapat();}},true);
  document.addEventListener('keydown',e=>{if(e.key!=='Escape'||$('#mmPanel').hidden)return;if(!$('#mmFis').hidden){$('#mmFis').hidden=true;return;}if(!$('#mmYk').hidden){ykKapat();return;}
    if(st.hesapF&&st.geriTab&&$('#chooseModal').hidden){hesapGeri();return;}if($('#chooseModal').hidden)close();});
  // Mizanda bir hesaba tıklayınca: muavin sekmesinde yalnız o hesabın hareketleri (alt hesaplarıyla), tarih sırasıyla, yürüyen bakiye
  function hesapAc(kod){const r=(st.rows||[]).find(x=>x.kod===kod)||{};let f=null;try{f=(Store.local().firms||{})[st.firm];}catch(x){}
    st.mizanKonum={kod,top:($('#mmTable')&&$('#mmTable').closest('.mmwrap')||{}).scrollTop||0,f:{...st.f},sort:st.sort,q:st.q};
    st.hesapF=kod;st.hesapAd=r.ad||'';st.geriTab=st.tab==='plan'?'plan':'mizan';st.hesapYil=f&&f.mizanInfo&&f.mizanInfo.year;st.hesapYeni=true;
    st.tab='muavin';st.grup=false;st.f={};st.sort=null;st.q='';load();}
  function hesapGeri(){const k=st.mizanKonum||{};st.tab=st.geriTab||'mizan';st.hesapF=null;st.geriTab=null;st.f=k.f||{};st.sort=k.sort||null;st.q=k.q||'';
    Promise.resolve(load()).then(()=>{setTimeout(()=>{const w=$('#mmTable')&&$('#mmTable').closest('.mmwrap');if(w&&k.top)w.scrollTop=k.top;const tr=k.kod&&document.querySelector(`#mmTable tr[data-kod="${CSS.escape(k.kod)}"]`);if(tr){tr.classList.add('sec');if(!k.top)tr.scrollIntoView({block:'center'});}},60);});}
  $('#mmPanel').addEventListener('click',async e=>{
    const t=e.target.closest('[data-mmtab]');if(t){st.tab=t.dataset.mmtab;st.f={};st.sort=null;st.q='';st.hesapF=null;st.geriTab=null;load();return;}
    if(e.target.closest('[data-mmhx]')){st.hesapF=null;st.geriTab=null;st.f={};st.sort=null;load();return;}
    if(e.target.closest('[data-mmgeri]')){hesapGeri();return;}
    {const tr=(st.tab==='mizan'||st.tab==='plan')&&!e.target.closest('input,button,select,a')&&e.target.closest('#mmTable tbody tr[data-mzhesap]');
      if(tr&&tr.dataset.kod){hesapAc(tr.dataset.kod);return;}}
    const fb=e.target.closest('[data-mmfis]');if(fb){showFis(fb.dataset.mmfis);return;}
    const so=e.target.closest('[data-mmsort]');if(so){const k=so.dataset.mmsort;st.sort=st.sort&&st.sort.k===k?(st.sort.d>0?{k,d:-1}:null):{k,d:1};draw();return;}
    if(e.target.id==='mmRefresh'){st.donemler=null;st.muavinCache={};load();return;}
    const yk=e.target.closest('[data-mmyukle]');if(yk){yukleAc(yk.dataset.mmyukle);return;}
    if(e.target.closest('[data-mmcek]')){cekAc();return;}
    if(e.target.closest('#mmTumCek')){tumunuCek();return;}
    if(e.target.id==='mmHesapEkle'){hesapEkleAc();return;}
    if(e.target.id==='mmPlanCek'){let all;try{all=Object.values(Store.local().firms||{});}catch(x){all=S.firms||[];}const f=all.find(x=>x.id===st.firm);if(!f)return;
      try{const rows=await planCek(f,$('#mmPlanYil').value);toast(`${f.name}: hesap planı alındı (${rows.length} hesap).`);load();}catch(x){toast(clean(x));}return;}
    if(e.target.id==='mmPull'){let all;try{all=Object.values(Store.local().firms||{});}catch(x){all=S.firms||[];}const f=all.find(x=>x.id===st.firm);if(!f)return;e.target.disabled=true;e.target.textContent='Çekiliyor…';
      try{await LucaBag.bekle();
        await Busy.run('Mizan hazırlanıyor…',f.name+' · '+$('#mmYear').value+' dönemi Luca\'dan okunuyor',()=>Desk.pullMizan(f,$('#mmYear').value));toast(f.name+' mizanı güncellendi.');}catch(x){toast(clean(x));}finally{load();}return;}
  });
  $('#mmPanel').addEventListener('input',e=>{
    if(e.target.id==='mmQ'){st.q=e.target.value;draw();return;}
    const f=e.target.dataset.mmf;if(f!=null){st.f[f]=e.target.value;const pos=e.target.selectionStart;draw();const n=document.querySelector(`[data-mmf="${f}"]`);if(n){n.focus();n.setSelectionRange(pos,pos);}}
  });
  $('#mmPanel').addEventListener('change',e=>{
    if(e.target.id==='mmFirm'){firmaSec(e.target.value).then(load);}
    else if(e.target.id==='mmMvFirm'){const v=e.target.value;if(v.startsWith('s:'))firmaSec(v.slice(2)).then(load);else{st.firm='';st.dFirma=v.slice(2);load();}}
    else if(e.target.id==='mmDonem'){st.mvDonem=e.target.value;load();}
    else if(e.target.id==='mmMvBas'||e.target.id==='mmMvBit'){st[e.target.id==='mmMvBas'?'mvBas':'mvBit']=e.target.value;load();}
    else if(e.target.id==='mmMzKaynak'||e.target.id==='mmMzAy'||e.target.id==='mmMzBas'||e.target.id==='mmMzBit'){const k=e.target.id;st.mz={...(st.mz||{}),[k==='mmMzKaynak'?'kaynak':k==='mmMzAy'?'ay':k==='mmMzBas'?'bas':'bit']:e.target.value};if(k==='mmMzAy'&&e.target.value!=='aralik'){st.mz.bas='';st.mz.bit='';}load();}
    else if(e.target.id==='mmLevel'){st.level=e.target.value;draw();}
    else if(e.target.id==='mmGorunum'){st.gorunum=e.target.value;draw();}
    else if(e.target.id==='mmGrup'){st.grup=e.target.checked;st.f={};st.sort=null;load();}
  });
  $('#mmXls').onclick=async()=>{
    const rows=filtered();if(!rows.length){toast('Aktarılacak satır yok.');return;}
    const aoa=[st.cols.map(c=>c[1]),...rows.map(r=>st.cols.map(([k,,num])=>num?(+r[k]||0):k==='tarih'?trd(r[k]):(r[k]??'')))];
    const ws=XLSX.utils.aoa_to_sheet(aoa);const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,st.tab==='mizan'?'Mizan':st.tab==='plan'?'Hesap Planı':'Muavin');
    const ad=(st.tab==='plan'?(((S.firms||[]).find(x=>x.id===st.firm)||{}).name||'firma')+'_hesap_plani':st.tab==='mizan'?(((S.firms||[]).find(x=>x.id===st.firm)||{}).name||'firma')+'_mizan':st.donem.replace(/\//g,'_')+'_muavin'+(st.grup?'_ozet':''));
    try{const r=await window.desktop.saveFile(ad.replace(/[^\wÇĞİÖŞÜçğıöşü.-]+/g,'_')+'.xlsx',new Uint8Array(XLSX.write(wb,{type:'array',bookType:'xlsx'})));if(r.ok)toast('Kaydedildi: '+r.path);}catch(x){toast(clean(x));}
  };
  return {open,close,_st:st,_mojibake:mojibakeDuzelt};
})();
$('#mmBtn').addEventListener('click',()=>MMUI.open('mizan'));
// Luca'da Çalış: kullanıcının kendi çalışacağı, programın sorgu yapmadığı tam ekran Luca penceresi (MuhaWin'in önünde)
if(window.desktop&&window.desktop.luca&&window.desktop.luca.calis){$('#lucaCalisBtn').hidden=false;
  $('#lucaCalisBtn').addEventListener('click',async()=>{const b=$('#lucaCalisBtn');b.disabled=true;
    try{const r=await window.desktop.luca.calis();if(r&&r.error)toast(r.error);else if(r&&r.giris)toast("Luca giriş ekranı açıldı. Giriş yapınca çalışma penceresi tam ekran açılacak.");
      else if(r&&r.elle)toast("Luca ekranı öne geldi. Sol üstte firma / dönem seçiminin altındaki beyaz pencere düğmesine basın; açılan pencere tam ekran çalışma penceresi olur.");}
    catch(e){toast('Luca açılamadı: '+(e.message||e));}finally{setTimeout(()=>b.disabled=false,1500);}});}

/* ---------- ÖKC Fiş Girişi: yazar kasa fişleri ve Z raporları → okuma (OCR) → muhasebe fişi → Luca ---------- */
const OKC=(()=>{
  const api=window.__mwApi||window.desktop;
  const clean=e=>String(e&&e.message||e).replace(/^Error invoking remote method '[^']+': (Error: )?/,'');
  const ORANLAR=[1,8,10,18,20];
  const st={fid:'',tur:'fis',filtre:'kayitsiz',acc:new Map(),leaf:new Set(),efTut:new Set(),belgeTuru:'',busy:false,stop:false,birlestir:'ayri'};
  const local=()=>{try{return Store.local();}catch(e){return {firms:{},okc:{},okckural:{}};}};
  async function dataOp(n,a){const d=await api.dataOp(n,a);Store.cache=d;return d;}
  let f0=null;const firma=()=>{if(!f0||f0.id!==st.fid)f0=(local().firms||{})[st.fid]||null;return f0;};
  async function firmaKaydet(y){await Store.saveFirm(y);f0=y;}
  const ayar=()=>((firma()||{}).okcAyar)||{};
  const belgeler=()=>Object.values((local().okc||{})[st.fid]||{});
  // Eksik / Dolu: üzerinde çalışılan belge (tıklanan / düzenlenen) süzgeç yeniden seçilene ya da Luca'ya kaydedilene kadar listede kalır
  const efTutOkc=e=>{if(!st.ef||!e.target.closest)return;let tr=e.target.closest('#okcTable tr');if(!tr)return;
    if(!tr.dataset.id){const d=tr.closest('tr.fisdetay')||(tr.parentElement&&tr.parentElement.closest('tr.fisdetay'));tr=d&&d.previousElementSibling;}
    if(tr&&tr.dataset.id)st.efTut.add(tr.dataset.id);};
  for(const ev of ['click','change','input','focusin'])document.addEventListener(ev,efTutOkc,true);
  const kurallar=()=>Object.values((local().okckural||{})[st.fid]||{});
  const dmy=iso=>iso?String(iso).slice(0,10).split('-').reverse().join('.'):'';
  const dmyS=iso=>iso?String(iso).slice(0,10).split('-').reverse().join('/'):'';

  /* ---- okuma: OCR metninden alanlar ---- */
  /* OKC-AYRISTIRICI-BAS — OCR metninden fiş / Z raporu alanları (OCR hatalarına toleranslı) */
  function sayi(s){let t=String(s).replace(/[*\s]/g,'');const v=t.lastIndexOf(','),n=t.lastIndexOf('.');const d=Math.max(v,n);
    if(d>=0&&t.length-d-1===2){t=t.slice(0,d).replace(/[.,]/g,'')+'.'+t.slice(d+1);}else t=t.replace(/[.,]/g,'');const x=parseFloat(t);return isFinite(x)?x:null;}
  // satırdaki tutar adayları: {v, alt} — alt: baştaki '*' işaretinin 4 / 1 / # okunduğu durum için ilk hane atılmış değer
  function adaylar(l){
    let t=String(l).replace(/(\d)\s+([.,])\s*(\d)/g,'$1$2$3').replace(/(\d[.,])\s+(\d{2})(?!\d)/g,'$1$2').replace(/(\d{1,3}(?:[.,]\d{3})+)\s(\d{2})(?!\d)/g,'$1,$2');
    const out=[];
    for(const m of t.matchAll(/(\d{1,3}(?:[.,]\d{3})*[.,]\d{2})(?!\d)/g)){const raw=m[1];const v=sayi(raw);if(v==null)continue;
      let alt=null;if(/^[41]/.test(raw)&&raw.replace(/\D/g,'').length>=4){const r2_=raw.slice(1).replace(/^[.,]/,'');alt=sayi(r2_);}
      out.push({v,alt});}
    return out;
  }
  function tutarlar(l){return adaylar(l).map(x=>x.v);}
  function sonTutar(l){const t=tutarlar(l);return t.length?t[t.length-1]:null;}
  function oranTok(tok){
    const t=String(tok).replace(/[—–:|()]/g,'').trim();
    let m=t.match(/^[%xX×S$*ş§#49]\s?(1|8|10|18|20)$/i);if(m)return +m[1];
    m=t.match(/^5(1|8|10|18|20)$/);if(m)return +m[1];
    return null;
  }
  function satirOrani(l){const T=l.split(/\s+/).filter(x=>x&&!/^[—–\-|]$/.test(x));for(const tok of T){const o=oranTok(tok);if(o!=null)return o;}
    for(let i=1;i<T.length;i++)if(/\d[.,]\d{2}$/.test(T[i])&&/^(1|8|10|18|20)$/.test(T[i-1]))return +T[i-1];   /* % işareti hiç okunmadıysa: tutardan hemen önceki oran */const m=l.match(/%\s?(\d{1,2})\b/);return m&&ORANLAR.includes(+m[1])?+m[1]:null;}
  const UST=s=>N(s);
  const harf=s=>N(s).replace(/[^A-Z0-9]/g,'');
  const topkdvMi=U=>{const k=U.replace(/[^A-Z0-9]/g,'');return /^[TVY][O0D]?[PRF]?K[DO0]?[VY]/.test(k)&&k.length<=9||/^TOP\s*K[A-Z0-9]?\s*V\b/.test(U);};
  const toplamMi=U=>{const k=U.replace(/[^A-Z0-9]/g,'');return /^(GENEL)?T[O0]PLA[MN]/.test(k)&&!/ARA/.test(U);};
  function yilDuzelt(y,a){const b=new Date();const Y=b.getFullYear();y=+y;if(y>=Y-1&&y<=Y)return y;return (+a>b.getMonth()+1)?Y-1:Y;}
  function ortak(text){
    const L=String(text||'').split(/\r?\n/).map(x=>x.replace(/^[\s|(“"'`‘’.,;:\-_]+|[\s|“"'`‘’]+$/g,'').trim()).filter(Boolean);
    const r={};const J=L.join(' ');
    const tm=J.match(/(\d{2})\s?[./-]\s?(\d{2})\s?[./-]\s?(\d{4})/);if(tm&&+tm[2]>=1&&+tm[2]<=12&&+tm[1]>=1&&+tm[1]<=31)r.tarih=`${yilDuzelt(tm[3],tm[2])}-${tm[2]}-${tm[1]}`;
    const sm=J.match(/SAAT\s*[:.]?\s*(\d{2})[:.](\d{2})/i)||J.match(/\b(\d{2}):(\d{2})\b/);if(sm)r.saat=sm[1]+':'+sm[2];
    const fn=J.match(/F[İIi1lT]\s?[ŞS]\s*N[O0]\s*[:.,]?\s*([0-9OoDÜ]{2,6})/i);if(fn)r.fisNo=fn[1].replace(/[OoDÜ]/g,'0');
    const zn=J.match(/\bZ\s*N[O0]\s*[:.]?\s*(\d+)/i);if(zn)r.zNo=zn[1];
    const ek=J.match(/EK[ÜUÖO]\s*N[O0]\s*[:.]?\s*(\d+)/i);if(ek)r.ekuNo=ek[1];
    for(const l of L.slice(0,9)){const m=l.match(/\b(\d{10,11})\b/);if(m&&/V\.?\s?D|VKN|VERG|TCKN|V\.N/i.test(UST(l)+l)){r.vkn=m[1];break;}}
    if(!r.vkn){for(const l of L.slice(0,9)){const m=l.match(/\b(\d{10,11})\b/);if(m&&!/TEL/i.test(l)){r.vkn=m[1];break;}}}
    r.unvan=(L.find(l=>/[A-Za-zÇĞİÖŞÜçğıöşü]{3}.*[A-Za-zÇĞİÖŞÜçğıöşü]{3}/.test(l)&&!/TAR[İI]H|F[İI]Ş|Z\s*RAPOR/i.test(l)&&(l.match(/[A-Za-zÇĞİÖŞÜçğıöşü]/g)||[]).length>l.length*0.6)||'').replace(/\s{2,}/g,' ');
    return {L,r};
  }
  function oranlariKur(brut){
    return Object.entries(brut).filter(([,g])=>g>0).map(([o,g])=>{o=+o;const kdv=r2(g*o/(100+o));return {oran:o,matrah:r2(g-kdv),kdv};}).sort((a,b)=>a.oran-b.oran);
  }
  const yakin=(a,b,t=0.051)=>a!=null&&b!=null&&Math.abs(a-b)<=t;
  function fisOku(text){
    const {L,r}=ortak(text);const kalem=[];const oy=new Map();let kdvAday=[];let kredi=false,nakit=false;
    const oyla=(c,w)=>{for(const x of c){oy.set(x.v,(oy.get(x.v)||0)+w);if(x.alt!=null)oy.set(x.alt,(oy.get(x.alt)||0)+w*0.9);}};
    let toplamAday=[];
    for(const l of L){const U=UST(l);const c=adaylar(l);
      if(/KRED|KART|MASTERCARD|VISA|ONAY\s*KOD|TEMASSIZ|POS\s*N/.test(U))kredi=true;
      if(/^NAK[I1]T/.test(U))nakit=true;
      if(topkdvMi(U)){kdvAday=kdvAday.concat(c);continue;}
      if(toplamMi(U)){toplamAday=toplamAday.concat(c);oyla(c,3);continue;}
      if(/KRED|KART|NAK[I1]T|TUTAR|ODENEN/.test(U)&&!/KDV/.test(U)){oyla(c,2);continue;}
      if(/^(KDV|ARA\s*TOPLAM|PARA\s*[UÜ]ST|EKU|Z\s*N|F[İI]S|ISYERI|TERMINAL|REF|SN\b)/.test(U))continue;
      const o=satirOrani(l);if(o==null||!c.length)continue;kalem.push({o,c:c[c.length-1],ad:l.replace(/[%xX×S$*ş§#]?\s?\d.*$/,'').replace(/[^A-Za-zÇĞİÖŞÜçğıöşü0-9 ./-]/g,'').trim()});
    }
    // kalemler: tek kalemde toplamla tutan aday seçilir
    for(const k of kalem)oyla([k.c],1);
    let toplam=null,en=0;for(const [v,n] of oy){if(n>en||(n===en&&v>toplam)){en=n;toplam=v;}}
    if(toplamAday.length&&!toplam)toplam=toplamAday[toplamAday.length-1].v;
    r.toplam=toplam;
    // oranlar: kalemlerin brüt tutarları (OCR'ın baş hanesi hatasına göre toplamla tutan seçim)
    const brut={};
    if(kalem.length){const s1=r2(kalem.reduce((t,k)=>t+k.c.v,0)),s2=r2(kalem.reduce((t,k)=>t+(k.c.alt!=null&&k.c.v>toplam?k.c.alt:k.c.v),0));
      const seç=yakin(s1,toplam)?'v':yakin(s2,toplam)?'a':null;
      if(seç)for(const k of kalem)brut[k.o]=r2((brut[k.o]||0)+(seç==='a'&&k.c.alt!=null&&k.c.v>toplam?k.c.alt:k.c.v));
      else{const os=[...new Set(kalem.map(k=>k.o))];if(os.length===1&&toplam)brut[os[0]]=toplam;}}
    // TOPKDV: adaylardan toplam ve oranla tutarlı olan
    const kd=[];for(const x of kdvAday)kd.push(x.v);for(const x of kdvAday)if(x.alt!=null)kd.push(x.alt);   // önce okunan değer, sonra '*'→4 düzeltmesi
    if(!Object.keys(brut).length&&toplam){for(const k of kd)for(const o of ORANLAR)if(yakin(r2(toplam*o/(100+o)),k,0.06)){brut[o]=toplam;break;}}
    r.oranlar=oranlariKur(brut);
    const kSum=r2(r.oranlar.reduce((s,x)=>s+x.kdv,0));
    r.topkdv=kd.find(k=>yakin(k,kSum,0.06))??(kdvAday.length?kdvAday[kdvAday.length-1].v:null);
    if(!r.oranlar.length&&toplam&&r.topkdv&&r.topkdv<toplam){const h=r.topkdv/(toplam-r.topkdv)*100;const o=ORANLAR.reduce((a,b)=>Math.abs(b-h)<Math.abs(a-h)?b:a);r.oranlar=[{oran:o,matrah:r2(toplam-r.topkdv),kdv:r.topkdv}];}
    if(r.topkdv!=null&&r.oranlar.length){const k=r2(r.oranlar.reduce((s,x)=>s+x.kdv,0));const fark=r2(r.topkdv-k);
      if(fark&&Math.abs(fark)<=0.05){const b=r.oranlar.reduce((a,x)=>x.kdv>a.kdv?x:a);b.kdv=r2(b.kdv+fark);b.matrah=r2(b.matrah-fark);}}
    r.kalemler=kalem.map(k=>k.ad).filter(x=>x&&x.length>=2);
    r.odeme=kredi&&!nakit?'kredi':nakit&&!kredi?'nakit':kredi?'kredi':'nakit';
    if(r.odeme==='kredi')r.kredi=toplam;else r.nakit=toplam;
    return r;
  }
  /* OKC-AYRISTIRICI-SON */
  function zOku(text){
    const {L,r}=ortak(text);const kdv={},brut={};
    for(const l of L){const U=UST(l);
      if(/K[UÜ]M[UÜ]LAT/.test(U))continue;
      if(/^TOP\s*K[A-Z0-9]?\s*V\b/.test(U)){r.topkdv=sonTutar(l);continue;}
      if(/^(GENEL\s*)?TOPLAM\b/.test(U)&&satirOrani(l)==null){r.toplam=sonTutar(l);continue;}
      if(/^NAK[I]T/.test(U)){r.nakit=sonTutar(l);continue;}
      if(/KRED[I]|KART/.test(U)){r.kredi=sonTutar(l);continue;}
      if(/F[I]S\s*SAYISI/.test(U)){const m=l.match(/(\d+)\s*$/);if(m)r.fisSayisi=+m[1];continue;}
      const o=satirOrani(l);const t=sonTutar(l);if(o==null||t==null)continue;
      if(/KDV/.test(U))kdv[o]=t;else if(/TOPLAM|MATRAH|SATIS/.test(U))brut[o]=t;
    }
    const os=[...new Set([...Object.keys(kdv),...Object.keys(brut)].map(Number))].sort((a,b)=>a-b);
    r.oranlar=os.map(o=>{const g=brut[o],k=kdv[o];
      if(g!=null&&k!=null)return {oran:o,matrah:r2(g-k),kdv:k};
      if(g!=null){const kk=r2(g*o/(100+o));return {oran:o,matrah:r2(g-kk),kdv:kk};}
      return {oran:o,matrah:r2(k*100/o),kdv:k};}).filter(x=>x.matrah>0||x.kdv>0);
    return r;
  }
  /* ---- yurt dışı faturaları (Meta, Google vb.): ödenen net tutar → brüt; %15 stopaj (360), %20 sorumlu sıfatıyla KDV (191 borç / 360 alacak) ---- */
  const pd=n=>String(n).padStart(2,'0');
  const AYLAR={OCA:1,JAN:1,SUB:2,FEB:2,MAR:3,NIS:4,APR:4,MAY:5,HAZ:6,JUN:6,TEM:7,JUL:7,AGU:8,AUG:8,EYL:9,SEP:9,EKI:10,OCT:10,KAS:11,NOV:11,ARA:12,DEC:12};
  const YD_SATICI=[[/META PLATFORMS|FACEBOOK|INSTAGRAM|^(\d+ )?META\b|\bMETA REKLAM|\bMATA REKLAM/,'Meta Platforms Ireland Limited','reklam'],[/GOOGLE/,'Google Ireland Limited','reklam'],[/LINKEDIN/,'LinkedIn Ireland','reklam'],[/TIKTOK/,'TikTok','reklam'],[/TWITTER|X CORP/,'X Corp','reklam'],[/YANDEX/,'Yandex','reklam'],
    [/MICROSOFT/,'Microsoft Ireland','yazilim'],[/AMAZON WEB SERVICES|\bAWS\b/,'Amazon Web Services','yazilim'],[/APPLE/,'Apple Distribution International','yazilim'],[/ADOBE/,'Adobe Systems Software Ireland','yazilim'],[/CANVA/,'Canva','yazilim'],[/ZOOM/,'Zoom Video Communications','yazilim'],[/OPENAI/,'OpenAI','yazilim'],[/ANTHROPIC/,'Anthropic','yazilim'],[/SPOTIFY/,'Spotify','yazilim']];
  function ydTarih(s){let m=String(s).match(/(\d{1,2})\s*[./-]\s*(\d{1,2})\s*[./-]\s*(\d{4})/);if(m&&+m[2]>=1&&+m[2]<=12&&+m[1]>=1&&+m[1]<=31)return `${m[3]}-${pd(m[2])}-${pd(m[1])}`;
    m=String(s).match(/(\d{4})-(\d{2})-(\d{2})/);if(m)return m[0];
    const t=N(s);m=t.match(/\b(\d{1,2}) ([A-Z]{3})[A-Z]* (\d{4})\b/);if(m&&AYLAR[m[2]]&&+m[1]<=31)return `${m[3]}-${pd(AYLAR[m[2]])}-${pd(m[1])}`;
    m=t.match(/\b([A-Z]{3})[A-Z]* (\d{1,2}) (\d{4})\b/);if(m&&AYLAR[m[1]]&&+m[2]<=31)return `${m[3]}-${pd(AYLAR[m[1]])}-${pd(m[2])}`;return null;}
  const PBK=s=>/TRY|\bTL\b|₺/.test(s)?'TRY':/USD|\$/.test(s)?'USD':/EUR|€/.test(s)?'EUR':/GBP|£/.test(s)?'GBP':'';
  function ydOku(text){
    const L=String(text||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);const J=L.join('\n');const U=N(J);const r={};
    const ti=J.search(/TAR[İI]H|DATE|Tarih/i);r.tarih=(ti>=0&&ydTarih(J.slice(ti,ti+90)))||ydTarih(J);
    // ödenen tutar: "Ödendi / Toplam / Total / Amount paid" yanında, para birimiyle yazılmış en büyük tutar
    const para=[];
    for(let i=0;i<L.length;i++){const l=L[i];const u=N(l);const kw=/ODENDI|TOPLAM|TOTAL|AMOUNT|PAID|ODENEN|GRAND/.test(u)||(i>0&&/^(ODENDI|TOPLAM|TOTAL|AMOUNT PAID|PAID)$/.test(N(L[i-1])));
      for(const m of l.matchAll(/(₺|\$|€|£)?\s?(\d{1,3}(?:[.,]\d{3})+[.,]\d{2}|\d+[.,]\d{2})(?!\d)\s?(TRY|TL|USD|EUR|GBP)?/g)){const v=sayi(m[2]);if(!v)continue;const pb=PBK((m[1]||'')+' '+(m[3]||''));para.push({v,pb,w:(kw?2:0)+(pb?1:0)});}}
    const en=para.sort((a,b)=>b.w-a.w||b.v-a.v)[0];
    r.doviz=en?en.v:null;r.pb=(en&&en.pb)||PBK(J)||'TRY';r.toplam=r.doviz;
    const fm=J.match(/(?:FATURA|INVOICE)\s*(?:#|NO\.?|NUMARASI|NUMBER|NUM\.?)\s*[:.]?\s*([A-Z0-9][A-Z0-9\-\/.]{3,})/i)||J.match(/(?:REFERANS NUMARASI|REFERENCE NUMBER|REFERENCE|TRANSACTION ID|İŞLEM KODU|ISLEM KODU)\s*[:.]?\s*([A-Z0-9][A-Z0-9\-]{3,})/i);
    r.no=fm?fm[1].replace(/[.]$/,''):'';r.fisNo=r.no;
    const vat=[...J.matchAll(/VAT\s*(?:REG(?:ISTRATION)?\.?)?\s*(?:NO\.?|NUMBER|ID)?\s*[:.]?\s*([A-Z]{2}\s?[0-9A-Z]{6,14}|\d{10,11})/gi)].map(m=>m[1].replace(/\s/g,''));
    r.vkn=vat.find(v=>/^[A-Z]{2}/.test(v)&&!/^TR/.test(v))||'';r.aliciVkn=vat.find(v=>/^\d{10,11}$/.test(v))||'';
    const ks=YD_SATICI.find(([re])=>re.test(U));
    r.unvan=ks?ks[1]:(L.find(l=>/\b(LIMITED|LTD|LLC|INC|GMBH|B\.?V|PLC|PTE|CORP(ORATION)?|S\.?A\.?R\.?L|AG)\b\.?/i.test(l)&&!/İÇİN|ICIN|FOR\b/i.test(l))||'').trim().slice(0,120);
    r.hizmet=(ks&&ks[2])||(/REKLAM|\bADS\b|ADVERTIS|KAMPANYA|CAMPAIGN/.test(U)?'reklam':'hizmet');
    r.odeme=/HAVALE|\bEFT\b|WIRE|BANK TRANSFER/.test(U)?'banka':'kredi';
    r.kalemler=[r.hizmet==='reklam'?'yurt dışı reklam':'yurt dışı hizmet'];
    r.net=r.pb==='TRY'?r.doviz:null;
    return r;
  }
  const ydOran=b=>({so:b.stopajO!=null&&b.stopajO!==''?+b.stopajO:(ayar().ydStopajO!=null&&ayar().ydStopajO!==''?+ayar().ydStopajO:15),ko:b.kdvO!=null&&b.kdvO!==''?+b.kdvO:(ayar().ydKdvO!=null&&ayar().ydKdvO!==''?+ayar().ydKdvO:20)});
  const ydNet=b=>b.net!=null&&b.net!==''?r2(+b.net):(!b.pb||b.pb==='TRY')?r2(+b.doviz||0):(b.kur?r2((+b.doviz||0)*b.kur):0);
  function ydHesap(b){const {so,ko}=ydOran(b);const net=ydNet(b);const brut=so>0&&so<100?r2(net/(1-so/100)):net;return {net,brut,sto:r2(brut-net),kdv:r2(brut*ko/100),so,ko};}
  async function ydKurAl(bs){const ist=bs.filter(b=>b.pb&&b.pb!=='TRY'&&b.tarih&&b.net==null).map(b=>({pb:b.pb,tarih:b.tarih}));if(!ist.length)return;
    try{const k=await api.tcmbKurlar(ist);for(const b of bs){const v=(k.kurlar||{})[b.pb+'|'+b.tarih];if(v){b.kur=v.kur;b.kurBulten=v.bulten;}}if((k.hatalar||[]).length)toast('TCMB kuru: '+k.hatalar[0]);}catch(e){toast('TCMB kuru alınamadı: '+clean(e));}}
  // PDF fatura: metin pdf.js ile; ilk sayfa görüntüye çizilip yanına kaydedilir (taranmış PDF'te görüntü okunur)
  async function ydPdf(x,buf){
    const pdfjsLib=await pdfKutuphane();
    const pdf=await pdfjsLib.getDocument({data:new Uint8Array(buf),isEvalSupported:false}).promise;const sat=[];
    for(let i=1;i<=Math.min(pdf.numPages,10);i++){const pg=await pdf.getPage(i);const tc=await pg.getTextContent();const m=new Map();
      for(const it of tc.items){if(!it.str||!it.str.trim())continue;const y=Math.round((it.transform?it.transform[5]:0)/3);if(!m.has(y))m.set(y,[]);m.get(y).push({x:it.transform?it.transform[4]:0,s:it.str});}
      for(const y of [...m.keys()].sort((a,b)=>b-a))sat.push(m.get(y).sort((a,b)=>a.x-b.x).map(z=>z.s).join(' '));}
    let png=null;try{const pg=await pdf.getPage(1);const vp=pg.getViewport({scale:1.6});const cv=document.createElement('canvas');cv.width=Math.ceil(vp.width);cv.height=Math.ceil(vp.height);
      const cx=cv.getContext('2d');cx.fillStyle='#fff';cx.fillRect(0,0,cv.width,cv.height);await pg.render({canvasContext:cx,viewport:vp}).promise;
      png=await new Promise(res=>cv.toBlob(bl=>bl?bl.arrayBuffer().then(a=>res(new Uint8Array(a))):res(null),'image/png'));}catch(e){png=null;}
    const text=sat.join('\n');const az=text.replace(/\s/g,'').length<40;
    const r=await api.okc.pdfPng({img:x.img,png,ocr:az});
    return {url:r.url,text:az&&r.text!=null?r.text:text,conf:az&&r.conf!=null?r.conf:100};}
  function denetle(b){
    if(b.tur==='yd'){const u=[];if(!b.tarih)u.push('Tarih okunamadı');if(!b.no)u.push('Fatura no okunamadı');if(!b.doviz&&!b.net)u.push('Tutar okunamadı');if(!b.unvan)u.push('Satıcı okunamadı');
      if(b.pb&&b.pb!=='TRY'&&!b.kur&&b.net==null)u.push(b.pb+' kuru alınamadı');
      if(b.no&&belgeler().some(x=>x.id!==b.id&&x.tur==='yd'&&x.no===b.no&&(x.vkn||'')===(b.vkn||'')))u.push('Bu fatura daha önce eklenmiş (mükerrer)');return u;}
    const u=[];const top=r2((b.oranlar||[]).reduce((s,x)=>s+x.matrah+x.kdv,0));
    if(!b.tarih)u.push('Tarih okunamadı');
    if(!(b.oranlar||[]).length)u.push('KDV oranları / tutarları okunamadı');
    if(b.toplam!=null&&Math.abs(top-b.toplam)>0.05)u.push(`Satırlar toplamı ${fmt(top)} ≠ belge toplamı ${fmt(b.toplam)}`);
    if(b.topkdv!=null&&Math.abs(r2((b.oranlar||[]).reduce((s,x)=>s+x.kdv,0))-b.topkdv)>0.05)u.push('KDV toplamı belgeyle tutmuyor');
    if(b.tur==='z'&&b.nakit!=null&&b.kredi!=null&&b.toplam!=null&&Math.abs(b.nakit+b.kredi-b.toplam)>0.05)u.push('Nakit + kredi ≠ toplam');
    if(b.tur==='fis'&&!b.fisNo)u.push('Fiş no okunamadı');
    if(b.tur==='z'&&!b.zNo)u.push('Z no okunamadı');
    return u;
  }
  const toplamOf=b=>b.tur==='yd'?ydNet(b):b.toplam!=null?b.toplam:r2((b.oranlar||[]).reduce((s,x)=>s+x.matrah+x.kdv,0));

  /* ---- hesaplar: mizan, kural, ayarlar ---- */
  async function hesaplariYukle(){
    st.acc=new Map();st.leaf=new Set();const f=firma();let miz=[];
    if(f&&f.mizanInfo){try{miz=await Store.getMizan(f.id,f.mizanInfo.parts)||[];}catch(e){}}
    for(const r of miz)if(r&&r[0])st.acc.set(String(r[0]),String(r[1]||''));
    const ust=new Set();for(const c of st.acc.keys()){const p=c.lastIndexOf('.');if(p>0)ust.add(c.slice(0,p));}
    for(const c of st.acc.keys())if(!ust.has(c))st.leaf.add(c);
    // hesap planı (mizanda hareketi olmayan 950/951 nazım hesapları vb. için)
    st.plan=new Map();if(f&&f.lucaId){try{const m=await HESAP.hesaplar(f);for(const [k,v] of m)st.plan.set(String(k),String(v||''));}catch(e){}}
    $('#okcAccList').innerHTML=[...st.acc.entries()].filter(([c])=>st.leaf.has(c)).sort((a,b)=>a[0].localeCompare(b[0],'tr',{numeric:true})).map(([c,n])=>`<option value="${esc(c)}">${esc(n)}</option>`).join('');
  }
  function kdvHesap(grp,oran){
    const a=ayar();const k=(a.kdv||{})[grp+'_'+oran];if(k)return k;
    const leaf=[...st.leaf].filter(c=>c.startsWith(grp)&&!/TEVK/.test(N(st.acc.get(c))));
    const re=new RegExp('(%\\s*'+oran+'(?!\\d))|((^|\\D)'+oran+'\\s*%)|(KDV\\s*'+oran+'(?!\\d))','i');
    return leaf.find(c=>re.test(st.acc.get(c)||''))||leaf.find(c=>new RegExp('[.]0?'+oran+'$').test(c))||(leaf.length===1?leaf[0]:'');
  }
  function kuralBul(b){
    const u=N(b.unvan);
    for(const k of kurallar().sort((x,y)=>String(y.deger).length-String(x.deger).length)){
      if(k.alan==='vkn'&&b.vkn&&String(k.deger).split('|').some(v=>v.trim()===b.vkn))return k;
      if(k.alan==='unvan'&&kuralTutar(k.deger,u))return k;
      if(k.alan==='kalem'&&kuralTutar(k.deger,N((b.kalemler||[]).join(' '))))return k;}
    return null;
  }
  // harcama türü → mizandaki gider hesabı (alt hesap adlarında aranan kelimeler)
  const HARCAMA=[
    [/YIYECEK|YEMEK|GIDA|RESTORAN|LOKANTA|PIDE|KEBAP|CAFE|KAFE|PASTA|FIRIN|EKMEK|MARKET|CAY|KAHVE|ICECEK|SU\b/,/YEMEK|GIDA|MUTFAK|TEMSIL|AGIRLAMA|IASE/],
    [/AKARYAKIT|BENZIN|MOTORIN|DIZEL|LPG|OTOGAZ|YAKIT|PETROL|OPET|SHELL|TOTAL|AYTEMIZ|BP\b/,/AKARYAKIT|YAKIT|BENZIN|ARAC/],
    [/OTOPARK|PARK\b|KOPRU|OTOYOL|HGS|OGS|TAKSI|ULASIM|BILET/,/OTOPARK|ULASIM|YOL|SEYAHAT|ARAC/],
    [/KIRTASIYE|KAGIT|TONER|KALEM|DOSYA|FOTOKOPI/,/KIRTASIYE|BURO/],
    [/TEMIZLIK|DETERJAN|HIJYEN/,/TEMIZLIK/],
    [/AKSESUAR|ELEKTRONIK|TELEFON|SARJ|KABLO|BILGISAYAR|ILETISIM/,/ILETISIM|TELEFON|BURO|DEMIRBAS|KUCUK|MALZEME|KIRTASIYE/],
    [/KARGO|POSTA|KURYE/,/KARGO|POSTA/],
    [/HIRDAVAT|NALBUR|BOYA|ELEKTRIK MALZ|TAMIR|BAKIM|ONARIM|YEDEK PARCA|OTO/,/BAKIM|ONARIM|TAMIR/],
    [/ILAC|ECZANE|SAGLIK/,/SAGLIK|ILAC/],
    [/KONAKLAMA|OTEL|PANSIYON/,/KONAKLAMA|SEYAHAT|OTEL/],
  ];
  function giderBul(b){
    const leaf=[...st.leaf].filter(c=>c.startsWith('7'));
    if(!leaf.length)return {kod:'',kaynak:''};
    const metin=N((b.kalemler||[]).join(' ')+' '+(b.unvan||''));
    const ogren=(ayar().ogren||{});      // elle düzeltmelerden öğrenilenler: kalem / işyeri → hesap
    for(const x of [...(b.kalemler||[]).map(k=>'K:'+N(k)),'V:'+(b.vkn||''),'U:'+N(b.unvan)])if(ogren[x]&&st.leaf.has(ogren[x]))return {kod:ogren[x],kaynak:'öğrenildi'};
    const tercih=c=>(/^770/.test(c)?0:/^760/.test(c)?1:/^740/.test(c)?2:3);
    for(const [k,hp] of HARCAMA){if(!k.test(metin))continue;
      const ad=leaf.filter(c=>hp.test(N(st.acc.get(c)))).sort((a,b)=>tercih(a)-tercih(b));if(ad.length)return {kod:ad[0],kaynak:'harcama türü'};}
    const vars=ayar().fisGider;if(vars)return {kod:vars,kaynak:'ayar'};
    const gen=leaf.filter(c=>/^770/.test(c)).sort((a,b)=>(/CESITLI|DIGER|GENEL/.test(N(st.acc.get(b)))?1:0)-(/CESITLI|DIGER|GENEL/.test(N(st.acc.get(a)))?1:0));
    return gen.length?{kod:gen[0],kaynak:'770 (varsayılan)'}:{kod:'',kaynak:''};
  }
  function odemeBul(odeme){
    const a=ayar();
    if(odeme==='kredi'){if(a.fisKredi)return a.fisKredi;const l=[...st.leaf].filter(c=>c.startsWith('331'));return l.find(c=>/ORTAK/.test(N(st.acc.get(c))))||l[0]||'';}
    if(a.fisNakit)return a.fisNakit;const l=[...st.leaf].filter(c=>c.startsWith('100'));return l.find(c=>/KASA|TL/.test(N(st.acc.get(c))))||l[0]||'';
  }
  // mizan + hesap planı alt hesapları (yurt dışı faturalarında mizanda hareketi olmayan 191 / 360 hesapları için)
  function tumHesap(){const m=new Map([...(st.plan||new Map()),...st.acc]);if(st._th&&st._th.n===m.size&&st._th.a===st.acc)return st._th;const ust=new Set();
    for(const c of m.keys()){const p=c.split('.');for(let i=1;i<p.length;i++)ust.add(p.slice(0,i).join('.'));}
    st._th={n:m.size,a:st.acc,m,leaf:[...m.keys()].filter(c=>!ust.has(c)).sort((a,b)=>a.localeCompare(b,'tr',{numeric:true}))};return st._th;}
  const hAdi=c=>tumHesap().m.get(c)||'';
  function enIyi(gr,puan){let en='',ep=0;for(const c of tumHesap().leaf){if(!gr.some(g=>c.startsWith(g)))continue;const p=puan(N(hAdi(c)),c);if(p>ep){ep=p;en=c;}}return en;}
  function ydGider(b){const a=ayar();const og=a.ogren||{};
    for(const x of ['V:'+(b.vkn||''),'U:'+N(b.unvan)])if(og[x])return {kod:og[x],kaynak:'öğrenildi'};
    if(a.ydGider)return {kod:a.ydGider,kaynak:'ayar'};const rek=b.hizmet==='reklam';
    const k=enIyi(['760','770'],(n,c)=>{let p=0;if(rek&&/REKLAM|ILAN|TANITIM|PAZARLAMA/.test(n))p+=10;if(!rek&&/YAZILIM|LISANS|ABONE|BILGI ISLEM|BILGISAYAR|INTERNET/.test(n))p+=6;
      if(p&&/YURT ?DISI|YURTDISI/.test(n))p+=5;if(p&&/INTERNET|DIJITAL|SOSYAL|META|FACEBOOK|GOOGLE|ONLINE/.test(n))p+=3;if(p&&c.startsWith(rek?'760':'770'))p+=1;return p;});
    if(k)return {kod:k,kaynak:'hesap planı'};return giderBul(b);}
  const kdvP=n=>(/SORUMLU/.test(n)?10:0)+(/10 ?10|TAM TEVK|TAMAMI/.test(n)?6:0)+(/TEVK/.test(n)?3:0)+(/KDV ?2\b|2 NO/.test(n)?3:0);
  function ydStopaj(){const a=ayar();if(a.ydStopaj)return a.ydStopaj;
    return enIyi(['360'],n=>/KDV|SGK|SIGORTA|DAMGA|PRIM/.test(n)?0:Math.max(0,(/STOPAJ|KESINTI|TEVKIFAT/.test(n)?5:0)+(/YURT ?DISI|DAR MUKELLEF|\b30\b|\b94\b/.test(n)?3:0)+(/GELIR VERGISI|KURUMLAR VERGISI|\bGV\b|\bKV\b/.test(n)?2:0)-(/KIRA|UCRET|SERBEST/.test(n)?1:0)));}
  function ydKdv191(){const a=ayar();return a.ydKdv191||enIyi(['191'],kdvP);}
  function ydKdv360(){const a=ayar();return a.ydKdv360||enIyi(['360'],n=>/KDV/.test(n)?kdvP(n)+1:0);}
  function ydOdeme(b){const a=ayar();
    if(b.odeme==='banka')return a.ydBanka||enIyi(['102'],()=>1);
    if(b.odeme==='nakit')return odemeBul('nakit');
    return a.ydKredi||a.fisKredi||enIyi(['309','300','331'],n=>/KREDI KART/.test(n)?5:/ORTAK/.test(n)?1:0)||odemeBul('kredi');}
  function hesaplar(b){
    const a=ayar();
    if(b.tur==='yd'){const k=kuralBul(b);const g=b.hesap?{kod:b.hesap,kaynak:'elle'}:(k&&k.hesap)?{kod:k.hesap,kaynak:'kural'}:ydGider(b);
      return {hesap:g.kod,karsi:b.karsi||(k&&k.karsi)||ydOdeme(b),kaynak:g.kaynak};}
    if(b.tur==='z'){const sat=b.hesap||a.zSatis||([...st.leaf].filter(c=>c.startsWith('600'))[0]||'');
      const kasa=b.karsi||a.zKasa||odemeBul('nakit');const kredi=a.zKredi||([...st.leaf].filter(c=>c.startsWith('108'))[0]||'');
      return {hesap:sat,kasa,kredi,kaynak:b.hesap?'elle':a.zSatis?'ayar':sat?'mizan':''};}
    const k=kuralBul(b);const g=b.hesap?{kod:b.hesap,kaynak:'elle'}:(k&&k.hesap)?{kod:k.hesap,kaynak:'kural'}:giderBul(b);
    const karsi=b.karsi||(k&&k.karsi)||odemeBul(b.odeme);
    return {hesap:g.kod,karsi,kaynak:g.kaynak};
  }
  // binek araç kısıtlaması (ÖKC fişi): 770 altındaki İndirilemeyen Binek Araç KDV ve KKEG hesapları
  function okcBinekKdv(){const f=firma()||{};if(f.fkBinekKdv)return f.fkBinekKdv;const l=[...st.leaf].filter(c=>c.startsWith('770'));
    return l.find(c=>/BINEK/.test(N(st.acc.get(c)))&&/KDV/.test(N(st.acc.get(c))))||l.find(c=>/INDIRILEMEYEN/.test(N(st.acc.get(c)))&&/KDV/.test(N(st.acc.get(c))))||'';}
  function okcKkeg(){const f=firma()||{};if(f.fkKkeg)return f.fkKkeg;const l=[...st.leaf].filter(c=>c.startsWith('770'));
    return l.find(c=>/KKEG|KANUNEN KABUL/.test(N(st.acc.get(c)))&&/BINEK|ARAC/.test(N(st.acc.get(c))))||l.find(c=>/KKEG|KANUNEN KABUL/.test(N(st.acc.get(c))))||'';}
  function okcNazim(){const tum=new Map([...(st.plan||new Map()),...st.acc]);const ust=new Set();
    for(const c of tum.keys()){const p=c.split('.');for(let i=1;i<p.length;i++)ust.add(p.slice(0,i).join('.'));}
    return nazimCiftBul([...tum.keys()].filter(c=>!ust.has(c)),c=>tum.get(c)||'',/BINEK/,'BİNEK ARAÇ GİDER KISITLAMASI');}
  function satirlar(b){
    const L=[],err=[],warn=[],cikan=[],bosEk=[];const h=hesaplar(b);const el=b.satirElle||{},say={};const te=b.tutarElle||{};
    const add=(acc,amt,borc,desc)=>{amt=r2(amt);if(!amt)return;if(amt<0){borc=!borc;amt=-amt;}const key=desc+'#'+(say[desc]=(say[desc]||0)+1);if(el[key])acc=el[key];
      const t=te[key];if(t){if(t.cikar||(!t.b&&!t.c)){cikan.push({acc:acc||'',desc,key,oto:{b:borc?amt:0,c:borc?0:amt}});return;}L.push({acc:acc||'',b:r2(t.b||0),c:r2(t.c||0),desc,key,elleT:true,oto:{b:borc?amt:0,c:borc?0:amt}});return;}   // tutar elle; cikar (ya da eski kayıtlarda 0/0): − ile çıkarıldı
      L.push({acc:acc||'',b:borc?amt:0,c:borc?0:amt,desc,key});};
    // elle eklenen satırlar (fişte ＋ Satır ekle): ödeme / kasa satırı bunlara göre dengelenir
    // hesabı ve tutarı henüz girilmemiş eklenen satır fişe yazılmaz ama önizlemede görünür (Görev 39: "Satır ekle" bu yüzden görünmüyordu)
    const ekSat=()=>{for(const x of (b.ekSatir||[])){const bb=r2(+x.b||0),cc=r2(+x.c||0);if(!bb&&!cc&&!x.acc){bosEk.push({acc:'',b:0,c:0,desc:x.desc||'eklenen satır',key:'ek:'+x.id,ek:x.id});continue;}if(!x.acc)err.push('Eklenen satırda hesap kodu yok');L.push({acc:x.acc||'',b:bb,c:cc,desc:x.desc||'eklenen satır',key:'ek:'+x.id,ek:x.id});}};
    if(b.tur==='yd'){
      if(!h.hesap)err.push('Gider hesabı seçin');if(!h.karsi)err.push('Ödeme (karşı) hesabı seçin');
      const y=ydHesap(b);if(!y.net)err.push(b.pb&&b.pb!=='TRY'&&!b.kur?`${b.pb} kuru yok (Düzenle'de yazın ya da TCMB'den alın)`:'Ödenen tutar yok');
      add(h.hesap,y.brut,true,'gider (brüt)');
      add(ydKdv191(),y.kdv,true,`sorumlu sıfatıyla KDV %${y.ko} (191)`);
      add(ydStopaj(),y.sto,false,`stopaj %${y.so} (360)`);
      add(ydKdv360(),y.kdv,false,`sorumlu sıfatıyla KDV %${y.ko} (360)`);
      ekSat();
      const t=L.reduce((s,x)=>s+x.b-x.c,0);add(h.karsi,t,false,'ödeme');
      const od=L.find(x=>x.desc==='ödeme');if(od&&y.net&&Math.abs((od.c-od.b)-y.net)>0.005)warn.push(`Ödeme satırı ${fmt(od.c-od.b)} ≠ ödenen ${fmt(y.net)}`);
      for(const x of L){if(x.acc)continue;
        if(/\(191\)/.test(x.desc))err.push('191 sorumlu sıfatıyla (10/10 tevkif edilen) KDV hesabı bulunamadı (Fiş\'te yazın ya da Hesap ayarlarında seçin)');
        else if(/^stopaj/.test(x.desc))err.push('360 stopaj hesabı bulunamadı (Fiş\'te yazın ya da Hesap ayarlarında seçin)');
        else if(/\(360\)/.test(x.desc))err.push('360 sorumlu sıfatıyla KDV hesabı bulunamadı (Fiş\'te yazın ya da Hesap ayarlarında seçin)');}
    }else{
    if(!(b.oranlar||[]).length)err.push('Tutarlar yok');
    if(b.tur==='fis'){
      if(!h.hesap)err.push('Gider hesabı seçin');if(!h.karsi)err.push('Ödeme (karşı) hesabı seçin');
      const mt=r2((b.oranlar||[]).reduce((s,x)=>s+x.matrah,0));
      if(b.binek){const kk=r2(mt*0.30);const kh=okcKkeg();
        add(h.hesap,mt-kk,true,'gider');add(kh,kk,true,'binek araç KKEG %30');}
      else add(h.hesap,mt,true,'gider');
      for(const o of b.oranlar||[]){if(!o.kdv)continue;const k=kdvHesap('191',o.oran);
        if(b.binek){const bk=r2(o.kdv*0.30);const bh=okcBinekKdv();
          add(k,o.kdv-bk,true,'KDV %'+o.oran);add(bh,bk,true,'indirilemeyen binek araç KDV %30');}
        else add(k,o.kdv,true,'KDV %'+o.oran);}
      ekSat();
      const t=L.reduce((s,x)=>s+x.b-x.c,0);add(h.karsi,t,false,b.odeme==='kredi'?'kredi kartı':'nakit');
      // nazım hesaplar: binek araç KKEG (gider %30 + indirilemeyen KDV %30) → 950 borç / 951 alacak
      if(b.binek){const nk=r2(L.filter(x=>/KKEG|binek araç KDV/.test(x.desc)).reduce((s,x)=>s+x.b,0));
        if(nk>0){const n=okcNazim();
          if(n){add(n[0],nk,true,'binek araç gider kısıtlaması %30 (950)');add(n[1],nk,false,'binek araç gider kısıtlaması %30 (951)');}
          else warn.push('Binek araç: 950 / 951\'de "binek araç" adlı nazım hesap çifti bulunamadı; nazım kayıt eklenmedi');}}
      for(const x of L){if(x.acc)continue;
        if(/^KDV %/.test(x.desc))err.push(`${x.desc.replace('KDV ','')} indirilecek KDV hesabı bulunamadı (Fiş'te yazın)`);
        else if(/KKEG/.test(x.desc))err.push('Binek araç: 770 altında KKEG hesabı bulunamadı (Fiş\'te yazın ya da Luca\'da açın)');
        else if(/binek araç KDV/.test(x.desc))err.push('Binek araç: 770 altında İndirilemeyen Binek Araç KDV hesabı bulunamadı (Fiş\'te yazın ya da Luca\'da açın)');}
    }else{
      if(!h.hesap)err.push('Satış hesabı seçin');if(!h.kasa)err.push('Kasa hesabı seçin');
      let kredi=b.kredi||0;if(kredi&&!h.kredi)err.push('Kredi kartı tahsilat hesabı seçin (Ayarlar)');
      add(h.kredi||h.kasa,kredi,true,'kredi kartı');const nakitYer=L.length;
      add(h.hesap,(b.oranlar||[]).reduce((s,x)=>s+x.matrah,0),false,'satış');
      for(const o of b.oranlar||[]){if(!o.kdv)continue;const k=kdvHesap('391',o.oran);add(k,o.kdv,false,'KDV %'+o.oran);}
      for(const x of L)if(!x.acc&&/^KDV %/.test(x.desc))err.push(`${x.desc.replace('KDV ','')} hesaplanan KDV hesabı bulunamadı (Fiş'te yazın)`);
      ekSat();
      // kasa (nakit) satırı fişi dengeler: eklenen / çıkarılan satırlar ödeme satırındaki gibi kasaya yansır (Görev 39). Eklenen satır yokken = toplam − kredi kartı
      {const n0=L.length;add(h.kasa,L.reduce((t,x)=>t+x.c-x.b,0),true,'nakit');if(L.length>n0)L.splice(nakitYer,0,L.pop());}
    }}
    {const tb=r2(L.reduce((t,x)=>t+x.b,0)),tc=r2(L.reduce((t,x)=>t+x.c,0));if(L.length&&Math.abs(tb-tc)>0.005)err.push(`Fiş dengesiz: borç ${fmt(tb)} ≠ alacak ${fmt(tc)}`);}
    return {L,err,warn,h,cikan,bosEk};
  }

  /* ---- ekran ---- */
  const kurallimi=b=>hesaplar(b).kaynak==='kural';
  const eksikMi=b=>satirlar(b).err.length>0;   // hesap / karşı hesap / tutar eksik
  function gorunen(){return belgeler().filter(b=>b.tur===st.tur).filter(b=>st.filtre==='tumu'||(st.filtre==='kayitsiz'?!b.logged:!!b.logged)).filter(b=>!st.kf||(st.kf==='kurallı')===kurallimi(b)).filter(b=>!st.ef||st.efTut.has(b.id)||(st.ef==='eksik')===eksikMi(b)).sort((a,b)=>String(a.tarih||'').localeCompare(String(b.tarih||''))||String(a.no||'').localeCompare(String(b.no||''),'tr',{numeric:true}));}
  function ciz(){
    const fs=Object.values(local().firms||{}).filter(f=>f.id!==EXAMPLE_ID).sort((a,b)=>String(a.name).localeCompare(String(b.name),'tr'));
    if(S.firm&&fs.some(f=>f.id===S.firm.id)&&st.fid!==S.firm.id){st.fid=S.firm.id;f0=null;}            // firma üstteki ana seçimden
    if(!st.fid||!fs.some(f=>f.id===st.fid))st.fid=(fs[0]&&fs[0].id)||'';
    const tum=belgeler();const say=t=>tum.filter(b=>b.tur===t).length;
    const vis=gorunen();const sec=vis.filter(b=>b.sec&&!b.logged);const bad=sec.filter(b=>satirlar(b).err.length);
    $('#okcBar').innerHTML=`${fs.length?'':'<span class="chip aski">Önce Ayarlar › Firmalar\'dan firma ekleyin</span>'}
      <div class="mmtabs">${[['fis','ÖKC fişleri'],['z','Z raporları'],['yd','Yurt dışı faturaları']].map(([k,l])=>`<button class="btn small" data-okctur="${k}" aria-pressed="${st.tur===k}">${l} <span class="mono">${say(k)}</span></button>`).join('')}</div>
      <button class="btn small primary" id="okcEkle">${st.tur==='yd'?'＋ Fatura ekle (PDF / görüntü)':'＋ Görüntü ekle'}</button>
      <button class="btn small" id="okcWa" title="Ofisin WhatsApp Business numarasına mükelleflerin gönderdiği fiş fotoğraflarını al (gönderen numaraya göre firmaya düşer)">💬 WhatsApp'tan Al</button>
      <div class="mmtabs">${[['kayitsiz','Kayıtsız'],['tumu','Tümü'],['kaydedilen','Luca\'ya kaydedilen']].map(([k,l])=>`<button class="btn small" data-okcf="${k}" aria-pressed="${st.filtre===k}">${l}</button>`).join('')}</div>
      ${st.tur==='fis'?`<div class="mmtabs" title="Kurala göre süz">${[['','Tümü'],['kurallı','Kurallı'],['kuralsız','Kuralsız']].map(([k,l])=>`<button class="btn small" data-okckf="${k}" aria-pressed="${(st.kf||'')===k}">${l} <span class="mono">${k===''?tum.filter(b=>b.tur==='fis').length:tum.filter(b=>b.tur==='fis'&&kurallimi(b)===(k==='kurallı')).length}</span></button>`).join('')}</div>
      <button class="btn small primary" id="okcKuralUygula" title="Kayıtlı kuralları şimdi tüm kayıtsız fişlere yeniden uygular">⟳ Kuralları Uygula</button>`:''}
      ${(()=>{const L=tum.filter(b=>b.tur===st.tur&&!b.logged);const e=L.filter(eksikMi).length;return `<div class="mmtabs" title="Hesap, karşı hesap ya da tutarı eksik olanlar — doldurdukça liste azalır">${[['','Hepsi',L.length],['eksik','Eksik',e],['dolu','Dolu',L.length-e]].map(([k,l,n])=>`<button class="btn small${k==='eksik'&&e?' uyar':''}" data-okcef="${k}" aria-pressed="${(st.ef||'')===k}">${l} <span class="mono">${n}</span></button>`).join('')}</div>`;})()}
      <span class="note">Mizan: ${(firma()||{}).mizanInfo?`${st.leaf.size} hesap`:'<b style="color:var(--out)">yok</b>'}</span><button class="btn small" id="okcMizan">Mizanı Luca'dan Çek</button>
      <span class="note">Seçili: <b>${sec.length}</b>${bad.length?` · <span style="color:var(--out)">${bad.length} eksik</span>`:''}</span>
      <span style="flex:1"></span>
      <label class="note">Fişler <select id="okcBirlestir" style="width:auto"><option value="ayri"${st.birlestir==='ayri'?' selected':''}>Her belge ayrı fiş</option><option value="tek"${st.birlestir==='tek'?' selected':''}>Seçilenler tek fiş</option></select></label>
      <label class="note">Belge türü <input id="okcBT" class="mono" style="width:60px" value="${esc(st.belgeTuru)}" placeholder="boş"></label>
      <button class="btn small" id="okcAyar">Hesap ayarları</button>${st.tur==='fis'?`<button class="btn small" id="okcKurallar">Kurallar (${kurallar().length})</button>`:''}`;
    $('#okcGo').disabled=!sec.length||!!bad.length||st.busy;$('#okcGo').textContent=`Luca'ya kaydet (${st.birlestir==='tek'&&sec.length?1:sec.length} fiş)`;
    $('#okcXls').disabled=!sec.length||!!bad.length;
    const z=st.tur==='z',yd=st.tur==='yd';
    $('#okcTable').innerHTML=`<thead><tr><th style="width:28px"><input type="checkbox" id="okcAll" title="Görünenleri seç"></th><th>Görüntü</th><th>Tarih</th><th>${z?'Z no':yd?'Fatura no':'Fiş no'}</th><th>${z?'İşyeri':yd?'Satıcı · VAT no':'İşyeri · VKN'}</th><th>${yd?'Stopaj · KDV':'Oranlar'}</th><th class="n">${yd?'Brüt':'Matrah'}</th><th class="n">${yd?'Sorumlu KDV':'KDV'}</th><th class="n">${yd?'Ödenen (TL)':'Toplam'}</th>${z?'<th class="n">Kredi kartı</th>':''}<th>${z?'Satış hesabı':'Gider hesabı'}</th><th>${z?'Kasa':'Ödeme hesabı'}</th><th>Durum</th><th></th></tr></thead>
      <tbody>${vis.map(b=>{const s=satirlar(b);const u=[...denetle(b),...(s.warn||[])];const yh=yd?ydHesap(b):null;const m=yd?yh.brut:r2((b.oranlar||[]).reduce((t,x)=>t+x.matrah,0)),k=yd?yh.kdv:r2((b.oranlar||[]).reduce((t,x)=>t+x.kdv,0));
        return `<tr data-id="${esc(b.id)}"><td><input type="checkbox" data-okcsec="${esc(b.id)}" ${b.sec&&!b.logged?'checked':''} ${b.logged?'disabled':''}></td>
          <td><img src="${esc(b.url||'')}" alt="" data-okcgor="${esc(b.id)}" style="width:54px;height:72px;object-fit:cover;border-radius:4px;border:1px solid var(--line);cursor:zoom-in"></td>
          <td class="mono">${esc(dmy(b.tarih))}<div class="note">${esc(b.saat||'')}</div></td><td class="mono">${esc(z?b.zNo||'':b.fisNo||'')}</td>
          <td><b>${esc(b.unvan||'')}</b><div class="note mono">${esc(b.vkn||'')}</div></td>
          <td class="note">${yd?`stopaj %${yh.so} · KDV %${yh.ko}${b.pb&&b.pb!=='TRY'?`<div class="mono">${fmt(b.doviz||0)} ${esc(b.pb)}${b.kur?' × '+String(b.kur).replace('.',','):''}</div>`:''}${yh.sto?`<div>stopaj ${fmt(yh.sto)}</div>`:''}`:(b.oranlar||[]).map(o=>'%'+o.oran).join(' · ')}</td>
          <td class="n">${fmt(m)}</td><td class="n">${fmt(k)}</td><td class="n">${fmt(toplamOf(b))}</td>${z?`<td class="n">${b.kredi?fmt(b.kredi):''}</td>`:''}
          <td><input class="mono" list="okcAccList" data-okch="${esc(b.id)}" value="${esc(s.h.hesap)}" style="width:120px">${s.h.kaynak&&s.h.kaynak!=='elle'?`<span class="chip kural">${esc(s.h.kaynak)}</span>`:''}<div class="note">${esc(st.acc.get(s.h.hesap)||'')}</div></td>
          <td><input class="mono" list="okcAccList" data-okck="${esc(b.id)}" value="${esc(z?s.h.kasa:s.h.karsi)}" style="width:120px"><div class="note">${esc(st.acc.get(z?s.h.kasa:s.h.karsi)||'')}${!z?' · '+(b.odeme==='kredi'?'kart':b.odeme==='banka'?'banka':'nakit'):''}</div></td>
          <td>${b.logged?`<span class="chip kural">Luca fiş ${esc(b.logged.n||'')}</span>`:s.err.length?`<span class="note" style="color:var(--out)">${esc(s.err[0])}</span>`:u.length?`<span class="note" style="color:var(--warn)">${esc(u[0])}</span>`:'<span class="chip cari">hazır</span>'}<div class="note">okuma %${b.conf||0}</div></td>
          <td style="white-space:nowrap"><button class="btn small ghost" data-okcduz="${esc(b.id)}">Düzenle</button><button class="btn small ghost" data-okcfis="${esc(b.id)}">Fiş</button>${!z?`<button class="btn small ghost" data-okckural="${esc(b.id)}">Kural yap</button>`:''}<button class="btn small ghost danger" data-okcsil="${esc(b.id)}" title="Belgeyi sil">✕</button></td></tr>
          ${b.acik?`<tr class="fisdetay"><td></td><td colspan="${z?13:12}">${b.tur==='fis'&&!b.logged?`<div class="binekkutu"><span class="binekres" aria-hidden="true">🚗</span><b>Binek araç gideri mi?</b><span class="note">Evet derseniz KDV'nin %30'u 770 İndirilemeyen Binek Araç KDV'ye, giderin %30'u 770 KKEG'ye yazılır; fiş hemen değişir.</span><span class="mmtabs"><button class="btn small" data-okcbinek="${esc(b.id)}" data-v="1" aria-pressed="${!!b.binek}">Evet</button><button class="btn small" data-okcbinek="${esc(b.id)}" data-v="0" aria-pressed="${!b.binek}">Hayır</button></span></div>`:''}<table class="mini"><thead><tr><th>Hesap</th><th>Hesap adı</th><th>Açıklama</th><th class="n">Borç</th><th class="n">Alacak</th></tr></thead><tbody>${[...s.L,...s.bosEk].map(x=>{const ro=!!b.logged;const id=esc(b.id);
              if(x.ek!=null)return `<tr class="fkek"><td>${ro?esc(x.acc):`<input class="mono" list="okcAccList" data-okcek="${id}" data-eid="${esc(x.ek)}" data-alan="acc" value="${esc(x.acc)}" placeholder="hesap kodu" style="width:130px${x.acc?'':';border-color:var(--out)'}">`}</td><td>${esc(hAdi(x.acc))}</td><td>${ro?esc(x.desc):`<input data-okcek="${id}" data-eid="${esc(x.ek)}" data-alan="desc" value="${esc(x.desc)}" style="width:100%;min-width:120px">`}</td><td class="n">${ro?(x.b?fmt(x.b):''):`<input class="mono fktut" inputmode="decimal" data-okcek="${id}" data-eid="${esc(x.ek)}" data-alan="b" value="${x.b?fmt(x.b):''}" style="width:110px;text-align:right">`}</td><td class="n">${ro?(x.c?fmt(x.c):''):`<input class="mono fktut" inputmode="decimal" data-okcek="${id}" data-eid="${esc(x.ek)}" data-alan="c" value="${x.c?fmt(x.c):''}" style="width:110px;text-align:right"> <button class="btn small ghost danger fiscikar" data-okceksil="${id}" data-eid="${esc(x.ek)}" title="Satırı fişten çıkar" aria-label="Satırı fişten çıkar">−</button>`}</td></tr>`;
              const tIn=yon=>ro?(x[yon]?fmt(x[yon]):''):`<input class="mono fktut" inputmode="decimal" data-okctut="${id}" data-key="${esc(x.key)}" data-yon="${yon}" value="${x[yon]?fmt(x[yon]):''}" style="width:110px;text-align:right${x.elleT?';border-color:var(--accent)':''}">`;
              return `<tr><td>${ro?`<span class="mono">${esc(x.acc||'—')}</span>`:`<input class="mono" list="okcAccList" data-okcel="${id}" data-key="${esc(x.key)}" value="${esc(x.acc)}" placeholder="hesap kodu" style="width:130px${x.acc?'':';border-color:var(--out)'}">`}</td><td>${esc(hAdi(x.acc))}${x.acc&&b.satirElle&&b.satirElle[x.key]?' <span class="chip kural">elle</span>':''}</td><td>${esc(x.desc)}${x.elleT?` <span class="chip kural" title="Önerilen: ${esc(fmt(x.oto.b||x.oto.c))}">tutar elle</span> <button class="btn small ghost" data-okctsif="${id}" data-key="${esc(x.key)}" title="Önerilen tutara dön">↺</button>`:''}</td><td class="n">${tIn('b')}</td><td class="n">${tIn('c')}${ro?'':` <button class="btn small ghost danger fiscikar" data-okccikar="${id}" data-key="${esc(x.key)}" title="Satırı fişten çıkar" aria-label="Satırı fişten çıkar">−</button>`}</td></tr>`;}).join('')}${b.logged?'':s.cikan.map(x=>`<tr class="fiscikan"><td><span class="mono">${esc(x.acc||'—')}</span></td><td>${esc(hAdi(x.acc))}</td><td>${esc(x.desc)} <span class="chip">fişten çıkarıldı</span></td><td class="n">${x.oto.b?fmt(x.oto.b):''}</td><td class="n">${x.oto.c?fmt(x.oto.c):''} <button class="btn small ghost" data-okcgeri="${esc(b.id)}" data-key="${esc(x.key)}" title="Satırı fişe geri ekle">↺ Geri ekle</button></td></tr>`).join('')}</tbody>
            <tfoot><tr><td colspan="3">${b.logged?'':`<button class="btn small" data-okcekle="${esc(b.id)}" title="Fişe başka bir hesap satırı ekleyin; ödeme / kasa satırı kendiliğinden dengelenir">＋ Satır ekle</button> <span class="note">Tutarı değiştirmek için kutuya yazın; satırı çıkarmak için yanındaki − düğmesine basın.</span>`}</td>
              <td class="n mono"><b>${fmt(r2(s.L.reduce((t,x)=>t+x.b,0)))}</b></td><td class="n mono"><b>${fmt(r2(s.L.reduce((t,x)=>t+x.c,0)))}</b></td></tr></tfoot></table>
            ${[...s.err.map(e=>`<div class="note" style="color:var(--out)">✕ ${esc(e)}</div>`),...u.map(e=>`<div class="note" style="color:var(--warn)">! ${esc(e)}</div>`)].join('')}</td></tr>`:''}`;}).join('')||
        `<tr><td colspan="14" class="bosliste">${tum.some(b=>b.tur===st.tur)?'Bu filtrede belge yok.':yd?`Henüz yurt dışı faturası yok. “Fatura ekle” ile Meta, Google vb. faturalarının PDF'lerini ya da fotoğraflarını seçin (birden çok seçilebilir). Program ödenen net tutardan brüte gider, %15 stopajı 360'a, %20 KDV'yi sorumlu sıfatıyla 191 / 360'a yazar; siz kontrol edip Luca'ya kaydedersiniz.`:`Henüz ${z?'Z raporu':'ÖKC fişi'} yok. “Görüntü ekle” ile fotoğraf ya da taranmış görüntüleri seçin; program okuyup alanları doldurur, siz kontrol edip Luca'ya kaydedersiniz.`}</td></tr>`}</tbody>`;
  }
  async function guncelle(b){await dataOp('okcSet',{fid:st.fid,belgeler:[b]});}
  async function show(){f0=null;$('#okcPanel').hidden=false;LucaBag.yenile();st.belgeTuru=((firma()||{}).okcAyar||{}).belgeTuru||'';await hesaplariYukle();ciz();}
  function hide(){$('#okcPanel').hidden=true;}

  async function ekle(yollar,secenek){
    const fid=(secenek&&secenek.fid)||st.fid;const tur=(secenek&&secenek.tur)||st.tur;
    if(!fid){toast('Önce bir firma seçin.');return 0;}
    let r;try{r=await mwBusy.run(tur==='yd'?'Faturalar okunuyor…':'Görüntüler okunuyor…',tur==='yd'?'Yurt dışı faturaları okunuyor (bilgisayarınızda)':'Yazar kasa belgeleri okunuyor (bilgisayarınızda, internete gönderilmez)',()=>api.okc.ekle({fid,tur,yollar,ek:secenek&&secenek.ek}),{iptal:()=>api.okc.iptal()});}catch(e){toast(clean(e));return 0;}
    if(!r||!r.length)return 0;
    const yeni=[];
    const iptalN=r.filter(x=>x.iptal).length;if(iptalN)toast(`${iptalN} görüntü okunmadan iptal edildi.`);
    for(const x of r){if(!x.id){if(!x.iptal)toast(x.ad+': '+x.hata);continue;}
      if(x.pdf){try{Object.assign(x,await ydPdf(x,x.buf));}catch(e){toast(x.ad+': PDF okunamadı: '+clean(e));}delete x.buf;}
      const o=tur==='z'?zOku(x.text):tur==='yd'?ydOku(x.text):fisOku(x.text);
      const b={id:x.id,tur,img:x.img,url:x.url,ad:x.ad,text:x.text,conf:x.conf,eklendi:new Date().toISOString(),...o,no:tur==='z'?o.zNo:tur==='yd'?o.no:o.fisNo,sec:true,...(x.pdf?{pdf:true}:{}),
        ...(x.parcaToplam?{parca:x.parca,parcaToplam:x.parcaToplam,kaynakDosya:x.kaynakDosya}:{}),...(x.wa?{wa:x.wa}:{})};
      yeni.push(b);}
    if(tur==='yd')await ydKurAl(yeni);
    if(yeni.length){{const fo=(local().firms||{})[fid];const yen=async()=>{f0=null;if(fid===st.fid){await hesaplariYukle();ciz();}};if(fo&&!fo.mizanInfo&&await mizanOtoCek(fo,(yeni.find(b=>b.tarih)||{}).tarih,yen)){f0=null;if(fid===st.fid)await hesaplariYukle();}}
      await dataOp('okcSet',{fid,belgeler:yeni});const parcali=yeni.filter(b=>b.parcaToplam).length;
      toast(`${yeni.length} belge okundu${parcali?` (${parcali} tanesi tek fotoğraftan ayrıldı)`:''}. Alanları kontrol edin; eksikler “Düzenle” ile tamamlanır.`);}
    if(fid===st.fid){st.filtre='kayitsiz';ciz();}
    return yeni.length;
  }
  // WhatsApp fiş kutusu: ofis numarasına gelen fotoğraflar → gönderen telefon numarasına göre firmaya
  const telN=t=>String(t||'').replace(/\D/g,'').replace(/^0+/,'').replace(/^90(?=5\d{9}$)/,'');
  function telFirma(tel){const n=telN(tel);if(!n)return null;for(const f of Object.values(local().firms||{})){if(f.id===EXAMPLE_ID)continue;const ls=String(f.waTel||'').split(/[,;\s]+/).map(telN).filter(Boolean);if(ls.includes(n))return f;}return null;}
  async function whatsappAl(){
    let bek;try{bek=await mwBusy.run('WhatsApp kutusu okunuyor…','Ofisin WhatsApp numarasına gelen fişler',()=>api.wa.bekleyenler());}catch(e){toast(clean(e));return;}
    if(!bek||!bek.length){toast('WhatsApp kutusunda bekleyen fiş yok.');return;}
    const inen=await mwBusy.run('Fotoğraflar indiriliyor…',bek.length+' fiş',()=>api.wa.indir({fisler:bek}));
    const fs=Object.values(local().firms||{}).filter(f=>f.id!==EXAMPLE_ID).sort((a,b)=>String(a.name).localeCompare(String(b.name),'tr'));
    const alinan=[];let n=0;const grup=new Map();
    for(const x of inen){if(x.hata||!x.yol){toast('İndirilemedi: '+(x.hata||x.id));continue;}
      let f=telFirma(x.telefon);
      if(!f){const sec=await Desk.choose('Bu fiş hangi firmanın?',`Gönderen: ${x.ad||''} ${x.telefon}${x.metin?' · "'+x.metin+'"':''}\nBu numara hiçbir firmaya kayıtlı değil. Firmayı seçin; numara firmaya kaydedilir, sonraki fişler kendiliğinden o firmaya düşer.`,
          fs.slice(0,8).map(f=>({label:f.name,value:f.id})).concat([{label:'Şimdilik atla',value:null}]));
        if(!sec)continue;f=fs.find(z=>z.id===sec);const y={...f,waTel:[f.waTel,'+'+telN(x.telefon)].filter(Boolean).join(', ')};await Store.saveFirm(y);f=y;}
      if(!grup.has(f.id))grup.set(f.id,{f,yollar:[],ids:[],wa:[]});const g=grup.get(f.id);g.yollar.push(x.yol);g.ids.push(x.id);g.wa.push({tel:x.telefon,ad:x.ad,zaman:x.zaman});}
    for(const g of grup.values()){const k=await ekle(g.yollar,{fid:g.f.id,tur:'fis',ek:{wa:{tel:g.wa[0].tel,ad:g.wa[0].ad,zaman:g.wa[0].zaman}}});n+=k||0;alinan.push(...g.ids);}
    if(alinan.length){try{await api.wa.alindi(alinan);}catch(e){}}
    toast(n?`${n} belge WhatsApp'tan alındı (${grup.size} firma).`:'Alınan belge yok.');ciz();
  }
  function ydDuzenle(b){
    const v0=b;const {so,ko}=ydOran(b);
    $('#okcModalT').textContent='Yurt dışı faturası';
    $('#okcModalB').innerHTML=`<div style="display:grid;grid-template-columns:minmax(260px,1fr) minmax(320px,1.2fr);gap:16px;align-items:start">
      <div style="max-height:70vh;overflow:auto;border:1px solid var(--line);border-radius:8px;background:#fff">${b.url?`<img src="${esc(b.url)}" alt="" id="okcBuyuk" style="width:100%;display:block;cursor:zoom-in">`:'<p class="note" style="padding:20px">Görüntü yok</p>'}</div>
      <div style="display:grid;gap:10px">
        <div class="outgrid" style="gap:10px">
          <div><label class="lbl">Fatura tarihi</label><input type="date" id="ydTarih" value="${esc(b.tarih||'')}"></div>
          <div><label class="lbl">Fatura no</label><input id="ydNo" class="mono" value="${esc(b.no||'')}"></div>
          <div style="grid-column:1/-1"><label class="lbl">Satıcı</label><input id="ydUnvan" value="${esc(b.unvan||'')}"></div>
          <div><label class="lbl">Satıcı VAT no</label><input id="ydVkn" class="mono" value="${esc(b.vkn||'')}"></div>
          <div><label class="lbl">Hizmet</label><select id="ydHizmet"><option value="reklam"${b.hizmet==='reklam'?' selected':''}>Reklam</option><option value="hizmet"${b.hizmet!=='reklam'?' selected':''}>Yazılım / diğer hizmet</option></select></div>
          <div><label class="lbl">Para birimi</label><select id="ydPb">${['TRY','USD','EUR','GBP'].map(p=>`<option${(b.pb||'TRY')===p?' selected':''}>${p}</option>`).join('')}</select></div>
          <div><label class="lbl">Ödenen tutar (net, faturadaki)</label><input id="ydDoviz" class="mono" value="${b.doviz??''}"></div>
          <div><label class="lbl">Kur (TCMB döviz alış, önceki iş günü)</label><span class="actions" style="margin:0;flex-wrap:nowrap"><input id="ydKur" class="mono" value="${b.kur??''}" style="width:110px"><button type="button" class="btn small" id="ydKurAl">TCMB'den al</button></span></div>
          <div><label class="lbl">Ödenen TL (boş: tutar × kur)</label><input id="ydNet" class="mono" value="${b.net??''}" placeholder="${fmt(ydNet(b))}"></div>
          <div><label class="lbl">Stopaj %</label><input id="ydSo" class="mono" value="${b.stopajO??''}" placeholder="${so}"></div>
          <div><label class="lbl">KDV % (sorumlu sıfatıyla)</label><input id="ydKo" class="mono" value="${b.kdvO??''}" placeholder="${ko}"></div>
          <div><label class="lbl">Ödeme</label><select id="ydOdeme"><option value="kredi"${b.odeme!=='banka'&&b.odeme!=='nakit'?' selected':''}>Kredi kartı</option><option value="banka"${b.odeme==='banka'?' selected':''}>Banka</option><option value="nakit"${b.odeme==='nakit'?' selected':''}>Nakit</option></select></div>
        </div>
        <div class="note" id="ydOzet"></div>
        <details><summary class="note">Okunan metin</summary><pre style="white-space:pre-wrap;font-size:12px;max-height:200px;overflow:auto">${esc(b.text||'')}</pre></details>
        <div class="actions" style="justify-content:flex-end;margin:0"><button class="btn" id="ydYeniden">Yeniden oku</button><button class="btn" data-okx="1">Vazgeç</button><button class="btn primary" id="ydKaydet">Kaydet</button></div>
      </div></div>`;
    $('#okcModal').hidden=false;
    const v=id=>{const e=$('#'+id);return e?e.value.trim():'';};const n=x=>x===''?null:sayi(x);
    const topla=()=>({tarih:v('ydTarih')||null,no:v('ydNo'),fisNo:v('ydNo'),unvan:v('ydUnvan'),vkn:v('ydVkn'),hizmet:v('ydHizmet'),pb:v('ydPb'),doviz:n(v('ydDoviz')),kur:n(String(v('ydKur')).replace('.',',')),net:n(v('ydNet')),stopajO:v('ydSo')===''?null:n(v('ydSo')),kdvO:v('ydKo')===''?null:n(v('ydKo')),odeme:v('ydOdeme')});
    const ozet=()=>{const y=ydHesap({...b,...topla()});$('#ydOzet').innerHTML=`Ödenen <b>${fmt(y.net)}</b> TL → brüt <b>${fmt(y.brut)}</b> · stopaj %${y.so} <b>${fmt(y.sto)}</b> (360) · sorumlu KDV %${y.ko} <b>${fmt(y.kdv)}</b> (191 borç / 360 alacak)`;};
    $('#okcModalB').addEventListener('input',ozet);$('#okcModalB').addEventListener('change',ozet);ozet();
    if($('#okcBuyuk'))$('#okcBuyuk').onclick=e=>{const i=e.target;i.style.width=i.style.width==='200%'?'100%':'200%';};
    $('#ydKurAl').onclick=async()=>{const t=topla();if(!t.tarih||!t.pb||t.pb==='TRY'){toast('Önce tarih ve döviz cinsini seçin.');return;}
      try{const k=await api.tcmbKurlar([{pb:t.pb,tarih:t.tarih}]);const x=(k.kurlar||{})[t.pb+'|'+t.tarih];if(x){$('#ydKur').value=String(x.kur).replace('.',',');toast(`TCMB ${dmy(x.bulten)} döviz alış: ${String(x.kur).replace('.',',')}`);ozet();}else toast((k.hatalar||[])[0]||'Kur bulunamadı');}catch(e){toast(clean(e));}};
    $('#ydYeniden').onclick=async()=>{try{let r;if(b.pdf){const buf=await api.okc.pdfOku(b.img);r=await ydPdf(b,buf);}else r=await mwBusy.run('Yeniden okunuyor…',b.ad||'',()=>api.okc.yenidenOku(b.img));
      const o=ydOku(r.text);Object.assign(b,o,{text:r.text,conf:r.conf,url:r.url||b.url});await ydKurAl([b]);await guncelle(b);ydDuzenle(b);ciz();}catch(e){toast(clean(e));}};
    $('#ydKaydet').onclick=async()=>{Object.assign(b,topla(),{duzeltildi:true});await guncelle(b);$('#okcModal').hidden=true;ciz();toast('Kaydedildi.');};
  }
  function duzenle(id){
    const b=belgeler().find(x=>x.id===id);if(!b)return;if(b.tur==='yd'){ydDuzenle(b);return;}const z=b.tur==='z';
    const oranSatir=(o,i)=>`<tr><td><select data-o="${i}" style="width:80px">${ORANLAR.map(r=>`<option value="${r}"${+o.oran===r?' selected':''}>%${r}</option>`).join('')}</select></td><td><input data-om="${i}" value="${o.matrah}" class="mono" style="width:110px"></td><td><input data-ok="${i}" value="${o.kdv}" class="mono" style="width:100px"></td><td><button class="btn small ghost danger" data-osil="${i}">✕</button></td></tr>`;
    $('#okcModalT').textContent=z?'Z raporu':'ÖKC fişi';
    $('#okcModalB').innerHTML=`<div style="display:grid;grid-template-columns:minmax(260px,1fr) minmax(320px,1.2fr);gap:16px;align-items:start">
      <div style="max-height:70vh;overflow:auto;border:1px solid var(--line);border-radius:8px;background:#fff"><img src="${esc(b.url)}" alt="" id="okcBuyuk" style="width:100%;display:block;cursor:zoom-in"></div>
      <div style="display:grid;gap:10px">
        <div class="outgrid" style="gap:10px">
          <div><label class="lbl">Tarih</label><input type="date" id="okTarih" value="${esc(b.tarih||'')}"></div>
          <div><label class="lbl">Saat</label><input id="okSaat" value="${esc(b.saat||'')}" placeholder="13:45"></div>
          ${z?`<div><label class="lbl">Z no</label><input id="okZ" class="mono" value="${esc(b.zNo||'')}"></div><div><label class="lbl">Fiş sayısı</label><input id="okFS" class="mono" value="${esc(b.fisSayisi||'')}"></div>`
            :`<div><label class="lbl">Fiş no</label><input id="okNo" class="mono" value="${esc(b.fisNo||'')}"></div><div><label class="lbl">Z no</label><input id="okZ" class="mono" value="${esc(b.zNo||'')}"></div>`}
          <div style="grid-column:1/-1"><label class="lbl">İşyeri ünvanı</label><input id="okUnvan" value="${esc(b.unvan||'')}"></div>
          <div><label class="lbl">VKN / TCKN</label><input id="okVkn" class="mono" value="${esc(b.vkn||'')}"></div>
          ${z?`<div><label class="lbl">Kredi kartı</label><input id="okKredi" class="mono" value="${b.kredi??''}"></div>`:`<div><label class="lbl">Ödeme</label><select id="okOdeme"><option value="nakit"${b.odeme!=='kredi'?' selected':''}>Nakit</option><option value="kredi"${b.odeme==='kredi'?' selected':''}>Kredi kartı</option></select></div>
            <div style="grid-column:1/-1"><button type="button" class="btn small ${b.binek?'primary':''}" id="okBinek" aria-pressed="${!!b.binek}" title="KDV'nin %30'u 770 İndirilemeyen Binek Araç KDV, giderin %30'u 770 KKEG hesabına yazılır">🚗 Binek Araç${b.binek?' (uygulanıyor)':''}</button> <span class="note">Binek araç gideri ise basın: KDV'nin ve giderin %30'u 770'e.</span></div>`}
        </div>
        <table class="mini"><thead><tr><th>KDV oranı</th><th>Matrah</th><th>KDV</th><th></th></tr></thead><tbody id="okOranlar">${(b.oranlar||[]).map(oranSatir).join('')}</tbody></table>
        <div class="actions" style="margin:0"><button class="btn small" id="okOranEkle">＋ Oran ekle</button><span class="note">KDV dahil tutarı yazıp “KDV'yi hesapla” derseniz matrah/KDV ayrılır.</span></div>
        <div class="actions" style="margin:0"><label class="note">KDV dahil <input id="okBrut" class="mono" style="width:110px"></label><select id="okBrutO" style="width:80px">${ORANLAR.map(r=>`<option value="${r}"${r===20?' selected':''}>%${r}</option>`).join('')}</select><button class="btn small" id="okBrutHesap">KDV'yi hesapla</button></div>
        <div class="outgrid" style="gap:10px"><div><label class="lbl">Belge toplamı</label><input id="okToplam" class="mono" value="${b.toplam??''}"></div><div><label class="lbl">Toplam KDV (TOPKDV)</label><input id="okTopkdv" class="mono" value="${b.topkdv??''}"></div></div>
        <details><summary class="note">Okunan metin (okuma güveni %${b.conf||0})</summary><pre style="white-space:pre-wrap;font-size:12px;max-height:200px;overflow:auto">${esc(b.text||'')}</pre></details>
        <div class="actions" style="justify-content:flex-end;margin:0"><button class="btn" id="okYeniden">Yeniden oku</button><button class="btn" data-okx="1">Vazgeç</button><button class="btn primary" id="okKaydet">Kaydet</button></div>
      </div></div>`;
    $('#okcModal').hidden=false;
    let binek=!!b.binek;
    if($('#okBinek'))$('#okBinek').onclick=()=>{binek=!binek;const x=$('#okBinek');x.classList.toggle('primary',binek);x.setAttribute('aria-pressed',String(binek));x.textContent='🚗 Binek Araç'+(binek?' (uygulanıyor)':'');};
    let oranlar=JSON.parse(JSON.stringify(b.oranlar||[]));
    const tabloyuOku=()=>{oranlar=[...$('#okOranlar').querySelectorAll('tr')].map((tr,i)=>({oran:+tr.querySelector('[data-o]').value,matrah:sayi(tr.querySelector('[data-om]').value)||0,kdv:sayi(tr.querySelector('[data-ok]').value)||0}));};
    const tabloCiz=()=>{$('#okOranlar').innerHTML=oranlar.map(oranSatir).join('');};
    $('#okcBuyuk').onclick=e=>{const i=e.target;i.style.width=i.style.width==='200%'?'100%':'200%';};
    $('#okOranEkle').onclick=()=>{tabloyuOku();oranlar.push({oran:20,matrah:0,kdv:0});tabloCiz();};
    $('#okOranlar').onclick=e=>{const x=e.target.closest('[data-osil]');if(!x)return;tabloyuOku();oranlar.splice(+x.dataset.osil,1);tabloCiz();};
    $('#okBrutHesap').onclick=()=>{tabloyuOku();const g=sayi($('#okBrut').value);const o=+$('#okBrutO').value;if(!g)return;const k=r2(g*o/(100+o));const v=oranlar.find(x=>x.oran===o);if(v){v.matrah=r2(g-k);v.kdv=k;}else oranlar.push({oran:o,matrah:r2(g-k),kdv:k});tabloCiz();$('#okBrut').value='';};
    $('#okYeniden').onclick=async()=>{try{const r=await mwBusy.run('Yeniden okunuyor…',b.ad||'',()=>api.okc.yenidenOku(b.img));const o=z?zOku(r.text):fisOku(r.text);Object.assign(b,o,{text:r.text,conf:r.conf,no:z?o.zNo:o.fisNo});await guncelle(b);duzenle(b.id);ciz();}catch(e){toast(clean(e));}};
    $('#okKaydet').onclick=async()=>{tabloyuOku();
      const v=id=>{const e=$('#'+id);return e?e.value.trim():'';};const n=x=>x===''?null:sayi(x);
      Object.assign(b,{tarih:v('okTarih')||null,saat:v('okSaat'),unvan:v('okUnvan'),vkn:v('okVkn'),zNo:v('okZ'),oranlar:oranlar.filter(o=>o.matrah||o.kdv),toplam:n(v('okToplam')),topkdv:n(v('okTopkdv')),duzeltildi:true});
      if(z){b.fisSayisi=v('okFS');b.kredi=n(v('okKredi'));b.no=b.zNo;}else{b.fisNo=v('okNo');b.odeme=v('okOdeme')||'nakit';b.no=b.fisNo;b.binek=binek;}
      await guncelle(b);$('#okcModal').hidden=true;ciz();toast('Kaydedildi.');};
  }
  function goruntu(id){const b=belgeler().find(x=>x.id===id);if(!b)return;$('#okcModalT').textContent=b.ad||'Görüntü';$('#okcModalB').innerHTML=`<div style="max-height:78vh;overflow:auto;text-align:center"><img src="${esc(b.url)}" alt="" style="max-width:100%"></div>`;$('#okcModal').hidden=false;}
  function ayarlar(){
    const a=ayar();const f=x=>`<input list="okcAccList" class="mono" id="oa_${x}" value="${esc(a[x]||'')}" style="width:140px">`;
    $('#okcModalT').textContent='ÖKC hesap ayarları';
    $('#okcModalB').innerHTML=`<p class="note" style="margin:0">Bu firmada okunan belgeler bu hesaplarla fişe dönüşür. KDV hesapları mizandaki “%oran” adlı 191 / 391 alt hesaplarından bulunur.</p>
      <section style="display:grid;gap:8px"><b>ÖKC fişleri (alış / gider)</b><div class="actions" style="margin:0"><label class="note">Varsayılan gider hesabı ${f('fisGider')}</label><label class="note">Nakit ödeme (boş: 100 Kasa) ${f('fisNakit')}</label><label class="note">Kredi kartıyla ödeme (boş: 331 Ortaklara Borçlar) ${f('fisKredi')}</label></section><p class="note" style="margin:0">Gider hesabı boşsa harcama türüne (yiyecek, akaryakıt, kırtasiye…) göre mizandaki 7xx alt hesaplarından seçilir; listede elle düzelttiğiniz hesap aynı harcama / işyeri için hatırlanır.</p><section style="display:none"></div></section>
      <section style="display:grid;gap:8px"><b>Yurt dışı faturaları</b><div class="actions" style="margin:0"><label class="note">Gider (boş: 760/770 reklam / yurt dışı hesabı) ${f('ydGider')}</label><label class="note">360 stopaj ${f('ydStopaj')}</label><label class="note">191 sorumlu sıfatıyla KDV ${f('ydKdv191')}</label><label class="note">360 sorumlu sıfatıyla KDV ${f('ydKdv360')}</label><label class="note">Kartla ödeme ${f('ydKredi')}</label><label class="note">Banka ${f('ydBanka')}</label>
        <label class="note">Stopaj % <input class="mono" id="oa_ydStopajO" value="${esc(a.ydStopajO??'')}" placeholder="15" style="width:60px"></label><label class="note">KDV % <input class="mono" id="oa_ydKdvO" value="${esc(a.ydKdvO??'')}" placeholder="20" style="width:60px"></label></div></section>
      <section style="display:grid;gap:8px"><b>Z raporları (satış)</b><div class="actions" style="margin:0"><label class="note">Satış hesabı ${f('zSatis')}</label><label class="note">Kasa (nakit) ${f('zKasa')}</label><label class="note">Kredi kartı tahsilat ${f('zKredi')}</label></div></section>
      <div class="actions" style="justify-content:flex-end"><button class="btn" data-okx="1">Vazgeç</button><button class="btn primary" id="oaKaydet">Kaydet</button></div>`;
    $('#okcModal').hidden=false;
    $('#oaKaydet').onclick=async()=>{const f=firma();if(!f)return;const y={...(f.okcAyar||{})};for(const k of ['fisGider','fisNakit','fisKredi','zSatis','zKasa','zKredi','ydGider','ydStopaj','ydKdv191','ydKdv360','ydKredi','ydBanka','ydStopajO','ydKdvO'])y[k]=$('#oa_'+k).value.trim();await firmaKaydet({...f,okcAyar:y});$('#okcModal').hidden=true;ciz();toast('Hesap ayarları kaydedildi.');};
  }
  function kuralYap(id){
    const b=belgeler().find(x=>x.id===id);if(!b)return;const h=hesaplar(b);
    $('#okcModalT').textContent='ÖKC fiş kuralı';
    $('#okcModalB').innerHTML=`<p class="note" style="margin:0">Bu firmada işyeri şartı tutan ÖKC fişleri seçtiğiniz hesaplarla kaydedilir.</p>
      <div class="outgrid" style="gap:12px"><div><label class="lbl">Şart</label><select id="okA"><option value="unvan">İşyeri ünvanı içerir</option><option value="vkn">VKN eşittir</option></select></div>
      <div><label class="lbl">Değer <span class="note">(| = ya da · + = hepsi geçmeli)</span></label><input id="okD" value="${esc(b.unvan||'')}"></div>
      <div><label class="lbl">Gider hesabı</label><input id="okH" list="okcAccList" class="mono" value="${esc(h.hesap)}"></div>
      <div><label class="lbl">Ödeme (karşı) hesabı (boş: ayarlardaki)</label><input id="okK" list="okcAccList" class="mono" value=""></div></div>
      <div class="actions" style="justify-content:flex-end"><button class="btn" data-okx="1">Vazgeç</button><button class="btn primary" id="okKKaydet">Kuralı kaydet</button></div>`;
    $('#okA').onchange=()=>{$('#okD').value=$('#okA').value==='vkn'?(b.vkn||''):(b.unvan||'');};
    $('#okcModal').hidden=false;
    $('#okKKaydet').onclick=async()=>{const k={id:uid(),alan:$('#okA').value,deger:$('#okD').value.trim(),hesap:$('#okH').value.trim(),karsi:$('#okK').value.trim(),at:new Date().toISOString()};
      if(!k.deger||!k.hesap){toast('Değer ve hesap gerekli.');return;}await dataOp('okcKural',{fid:st.fid,kural:k});$('#okcModal').hidden=true;ciz();toast('Kural kaydedildi ve uygulandı.');};
  }
  function kuralListe(){
    const ks=kurallar();$('#okcModalT').textContent='ÖKC fiş kuralları';
    $('#okcModalB').innerHTML=ks.length?`<div class="tablewrap" style="max-height:55vh"><table><thead><tr><th>Şart</th><th>Değer</th><th>Gider</th><th>Ödeme</th><th></th></tr></thead><tbody>${ks.map(k=>`<tr><td>${k.alan==='vkn'?'VKN':'Ünvan içerir'}</td><td>${esc(k.deger)}</td><td class="mono">${esc(k.hesap)}</td><td class="mono">${esc(k.karsi||'ayar')}</td><td><button class="btn small ghost danger" data-okks="${esc(k.id)}">Sil</button></td></tr>`).join('')}</tbody></table></div>`:'<p class="note">Henüz kural yok. Listeden bir fişte “Kural yap” deyin.</p>';
    $('#okcModal').hidden=false;
  }

  /* ---- fişler, Excel, Luca ---- */
  function fisler(){
    const sec=gorunen().filter(b=>b.sec&&!b.logged);
    const tek=(b)=>{const s=satirlar(b);const ac=(b.tur==='z'?`Z RAPORU ${b.zNo||''}`:b.tur==='yd'?`YURT DIŞI ${b.no||''} ${b.unvan||''}`:`ÖKC ${b.fisNo||''} ${b.unvan||''}`).trim().slice(0,200);return {b,lines:s.L.map(x=>({...x,doc:(b.tur==='z'?b.zNo:b.tur==='yd'?b.no:b.fisNo)||'',docDate:b.tarih,desc:ac})),ac,date:b.tarih};};
    let gr=sec.map(tek);
    if(st.birlestir==='tek'&&gr.length>1){const son=gr.map(x=>x.date).sort().pop();gr=[{b:null,bs:sec,lines:gr.flatMap(x=>x.lines),ac:(st.tur==='z'?'Z RAPORLARI':st.tur==='yd'?'YURT DIŞI FATURALARI':'ÖKC FİŞLERİ')+' '+dmy(son),date:son}];}
    return gr.map((g,i)=>{const bb=r2(g.lines.reduce((t,x)=>t+x.b,0)),cc=r2(g.lines.reduce((t,x)=>t+x.c,0));const d=g.date;const [y]=String(d||'').split('-');
      return {...g,bs:g.bs||[g.b],year:+y,borc:bb,alacak:cc,json:{fisNo:String(i+1),fisTarihi:dmyS(d),fisAciklama:g.ac,fisTipi:'3',borc:bb,alacak:cc,taslakId:'',
        detaylar:g.lines.map(x=>({hesapKodu:x.acc,evrakNo:String(x.doc||'').slice(0,50),evrakTarihi:dmyS(x.docDate),borc:x.b||null,alacak:x.c||null,miktar:null,belgeTuru:st.belgeTuru||null,doviz:'0',kur:null,dovizTutar:null,detayAciklama:x.desc,tcVergiNo:null}))}};});
  }
  async function excel(){
    const fs=fisler();if(!fs.length)return;const lines=[];
    fs.forEach((x,i)=>x.lines.forEach(L=>{const dt=x.date?new Date(x.date+'T00:00:00'):null;lines.push({fis:i+1,date:dt,fdesc:x.ac,acc:L.acc,doc:L.doc,docDate:L.docDate?new Date(L.docDate+'T00:00:00'):dt,desc:L.desc,b:L.b,c:L.c});}));
    const bt=S.belgeTuru;S.belgeTuru=st.belgeTuru;let buf;try{buf=makeWorkbook(lines);}finally{S.belgeTuru=bt;}
    const ad=`${(firma()||{}).name||'firma'}_${st.tur==='z'?'z_raporlari':st.tur==='yd'?'yurt_disi_faturalari':'okc_fisleri'}.xlsx`.replace(/[^\wÇĞİÖŞÜçğıöşü.-]+/g,'_');
    try{const r=await api.saveFile(ad,new Uint8Array(buf));if(r.ok)toast('Luca fiş aktarım dosyası kaydedildi: '+r.path);}catch(e){toast(clean(e));}
  }
  async function kaydet(){
    const fs=fisler();const f=firma();if(!fs.length)return;
    if(!f||!f.lucaId){toast('Bu firmanın Luca karşılığı yok. Firmayı Luca\'dan ekleyin.');return;}
    try{await LucaBag.bekle();}catch(x){toast(clean(x));return;}
    if(!(await askConfirm('Luca\'ya kaydedilsin mi?',`${f.name} firmasına ${fs.length} mahsup fişi kesilecek (toplam ${fmt(r2(fs.reduce((t,x)=>t+x.borc,0)))} TL).`,'Evet, kaydet')))return;
    st.busy=true;ciz();const prep={};let ok=0,er=0;const hatalar=[];
    try{for(const x of fs){
      try{if(!prep[x.year])prep[x.year]=await api.luca.prepareFis({lucaId:f.lucaId,year:x.year});
        const r=await api.luca.fisKes({donemId:prep[x.year].donemId,fis:x.json});
        if(r.ok){ok++;const v={n:r.fisNo,id:r.fisId,at:new Date().toISOString()};for(const b of x.bs){b.logged=v;b.sec=false;}await dataOp('okcSet',{fid:st.fid,belgeler:x.bs});}
        else{er++;hatalar.push(r.error||'Hata');}
      }catch(e){er++;hatalar.push(clean(e));if(/oturum|NO_SESSION|UYE/i.test(clean(e)))break;}
    }}finally{st.busy=false;ciz();}
    toast(`${ok} fiş Luca'ya kaydedildi${er?`, ${er} hata: ${hatalar[0]}`:''}.`);
    if(ok){gunlukYaz('okc',f,{adet:ok,ad:'ÖKC fiş / Z raporu'});HESAP.kayitSonrasi(f);}
  }

  /* ---- olaylar ---- */
  const icinde=e=>e.target.closest('#okcPanel');
  document.addEventListener('click',async e=>{
    if(!icinde(e))return;const t=e.target;
    if(t.closest('[data-okx]')){$('#okcModal').hidden=true;return;}
    const ks=t.closest('[data-okks]');if(ks){await dataOp('okcKuralSil',{fid:st.fid,id:ks.dataset.okks});kuralListe();ciz();return;}
    const tr=t.closest('[data-okctur]');if(tr){st.tur=tr.dataset.okctur;ciz();return;}
    const fl=t.closest('[data-okcf]');if(fl){st.filtre=fl.dataset.okcf;ciz();return;}
    if(t.id==='okcEkle'){ekle(null);return;}
    if(t.id==='okcWa'){whatsappAl();return;}
    if(t.id==='okcAyar'){ayarlar();return;}
    if(t.id==='okcMizan'){const f=firma();if(!f||!f.lucaId){toast('Firmanın Luca karşılığı yok.');return;}
      try{await LucaBag.bekle();await mwBusy.run('Mizan hazırlanıyor…',f.name,()=>Desk.pullMizan(f,String(new Date().getFullYear())));f0=null;await hesaplariYukle();ciz();toast('Mizan alındı.');}catch(x){toast(clean(x));}return;}
    if(t.id==='okcKurallar'){kuralListe();return;}
    if(t.id==='okcXls'){excel();return;}
    if(t.id==='okcGo'){kaydet();return;}
    const g=t.closest('[data-okcgor]');if(g){goruntu(g.dataset.okcgor);return;}
    const d=t.closest('[data-okcduz]');if(d){duzenle(d.dataset.okcduz);return;}
    const kf=t.closest('[data-okckf]');if(kf){st.kf=kf.dataset.okckf;ciz();return;}
    const ef=t.closest('[data-okcef]');if(ef){st.ef=ef.dataset.okcef;st.efTut.clear();ciz();return;}
    if(t.id==='okcKuralUygula'){const bs=belgeler().filter(b=>b.tur==='fis'&&!b.logged);const elle=bs.filter(b=>b.hesap&&kuralBul(b));
      if(elle.length&&await askConfirm('Kurallar uygulanacak',`Hesabını elle değiştirdiğiniz ${elle.length} fiş de bir kurala uyuyor. Bunlara da kural uygulansın mı?\n\n“Hayır” derseniz yalnız elle değiştirilmemiş fişler yenilenir.`,'Evet, hepsine uygula')){for(const b of elle)delete b.hesap;await dataOp('okcSet',{fid:st.fid,belgeler:elle});}
      ciz();toast(`Kurallar uygulandı: ${bs.filter(kurallimi).length} fiş kurallı.`);return;}
    const bk=t.closest('[data-okcbinek]');if(bk){const b=belgeler().find(x=>x.id===bk.dataset.okcbinek);if(b){b.binek=bk.dataset.v!=null?bk.dataset.v==='1':!b.binek;await guncelle(b);ciz();}return;}
    const oe=t.closest('[data-okcekle]');if(oe){const b=belgeler().find(x=>x.id===oe.dataset.okcekle);if(b){b.ekSatir=[...(b.ekSatir||[]),{id:uid(),acc:'',b:0,c:0,desc:'eklenen satır'}];await guncelle(b);ciz();}return;}
    const oc=t.closest('[data-okccikar]');if(oc){const b=belgeler().find(x=>x.id===oc.dataset.okccikar);if(b){b.tutarElle={...(b.tutarElle||{}),[oc.dataset.key]:{b:0,c:0,cikar:true}};await guncelle(b);ciz();}return;}
    const og=t.closest('[data-okcgeri]');if(og){const b=belgeler().find(x=>x.id===og.dataset.okcgeri);if(b){const te={...(b.tutarElle||{})};delete te[og.dataset.key];b.tutarElle=te;await guncelle(b);ciz();}return;}
    const ox=t.closest('[data-okceksil]');if(ox){const b=belgeler().find(x=>x.id===ox.dataset.okceksil);if(b){b.ekSatir=(b.ekSatir||[]).filter(z=>z.id!==ox.dataset.eid);await guncelle(b);ciz();}return;}
    const oz=t.closest('[data-okctsif]');if(oz){const b=belgeler().find(x=>x.id===oz.dataset.okctsif);if(b){const m={...(b.tutarElle||{})};delete m[oz.dataset.key];b.tutarElle=m;await guncelle(b);ciz();}return;}
    const fi=t.closest('[data-okcfis]');if(fi){const b=belgeler().find(x=>x.id===fi.dataset.okcfis);if(b){b.acik=!b.acik;await guncelle(b);ciz();}return;}
    const ku=t.closest('[data-okckural]');if(ku){kuralYap(ku.dataset.okckural);return;}
    const sl=t.closest('[data-okcsil]');if(sl){const b=belgeler().find(x=>x.id===sl.dataset.okcsil);if(!b)return;
      if(!(await askConfirm('Belge silinsin mi?',`${b.ad||''} · ${dmy(b.tarih)} · ${fmt(toplamOf(b))}${b.logged?'\nBu belge Luca\'ya kaydedilmiş; Luca\'daki fiş silinmez.':''}`,'Evet, sil')))return;
      await dataOp('okcDel',{fid:st.fid,ids:[b.id]});try{await api.okc.sil([b.img]);}catch(x){}ciz();return;}
  });
  document.addEventListener('change',async e=>{
    if(!icinde(e))return;const t=e.target;

    if(t.id==='okcBirlestir'){st.birlestir=t.value;ciz();return;}
    if(t.id==='okcBT'){st.belgeTuru=t.value.trim().toLocaleUpperCase('tr-TR');const f=firma();if(f)await firmaKaydet({...f,okcAyar:{...(f.okcAyar||{}),belgeTuru:st.belgeTuru}});return;}
    if(t.id==='okcAll'){const bs=gorunen().filter(b=>!b.logged);for(const b of bs)b.sec=t.checked;await dataOp('okcSet',{fid:st.fid,belgeler:bs});ciz();return;}
    const sc=t.dataset.okcsec;if(sc){const b=belgeler().find(x=>x.id===sc);if(b){b.sec=t.checked;await guncelle(b);ciz();}return;}
    const h=t.dataset.okch;if(h){const b=belgeler().find(x=>x.id===h);if(b){b.hesap=t.value.trim();await guncelle(b);
      // öğren: aynı harcama türü / işyeri sonraki fişlerde bu hesaba
      const f=firma();if(f&&b.hesap){const y={...(f.okcAyar||{})};y.ogren={...(y.ogren||{})};for(const k of b.kalemler||[])y.ogren['K:'+N(k)]=b.hesap;if(b.vkn)y.ogren['V:'+b.vkn]=b.hesap;if(b.unvan)y.ogren['U:'+N(b.unvan)]=b.hesap;await firmaKaydet({...f,okcAyar:y});}
      ciz();}return;}
    const ce=t.dataset.okcel;if(ce){const b=belgeler().find(x=>x.id===ce);if(b){const key=t.dataset.key,v=t.value.trim();
        if(key==='gider#1'||key==='satış#1'||key==='gider (brüt)#1'){b.hesap=v;}else if(((key==='nakit#1'||key==='kredi kartı#1')&&b.tur==='fis')||(key==='ödeme#1'&&b.tur==='yd')){b.karsi=v;}
        else{b.satirElle={...(b.satirElle||{})};if(v)b.satirElle[key]=v;else delete b.satirElle[key];}
        await guncelle(b);ciz();}return;}
    const tu=t.dataset.okctut;if(tu){const b=belgeler().find(x=>x.id===tu);if(b){const key=t.dataset.key,yon=t.dataset.yon;const sL=satirlar(b).L.find(x=>x.key===key)||{};
        const val=r2(trSayi(t.value));const cur={b:sL.b||0,c:sL.c||0};cur[yon]=val;if(val&&yon==='b')cur.c=0;if(val&&yon==='c')cur.b=0;
        // 0 yazmak satırı çıkarmaz (Görev 39): iki taraf da 0 olursa önerilen tutara dönülür; çıkarmak için − düğmesi
        const te={...(b.tutarElle||{})};if(!cur.b&&!cur.c){delete te[key];toast('0 yazınca satır çıkmaz; önerilen tutara dönüldü. Satırı çıkarmak için − düğmesine basın.');}else te[key]=cur;b.tutarElle=te;await guncelle(b);ciz();}return;}
    const ek=t.dataset.okcek;if(ek){const b=belgeler().find(x=>x.id===ek);const x=b&&(b.ekSatir||[]).find(z=>z.id===t.dataset.eid);if(!x)return;const a=t.dataset.alan;
      if(a==='acc')x.acc=t.value.trim();else if(a==='desc')x.desc=t.value;else{x[a]=r2(trSayi(t.value));if(x[a]){if(a==='b')x.c=0;else x.b=0;}}await guncelle(b);ciz();return;}
    const k=t.dataset.okck;if(k){const b=belgeler().find(x=>x.id===k);if(b){b.karsi=t.value.trim();await guncelle(b);ciz();}return;}
  });
  firmaDinle(()=>OKC._firmaDegisti());
  return {show,hide,_ekle:ekle,_fisOku:fisOku,_zOku:zOku,_ydOku:ydOku,_ydHesap:ydHesap,_ydTarih:ydTarih,_satirlar:satirlar,_st:st,_firma:()=>firma(),_yenile:async()=>{f0=null;await hesaplariYukle();ciz();},
    _firmaDegisti:async()=>{if($('#okcPanel').hidden||!S.firm||st.fid===S.firm.id)return;st.fid=S.firm.id;f0=null;st.belgeTuru=ayar().belgeTuru||'';await hesaplariYukle();ciz();}};
})();
window.__okc=OKC;

/* ---------- Özel İşlemler › Çek / Senet Kayıtları: Logo ve Mikro çek-senet listeleri → muavinle eşleştirme → fiş → Luca ---------- */
const CEK=(()=>{
  const api=window.__mwApi||window.desktop;
  const clean=e=>String(e&&e.message||e).replace(/^Error invoking remote method '[^']+': (Error: )?/,'');
  const TUR_AD={MC:'Müşteri çeki',MS:'Müşteri senedi',KC:'Kendi çekimiz',KS:'Kendi senedimiz'};
  const OLAY_AD={giris:'Portföye giriş',ciro:'Ciro',iade:'İade (müşteriye)',tahsil:'Tahsil',tahsile:'Tahsile verildi',verilen:'Verildi (ödeme)',odendi:'Ödendi (bankadan)',kiade:'İade alındı'};
  const st={vadeBas:'',vadeBit:'',fid:'',hareket:[],dosyalar:[],muavin:null,muavinId:'',filtre:'kayitsiz',acc:new Map(),leaf:new Set(),belgeTuru:'',birlestir:'bordro',busy:false,logoTarih:'',
    f0:null,sort:null,f:{},limit:300,hx:new Map(),cariMemo:new Map(),bankaMemo:new Map(),muavinIs:null};
  const local=()=>{try{return Store.local();}catch(e){return {firms:{}};}};
  // firma kaydı önbellekte tutulur (Store.local() tüm veriyi kopyalar; satır başına çağrılınca sayfa kasıyordu)
  const firma=()=>{if(!st.f0||st.f0.id!==st.fid)st.f0=(local().firms||{})[st.fid]||null;return st.f0;};
  async function firmaKaydet(y){await Store.saveFirm(y);st.f0=y;onbellekSil();}
  const onbellekSil=()=>{st.hx.clear();st.cariMemo.clear();st.bankaMemo.clear();};
  const ayar=()=>((firma()||{}).cekAyar)||{};
  const dmy=iso=>iso?String(iso).slice(0,10).split('-').reverse().join('.'):'';
  const dmyS=iso=>iso?String(iso).slice(0,10).split('-').reverse().join('/'):'';
  const iso=d=>d?`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`:null;
  function tarihOku(v){
    if(v==null||v==='')return null;
    if(v instanceof Date&&!isNaN(v))return iso(v);
    if(typeof v==='number'&&v>20000&&v<80000){const d=new Date(Math.round((v-25569)*86400000));return iso(new Date(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()));}
    const m=String(v).match(/(\d{1,2})[./-](\d{1,2})[./-](\d{4})/);if(m)return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
    const m2=String(v).match(/(\d{4})-(\d{2})-(\d{2})/);return m2?m2[0]:null;
  }
  const say=v=>typeof v==='number'?v:trSayi(v);

  /* ---- dosya okuma (Mikro bordro dökümü / Logo çek-senet listesi) ---- */
  function okuMikro(rows,hi,ad){
    const H=rows[hi].map(x=>N(x));const c=k=>H.findIndex(h=>h===N(k));
    const C={evrak:c('Evrak No'),tarih:c('Evrak tarihi'),ba:c('Borc Alacak'),ck:c('Cari kodu'),ca:c('Cari adı'),cins:c('Cinsi'),ref:c('Referans'),vade:c('Vade'),kk:c('Karşı cari kodu'),ka:c('Karşı cari adı'),acik:c('Detay - Açıklama'),tut:c('Meblağ')};
    const out=[];let b=null;
    for(let i=hi+1;i<rows.length;i++){const r=rows[i];const g=k=>C[k]>=0?r[C[k]]:'';
      if(String(g('evrak')).trim()){b={evrak:String(g('evrak')).trim(),tarih:tarihOku(g('tarih')),ba:N(g('ba')),cariKod:String(g('ck')||'').trim(),cariAd:String(g('ca')||'').trim()};continue;}
      const cins=N(g('cins'));const t=say(g('tut'));if(!b||!cins||!t)continue;
      const tur=/MUSTERI/.test(cins)?(/SENE/.test(cins)?'MS':'MC'):(/SENE/.test(cins)?'KS':'KC');
      const ac=String(g('acik')||'').trim();const parca=ac.split('/').map(x=>x.trim()).filter(Boolean);
      const alinan=tur==='MC'||tur==='MS';const cariAlacak=/ALACAK/.test(b.ba);
      const olay=alinan?(cariAlacak?'giris':(/^120/.test(b.cariKod)?'iade':'ciro')):(cariAlacak?'kiade':'verilen');
      out.push({kaynak:'Mikro',dosya:ad,bordro:b.evrak,tarih:b.tarih,tur,olay,no:parca[0]||String(g('ref')||''),ref:String(g('ref')||''),vade:tarihOku(g('vade')),tutar:r2(t),
        cariAd:b.cariAd,cariKod:b.cariKod,banka:alinan?(parca[1]||''):String(g('ka')||parca[1]||''),bankaKod:alinan?'':String(g('kk')||''),aciklama:ac});
    }
    return out;
  }
  function okuLogo(rows,hi,ad,baslik){
    const H=rows[hi].map(x=>N(x));const c=k=>H.findIndex(h=>h===N(k));
    const C={port:c('Portföy No.'),seri:c('Seri No.'),tur:c('Türü'),vade:c('Vade'),tut:c('Tutarı'),durum:c('Durumu'),borclu:c('Borçlu'),eden:c('Ciro Eden'),edilen:c('Ciro Edilen'),banka:c('Çekin Bankası')};
    const kendi=/KENDI/.test(N(baslik));const out=[];
    for(let i=hi+1;i<rows.length;i++){const r=rows[i];const g=k=>C[k]>=0?r[C[k]]:'';
      const port=String(g('port')||'').trim();const t=say(g('tut'));if(!port||!t)continue;
      const tt=N(g('tur'));const tur=/^K/.test(tt)||kendi?(/S/.test(tt.replace(/^K/,''))?'KS':'KC'):(/S$/.test(tt)?'MS':'MC');
      const durum=String(g('durum')||'').trim();const D=N(durum);
      const ortak={kaynak:'Logo',dosya:ad,bordro:port,tarih:null,tur,no:String(g('seri')||'').trim(),ref:port,vade:tarihOku(g('vade')),tutar:r2(t),durum,banka:String(g('banka')||'').trim(),aciklama:[g('borclu'),g('banka')].filter(Boolean).join(' / ')};
      if(tur==='MC'||tur==='MS'){
        const eden=String(g('eden')||g('borclu')||'').trim();
        out.push({...ortak,id:port+':g',olay:'giris',cariAd:eden});
        if(/CIRO/.test(D))out.push({...ortak,id:port+':c',olay:'ciro',cariAd:String(g('edilen')||'').trim()});
        else if(/TAHSILE/.test(D))out.push({...ortak,id:port+':t',olay:'tahsile',cariAd:eden});
        else if(/TAHSIL/.test(D))out.push({...ortak,id:port+':t',olay:'tahsil',cariAd:eden,tarih:ortak.vade});
        else if(/IADE/.test(D))out.push({...ortak,id:port+':i',olay:'iade',cariAd:eden});
      }else{
        const kime=String(g('edilen')||'').trim();
        out.push({...ortak,id:port+':v',olay:'verilen',cariAd:kime});
        if(/TAHSIL|ODEN/.test(D))out.push({...ortak,id:port+':o',olay:'odendi',cariAd:kime,tarih:ortak.vade});
        else if(/IADE/.test(D))out.push({...ortak,id:port+':i',olay:'kiade',cariAd:kime});
      }
    }
    return out;
  }
  async function dosyaOku(file){
    const wb=await readWorkbook(file);
    for(const sn of wb.SheetNames){const rows=sheetRows(wb.Sheets[sn]);
      for(let i=0;i<Math.min(rows.length,15);i++){const H=rows[i].map(x=>N(x));
        if(H.includes('EVRAK NO')&&H.includes('CINSI')&&H.includes('MEBLAG'))return {bicim:'Mikro',hareket:okuMikro(rows,i,file.name)};
        if(H.includes('PORTFOY NO')&&H.includes('DURUMU')&&H.includes('TUTARI'))return {bicim:'Logo',hareket:okuLogo(rows,i,file.name,(rows.slice(0,i).flat().join(' ')))};}}
    throw new Error('Mikro çek bordrosu ya da Logo çek/senet listesi biçimi tanınmadı.');
  }

  /* ---- hesaplar ---- */

  /* ---- ünvan benzerliği (kısaltma ve yazım farkına toleranslı) ---- */
  const KISA={INS:'INSAAT',EML:'EMLAK',TUR:'TURIZM',TURZ:'TURIZM',TRUZIM:'TURIZM',TURIZ:'TURIZM',YAT:'YATIRIM',YATIRIMLARI:'YATIRIM',TIC:'TICARET',SAN:'SANAYI',LTD:'LIMITED',
    STI:'SIRKETI',ST:'SIRKETI',SIRKE:'SIRKETI',SIRK:'SIRKETI',ISL:'ISLETME',ISLETMESI:'ISLETME',ISLETMELERI:'ISLETME',ISLETMECILIGI:'ISLETME',ISLETMECILIK:'ISLETME',OTEL:'OTELCILIK',
    SEY:'SEYAHAT',ACEN:'ACENTASI',ACENTA:'ACENTASI',NAK:'NAKLIYAT',NAKL:'NAKLIYAT',PAZ:'PAZARLAMA',PAZAR:'PAZARLAMA',IML:'IMALAT',IMALATI:'IMALAT',URUN:'URUNLERI',URUNLER:'URUNLERI',
    ITH:'ITHALAT',IHR:'IHRACAT',HAY:'HAYVANCILIK',HAYVAN:'HAYVANCILIK',TAR:'TARIM',DAG:'DAGITIM'};
  const GENEL=new Set('AS ANONIM SIRKETI LIMITED LTD TICARET SANAYI VE INSAAT TURIZM YATIRIM ISLETME OTELCILIK GIDA EMLAK SEYAHAT PAZARLAMA IMALAT URUNLERI NAKLIYAT ACENTASI THE HOTEL EDT ITHALAT IHRACAT DAGITIM TARIM HAYVANCILIK A S TAAH TAAHHUT'.split(' '));
  const normMemo=new Map();
  function norm(s){s=String(s||'');if(normMemo.has(s))return normMemo.get(s);
    let t=N(s.replace(/(\w)-(\w)/g,'$1$2')).replace(/\bA S\b/g,'AS');const o=[];
    for(const w of t.split(' ')){if(!w)continue;o.push(...(KISA[w]||w).split(' '));}
    const r=o.join(' ').replace(/\bANONIM SIRKETI\b/g,'AS').replace(/\bANONIM\b/g,'AS').replace(/\bLIMITED SIRKETI\b/g,'LTD').replace(/\bLIMITED\b/g,'LTD').replace(/\bSIRKETI\b/g,'').replace(/\s+/g,' ').trim();
    normMemo.set(s,r);return r;}
  const ayirt=n=>n.split(' ').filter(w=>w&&!GENEL.has(w));
  function lev(a,b){if(a===b)return 0;const m=a.length,n=b.length;if(!m)return n;if(!n)return m;let p=new Array(n+1),c=new Array(n+1);for(let j=0;j<=n;j++)p[j]=j;
    for(let i=1;i<=m;i++){c[0]=i;for(let j=1;j<=n;j++)c[j]=Math.min(p[j]+1,c[j-1]+1,p[j-1]+(a[i-1]===b[j-1]?0:1));[p,c]=[c,p];}return p[n];}
  const oran=(a,b)=>(!a&&!b)?100:100*(1-lev(a,b)/Math.max(a.length,b.length));
  function kapsama(sw,tw){if(!sw.length)return 0;let tot=0,hit=0;for(const w of sw){const wt=Math.max(w.length,2);tot+=wt;let best=0;
    for(const t of tw){const r=t===w?100:(t.startsWith(w)&&w.length>=4?95:oran(w,t));if(r>best)best=r;}if(best>=80)hit+=wt*best/100;}return 100*hit/tot;}
  function benzerlik(x,y){const a=norm(x),b=norm(y);const da=ayirt(a),db=ayirt(b);
    if(!da.length||!db.length)return {skor:oran(a,b),ileri:0};
    const ilk=Math.max(Math.max(...db.map(t=>t===da[0]?100:oran(da[0],t))),Math.max(...da.map(t=>t===db[0]?100:oran(db[0],t))));
    if(ilk<85)return {skor:Math.min(60,ilk*0.6),ileri:0};
    const ileri=kapsama(da,db),geri=kapsama(db,da);return {skor:0.6*ileri+0.15*geri+0.25*oran(a,b),ileri};}

  /* ---- hesaplar ---- */
  // Hesaplar bir kerede yerine konur: yükleme sürerken firma değişir ya da dosya eklenirse yarım / eski hesaplarla
  // hesaplanıp önbelleğe (st.hx) girmesin; eski (geç biten) yüklemenin sonucu yenisinin üzerine yazılmasın.
  // Eski çağrıyı bekleyen (dosya ekleme, firma değişimi) en son yüklemenin bitmesini bekler.
  let yukSira=0,yukSon=Promise.resolve();
  function hesaplariYukle(){const sira=++yukSira;const p=hesaplariYukle0(sira);yukSon=p;return p;}
  async function hesaplariYukle0(sira){
    st.f0=null;const f=firma();let miz=[];
    if(f&&f.mizanInfo){try{miz=await Store.getMizan(f.id,f.mizanInfo.parts)||[];}catch(e){}}
    if(sira!==yukSira)return yukSon;
    const acc=new Map(),leaf=new Set();
    for(const r of miz)if(r&&r[0])acc.set(String(r[0]),String(r[1]||''));
    const ust=new Set();for(const c of acc.keys()){const p=c.lastIndexOf('.');if(p>0)ust.add(c.slice(0,p));}
    for(const c of acc.keys())if(!ust.has(c))leaf.add(c);
    st.acc=acc;st.leaf=leaf;st.f0=null;onbellekSil();
    $('#cekAccList').innerHTML=[...st.acc.entries()].filter(([c])=>st.leaf.has(c)).sort((a,b)=>a[0].localeCompare(b[0],'tr',{numeric:true})).map(([c,n])=>`<option value="${esc(c)}">${esc(n)}</option>`).join('');
  }
  const ANA={MC:'101',MS:'121',KC:'103',KS:'321'};
  const AYLAR=['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
  function cekHesabi(h){
    const a=ayar();const ana=(a.ana||{})[h.tur]||ANA[h.tur];
    if(h.vade){const [y,m]=h.vade.split('-');const k=`${ana}.${y.slice(2)}.${m}`;if(st.acc.has(k))return k;}
    return (a.varsayilan||{})[h.tur]||'';
  }
  const CARI_GRUP=['120','320','329','331','336','340','136','159','195','335','131','121','126','127','321','326'];
  // Cari: elle eşleştirme (Mikro kodu ya da ünvan) → Luca'da aynı kod → ünvan benzerliği (önce aynı ana hesap grubu)
  function cariBul(h,onc){
    const a=ayar();const el=a.cariEsle||{};
    if(h.cariKod&&el['K:'+h.cariKod])return {kod:el['K:'+h.cariKod],durum:'ELLE'};
    if(el[N(h.cariAd)])return {kod:el[N(h.cariAd)],durum:'ELLE'};
    if(h.cariKod&&st.leaf.has(h.cariKod))return {kod:h.cariKod,durum:'TAMAM'};
    const grup=(h.cariKod&&/^\d{3}/.test(h.cariKod))?h.cariKod.slice(0,3):onc;
    const mk=grup+'|'+h.cariAd;if(st.cariMemo.has(mk))return st.cariMemo.get(mk);
    const dene=gr=>{let b=null,i2=null;for(const k of st.leaf){if(!gr.includes(k.slice(0,3)))continue;const s=benzerlik(h.cariAd,st.acc.get(k));const c={kod:k,skor:s.skor,ileri:s.ileri};
      if(!b||c.skor>b.skor){i2=b;b=c;}else if(!i2||c.skor>i2.skor)i2=c;}return {b,i2};};
    let {b,i2}=dene([grup]);let disi=false;
    if(!b||b.skor<80){const al=dene(CARI_GRUP.filter(g=>g!==grup));if(al.b&&al.b.skor>=80&&(!b||al.b.skor>b.skor)){b=al.b;i2=al.i2;disi=true;}}
    let r;
    if(!b||b.skor<70)r={kod:'',durum:'YOK',not:b?'En yakın: '+b.kod+' '+(st.acc.get(b.kod)||''):''};
    else{const n=[];let d=(b.skor>=88||(b.ileri>=99&&b.skor>=75))?'TAMAM':'KONTROL';
      if(disi){d='KONTROL';n.push('Farklı ana hesapta: '+b.kod.slice(0,3));}
      if(i2&&i2.skor>=b.skor-3&&i2.skor>=80){d='KONTROL';n.push('Benzer ikinci aday: '+i2.kod+' '+(st.acc.get(i2.kod)||''));}
      r={kod:b.kod,durum:d,skor:b.skor,not:n.join('; ')};}
    st.cariMemo.set(mk,r);return r;
  }
  function bankaBul(h){
    const a=ayar();if(a.banka)return a.banka;
    if(st.bankaMemo.has(h.banka))return st.bankaMemo.get(h.banka);
    let r='';const t0=(N(h.banka).replace(/^(T C |TURKIYE )/,'').split(' ')[0]||'');
    if(t0.length>=2){const key=t0.slice(0,4);for(const [c,n] of st.acc){if(!st.leaf.has(c)||!c.startsWith('102'))continue;if(N(n).replace(/ /g,'').includes(key)){r=c;break;}}}
    st.bankaMemo.set(h.banka,r);return r;
  }
  function hesaplar(h){
    let x=st.hx.get(h);if(x)return x;
    const cek=h.cek||cekHesabi(h);
    const onc=(h.olay==='giris'||h.olay==='iade'||h.olay==='tahsile')?'120':'320';
    const cb=h.cari?{kod:h.cari,durum:'ELLE'}:cariBul(h,onc);const cari=cb.kod;const banka=h.bankaH||bankaBul(h);
    let b='',a='',karsiAd='';
    switch(h.olay){
      case 'giris':b=cek;a=cari;karsiAd='cari';break;
      case 'ciro':case 'iade':b=cari;a=cek;karsiAd='cari';break;
      case 'tahsil':b=banka;a=cek;karsiAd='banka';break;
      case 'verilen':b=cari;a=cek;karsiAd='cari';break;
      case 'kiade':b=cek;a=cari;karsiAd='cari';break;
      case 'odendi':b=cek;a=banka;karsiAd='banka';break;
    }
    x={cek,cari,cariDurum:cb.durum,cariNot:cb.not||'',banka,borc:b,alacak:a,karsiAd,karsi:karsiAd==='banka'?banka:cari};
    st.hx.set(h,x);return x;
  }
  function hatalar(h){const x=hesaplar(h);const e=[];
    if(h.olay==='tahsile')e.push('Tahsile verme fişe dönüştürülmez (bilgi)');
    if(!x.cek){const [y,m]=(h.vade||'-').split('-');e.push(h.vade?`${(ayar().ana||{})[h.tur]||ANA[h.tur]}.${y.slice(2)}.${m} mizanda yok — Luca'da açın (${AYLAR[+m-1]} ${y} vadeli)`:'Vade yok');}
    if(!x.karsi)e.push(x.karsiAd==='banka'?'Banka hesabı seçin':'Cari bulunamadı: '+(h.cariAd||'')+(x.cariNot?' ('+x.cariNot+')':''));
    if(!fisTarihi(h))e.push('İşlem tarihi yok (Logo listesinde tarih bulunmaz; üstten işlem tarihi girin)');
    return e;}
  // engellemeyen uyarılar
  function uyarilar(h){const x=hesaplar(h);const u=[];
    if(x.karsiAd==='cari'&&x.cariDurum==='KONTROL')u.push('Cari eşleşmesini kontrol edin'+(x.cariNot?': '+x.cariNot:''));
    if(h.vade&&h.tarih&&h.vade.slice(0,7)<h.tarih.slice(0,7))u.push('Vade işlem tarihinden önceki ayda; vade hatalı olabilir');
    if(h._ayniNo>1)u.push(`Aynı çek no ${h._ayniNo} hareketde geçiyor`);
    return u;}
  const fisTarihi=h=>h.tarih||(h.kaynak==='Logo'?st.logoTarih:null);
  function ayniNoSay(){const m=new Map();for(const h of st.hareket){if(!h.no)continue;const k=h.olay+'|'+h.no+'|'+N(h.banka);m.set(k,(m.get(k)||0)+1);}
    for(const h of st.hareket)h._ayniNo=h.no?m.get(h.olay+'|'+h.no+'|'+N(h.banka)):0;}

  /* ---- muavin eşleştirme ---- */
  function eslestir(){
    for(const h of st.hareket)h.muavin=null;
    if(!st.muavin)return;
    const kul=new Set();const idx=new Map();
    st.muavin.satirlar.forEach((s,i)=>{const k=s.hesap_kodu;if(!idx.has(k))idx.set(k,[]);idx.get(k).push({...s,_i:i,_a:N((s.aciklama||'')+' '+(s.belge_no||''))});});
    const tara=(h,gev)=>{const x=hesaplar(h);if(!x.cek)return null;const borcta=x.borc===x.cek;
      const ad=(idx.get(x.cek)||[]).filter(s=>!kul.has(s._i)&&Math.abs((borcta?s.borc:s.alacak)-h.tutar)<0.005);
      const no=N(h.no);
      let m=no&&no.length>=4?ad.find(s=>s._a.includes(no)):null;
      if(!m&&gev&&fisTarihi(h))m=ad.find(s=>Math.abs(new Date(s.tarih)-new Date(fisTarihi(h)))<=5*864e5);
      if(!m&&gev&&h.kaynak==='Logo'&&ad.length===1)m=ad[0];
      return m;};
    for(const gev of [false,true])for(const h of st.hareket){if(h.muavin)continue;const m=tara(h,gev);if(m){kul.add(m._i);h.muavin={fis:m.fis_no,tarih:m.tarih,aciklama:m.aciklama};}}
  }

  /* ---- tablo: sütunlar, sıralama, filtre ---- */
  const durumMetni=h=>h.logged?'Luca fiş '+(h.logged.n||''):h.olay==='tahsile'?'bilgi':hatalar(h).length?'eksik':'hazır';
  const KOL=[
    {k:'tarih',ad:'Tarih',v:h=>fisTarihi(h)||'',g:h=>dmy(fisTarihi(h)),tip:'tarih'},
    {k:'bordro',ad:'Bordro / Portföy',v:h=>h.bordro,tip:'metin'},
    {k:'islem',ad:'İşlem',v:h=>(OLAY_AD[h.olay]||h.olay)+' '+TUR_AD[h.tur]+' '+(h.durum||''),tip:'metin'},
    {k:'no',ad:'Çek / Seri No',v:h=>h.no+' '+(h.banka||''),tip:'metin'},
    {k:'vade',ad:'Vade',v:h=>h.vade||'',g:h=>dmy(h.vade),tip:'tarih'},
    {k:'tutar',ad:'Tutar',v:h=>h.tutar,tip:'sayi'},
    {k:'cari',ad:'Cari (Programda)',v:h=>h.cariAd+' '+(h.cariKod||''),tip:'metin'},
    {k:'cek',ad:'Çek Hesabı',v:h=>hesaplar(h).cek,tip:'metin'},
    {k:'karsi',ad:'Karşı Hesap',v:h=>hesaplar(h).karsi+' '+(st.acc.get(hesaplar(h).karsi)||''),tip:'metin'},
    {k:'durum',ad:'Durum',v:h=>durumMetni(h)+' '+hatalar(h).concat(uyarilar(h)).join(' '),tip:'metin'}];
  function eslesir(x,q,tip){q=q.trim();if(!q)return true;
    if(tip==='sayi'){const p=s=>trSayi(s);let m;
      if((m=q.match(/^(>=|<=|>|<|=)\s*(.+)$/))){const y=p(m[2]);return m[1]==='>'?x>y:m[1]==='<'?x<y:m[1]==='>='?x>=y:m[1]==='<='?x<=y:Math.abs(x-y)<0.005;}
      if((m=q.match(/^(.+)\.\.(.+)$/)))return x>=p(m[1])&&x<=p(m[2]);
      return fmt(x).includes(q)||String(x).includes(q);}
    if(tip==='tarih')return dmy(x).includes(q)||String(x).includes(q);
    return N(x).includes(N(q));}
  const aralikta=h=>(!st.vadeBas||(h.vade||'')>=st.vadeBas)&&(!st.vadeBit||(h.vade||'')<=st.vadeBit);
  const secilebilir=h=>!h.muavin&&!h.logged&&h.olay!=='tahsile';
  function gorunen(){
    let r=st.hareket.filter(h=>aralikta(h)&&(st.filtre==='tumu'||(st.filtre==='kayitsiz'?!h.muavin&&!h.logged&&h.olay!=='tahsile':st.filtre==='kayitli'?!!h.muavin:!!h.logged)));
    for(const c of KOL){const q=st.f[c.k];if(q&&q.trim())r=r.filter(h=>eslesir(c.v(h),q,c.tip));}
    if(st.sort){const c=KOL.find(x=>x.k===st.sort.k);const d=st.sort.d;
      r=r.slice().sort((a,b)=>{const x=c.v(a),y=c.v(b);if(c.tip==='sayi')return d*((+x||0)-(+y||0));
        if(x===''||x==null)return 1;if(y===''||y==null)return -1;return d*String(x).localeCompare(String(y),'tr',{numeric:true,sensitivity:'base'});});}
    return r;
  }
  function ozet(){const t={};for(const h of st.hareket){if(!aralikta(h))continue;const k=h.muavin?'kayitli':h.logged?'luca':'kayitsiz';t[k]=(t[k]||0)+1;}return t;}
  const secililer=()=>st.hareket.filter(h=>h.sec&&aralikta(h)&&secilebilir(h));

  function cizUst(){
    const fs=Object.values(local().firms||{}).filter(f=>f.id!==EXAMPLE_ID).sort((a,b)=>String(a.name).localeCompare(String(b.name),'tr'));
    if(S.firm&&fs.some(f=>f.id===S.firm.id)&&st.fid!==S.firm.id){st.fid=S.firm.id;st.f0=null;}            // firma üstteki ana seçimden
    if(!st.fid||!fs.some(f=>f.id===st.fid)){st.fid=(fs[0]&&fs[0].id)||'';st.f0=null;}
    const f=firma();const mi=f&&f.mizanInfo;const mj=st.muavinIs;
    $('#cekBar').innerHTML=`<button class="btn small ghost" id="cekGeri">← Ofisinize Özel Çözümler</button>
      ${fs.length?'':'<span class="chip aski">Önce Ayarlar › Firmalar\'dan firma ekleyin</span>'}
      <span class="note">Mizan: ${mi?esc(mi.source==='luca'?'Luca '+(mi.year||''):(mi.file||'Excel')):'<b style="color:var(--out)">yok</b>'}</span><button class="btn small" id="cekMizan">Mizanı Luca'dan Çek</button>
      <button class="btn small primary" id="cekDosya">＋ Çek / Senet Dosyası Ekle</button><input type="file" id="cekIn" accept=".xls,.xlsx,.csv" multiple hidden>
      ${st.hareket.some(h=>h.kaynak==='Logo')?`<label class="note">Logo işlem tarihi <input type="date" id="cekLogoT" value="${esc(st.logoTarih)}" style="width:auto"></label>`:''}
      <span style="flex:1"></span><button class="btn small" id="cekAyar">Hesap Ayarları</button>
      ${mj?`<div class="note" style="flex-basis:100%;color:var(--brand-2)">⟳ ${esc(mj.mesaj||'Muavin Luca\'dan indiriliyor…')}</div>`:''}`;
    cizSayac();
  }
  function cizSayac(){
    const o=ozet();const sec=secililer();const bad=sec.filter(h=>hatalar(h).length);
    $('#cekBar2').innerHTML=`<div class="mmtabs">${[['kayitsiz','Kaydedilecek',o.kayitsiz||0],['luca','MuhaWin ile Kaydedilen',o.luca||0],['tumu','Tümü',st.hareket.filter(aralikta).length]].map(([k,l,n])=>`<button class="btn small" data-cekf="${k}" aria-pressed="${st.filtre===k}">${l} <span class="mono">${n}</span></button>`).join('')}</div>
      <button class="btn small" id="cekSecHepsi" title="Görünen ve kaydedilebilir tüm satırları seç">Tümünü Seç</button><button class="btn small" id="cekSecYok" title="Tüm seçimleri kaldır">Seçimi Kaldır</button>
      <button class="btn small ghost danger" id="cekTemizle" title="Eklenen tüm dosyaları ve tabloyu temizler">Tabloyu Temizle</button>
      ${(()=>{const e=eksikler();const n=e.vade.length+e.cari.length;return n?`<button class="btn small primary" id="cekEksikAc" title="Mizanda olmayan 101/103/121/321 yıl/ay vade hesaplarını ve bulunamayan carileri Luca'da açar">＋ Eksik Hesapları Aç (${n})</button>`:'';})()}
      <span class="note">Seçili: <b>${sec.length}</b>${bad.length?` · <span style="color:var(--out)">${bad.length} eksik</span>`:''} · ${fmt(r2(sec.reduce((t,h)=>t+h.tutar,0)))} TL</span><span style="flex:1"></span>
      <label class="note">Vade <input type="date" id="cekVB" value="${esc(st.vadeBas||'')}" style="width:auto"> – <input type="date" id="cekVS" value="${esc(st.vadeBit||'')}" style="width:auto"></label>
      <label class="note">Fişler <select id="cekBirlestir" style="width:auto;min-width:0"><option value="bordro"${st.birlestir==='bordro'?' selected':''}>Bordro Başına</option><option value="ayri"${st.birlestir==='ayri'?' selected':''}>Her Çek Ayrı</option><option value="tek"${st.birlestir==='tek'?' selected':''}>Tek Fiş</option></select></label>
      <label class="note">Belge türü <input id="cekBT" class="mono" style="width:60px" value="${esc(st.belgeTuru)}" placeholder="boş"></label>
      <div class="note" style="flex-basis:100%">${st.dosyalar.map(d=>esc(d.ad)+' ('+d.bicim+', '+d.n+')').join(' · ')||'Dosya yok'}</div>`;
    $('#cekGo').disabled=!sec.length||!!bad.length||st.busy;$('#cekGo').textContent=`Luca'ya Kaydet (${sec.length?fisler(true).length:0} Fiş)`;
    $('#cekXls').disabled=!sec.length||!!bad.length;$('#cekRapor').disabled=!st.hareket.length;
  }
  function cizBaslik(){
    $('#cekTable').innerHTML=`<thead><tr><th style="width:28px"><input type="checkbox" id="cekAll" title="Görünenleri seç / kaldır"></th>${KOL.map(c=>`<th class="sirala${c.tip==='sayi'?' n':''}" data-cks="${c.k}" title="Sıralamak için tıklayın">${c.ad}<span class="ok">${st.sort&&st.sort.k===c.k?(st.sort.d>0?'▲':'▼'):'↕'}</span></th>`).join('')}</tr>
      <tr class="filtre"><th></th>${KOL.map(c=>`<th><input data-ckf="${c.k}" value="${esc(st.f[c.k]||'')}" placeholder="${c.tip==='sayi'?'>1000, 5..10':'filtre…'}" aria-label="${c.ad} filtresi"></th>`).join('')}</tr></thead><tbody></tbody>`;
  }
  function satirHtml(h){const x=hesaplar(h);const e=hatalar(h);const u=uyarilar(h);const i=st.hareket.indexOf(h);const ok=secilebilir(h);
    return `<tr data-ci="${i}"><td><input type="checkbox" data-cs="${i}" ${h.sec&&ok?'checked':''} ${ok?'':'disabled'}></td>
      <td class="mono">${esc(dmy(fisTarihi(h)))||'<span class="note">—</span>'}<div class="note">${esc(h.kaynak)}</div></td><td class="mono">${esc(h.bordro)}</td>
      <td><b>${esc(OLAY_AD[h.olay]||h.olay)}</b><div class="note">${esc(TUR_AD[h.tur])}${h.durum?' · '+esc(h.durum):''}</div></td>
      <td><input class="mono" data-cno="${i}" value="${esc(h.no||'')}" style="width:105px${h._ayniNo>1?';border-color:var(--aski-fg)':''}" title="Çek / senet numarası — listede yanlışsa burada düzeltin; kayıt bu numarayla yapılır"${h.logged?' disabled':''}>${h.noElle?'<span class="chip kural" title="Numara elle düzeltildi">elle</span>':''}<div class="note">${esc(h.banka||'')}</div></td><td class="mono">${esc(dmy(h.vade))}</td><td class="n">${fmt(h.tutar)}</td>
      <td>${esc(h.cariAd||'')}<div class="note mono">${esc(h.cariKod||'')}</div></td>
      <td><input class="mono" list="cekAccList" data-cc="${i}" data-hsad="${esc(h.vade?AYLAR[+h.vade.slice(5,7)-1]+' '+h.vade.slice(0,4)+' Vadeli '+(TUR_AD[h.tur]||''):'')}" value="${esc(x.cek)}" style="width:110px"><div class="note">${esc(st.acc.get(x.cek)||'')}</div></td>
      <td><input class="mono" list="cekAccList" data-ck="${i}" data-hsad="${esc(x.karsiAd==='cari'?(h.cariAd||''):'')}" value="${esc(x.karsi)}" style="width:110px${x.cariDurum==='KONTROL'&&x.karsiAd==='cari'?';border-color:var(--aski-fg)':''}"><div class="note">${esc(st.acc.get(x.karsi)||'')}</div></td>
      <td>${h.logged?`<span class="chip kural">Luca fiş ${esc(h.logged.n||'')}</span>`:h.olay==='tahsile'?'<span class="chip aski">bilgi</span>':e.length?'<span class="chip aski">eksik</span>':'<span class="chip cari">hazır</span>'}
        ${e.length&&!h.muavin&&!h.logged?`<div class="note" style="color:${h.olay==='tahsile'?'var(--muted)':'var(--out)'}">${esc(e[0])}</div>`:''}${u.length&&!h.muavin&&!h.logged?`<div class="note" style="color:var(--aski-fg)">${esc(u.join(' · '))}</div>`:''}</td></tr>`;}
  function cizGovde(){
    const vis=gorunen();const n=Math.min(vis.length,st.limit);
    const tb=$('#cekTable tbody');if(!tb){cizBaslik();return cizGovde();}
    tb.innerHTML=vis.slice(0,n).map(satirHtml).join('')||`<tr><td colspan="${KOL.length+1}" class="bosliste">${st.hareket.length?'Bu filtrede kayıt yok.':'Logo (Müşteri Çek ve Senetleri / Kendi Çek-Senetlerimiz) ya da Mikro (çek giriş / çıkış bordro dökümü) Excel dosyalarını ekleyin. Birden fazla dosya eklenebilir.'}</td></tr>`;
    if(vis.length>n)tb.insertAdjacentHTML('beforeend',`<tr><td colspan="${KOL.length+1}" style="text-align:center;padding:12px"><button class="btn small" id="cekDaha">${vis.length-n} Satır Daha Göster</button> <span class="note">(toplam ${vis.length})</span></td></tr>`);
    const tf=$('#cekTable tfoot');if(tf)tf.remove();
    if(vis.length)$('#cekTable').insertAdjacentHTML('beforeend',`<tfoot><tr><td></td><td colspan="5" style="text-align:right">${Object.values(st.f).some(v=>v&&v.trim())?'Filtrelenen Toplam':'Toplam'} <small>(${vis.length})</small></td><td class="n">${fmt(r2(vis.reduce((t,h)=>t+h.tutar,0)))}</td><td colspan="4"></td></tr></tfoot>`);
    const all=$('#cekAll');if(all){const ok=vis.filter(secilebilir);all.checked=ok.length>0&&ok.every(h=>h.sec);all.indeterminate=!all.checked&&ok.some(h=>h.sec);}
  }
  function cizBasOk(){document.querySelectorAll('#cekTable th[data-cks] .ok').forEach(s=>{const k=s.parentElement.dataset.cks;s.textContent=st.sort&&st.sort.k===k?(st.sort.d>0?'▲':'▼'):'↕';});}
  function ciz(){cizUst();cizBaslik();cizGovde();}

  async function show(){$('#cekPanel').hidden=false;LucaBag.yenile();st.f0=null;st.belgeTuru=ayar().belgeTuru||'';await hesaplariYukle();ayniNoSay();ciz();}
  function hide(){const p=$('#cekPanel');if(p)p.hidden=true;}
  async function muavinListesi(){let ds=[];try{ds=(await api.fk.muavinList()).donemler||[];}catch(e){}const f=firma();
    return ds.filter(d=>f&&((f.lucaId&&String(d.luca_id||'')===String(f.lucaId))||N(d.firma)===N(f.name)));}
  async function muavinYukle(id){try{st.muavin=await mwBusy.run('Muavin hazırlanıyor…',id,()=>api.fk.muavinGet(id));st.muavinId=id;}catch(e){toast(clean(e));}}
  async function muavinOtomatik(){const l=await muavinListesi();if(l.length)await muavinYukle(l[0].id);}
  async function muavinSec(){
    const l=await muavinListesi();
    $('#cekModalT').textContent='Muavin Seç';
    $('#cekModalB').innerHTML=`<p class="note" style="margin:0">Çekler muavindeki ${Object.values(ANA).join(' / ')} hesap hareketleriyle (hesap, tutar, çek no / tarih) eşleştirilir. Yılın son dönemini seçin (muavin yılbaşından itibaren tüm hareketleri içerir).</p>
      ${l.length?`<div class="pick">${l.map(d=>`<button class="btn" data-mv="${esc(d.id)}" style="justify-content:flex-start">${esc(d.ay)}.${esc(d.yil)} · ${esc(d.firma)} <span class="note">indirildi ${esc(String(d.zaman||'').replace('T',' '))}</span></button>`).join('')}</div>`:'<p class="note">Bu firmanın muavini yok. “Muavini Luca\'dan Çek” ile indirin.</p>'}
      <div class="actions"><button class="btn" id="cekMvLuca2">Muavini Luca'dan Çek</button><button class="btn" id="cekMvXls">Excel'den Yükle</button><button class="btn" data-cx="1">Kapat</button></div>`;
    $('#cekModal').hidden=false;
  }
  // Muavin bu sayfadan indirilir: Fatura Kontrol'ün Luca otomasyonu (yalnız muavin adımı) arka planda çalışır
  function muavinLucaSor(){
    const f=firma();if(!f||!f.lucaId){toast('Bu firmanın Luca karşılığı yok (Ayarlar › Firmalar › “Luca\'dan firma ekle”).');return;}
    const d=new Date();const vars=st.logoTarih||(st.hareket.map(h=>h.tarih).filter(Boolean).sort().pop())||iso(new Date(d.getFullYear(),d.getMonth(),0));
    $('#cekModalT').textContent='Muavini Luca\'dan Çek';
    $('#cekModalB').innerHTML=`<p class="note" style="margin:0">${esc(f.name)} firmasının muavini Luca'dan seçilen yılın tamamı olarak indirilir (Ocak–Aralık). Luca girişi Fatura Kontrol'ün Chrome penceresinde yapılır; indirme bitince muavin bu sayfada kendiliğinden seçilir.</p>
      <label class="lbl" for="cekMvAy">Dönem (ay)</label><input type="month" id="cekMvAy" value="${esc(vars.slice(0,7))}" style="width:auto">
      <div class="actions" style="justify-content:flex-end"><button class="btn" data-cx="1">Vazgeç</button><button class="btn primary" id="cekMvBasla">Muavini Çek</button></div>`;
    $('#cekModal').hidden=false;
  }
  async function muavinLucaBasla(ay){
    const f=firma();$('#cekModal').hidden=true;
    try{st.muavinIs={mesaj:'Luca\'ya bağlanılıyor…',fid:f.id};cizUst();
      await api.fk.muavinCek({id:String(f.lucaId),ad:f.name,ay});
      const bekle=async()=>{let d={};try{d=await api.fk.topluDurum();}catch(e){}
        const il=d.ilerleme||{};if(st.muavinIs)st.muavinIs.mesaj=(il.mesaj||'Muavin indiriliyor…')+(d.sessiz_sn>120?' — Chrome penceresinde açık bir uyarı olabilir':'');
        if(d.calisiyor){if(!$('#cekPanel').hidden)cizUst();setTimeout(bekle,3000);return;}
        const fid=st.muavinIs&&st.muavinIs.fid;st.muavinIs=null;
        if(fid===st.fid){const l=await muavinListesi();const hedef=l.find(x=>`${x.yil}-${String(x.ay).padStart(2,'0')}`===ay)||l[0];
          if(hedef){await muavinYukle(hedef.id);eslestir();toast('Muavin Luca\'dan alındı.');}else toast('Muavin indirilemedi: '+((d.gunluk||[]).slice(-1)[0]||'ayrıntı için Muhasebe İşlemleri › Toplu Kontrol'));}
        if(!$('#cekPanel').hidden)ciz();};
      setTimeout(bekle,3000);
    }catch(e){st.muavinIs=null;cizUst();toast(clean(e));}
  }
  function ayarlar(){
    const a=ayar();const f=(id,v)=>`<input list="cekAccList" class="mono" id="${id}" value="${esc(v||'')}" style="width:130px">`;
    $('#cekModalT').textContent='Çek / Senet Hesap Ayarları';
    $('#cekModalB').innerHTML=`<p class="note" style="margin:0">Çek hesabı vadeye göre <b>ana.YY.AA</b> alt hesabından bulunur (örn. 101.26.09 = Eylül 2026 vadeli alınan çekler). Bulunamazsa aşağıdaki hesap kullanılır.</p>
      <div class="outgrid" style="gap:10px">${Object.entries(TUR_AD).map(([k,l])=>`<div><label class="lbl">${l}: ana hesap / bulunamazsa</label><div class="actions" style="margin:0"><input class="mono" id="ca_${k}" value="${esc((a.ana||{})[k]||ANA[k])}" style="width:70px">${f('cv_'+k,(a.varsayilan||{})[k])}</div></div>`).join('')}
      <div><label class="lbl">Tahsil / ödeme bankası (boş: çekin bankasından)</label>${f('ca_banka',a.banka)}</div></div>
      <p class="note" style="margin:0">Elle düzelttiğiniz cari eşleştirmeleri: <b>${Object.keys(a.cariEsle||{}).length}</b> ${Object.keys(a.cariEsle||{}).length?'<button class="btn small ghost" id="caEsleSil">Sıfırla</button>':''}</p>
      <div class="actions" style="justify-content:flex-end"><button class="btn" data-cx="1">Vazgeç</button><button class="btn primary" id="caKaydet">Kaydet</button></div>`;
    $('#cekModal').hidden=false;
    $('#caKaydet').onclick=async()=>{const f=firma();if(!f)return;const y={...(f.cekAyar||{}),ana:{},varsayilan:{},banka:$('#ca_banka').value.trim()};
      for(const k of Object.keys(TUR_AD)){y.ana[k]=$('#ca_'+k).value.trim()||ANA[k];y.varsayilan[k]=$('#cv_'+k).value.trim();}
      await firmaKaydet({...f,cekAyar:y});$('#cekModal').hidden=true;eslestir();ciz();toast('Ayarlar kaydedildi.');};
    const es=$('#caEsleSil');if(es)es.onclick=async()=>{const f=firma();await firmaKaydet({...f,cekAyar:{...(f.cekAyar||{}),cariEsle:{}}});$('#cekModal').hidden=true;for(const h of st.hareket)h.cari=undefined;eslestir();ciz();};
  }

  /* ---- fişler / Excel / Luca ---- */
  const kisaBanka=b=>{let t=String(b||'').replace(/\s+/g,' ').trim();t=t.replace(/\s*(BANKASI|BANKA|BANK)\b.*$/i,'').trim()||t;return t.length>14?t.slice(0,14).trim():t;};
  function detay(h){   // Luca detay açıklaması en fazla 100 karakter
    const tur={MC:'MÇ',MS:'MS',KC:'FÇ',KS:'BS'}[h.tur];const bas=[tur+' '+(h.no||h.bordro||''),kisaBanka(h.banka),h.vade?'Vd.'+dmy(h.vade):''].filter(Boolean).join(' ');
    let ad=String(h.cariAd||'').replace(/\s+/g,' ').trim();const kal=100-bas.length-1;if(ad.length>kal)ad=ad.slice(0,Math.max(0,kal)).replace(/\s+\S*$/,'').trim()||ad.slice(0,Math.max(0,kal));
    return (bas+(ad?' '+ad:'')).slice(0,100);}
  function fisler(sadeceSay){
    const sec=secililer();
    const gruplar=new Map();
    for(const h of sec){const k=st.birlestir==='tek'?'tek':st.birlestir==='ayri'?st.hareket.indexOf(h):h.kaynak==='Logo'?`Logo|${h.olay}|${fisTarihi(h)}`:`${h.kaynak}|${h.bordro}|${h.olay}|${fisTarihi(h)}`;if(!gruplar.has(k))gruplar.set(k,[]);gruplar.get(k).push(h);}
    if(sadeceSay)return [...gruplar.keys()];
    return [...gruplar.values()].map((hs,i)=>{
      const tarih=hs.map(fisTarihi).filter(Boolean).sort().pop();
      const lines=[];const toplu=new Map();
      for(const h of hs){const x=hesaplar(h);const ac=detay(h);
        lines.push({acc:x.cek,b:x.borc===x.cek?h.tutar:0,c:x.alacak===x.cek?h.tutar:0,doc:h.no||h.bordro,desc:ac});
        const kk=x.karsi+'|'+(x.borc===x.cek?'A':'B');const t=toplu.get(kk)||{acc:x.karsi,b:0,c:0,doc:h.bordro,desc:((OLAY_AD[h.olay]||'')+' '+(h.cariAd||'')).trim().slice(0,100)};
        if(x.borc===x.cek)t.c=r2(t.c+h.tutar);else t.b=r2(t.b+h.tutar);toplu.set(kk,t);}
      lines.push(...toplu.values());
      const ac=(hs.length===1?`${OLAY_AD[hs[0].olay]} ${hs[0].kaynak} ${hs[0].bordro}`:`${OLAY_AD[hs[0].olay]} ${hs[0].kaynak} bordro ${hs[0].bordro}`).slice(0,200);
      const bb=r2(lines.reduce((t,x)=>t+x.b,0)),cc=r2(lines.reduce((t,x)=>t+x.c,0));
      return {hs,date:tarih,year:+String(tarih||'').slice(0,4),lines,ac,borc:bb,json:{fisNo:String(i+1),fisTarihi:dmyS(tarih),fisAciklama:ac,fisTipi:'3',borc:bb,alacak:cc,taslakId:'',
        detaylar:lines.map(x=>({hesapKodu:x.acc,evrakNo:String(x.doc||'').slice(0,50),evrakTarihi:dmyS(tarih),borc:x.b||null,alacak:x.c||null,miktar:null,belgeTuru:st.belgeTuru||null,doviz:'0',kur:null,dovizTutar:null,detayAciklama:x.desc,tcVergiNo:null}))}};});
  }
  async function excel(){const fs=fisler();if(!fs.length)return;const lines=[];
    fs.forEach((x,i)=>{const dt=x.date?new Date(x.date+'T00:00:00'):null;x.lines.forEach(L=>lines.push({fis:i+1,date:dt,fdesc:x.ac,acc:L.acc,doc:L.doc,docDate:dt,desc:L.desc,b:L.b,c:L.c}));});
    const bt=S.belgeTuru;S.belgeTuru=st.belgeTuru;let buf;try{buf=makeWorkbook(lines);}finally{S.belgeTuru=bt;}
    try{const r=await api.saveFile(`${(firma()||{}).name||'firma'}_cek_senet_fisleri.xlsx`.replace(/[^\wÇĞİÖŞÜçğıöşü.-]+/g,'_'),new Uint8Array(buf));if(r.ok)toast('Luca fiş aktarım dosyası kaydedildi: '+r.path);}catch(e){toast(clean(e));}}
  async function rapor(){
    const wb=XLSX.utils.book_new();
    // Aktarmadan önce bakılacaklar
    const bak=[['No','Konu','Yapılacak','Tutar']];const eksik=new Map(),cariYok=new Map(),kontrol=new Map();
    for(const h of st.hareket){if(h.muavin||h.logged||h.olay==='tahsile')continue;const x=hesaplar(h);
      if(!x.cek&&h.vade){const k=hatalar(h)[0];eksik.set(k,(eksik.get(k)||0)+h.tutar);}
      if(x.karsiAd==='cari'&&!x.cari)cariYok.set(h.cariAd,(cariYok.get(h.cariAd)||0)+h.tutar);
      if(x.karsiAd==='cari'&&x.cari&&x.cariDurum==='KONTROL')kontrol.set(h.cariAd+' → '+x.cari+' '+(st.acc.get(x.cari)||''),(kontrol.get(h.cariAd+' → '+x.cari+' '+(st.acc.get(x.cari)||''))||0)+h.tutar);}
    for(const [k,t] of eksik)bak.push([bak.length,'Hesap açılmalı',k,r2(t)]);
    for(const [k,t] of cariYok)bak.push([bak.length,'Cari bulunamadı',k+' için Luca hesabını seçin',r2(t)]);
    for(const [k,t] of kontrol)bak.push([bak.length,'Cari eşleşmesini kontrol edin',k,r2(t)]);
    for(const h of st.hareket)if(h._ayniNo>1&&!h.muavin)bak.push([bak.length,'Aynı çek numarası',`${h.no} ${h.cariAd} ${dmy(h.vade)}`,h.tutar]);
    if(bak.length===1)bak.push(['','Sorun bulunmadı','','']);
    XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(bak),'Bakılacaklar');
    const aoa=[['Kaynak','Dosya','İşlem tarihi','Bordro / Portföy','Tür','İşlem','Durum (programda)','Çek / Seri No','Banka','Vade','Tutar','Cari (programda)','Program cari kodu','Çek hesabı','Karşı hesap','Karşı hesap adı','Durum','Luca fiş no','Hata','Uyarı']];
    for(const h of st.hareket){const x=hesaplar(h);aoa.push([h.kaynak,h.dosya,dmy(fisTarihi(h)),h.bordro,TUR_AD[h.tur],OLAY_AD[h.olay]||h.olay,h.durum||'',h.no,h.banka||'',dmy(h.vade),h.tutar,h.cariAd||'',h.cariKod||'',x.cek,x.karsi,st.acc.get(x.karsi)||'',h.logged?'MuhaWin ile kaydedildi':durumMetni(h),h.logged?h.logged.n||'':'',hatalar(h).join('; '),uyarilar(h).join('; ')]);}
    XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(aoa),'Çek Senet Raporu');
    try{const r=await api.saveFile(`${(firma()||{}).name||'firma'}_cek_senet_raporu.xlsx`.replace(/[^\wÇĞİÖŞÜçğıöşü.-]+/g,'_'),new Uint8Array(XLSX.write(wb,{type:'array',bookType:'xlsx'})));if(r.ok)toast('Rapor kaydedildi: '+r.path);}catch(e){toast(clean(e));}}
  async function kaydet(){
    const fs=fisler();const f=firma();if(!fs.length)return;
    if(!f||!f.lucaId){toast('Bu firmanın Luca karşılığı yok.');return;}
    try{await LucaBag.bekle();}catch(x){toast(clean(x));return;}
    if(!(await askConfirm('Luca\'ya kaydedilsin mi?',`${f.name} firmasına ${fs.length} mahsup fişi kesilecek (toplam ${fmt(r2(fs.reduce((t,x)=>t+x.borc,0)))} TL).`,'Evet, kaydet')))return;
    st.busy=true;cizSayac();const prep={};let ok=0,er=0;const hata=[];
    try{for(const x of fs){try{if(!prep[x.year])prep[x.year]=await api.luca.prepareFis({lucaId:f.lucaId,year:x.year});
      const r=await api.luca.fisKes({donemId:prep[x.year].donemId,fis:x.json});
      if(r.ok){ok++;for(const h of x.hs){h.logged={n:r.fisNo,at:new Date().toISOString()};h.sec=false;}}else{er++;hata.push(r.error||'Hata');}}
      catch(e){er++;hata.push(clean(e));if(/oturum|NO_SESSION|UYE/i.test(clean(e)))break;}}}
    finally{st.busy=false;ciz();}
    toast(`${ok} fiş Luca'ya kaydedildi${er?`, ${er} hata: ${hata[0]}`:''}.`);
    if(ok){gunlukYaz('cek',f,{adet:ok,ad:'Çek / senet fişi'});HESAP.kayitSonrasi(f);}
  }
  async function dosyaEkle(files){
    for(const file of files){try{const r=await dosyaOku(file);let n=0;
        for(const h of r.hareket){h.id=h.id||`${h.kaynak}:${h.bordro}:${h.no}:${h.olay}:${h.tutar}`;if(st.hareket.some(x=>x.id===h.id))continue;h.sec=true;st.hareket.push(h);n++;}
        st.dosyalar.push({ad:file.name,bicim:r.bicim,n});}
      catch(e){toast(file.name+': '+clean(e));}}
    {const f=firma();if(f&&!f.mizanInfo&&st.hareket.length&&await mizanOtoCek(f,(st.logoTarih||(st.hareket.find(h=>h.tarih)||{}).tarih||'').slice(0,4),async()=>{await hesaplariYukle();eslestir();ciz();}))await hesaplariYukle();}
    st.hareket.sort((a,b)=>String(a.tarih||a.vade||'').localeCompare(String(b.tarih||b.vade||''))||String(a.bordro).localeCompare(String(b.bordro),'tr',{numeric:true}));
    ayniNoSay();eslestir();for(const h of st.hareket)if(h.sec&&!h._ilk){h._ilk=1;if(hatalar(h).some(e=>!/İşlem tarihi/.test(e))){h.sec=false;h._eksik=1;}}st.limit=300;ciz();
    const f=firma();if(f&&f.lucaId&&eksikler().vade.length)setTimeout(()=>eksikAc(true),50);
  }
  // Mizanda olmayan vade hesapları (101/103/121/321.YY.AA) ve bulunamayan cariler
  function eksikler(){const vk=new Set(),cari=new Map();const a=ayar();
    for(const h of st.hareket){if(!aralikta(h)||h.olay==='tahsile'||h.logged)continue;const x=hesaplar(h);
      if(!x.cek&&h.vade){const [y,m]=h.vade.split('-');vk.add(`${(a.ana||{})[h.tur]||ANA[h.tur]}.${y.slice(2)}.${m}`);}
      if(x.karsiAd==='cari'&&!x.karsi&&h.cariAd){const onc=(h.olay==='giris'||h.olay==='iade'||h.olay==='tahsile')?'120':'320';const k=onc+'|'+N(h.cariAd);if(!cari.has(k))cari.set(k,{grup:onc,ad:h.cariAd,rs:[]});cari.get(k).rs.push(h);}}
    return {vade:[...vk].sort(),cari:[...cari.values()]};}
  async function eksikAc(oto){
    const f=firma();if(!f||!f.lucaId){toast('Firmanın Luca karşılığı yok.');return;}
    const e=eksikler();const m=await HESAP.hesaplar(f);for(const [k,v] of st.acc)if(!m.has(k))m.set(k,v);
    const liste=HESAP.vadeHesaplari(m,e.vade);const ek=new Map(liste.map(x=>[x.kod,x.ad]));const cariYeni=[];
    if(!oto)for(const c of e.cari){const y=HESAP.cariKodu(m,c.grup,c.ad,ek);for(const z of y){ek.set(z.kod,z.ad);liste.push(z);}if(y.length)cariYeni.push({c,kod:y[y.length-1].kod});}
    if(!liste.length){if(!oto)toast('Açılacak eksik hesap yok.');return;}
    let r;try{r=await HESAP.ac(f,liste,{baslik:oto?'Çek/senet vade hesapları Luca\'da yok — açılsın mı?':'Eksik hesaplar Luca\'da açılsın mı?'});}catch(x){toast(clean(x));return;}
    if(!r)return;const tamam=new Set(r.filter(x=>x.ok).map(x=>x.kod));
    for(const y of cariYeni)if(tamam.has(y.kod))for(const h of y.c.rs){h.cari=y.kod;}
    await hesaplariYukle();
    let n=0;for(const h of st.hareket)if(h._eksik&&!h.sec&&!h.logged&&!hatalar(h).some(x=>!/İşlem tarihi/.test(x))){h.sec=true;h._eksik=0;n++;}
    ciz();
    const acilan=r.filter(x=>x.ok);const hatali=r.filter(x=>!x.ok);
    await askConfirm('Hesaplar açıldı',`${f.name} hesap planına ${acilan.length} hesap açıldı:\n`+acilan.map(x=>x.kod+'  '+x.ad).join('\n')+(hatali.length?`\n\nAçılamayan (${hatali.length}):\n`+hatali.map(x=>x.kod+'  '+(x.hata||x.mesaj||'')).join('\n'):'')+(n?`\n\n${n} satır yeniden seçildi.`:''),'Tamam');
  }
  async function temizle(){
    if(!st.hareket.length)return;
    if(!(await askConfirm('Tablo temizlensin mi?',`Eklenen ${st.dosyalar.length} dosya ve ${st.hareket.length} hareket listeden kaldırılacak. Luca'daki kayıtlar ve hesap ayarları etkilenmez.`,'Evet, temizle')))return;
    st.hareket=[];st.dosyalar=[];st.f={};st.sort=null;st.limit=300;onbellekSil();ciz();
  }

  /* ---- olaylar ---- */
  const icinde=e=>e.target.closest('#cekPanel');
  let fz=null;
  document.addEventListener('click',async e=>{
    if(!icinde(e))return;const t=e.target;
    if(t.closest('[data-cx]')){$('#cekModal').hidden=true;return;}
    if(t.id==='cekGeri'){hide();HUB.show('ozel');return;}
    if(t.id==='cekDosya'){$('#cekIn').click();return;}
    if(t.id==='cekAyar'){ayarlar();return;}
    if(t.id==='cekMuavin'){muavinSec();return;}
    if(t.id==='cekMuavinLuca'||t.id==='cekMvLuca2'){muavinLucaSor();return;}
    if(t.id==='cekMvBasla'){const ay=$('#cekMvAy').value;if(!/^\d{4}-\d{2}$/.test(ay)){toast('Dönem seçin.');return;}muavinLucaBasla(ay);return;}
    if(t.id==='cekMvXls'){$('#cekModal').hidden=true;MMUI.open('muavin');setTimeout(()=>{const b=document.querySelector('[data-mmyukle=muavin]');if(b)b.click();},800);return;}
    const mv=t.closest('[data-mv]');if(mv){$('#cekModal').hidden=true;await muavinYukle(mv.dataset.mv);eslestir();ciz();return;}
    if(t.id==='cekMizan'){const f=firma();if(!f||!f.lucaId){toast('Firmanın Luca karşılığı yok.');return;}
      try{await LucaBag.bekle();await mwBusy.run('Mizan hazırlanıyor…',f.name,()=>Desk.pullMizan(f,(st.logoTarih||new Date().toISOString()).slice(0,4)));await hesaplariYukle();eslestir();ciz();toast('Mizan alındı.');}catch(x){toast(clean(x));}return;}
    const fl=t.closest('[data-cekf]');if(fl){st.filtre=fl.dataset.cekf;st.limit=300;cizSayac();cizGovde();return;}
    const so=t.closest('th[data-cks]');if(so){const k=so.dataset.cks,o=st.sort;st.sort=o&&o.k===k?(o.d>0?{k,d:-1}:null):{k,d:1};cizBasOk();cizGovde();return;}
    if(t.id==='cekDaha'){st.limit+=500;cizGovde();return;}
    if(t.id==='cekSecHepsi'){let atla=0;for(const h of gorunen())if(secilebilir(h)){if(hatalar(h).some(x=>!/İşlem tarihi/.test(x))){atla++;continue;}h.sec=true;}cizSayac();cizGovde();if(atla)toast(`${atla} eksik hesaplı satır seçilmedi (önce hesabını düzeltin).`);return;}
    if(t.id==='cekSecYok'){for(const h of st.hareket)h.sec=false;cizSayac();cizGovde();return;}
    if(t.id==='cekTemizle'){temizle();return;}
    if(t.id==='cekXls'){excel();return;}
    if(t.id==='cekRapor'){rapor();return;}
    if(t.id==='cekGo'){kaydet();return;}
    if(t.id==='cekEksikAc'){eksikAc(false);return;}
  });
  document.addEventListener('input',e=>{if(!icinde(e))return;const t=e.target;
    if(t.dataset.ckf!=null){st.f[t.dataset.ckf]=t.value;st.limit=300;clearTimeout(fz);fz=setTimeout(cizGovde,200);}});
  document.addEventListener('change',async e=>{
    if(!icinde(e))return;const t=e.target;
    if(t.dataset.ckf!=null)return;
    if(t.id==='cekIn'&&t.files.length){await mwBusy.run('Dosyalar okunuyor…',[...t.files].map(f=>f.name).join(', '),()=>dosyaEkle([...t.files]));t.value='';return;}

    if(t.id==='cekLogoT'){st.logoTarih=t.value;onbellekSil();eslestir();ciz();return;}
    if(t.id==='cekVB'||t.id==='cekVS'){st[t.id==='cekVB'?'vadeBas':'vadeBit']=t.value;cizSayac();cizGovde();return;}
    if(t.id==='cekBirlestir'){st.birlestir=t.value;cizSayac();return;}
    if(t.id==='cekBT'){st.belgeTuru=t.value.trim().toLocaleUpperCase('tr-TR');const f=firma();if(f)await firmaKaydet({...f,cekAyar:{...(f.cekAyar||{}),belgeTuru:st.belgeTuru}});return;}
    if(t.id==='cekAll'){for(const h of gorunen())if(secilebilir(h)&&(!t.checked||!hatalar(h).some(x=>!/İşlem tarihi/.test(x))))h.sec=t.checked;cizSayac();cizGovde();return;}
    if(t.dataset.cs!=null){st.hareket[+t.dataset.cs].sec=t.checked;cizSayac();const all=$('#cekAll');if(all){const ok=gorunen().filter(secilebilir);all.checked=ok.length>0&&ok.every(h=>h.sec);all.indeterminate=!all.checked&&ok.some(h=>h.sec);}return;}
    if(t.dataset.cno!=null){const h=st.hareket[+t.dataset.cno];const v=t.value.trim();if(v===h.no)return;h.no=v;h.noElle=true;ayniNoSay();st.hx.delete(h);eslestir();cizSayac();cizGovde();toast(h._ayniNo>1?`Bu numara hâlâ ${h._ayniNo} harekette geçiyor.`:'Çek numarası düzeltildi; kayıt bu numarayla yapılır.');return;}
    if(t.dataset.cc!=null){const h=st.hareket[+t.dataset.cc];h.cek=t.value.trim();st.hx.delete(h);eslestir();cizSayac();cizGovde();return;}
    if(t.dataset.ck!=null){const h=st.hareket[+t.dataset.ck];const x=hesaplar(h);const v=t.value.trim();
      if(x.karsiAd==='banka')h.bankaH=v;
      else{const f=firma();if(f&&h.cariAd&&v){const y={...(f.cekAyar||{})};y.cariEsle={...(y.cariEsle||{}),[N(h.cariAd)]:v};if(h.cariKod)y.cariEsle['K:'+h.cariKod]=v;await firmaKaydet({...f,cekAyar:y});}
        else h.cari=v;}
      onbellekSil();eslestir();cizSayac();cizGovde();return;}
  });
  firmaDinle(()=>CEK._firmaDegisti());
  return {show,hide,_dosyaEkle:dosyaEkle,_st:st,_hesaplar:hesaplar,_fisler:fisler,_eslestir:eslestir,_gorunen:gorunen,_firma:()=>firma(),_yenile:async()=>{st.f0=null;await hesaplariYukle();ciz();},
    _firmaDegisti:async()=>{if($('#cekPanel').hidden||!S.firm||st.fid===S.firm.id)return;st.fid=S.firm.id;st.f0=null;await hesaplariYukle();ciz();}};
})();

window.__cek=CEK;

/* ---------- fatura PDF'i (GİB görsel şablonu → PDF, ayrı pencerede) ---------- */
async function faturaPdf(id,belge){try{await mwBusy.run('Fatura açılıyor…',belge,()=>window.desktop.fk.faturaPdf(id,belge));}catch(e){toast(String(e&&e.message||e).replace(/^Error invoking remote method '[^']+': (Error: )?/,''));}}

/* ---------- Denetim ve Analiz / Özel İşlemler: işlem kartları ---------- */
/* ---------- Denetim › Günün özeti: bugün (ya da seçilen aralıkta) yapılan işler ---------- */
const OZET=(()=>{
  const TUR={banka:'Banka ekstresi → Luca',fatura:'Fatura → Luca',okc:'ÖKC fiş / Z raporu → Luca',cek:'Çek / senet → Luca',fis:'Fiş girişi → Luca',muavin:'Muavin indirildi',mizan:'Mizan çekildi',plan:'Hesap planı çekildi',beyanname:'Beyanname hazırlandı',kontrol:'Fatura–muavin kontrolü'};
  let st={bas:'',bit:''};
  function kayitlar(){const d=Store.local();const L=[...(d.gunluk||[])];
    // eski kayıtlar (günlük eklenmeden önce): banka ve fatura aktarım partileri + ÖKC logged
    // günlük kaydı varken eski kaynaklardan aynı iş (tür + firma, ±10 dk) ikinci kez listelenmesin
    const varMi=(tur,fid,at)=>L.some(x=>x.tur===tur&&x.fid===fid&&Math.abs(new Date(x.at)-new Date(at))<600e3);
    for(const [fid,x] of Object.entries(d.aktarim||{}))for(const b of (x.batches||[])){if(!b.at||varMi('banka',fid,b.at))continue;const okN=(b.fisler||[]).filter(z=>z.st==='ok').length;if(okN)L.push({tur:'banka',fid,firma:b.firm,at:b.at,adet:okN,ad:`${b.kind||''} · ${b.period||''}`,tutar:(b.fisler||[]).filter(z=>z.st==='ok').reduce((t,z)=>t+(+z.b||0),0)});}
    for(const [fid,x] of Object.entries(d.fkayit||{}))for(const b of (x.batches||[])){if(!b.at||varMi('fatura',fid,b.at))continue;const okL=(b.fisler||[]).filter(z=>z.st==='ok');if(okL.length)L.push({tur:'fatura',fid,firma:b.firm,at:b.at,adet:okL.reduce((t,z)=>t+((z.belgeler||[1]).length),0),ad:`Fatura kaydı · ${b.period||''}`,tutar:okL.reduce((t,z)=>t+(+z.b||+z.toplam||0),0)});}
    for(const [fid,bs] of Object.entries(d.okc||{})){const g=new Map();for(const b of Object.values(bs||{})){if(!b.logged||!b.logged.at)continue;const k=b.logged.at.slice(0,16);const o=g.get(k)||{tur:'okc',fid,firma:((d.firms||{})[fid]||{}).name||'',at:b.logged.at,adet:0,ad:'ÖKC fiş / Z raporu',tutar:0};o.adet++;o.tutar+=(+b.toplam||0);g.set(k,o);}for(const o of g.values())if(!varMi('okc',fid,o.at))L.push(o);}
    return L;}
  function ac(){st.bas=st.bit=new Date().toISOString().slice(0,10);ciz();$('#ozetModal').hidden=false;}
  function ciz(){let M=$('#ozetModal');if(!M){document.body.insertAdjacentHTML('beforeend',`<div class="modal" id="ozetModal" hidden><div class="mbox" style="width:min(980px,100%)" role="dialog" aria-modal="true" aria-labelledby="ozetT">
      <div class="mhead"><h2 id="ozetT">Günün özeti</h2><button class="btn small ghost" data-ozetx="1" aria-label="Kapat">✕ Kapat</button></div><div class="mbody" id="ozetB"></div></div></div>`);M=$('#ozetModal');
      M.addEventListener('pointerdown',e=>{if(e.target===M)M.hidden=true;});M.addEventListener('click',async e=>{if(e.target.closest('[data-ozetx]'))M.hidden=true;
        if(e.target.id==='ozetPdf'){try{await mwBusy.run('PDF hazırlanıyor…','',()=>window.desktop.htmlPdf({html:pdfHtml(),ad:'Gunun_Ozeti_'+st.bas}));}catch(x){toast(cleanErr(x));}}
        if(e.target.id==='ozetBugun'){st.bas=st.bit=new Date().toISOString().slice(0,10);ciz();}if(e.target.id==='ozetHafta'){const d=new Date();st.bit=d.toISOString().slice(0,10);d.setDate(d.getDate()-6);st.bas=d.toISOString().slice(0,10);ciz();}});
      M.addEventListener('change',e=>{if(e.target.id==='ozetBas'){st.bas=e.target.value;ciz();}if(e.target.id==='ozetBit'){st.bit=e.target.value;ciz();}});}
    const L=suz();const g=new Map();for(const x of L){const k=x.firma||'(firma yok)';if(!g.has(k))g.set(k,[]);g.get(k).push(x);}
    const top={};for(const x of L){top[x.tur]=(top[x.tur]||0)+(x.adet!=null?+x.adet||0:1);}
    $('#ozetB').innerHTML=`<div class="actions" style="margin:0 0 10px;flex-wrap:wrap"><label class="note">Tarih <input type="date" id="ozetBas" value="${st.bas}"> – <input type="date" id="ozetBit" value="${st.bit}"></label><button class="btn small" id="ozetBugun">Bugün</button><button class="btn small" id="ozetHafta">Son 7 gün</button><span style="flex:1"></span><button class="btn small" id="ozetPdf" ${L.length?'':'disabled'}>PDF Yazdır</button></div>
      <div class="banner" style="margin:0 0 10px">${L.length?Object.entries(top).map(([t,n])=>`<b>${n}</b> ${esc(TUR[t]||t)}`).join(' · '):'Bu aralıkta kayıtlı iş yok.'} · ${new Set(L.map(x=>x.firma)).size} firma</div>
      ${[...g.entries()].sort((a,b)=>a[0].localeCompare(b[0],'tr')).map(([firma,xs])=>`<h3 style="margin:12px 0 4px;font-size:14px">${esc(firma)} <span class="note">· ${xs.reduce((t,x)=>t+(+x.adet||0),0)} işlem</span></h3>
        <table class="mini" style="width:100%"><thead><tr><th style="width:120px">Saat</th><th style="width:220px">İş</th><th>Açıklama</th><th class="n" style="width:70px">Adet</th><th class="n" style="width:130px">Tutar</th></tr></thead><tbody>
        ${xs.sort((a,b)=>String(a.at).localeCompare(String(b.at))).map(x=>`<tr><td class="mono">${esc(String(x.at||'').slice(0,16).replace('T',' '))}</td><td>${esc(TUR[x.tur]||x.tur)}</td><td>${esc(x.ad||'')}${x.nolar&&x.nolar.length?` <span class="note">fiş ${esc(x.nolar.join(', '))}</span>`:''}</td><td class="n">${x.adet||''}</td><td class="n mono">${x.tutar?fmt(x.tutar):''}</td></tr>`).join('')}</tbody></table>`).join('')}`;}
  function suz(){const b=st.bas||'0000',e=(st.bit||'9999')+'T99';return kayitlar().filter(x=>x.at>=b&&x.at<=e);}
  function pdfHtml(){const L=suz();const e=esc;return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><style>body{font:11.5px/1.35 "Segoe UI",Arial,sans-serif;color:#111;margin:0;padding:18px}h1{font-size:16px;margin:0 0 2px}h2{font-size:13px;margin:12px 0 4px}table{width:100%;border-collapse:collapse}th{background:#eef2f7;text-align:left;border-bottom:1px solid #999;padding:4px 6px}td{border-bottom:1px solid #ddd;padding:3px 6px}td.n,th.n{text-align:right}</style></head><body><h1>Günün özeti · ${e(st.bas.split('-').reverse().join('.'))}${st.bit!==st.bas?' – '+e(st.bit.split('-').reverse().join('.')):''}</h1><p>${L.length} iş · ${new Set(L.map(x=>x.firma)).size} firma · MuhaWin</p>
    <table><thead><tr><th>Zaman</th><th>Firma</th><th>İş</th><th>Açıklama</th><th class="n">Adet</th><th class="n">Tutar</th></tr></thead><tbody>${L.sort((a,b)=>String(a.at).localeCompare(String(b.at))).map(x=>`<tr><td>${e(String(x.at||'').slice(0,16).replace('T',' '))}</td><td>${e(x.firma||'')}</td><td>${e(TUR[x.tur]||x.tur)}</td><td>${e(x.ad||'')}</td><td class="n">${x.adet||''}</td><td class="n">${x.tutar?fmt(x.tutar):''}</td></tr>`).join('')}</tbody></table></body></html>`;}
  return {ac};
})();
/* ---------- Denetim › Banka bakiye mutabakatı: yüklü ekstre ↔ 102 muavini ---------- */
const BMUT=(()=>{
  let st={sonuc:null,sekme:'ozet',hesap:''};
  const iso=d=>d instanceof Date?`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`:String(d||'').slice(0,10);
  const gun=s=>Math.round(new Date(s+'T00:00:00').getTime()/864e5);
  async function ac(){const f=S.firm;if(!f||f.id===EXAMPLE_ID){toast('Üstten gerçek bir firma seçin.');return;}
    const dosyalar=S.files.filter(x=>!x.sample&&x.bankIdx>=0&&x.rows&&x.rows.length);
    if(!dosyalar.length){toast('Önce Banka İşlemleri\'nde bu firmanın banka ekstresini yükleyip hesabını seçin; mutabakat yüklü ekstre ile 102 muavinini karşılaştırır.');return;}
    let m;try{m=await mwBusy.run('Muavin okunuyor…',f.name,async()=>{const api=window.desktop.fk;const ds=((await api.muavinList()).donemler||[]).filter(d=>(f.lucaId&&String(d.luca_id||'')===String(f.lucaId))||N(d.firma)===N(f.name)).sort((a,b)=>String(b.zaman||'').localeCompare(String(a.zaman||'')));if(!ds.length)throw new Error(`${f.name} için indirilmiş muavin yok. Mizan / Muavin penceresinden Luca'dan çekin.`);return {d:ds[0],m:await api.muavinGet(ds[0].id)};});}
    catch(e){toast(cleanErr(e));return;}
    st.sonuc=karsilastir(f,dosyalar,m.m,m.d);st.sekme='ozet';st.hesap=st.sonuc.hesaplar[0]?st.sonuc.hesaplar[0].kod:'';ciz();$('#bmutModal').hidden=false;}
  function karsilastir(f,dosyalar,m,d){
    const banks=f.banks||[];const hesaplar=[];
    for(const b of banks){const kod=String(b.code||'').trim();if(!kod)continue;const ds=dosyalar.filter(x=>banks[x.bankIdx]===b);if(!ds.length)continue;
      const E=[];for(const x of ds)for(const r of x.rows){if(!r.date||!isFinite(+r.amt)||!+r.amt)continue;E.push({tarih:iso(r.date),tutar:r2(+r.amt),ac:String(r.desc||'').slice(0,120),bal:isFinite(+r.bal)?+r.bal:null,dosya:x.name||''});}
      if(!E.length)continue;E.sort((a,b)=>a.tarih.localeCompare(b.tarih));const bas=E[0].tarih,bit=E[E.length-1].tarih;
      const M=(m.satirlar||[]).filter(s=>String(s.hesap_kodu)===kod||String(s.hesap_kodu).startsWith(kod+'.')).map((s,i)=>({i,tarih:String(s.tarih).slice(0,10),tutar:r2((+s.borc||0)-(+s.alacak||0)),ac:String(s.aciklama||'').slice(0,120),fis:s.fis_no,belge:s.belge_no||''}));
      const Md=M.filter(s=>s.tarih>=bas&&s.tarih<=bit);const kullanildi=new Set();
      for(const e of E){let en=null,enF=9;for(const s of Md){if(kullanildi.has(s.i)||Math.abs(s.tutar-e.tutar)>0.005)continue;const fark=Math.abs(gun(s.tarih)-gun(e.tarih));if(fark<=3&&fark<enF){en=s;enF=fark;if(!fark)break;}}
        if(en){kullanildi.add(en.i);e.es=en;en.es=e;}}
      const eksik=E.filter(e=>!e.es),fazla=Md.filter(s=>!s.es);
      // mükerrer adayı: muavinde aynı tarih+tutar iki kez, ekstrede bir kez
      const say=new Map();for(const s of Md){const k=s.tarih+'|'+s.tutar;say.set(k,(say.get(k)||0)+1);}const esay=new Map();for(const e of E){const k=e.tarih+'|'+e.tutar;esay.set(k,(esay.get(k)||0)+1);}
      for(const s of fazla){const k=s.tarih+'|'+s.tutar;s.mukerrer=(say.get(k)||0)>(esay.get(k)||0)&&(esay.get(k)||0)>0;}
      const mBakiyeBit=r2(M.filter(s=>s.tarih<=bit).reduce((t,s)=>t+s.tutar,0));const mBakiyeBas=r2(M.filter(s=>s.tarih<bas).reduce((t,s)=>t+s.tutar,0));
      const sonBal=[...E].reverse().find(e=>e.bal!=null);const eBakiyeBit=sonBal?sonBal.bal:null;
      hesaplar.push({kod,ad:b.label||'',bas,bit,E,M:Md,eksik,fazla,esl:E.length-eksik.length,eGiris:r2(E.filter(e=>e.tutar>0).reduce((t,e)=>t+e.tutar,0)),eCikis:r2(-E.filter(e=>e.tutar<0).reduce((t,e)=>t+e.tutar,0)),
        mGiris:r2(Md.filter(s=>s.tutar>0).reduce((t,s)=>t+s.tutar,0)),mCikis:r2(-Md.filter(s=>s.tutar<0).reduce((t,s)=>t+s.tutar,0)),mBakiyeBas,mBakiyeBit,eBakiyeBit,fark:eBakiyeBit==null?null:r2(eBakiyeBit-mBakiyeBit),mukerrer:fazla.filter(s=>s.mukerrer).length});}
    return {firma:f.name,muavinZaman:d.zaman,hesaplar};}
  function ciz(){let M=$('#bmutModal');if(!M){document.body.insertAdjacentHTML('beforeend',`<div class="modal" id="bmutModal" hidden><div class="mbox" style="width:min(1100px,100%)" role="dialog" aria-modal="true" aria-labelledby="bmutT">
      <div class="mhead"><h2 id="bmutT">Banka bakiye mutabakatı</h2><button class="btn small ghost" data-bmutx="1" aria-label="Kapat">✕ Kapat</button></div><div class="mbody" id="bmutB"></div></div></div>`);M=$('#bmutModal');
      M.addEventListener('pointerdown',e=>{if(e.target===M)M.hidden=true;});
      M.addEventListener('click',async e=>{if(e.target.closest('[data-bmutx]')){M.hidden=true;return;}const t=e.target.closest('[data-bmsek]');if(t){st.sekme=t.dataset.bmsek;ciz();return;}
        if(e.target.id==='bmutXls'){xls();return;}});
      M.addEventListener('change',e=>{if(e.target.id==='bmutHesap'){st.hesap=e.target.value;ciz();}});}
    const R=st.sonuc;if(!R)return;const h=R.hesaplar.find(x=>x.kod===st.hesap)||R.hesaplar[0];
    const trd=s=>String(s||'').split('-').reverse().join('.');
    const sek=[['ozet','Özet'],['eksik',`Ekstrede var, muavinde yok (${h?h.eksik.length:0})`],['fazla',`Muavinde var, ekstrede yok (${h?h.fazla.length:0})`]];
    $('#bmutB').innerHTML=`<p class="note" style="margin:0 0 10px">${esc(R.firma)} · muavin ${R.muavinZaman?new Date(R.muavinZaman).toLocaleString('tr-TR',{dateStyle:'short',timeStyle:'short'}):''} · Eşleştirme: aynı tutar, en çok 3 gün tarih farkı. "Ekstrede var, muavinde yok" = Luca'ya aktarılmamış hareket; "muavinde var, ekstrede yok" = elle girilmiş, yanlış hesaba işlenmiş ya da mükerrer kayıt adayı.</p>
      ${R.hesaplar.length?`<div class="actions" style="margin:0 0 10px;flex-wrap:wrap"><label class="note">Hesap <select id="bmutHesap">${R.hesaplar.map(x=>`<option value="${esc(x.kod)}"${x===h?' selected':''}>${esc(x.kod)} · ${esc(x.ad)}</option>`).join('')}</select></label>
        <div class="mmtabs">${sek.map(([k,l])=>`<button class="btn small" data-bmsek="${k}" aria-pressed="${st.sekme===k}">${l}</button>`).join('')}</div><span style="flex:1"></span><button class="btn small" id="bmutXls">Excel'e Aktar</button></div>`:'<div class="banner">Firmanın banka hesaplarına bağlı ekstre bulunamadı.</div>'}
      ${h&&st.sekme==='ozet'?`<table class="mini" style="width:100%"><thead><tr><th></th><th class="n">Ekstre</th><th class="n">Muavin (102)</th><th class="n">Fark</th></tr></thead><tbody>
        <tr><td>Dönem</td><td colspan="3">${trd(h.bas)} – ${trd(h.bit)}</td></tr>
        <tr><td>Hareket sayısı</td><td class="n">${h.E.length}</td><td class="n">${h.M.length}</td><td class="n">${h.E.length-h.M.length}</td></tr>
        <tr><td>Giriş (borç) toplamı</td><td class="n mono">${fmt(h.eGiris)}</td><td class="n mono">${fmt(h.mGiris)}</td><td class="n mono">${fmt(r2(h.eGiris-h.mGiris))}</td></tr>
        <tr><td>Çıkış (alacak) toplamı</td><td class="n mono">${fmt(h.eCikis)}</td><td class="n mono">${fmt(h.mCikis)}</td><td class="n mono">${fmt(r2(h.eCikis-h.mCikis))}</td></tr>
        <tr><td>Eşleşen hareket</td><td class="n" colspan="3">${h.esl} · eşleşmeyen ekstre ${h.eksik.length} · eşleşmeyen muavin ${h.fazla.length}${h.mukerrer?` · <b style="color:var(--out)">${h.mukerrer} mükerrer adayı</b>`:''}</td></tr>
        <tr><td>Dönem sonu bakiye</td><td class="n mono">${h.eBakiyeBit==null?'<span class="note">ekstrede bakiye sütunu yok</span>':fmt(h.eBakiyeBit)}</td><td class="n mono">${fmt(h.mBakiyeBit)} <span class="note">(dönem başı ${fmt(h.mBakiyeBas)})</span></td><td class="n mono">${h.fark==null?'':`<b style="color:${Math.abs(h.fark)<0.01?'var(--cari-fg)':'var(--out)'}">${fmt(h.fark)}</b>`}</td></tr></tbody></table>
        <p class="note" style="margin:10px 0 0">${h.fark!=null&&Math.abs(h.fark)<0.01&&!h.eksik.length&&!h.fazla.length?'✓ Ekstre ile muavin uyumlu.':'Farkı kapatmak için: eksik hareketleri Banka İşlemleri\'nden Luca\'ya aktarın; fazla / mükerrer kayıtları Fiş Listesi\'nden bulup Luca\'da düzeltin.'}</p>`:''}
      ${h&&st.sekme==='eksik'?liste(h.eksik.map(e=>[trd(e.tarih),e.ac,e.tutar,e.dosya]),['Tarih','Açıklama (ekstre)','Tutar','Dosya'],'Tüm ekstre hareketleri muavinde var.'):''}
      ${h&&st.sekme==='fazla'?liste(h.fazla.map(s=>[trd(s.tarih),s.ac,s.tutar,`${s.fis||''}${s.belge?' · '+s.belge:''}${s.mukerrer?' · MÜKERRER?':''}`]),['Tarih','Açıklama (muavin)','Tutar','Fiş · belge'],'Muavindeki tüm hareketler ekstrede var.'):''}`;}
  function liste(rows,bas,bos){return rows.length?`<div class="mmwrap"><table class="mini" style="width:100%"><thead><tr>${bas.map((b,i)=>`<th class="${i===2?'n':''}">${b}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr><td class="mono">${esc(r[0])}</td><td>${esc(r[1])}</td><td class="n mono" style="color:${r[2]<0?'var(--out)':'inherit'}">${fmt(r[2])}</td><td class="note">${esc(r[3])}</td></tr>`).join('')}</tbody><tfoot><tr><td colspan="2"><b>Toplam</b> · ${rows.length} hareket</td><td class="n mono"><b>${fmt(r2(rows.reduce((t,r)=>t+r[2],0)))}</b></td><td></td></tr></tfoot></table></div>`:`<p class="note" style="padding:16px;text-align:center">${bos}</p>`;}
  async function xls(){const R=st.sonuc;if(!R)return;const wb=XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([['Hesap','Banka','Dönem','Ekstre hareket','Muavin hareket','Eşleşen','Ekstrede var muavinde yok','Muavinde var ekstrede yok','Mükerrer adayı','Ekstre giriş','Muavin giriş','Ekstre çıkış','Muavin çıkış','Ekstre bakiye','Muavin bakiye','Fark'],...R.hesaplar.map(h=>[h.kod,h.ad,`${h.bas} – ${h.bit}`,h.E.length,h.M.length,h.esl,h.eksik.length,h.fazla.length,h.mukerrer,h.eGiris,h.mGiris,h.eCikis,h.mCikis,h.eBakiyeBit,h.mBakiyeBit,h.fark])]),'Özet');
    for(const h of R.hesaplar){XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([['Tür','Tarih','Açıklama','Tutar','Fiş / dosya','Not'],...h.eksik.map(e=>['Ekstrede var, muavinde yok',e.tarih,e.ac,e.tutar,e.dosya,'']),...h.fazla.map(s=>['Muavinde var, ekstrede yok',s.tarih,s.ac,s.tutar,s.fis||'',s.mukerrer?'mükerrer adayı':''])]),h.kod.slice(0,28));}
    try{const r=await window.desktop.saveFile((R.firma+'_banka_mutabakat').replace(/[^\wÇĞİÖŞÜçğıöşü.-]+/g,'_')+'.xlsx',new Uint8Array(XLSX.write(wb,{type:'array',bookType:'xlsx'})));if(r.ok)toast('Kaydedildi: '+r.path);}catch(x){toast(cleanErr(x));}}
  return {ac,_karsilastir:karsilastir};
})();
const HUB=(()=>{
  const I={
    tablo:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M9 9v11M15 9v11"/></svg>',
    uyari:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l9 16H3z"/><path d="M12 10v4M12 17h.01"/></svg>',
    kisi:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5"/><path d="M17 8h5M19.5 5.5v5"/></svg>',
    banka:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10l9-6 9 6M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 21h18"/></svg>',
    kdv:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 5L5 19"/><circle cx="7" cy="7" r="2.5"/><circle cx="17" cy="17" r="2.5"/></svg>',
    kur:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h13l-3-3M20 17H7l3 3"/></svg>'};
  const ISLER={
    denetim:{t:'Denetim ve Analiz',p:'Firmaların Luca\'dan çekilen mizan ve muavinleri üzerinde kontroller. Bir işlem seçin.',k:[
      {id:'ters',ad:'Ters bakiyeli hesaplar',d:'Mizanda normal yönünün tersine bakiye veren hesaplar (ör. alacak bakiyeli kasa, borç bakiyeli satıcı).',i:I.uyari,ac:()=>MMUI.open('mizan',{ters:true})},
      {id:'cari',ad:'Cari mutabakat ve yaşlandırma',d:'Karşı taraf bazında e-fatura toplamı ile cari hesap hareketlerini karşılaştırır, açık bakiyeleri yaşlandırır.',i:I.kisi,dev:true},
      {id:'banka',ad:'Banka bakiye mutabakatı',d:'Banka İşlemleri\'nde yüklü ekstre ile firmanın 102 muavinini karşılaştırır: aktarılmayan satırlar, mükerrer kayıt adayları ve dönem sonu bakiye farkı.',i:I.banka,ac:()=>BMUT.ac()},
      {id:'ozet',ad:'Günün özeti',d:'Bugün (ya da seçilen aralıkta) Luca\'ya kaydedilen fişler, indirilen muavinler ve diğer işler — firma bazında, PDF.',i:I.tablo,ac:()=>OZET.ac()},
      {id:'kdviade',ad:'KDV iade listeleri',d:'İndirilecek KDV ve yüklenilen KDV listelerini GİB\'in güncel Excel biçiminde hazırlar.',i:I.kdv,dev:true}]},
    ozel:{t:'Ofisinize Özel Çözümler',p:'Sadece sizin muhasebe ofisinize özel, sizin tarafınızdan talep edilmiş yazılımlar. Bir işlem seçin.',k:[
      {id:'mikro',ad:'Muhasebe Denetimi',d:'Muhasebe programından (Mikro, Luca) alınan alış / satış XML\'leri ve firmanın muaviniyle firma denetimi: KDV, matrah ve cari kontrolü; KDV 1 / KDV 2 beyannamesi, çıktı raporu ve muhtasar taslağı.',i:I.tablo,ac:()=>{HUB.hide();CEK.hide();MDENET.show();}},
      {id:'cek',ad:'Çek / Senet Kayıtları',d:'Logo ve Mikro\'dan alınan çek / senet Excel dosyalarını okur, Luca muavini ile eşleştirip raporlar; eksik kayıtları fiş olarak hazırlar ve Luca\'ya işler.',i:I.kur,ac:()=>{HUB.hide();MDENET.hide();CEK.show();}}]}};
  let aktif=null;
  function show(id){aktif=id;const x=ISLER[id];$('#hubT').textContent=x.t;$('#hubP').textContent=x.p;
    const kartlar=id==='ozel'?x.k.filter(k=>(window.__ozelListe||[]).includes(k.id)):x.k;
    $('#hubGrid').innerHTML=(kartlar.length?'':'<p class="note">Ofisinize henüz özel çözüm tanımlanmamış.</p>')+kartlar.map(k=>`<button class="modcard" data-hub="${k.id}" ${k.dev?'disabled aria-disabled="true"':''}><span class="mi">${k.i}</span><h2>${esc(k.ad)}</h2><p>${esc(k.d)}</p><span class="ms ${k.dev?'dev':'ok'}">${k.dev?'Geliştiriliyor':'Aç'}</span></button>`).join('');
    $('#hubPanel').hidden=false;}
  function hide(){aktif=null;$('#hubPanel').hidden=true;}
  $('#hubGrid').addEventListener('click',e=>{const b=e.target.closest('[data-hub]');if(!b||b.disabled||!aktif)return;const k=ISLER[aktif].k.find(x=>x.id===b.dataset.hub);if(aktif==='ozel'&&!(window.__ozelListe||[]).includes(k&&k.id))return;if(k&&k.ac)k.ac();});
  return {show,hide};
})();

/* ---------- otomatik güncelleme: indirilen yeni sürüm için bant ve Ayarlar → Hakkında ---------- */
const UPD=(()=>{
  let st={state:'idle'},kapandi=false;const u=window.desktop&&window.desktop.update;
  const metin=()=>({checking:'Güncellemeler denetleniyor…',latest:'Program güncel.',available:`Yeni sürüm ${st.version||''} indiriliyor…`,
    downloading:`Yeni sürüm ${st.version||''} indiriliyor… %${st.percent||0}`,ready:`Yeni sürüm ${st.version||''} hazır.`,
    error:'Güncelleme denetlenemedi'+(st.error?': '+st.error:'.'),idle:st.enabled===false?'Otomatik güncelleme yalnız kurulu programda çalışır.':''}[st.state]||'');
  function ciz(){
    for(const d of [$('#updDurum'),$('#updDurumAuth')])if(d)d.textContent=metin();
    for(const b of [$('#updBtn'),$('#updBtnAuth')])if(b){b.textContent=st.state==='ready'?'Yeniden Başlat ve Güncelle':'Güncellemeleri Denetle';b.disabled=st.state==='checking'||st.state==='downloading';}
    let bant=$('#updBant');
    if(st.state==='ready'&&!kapandi){if(!bant){document.body.insertAdjacentHTML('beforeend','<div id="updBant" role="status"></div>');bant=$('#updBant');}
      bant.innerHTML=`<span>MuhaWin <b>${esc(st.version||'')}</b> indirildi.</span><button class="btn small" data-updkur="1">Yeniden başlat ve güncelle</button><button class="x" data-updx="1" title="Sonra (program kapanınca kurulur)">✕</button>`;}
    else if(bant)bant.remove();
  }
  if(u){u.on(x=>{st=x;ciz();});u.status().then(x=>{st=x;ciz();}).catch(()=>{});}
  document.addEventListener('click',async e=>{
    if(e.target.closest('[data-updx]')){kapandi=true;ciz();return;}
    const ub=e.target.id==='updBtn'||e.target.id==='updBtnAuth';
    if(e.target.closest('[data-updkur]')||(ub&&st.state==='ready')){if(u)await u.install();return;}
    if(ub&&!u){toast('Güncelleme bu sürümde kullanılamıyor.');return;}
    if(ub&&u){st={...st,state:'checking'};ciz();try{st=await u.check();}catch(x){}ciz();}
  });
  return {ciz};
})();

/* ---------- Fatura → Luca kayıt: kurallarla hesap önerisi, Excel, Luca'ya fiş, ardından muavin kontrolü ---------- */
const ISLETME_AKTARIM_ACIK=false;   // işletme / serbest meslek fatura aktarımı (Luca fiş Excel'i, Luca'ya kaydet): "Çok yakında"
const FKAYIT=(()=>{
  const api=window.__mwApi||window.desktop;
  const clean=e=>String(e&&e.message||e).replace(/^Error invoking remote method '[^']+': (Error: )?/,'');
  const dmyS=iso=>{const [y,m,d]=String(iso).slice(0,10).split('-');return `${d}/${m}/${y}`;};
  const toDate=iso=>{const [y,m,d]=String(iso).slice(0,10).split('-').map(Number);return new Date(y,m-1,d);};
  const st={data:null,firm:null,rows:[],filter:'kayitsiz',q:'',sort:null,f:{},acc:new Map(),leaf:new Set(),kural:{},log:{keys:{},batches:[]},belgeTuru:'',busy:false,stop:false};
  const CARI={ALIS:['320','329','336','340','331','335'],SATIS:['120','121','127','128','136','340']};
  /* ---- Görev 34: kaydedilen fişlerin Luca'daki durumu ---- */
  // Luca fiş no karşılaştırması (Python kayit_aday.fis_no_norm ile aynı): boşluk, sondaki ".0", baştaki sıfırlar atılır
  const fnoN=x=>String(x??'').replace(/\s+/g,'').toUpperCase().replace(/\.0+$/,'').replace(/^0+(?=\d)/,'');
  // kayıt geçmişinde (fatura kaydı raporları) bir fişin kaydı: v = {n: Luca fiş no, id, at: kayıt zamanı, b: rapor kimliği}
  // kayıt geçmişi depodan her seferinde güncel okunur (kayıttan sonra depo yenilenir; eski nesne kalmasın)
  const logGuncel=()=>{if(st.firm){const x=(local().fkayit||{})[st.firm.id];if(x)st.log=x;}return st.log;};
  function fisKaydi(v){const b=(logGuncel().batches||[]).find(x=>x.id===v.b);const x=b&&(b.fisler||[]).find(z=>z.st==='ok'&&String(z.lucaNo)===String(v.n));return {b,x};}
  // Luca'dan silindiği işaretlenen fişlerin faturaları (fatura anahtarı; eski kayıtlarda belge no ile)
  function silinmisler(){const m=new Map();
    for(const b of (logGuncel().batches||[]))for(const x of (b.fisler||[])){if(!x.silindi)continue;const v={...x.silindi,n:x.lucaNo,tarih:x.date};
      for(const k of (x.anahtarlar||[]))if(!m.has(k))m.set(k,v);for(const k of (x.belgeler||[]))if(!m.has('b:'+k))m.set('b:'+k,v);}   // kayıtlar yeniden eskiye: en yeni not geçerli
    return m;}
  // Muavin Luca'dan çekildiğinde: programın Luca'ya kaydettiği fişin numarası muavinde yoksa fiş Luca'dan silinmiş sayılır.
  // Yanlış karar olmasın diye hepsi gerekir: muavin kayıttan sonra indirilmiş, fişin tarihi muavinin kapsadığı dönemde,
  // fatura muavinde bulunmamış (Fatura Kontrol eşleştirmesi) ve fiş numarası muavinde yok.
  function silinenBul(rows,mv,fisTarihi){
    if(!mv||!Array.isArray(mv.fisler)||!mv.bas||!mv.bit)return [];
    const nolar=new Set(mv.fisler.map(x=>fnoN(x[1])));const t=Date.parse(mv.zaman);
    return rows.filter(r=>{const v=r.logged;if(!v||!v.n||r.f.kayitli)return false;
      if(!(t>Date.parse(v.at)))return false;
      const ft=String((fisTarihi&&fisTarihi(r))||r.f.tarih).slice(0,10);if(!(ft>=mv.bas&&ft<=mv.bit))return false;
      return !nolar.has(fnoN(v.n));});}
  async function silinenleriIsle(){
    if(!st.firm)return;
    const L=silinenBul(st.rows,st.data.muavin,r=>{const {x}=fisKaydi(r.logged);return x&&x.date;});
    if(!L.length)return;
    await isaretle(L,'muavin');
    toast(`${L.length} faturanın Luca fişi muavinde bulunamadı (Luca'dan silinmiş); kayıtsız olarak yeniden listelendi.`);
  }
  // fişi silinmiş sayılan faturalar: "kaydedildi" işareti kalkar (tekrar kaydedilebilir), rapordaki fişe silinme notu düşülür
  async function isaretle(rows,neden){
    const at=new Date().toISOString(),keys=[],degisen=new Map();
    for(const r of rows){const v=r.logged;if(!v)continue;keys.push(r.f.anahtar);const {b,x}=fisKaydi(v);
      if(x){x.silindi={neden,at};x.anahtarlar=[...new Set([...(x.anahtarlar||[]),r.f.anahtar])];degisen.set(b.id,b);}
      r.silindi={neden,at,n:v.n};r.logged=null;r.sec=!r.f.kayitli&&!r.f.haric;}
    try{await dataOp('unlogFKayit',{fid:st.firm.id,keys});for(const b of degisen.values())await dataOp('logFKayit',{fid:st.firm.id,keys:{},batch:b});}
    catch(e){toast('İşaret kaydedilemedi: '+clean(e));}
    st.log=(local().fkayit||{})[st.firm.id]||st.log;
  }
  const TYPE_NAMES={SATIS:'Satış',IADE:'İade',TEVKIFAT:'Tevkifat',ISTISNA:'İstisna',IHRACKAYITLI:'İhraç kayıtlı',OZELMATRAH:'Özel matrah',SGK:'SGK',KONAKLAMAVERGISI:'Konaklama'};

  /* ---- veri ---- */
  const local=()=>{try{return Store.local();}catch(e){return {firms:{},fkurallar:{},fkayit:{}};}};
  async function dataOp(name,args){const d=await api.dataOp(name,args);Store.cache=d;return d;}
  function loadAccounts(miz){
    st.acc=new Map();st.leaf=new Set();
    for(const [k,v] of Object.entries(st.data.hesaplar||{}))st.acc.set(k,v);
    for(const r of miz||[])if(r&&r[0])st.acc.set(String(r[0]),String(r[1]||st.acc.get(String(r[0]))||''));
    const codes=[...st.acc.keys()].map(c=>c.split(/[.\- ]/).join('.'));const set=new Set(codes);
    for(const c of st.acc.keys()){const k=c.split(/[.\- ]/).join('.');if(![...set].some(o=>o!==k&&o.startsWith(k+'.')))st.leaf.add(c);}
    $('#fkkAccList').innerHTML=[...st.acc.entries()].filter(([c])=>st.leaf.has(c)).sort((a,b)=>a[0].localeCompare(b[0],'tr',{numeric:true})).map(([c,n])=>`<option value="${esc(c)}">${esc(n)}</option>`).join('');
  }
  async function resolveFirm(){
    const d=st.data,L=local();let f=null;
    if(d.luca_id)f=Object.values(L.firms||{}).find(x=>String(x.lucaId||'')===String(d.luca_id));
    if(!f)f=Object.values(L.firms||{}).find(x=>N(x.name)===N(d.klasor_ad)||N(x.name)===N(d.firma));
    if(!f&&d.luca_id){f={id:uid(),name:d.klasor_ad||d.firma,lucaId:String(d.luca_id),banks:[],askiIn:'',askiOut:'',createdAt:new Date().toISOString()};await Store.saveFirm(f);}
    st.firm=f;
    const LL=local();st.kural=(LL.fkurallar||{})[f?f.id:'']||{};st.log=(LL.fkayit||{})[f?f.id:'']||{keys:{},batches:[]};
    let miz=[];if(f&&f.mizanInfo){try{miz=await Store.getMizan(f.id,(f.mizanInfo||{}).parts)||[];}catch(e){}}
    loadAccounts(miz);
    st.planM=new Map(st.acc);if(f){try{const m=await HESAP.hesaplar(f);for(const [k,v] of m)if(!st.planM.has(k))st.planM.set(k,v);}catch(e){}}
    {const lf=planLeaf();$('#fkkAccList').innerHTML=[...st.planM.entries()].filter(([c])=>lf.has(c)||st.leaf.has(c)).sort((a,b)=>a[0].localeCompare(b[0],'tr',{numeric:true})).map(([c,n])=>`<option value="${esc(c)}">${esc(n)}</option>`).join('');}
  }
  // carisi bulunamayan faturalar: hesap planında ünvanla ara, yoksa firmanın 120 / 320 düzenine göre taslak cari (Luca'ya kayıtta açılır)
  function taslakAta(){const f=st.firm;if(!f||!f.lucaId||!st.planM)return;
    for(const r of st.rows){if(r.cari||r.logged||r.f.kayitli||r.f.haric||!r.f.karsi_unvan)continue;
      const o=HESAP.cariOner(f,st.planM,etkin(r.f)==='ALIS'?'320':'120',r.f.karsi_unvan,r.f.karsi_vkn||'');
      if(o&&o.kod){r.cari=o.kod;r.cariOto=true;if(!o.yeni&&!st.acc.has(o.kod))st.acc.set(o.kod,o.ad);}}}
  const cariTaslak=r=>!!(st.firm&&r.cari&&HESAP.taslakMi(st.firm.id,r.cari));

  /* ---- öneri: kural → geçmiş kayıt → ünvan eşleşmesi ---- */
  function toks(s){return N(s).replace(/[^A-Z0-9 ]/g,' ').split(/\s+/).filter(t=>t.length>=3&&!STOPW.has(t));}
  function cariBul(f){
    const pre=CARI[etkin(f)];const ut=toks(f.karsi_unvan);if(!ut.length)return '';
    let best='',bs=0;
    for(const [c,n] of st.acc){if(!st.leaf.has(c)||!pre.includes(c.slice(0,3)))continue;
      const nt=new Set(toks(n));const hit=ut.filter(t=>nt.has(t)).length;if(!hit)continue;
      const sc=hit/ut.length+(c.startsWith(pre[0])?0.05:0);if(sc>bs){bs=sc;best=c;}}
    return bs>=0.5?best:'';
  }
  const komMu=f=>!!f&&f.yon==='ALIS'&&(f.komisyoncu||f.tip==='KOMISYONCU');   // komisyoncu (HKS) faturası: mal sahibinin satışı
  const etkin=f=>komMu(f)?'SATIS':((f.yon==='ALIS')!==(f.tip==='IADE')?'ALIS':'SATIS');   // cari tarafı alış gibi mi (satıcı → 320)
  // Fatura kuralı (Görev 34 · 7, Görev 21'deki banka kurallarıyla aynı yaklaşım): 1. şart {alan, deger}, "+" ile eklenen
  // 2., 3. … şartlar ek: [{alan, deger}] — hepsi birlikte tutmalı (VE). eylem: '' = hesapla kaydet · 'atla' = hiç kaydetme.
  // Eski kurallarda ek / eylem yok: tek şart, bugünkü gibi.
  const KURAL_ALAN={unvan:'Ünvan içerir',vkn:'VKN/TCKN eşittir',icerik:'Fatura içeriği içerir'};
  const fkSartlar=k=>[{alan:k.alan,deger:k.deger},...(Array.isArray(k.ek)?k.ek:[])].filter(x=>x&&N(x.deger));
  const fkKuralMetni=k=>fkSartlar(k).map(x=>`${KURAL_ALAN[x.alan]||x.alan} “${String(x.deger).trim()}”`).join(' VE ');
  function sartTutar(x,f){
    if(x.alan==='vkn')return String(x.deger).split('|').some(v=>String(f.karsi_vkn)===v.trim());
    if(x.alan==='unvan')return kuralTutar(x.deger,N(f.karsi_unvan));
    if(x.alan==='icerik')return kuralTutar(x.deger,N((f.kalemler||[]).join(' | ')));
    return false;
  }
  function kuralBul(f){
    const ks=Object.values(st.kural).filter(k=>(!k.yon||k.yon==='*'||k.yon===f.yon)&&fkSartlar(k).length);
    const sira={vkn:0,unvan:1,icerik:2};
    // çok şartlı kural daha özeldir, önce denenir; sonra eski sıra (VKN, ünvan, içerik; uzun değer önce)
    ks.sort((a,b)=>(fkSartlar(b).length-fkSartlar(a).length)||(sira[a.alan]-sira[b.alan])||(String(b.deger).length-String(a.deger).length));
    for(const k of ks)if(fkSartlar(k).every(x=>sartTutar(x,f)))return k;
    return null;
  }
  function kdvHesap(f,oran,r){
    const grp=etkin(f)==='ALIS'?'191':'391';const y=grp==='191'?'ALIS':'SATIS';   // satış yönlü iade (alış iadesi) → 191
    const kt=komMu(f)?'':kodBul(f,'k',oran);if(kt&&r&&r.kaynak==='kod tablosu')return kt;   // kod tablosuna göre doldurulan satır
    const gk=((f.gecmis||{}).kdv||{})[oran];if(gk&&gk.startsWith(grp)&&!/TEVK/.test(N(st.acc.get(gk))))return gk;     // bu karşı tarafla geçmişte kullanılan
    if(kt)return kt;                                                                                                   // firmanın kod tanımları
    const k=((st.data.kdv_hesaplari||{})[y]||{})[oran];if(k)return k;
    const leaf=[...st.leaf].filter(c=>c.startsWith(grp)&&!/TEVK/.test(N(st.acc.get(c))));
    const m=leaf.find(c=>new RegExp('%\\s*'+String(oran).replace('.','[.,]')+'(?!\\d)').test(st.acc.get(c)||''));
    return m||(leaf.length===1?leaf[0]:'');
  }
  // tevkifatlı alışta tevkif edilen KDV: 191 altında adında TEVKİFAT geçen hesap (oranlısı önce)
  function kdvTevkHesap(f,oran){
    const leaf=[...st.leaf].filter(c=>c.startsWith('191')&&/TEVK/.test(N(st.acc.get(c))));
    const re=new RegExp('%\\s*'+String(oran).replace('.','[.,]')+'(?!\\d)');
    return ((st.firm||{}).fkTevkKdv)||leaf.find(c=>re.test(st.acc.get(c)||''))||leaf[0]||'';
  }
  // binek araç kısıtlaması hesapları: 770 altında adında BİNEK + KDV (ya da İNDİRİLEMEYEN KDV) ve KKEG geçen hesaplar
  function binekKdvHesap(){if((st.firm||{}).fkBinekKdv)return st.firm.fkBinekKdv;const l=[...st.leaf].filter(c=>c.startsWith('770'));
    return l.find(c=>/BINEK/.test(N(st.acc.get(c)))&&/KDV/.test(N(st.acc.get(c))))||l.find(c=>/INDIRILEMEYEN/.test(N(st.acc.get(c)))&&/KDV/.test(N(st.acc.get(c))))||'';}
  function kkegHesap(){if((st.firm||{}).fkKkeg)return st.firm.fkKkeg;const l=[...st.leaf].filter(c=>c.startsWith('770'));
    return l.find(c=>/KKEG|KANUNEN KABUL/.test(N(st.acc.get(c)))&&/BINEK|ARAC/.test(N(st.acc.get(c))))||l.find(c=>/KKEG|KANUNEN KABUL/.test(N(st.acc.get(c))))||'';}
  /* ÖİV (Görev 38): 689 gider, 950 borç / 951 alacak nazım; her biri adında "ÖİV" ya da "Özel İletişim" geçen hesap
     (harf / Türkçe karakter duyarsız). Tek aday varsa o; yoksa ya da birden fazlaysa hesap uydurulmaz, açık uyarı ve seçim.
     Fiş'te seçilen / yazılan hesap firmada hatırlanır (fkOivHesap, fkOiv950, fkOiv951). */
  const OIV_RE=/(^| )OIV( |$)|OZEL ILETISIM/;
  const OIV_ANAHTAR={'689':'fkOivHesap','950':'fkOiv950','951':'fkOiv951'};
  const OIV_DESC={'689':'ÖİV','950':'ÖİV (950)','951':'ÖİV (951)'};
  function oivSec(grp){const fh=(st.firm||{})[OIV_ANAHTAR[grp]];if(fh)return {hesap:fh,adaylar:[]};
    const L=grupL(grp).filter(c=>OIV_RE.test(N(hAd(c))));return L.length===1?{hesap:L[0],adaylar:L}:{hesap:'',adaylar:L};}
  function oivMesaj(grp,L){const ne={'689':'ÖİV gideri için 689','950':'ÖİV nazım kaydı için 950','951':'ÖİV nazım kaydı için 951'}[grp];
    return L.length?`${ne} altında adında ÖİV / Özel İletişim geçen birden fazla hesap var (${L.join(', ')}): Fiş'te birini seçin`
      :`${ne} altında adında "ÖİV" ya da "Özel İletişim" geçen hesap yok: Fiş'te hesabı yazın ya da Luca'da açın`;}
  function tevkHesap(){
    if(st.data.tevkifat_hesabi)return st.data.tevkifat_hesabi;
    const leaf=[...st.leaf].filter(c=>c.startsWith('360'));
    return leaf.find(c=>/TEVK/.test(N(st.acc.get(c))))||leaf.find(c=>/KDV/.test(N(st.acc.get(c))))||'';
  }
  /* ---- kod tanımları (Görev 36): firma başına KDV oranı × işlem türü → hesap kodu ----
     Alış tablosu gelen faturalar (alış ve müşterinin iade faturası), satış tablosu kesilen faturalar (satış ve satıcıya iade) içindir.
     İşlem kodları Luca'nın kdv_hesap_listesi isteğindekiler. firm.fkKod = {ALIS:{işlem:{oran:{kod,elle}}}, SATIS:{…}} */
  const KOD_ISLEM={ALIS:[['11','Ticari mal alışı (matrah)','m',0],['1','İndirilecek KDV','k',0],['50','Satıştan iadeler (gelen iade faturası, matrah)','m',1],['4','Satıştan iade KDV','k',1]],
    SATIS:[['0','Yurtiçi satışlar (matrah)','m',0],['3','Hesaplanan KDV','k',0],['20','Alıştan iade (kesilen iade faturası, matrah)','m',1],['2','Alış iadesi KDV','k',1]]};
  const KOD_ORAN=['0','1','8','10','18','20'];
  const kodYon=f=>f.yon==='ALIS'?'ALIS':'SATIS';
  const oranK=o=>String(+String(o??'0').replace(',','.')||0);
  function kodIslem(f,tur){const x=KOD_ISLEM[kodYon(f)].find(z=>z[2]===tur&&z[3]===(f.tip==='IADE'?1:0));return x?x[0]:'';}
  function kodBul(f,tur,oran){const c=((((st.firm||{}).fkKod||{})[kodYon(f)]||{})[kodIslem(f,tur)]||{})[oranK(oran)];return (c&&c.kod)||'';}
  // matrah hesabının oranı: en büyük matrahlı KDV oranı (KDV'siz fatura %0)
  const anaOran=f=>{const o=(f.oranlar||[]).slice().sort((a,b)=>(b.matrah||0)-(a.matrah||0))[0];return oranK(o?o.oran:0);};
  // ana hesap: noktasız kod (153, 770) ya da planda alt hesabı olan kod (153.01)
  function anaMi(h){h=String(h||'').trim();return !!h&&(!/[.\- ]/.test(h)||[...planLeaf()].some(c=>c.startsWith(h+'.')));}
  // kuralda ana hesap yazıldıysa detay hesap kod tablosundan, faturanın KDV oranına göre (önce faturanın işlemi, sonra tablodaki öbür işlemler)
  function detayHesap(f,ana){const o=anaOran(f);const tab=(((st.firm||{}).fkKod||{})[kodYon(f)])||{};const is=kodIslem(f,'m');
    const L=[is,...Object.keys(tab).filter(k=>k!==is)].map(k=>((tab[k]||{})[o]||{}).kod).filter(Boolean);
    const h=L.find(k=>k.startsWith(ana+'.'))||'';
    return {hesap:h,uyari:h?'':`Kuralda ana hesap ${ana} yazılı; ${kodYon(f)==='ALIS'?'Alış':'Satış'} kod tanımlarında %${o} KDV oranı için ${ana} altında hesap yok. Kod tanımlarını doldurun ya da kurala detay hesap yazın.`};}
  // fatura için her kaynağın önerdiği matrah hesabı ([Kod] [Geçmiş] [Kural] düğmeleri)
  function kaynaklar(f){const k=kuralBul(f),g=f.gecmis||{};
    let kural=null;if(k&&k.hesap&&k.eylem!=='atla'){kural=anaMi(k.hesap)?{...detayHesap(f,k.hesap),ana:k.hesap}:{hesap:k.hesap};}
    const kod=kodBul(f,'m',anaOran(f));
    return {kod:kod?{hesap:kod}:{hesap:'',uyari:`${kodYon(f)==='ALIS'?'Alış':'Satış'} kod tanımlarında %${anaOran(f)} KDV oranı için ${KOD_ISLEM[kodYon(f)].find(z=>z[0]===kodIslem(f,'m'))[1]} hesabı boş.`},
      gecmis:g.hesap?{hesap:g.hesap,kaynak:g.kaynak||'geçmiş'}:null,kural,k};}
  /* ---- cari eşleştirme (Görev 35): VKN / TCKN kesin → ünvan → fatura no ön eki ----
     VKN kaynakları: firmada hatırlanan VKN → cari (Luca'ya kaydedilen / Luca'da VKN ile bulunan / açılan cariler) ve
     muavinden öğrenilen geçmiş (aynı VKN'li faturaların kaydedildiği cari). Sağlaması tutmayan numara kullanılmaz.
     VKN ile ünvan farklı cariyi gösterirse VKN geçerli, uyarı verilir. Ön ek yalnız destekleyici: tek firmanın kullandığı,
     genel olmayan (GIB, EAR, EFT …) ve muavinde tek cariye kaydedilmiş ön ek. */
  const vknN=x=>{const v=String(x??'').replace(/\D/g,'');return v.length===9?'0'+v:v;};
  function vknOk(x){const v=vknN(x);const d=[...v].map(Number);
    if(v.length===10){let t=0;for(let i=0;i<9;i++){const k=(d[i]+9-i)%10;t+=k===9?9:(k*2**(9-i))%9;}return (10-t%10)%10===d[9];}
    if(v.length===11&&d[0]){return (((d[0]+d[2]+d[4]+d[6]+d[8])*7-(d[1]+d[3]+d[5]+d[7]))%10+10)%10===d[9]&&d.slice(0,10).reduce((a,b)=>a+b,0)%10===d[10];}
    return false;}
  const cariUygun=c=>!!c&&/^(1[0-9][0-9]|3[0-9][0-9]|4[0-9][0-9])/.test(c)&&(CARI.ALIS.concat(CARI.SATIS,['159','331','336','195','340']).includes(String(c).slice(0,3)));
  function cariSec(f){
    const g=f.gecmis||{};const v=vknN(f.karsi_vkn);const ok=vknOk(v);const notlar=[];
    const yerel=ok?((st.firm||{}).cariVkn||{})[v]:'';
    const vknCari=yerel||(ok&&g.eslesme==='vkn'&&cariUygun(g.cari)?g.cari:'');
    const unvanCari=(g.eslesme!=='vkn'&&g.eslesme!=='kelime'&&cariUygun(g.cari)?g.cari:'')||cariBul(f)||'';
    const o=f.onek||null;const onekCari=o&&o.cari&&!o.genel&&cariUygun(o.cari)?o.cari:'';
    if(v&&!ok)notlar.push(`VKN/TCKN ${v} geçersiz (sağlama tutmuyor): eşleştirmede kullanılmadı`);
    if(vknCari){if(unvanCari&&unvanCari!==vknCari)notlar.push(`VKN ${v} ile ${vknCari} bulundu; ünvan ${unvanCari} carisine benziyor — VKN esas alındı, kontrol edin`);
      return {cari:vknCari,kaynak:'VKN',uyari:notlar.join(' · ')};}
    if(unvanCari){if(onekCari&&onekCari!==unvanCari)notlar.push(`Fatura no ön eki ${o.ek} ${onekCari} carisini gösteriyor; ünvan ${unvanCari} — kontrol edin`);
      return {cari:unvanCari,kaynak:onekCari===unvanCari?'ünvan + ön ek':'ünvan',uyari:notlar.join(' · ')};}
    if(onekCari)return {cari:onekCari,kaynak:'ön ek',uyari:[...notlar,`Yalnız fatura no ön ekiyle (${o.ek}) bulundu: bu ön eki yalnız bu karşı taraf kullanmış; kontrol edin`].join(' · ')};
    return {cari:'',kaynak:'',uyari:notlar.join(' · ')};}
  // Luca'ya kaydedilen / Luca'da VKN ile bulunan ya da açılan cari firmada VKN ile hatırlanır (sonraki eşleştirmede kesin)
  function cariVknHatirla(rows){if(!st.firm)return;const m={...(st.firm.cariVkn||{})};let n=0;
    for(const r of rows){const v=vknN(r.f.karsi_vkn);if(vknOk(v)&&cariUygun(r.cari)&&!(st.firm&&HESAP.taslakMi(st.firm.id,r.cari))&&m[v]!==r.cari){m[v]=r.cari;n++;}}
    if(n){st.firm={...st.firm,cariVkn:m};Store.saveFirm(st.firm);}}
  function oner(f,zorla){
    const k=kuralBul(f),g=f.gecmis||{};const dv=(st.firm&&st.firm.fkVarsayilan)||{};
    let hesap='',cari='',kaynak='—',kodUyari='';
    if(k&&k.eylem==='atla')return {hesap:'',cari:'',kaynak:'kural',kuralAtla:true,kuralMetin:fkKuralMetni(k)};
    const ks=kaynaklar(f);const kodSira=((st.firm||{}).fkKaynak)==='kod';
    const al={kural:()=>{if(!ks.kural)return false;hesap=ks.kural.hesap;kodUyari=ks.kural.uyari||'';kaynak='kural';return true;},
      kod:()=>{hesap=ks.kod.hesap;kodUyari=ks.kod.uyari||'';kaynak='kod tablosu';return !!hesap;},
      gecmis:()=>{if(!ks.gecmis)return false;hesap=ks.gecmis.hesap;kaynak=ks.gecmis.kaynak;kodUyari='';return true;}};
    if(zorla&&al[zorla]){if(!al[zorla]()&&zorla!=='kod'){hesap='';kaynak='—';}}
    // sıra: kural → (doldurma "kod tablosuna göre" ise kod tablosu) → geçmiş → varsayılan → kod tablosu
    else if(!al.kural()&&!(kodSira&&al.kod())&&!al.gecmis()){
      if(dv[f.yon]){hesap=dv[f.yon];kaynak='varsayılan';kodUyari='';}
      else if(!al.kod()&&!kodSira){kaynak='—';kodUyari='';}}
    let cariKaynak='',cariUyari='';
    if(k&&k.cari){cari=k.cari;cariKaynak='kural';}else({cari,kaynak:cariKaynak,uyari:cariUyari}=cariSec(f));
    if(komMu(f)){
      if(!(k&&k.hesap)&&!/^60/.test(hesap)){const o=((f.oranlar||[]).find(x=>x.kdv)||{}).oran;const l=[...st.leaf].filter(c=>/^60[0-2]/.test(c)).sort((a,b)=>a.localeCompare(b,'tr',{numeric:true}));
        const re=o?new RegExp('(%\\s*'+o+'(?!\\d))|((^|\\D)'+o+'\\s*%)','i'):null;
        hesap=(dv.KOMISYONCU)||(re&&l.find(c=>re.test(st.acc.get(c)||'')))||l[0]||'';kaynak=hesap?'komisyoncu':'—';}
      if(cari&&!/^(12|13|34)/.test(cari)){cari=(k&&k.cari&&/^(12|13|34)/.test(k.cari))?k.cari:(cariBul(f)||'');cariKaynak=cari?'ünvan':'';cariUyari='';}}
    return {hesap,cari,cariKaynak,cariUyari,kaynak,kural:k,kuralMetin:k&&kaynak==='kural'?fkKuralMetni(k):'',kuralAtla:false,kodUyari:hesap?'':kodUyari,kuralAna:kaynak==='kural'&&ks.kural&&ks.kural.ana||''};
  }

  /* ---- fiş satırları ---- */
  function satirlar(r){
    const f=r.f,err=[],warn=[];const L=[],cikan=[],bosEk=[];
    const kom=komMu(f);                 // komisyoncu faturası: mal bedeli ve KDV satış (alacak), masraflar gider (borç), cari 120 net
    const mb=f.yon==='ALIS'&&!kom;      // matrah ve KDV borçta mı (alış ve satış iadesi) yoksa alacakta mı
    // fiş satırında elle yazılan hesap (r.satirElle[açıklama#sıra]) önceliklidir; hesap yoksa bekleyen hata o zaman yazılır
    const pend={},say={};const eh=(d,m)=>{pend[d]=m;};const el=r.satirElle||{};
    const te=r.tutarElle||{};
    const add=(acc,amt,borcta,desc)=>{amt=r2(amt);if(!amt)return;if(amt<0){borcta=!borcta;amt=-amt;}const key=desc+'#'+(say[desc]=(say[desc]||0)+1);
      if(el[key])acc=el[key];if(!acc&&pend[desc])err.push(pend[desc]);
      const t=te[key];if(t){if(t.cikar||(!t.b&&!t.c)){cikan.push({acc:acc||'',desc,key,oto:{b:borcta?amt:0,c:borcta?0:amt}});return;}L.push({acc:acc||'',b:r2(t.b||0),c:r2(t.c||0),desc,key,elleT:true,oto:{b:borcta?amt:0,c:borcta?0:amt}});return;}   // tutar elle; cikar (eski kayıtlarda 0/0): − ile çıkarıldı
      L.push({acc:acc||'',b:borcta?amt:0,c:borcta?0:amt,desc,key});};
    if(f.tl_yok)err.push('Dövizli fatura: TL tutar ya da kur yok');
    if(!r.hesap&&r.kodUyari&&!r.elle)err.push(r.kodUyari);
    if(!r.hesap)err.push(kom?'Satış (600) hesabı seçin':f.yon==='ALIS'?'Gider/stok hesabı seçin':'Gelir hesabı seçin');
    if(!r.cari)err.push('Cari hesabı seçin');
    const oivMi=a=>/ILETISIM|OIV|4080/.test(N(a));
    const oiv=f.yon==='ALIS'&&!kom?Object.entries(f.diger_vergiler||{}).filter(([a])=>oivMi(a)).reduce((s,[,x])=>s+x,0):0;
    const diger=Object.values(f.diger_vergiler||{}).reduce((s,x)=>s+x,0)-oiv;
    // matrah (diğer vergiler alışta maliyete eklenir; ÖİV 689'a; satışta ayrı hesaba)
    const binek=!!r.binek&&f.yon==='ALIS'&&f.tip!=='IADE'&&!kom;const BO=0.30;
    let binekKk=0;
    if(binek){const m=r2(f.matrah+diger);const kk=r2(m*BO);binekKk+=kk;const kh=kkegHesap();eh('KKEG – binek araç gider kısıtlaması %30','Binek araç: 770 altında KKEG hesabı bulunamadı (Fiş\'te yazın ya da Luca\'da açın)');
      add(r.hesap,m-kk,mb,'matrah (binek araç %70)');add(kh,kk,mb,'KKEG – binek araç gider kısıtlaması %30');}
    else add(r.hesap,f.matrah+(f.yon==='ALIS'&&!kom?diger:0),mb,'matrah');
    // ÖİV: 689 (borç) ve aynı tutar 950 (borç) / 951 (alacak) nazım
    const secim=[];
    if(oiv)for(const [grp,borcta] of [['689',mb],['950',mb],['951',!mb]]){const o=oivSec(grp);const h=grp==='689'&&r.oiv?r.oiv:o.hesap;const d=OIV_DESC[grp];
      eh(d,oivMesaj(grp,o.adaylar));add(h,oiv,borcta,d);if(!h&&!el[d+'#1']&&o.adaylar.length>1)secim.push({key:d+'#1',adaylar:o.adaylar});}
    if((f.yon!=='ALIS'||kom)&&diger){eh('diğer vergi','Diğer vergiler ('+Object.keys(f.diger_vergiler).join(', ')+') için hesap seçin');add(r.diger,diger,mb,'diğer vergi');}
    // KDV (ihraç kayıtlı faturada KDV tahsil edilmez → kayda alınmaz)
    let tev=f.tevkifat||0;
    if(!f.ihrac_kayitli){
      const kd=(f.oranlar||[]).filter(o=>o.kdv).sort((a,b)=>b.kdv-a.kdv);
      kd.forEach((o,i)=>{let tutar=o.kdv;
        if(f.yon!=='ALIS'&&f.tip!=='IADE'&&tev&&i===0)tutar=o.kdv-tev;      // satışta tevkif edilen KDV tahsil edilmez
        if(f.yon==='ALIS'&&f.tip!=='IADE'&&tev&&i===0){const tv=Math.min(tev,o.kdv);const th=kdvTevkHesap(f,o.oran);
          eh('tevkifatlı KDV %'+o.oran,'Tevkifatlı KDV (191 … TEVKİFAT) hesabı bulunamadı (Fiş\'te yazın)');add(th,tv,mb,'tevkifatlı KDV %'+o.oran);tutar=o.kdv-tv;}
        if(binek&&tutar){const bk=r2(tutar*BO);const bh=binekKdvHesap();eh('İndirilemeyen binek araç KDV %30','Binek araç: 770 altında İndirilemeyen Binek Araç KDV hesabı bulunamadı (Fiş\'te yazın ya da Luca\'da açın)');
          add(bh,bk,mb,'İndirilemeyen binek araç KDV %30');binekKk+=bk;tutar=r2(tutar-bk);}
        const h=kdvHesap(f,o.oran,r)||r.kdvGecici||'';eh('KDV %'+o.oran,`%${o.oran} KDV hesabı bulunamadı (Fiş'te yazın)`);add(h,tutar,mb,'KDV %'+o.oran);});
    }else if(f.kdv)warn.push('İhraç kayıtlı: KDV kayda alınmadı');
    // komisyoncunun kestiği masraflar (komisyon, navlun, hamaliye …) gider; KDV'leri 191 indirilecek KDV
    if(kom)for(const m of (f.masraflar||[])){const tur=masrafTuru(m.ad);
      if(m.tutar){const h=masrafHesap(tur);eh('masraf: '+m.ad,`${m.ad}: gider hesabı bulunamadı (Fiş'te yazın; firmada hatırlanır)`);add(h,m.tutar,true,'masraf: '+m.ad);}
      if(m.kdv){const o=m.kdv_oran||'20';const h=kdvGrupHesap('191',o);eh('masraf KDV %'+o,`%${o} indirilecek KDV (191) hesabı bulunamadı (Fiş'te yazın)`);add(h,m.kdv,true,'masraf KDV %'+o);}}
    // tevkifat (alışta sorumlu sıfatıyla 360)
    if(f.yon==='ALIS'&&f.tip!=='IADE'&&tev&&!f.ihrac_kayitli&&!kom){const h=tevkHesap();eh('tevkifat','Tevkifat (360) hesabı bulunamadı (Fiş\'te yazın)');add(h,tev,!mb,'tevkifat');}
    // elle eklenen satırlar (gelir / gider / başka hesap): cari bunlara göre yeniden dengelenir
    // hesabı ve tutarı henüz girilmemiş eklenen satır fişe yazılmaz ama önizlemede görünür (Görev 39)
    for(const x of (r.ekSatir||[])){const b=r2(+x.b||0),c=r2(+x.c||0);if(!b&&!c&&!x.acc){bosEk.push({acc:'',b:0,c:0,desc:x.desc||'eklenen satır',key:'ek:'+x.id,ek:x.id});continue;}if(!x.acc)err.push('Eklenen satırda hesap kodu yok');
      L.push({acc:x.acc||'',b,c,desc:x.desc||'eklenen satır',key:'ek:'+x.id,ek:x.id});}
    // cari: borç = alacak olacak şekilde
    const b=L.reduce((s,x)=>s+x.b,0),c=L.reduce((s,x)=>s+x.c,0);
    const X=r2(b-c);                        // cari doğal tutarı: pozitifse alacağa, negatifse borca
    const oivli=oiv>0;                      // ÖİV'li faturada kuruş farkı da ayrı satıra yazılır
    const farkVar=Math.abs(Math.abs(X)-f.odenecek)>(oivli?0.005:0.05)&&!f.ihrac_kayitli&&!(f.yon!=='ALIS'&&tev)&&f.odenecek>0;
    const hedef=Math.sign(X||1)*f.odenecek,farkT=r2(X-hedef);
    // fark: seçilen / geçmişte kullanılan hesap; yoksa yönüne göre alacak → 679, borç → 689 (KKEG)
    // ÖİV'li faturada fark hesabı program tarafından seçilmez: cari = ödenecek, fark ayrı satırda HESAP KODU BOŞ (siz yazarsınız);
    // boş hesaplı satır varken fiş Luca'ya gönderilmez
    const fh=farkVar&&!oivli?(farkHesabi(r)||(farkT>0?fark679():fark689())):'';
    let fark689T=0;
    if(farkVar&&oivli){add(r.cari,hedef,false,'cari');const n=L.length;add(r.fark||'',farkT,false,'fark (ödenecek ile)');
      const fl=L.length>n?L[L.length-1]:null;
      if(fl&&!fl.acc)err.unshift(`Fiş dengede değil: ödenecek ${fmt(f.odenecek)} ile fark ${fmt(Math.abs(farkT))} ayrı satırda, hesap kodu boş. Fiş'te farkın hesabını yazın; yazılmadan Luca'ya gönderilmez`);}
    else if(farkVar&&fh){eh('fark (ödenecek ile)','');add(fh,farkT,false,'fark (ödenecek ile)');add(r.cari,hedef,false,'cari');
      const fl=L.find(x=>x.desc==='fark (ödenecek ile)');if(fl&&fl.b&&String(fl.acc).startsWith('689'))fark689T=fl.b;}
    else add(r.cari,X,false,'cari');
    // nazım hesaplar (kanunen kabul edilmeyen giderin izlenmesi): 950 … borç / 951 … alacak, aynı adlı hesaplar
    if(binekKk>0){const n=nazimCift(/BINEK/,'BİNEK ARAÇ GİDER KISITLAMASI');
      if(n){add(n[0],binekKk,true,'binek araç gider kısıtlaması %30 (950)');add(n[1],binekKk,false,'binek araç gider kısıtlaması %30 (951)');}
      else warn.push('Binek araç: 950 / 951\'de "binek araç" adlı nazım hesap çifti bulunamadı; nazım kayıt eklenmedi');}
    if(fark689T>0){const fl=L.find(x=>x.desc==='fark (ödenecek ile)');const n=nazimCift(/KKEG|KANUNEN|KVK|GVK|KABUL EDILMEYEN/,hAd(fl&&fl.acc));
      if(n){add(n[0],fark689T,true,'KKEG – ödenecek farkı (950)');add(n[1],fark689T,false,'KKEG – ödenecek farkı (951)');}
      else warn.push('689 farkı: 950 / 951\'de aynı adlı nazım hesap çifti bulunamadı; nazım kayıt eklenmedi');}
    const cari=L.find(x=>x.desc==='cari');const ct=cari?(cari.b||cari.c):0;
    if(farkVar&&!fh&&!oivli)warn.push(`Cari ${fmt(ct)} ≠ ödenecek ${fmt(f.odenecek)}: farkı bir hesaba atmak için “Fiş”e girin`);
    for(const x of L)if(x.acc&&st.leaf.size&&!st.acc.has(x.acc)&&!(st.planM&&st.planM.has(x.acc))&&!(st.firm&&HESAP.taslakMi(st.firm.id,x.acc)))warn.push(x.acc+' mizanda/hesap planında yok');
    {const tb=r2(L.reduce((t,x)=>t+x.b,0)),tc=r2(L.reduce((t,x)=>t+x.c,0));if(Math.abs(tb-tc)>0.005)err.push(`Fiş dengesiz: borç ${fmt(tb)} ≠ alacak ${fmt(tc)}`);}
    return {L,err,warn,cikan,bosEk,secim};
  }

  // komisyoncu masrafları: türüne göre (komisyon / navlun / hamaliye / rüsum / diğer) firmada hatırlanan ya da hesap planından bulunan gider hesabı
  function masrafTuru(ad){const a=N(ad);return /NAVL|NAKL|TASIMA|KAMYON/.test(a)?'navlun':/HAMAL|HAMMAL|INDIRME|YUKLEME/.test(a)?'hamaliye':/RUSUM|BELEDIYE|HAL /.test(a+' ')?'rusum':/KOMISYON/.test(a)?'komisyon':'diger';}
  function masrafHesap(tur){const h=((st.firm||{}).fkMasraf||{})[tur];if(h)return h;
    const leaf=[...st.leaf].filter(c=>/^(760|770|653)/.test(c)).sort((a,b)=>a.localeCompare(b,'tr',{numeric:true}));const ad=c=>N(st.acc.get(c)||'');
    const re={komisyon:/KOMISYON|KOM\b|KOM\./,navlun:/NAVL|NAKL|TASIMA/,hamaliye:/HAMAL|HAMMAL/,rusum:/RUSUM|BELEDIYE/}[tur];
    const bul=x=>leaf.find(c=>c.startsWith('760')&&x.test(ad(c)))||leaf.find(c=>x.test(ad(c)));
    return (re&&bul(re))||(tur!=='komisyon'&&masrafHesap('komisyon'))||'';}
  function kdvGrupHesap(grp,oran){const k=((st.data.kdv_hesaplari||{})[grp==='191'?'ALIS':'SATIS']||{})[oran];if(k)return k;
    const leaf=[...st.leaf].filter(c=>c.startsWith(grp)&&!/TEVK/.test(N(st.acc.get(c))));
    const re=new RegExp('(%\\s*'+oran+'(?!\\d))|((^|\\D)'+oran+'\\s*%)|(KDV\\s*'+oran+'(?!\\d))','i');
    return leaf.find(c=>re.test(st.acc.get(c)||''))||leaf.find(c=>new RegExp('[.]0?'+oran+'$').test(c))||'';}
  // fark hesabı: satırda seçilen → bu karşı tarafla geçmişte kullanılan → firmada hatırlanan
  function farkHesabi(r){return r.fark||((r.f.gecmis||{}).fark)||((st.firm||{}).fkFarkHesap)||'';}
  // hesap planındaki (mizanda hareket görmemiş olsa da) alt hesaplar
  const pl={n:-1,leaf:new Set()};
  function planLeaf(){const tum=new Set([...(st.planM?st.planM.keys():[]),...st.acc.keys()]);if(pl.n===tum.size)return pl.leaf;const ust=new Set();
    for(const c of tum){const p=c.split(/[.\- ]/);for(let i=1;i<p.length;i++)ust.add(p.slice(0,i).join('.'));}
    pl.leaf=new Set([...tum].filter(c=>!ust.has(c.split(/[.\- ]/).join('.'))));pl.n=tum.size;return pl.leaf;}
  const hAd=c=>st.acc.get(c)||(st.planM&&st.planM.get(c))||'';
  const grupL=g=>[...planLeaf()].filter(c=>c.startsWith(g)).sort((a,b)=>a.localeCompare(b,'tr',{numeric:true}));
  // ödenecek farkı: alacak → 679 Diğer Olağandışı Gelir ve Kârlar; borç → 689 Diğer Olağandışı Gider (KKEG / KVK 11)
  function fark679(){const l=grupL('679');return ((st.firm||{}).fk679)||l.find(c=>/DIGER/.test(N(hAd(c))))||l[0]||'';}
  function fark689(){const l=grupL('689').filter(c=>!/ILETISIM|OIV/.test(N(hAd(c))));return ((st.firm||{}).fk689)||l.find(c=>/KKEG|KANUNEN|KVK|GVK|KABUL EDILMEYEN/.test(N(hAd(c))))||l.find(c=>/DIGER/.test(N(hAd(c))))||l[0]||'';}
  // nazım hesap çifti: 950'de (borç) ve 951'de (alacak) aynı adlı alt hesaplar
  const nazimCift=(re,refAd)=>nazimCiftBul(planLeaf(),hAd,re,refAd);

  /* ---- ekran ---- */
  const haricMi=r=>!!(r.f.haric||r.haricBekle||r.kuralAtla);
  const KOL={tarih:r=>r.f.tarih,belge:r=>r.f.belge_no,yon:r=>(r.f.yon==='ALIS'?'Alış ':'Satış ')+(TYPE_NAMES[r.f.tip]||r.f.tip||''),
    karsi:r=>r.f.karsi_unvan+' '+r.f.karsi_vkn,matrah:r=>r.f.matrah,kdv:r=>r.f.kdv,toplam:r=>r.f.odenecek};
  const NUM=new Set(['matrah','kdv','toplam']);
  function eslesir(v,q,num){
    q=q.trim();if(!q)return true;
    if(num){const x=+v||0;const p=s=>+String(s).replace(/\./g,'').replace(',','.');let m;
      if((m=q.match(/^(>=|<=|>|<|=)\s*(.+)$/))){const y=p(m[2]);return m[1]==='>'?x>y:m[1]==='<'?x<y:m[1]==='>='?x>=y:m[1]==='<='?x<=y:Math.abs(x-y)<0.005;}
      if((m=q.match(/^(.+)\.\.(.+)$/)))return x>=p(m[1])&&x<=p(m[2]);
      return fmt(x).includes(q)||String(x).includes(q);}
    return N(v).includes(N(q));
  }
  const eksikMi=r=>!r.hesap||!r.cari;   // matrah hesabı ya da cari boş (Luca'ya gidemez)
  function rowsVisible(){
    const q=N(st.q);
    let rows=st.rows.filter(r=>{
      if(st.filter==='kayitsiz'&&(r.f.kayitli||r.logged||r.f.haric))return false;
      if(st.filter==='kaydedilen'&&!r.logged)return false;
      if(st.filter==='haric'&&!haricMi(r))return false;
      if(st.kf==='kurallı'&&r.kaynak!=='kural')return false;
      if(st.kf==='kuralsız'&&r.kaynak==='kural')return false;
      if(st.ef&&!r._efTut&&(st.ef==='eksik')!==eksikMi(r))return false;   // üzerinde çalışılan fiş kapanana kadar yerinde kalır
      if(q&&!N([r.f.belge_no,r.f.karsi_unvan,r.f.karsi_vkn,(r.f.kalemler||[]).join(' '),r.hesap,r.cari].join(' ')).includes(q))return false;
      for(const [k,v] of Object.entries(st.f))if(v&&v.trim()&&!eslesir(k==='tarih'?dmyS(r.f.tarih).replace(/\//g,'.'):KOL[k](r),v,NUM.has(k)))return false;
      return true;});
    if(st.sort){const {k,d}=st.sort;const g=KOL[k];rows=rows.slice().sort((a,b)=>{const x=g(a),y=g(b);return d*(NUM.has(k)?(+x||0)-(+y||0):String(x??'').localeCompare(String(y??''),'tr',{numeric:true}));});}
    return rows;
  }
  // cari kaynağı (VKN / ünvan / ön ek) ve uyarı; elle seçilen caride gösterilmez
  const cariNot=r=>r.cariElle||r.logged?'':`${r.cari&&r.cariKaynak&&r.cariKaynak!=='kural'?`<span class="chip${r.cariKaynak==='VKN'?' cari':''}" title="Cari nasıl bulundu">${esc(r.cariKaynak)}</span>`:''}${r.cariUyari?`<div class="note fkk-cariuyari" style="color:var(--warn);max-width:220px">${esc(r.cariUyari)}</div>`:''}`;
  // satırda hesabın kaynağını seçme: [Kod] [Geçmiş] [Kural]; basılı olan kullanılan kaynak
  const KS_TUR={'kod tablosu':'kod',kural:'kural','geçmiş':'gecmis','benzer kalem':'gecmis'};
  function ksDugme(r,i){if(r.logged||haricMi(r))return '';const ks=kaynaklar(r.f);const tur=r.elle?'':(KS_TUR[r.kaynak]||(r.f.gecmis&&r.kaynak===(r.f.gecmis.kaynak||'geçmiş')?'gecmis':''));
    const b=(v,l,ok,t)=>`<button type="button" class="btn small ghost fkk-ks" data-ks="${i}" data-v="${v}" aria-pressed="${tur===v}"${ok?'':' disabled'} title="${esc(t)}">${l}</button>`;
    return `<div class="fkk-ksl">${b('kod','Kod',!komMu(r.f),ks.kod.hesap?'Kod tanımlarından: '+ks.kod.hesap:ks.kod.uyari)}${b('gecmis','Geçmiş',!!ks.gecmis,ks.gecmis?'Bu karşı tarafla geçmişte: '+ks.gecmis.hesap:'Geçmiş kayıt yok')}${b('kural','Kural',!!ks.kural,ks.kural?(ks.kural.hesap?'Kural: '+ks.kural.hesap:ks.kural.uyari):'Uyan kural yok')}</div>`;}
  function draw(){
    const d=st.data;const vis=rowsVisible();
    const sec=st.rows.filter(r=>r.sec&&!r.logged&&!haricMi(r));const bad=sec.filter(r=>satirlar(r).err.length);
    const bekleyen=st.rows.filter(r=>r.haricBekle&&!r.f.haric);
    const sayi={kayitsiz:st.rows.filter(r=>!r.f.kayitli&&!r.logged&&!r.f.haric).length,tumu:st.rows.length,kaydedilen:st.rows.filter(r=>r.logged).length,haric:st.rows.filter(haricMi).length};
    // başlık tek satır (Görev 34): firma · dönem ve kısa durum çipleri; "hesaplar boş" açıklaması ⓘ çipinin ipucunda.
    // "Muavini Luca'dan çek" ve "Daha önce kaydedilenler" fiş seçeneğinin satırında (#fkkCekYer)
    const bosUyari=(()=>{const ac=st.rows.filter(r=>!r.logged&&!haricMi(r));const bh=ac.filter(r=>!r.hesap).length,bc=ac.filter(r=>!r.cari).length;
      if(!st.leaf.size||(!bh&&!bc)||(bh+bc)<Math.max(2,ac.length*0.25))return '';
      const ne=[bh?bh+' faturada hesap':'',bc?bc+' faturada cari':''].filter(Boolean).join(', ');
      return ` <span class="chip aski fkk-ipucu" style="cursor:help" title="Hesaplar / cariler boş geliyor: ${esc(ne)} bulunamadı. Mizan eski olabilir ya da bu firmanın muavini (geçmiş kayıtları) eksik olabilir. “Muavini Luca'dan çek” ile mizan, hesap planı ve muavini birlikte çekin; öneriler yeniden kurulur.">ⓘ ${esc(ne)} boş</span>`;})();
    $('#fkkHead').innerHTML=`<b>${esc(st.firm?st.firm.name:d.firma)}</b> · ${esc(dmyS(d.donem[0]||''))} – ${esc(dmyS(d.donem[1]||''))}${d.luca_id?'':' <span class="chip aski">Luca firma no yok</span>'}${st.leaf.size?'':' <span class="chip aski" title="Mizan yok: “Muavini Luca\'dan çek” mizanı da çeker">Mizan yok</span>'}${bosUyari}`;
    {const y=$('#fkkCekYer');if(y)y.innerHTML=`${d.luca_id?`<button class="btn small" id="fkkCek" title="Mizan, hesap planı ve muavin (tüm yıl) Luca'dan sırayla çekilir; öneriler ve kayıt durumları yenilenir">Muavini Luca'dan çek</button>`:''}<button class="btn small ghost" id="fkkGecmis" title="Bu firmada programdan Luca'ya kaydedilen faturalar">Daha önce kaydedilenler</button>`;}
    $('#fkkBar').innerHTML=`<div class="mmtabs">${[['kayitsiz','Kayıtsız'],['tumu','Tümü'],['kaydedilen','MuhaWin ile kaydedilen'],['haric','Kaydedilmeyecek']].map(([k,l])=>`<button class="btn small" data-fkf="${k}" aria-pressed="${st.filter===k}">${l} <span class="mono">${sayi[k]}</span></button>`).join('')}</div>
      <input type="search" id="fkkQ" placeholder="Belge, ünvan, VKN, içerik ara" value="${esc(st.q)}" style="width:auto;min-width:220px">
      <div class="mmtabs" title="Kurala göre süz">${[['','Tümü'],['kurallı','Kurallı'],['kuralsız','Kuralsız']].map(([k,l])=>`<button class="btn small" data-fkkf="${k}" aria-pressed="${(st.kf||'')===k}">${l} <span class="mono">${k===''?st.rows.length:st.rows.filter(r=>(r.kaynak==='kural')===(k==='kurallı')).length}</span></button>`).join('')}</div>
      <button class="btn small primary" id="fkkKuralUygula" title="Kayıtlı kuralları şimdi tüm kayıtsız faturalara yeniden uygular">⟳ Kuralları Uygula</button>
      ${(()=>{const L=st.rows.filter(r=>!r.logged&&!haricMi(r)&&!r.f.kayitli);const e=L.filter(eksikMi).length;return `<div class="mmtabs" title="Matrah hesabı ya da carisi boş faturalar — doldurdukça liste azalır">${[['','Hepsi',L.length],['eksik','Eksik',e],['dolu','Dolu',L.length-e]].map(([k,l,n])=>`<button class="btn small${k==='eksik'&&e?' uyar':''}" data-fkef="${k}" aria-pressed="${(st.ef||'')===k}">${l} <span class="mono">${n}</span></button>`).join('')}</div>`;})()}
      <button class="btn small" id="fkkBosDoldur" title="Boş kalan gider / gelir / cari / KDV hesaplarını tek seferde seçtiğiniz hesaplarla doldurup kayda geçin">Boşları Doldur</button>
      <button class="btn small" id="fkkSecHepsi">Tümünü Seç</button><button class="btn small" id="fkkSecYok">Seçimi Kaldır</button>
      ${(()=>{const n=st.rows.filter(r=>!r.cari&&!r.logged&&!haricMi(r)&&(r.sec||st.filter!=='kayitsiz')).length;return n&&st.firm&&st.firm.lucaId?`<button class="btn small primary" id="fkkCariAc" title="Carisi bulunamayan seçili faturaların karşı tarafları için Luca'da cari hesap aç">＋ Eksik Carileri Aç (${n})</button>`:'';})()}
      <span class="note">Seçili: <b>${sec.length}</b>${bad.length?` · <span style="color:var(--out)">${bad.length} eksik</span>`:''}</span>
      ${sec.length?`<button class="btn small" id="fkkSecHaric" title="Seçili faturaların hepsini tek açıklamayla bu firmada kaydedilmeyecek yap (muavin kontrolünde eksik çıkmaz)">Seçilenleri kaydetme (${sec.length})</button>`:''}
      ${bekleyen.length?`<button class="btn small primary" id="fkkHaricOnay" title="İşaretlenen faturalar kaydedilmeyecek; muavin kontrolünde eksik çıkmaz">Kaydedilmeyecekleri onayla (${bekleyen.length})</button>`:''}
      <span style="flex:1"></span>
      <label class="note">Toplu hesap <input id="fkkTopluH" list="fkkAccList" class="mono" style="width:130px" placeholder="seçililere"></label>
      <label class="note">Belge türü <input id="fkkBT" class="mono" style="width:60px" value="${esc(st.belgeTuru)}" placeholder="boş"></label>
      <button class="btn small" id="fkkKurallar">Kurallar (${Object.keys(st.kural).length})</button>
      <button class="btn small" id="fkkKodA" title="Alış faturaları için KDV oranı × işlem türü → hesap kodu (bu firma)">Alış kod tanımları</button><button class="btn small" id="fkkKodS" title="Satış faturaları için KDV oranı × işlem türü → hesap kodu (bu firma)">Satış kod tanımları</button>
      <label class="note" title="Kural tutmayan faturalarda hesap nereden önerilsin? Her satırda [Kod] [Geçmiş] [Kural] düğmeleriyle tek tek de seçebilirsiniz.">Doldurma <select id="fkkKaynak" style="width:auto"><option value="">Kural → geçmiş → varsayılan</option><option value="kod"${((st.firm||{}).fkKaynak)==='kod'?' selected':''}>Kural → kod tablosuna göre</option></select></label>`;
    const SM=silinmisler();const silOf=r=>r.silindi||SM.get(r.f.anahtar)||SM.get('b:'+r.f.belge_no);
    const silChip=v=>v.neden==='muavin'?`<span class="chip aski" title="Programın kaydettiği Luca fişi${v.n?' '+esc(v.n):''} son çekilen muavinde yok; fiş Luca'dan silinmiş sayıldı. Fatura yeniden kaydedilebilir.">Luca'da bulunamadı (silinmiş)${v.n?' · fiş '+esc(v.n):''}</span>`
      :`<span class="chip aski" title="Luca'dan sildiğiniz işaretlendi; fatura yeniden kaydedilebilir">Luca'dan silindi${v.n?' · fiş '+esc(v.n):''}</span>`;
    const chip=r=>r.kuralAtla&&!r.f.haric&&!r.logged?`<span class="chip" title="Kural: ${esc(r.kuralMetin||'')} → hiç kaydetme">kaydedilmeyecek (kural)</span>`:r.f.haric?(r.f.haric.kural?`<span class="chip" title="${esc(r.f.haric.aciklama||'')} — kuralı Fatura Kontrol raporundaki “Kullanıcı kararı” penceresinden silebilirsiniz">kaydedilmeyecek (kural)</span>`:'<span class="chip">kaydedilmeyecek</span>'):r.haricBekle?'<span class="chip aski">kaydedilmeyecek (onay bekliyor)</span>':r.logged?`<button type="button" class="chip kural" data-lucafis="${st.rows.indexOf(r)}" style="cursor:pointer;border:0" title="MuhaWin ile Luca'ya kaydedildi · fişi muavinden aç">Luca fiş ${esc(r.logged.n||'')}</button>`:r.f.kayitli?'<span class="chip cari">muavinde var</span>':silOf(r)?silChip(silOf(r)):'<span class="chip aski">kayıtsız</span>';
    const src=(k,r)=>k==='kural'&&r&&r.kuralMetin?`<span class="chip kural" title="Kural: ${esc(r.kuralMetin)}">kural</span><div class="note" style="max-width:160px">${esc(r.kuralMetin)}</div>`:({kural:'<span class="chip kural">kural</span>','geçmiş':'<span class="chip cari">geçmiş</span>','benzer kalem':'<span class="chip cari" title="Geçmişte benzer kalemli faturaların kaydedildiği hesap">benzer kalem</span>',varsayılan:'<span class="chip">varsayılan</span>','kod tablosu':'<span class="chip cari" title="Firmanın kod tanımlarından, faturanın KDV oranına göre">kod tablosu</span>'}[k]||'')+(k==='kural'&&r&&r.kuralAna&&r.hesap?`<div class="note">ana ${esc(r.kuralAna)} → kod tablosu</div>`:'');
    const ok_=k=>st.sort&&st.sort.k===k?(st.sort.d>0?' ▲':' ▼'):'';
    const th=(k,l,n)=>`<th class="${n?'n':''}"><button class="srt" data-fksort="${k}" title="Sırala">${l}${ok_(k)}</button></th>`;
    const fl=(k,n)=>`<th><input data-fkfl="${k}" value="${esc(st.f[k]||'')}" placeholder="${n?'>1000':'filtre'}" title="${n?'Sayı: >1000, <500, =200, 100..200':'İçerir'}" aria-label="filtre"></th>`;
    $('#fkkTable').innerHTML=`<thead><tr><th style="width:28px"><input type="checkbox" id="fkkAll" title="Görünenlerin tümünü seç / kaldır" ${(()=>{const ok=vis.filter(r=>!r.logged&&!haricMi(r));return ok.length&&ok.every(r=>r.sec)?'checked':'';})()}></th>${th('tarih','Tarih')}${th('belge','Belge no')}${th('yon','Yön · tip')}${th('karsi','Karşı taraf')}${th('matrah','Matrah',1)}${th('kdv','KDV',1)}${th('toplam','Toplam',1)}<th>PDF</th><th>Hesap (matrah)</th><th>Cari</th><th>Durum</th><th></th></tr>
      <tr class="flt"><th></th>${fl('tarih')}${fl('belge')}${fl('yon')}${fl('karsi')}${fl('matrah',1)}${fl('kdv',1)}${fl('toplam',1)}<th></th><th></th><th></th><th></th><th></th></tr></thead>
      <tbody>${vis.map(r=>{const f=r.f,s=satirlar(r);const i=st.rows.indexOf(r);const hr=haricMi(r);
        return `<tr data-i="${i}" class="${r.acik?'acik':''} ${hr?'haric':''}"><td><input type="checkbox" data-sec="${i}" ${r.sec&&!hr?'checked':''} ${r.logged||hr?'disabled':''}></td>
          <td class="mono">${esc(dmyS(f.tarih).replace(/\//g,'.'))}</td><td class="mono">${esc(f.belge_no)}</td>
          <td>${f.yon==='ALIS'?'Alış':'Satış'}<div class="note">${komMu(f)?`<span class="chip aski" title="Komisyoncu faturası: mal bedeli + KDV sizin satışınız (600 / 391 alacak), komisyon ve masraflar gider (+ 191), komisyoncu 120 cari net tutarla borç">Komisyoncu · satış</span>`:esc(TYPE_NAMES[f.tip]||f.tip||'')}${f.doviz?' · '+esc(f.doviz):''}</div></td>
          <td><b class="hk">${esc(f.karsi_unvan)}</b><div class="note mono">${esc(f.karsi_vkn)}</div>${(f.kalemler||[]).length?`<div class="note" title="${esc(f.kalemler.join('\n'))}">${esc(f.kalemler[0].slice(0,60))}${f.kalemler.length>1?' +'+(f.kalemler.length-1):''}</div>`:''}</td>
          <td class="n">${fmt(f.matrah)}</td><td class="n">${fmt(f.kdv)}${f.tevkifat?`<div class="note">tevk. ${fmt(f.tevkifat)}</div>`:''}</td><td class="n">${fmt(f.odenecek)}</td>
          <td><button class="btn small ghost" data-pdf="${i}" title="Faturayı PDF olarak aç">📄 PDF</button></td>
          <td><input class="mono" list="fkkAccList" data-h="${i}" value="${esc(r.hesap)}" style="width:120px">${src(r.kaynak,r)}<div class="note">${esc(st.acc.get(r.hesap)||'')}</div>${ksDugme(r,i)}
            ${f.yon!=='ALIS'&&Object.keys(f.diger_vergiler||{}).length?`<input class="mono" list="fkkAccList" data-dg="${i}" value="${esc(r.diger||'')}" placeholder="diğer vergi" style="width:120px">`:''}</td>
          <td><input class="mono${cariTaslak(r)?' taslak':''}" list="fkkAccList" data-c="${i}" data-hsad="${esc(f.karsi_unvan||'')}" value="${esc(r.cari)}" style="width:120px"><div class="note">${cariTaslak(r)?`<span class="chip yeni" title="Mizanda / hesap planında bulunamadı; firmanın düzenine göre sıradaki kod önerildi. Luca'ya kaydederken önce hesap planına açılır.">yeni</span> ${esc(HESAP.taslakAd(st.firm.id,r.cari))}`:esc(st.acc.get(r.cari)||'')}</div>${cariNot(r)}${!r.cari&&!r.logged&&st.firm&&st.firm.lucaId?`<button class="btn small" data-cariac="${i}" title="Bu karşı taraf için firmanın cari hesap düzenine göre sıradaki kodla Luca'da cari hesap aç">＋ Cari Aç</button>`:''}</td>
          <td>${chip(r)}${hr?'':s.err.length?`<div class="note" style="color:var(--out)">${esc(s.err[0])}${s.err.length>1?' +'+(s.err.length-1):''}</div>`:s.warn.length?`<div class="note" style="color:var(--warn)">${esc(s.warn[0])}</div>`:''}</td>
          <td style="white-space:nowrap"><button class="btn small ghost" data-fis="${i}" title="Fiş satırlarını göster">Fiş</button><button class="btn small ghost" data-kural="${i}" title="Bu faturadan kural yap">Kural yap</button>${r.logged||(f.haric&&f.haric.kural)?'':f.haric?`<button class="btn small ghost" data-hgeri="${i}" title="Kaydedilmeyecek işaretini kaldır">Geri al</button>`:`<button class="btn small ghost${r.haricBekle?' danger':''}" data-haric="${i}" title="Bu fatura bu firmada kaydedilmeyecek; onaylayınca muavin kontrolünde eksik sayılmaz">${r.haricBekle?'✓ Kaydetme':'Kaydetme'}</button>`}</td></tr>
          ${r.acik?`<tr class="fisdetay"><td></td><td colspan="12">${f.yon==='ALIS'&&f.tip!=='IADE'&&!r.logged?`<div class="binekkutu"><span class="binekres" aria-hidden="true">🚗</span><b>Binek araç gideri mi?</b><span class="note">Evet derseniz KDV'nin %30'u 770 İndirilemeyen Binek Araç KDV'ye, giderin %30'u 770 KKEG'ye; toplam %30 ayrıca 950 (borç) / 951 (alacak) binek araç nazım hesaplarına yazılır; fiş hemen değişir.</span><span class="mmtabs"><button class="btn small" data-binek="${i}" data-v="1" aria-pressed="${!!r.binek}">Evet</button><button class="btn small" data-binek="${i}" data-v="0" aria-pressed="${!r.binek}">Hayır</button></span></div>`:''}<table class="mini"><thead><tr><th>Hesap</th><th>Hesap adı</th><th>Açıklama</th><th class="n">Borç</th><th class="n">Alacak</th></tr></thead><tbody>${[...s.L,...s.bosEk].map(x=>{const ro=r.logged;const tIn=(yon)=>ro?(x[yon]?fmt(x[yon]):''):`<input class="mono fktut" inputmode="decimal" data-ftut="${i}" data-key="${esc(x.key)}" data-yon="${yon}" value="${x[yon]?fmt(x[yon]):''}" style="width:110px;text-align:right${x.elleT?';border-color:var(--accent)':''}">`;
            if(x.ek!=null)return `<tr class="fkek"><td>${ro?esc(x.acc):`<input class="mono" list="fkkAccList" data-fek="${i}" data-id="${esc(x.ek)}" data-alan="acc" value="${esc(x.acc)}" placeholder="hesap kodu" style="width:130px${x.acc?'':';border-color:var(--out)'}">`}</td><td>${esc(hAd(x.acc))}</td><td>${ro?esc(x.desc):`<input data-fek="${i}" data-id="${esc(x.ek)}" data-alan="desc" value="${esc(x.desc)}" style="width:100%;min-width:120px">`}</td><td class="n">${ro?(x.b?fmt(x.b):''):`<input class="mono fktut" inputmode="decimal" data-fek="${i}" data-id="${esc(x.ek)}" data-alan="b" value="${x.b?fmt(x.b):''}" style="width:110px;text-align:right">`}</td><td class="n">${ro?(x.c?fmt(x.c):''):`<input class="mono fktut" inputmode="decimal" data-fek="${i}" data-id="${esc(x.ek)}" data-alan="c" value="${x.c?fmt(x.c):''}" style="width:110px;text-align:right">`}${ro?'':` <button class="btn small ghost danger fiscikar" data-feksil="${i}" data-id="${esc(x.ek)}" title="Satırı fişten çıkar" aria-label="Satırı fişten çıkar">−</button>`}</td></tr>`;
            return `<tr><td>${ro?`<span class="mono">${esc(x.acc||'—')}</span>`:`<input class="mono" list="fkkAccList" data-fel="${i}" data-key="${esc(x.key)}" data-hsad="${esc(x.desc==='cari'?(f.karsi_unvan||''):'')}" value="${esc(x.acc)}" placeholder="hesap kodu" style="width:130px${x.acc?'':';border-color:var(--out)'}">`}</td><td>${esc(hAd(x.acc))}${x.acc&&r.satirElle&&r.satirElle[x.key]?' <span class="chip kural">elle</span>':''}</td><td>${esc(x.desc)}${x.elleT?` <span class="chip kural" title="Önerilen: ${esc(fmt(x.oto.b||x.oto.c))}">tutar elle</span> <button class="btn small ghost" data-ftsif="${i}" data-key="${esc(x.key)}" title="Önerilen tutara dön">↺</button>`:''}</td><td class="n">${tIn('b')}</td><td class="n">${tIn('c')}${ro?'':` <button class="btn small ghost danger fiscikar" data-fcikar="${i}" data-key="${esc(x.key)}" title="Satırı fişten çıkar" aria-label="Satırı fişten çıkar">−</button>`}</td></tr>`;}).join('')}${r.logged?'':s.cikan.map(x=>`<tr class="fiscikan"><td><span class="mono">${esc(x.acc||'—')}</span></td><td>${esc(hAd(x.acc))}</td><td>${esc(x.desc)} <span class="chip">fişten çıkarıldı</span></td><td class="n">${x.oto.b?fmt(x.oto.b):''}</td><td class="n">${x.oto.c?fmt(x.oto.c):''} <button class="btn small ghost" data-fgeri="${i}" data-key="${esc(x.key)}" title="Satırı fişe geri ekle">↺ Geri ekle</button></td></tr>`).join('')}</tbody>
          <tfoot><tr><td colspan="3">${r.logged?'':`<button class="btn small" data-fekle="${i}" title="Fişe gelir / gider ya da başka bir hesap satırı ekleyin; cari kendiliğinden yeniden dengelenir">＋ Satır ekle</button> <span class="note">Tutarı değiştirmek için kutuya yazın; satırı çıkarmak için yanındaki − düğmesine basın.</span>`}</td>
            <td class="n mono"><b>${fmt(r2(s.L.reduce((t,x)=>t+x.b,0)))}</b></td><td class="n mono"><b>${fmt(r2(s.L.reduce((t,x)=>t+x.c,0)))}</b></td></tr></tfoot></table>
            ${farkKutu(r,i)}${(s.secim||[]).map(x=>`<div class="note fkk-oivsec">${esc(x.key.replace(/#\d+$/,''))} için hesap seçin: ${x.adaylar.map(c=>`<button class="btn small" data-oivsec="${i}" data-key="${esc(x.key)}" data-v="${esc(c)}">${esc(c)} ${esc(hAd(c))}</button>`).join(' ')}</div>`).join('')}
            ${[...s.err.map(e=>`<div class="note" style="color:var(--out)">✕ ${esc(e)}</div>`),...s.warn.map(e=>`<div class="note" style="color:var(--warn)">! ${esc(e)}</div>`)].join('')}</td></tr>`:''}`;}).join('')||
        `<tr><td colspan="13" class="bosliste">${st.filter==='kayitsiz'?'Kayıtsız fatura yok. Tüm faturalar muavinde kayıtlı görünüyor.':'Bu filtrede fatura yok. Başka bir süzgeç seçin.'}</td></tr>`}</tbody>`;
    const ok=sec.length&&!bad.length;
    $('#fkkGo').disabled=!ok||st.busy;$('#fkkGo').textContent=`Luca'ya kaydet (${ok?fisSayisi():sec.length} fiş)`;
    $('#fkkGrup').value=st.grup||'ayri';
    $('#fkkXls').disabled=!sec.length||!!bad.length;
  }

  const OIV_KEY={'ÖİV#1':'689','ÖİV (950)#1':'950','ÖİV (951)#1':'951'};
  // ÖİV hesabı seçilince satıra yazılır ve firmada hatırlanır (sonraki ÖİV'li faturalarda sorulmaz)
  function oivHatirla(r,key,v){r.satirElle={...(r.satirElle||{}),[key]:v};const g=OIV_KEY[key];
    if(g&&st.firm){st.firm={...st.firm,[OIV_ANAHTAR[g]]:v};Store.saveFirm(st.firm);toast(`${OIV_DESC[g]} için ${v} bu firmada hatırlanacak.`);}}
  function farkKutu(r,i){
    const f=r.f;const ham=satirlar({...r,fark:'__yok__'});const c=ham.L.find(x=>x.desc==='cari');const ct=c?(c.b||c.c):0;
    if(!(Math.abs(ct-f.odenecek)>0.05&&f.odenecek>0)&&!r.fark)return '';
    const d=r2(ct-f.odenecek);const v=farkHesabi(r);
    return `<div class="farkkutu"><span>Fatura ödenecek tutarı <b>${fmt(f.odenecek)}</b>, hesaplanan cari <b>${fmt(ct)}</b> · fark <b>${fmt(Math.abs(d))}</b>. Fark hangi hesaba atılsın?</span>
      <input class="mono" list="fkkAccList" data-fark="${i}" value="${esc(r.fark||'')}" placeholder="${esc(v||'hesap kodu')}" style="width:140px"><span class="note">${esc(st.acc.get(v)||'')}${!r.fark&&v?' (öneri: '+(((f.gecmis||{}).fark)===v?'geçmiş kayıt':'firma varsayılanı')+')':''}</span>
      <label class="note"><input type="checkbox" data-farkhep="${i}"> Bu firmada farklar için hep bu hesabı öner</label></div>`;
  }
  async function haricOnay(){
    const bek=st.rows.filter(r=>r.haricBekle&&!r.f.haric);if(!bek.length)return;
    if(!(await askConfirm('Bu faturalar kaydedilmeyecek mi?',`${bek.length} fatura bu firmada kaydedilmeyecek olarak işaretlenecek:\n\n${bek.slice(0,12).map(r=>`• ${dmyS(r.f.tarih).replace(/\//g,'.')}  ${r.f.belge_no}  ${r.f.karsi_unvan}  ${fmt(r.f.odenecek)}`).join('\n')}${bek.length>12?`\n… ve ${bek.length-12} fatura daha`:''}\n\nMuavin kontrolünde bu faturalar artık “Muavinde yok” (eksik) çıkmaz; “Kaydedilmeyecek” olarak görünür. İşareti sonra “Geri al” ile kaldırabilirsiniz.`,'Evet, kaydedilmeyecek')))return;
    await haricGonder(bek.map(r=>({anahtar:r.f.anahtar,belge_no:r.f.belge_no,tarih:r.f.tarih,karsi_unvan:r.f.karsi_unvan,karsi_vkn:r.f.karsi_vkn,yon:r.f.yon,aciklama:r.haricAcik||''})),[]);
  }
  async function haricGonder(ekle,cikar){
    try{
      const res=await mwBusy.run('Kontrol yenileniyor…','Kaydedilmeyecek faturalar işleniyor',()=>api.fk.kayitHaric({id:st.data.id,ekle,cikar}));
      const zaman=new Date().toISOString();
      for(const r of st.rows){if(ekle.some(x=>x.anahtar===r.f.anahtar)){r.f.haric={zaman};r.haricBekle=false;r.sec=false;}
        if(cikar.includes(r.f.anahtar)){r.f.haric=null;r.haricBekle=false;r.sec=!r.f.kayitli&&!r.logged;}}
      draw();
      const ey=(res.durumlar||[]).find(x=>x.ad==='Muavinde yok');
      toast(ekle.length?`${ekle.length} fatura kaydedilmeyecek olarak işaretlendi. Muavin kontrolü yenilendi${ey?` (muavinde yok: ${ey.adet})`:''}.`:'İşaret kaldırıldı; fatura yeniden eksik sayılır.');
      try{FKUI.sonucYenile(String(st.data.donem[0]||'').slice(0,7));}catch(e){}
    }catch(e){toast(clean(e));}
  }
  async function open(id){
    st.id=id;const p=$('#fkKayit');p.hidden=false;document.documentElement.style.overflow='hidden';LucaBag.yenile();
    $('#fkkTable').innerHTML='<tbody><tr><td class="note" style="padding:28px">Yükleniyor…</td></tr></tbody>';
    try{
      st.data=await mwBusy.run('Faturalar hazırlanıyor…','Kayıt durumları ve geçmiş kayıtlardan hesap önerileri çıkarılıyor',()=>api.fk.kayitAdaylari(id));
      // işletme / serbest meslek defterine fatura aktarımı şimdilik kapalı (kullanıcı kararı 23.10.2026): ekran açılmaz
      if(st.data.isletme){if(!ISLETME_AKTARIM_ACIK){close();toast('Çok yakında: işletme / serbest meslek defterine fatura aktarımı hazırlanıyor. Kontrol ve raporlar kullanılabilir.');return;}isletmeIskelet();return;}
      await resolveFirm();
      if(st.firm&&!st.firm.mizanInfo&&await mizanOtoCek(st.firm,String(st.data.donem[0]||'').slice(0,4),async()=>{if(!$('#fkKayit').hidden){await resolveFirm();reapply();}}))await resolveFirm();
      st.belgeTuru=(st.firm&&st.firm.fkBelgeTuru)||'';
      st.grup=(st.firm&&st.firm.fkFisGrup)||'ayri';$('#fkkGrup').value=st.grup;
      st.rows=st.data.faturalar.map(f=>{const o=oner(f);const logged=st.log.keys[f.anahtar]||null;if(o.kuralAtla)o.sec=false;const binek=f.yon==='ALIS'&&(/BINEK/.test(N(f.durum||''))||/BINEK/.test(N(st.acc.get(o.hesap)||'')));
        return {f,...o,diger:'',fark:'',sec:!f.kayitli&&!logged&&!f.haric&&!o.kuralAtla,logged,acik:false,haricBekle:false,binek};});
      st.sort=null;st.f={};taslakAta();
      await silinenleriIsle();
      st.filter=st.rows.some(r=>!r.f.kayitli&&!r.logged&&!r.f.haric)?'kayitsiz':'tumu';
      draw();
    }catch(e){$('#fkkTable').innerHTML=`<tbody><tr><td class="note" style="padding:28px;color:var(--out)">${esc(clean(e))}</td></tr></tbody>`;}
  }
  // Eksik cariler: önce VKN ile Luca'da arar (açılmışsa onu kullanır), yoksa firmanın 120 / 320 düzenine göre sıradaki kodla açar
  async function cariAc(rows){
    const f=st.firm;if(!f||!f.lucaId){toast('Firmanın Luca karşılığı yok.');return;}
    rows=rows.filter(r=>r&&!r.cari);if(!rows.length)return;
    try{await LucaBag.bekle();}catch(x){toast(clean(x));return;}
    const m=await HESAP.hesaplar(f);for(const [k,v] of st.acc)if(!m.has(k))m.set(k,v);
    const yil=String((st.data.donem[0]||'').slice(0,4)||new Date().getFullYear());
    const gruplar=new Map();          // aynı karşı taraf bir kez
    for(const r of rows){const a=r.f.karsi_vkn||N(r.f.karsi_unvan);if(!gruplar.has(a))gruplar.set(a,[]);gruplar.get(a).push(r);}
    const bulunan=[],acilacak=[],ek=new Map();
    await mwBusy.run('Cariler denetleniyor…','Vergi numaralarıyla Luca hesap planında aranıyor',async()=>{
      for(const [a,rs] of gruplar){const f0=rs[0].f;const grup=etkin(f0)==='ALIS'?'320':'120';
        let var_=null;try{const h=await window.desktop.luca.hesapAraVkn({lucaId:f.lucaId,year:yil,vkn:f0.karsi_vkn});var_=(h||[]).find(x=>x[0].startsWith(grup+'.'))||(h||[])[0];}catch(e){}
        if(var_){bulunan.push({rs,kod:var_[0],ad:var_[1]});continue;}
        const yeni=HESAP.cariKodu(m,grup,f0.karsi_unvan,ek);for(const y of yeni)ek.set(y.kod,y.ad);
        acilacak.push({rs,yeni});}});
    for(const b of bulunan)for(const r of b.rs){r.cari=b.kod;r.cariElle=true;}
    cariVknHatirla(bulunan.flatMap(b=>b.rs));
    if(bulunan.length)toast(`${bulunan.length} karşı tarafın carisi Luca'da vergi numarasıyla bulundu ve seçildi.`);
    if(!acilacak.length){draw();return;}
    const liste=acilacak.flatMap(x=>x.yeni);
    const r=await HESAP.ac(f,liste,{baslik:'Eksik cariler Luca\'da açılsın mı?'});
    if(!r){draw();return;}
    const tamam=new Set(r.filter(x=>x.ok).map(x=>x.kod));
    for(const x of acilacak){const c=x.yeni[x.yeni.length-1];if(tamam.has(c.kod))for(const rr of x.rs){rr.cari=c.kod;rr.cariElle=true;}}
    cariVknHatirla(acilacak.flatMap(x=>x.rs).filter(r=>r.cari));
    draw();
  }
  // İşletme / serbest meslek defteri fişi (gelir-gider fişi): içerik ve kurallar ileride belirlenecek
  // İşletme / serbest meslek defteri: fiş içerikleri (kategori, belge türü, kayıt alt türü, stopaj…) "Luca fiş Excel'i"
  // ekranında gösterilir ve düzenlenir; Luca'nın "Excel'den fiş aktarma"sına hazır dosya oluşur. (Luca'ya doğrudan işletme fişi
  // kesme isteği henüz bilinmiyor: Luca İstek Kaydı ile bir fiş girişi kaydedilince eklenecek.)
  async function isletmeIskelet(){
    const d=st.data;const kayitsiz=d.faturalar.filter(f=>!f.kayitli&&!f.haric);
    let fu='';try{fu=(await window.desktop.fk.start()).url||'';}catch(e){}
    const lid=(st.firm&&st.firm.lucaId)||d.luca_id||'';
    $('#fkkHead').innerHTML=`<div><b>${esc(st.firm?st.firm.name:d.firma)}</b> · ${esc(dmyS(d.donem[0]||''))} – ${esc(dmyS(d.donem[1]||''))} · İşletme / serbest meslek defteri · Luca'da olmayan <b>${kayitsiz.length}</b> fatura (${kayitsiz.filter(f=>f.yon==='SATIS').length} satış, ${kayitsiz.filter(f=>f.yon==='ALIS').length} alış)</div>`;
    $('#fkkBar').innerHTML=`<span class="note">Fiş içeriklerini aşağıda kontrol edip düzenleyin; <b>Excel'i oluştur</b> ile Luca'nın İşletme Defteri → Excel'den fiş aktarma ekranına yüklenecek dosyayı alın.</span>`;
    $('#fkkGo').disabled=true;$('#fkkGo').title='İşletme / serbest meslek defterinde Luca\'ya doğrudan kayıt henüz yok; Excel\'den fiş aktarımını kullanın';$('#fkkXls').disabled=true;
    $('#fkkTable').innerHTML=fu?`<tbody><tr><td style="padding:0"><iframe id="fkkIsletme" title="İşletme fişleri" src="${esc(fu)}/isletme-fis?id=${encodeURIComponent(st.id||d.id||'')}&firma_id=${encodeURIComponent(lid)}&bas=${encodeURIComponent(String(d.donem[0]||''))}&gomulu=1" style="width:100%;height:calc(100vh - 210px);min-height:420px;border:0;display:block"></iframe></td></tr></tbody>`
      :`<tbody><tr><td class="note" style="padding:28px">Fatura Kontrol modülü açılamadı; işletme fişlerini Fatura Kontrol raporundaki "📒 Luca fiş Excel'i (işletme)" düğmesiyle açın.</td></tr></tbody>`;
  }
  function close(){$('#fkKayit').hidden=true;document.documentElement.style.overflow='';}

  /* ---- kurallar ---- */
  // "Kural yap" (Görev 34 · 7): 1. şart, "+ Şart ekle" ile 2., 3. … şart (hepsi VE), en altta sonuç: kaydet ya da hiç kaydetme
  async function kuralYap(r){
    const f=r.f;const ilk=(f.kalemler||[])[0]||'';
    const varsayilan=a=>a==='vkn'?f.karsi_vkn:a==='icerik'?ilk.split(/\s+/).slice(0,2).join(' '):f.karsi_unvan;
    const alanSec=(a,ad)=>`<select data-kalan="${ad}" aria-label="Şart">${Object.entries(KURAL_ALAN).map(([k,l])=>`<option value="${k}"${k===a?' selected':''}>${l}</option>`).join('')}</select>`;
    const sartSatiri=(n,a,v)=>`<div class="ksart" style="display:grid;grid-template-columns:auto minmax(150px,auto) 1fr auto;gap:8px;align-items:center">
        <span class="note" style="min-width:52px">${n===1?'Şart 1':'VE · Şart '+n}</span>${alanSec(a,n)}<input data-kdeger value="${esc(v)}" placeholder="örn. KİRA + OCAK" aria-label="Şart değeri">
        ${n===1?'<span></span>':'<button class="btn small ghost" type="button" data-ksil aria-label="Şartı kaldır" title="Şartı kaldır">×</button>'}</div>`;
    $('#fkkModalT').textContent='Fatura kuralı';
    $('#fkkModalB').innerHTML=`<div id="kForm" style="display:grid;gap:12px"><p class="note" style="margin:0">Bu firmada bütün şartları tutan faturalara uygulanır. Şartın içinde <b>|</b> = ya da, <b>+</b> = hepsi geçmeli.</p>
      <div id="kSartlar" style="display:grid;gap:8px">${sartSatiri(1,'unvan',f.karsi_unvan)}</div>
      <div><button class="btn small" type="button" id="kSartEkle" title="Bir şart daha ekle: kural yalnız bütün şartlar birlikte tutunca uygulanır">+ Şart ekle</button></div>
      <div class="outgrid" style="gap:12px">
        <div><label class="lbl" for="kYon">Yön</label><select id="kYon"><option value="${f.yon}">${f.yon==='ALIS'?'Alış faturaları':'Satış faturaları'}</option><option value="*">Alış ve satış</option></select></div>
        <div><label class="lbl" for="kEylem">Sonuç</label><select id="kEylem"><option value="">Kaydet (bu şartlar varsa şu hesapla)</option><option value="atla">Hiç kaydetme (faturayı fişe alma, bırak)</option></select></div>
      </div>
      <div class="outgrid" id="kHesaplar" style="gap:12px">
        <div><label class="lbl" for="kHesap">${f.yon==='ALIS'?'Gider / stok hesabı':'Gelir hesabı'} (matrah)</label><input id="kHesap" list="fkkAccList" class="mono" value="${esc(r.hesap)}" aria-describedby="kAnaNot"><div class="note" id="kAnaNot">Ana hesap yazarsanız detay hesap kod tablosundan seçilir; detay hesap yazarsanız sizin yazdığınız geçerli olur.</div></div>
        <div><label class="lbl" for="kCari">Cari hesap (boş: ünvandan bulunur)</label><input id="kCari" list="fkkAccList" class="mono" value="${esc(r.cari)}"></div>
      </div>
      <div class="actions" style="justify-content:flex-end"><span class="note" id="kSay" style="margin-right:auto"></span><button class="btn" data-kx="1">Vazgeç</button><button class="btn primary" id="kKaydet">Kuralı kaydet ve uygula</button></div></div>`;
    const B=$('#kForm');   // her açılışta yeniden oluşur: dinleyiciler birikmez
    const oku=()=>[...B.querySelectorAll('.ksart')].map(x=>({alan:x.querySelector('[data-kalan]').value,deger:x.querySelector('[data-kdeger]').value.trim()}));
    const say=()=>{const L=oku().filter(x=>N(x.deger));const yon=$('#kYon').value;
      const n=L.length?st.rows.filter(x=>(yon==='*'||x.f.yon===yon)&&L.every(y=>sartTutar(y,x.f))).length:0;$('#kSay').textContent=`${n} fatura bu şartlara uyuyor`;};
    const sonuc=()=>{const at=$('#kEylem').value==='atla';$('#kHesaplar').style.display=at?'none':'';say();};
    B.addEventListener('change',e=>{const a=e.target.closest('[data-kalan]');if(a){const inp=a.parentElement.querySelector('[data-kdeger]');inp.value=varsayilan(a.value);}if(e.target.id==='kEylem')sonuc();else say();});
    B.addEventListener('input',e=>{if(e.target.matches('[data-kdeger]'))say();});
    B.addEventListener('click',e=>{if(e.target.id==='kSartEkle'){const L=$('#kSartlar');const n=L.querySelectorAll('.ksart').length+1;
        L.insertAdjacentHTML('beforeend',sartSatiri(n,'icerik',varsayilan('icerik')));L.lastElementChild.querySelector('[data-kdeger]').focus();say();return;}
      const x=e.target.closest('[data-ksil]');if(x){x.closest('.ksart').remove();[...B.querySelectorAll('.ksart')].forEach((s0,i)=>{s0.firstElementChild.textContent=i?'VE · Şart '+(i+1):'Şart 1';});say();}});
    $('#fkkModal').hidden=false;sonuc();
    $('#kKaydet').onclick=async()=>{
      const L=oku().filter(x=>N(x.deger));const eylem=$('#kEylem').value==='atla'?'atla':'';
      if(!L.length){toast('Şartın değerini yazın.');return;}
      const k={id:uid(),alan:L[0].alan,deger:L[0].deger,...(L.length>1?{ek:L.slice(1)}:{}),...(eylem?{eylem}:{}),yon:$('#kYon').value,
        hesap:eylem?'':$('#kHesap').value.trim(),cari:eylem?'':$('#kCari').value.trim(),at:new Date().toISOString()};
      if(!eylem&&!k.hesap){toast('Kaydetme hesabını yazın (ya da sonuç olarak "Hiç kaydetme"yi seçin).');return;}
      if(!st.firm){toast('Firma bulunamadı.');return;}
      await dataOp('addFKural',{fid:st.firm.id,kural:k});st.kural[k.id]=k;
      reapply();$('#fkkModal').hidden=true;toast(eylem?'Kural kaydedildi: bu şartları tutan faturalar fişe alınmayacak.':'Kural kaydedildi ve uygulandı.');};
  }
  function kurallar(){
    const ks=Object.values(st.kural);
    $('#fkkModalT').textContent='Fatura kuralları';
    $('#fkkModalB').innerHTML=`${ks.length?`<div class="tablewrap" style="max-height:50vh"><table id="fkkKuralTablo"><thead><tr><th>Şartlar</th><th>Yön</th><th>Sonuç</th><th>Cari</th><th></th></tr></thead><tbody>
      ${ks.map(k=>`<tr><td>${esc(fkKuralMetni(k))}</td><td>${k.yon==='ALIS'?'Alış':k.yon==='SATIS'?'Satış':'Her ikisi'}</td><td class="mono">${k.eylem==='atla'?'<span class="chip">hiç kaydetme</span>':`${esc(k.hesap)}<div class="note">${esc(st.acc.get(k.hesap)||'')}</div>`}</td><td class="mono">${k.eylem==='atla'?'':esc(k.cari||'otomatik')}</td><td><button class="btn small ghost danger" data-kdel="${esc(k.id)}">Sil</button></td></tr>`).join('')}</tbody></table></div>`:'<p class="note">Henüz kural yok. Listeden bir faturada “Kural yap” deyin.</p>'}
      <section style="display:grid;gap:8px;border-top:1px solid var(--line);padding-top:12px"><b>Kural tutmazsa varsayılan hesap</b>
        <div class="actions"><label class="note">Alış <input id="dvA" list="fkkAccList" class="mono" style="width:130px" value="${esc(((st.firm||{}).fkVarsayilan||{}).ALIS||'')}"></label>
        <label class="note">Satış <input id="dvS" list="fkkAccList" class="mono" style="width:130px" value="${esc(((st.firm||{}).fkVarsayilan||{}).SATIS||'')}"></label><button class="btn small" id="dvKaydet">Kaydet</button></div></section>
      <div class="actions" style="justify-content:flex-end"><button class="btn primary" data-kx="1">Kapat</button></div>`;
    $('#fkkModal').hidden=false;
    $('#dvKaydet').onclick=async()=>{if(!st.firm)return;st.firm={...st.firm,fkVarsayilan:{ALIS:$('#dvA').value.trim(),SATIS:$('#dvS').value.trim()}};await Store.saveFirm(st.firm);reapply();toast('Varsayılan hesaplar kaydedildi.');};
  }
  /* Kod tanımları (Görev 36): "Alış kod tanımları" / "Satış kod tanımları". Hücreler elle yazılır (yalnız planda olan hesaplar)
     ya da "Luca'dan çek" ile Luca'nın KDV hesap listesinden gelir. Elle yazılan hücre işaretli kalır, Luca'dan çekmek onu ezmez:
     Luca'daki farklıysa farklar gösterilip sorulur. Kaydedince öneriler yeniden kurulur. */
  const planda=c=>st.acc.has(c)||!!(st.planM&&st.planM.has(c));
  function kodTanim(y){
    if(!st.firm){toast('Firma bulunamadı.');return;}
    const T=JSON.parse(JSON.stringify(((st.firm.fkKod||{})[y])||{}));
    const hucre=(is,o)=>{const c=(T[is]||{})[o]||{};
      return `<td><input class="mono" list="fkkAccList" data-hssorma data-kodh="${is}|${o}" value="${esc(c.kod||'')}" aria-label="%${o} ${is}" style="width:112px${c.elle?';border-color:var(--accent)':''}" title="${esc((c.kod&&hAd(c.kod))||'')}">${c.elle?' <span class="chip kural" title="Elle yazıldı; Luca\'dan çek değiştirmez">elle</span>':c.kod?' <span class="chip cari" title="Luca\'dan çekildi">Luca</span>':''}</td>`;};
    const ciz=()=>{$('#fkkKodTablo tbody').innerHTML=KOD_ISLEM[y].map(([is,ad])=>`<tr><td>${esc(ad)} <span class="note mono">(${is})</span></td>${KOD_ORAN.map(o=>hucre(is,o)).join('')}</tr>`).join('');};
    $('#fkkModalT').textContent=(y==='ALIS'?'Alış':'Satış')+' kod tanımları';
    $('#fkkModalB').innerHTML=`<div id="kodForm" style="display:grid;gap:10px"><p class="note" style="margin:0">${y==='ALIS'?'Alış faturaları (ve müşterinin size kestiği iade faturaları)':'Satış faturaları (ve satıcıya kestiğiniz iade faturaları)'} bu tabloya göre doldurulur: faturanın KDV oranının sütununda, işlemin satırındaki hesap. Yalnız hesap planında olan detay hesaplar yazılabilir. Elle yazdığınız hücreleri “Luca'dan çek” değiştirmez.</p>
      <div class="tablewrap"><table id="fkkKodTablo" class="mini"><thead><tr><th>İşlem</th>${KOD_ORAN.map(o=>`<th>%${o}</th>`).join('')}</tr></thead><tbody></tbody></table></div>
      <div class="note" id="kodDurum" role="status"></div>
      <div class="actions"><button class="btn" id="kodCek"${st.firm.lucaId?'':' disabled title="Firmanın Luca karşılığı yok"'}>Luca'dan çek</button><span style="flex:1"></span><button class="btn" data-kx="1">Vazgeç</button><button class="btn primary" id="kodKaydet">Kaydet ve uygula</button></div></div>`;
    ciz();$('#fkkModal').hidden=false;
    const B=$('#kodForm');
    B.addEventListener('change',e=>{const t=e.target;if(t.dataset.kodh==null)return;const [is,o]=t.dataset.kodh.split('|');const v=t.value.trim();
      T[is]=T[is]||{};if(v)T[is][o]={kod:v,elle:true};else delete T[is][o];t.closest('td').outerHTML=hucre(is,o);});
    $('#kodCek').onclick=async()=>{
      const yil=String((st.data.donem[0]||'').slice(0,4)||new Date().getFullYear());
      try{await LucaBag.bekle();}catch(x){toast(clean(x));return;}
      let res;try{res=await mwBusy.run('Kod tanımları çekiliyor…','Luca\'nın KDV hesap listesi okunuyor',()=>window.desktop.luca.kdvHesaplari({lucaId:st.firm.lucaId,year:yil}));}
      catch(x){$('#kodDurum').textContent='Luca\'dan çekilemedi: '+clean(x);return;}
      const sonuc=kodBirlestir(T,y,(res&&res.tablo)||{});
      if(sonuc.fark.length&&await askConfirm('Elle yazdığınız hücreler Luca\'dakinden farklı',`${sonuc.fark.map(x=>`• ${x.ad} %${x.oran}: sizin ${x.elle} · Luca ${x.luca}`).join('\n')}\n\nElle yazdıklarınız korunuyor. Bu hücrelerde Luca'dakini kullanmak ister misiniz?`,'Luca\'dakini kullan'))
        for(const x of sonuc.fark)T[x.is][x.oran]={kod:x.luca};
      ciz();$('#kodDurum').textContent=`Luca'dan ${sonuc.yeni} hücre geldi${sonuc.fark.length?`, ${sonuc.fark.length} elle hücre farklı`:''}. Kaydetmek için “Kaydet ve uygula”ya basın.`;};
    $('#kodKaydet').onclick=async()=>{
      const kotu=[];for(const [is,r] of Object.entries(T))for(const [o,c] of Object.entries(r||{}))if(c&&c.elle&&(!planda(c.kod)||anaMi(c.kod)))kotu.push(`%${o} · ${c.kod}`);
      if(kotu.length){$('#kodDurum').innerHTML=`<span style="color:var(--out)">Hesap planında detay hesap olarak yok: ${esc(kotu.join(', '))}. Listeden var olan bir detay hesap seçin.</span>`;return;}
      st.firm={...st.firm,fkKod:{...(st.firm.fkKod||{}),[y]:T}};await Store.saveFirm(st.firm);
      $('#fkkModal').hidden=true;reapply();toast((y==='ALIS'?'Alış':'Satış')+' kod tanımları kaydedildi ve uygulandı.');};
  }
  // Luca yanıtını tabloya katar: elle olmayan hücreler güncellenir; elle hücre farklıysa fark listesine girer (ezilmez)
  function kodBirlestir(T,y,tablo){let yeni=0;const fark=[];
    for(const [is,ad] of KOD_ISLEM[y]){const L=tablo[is]||{};
      for(const [o,c] of Object.entries(L)){if(!c||!c.kod)continue;T[is]=T[is]||{};const v=T[is][o];
        if(v&&v.elle){if(v.kod!==c.kod)fark.push({is,ad,oran:o,elle:v.kod,luca:c.kod});continue;}
        T[is][o]={kod:c.kod};yeni++;}}
    return {yeni,fark};}
  // Boş hesapları hızlıca doldurma: gider (alış), gelir (satış), cari (alış 320 / satış 120), KDV geçici hesabı
  function bosDoldur(){
    const ac=st.rows.filter(r=>!r.logged&&!haricMi(r));const f=st.firm||{};const dv=f.fkVarsayilan||{};const bos=f.fkBos||{};
    const say={gA:ac.filter(r=>!r.hesap&&r.f.yon==='ALIS').length,gS:ac.filter(r=>!r.hesap&&r.f.yon!=='ALIS').length,cA:ac.filter(r=>!r.cari&&r.f.yon==='ALIS').length,cS:ac.filter(r=>!r.cari&&r.f.yon!=='ALIS').length,
      kdv:ac.filter(r=>satirlar(r).err.some(e=>/KDV hesabı bulunamadı/.test(e))).length};
    const kutu=(id,lbl,n,v,ph)=>`<label class="note" style="display:grid;gap:4px"><span>${lbl} <b class="mono">${n}</b> boş</span><input id="${id}" list="fkkAccList" class="mono" value="${esc(v||'')}" placeholder="${ph}" style="width:160px"${n?'':' disabled'}></label>`;
    $('#fkkModalT').textContent='Boş hesapları doldur';
    $('#fkkModalB').innerHTML=`<p class="note" style="margin:0">Kayda hemen geçebilmek için boş kalan hesaplar seçtiğiniz hesaplarla doldurulur (yalnız boş olanlar; dolu / elle seçilmişler değişmez). Yazdığınız kod planda yoksa Luca'ya eklemeniz sorulur.</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        ${kutu('bdGA','Alış gider / stok hesabı',say.gA,bos.gA||dv.ALIS,'770.01 / 153.01')}${kutu('bdGS','Satış gelir hesabı',say.gS,bos.gS||dv.SATIS,'600.01')}
        ${kutu('bdCA','Alış carisi (satıcı)',say.cA,bos.cA,'320.99 geçici satıcı')}${kutu('bdCS','Satış carisi (müşteri)',say.cS,bos.cS,'120.99 geçici müşteri')}
        ${kutu('bdKDV','KDV hesabı bulunamayanlar',say.kdv,bos.kdv,'191.99 / 391.99 geçici KDV')}
      </div>
      <label class="note" style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="bdHatirla" style="width:auto;margin:0" checked> Bu seçimleri firmada hatırla (sonraki dönemlerde hazır gelir)</label>
      <div class="actions" style="justify-content:flex-end"><button class="btn" data-kx="1">Vazgeç</button><button class="btn primary" id="bdUygula">Doldur</button></div>`;
    $('#fkkModal').hidden=false;
    $('#bdUygula').onclick=async()=>{const v=id=>{const e=$('#'+id);return e&&!e.disabled?e.value.trim():'';};const g={gA:v('bdGA'),gS:v('bdGS'),cA:v('bdCA'),cS:v('bdCS'),kdv:v('bdKDV')};
      let n=0;for(const r of ac){const alis=r.f.yon==='ALIS';
        if(!r.hesap&&(alis?g.gA:g.gS)){r.hesap=alis?g.gA:g.gS;r.kaynak='boş doldurma';r.elle=true;n++;}
        if(!r.cari&&(alis?g.cA:g.cS)){r.cari=alis?g.cA:g.cS;r.cariElle=true;n++;}
        if(g.kdv&&satirlar(r).err.some(e=>/KDV hesabı bulunamadı/.test(e))){r.kdvGecici=g.kdv;n++;}}
      if($('#bdHatirla').checked&&st.firm){st.firm={...st.firm,fkBos:g};Store.saveFirm(st.firm);}
      $('#fkkModal').hidden=true;draw();toast(n?`${n} boş alan dolduruldu.`:'Doldurulacak boş alan yok.');
      // planda olmayan kodlar: Luca'ya eklensin mi?
      const m=await HESAP.hesaplar(st.firm);for(const [k,kod] of Object.entries(g)){if(kod&&!m.has(kod)&&!st.acc.has(kod)&&st.firm&&st.firm.lucaId){await HESAP.sor(kod,{gA:'Geçici Gider',gS:'Geçici Gelir',cA:'Geçici Satıcı',cS:'Geçici Müşteri',kdv:'Geçici KDV'}[k]);}}};
  }
  // kutudan çıkıp bir düğmeye tıklanırken tablo hemen yeniden çizilirse tıklama boşa gider; çizim kısa gecikmeyle
  let drawT=null;function drawSoon(){clearTimeout(drawT);drawT=setTimeout(()=>{drawT=null;draw();},280);}
  function reapply(){for(const r of st.rows){if(r.elle)continue;const o=oner(r.f,r.kaynakSec);r.hesap=o.hesap;if(!r.cariElle){r.cari=o.cari;r.cariKaynak=o.cariKaynak;r.cariUyari=o.cariUyari;}r.kaynak=o.kaynak;r.kuralMetin=o.kuralMetin;r.kodUyari=o.kodUyari;r.kuralAna=o.kuralAna;
      // "hiç kaydetme" kuralı faturayı seçimden çıkarır; kural kalkınca kullanıcının önceki seçimi geri gelir
      if(o.kuralAtla!==!!r.kuralAtla){r.kuralAtla=o.kuralAtla;if(o.kuralAtla){r.secKural=r.sec;r.sec=false;}else{r.sec=r.secKural!=null?r.secKural:(!r.f.kayitli&&!r.logged&&!r.f.haric);delete r.secKural;}}}taslakAta();draw();}

  /* ---- fişler ---- */
  /* Fiş gruplama: her fatura ayrı fiş (varsayılan) ya da günlük / 10 günlük / 15 günlük / ay sonuna tek fiş.
     Toplu fişte alış ve satış ayrı fiş olur; her faturanın satırları kendi evrak no, evrak tarihi ve ünvanıyla kalır
     (Luca muavininde "evrak tarihi-evrak no-ünvan" görünür, fatura–muavin kontrolü aynı çalışır). */
  const GRUP_AD={ayri:'Her fatura ayrı fiş',gun:'Her gün tek fiş',on:'10 günlük fiş',onbes:'15 günlük fiş',ay:'Ay sonuna tek fiş'};
  const FIS_SATIR_SINIR=400;            // çok satırlı toplu fiş bu sınırda aynı tarihli ikinci fişe bölünür
  const isoY=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  function grupTarihi(iso,grup){
    const d=toDate(iso),y=d.getFullYear(),m=d.getMonth(),g=d.getDate(),son=new Date(y,m+1,0).getDate();
    const gun=grup==='gun'?g:grup==='on'?(g<=10?10:g<=20?20:son):grup==='onbes'?(g<=15?15:son):son;
    let t=isoY(new Date(y,m,gun));
    const db=String((st.data&&st.data.donem&&st.data.donem[1])||'').slice(0,10);   // kontrol dönemi ay ortasında bitiyorsa fiş tarihi dönemi aşmaz
    if(db&&db<t&&db>=String(iso).slice(0,10))t=db;
    return t;
  }
  function fisler(){
    const sec=st.rows.filter(r=>r.sec&&!r.logged&&!haricMi(r)).sort((a,b)=>a.f.tarih.localeCompare(b.f.tarih)||a.f.belge_no.localeCompare(b.f.belge_no));
    const det=(x,f,sa)=>({hesapKodu:x.acc,evrakNo:f.belge_no.slice(0,50),evrakTarihi:dmyS(f.tarih),borc:x.b||null,alacak:x.c||null,miktar:null,
      belgeTuru:st.belgeTuru||null,doviz:'0',kur:null,dovizTutar:null,detayAciklama:sa,tcVergiNo:null});
    // Luca muavinde açıklamayı "evrak tarihi-evrak no-açıklama" olarak gösterir; satır açıklaması yalnız ünvan
    const tek=sec.map(r=>{const f=r.f,s=satirlar(r);const sa=String(f.karsi_unvan||f.belge_no).slice(0,200);
      return {r,f,sa,ac:`${dmyS(f.tarih)}-${f.belge_no}-${f.karsi_unvan}`.slice(0,200),lines:s.L.map(x=>({...x,doc:f.belge_no,docDate:toDate(f.tarih),sa}))};});
    const grup=st.grup||'ayri';
    if(grup==='ayri')return tek.map((x,i)=>{const b=r2(x.lines.reduce((t,l)=>t+l.b,0)),c=r2(x.lines.reduce((t,l)=>t+l.c,0));
      return {r:x.r,rows:[x.r],year:toDate(x.f.tarih).getFullYear(),date:toDate(x.f.tarih),desc:x.ac,no:x.f.belge_no,b,c,lines:x.lines,
        json:{fisNo:String(i+1),fisTarihi:dmyS(x.f.tarih),fisAciklama:x.ac,fisTipi:'3',borc:b,alacak:c,taslakId:'',detaylar:x.lines.map(l=>det(l,x.f,x.sa))},sa:x.sa};});
    const gruplar=new Map();
    for(const x of tek){const t=grupTarihi(x.f.tarih,grup),k=t+'|'+x.f.yon;if(!gruplar.has(k))gruplar.set(k,{t,yon:x.f.yon,L:[]});gruplar.get(k).L.push(x);}
    const out=[];
    for(const g of [...gruplar.values()].sort((a,b)=>a.t.localeCompare(b.t)||a.yon.localeCompare(b.yon))){
      const parcalar=[[]];let n=0;
      for(const x of g.L){if(n&&n+x.lines.length>FIS_SATIR_SINIR){parcalar.push([]);n=0;}parcalar[parcalar.length-1].push(x);n+=x.lines.length;}
      parcalar.forEach((P,pi)=>{const ilk=P[0].f.tarih,son=P[P.length-1].f.tarih;
        const ac=`${dmyS(ilk)}${ilk!==son?' – '+dmyS(son):''} ${g.yon==='ALIS'?'alış':'satış'} faturaları (${P.length} adet)${parcalar.length>1?` ${pi+1}/${parcalar.length}`:''}`.slice(0,200);
        const lines=P.flatMap(x=>x.lines),b=r2(lines.reduce((t,l)=>t+l.b,0)),c=r2(lines.reduce((t,l)=>t+l.c,0));
        out.push({r:P[0].r,rows:P.map(x=>x.r),year:toDate(g.t).getFullYear(),date:toDate(g.t),desc:ac,no:P.length===1?P[0].f.belge_no:`${P.length} fatura`,b,c,lines,
          json:{fisNo:String(out.length+1),fisTarihi:dmyS(g.t),fisAciklama:ac,fisTipi:'3',borc:b,alacak:c,taslakId:'',detaylar:P.flatMap(x=>x.lines.map(l=>det(l,x.f,x.sa)))},sa:ac});});
    }
    return out;
  }
  function fisSayisi(){try{return st.grup&&st.grup!=='ayri'?fisler().length:st.rows.filter(r=>r.sec&&!r.logged&&!haricMi(r)).length;}catch(e){return 0;}}
  async function excel(){
    const fs=fisler();if(!fs.length)return;
    const lines=[];fs.forEach((x,i)=>x.lines.forEach(L=>lines.push({fis:i+1,date:x.date,fdesc:x.desc,acc:L.acc,doc:L.doc||x.r.f.belge_no,docDate:L.docDate||x.date,desc:L.sa||x.sa,b:L.b,c:L.c})));
    const bt=S.belgeTuru;S.belgeTuru=st.belgeTuru;let buf;try{buf=makeWorkbook(lines);}finally{S.belgeTuru=bt;}
    const ad=`${(st.firm?st.firm.name:st.data.firma)}_fatura_fisleri_${String(st.data.donem[0]||'').slice(0,7)}.xlsx`.replace(/[^\wÇĞİÖŞÜçğıöşü.-]+/g,'_');
    {const y=[...new Set(lines.map(l=>l.acc).filter(k=>st.firm&&HESAP.taslakMi(st.firm.id,k)))];if(y.length)setTimeout(()=>toast(`Dosyada ${y.length} yeni cari kodu var; Luca'ya içe aktarmadan önce hesap planına açın ("Luca'ya kaydet" bunu kendisi yapar).`),400);}
    try{const r=await api.saveFile(ad,new Uint8Array(buf));if(r.ok)toast('Luca fiş aktarım dosyası kaydedildi: '+r.path);}catch(e){toast(clean(e));}
  }
  async function kaydet(){
    let fs=fisler();if(!fs.length)return;const f=st.firm;
    if(!f||!f.lucaId){toast('Bu firmanın Luca karşılığı yok. Firmayı Luca\'dan ekleyin.');return;}
    try{await LucaBag.bekle();}catch(x){toast(clean(x));return;}
    {const kodlar=fs.flatMap(x=>x.lines.map(l=>l.acc));
      if(kodlar.some(k=>HESAP.taslakMi(f.id,k))){const onceki=new Map(st.rows.map(r=>[r,r.cari]));let t;
        try{t=await HESAP.taslakHazirla(f,kodlar);}catch(e){toast(clean(e));return;}
        for(const [r,k] of onceki){if(!k)continue;const y=t.degis.get(k);if(y){r.cari=y;r.cariElle=true;}else if(r.cari!==k&&HESAP.taslakMi(f.id,k)){r.cari=k;}}
        if(!t.ok){draw();toast(t.iptal?'Yeni cariler açılmadığı için kayıt yapılmadı.':`Şu cariler Luca'da açılamadı: ${t.hata.join(', ')} — kayıt yapılmadı.`);return;}
        draw();fs=fisler();if(!fs.length)return;}}
    const b=r2(fs.reduce((t,x)=>t+x.b,0));
    const nFat=fs.reduce((t,x)=>t+x.rows.length,0),grp=st.grup||'ayri';
    const grpAcik=grp==='ayri'?'Her fatura ayrı fiş olur.':`${GRUP_AD[grp]}: ${nFat} fatura ${fs.length} fişte toplanır (alış ve satış ayrı; fiş tarihleri ${[...new Set(fs.map(x=>dmyS(isoY(x.date)).replace(/\//g,'.')))].slice(0,6).join(', ')}${fs.length>6?' …':''}). Her faturanın satırları kendi evrak no ve tarihiyle kalır.`;
    if(!(await askConfirm('Faturalar Luca\'ya kaydedilsin mi?',`${f.name} firmasına ${fs.length} mahsup fişi kesilecek (${nFat} fatura, toplam ${fmt(b)} TL). ${grpAcik} Luca fiş numaralarını kendisi verir.`,'Evet, kaydet')))return;
    st.busy=true;st.stop=false;
    const batch={id:uid(),at:new Date().toISOString(),firm:f.name,lucaId:f.lucaId,kind:'Fatura kaydı',period:`${dmyS(st.data.donem[0])} – ${dmyS(st.data.donem[1])}`,rapor:st.data.id,
      grup:grp,fisler:fs.map(x=>({no:x.no,date:isoY(x.date),desc:x.desc,b:x.b,c:x.c,n:x.lines.length,belgeler:x.rows.map(r=>r.f.belge_no),st:'bekliyor'}))};
    const prog=()=>{const ok=batch.fisler.filter(x=>x.st==='ok').length,er=batch.fisler.filter(x=>x.st==='hata').length;
      $('#fkkModalT').textContent='Luca\'ya kaydediliyor';
      $('#fkkModalB').innerHTML=`<div class="stats" style="margin:0">${[['Gönderilen',ok+er+' / '+fs.length],['Kesildi',ok],['Hata',er]].map(([k,v])=>`<div class="stat"><div class="k">${k}</div><div class="v">${v}</div></div>`).join('')}</div>
        <div class="tablewrap" style="max-height:48vh"><table><tbody>${batch.fisler.map(x=>`<tr><td>${x.st==='ok'?'✓':x.st==='hata'?'✕':x.st==='gönderiliyor'?'…':'·'}</td><td class="mono">${esc(x.no)}</td><td>${esc(grp==='ayri'?x.desc.slice(11,80):x.desc.slice(0,80))}</td><td class="n">${fmt(x.b)}</td><td>${x.st==='ok'?'Luca fiş '+esc(x.lucaNo):x.st==='hata'?`<span style="color:var(--out)">${esc(x.msg)}</span>`:esc(x.st)}</td></tr>`).join('')}</tbody></table></div>
        <div class="actions" style="justify-content:flex-end">${st.busy?'<button class="btn" id="fkkStop">Durdur</button>':''}</div>`;
      const sb=$('#fkkStop');if(sb)sb.onclick=()=>{st.stop=true;sb.disabled=true;sb.textContent='Bu fişten sonra duracak…';};};
    $('#fkkModal').hidden=false;prog();
    const prep={};
    try{
      for(let i=0;i<fs.length;i++){
        if(st.stop){for(let j=i;j<fs.length;j++)batch.fisler[j].st='durduruldu';break;}
        const x=fs[i],it=batch.fisler[i];it.st='gönderiliyor';prog();
        try{
          if(!prep[x.year]){prep[x.year]=await api.luca.prepareFis({lucaId:f.lucaId,year:x.year});batch.lucaFirm=prep[x.year].firmLabel;}
          const r=await api.luca.fisKes({donemId:prep[x.year].donemId,fis:x.json});
          if(r.ok){it.st='ok';it.lucaNo=r.fisNo;it.lucaId=r.fisId;const v={n:r.fisNo,id:r.fisId,at:new Date().toISOString(),b:batch.id};const keys={};
            for(const rr of x.rows){rr.logged=v;rr.sec=false;rr._efTut=false;keys[rr.f.anahtar]=v;}
            cariVknHatirla(x.rows);
            await dataOp('logFKayit',{fid:f.id,keys,batch});}
          else{it.st='hata';it.msg=r.error||'Hata';}
        }catch(e){it.st='hata';it.msg=clean(e);
          if(/oturum|NO_SESSION|UYE|dönemi|bulunamadı|karşılığı/i.test(it.msg)){for(let j=i+1;j<fs.length;j++){batch.fisler[j].st='hata';batch.fisler[j].msg='gönderilmedi';}break;}}
        prog();
      }
    }finally{st.busy=false;batch.done=true;try{await dataOp('logFKayit',{fid:f.id,keys:{},batch});}catch(e){}}
    {const okL=batch.fisler.filter(x=>x.st==='ok');if(okL.length)gunlukYaz('fatura',f,{adet:okL.reduce((t,x)=>t+(x.belgeler||[1]).length,0),tutar:okL.reduce((t,x)=>t+(+x.b||+x.toplam||0),0),ad:`Fatura kaydı · ${batch.period}`});}
    prog();draw();
    const ok=batch.fisler.filter(x=>x.st==='ok').length,okF=batch.fisler.filter(x=>x.st==='ok').reduce((t,x)=>t+(x.belgeler||[1]).length,0);
    $('#fkkModalB').insertAdjacentHTML('beforeend',`<div class="banner" style="margin:8px 0 0">${okF} fatura${grp==='ayri'?'':` ${ok} fişle`} Luca'ya kaydedildi.${ok?' Muavin yeniden indirilip kontrol edilecek; sonuç Fatura – Muavin Kontrol ekranında görünür.':''}</div>
      <div class="actions" style="justify-content:flex-end"><button class="btn" data-kx="1">Kapat</button>${ok?'<button class="btn primary" id="fkkYenile">Muavin kontrolünü şimdi yenile</button>':''}</div>`);
    const y=$('#fkkYenile');if(y)y.onclick=()=>{$('#fkkModal').hidden=true;muavinYenile();};
    if(ok)HESAP.kayitSonrasi(f,{muavin:false});           // mizan hemen güncellenir; muavin aşağıdaki yenileme ile iner
    if(ok)setTimeout(()=>{if(!$('#fkkModal').hidden&&$('#fkkYenile')){$('#fkkModal').hidden=true;muavinYenile();}},4000);
  }
  function muavinYenile(){
    const d=st.data;if(!d.luca_id){toast('Luca firma numarası bilinmediği için muavin otomatik yenilenemiyor; Fatura Kontrol\'de “Sadece muavin”e basın.');return;}
    // sayfa değişmez: muavin (tüm yıl) arka planda indirilir, dönem kontrolü yenilenir; bitince bu liste yeniden okunur
    const f=st.firm||{lucaId:d.luca_id,name:d.klasor_ad||d.firma};
    // ekranın ortasında bekleme penceresi: muavin indirilip kontrol yenilenince kendiliğinden kapanır
    let acik=true;const kapat=()=>{if(acik){acik=false;Busy.hide();clearTimeout(zt);}};const zt=setTimeout(kapat,15*60e3);
    Busy.show('Muavin Luca\'dan indiriliyor…',`${f.name||d.firma}: yılın muavini indirilip faturalarla yeniden karşılaştırılıyor. Bu işlem birkaç dakika sürebilir; bitince liste kendiliğinden yenilenir.`,{iptal:kapat,iptalAd:'Arka planda devam etsin'});
    HESAP.kayitSonrasi(f,{mizan:false,plan:false,muavin:true,ay:String(d.donem[0]||'').slice(0,7),sonra:async()=>{try{if(!$('#fkKayit').hidden&&st.id)await open(st.id);}catch(e){}finally{kapat();}}});
  }

  // "Muavini Luca'dan çek" (Görev 34): mizan + hesap planı + muavin (tüm yıl) sırayla, tek ilerleme penceresinde;
  // bir adım hata verirse hangisi olduğu yazılır, diğerleri yine denenir. Bitince liste ve kayıt durumları yenilenir.
  let muavinBekleMs=2500;
  const muavinIs={cek:b=>window.desktop.fk.muavinCek(b),durum:()=>window.desktop.fk.topluDurum()};   // testte taklit edilir
  async function muavinCekBekle(f,ay){
    const fk={muavinCek:muavinIs.cek,topluDurum:muavinIs.durum};let s0={};try{s0=await fk.topluDurum();}catch(e){}
    if(s0.calisiyor)throw new Error('toplu kontrol sürüyor; bitince yeniden deneyin');
    await fk.muavinCek({id:String(f.lucaId),ad:f.name,ay});
    const t0=Date.now();
    for(;;){await new Promise(r=>setTimeout(r,muavinBekleMs));let d={};try{d=await fk.topluDurum();}catch(e){}
      if(d.calisiyor){if(Date.now()-t0>20*60e3)throw new Error('20 dakikada bitmedi');continue;}
      const s=(d.sonuclar||[]).find(x=>String(x.id)===String(f.lucaId));
      if(s&&(s.adimlar||[]).some(a=>a.kod==='muavin'&&a.durum==='tamam')){gunlukYaz('muavin',f,{ad:'Muavin Luca\'dan indirildi'});return;}
      throw new Error(String(((d.gunluk||[]).slice(-1)[0])||'muavin indirilemedi').slice(0,200));}
  }
  async function hepsiniCek(){
    const d=st.data,f=st.firm;if(!f||!f.lucaId){toast('Firmanın Luca karşılığı yok.');return;}
    if(st.busy)return;
    try{await LucaBag.bekle();}catch(x){toast(clean(x));return;}
    const yil=String(d.donem[0]||'').slice(0,4)||String(new Date().getFullYear());
    const ad={mizan:'Mizan',plan:'Hesap planı',muavin:'Muavin (tüm yıl)'},adim={mizan:'bekliyor',plan:'bekliyor',muavin:'bekliyor'},hata={};
    const ciz_=()=>{$('#fkkModalT').textContent='Luca\'dan çekiliyor · '+f.name;
      $('#fkkModalB').innerHTML=`<table id="fkkCekAdim" style="width:100%"><tbody>${Object.keys(ad).map((k,i)=>`<tr data-adim="${k}" data-durum="${adim[k]}"><td style="width:24px">${adim[k]==='tamam'?'✓':adim[k]==='hata'?'✕':adim[k]==='sürüyor'?'…':'·'}</td><td>${i+1}/3 <b>${ad[k]}</b></td><td>${adim[k]==='hata'?`<span style="color:var(--out)">${esc(hata[k])}</span>`:esc(adim[k])}</td></tr>`).join('')}</tbody></table>
        ${st.busy?'<p class="note" style="margin:8px 0 0">Muavin indirmesi birkaç dakika sürebilir.</p>':`<div class="actions" style="justify-content:flex-end"><button class="btn primary" data-kx="1">Kapat</button></div>`}`;};
    const calis=async(k,fn)=>{adim[k]='sürüyor';ciz_();try{await fn();adim[k]='tamam';}catch(e){adim[k]='hata';hata[k]=`${ad[k]} alınamadı: ${clean(e)}`;}ciz_();};
    st.busy=true;$('#fkkModal').hidden=false;ciz_();
    window.__mwArkaPlan=(window.__mwArkaPlan||0)+1;
    try{
      await calis('mizan',()=>Desk.pullMizan(f,yil));
      await calis('plan',()=>HESAP.planYenile(f,yil,{hata:true}));
      await calis('muavin',()=>muavinCekBekle(f,String(d.donem[0]||'').slice(0,7)));
    }finally{window.__mwArkaPlan--;st.busy=false;}
    ciz_();
    if(adim.muavin==='tamam'){try{await open(st.id);}catch(e){}}else{try{await resolveFirm();reapply();}catch(e){}}
    const hatali=Object.keys(ad).filter(k=>adim[k]==='hata');
    $('#fkkModal').hidden=false;
    $('#fkkModalB').insertAdjacentHTML('afterbegin',`<div class="banner" style="margin:0 0 8px">${hatali.length?`${hatali.map(k=>ad[k]).join(', ')} alınamadı; ${hatali.length<3?'diğerleri alındı.':''}`:'Mizan, hesap planı ve muavin alındı; öneriler ve kayıt durumları yenilendi.'}</div>`);
  }
  // "Luca fiş N" çipi: fiş muavinden (Luca'daki hâliyle) açılır — Fatura Kontrol raporundaki fiş penceresiyle aynı görünüm
  async function lucaFisAc(r){
    const v=r&&r.logged;if(!v)return;const {x}=fisKaydi(v);const tarih=String((x&&x.date)||r.f.tarih).slice(0,10);
    const kapat='<div class="actions" style="justify-content:flex-end"><button class="btn" data-kx="1">Kapat</button></div>';
    $('#fkkModalT').textContent=`Luca fiş ${v.n} · ${dmyS(tarih).replace(/\//g,'.')}`;
    $('#fkkModalB').innerHTML='<p class="note" style="padding:16px;text-align:center">Fiş muavinden hazırlanıyor…</p>';$('#fkkModal').hidden=false;
    let m=null;try{m=await window.desktop.fk.muavinGet(st.data.id);}catch(e){}
    const L=((m&&m.satirlar)||[]).filter(s=>fnoN(s.fis_no)===fnoN(v.n)&&String(s.tarih||'').slice(0,10)===tarih);
    const g=L.length?((fisGrupla(L)[0]||{}).satir||L):[];
    if(!g.length){$('#fkkModalB').innerHTML=`<p class="note" style="padding:8px 4px">Bu fiş muavinde bulunamadı${m?'':' (bu dönemin muavini yok)'}. Kayıttan sonra muavin çekilmediyse üstteki <b>Muavini Luca'dan çek</b>'e basın; fiş Luca'dan silindiyse muavin çekilince “Luca'da bulunamadı (silinmiş)” olarak işaretlenir.</p>${kapat}`;return;}
    const tb=g.reduce((t,y)=>t+(+y.borc||0),0),ta=g.reduce((t,y)=>t+(+y.alacak||0),0),tl=y=>y?fmt(y):'';
    $('#fkkModalB').innerHTML=`<div class="tablewrap" style="max-height:60vh"><table id="fkkFisTablo"><thead><tr><th>Tarih</th><th>Hesap</th><th>Hesap adı</th><th>Açıklama</th><th>Belge no</th><th class="n">Borç</th><th class="n">Alacak</th></tr></thead>
      <tbody>${g.map(y=>`<tr><td class="mono">${esc(dmyS(y.tarih||'').replace(/\//g,'.'))}</td><td class="mono">${esc(y.hesap_kodu)}</td><td>${esc(y.hesap_adi)}</td><td>${esc(y.aciklama)}</td><td class="mono">${esc(y.belge_no||'')}</td><td class="n mono">${tl(+y.borc)}</td><td class="n mono">${tl(+y.alacak)}</td></tr>`).join('')}</tbody>
      <tfoot><tr><td colspan="5">Toplam${Math.abs(tb-ta)<0.005?'':' — fiş dengesiz'}</td><td class="n mono">${fmt(tb)}</td><td class="n mono">${fmt(ta)}</td></tr></tfoot></table></div>${kapat}`;
  }
  // "Daha önce kaydedilenler": bu firmada programdan Luca'ya kesilen fişler (fatura kaydı raporlarından) ve Luca'daki durumları.
  // Banka modülündeki gibi: fişi Luca'dan sildiyseniz işaretlersiniz, faturası tekrar kayıtsız sayılır.
  function gecmisSatirlari(){const out=[];
    for(const b of (logGuncel().batches||[]))for(const x of (b.fisler||[])){if(x.st!=='ok')continue;
      out.push({b,x,k:b.id+'|'+x.lucaNo,belgeler:x.belgeler||[],tarih:x.date,tutar:x.b,n:x.lucaNo,at:b.at,sil:x.silindi||null});}
    return out.sort((a,c)=>String(c.at).localeCompare(String(a.at))||String(a.n).localeCompare(String(c.n),'tr',{numeric:true}));}
  function gecmis(){
    const L=gecmisSatirlari();const kapat='<div class="actions" style="justify-content:flex-end"><button class="btn" data-kx="1">Kapat</button></div>';
    $('#fkkModalT').textContent='Daha önce kaydedilenler · '+((st.firm&&st.firm.name)||st.data.firma);
    const dur=y=>y.sil?(y.sil.neden==='muavin'?'<span class="chip aski">Luca\'da bulunamadı (silinmiş)</span>':'<span class="chip aski">Luca\'dan silindi</span>'):'<span class="chip kural">kayıtlı</span>';
    $('#fkkModalB').innerHTML=L.length?`<p class="note" style="margin:0 0 8px">Programdan Luca'ya kesilen fişler. Bir fişi Luca'dan sildiyseniz <b>Luca'dan sildim</b> ile işaretleyin; faturası tekrar kayıtsız sayılır. Muavin çekildiğinde Luca'da bulunamayan fişler kendiliğinden işaretlenir.</p>
      <div class="tablewrap" style="max-height:56vh"><table id="fkkGecmisTablo"><thead><tr><th>Fatura</th><th>Fiş tarihi</th><th class="n">Tutar</th><th>Luca fiş no</th><th>Kayıt tarihi</th><th>Durum</th><th></th></tr></thead><tbody>
      ${L.map(y=>`<tr data-gk="${esc(y.k)}"><td class="mono">${esc(y.belgeler.slice(0,3).join(', '))}${y.belgeler.length>3?' +'+(y.belgeler.length-3):''}</td><td class="mono">${esc(dmyS(y.tarih||'').replace(/\//g,'.'))}</td><td class="n mono">${fmt(+y.tutar||0)}</td><td class="mono"><b>${esc(y.n||'')}</b></td><td class="mono">${esc(new Date(y.at).toLocaleString('tr-TR'))}</td><td>${dur(y)}</td><td>${y.sil?'':`<button class="btn small ghost danger" data-gsil="${esc(y.k)}">Luca'dan sildim</button>`}</td></tr>`).join('')}</tbody></table></div>${kapat}`
      :`<p class="note">Bu firmada programdan Luca'ya kaydedilen fatura yok.</p>${kapat}`;
    $('#fkkModal').hidden=false;}
  async function gecmisSil(k){
    const y=gecmisSatirlari().find(z=>z.k===k);if(!y||y.sil||!st.firm)return;
    if(!(await askConfirm('İşaret kaldırılsın mı?',`Luca fiş ${y.n} (${y.belgeler.join(', ')}) "kaydedildi" işaretinden çıkarılacak ve faturası tekrar kaydedilebilecek. Bunu yalnız bu fişi Luca'dan sildiyseniz yapın.`,'Evet, sildim')))return;
    const at=new Date().toISOString();
    const lk=logGuncel().keys||{};const keys=Object.keys(lk).filter(a=>{const v=lk[a];return v&&v.b===y.b.id&&String(v.n)===String(y.n);});
    y.x.silindi={neden:'elle',at};y.x.anahtarlar=[...new Set([...(y.x.anahtarlar||[]),...keys])];
    try{await dataOp('unlogFKayit',{fid:st.firm.id,keys});await dataOp('logFKayit',{fid:st.firm.id,keys:{},batch:y.b});}catch(e){toast('İşaret kaydedilemedi: '+clean(e));return;}
    st.log=(local().fkayit||{})[st.firm.id]||st.log;
    for(const r of st.rows)if(r.logged&&keys.includes(r.f.anahtar)){r.silindi={neden:'elle',at,n:y.n};r.logged=null;r.sec=!r.f.kayitli&&!r.f.haric;}
    draw();gecmis();toast('İşaret kaldırıldı; fatura tekrar kaydedilebilir.');
  }

  /* ---- olaylar ---- */
  const P=()=>$('#fkKayit');
  document.addEventListener('click',async e=>{
    if(!e.target.closest('#fkKayit'))return;
    if(e.target.closest('[data-kx]')){$('#fkkModal').hidden=true;return;}
    const kd=e.target.closest('[data-kdel]');if(kd){await dataOp('delFKural',{fid:st.firm.id,id:kd.dataset.kdel});delete st.kural[kd.dataset.kdel];kurallar();reapply();return;}
    if(e.target.id==='fkkClose'){if(!st.busy)close();return;}
    const t=e.target.closest('[data-fkf]');if(t){st.filter=t.dataset.fkf;draw();return;}
    const kf=e.target.closest('[data-fkkf]');if(kf){st.kf=kf.dataset.fkkf;draw();return;}
    const ef=e.target.closest('[data-fkef]');if(ef){st.ef=ef.dataset.fkef;for(const r of st.rows)r._efTut=false;draw();return;}
    if(e.target.id==='fkkCek'){hepsiniCek();return;}
    if(e.target.id==='fkkGecmis'){gecmis();return;}
    const lf=e.target.closest('[data-lucafis]');if(lf){lucaFisAc(st.rows[+lf.dataset.lucafis]);return;}
    const gs=e.target.closest('[data-gsil]');if(gs){gecmisSil(gs.dataset.gsil);return;}
    if(e.target.id==='fkkBosDoldur'){bosDoldur();return;}
    if(e.target.id==='fkkKuralUygula'){const ac=st.rows.filter(r=>!r.logged);const elle=ac.filter(r=>r.elle&&kuralBul(r.f));
      let hepsi=false;if(elle.length)hepsi=await askConfirm('Kurallar uygulanacak',`Hesabını elle değiştirdiğiniz ${elle.length} fatura da bir kurala uyuyor. Bunlara da kural uygulansın mı?\n\n“Hayır” derseniz yalnız elle değiştirilmemiş faturalar yenilenir.`,'Evet, hepsine uygula');
      if(hepsi)for(const r of elle){r.elle=false;r.cariElle=false;}
      reapply();toast(`Kurallar uygulandı: ${st.rows.filter(r=>r.kaynak==='kural').length} fatura kurallı.`);return;}
    const fi=e.target.closest('[data-fis]');if(fi){const r=st.rows[+fi.dataset.fis];r.acik=!r.acik;if(!r.acik)r._efTut=false;draw();return;}
    const ku=e.target.closest('[data-kural]');if(ku){kuralYap(st.rows[+ku.dataset.kural]);return;}
    const pd=e.target.closest('[data-pdf]');if(pd){faturaPdf(st.data.id,st.rows[+pd.dataset.pdf].f.belge_no);return;}
    const so=e.target.closest('[data-fksort]');if(so){const k=so.dataset.fksort;st.sort=st.sort&&st.sort.k===k?(st.sort.d>0?{k,d:-1}:null):{k,d:1};draw();return;}
    const fe=e.target.closest('[data-fekle]');if(fe){const r=st.rows[+fe.dataset.fekle];r.ekSatir=[...(r.ekSatir||[]),{id:uid(),acc:'',b:0,c:0,desc:'eklenen satır'}];draw();
      setTimeout(()=>{const l=[...document.querySelectorAll(`[data-fek="${fe.dataset.fekle}"][data-alan="acc"]`)].pop();if(l)l.focus();},40);return;}
    const fx=e.target.closest('[data-feksil]');if(fx){const r=st.rows[+fx.dataset.feksil];r.ekSatir=(r.ekSatir||[]).filter(z=>z.id!==fx.dataset.id);draw();return;}
    const fc=e.target.closest('[data-fcikar]');if(fc){const r=st.rows[+fc.dataset.fcikar];r.tutarElle={...(r.tutarElle||{}),[fc.dataset.key]:{b:0,c:0,cikar:true}};draw();return;}
    const fg=e.target.closest('[data-fgeri]');if(fg){const r=st.rows[+fg.dataset.fgeri];const m={...(r.tutarElle||{})};delete m[fg.dataset.key];r.tutarElle=m;draw();return;}
    const fz=e.target.closest('[data-ftsif]');if(fz){const r=st.rows[+fz.dataset.ftsif];const m={...(r.tutarElle||{})};delete m[fz.dataset.key];r.tutarElle=m;draw();return;}
    const bn=e.target.closest('[data-binek]');if(bn){const r=st.rows[+bn.dataset.binek];r.binek=bn.dataset.v!=null?bn.dataset.v==='1':!r.binek;draw();return;}
    const hx=e.target.closest('[data-haric]');if(hx){const r=st.rows[+hx.dataset.haric];r.haricBekle=!r.haricBekle;if(r.haricBekle)r.sec=false;else r.sec=!r.f.kayitli&&!r.logged;draw();return;}
    const hg=e.target.closest('[data-hgeri]');if(hg){const r=st.rows[+hg.dataset.hgeri];
      if(await askConfirm('İşaret kaldırılsın mı?',`${r.f.belge_no} · ${r.f.karsi_unvan}\nFatura yeniden kaydedilecekler arasına alınır; muavinde yoksa kontrolde eksik çıkar.`,'Evet, geri al'))await haricGonder([],[r.f.anahtar]);return;}
    if(e.target.id==='fkkHaricOnay'){haricOnay();return;}
    if(e.target.id==='fkkSecHaric'){const L=st.rows.filter(r=>r.sec&&!r.logged&&!haricMi(r));if(!L.length)return;
      const ac=await askText(`${L.length} fatura kaydedilmeyecek`,'Ortak açıklama (isteğe bağlı; raporda görünür) — örn. Şube faturası, merkezde kaydedilir','','Devam');if(ac==null)return;
      for(const r of L){r.haricBekle=true;r.haricAcik=ac.trim();r.sec=false;}draw();await haricOnay();return;}
    const os=e.target.closest('[data-oivsec]');if(os){const r=st.rows[+os.dataset.oivsec];oivHatirla(r,os.dataset.key,os.dataset.v);draw();return;}
    if(e.target.id==='fkkKurallar'){kurallar();return;}
    if(e.target.id==='fkkKodA'||e.target.id==='fkkKodS'){kodTanim(e.target.id==='fkkKodA'?'ALIS':'SATIS');return;}
    const ksb=e.target.closest('[data-ks]');if(ksb){const r=st.rows[+ksb.dataset.ks];r.kaynakSec=ksb.dataset.v;r.elle=false;const o=oner(r.f,r.kaynakSec);
      Object.assign(r,{hesap:o.hesap,kaynak:o.kaynak,kuralMetin:o.kuralMetin,kodUyari:o.kodUyari,kuralAna:o.kuralAna});draw();return;}
    const ca=e.target.closest('[data-cariac]');if(ca){cariAc([st.rows[+ca.dataset.cariac]]);return;}
    if(e.target.id==='fkkCariAc'){cariAc(st.rows.filter(r=>!r.cari&&!r.logged&&!haricMi(r)&&(r.sec||st.filter!=='kayitsiz')));return;}
    if(e.target.id==='fkkSecHepsi'){for(const r of rowsVisible())if(!r.logged&&!haricMi(r))r.sec=true;draw();return;}
    if(e.target.id==='fkkSecYok'){for(const r of st.rows)r.sec=false;draw();return;}
    if(e.target.id==='fkkXls'){excel();return;}
    if(e.target.id==='fkkGo'){kaydet();return;}
  });
  // Eksik / Dolu süzgecinde üzerinde çalışılan fiş (açılan ya da düzenlenen) doldu diye hemen listeden düşmez;
  // fiş kapatılınca, Luca'ya kaydedilince ya da süzgeç yeniden seçilince yerine geçer
  const efTut=e=>{if(!st.ef||!e.target.closest||!e.target.closest('#fkkTable'))return;const tr=e.target.closest('tr');if(!tr)return;
    const ana=tr.dataset.i!=null?tr:(tr.closest('tr.fisdetay')||(tr.parentElement&&tr.parentElement.closest('tr.fisdetay'))||{}).previousElementSibling;
    const i=ana&&ana.dataset?ana.dataset.i:null;if(i!=null&&st.rows[+i])st.rows[+i]._efTut=true;};
  for(const ev of ['click','change','input','focusin'])document.addEventListener(ev,efTut,true);
  document.addEventListener('change',e=>{
    if(!e.target.closest('#fkKayit'))return;const t=e.target;
    if(t.id==='fkkAll'){for(const r of rowsVisible())if(!r.logged&&!haricMi(r))r.sec=t.checked;draw();return;}
    if(t.dataset.sec!=null){st.rows[+t.dataset.sec].sec=t.checked;draw();return;}
    if(t.dataset.h!=null){const r=st.rows[+t.dataset.h];r.hesap=t.value.trim();r.kaynak='elle';r.elle=true;drawSoon();return;}
    if(t.dataset.c!=null){const r=st.rows[+t.dataset.c];r.cari=t.value.trim();r.cariElle=true;drawSoon();return;}
    if(t.dataset.fel!=null){const r=st.rows[+t.dataset.fel];const k=t.dataset.key,v=t.value.trim();
      if(/^matrah/.test(k)&&k.endsWith('#1')){r.hesap=v;r.kaynak='elle';r.elle=true;}
      else if(k==='cari#1'){r.cari=v;r.cariElle=true;}
      else if(OIV_KEY[k]&&v)oivHatirla(r,k,v);
      else{r.satirElle={...(r.satirElle||{})};if(v)r.satirElle[k]=v;else delete r.satirElle[k];
        const mm=/^masraf: (.+)#\d+$/.exec(k);if(mm&&v&&st.firm){const tur=masrafTuru(mm[1]);st.firm={...st.firm,fkMasraf:{...(st.firm.fkMasraf||{}),[tur]:v}};Store.saveFirm(st.firm);toast(`Komisyoncu ${tur} masrafı için ${v} bu firmada hatırlanacak.`);}}
      drawSoon();return;}
    if(t.dataset.ftut!=null){const r=st.rows[+t.dataset.ftut];const k=t.dataset.key,y=t.dataset.yon;const sL=satirlar(r).L.find(x=>x.key===k)||{};
      const v=r2(trSayi(t.value));const cur={b:sL.b||0,c:sL.c||0};cur[y]=v;if(v&&y==='b')cur.c=0;if(v&&y==='c')cur.b=0;
      // 0 yazmak satırı çıkarmaz (Görev 39): iki taraf da 0 olursa önerilen tutara dönülür; çıkarmak için − düğmesi
      const m={...(r.tutarElle||{})};if(!cur.b&&!cur.c){delete m[k];toast('0 yazınca satır çıkmaz; önerilen tutara dönüldü. Satırı çıkarmak için − düğmesine basın.');}else m[k]=cur;r.tutarElle=m;drawSoon();return;}
    if(t.dataset.fek!=null){const r=st.rows[+t.dataset.fek];const x=(r.ekSatir||[]).find(z=>z.id===t.dataset.id);if(!x)return;const a=t.dataset.alan;
      if(a==='acc')x.acc=t.value.trim();else if(a==='desc')x.desc=t.value;else{x[a]=r2(trSayi(t.value));if(x[a]){if(a==='b')x.c=0;else x.b=0;}}
      drawSoon();return;}
    if(t.dataset.dg!=null){st.rows[+t.dataset.dg].diger=t.value.trim();drawSoon();return;}
    if(t.dataset.fark!=null){const r=st.rows[+t.dataset.fark];r.fark=t.value.trim();drawSoon();return;}
    if(t.dataset.farkhep!=null){const r=st.rows[+t.dataset.farkhep];const v=r.fark||farkHesabi(r);if(t.checked&&v&&st.firm){st.firm={...st.firm,fkFarkHesap:v};Store.saveFirm(st.firm);toast('Bu firmada farklar için '+v+' önerilecek.');draw();}return;}
    if(t.id==='fkkTopluH'){const v=t.value.trim();if(!v)return;for(const r of st.rows)if(r.sec&&!r.logged){r.hesap=v;r.kaynak='elle';r.elle=true;}t.value='';draw();return;}
    if(t.id==='fkkKaynak'){if(st.firm){st.firm={...st.firm,fkKaynak:t.value};Store.saveFirm(st.firm);}for(const r of st.rows)delete r.kaynakSec;reapply();return;}
    if(t.id==='fkkGrup'){st.grup=t.value;if(st.firm){st.firm={...st.firm,fkFisGrup:st.grup};Store.saveFirm(st.firm);}draw();return;}
    if(t.id==='fkkBT'){st.belgeTuru=t.value.trim().toLocaleUpperCase('tr-TR');if(st.firm){st.firm={...st.firm,fkBelgeTuru:st.belgeTuru};Store.saveFirm(st.firm);}return;}
  });
  document.addEventListener('input',e=>{const fk=e.target.dataset&&e.target.dataset.fkfl;if(fk!=null&&e.target.closest('#fkKayit')){st.f[fk]=e.target.value;const p=e.target.selectionStart;draw();const n=document.querySelector(`[data-fkfl="${fk}"]`);if(n){n.focus();n.setSelectionRange(p,p);}return;}
    if(e.target.id==='fkkQ'){st.q=e.target.value;const p=e.target.selectionStart;draw();const n=$('#fkkQ');n.focus();n.setSelectionRange(p,p);}});
  document.addEventListener('keydown',e=>{if(e.key!=='Escape'||$('#fkKayit').hidden)return;if(!$('#fkkModal').hidden){if(!st.busy)$('#fkkModal').hidden=true;return;}if(!st.busy)close();});
  return {open,close,_st:st,_satirlar:satirlar,_cariSec:cariSec,_vknOk:vknOk,_cariVknHatirla:cariVknHatirla,_fisler:fisler,_grupTarihi:grupTarihi,_oner:oner,_kodBirlestir:kodBirlestir,_kaynaklar:kaynaklar,_silinenBul:silinenBul,_fnoN:fnoN,_lucaFisAc:lucaFisAc,_muavinIs:muavinIs,_beklemeMs:o=>{muavinBekleMs=o;},_silinenleriIsle:async()=>{await silinenleriIsle();draw();},_firma:()=>st.firm,_yenile:async()=>{if(!st.data)return;await resolveFirm();reapply();}};
})();
window.__fkayit=FKAYIT;

/* ---------- Ofisinize Özel Çözümler › Muhasebe Denetimi: Fatura Kontrol yan sürecinde çalışan sayfa (denetim.html) ---------- */
const MDENET=(()=>{
  let url=null;
  const fr=()=>$('#mdFrame');
  const firmaGonder=()=>{const w=fr()&&fr().contentWindow;if(!w)return;const f=S.firm&&S.firm.id!==EXAMPLE_ID?S.firm:null;
    w.postMessage({muhawin:true,tip:'firma',mw:f?f.id:'',id:f&&f.lucaId?String(f.lucaId):'',ad:f?f.name:'',liste:(S.firms||[]).filter(x=>x.id!==EXAMPLE_ID).map(x=>({mw:x.id,id:x.lucaId?String(x.lucaId):'',ad:x.name}))},'*');};
  async function show(){const P=$('#mdPanel');P.hidden=false;
    if(!url){try{const r=await window.desktop.fk.start();url=r.url;}catch(e){$('#mdBekle').textContent='Muhasebe Denetimi açılamadı: '+String(e&&e.message||e);return;}
      fr().src=url+'/denetim';}
    $('#mdBekle').hidden=true;fr().hidden=false;firmaGonder();}
  function hide(){const P=$('#mdPanel');if(P)P.hidden=true;}
  window.addEventListener('message',e=>{if(!e.data||!e.data.fk||e.source!==(fr()&&fr().contentWindow))return;
    if(e.data.tip==='denetimHazir'){firmaGonder();return;}
    /* firmaSec ve esc mesajlarını Fatura Kontrol'ün dinleyicisi (aynı kaynaktan) işler */});
  firmaDinle(()=>{if(!$('#mdPanel').hidden)firmaGonder();});
  return {show,hide};
})();

/* ---------- modüller ---------- */
// sağdaki kaydırma çubuğu payı (scrollbar-gutter): sabit paneller sayfa içeriğiyle aynı sağ kenarda biter
// Ö7 (Görev 25): örnek firma seçiliyken "Üstten firma seçin" yerine ne yapılacağı söylenir
function firmaYokUyari(){return (typeof isExample==='function'&&isExample())?'Örnek firmada kullanılamaz — Ayarlar › Firmalar\'dan firma ekleyin':'Üstten firma seçin';}
// Görev 33: tek hiza kuralı — üst şerit, modül sekmeleri ve tüm alt menüler aynı sol / sağ çizgide (sayfa sütunu = modül sekme satırı).
// Sabit konumlu paneller (Muhasebe, Mizan / Muavin / Hesap Planı, fatura kaydı) bu sütuna oturur; üst bölümün boyu değişince
// (yazı tipi geç yüklenmesi, Luca düğmesi yazısı, pencere boyu) yeniden yerleşir: 'mw-hiza' olayı.
function hizaKutu(){const t=document.getElementById('modSekme');if(!t||!t.getClientRects().length)return null;const r=t.getBoundingClientRect();
  return {sol:Math.round(r.left),sag:Math.max(0,Math.round(window.innerWidth-r.right)),alt:Math.round(r.bottom)};}
{let bek=0;const tetik=()=>{if(bek)return;bek=requestAnimationFrame(()=>{bek=0;window.dispatchEvent(new Event('mw-hiza'));});};
  try{const ro=new ResizeObserver(tetik);['header.top','#modSekme','#modeTabs'].forEach(s=>{const e=document.querySelector(s);if(e)ro.observe(e,{box:'border-box'});});}catch(e){}
  window.addEventListener('resize',tetik);try{document.fonts.ready.then(tetik);}catch(e){}}
function sagPay(){return Math.max(0,Math.round(window.innerWidth-document.body.getBoundingClientRect().right));}
/* ---------- Tam ekran paneller (Mizan / Muavin / Hesap Planı, Faturaları Luca'ya kaydet) üst şeridi örtmez ----------
   Panel açılınca sayfa başa alınır ve panel modül sekme satırının hemen altından başlar; kapanınca kaydırma yeri geri gelir.
   Böylece üst şerit ve modül sekmeleri her ekranda aynı yerde görünür. */
const UstPanel=(()=>{const P=['#mmPanel','#fkKayit'];
  // en alttaki görünür menü satırı: Muhasebe alt menüsü (#fkNav) ya da Banka alt sekmeleri (#modeTabs); yoksa modül sekmeleri
  const alt=()=>{if(!$('#modGate').hidden)return 0;let b=0;for(const s of ['#modSekme','#modeTabs','#fkNav']){const t=$(s);if(!t||!t.getClientRects().length||t.closest('[hidden]'))continue;const r=t.getBoundingClientRect();if(r.height)b=Math.max(b,r.bottom);}return Math.max(0,Math.round(b+6));};
  function yerlestir(el){const h=hizaKutu();el.style.top=alt()+'px';el.style.left=h?h.sol+'px':'';el.style.right=(h?h.sag:sagPay())+'px';}
  const gozle=el=>{let acik=!el.hidden,y=0;
    new MutationObserver(()=>{if(el.hidden===!acik)return;acik=!el.hidden;
      if(acik){y=window.scrollY;window.scrollTo(0,0);yerlestir(el);}else{el.style.top='';el.style.left='';el.style.right='';if(y)window.scrollTo(0,y);}}).observe(el,{attributes:true,attributeFilter:['hidden']});};
  P.forEach(s=>{const el=$(s);if(el)gozle(el);});
  window.addEventListener('mw-hiza',()=>P.forEach(s=>{const el=$(s);if(el&&!el.hidden)yerlestir(el);}));
  // modül sekmesiyle başka modüle geçerken açık panel kapanır (yarım iş varsa kendi Kapat düğmesi kuralına uyar)
  function kapatHepsi(){if(!$('#mmPanel').hidden)$('#mmClose').click();if(!$('#fkKayit').hidden)$('#fkkClose').click();return $('#mmPanel').hidden&&$('#fkKayit').hidden;}
  return {kapatHepsi};})();
/* ---------- Üstte kalıcı modül sekmeleri (menü düzeni B): modül seçim ekranına dönmeden modül değiştirilir ----------
   Lisans denetimi modül kartıyla aynı (Desk.licenseGate); "Yakında" modüller pasif kalır. */
const MOD_SEKME=[['ekstre','Banka'],['fatura','Muhasebe'],['okc','Belgeden Fiş'],['denetim','Denetim'],['ozel','Ofisinize Özel'],['gecici','Geçici Vergi'],['personel','Personel']];
function modSekmeCiz(){const el=$('#modSekme');if(!el)return;
  const mods=Desk.modlar()||[];
  // sıra modül seçim ekranıyla aynı (Görev 33): modül listesinin sırası; listede olmayanlar sonda
  const sira=id=>{const i=mods.findIndex(x=>x.id===id);return i<0?99:i;};
  const L=MOD_SEKME.slice().sort((a,b)=>sira(a[0])-sira(b[0])).map(([id,ad])=>{const m=mods.find(x=>x.id===id);
    if(id==='ozel'&&(!m||m.type==='gizli'))return '';                       // ofise tanımlı değilse görünmez
    if(!m||Desk.modState(m)[0]==='soon')return '';                           // "Yakında" modüller yalnız modül seçim ekranında
    return `<button class="modsek" role="tab" data-modsekme="${id}" aria-selected="${S.module===id}">${esc(ad)}</button>`;});
  if(window.__admOk)L.push(`<button class="modsek" role="tab" data-modsekme="yonetim" aria-selected="${S.module==='yonetim'}">Yönetim</button>`);
  el.innerHTML=L.join('');}
$('#modSekme').addEventListener('click',async e=>{const b=e.target.closest('[data-modsekme]');if(!b||b.disabled)return;const id=b.dataset.modsekme;
  if(S.module===id)return;if(!UstPanel.kapatHepsi()){toast('Önce süren işlemin bitmesini bekleyin.');return;}if(!(await Desk.licenseGate(id))){if(id==='yonetim')toast('Yönetim yalnız program sahibi hesabıyla açılır.');return;}enterModule(id);});
function enterModule(id){
  S.module=id;document.body.classList.toggle('mod-fatura',id==='fatura');document.body.classList.toggle('mod-ekstre',id==='ekstre');
  const h=$('#h1Mod');
  document.body.classList.toggle('mod-hub',id==='denetim'||id==='ozel'||id==='okc'||id==='yonetim');
  CEK.hide();MDENET.hide();   // özel çözüm ekranları modüle girişte kapalı başlar (seçim ekranı açılır)
  if(id!=='okc')OKC.hide();
  if(id!=='yonetim'&&typeof ADM!=='undefined')ADM.hide();
  if(id==='yonetim'){HUB.hide();if(S.view==='fatura'){S.view=null;FKUI.hide();}if(h)h.textContent='Yönetim';ADM.show();modSekmeCiz();window.scrollTo(0,0);return;}
  if(id==='okc'){HUB.hide();if(S.view==='fatura'){S.view=null;FKUI.hide();}if(h)h.textContent='Belgeden Fiş';OKC.show();}
  else if(id==='fatura'){HUB.hide();S.view='fatura';if(h)h.textContent='Muhasebe İşlemleri';FKUI.show();}
  else if(id==='denetim'||id==='ozel'){if(S.view==='fatura'){S.view=null;FKUI.hide();}if(h)h.textContent=id==='ozel'?'Ofisinize Özel Çözümler':'Denetim ve Analiz';HUB.show(id);}
  else{HUB.hide();if(S.view==='fatura'){S.view=null;FKUI.hide();}if(h)h.textContent='Banka İşlemleri';renderModeTabs();renderToolbar();}
  modSekmeCiz();window.scrollTo(0,0);
}
/* ---------- Arka plan işleri rozeti (üst şerit): süren işler sayısı; üzerine gelince adları ---------- */
const Isler=(()=>{const L=new Map();let n=0;
  function ciz(){const b=$('#islerBtn');if(!b)return;b.hidden=!L.size;$('#islerN').textContent=L.size;b.title=L.size?'Arka planda süren işler:\n• '+[...L.values()].join('\n• '):'';}
  return {basla(ad){const id=++n;L.set(id,ad);ciz();return id;},bitir(id){L.delete(id);ciz();},guncelle(id,ad){if(L.has(id)){L.set(id,ad);ciz();}},sayi:()=>L.size};})();
$('#islerBtn').addEventListener('click',()=>{toast(Isler.sayi()?'Süren işler: '+$('#islerBtn').title.split('\n').slice(1).join(' ').replace(/• /g,''):'Arka planda iş yok.');});

/* ---------- Ekranda ara (Ctrl+F): açık çalışma ekranındaki yazılarda ve kutularda arama, eşleşmeler vurgulanır ---------- */
const EKRANARA=(()=>{
  const KAPSAM=['#fkKayit','#mmPanel','#okcPanel','#cekPanel','#flPanel','#fgPanel','#admPanel','#mmFis','.modal'];
  let bar=null,es=[],i=-1,son='';
  const gorunur=el=>el&&!el.hidden&&el.offsetParent!==null||(el&&getComputedStyle(el).position==='fixed'&&!el.hidden&&el.getClientRects().length);
  function kapsam(){let en=null,ez=-1;
    for(const sel of KAPSAM)for(const el of document.querySelectorAll(sel)){if(el.id==='komutModal'||el.closest('#mwAra'))continue;if(el.hidden||!el.getClientRects().length)continue;
      const z=+getComputedStyle(el).zIndex||0;if(z>=ez){ez=z;en=el;}}
    if(en)return en;
    const app=document.querySelector('.app:not([hidden])');return app&&app.getClientRects().length&&document.querySelector('#modGate')&&document.querySelector('#modGate').hidden?app:null;}
  function kur(){if(bar)return;bar=document.createElement('div');bar.id='mwAra';bar.hidden=true;bar.setAttribute('role','search');
    bar.innerHTML=`<input id="mwAraQ" type="search" placeholder="Bu ekranda ara…" autocomplete="off" aria-label="Bu ekranda ara"><span id="mwAraN" class="note"></span>
      <button class="btn small ghost" id="mwAraOnc" title="Önceki (Shift+Enter)">▲</button><button class="btn small ghost" id="mwAraSon" title="Sonraki (Enter)">▼</button>
      <button class="btn small ghost" id="mwAraKomut" title="Komut paleti (Ctrl+K)">Komutlar</button><button class="btn small ghost" id="mwAraX" title="Kapat (Esc)">✕</button>`;
    document.body.appendChild(bar);
    const q=bar.querySelector('#mwAraQ');let t=null;
    q.addEventListener('input',()=>{clearTimeout(t);t=setTimeout(()=>ara(q.value),120);});
    q.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();if(q.value!==son)ara(q.value);else git(e.shiftKey?-1:1);}else if(e.key==='Escape'){e.preventDefault();e.stopPropagation();kapat();}});
    bar.querySelector('#mwAraSon').onclick=()=>git(1);bar.querySelector('#mwAraOnc').onclick=()=>git(-1);bar.querySelector('#mwAraX').onclick=kapat;
    bar.querySelector('#mwAraKomut').onclick=()=>{const v=q.value;kapat();KOMUT.ac();const k=document.querySelector('#komutQ');if(k&&v){k.value=v;k.dispatchEvent(new Event('input'));}};}
  const trk=t=>String(t||'').toLocaleLowerCase('tr-TR');
  function temizle(){try{CSS.highlights.delete('mwara');CSS.highlights.delete('mwaraaktif');}catch(e){}document.querySelectorAll('.mwara-kutu').forEach(x=>x.classList.remove('mwara-kutu','mwara-aktif'));es=[];i=-1;}
  function ara(v,sessiz){const onceki=i;temizle();son=v;const n=bar.querySelector('#mwAraN');const k=kapsam();if(!v||v.trim().length<1||!k){n.textContent='';return;}
    const aranan=trk(v.trim());
    const w=document.createTreeWalker(k,NodeFilter.SHOW_TEXT,{acceptNode:x=>{const p=x.parentElement;if(!p||p.closest('#mwAra,script,style,[hidden],option,select'))return NodeFilter.FILTER_REJECT;return x.nodeValue&&x.nodeValue.trim()?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_REJECT;}});
    const sonuc=[];let x;
    while((x=w.nextNode())&&sonuc.length<2000){const tx=trk(x.nodeValue);let j=tx.indexOf(aranan);
      while(j>=0&&sonuc.length<2000){const r=new Range();r.setStart(x,j);r.setEnd(x,Math.min(x.nodeValue.length,j+aranan.length));sonuc.push({r,el:x.parentElement});j=tx.indexOf(aranan,j+aranan.length);}}
    for(const inp of k.querySelectorAll('input:not([type=checkbox]):not([type=radio]):not([type=hidden]),textarea')){if(inp.closest('#mwAra'))continue;if(trk(inp.value).includes(aranan)&&inp.getClientRects().length){inp.classList.add('mwara-kutu');sonuc.push({el:inp});}}
    sonuc.sort((a,b)=>{const c=a.el.compareDocumentPosition(b.el);return c&Node.DOCUMENT_POSITION_FOLLOWING?-1:c&Node.DOCUMENT_POSITION_PRECEDING?1:0;});
    es=sonuc;try{CSS.highlights.set('mwara',new Highlight(...es.filter(e=>e.r).map(e=>e.r)));}catch(e){}
    n.textContent=es.length?'':'Bulunamadı';if(!es.length)return;
    if(sessiz){i=Math.min(Math.max(onceki,0),es.length-1)-1;git(1,true);}else git(1);}
  function git(d,kaydirma){if(!es.length)return;i=(i+d+es.length)%es.length;const e=es[i];
    document.querySelectorAll('.mwara-aktif').forEach(x=>x.classList.remove('mwara-aktif'));
    try{CSS.highlights.set('mwaraaktif',e.r?new Highlight(e.r):new Highlight());}catch(x){}
    if(!e.r)e.el.classList.add('mwara-aktif');
    if(!kaydirma)(e.el.closest('tr')||e.el).scrollIntoView({block:'center',inline:'nearest'});
    bar.querySelector('#mwAraN').textContent=(i+1)+' / '+es.length;}
  function ac(v){kur();bar.hidden=false;const q=bar.querySelector('#mwAraQ');if(v!=null&&v!==''){q.value=v;}q.focus();q.select();if(q.value)ara(q.value);}
  function kapat(){if(!bar||bar.hidden)return;bar.hidden=true;temizle();son='';}
  // ekran değişince (tablo yeniden çizilince) vurgular bayatlar: arama kutusu açıksa yeniden aranır
  new MutationObserver(()=>{if(bar&&!bar.hidden&&son&&!document.activeElement.closest('#mwAra')){clearTimeout(bar._t);bar._t=setTimeout(()=>ara(son,true),300);}}).observe(document.body,{childList:true,subtree:true});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&bar&&!bar.hidden){kapat();}});
  return {ac,kapat,kapsam};
})();
window.__ekranAra=EKRANARA;

/* ---------- Komut paleti (Ctrl+K) ve Yardım (F1) ---------- */
const KOMUT=(()=>{
  const M=$('#komutModal'),Q=$('#komutQ'),L=$('#komutL');let liste=[],sec=0;
  const tr=t=>String(t||'').toLocaleLowerCase('tr-TR').replace(/[İI]/g,'i').replace(/ı/g,'i').replace(/ş/g,'s').replace(/ğ/g,'g').replace(/ü/g,'u').replace(/ö/g,'o').replace(/ç/g,'c');
  const modul=async(id,sonra)=>{if(S.module!==id){if(!(await Desk.licenseGate(id)))return;enterModule(id);}if(sonra)setTimeout(sonra,60);};
  function komutlar(){
    const K=[
      {g:'Ekranlar',b:'Banka İşlemleri',d:'Banka ekstresi → Luca fişleri',f:()=>modul('ekstre'),k:'Alt+1'},
      {g:'Ekranlar',b:'Muhasebe İşlemleri › Toplu Kontrol',d:'Fatura–muavin karşılaştırma (tüm firmalar)',f:()=>modul('fatura',()=>FKUI.sayfaAc('toplu')),k:'Alt+2'},
      {g:'Ekranlar',b:'Muhasebe İşlemleri › Tek Firma',d:'Tek firma fatura kontrolü',f:()=>modul('fatura',()=>FKUI.sayfaAc('tek'))},
      {g:'Ekranlar',b:'Fiş Girişi',d:'Elle fiş girişi; Luca\'ya kaydet',f:()=>modul('fatura',()=>FKUI.sayfaAc('fis')),k:'Alt+3'},
      {g:'Ekranlar',b:'Fiş Listesi',d:'Muavinden fişler; Luca\'da aç, PDF/Excel',f:()=>modul('fatura',()=>FKUI.sayfaAc('fisl')),k:'Alt+4'},
      {g:'Ekranlar',b:'KDV Beyannamesi',d:'KDV1 / KDV2 hazırlama ve karşılaştırma',f:()=>modul('fatura',()=>FKUI.sayfaAc('kdv')),k:'Alt+5'},
      {g:'Ekranlar',b:'Belgeden Fiş',d:'ÖKC fişi, Z raporu, yurt dışı faturası (görüntü / PDF)',f:()=>modul('okc'),k:'Alt+6'},
      ...((window.__ozelListe||[]).length?[{g:'Ekranlar',b:'Ofisinize Özel Çözümler',d:'Ofisinize tanımlı özel çözümler',f:()=>modul('ozel'),k:'Alt+8'}]:[]),
      ...(window.__admOk?[{g:'Ekranlar',b:'Yönetim',d:'Üyeler, lisanslar, satışlar, kodlar (yalnız program sahibi)',f:()=>modul('yonetim'),k:'Alt+9'}]:[]),
      {g:'Ekranlar',b:'Modüller',d:'Modül seçim ekranı',f:()=>$('#modulesBtn').click()},
      ...(window.desktop&&window.desktop.luca&&window.desktop.luca.calis?[{g:'Ekranlar',b:"Luca'da Çalış",d:'Tam ekran Luca çalışma penceresi',f:()=>$('#lucaCalisBtn').click()}]:[]),
      {g:'Veri',b:'Mizan',d:'Firmanın mizanı',f:()=>MMUI.open('mizan')},
      {g:'Veri',b:'Muavin',d:'İndirilmiş muavinler, tarih aralığı, fiş detayı',f:()=>MMUI.open('muavin')},
      {g:'Veri',b:'Hesap Planı',d:'Firmanın hesap planı (Luca\'dan çek, Excel)',f:()=>MMUI.open('plan')},
      {g:'Veri',b:'Yeni firma',d:'Elle firma ekle (Ayarlar › Firmalar)',f:()=>yeniFirma()},
      {g:'Veri',b:'Luca\'dan firma ekle',d:'Luca firma listesinden ekle (Ayarlar › Firmalar)',f:()=>Desk.openLuca('firms')},
      {g:'Luca',b:'Luca\'ya bağlan / pencereyi göster',d:'Luca giriş penceresi',f:()=>{const b=$('#lucaTopBtn');if(b)b.click();else window.__mwApi.luca.open();}},
      {g:'Ayarlar',b:'Ayarlar',d:'Lisans, büro, Luca giriş, WhatsApp, yedek, firmalar',f:()=>openReg(),k:'Ctrl+S'},
      {g:'Ayarlar',b:'Yedek al',d:'Tüm verileri bir klasöre kopyala',f:async()=>{try{const r=await mwBusy.run('Yedek alınıyor…','',()=>window.__mwApi.yedek.al());if(r&&r.ok)toast('Yedek alındı: '+r.path);}catch(e){toast(cleanErr(e));}}},
      {g:'Ayarlar',b:'Hata günlüğünü aç',d:'Belgeler\\MuhaWin Günlük\\hatalar.log',f:()=>window.__mwApi.hata.ac()},
      {g:'Ayarlar',b:'Güncellemeleri denetle',d:'Yeni sürüm var mı?',f:()=>{openReg();setTimeout(()=>{const b=$('#updBtn');if(b)b.click();},400);}},
      {g:'Ayarlar',b:'Yardım ve kısayollar',d:'Tüm klavye kısayolları',f:()=>YARDIM.ac(),k:'F1'},
      ...SKINS.map(([id,ad,d])=>({g:'Tema',b:'Tema: '+ad,d,f:()=>{curSkin=id;applySkin(id);try{localStorage.setItem('ekstre-luca-skin',id);}catch(_){}}})),
      ...S.firms.filter(f=>f.id!==EXAMPLE_ID).map(f=>({g:'Firma',b:f.name,d:'Firmayı seç'+(f.lucaId?' · Luca':''),f:()=>selectFirm(f.id)})),
    ];return K;}
  function suz(q){q=tr(q).trim();const K=komutlar();if(!q)return K.filter(x=>x.g!=='Firma'&&x.g!=='Tema').concat(K.filter(x=>x.g==='Firma').slice(0,6));
    const p=q.split(/\s+/);return K.map(x=>{const h=tr(x.b+' '+x.d+' '+x.g);let sk=0;for(const w of p){const i=h.indexOf(w);if(i<0)return null;sk+=(tr(x.b).startsWith(w)?3:tr(x.b).includes(w)?2:1);}return {x,sk};}).filter(Boolean).sort((a,b)=>b.sk-a.sk).map(z=>z.x).slice(0,40);}
  function ciz(){liste=suz(Q.value);sec=Math.min(sec,Math.max(0,liste.length-1));let g='';
    L.innerHTML=liste.length?liste.map((x,i)=>{const h=x.g!==g?`<div class="grp">${esc(x.g)}</div>`:'';g=x.g;return h+`<div class="ki" role="option" data-i="${i}" aria-selected="${i===sec}"><b>${esc(x.b)}</b><span class="note" style="margin-left:0;white-space:normal">${esc(x.d||'')}</span>${x.k?`<span class="note"><kbd class="kbd">${esc(x.k)}</kbd></span>`:''}</div>`;}).join(''):'<p class="note" style="padding:12px">Eşleşen komut yok.</p>';
    const el=L.querySelector('[aria-selected=true]');if(el)el.scrollIntoView({block:'nearest'});}
  function ac(){if(!M.hidden){kapat();return;}if(!$('#licGate').hidden||!$('#authGate').hidden)return;M.hidden=false;Q.value='';sec=0;ciz();setTimeout(()=>Q.focus(),20);}
  function kapat(){M.hidden=true;}
  async function calistir(i){const x=liste[i];if(!x)return;kapat();try{await x.f();}catch(e){toast(cleanErr(e));}}
  Q.addEventListener('input',()=>{sec=0;ciz();});
  Q.addEventListener('keydown',e=>{if(e.key==='ArrowDown'){e.preventDefault();sec=Math.min(sec+1,liste.length-1);ciz();}else if(e.key==='ArrowUp'){e.preventDefault();sec=Math.max(sec-1,0);ciz();}else if(e.key==='Enter'){e.preventDefault();calistir(sec);}else if(e.key==='Escape'){e.preventDefault();kapat();}});
  L.addEventListener('click',e=>{const k=e.target.closest('.ki');if(k)calistir(+k.dataset.i);});
  M.addEventListener('pointerdown',e=>{if(e.target===M)kapat();});
  $('#komutBtn').addEventListener('click',ac);
  const HIZLI={'1':'ekstre','2':'fatura:toplu','3':'fatura:fis','4':'fatura:fisl','5':'fatura:kdv','6':'okc','8':'ozel','9':'yonetim'};
  document.addEventListener('keydown',e=>{
    // Ctrl+F: çalışma ekranlarında (fatura kaydı, mizan / muavin, ÖKC, fiş listesi …) o ekranda metin arama; ana ekranda komut paleti. Ctrl+K: her yerde komut paleti
    if((e.ctrlKey||e.metaKey)&&!e.shiftKey&&!e.altKey&&(e.key.toLowerCase()==='f'||e.code==='KeyF')){e.preventDefault();if(!M.hidden){kapat();EKRANARA.ac(Q.value);return;}if(EKRANARA.kapsam())EKRANARA.ac();else ac();return;}
    if((e.ctrlKey||e.metaKey)&&!e.shiftKey&&!e.altKey&&(e.key.toLowerCase()==='k'||e.code==='KeyK')){e.preventDefault();EKRANARA.kapat();ac();return;}
    if(e.key==='F1'){e.preventDefault();YARDIM.ac();return;}
    if((e.ctrlKey||e.metaKey)&&!e.shiftKey&&!e.altKey&&e.key.toLowerCase()==='s'&&!e.target.closest('input,textarea,select,[contenteditable]')){e.preventDefault();openReg();return;}
    if(e.altKey&&!e.ctrlKey&&!e.shiftKey&&HIZLI[e.key]&&!e.target.closest('#fgPanel')&&!document.querySelector('#fgPanel:not([hidden])')){e.preventDefault();const [m,sayfa]=HIZLI[e.key].split(':');modul(m,sayfa?()=>FKUI.sayfaAc(sayfa):null);}
  },true);
  return {ac,kapat};
})();
const YARDIM=(()=>{
  const M=$('#yardimModal');
  const B=[['Genel',[['Ctrl+K','Komut paleti: ekran, işlem, firma, tema araması'],['Ctrl+F','Açık ekranda (fatura kaydı, muavin, fiş listesi …) yazı arama; Enter: sonraki, Shift+Enter: önceki'],['F1','Bu yardım'],['Ctrl+S','Ayarlar'],['Alt+1 … Alt+6 · Alt+8','Banka · Toplu Kontrol · Fiş Girişi · Fiş Listesi · KDV · ÖKC · Özel'],['Esc','Açık pencereyi kapat']]],
    ['Fiş Girişi (Muhasebe İşlemleri)',[['Enter / Tab','Sonraki alan; son alanda yeni satır'],['F7 / F8 / F9','%1 / %10 / %20 KDV ayır (odaktaki satır)'],['Alt+Y','Yeni fiş'],['Alt+1','Üst satırı kopyala'],['Alt+2','Üstteki alanı kopyala'],['Alt+3','Mini hesap planı'],['Alt+4','Evrak no / tarih / açıklamayı kopyala'],['Alt+C','Kasayla kapat'],['Alt+E','Satır ekle'],['Alt+G','Genel bakiyeyi kapat'],['Alt+H','Kapat hesabına kapat'],['Alt+M','Muavin'],['Alt+K','Kaydet (Luca)'],['Alt+S','Satır sil']]],
    ['Tarih kutuları',[['gg.aa.yyyy','Doğrudan yazın; 2 haneli yıl 20yy sayılır'],['↑ / ↓','Bir gün ileri / geri'],['Alt+↓ · F4','Takvim']]],
    ['Tablolar',[['Sütun başlığı','Tıkla: sırala · sürükle: genişlik · sağ tık: sütun gizle/göster'],['Çift tık (satır)','Fiş / belge detayı']]]];
  function ac(){$('#yardimB').innerHTML=`<div class="yardim">${B.map(([h,L])=>`<h3>${esc(h)}</h3><table>${L.map(([k,d])=>`<tr><td><kbd class="kbd" style="margin:0">${esc(k)}</kbd></td><td>${esc(d)}</td></tr>`).join('')}</table>`).join('')}
    <p class="note" style="margin-top:14px">Destek: bilgi@smmmantalya.com · Hata günlüğü: Ayarlar › Yedekleme ve hata günlüğü. Program SMMM Mehmet Çelik tarafından geliştirilmiştir.</p></div>`;M.hidden=false;}
  function kapat(){M.hidden=true;}
  document.addEventListener('click',e=>{if(e.target.closest('[data-yardimx]'))kapat();});
  M.addEventListener('pointerdown',e=>{if(e.target===M)kapat();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!M.hidden)kapat();});
  return {ac,kapat};
})();

/* ---------- Esc = geri: açık pencere / menü / liste yoksa bir önceki ekrana ----------
   Muhasebe İşlemleri alt sayfası → Toplu Kontrol; Çek / Senet → Ofisinize Özel Çözümler; modül → Modüller ekranı. */
const ESC_ACIK='#mwAra:not([hidden]),.modal:not([hidden]),#mmPanel:not([hidden]),#fkKayit:not([hidden]),#hsDrop:not([hidden]),#kzMenu,.mmmenu:not([hidden]),.thememenu:not([hidden]),#mwBusy:not([hidden]),#authGate:not([hidden]),#licGate:not([hidden]),#modGate:not([hidden]),#popForm,dialog[open]';
const ESC_KAPAT={admModal:'[data-admx]',okcModal:'[data-okx]',cekModal:'[data-cx]',bmutModal:'[data-bmutx]',ozetModal:'[data-ozetx]'};
const yaziKutusu=t=>!!t&&(t.isContentEditable||t.tagName==='TEXTAREA'||(t.tagName==='INPUT'&&!/^(checkbox|radio|button|submit|reset|file|range|color|image)$/i.test(t.type||'')));
function geri(){
  if(document.querySelector(ESC_ACIK))return false;
  if(!$('#cekPanel').hidden){CEK.hide();HUB.show('ozel');return true;}
  if(!$('#mdPanel').hidden){MDENET.hide();HUB.show('ozel');return true;}
  if(!$('#admPanel').hidden&&ADM.geri())return true;
  if(S.module==='fatura'&&typeof FKUI!=='undefined'&&FKUI._sayfa&&FKUI._sayfa()&&FKUI._sayfa()!=='toplu'){FKUI.sayfaAc('toplu');return true;}
  $('#modulesBtn').click();return true;}
window.addEventListener('keydown',e=>{if(e.key!=='Escape'||e.defaultPrevented)return;
  // özel Esc dinleyicisi olmayan pencereler burada kapanır
  for(const [id,sec] of Object.entries(ESC_KAPAT)){const m=document.getElementById(id);if(m&&!m.hidden){
    if([...document.querySelectorAll('.modal:not([hidden])')].some(x=>x!==m&&!m.contains(x)))return;   // üstte soru penceresi var: o kapanır
    const b=m.querySelector(sec);if(b){e.preventDefault();b.click();}return;}}
  if(document.querySelector(ESC_ACIK))return;           // pencere / menü kendi Esc'iyle kapanır
  const t=e.target;if(t&&t.tagName==='SELECT')return;     // açık açılır listeyi kapatıyor olabilir
  // metin kutusunda yazarken Esc ekrandan çıkarmaz: önce yalnız kutudan çıkılır, ikinci Esc geri götürür
  if(yaziKutusu(t)){e.preventDefault();t.blur();return;}
  setTimeout(()=>{if(!document.querySelector(ESC_ACIK))geri();},0);},true);
$('#modulesBtn').addEventListener('click',async()=>{const id=await Desk.moduleGate();enterModule(id);});
$('#homeLogo').addEventListener('click',()=>$('#modulesBtn').click());
$('#homeLogo').addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();$('#modulesBtn').click();}});
$('#storeState').textContent='Bağlanıyor…';

(async()=>{
  S.db=null;
  S.dl={save:async({filename,data})=>{const buf=new Uint8Array(await data.arrayBuffer());const r=await window.desktop.saveFile(filename,buf);if(!r.ok)throw {code:'declined'};S.lastSaved=r.path;return {status:'saved'};}};
  if(!(await Desk.authGate()))return;
  Store.cache=null;
  const mod=await Desk.moduleGate();
  try{const o=await Store.getOutput();if(o&&Array.isArray(o.headers)&&o.headers.length)S.out={headers:o.headers,sheet:o.sheet||DEFAULT_SHEET,custom:!!o.custom};}catch(e){}
  Store.subscribeFirms(onFirms);
  renderOut();
  enterModule(mod);
  Desk.ensureSetup();
})();

window.__enterModule=id=>enterModule(id);
window.__app={bankaTahmin,detectVirman,virmanTL,buildLuca,toAoa,filePB,pbBul,pbDosyadan,kurHazirla,S,Desk,Store,selectFirm,onFirms,renderAll,bankaEsle,unvanCikar,reassign,renderToolbar,toast,esc,N,fmtD,mizanIndex,autoBanks,uid,isExample,EXAMPLE_ID,reassign,renderDatalist,readPdfLines};
window.__ekstre={S,parseAmount,parseDate,autoMap,parsePdfLines,splitTail,buildLuca,toAoa,makeWorkbook,parseMizan,mizanIndex,buildMatcher,fieldOf};
/* ---------- Muhasebe İşlemleri › Fiş Girişi: elle fiş → Luca (fiş kesme) ya da Luca Excel aktarım dosyası ---------- */
const FISG=(()=>{
  // [anahtar, ad, Luca fisTipi varsayılan kodu]. Mahsup=3 Luca'da doğrulandı; diğer kodlar Luca Fiş Girişi'nde kaydedilen istekle
  // teyit edilene kadar Fiş Ayarları'ndan değiştirilebilir (Ayarlar › Luca İstek Kaydı ile öğrenilir).
  const TIPLER=[['3','Mahsup','3'],['1','Tahsil','1'],['2','Tediye','2'],['4','Açılış','4'],['5','Kapanış','5']];
  function tipKod(tip){const a=ayar();const t=TIPLER.find(z=>z[0]===tip)||TIPLER[0];const k=String(a['tip_'+t[0]]||'').trim();return /^\d{1,2}$/.test(k)?k:t[2];}
  const api=window.__mwApi||window.desktop;
  const clean=e=>String(e&&e.message||e).replace(/^Error invoking remote method '[^']+': (Error: )?/,'');
  let sonOdak=null;                                   // son odaklanan satır / alan (kısayollar panel dışından da çalışır)
  const st={fid:'',ust:{tarih:'',ac:'',tip:'3'},satir:[],kayitlar:[],mini:false,miniQ:'',ayarAcik:false,kisa:false};
  const bugun=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');};
  const yeniSatir=o=>({kod:'',evrak:(o&&o.evrak)||'',etarih:(o&&o.etarih)||st.ust.tarih||bugun(),bt:(o&&o.bt)||'',ac:(o&&o.ac)||st.ust.ac||'',b:'',c:''});
  const firma=()=>S.firm&&S.firm.id!==EXAMPLE_ID?S.firm:null;
  let hesap=new Map();
  const ALACAK_ANA=new Set(['103','122','129','137','158','199','222','229','237','241','243','244','246','247','248','257','268','278','298','299','302','308','322','337','371','402','408','422','437','501','600','601','602','640','641','642','643','644','645','646','647','648','649','671','679']);
  function yon(kod){const a=String(kod||'').slice(0,3);if(!a)return 'B';if(ALACAK_ANA.has(a))return 'A';const c=a[0];
    if(c==='1'||c==='2'||c==='7')return 'B';if(c==='3'||c==='4'||c==='5')return 'A';
    if(c==='6')return /^6(0|4|7)/.test(a)?'A':'B';return 'B';}
  async function hesaplariYukle(){const f=firma();hesap=new Map();if(f){try{hesap=await HESAP.hesaplar(f);}catch(e){}}
    const dl=$('#fgAccList');if(dl)dl.innerHTML=[...hesap.entries()].sort((a,b)=>a[0].localeCompare(b[0],'tr',{numeric:true})).map(([k,a])=>`<option value="${esc(k)}">${esc(a)}</option>`).join('');}
  const tutar=v=>{if(v==null||v==='')return 0;if(typeof v==='number')return Math.abs(r2(v));const x=parseAmount(v);const n=x&&typeof x==='object'?x.v:x;return n==null||isNaN(n)?0:Math.abs(r2(n));};
  const bicim=v=>{const n=tutar(v);return n?fmt(n):'';};
  function toplam(){let b=0,c=0;for(const x of st.satir){b+=tutar(x.b);c+=tutar(x.c);}return {b:r2(b),c:r2(c),fark:r2(b-c)};}
  function dolu(x){return x.kod||tutar(x.b)||tutar(x.c);}
  // --- fiş ayarları (firmada saklanır): KDV hesapları (oran → 191 / 391), kapat hesabı, kasa hesabı
  function ayar(){const f=firma();return {...(f&&f.fkFisAyar||{})};}
  function kdvBul(grup,oran){const a=ayar();const k=a[`${grup}_${oran}`];if(k)return k;
    const re=new RegExp('(^|[^0-9])%?\\s*'+oran+'(\\s*%|[^0-9]|$)');let en='';
    for(const [kod,ad] of hesap){if(!kod.startsWith(grup+'.'))continue;const n=N(ad);if(/TEVK/.test(n))continue;if(re.test(n.replace(/\s+/g,' ')))if(!en||kod.length<en.length)en=kod;}
    return en;}
  function kasaBul(){const a=ayar();if(a.kasa)return a.kasa;const l=[...hesap.keys()].filter(k=>k.startsWith('100.')).sort((x,y)=>x.length-y.length||x.localeCompare(y,'tr',{numeric:true}));return l.find(k=>![...hesap.keys()].some(o=>o!==k&&o.startsWith(k+'.')))||'';}
  function kapatBul(){return ayar().kapat||'';}
  // --- çizim
  function ciz(odak){
    const P=$('#fgPanel');if(!P)return;const f=firma();
    if(!st.satir.length)st.satir.push(yeniSatir());
    const t=toplam();const denk=Math.abs(t.fark)<0.005&&t.b>0;
    const satirlar=st.satir.filter(dolu);const eksik=satirlar.filter(x=>!x.kod||!hesap.has(x.kod)||!(tutar(x.b)||tutar(x.c)));
    const a=ayar();
    P.innerHTML=`<div class="fg-ust">
        <div style="width:170px"><label class="lbl" for="fgTarih">Fiş tarihi</label><input type="date" id="fgTarih" value="${esc(st.ust.tarih||bugun())}"></div>
        <div style="width:150px"><label class="lbl" for="fgTip">Fiş tipi</label><select id="fgTip">${TIPLER.map(([k,ad])=>`<option value="${k}"${st.ust.tip===k?' selected':''}>${ad}</option>`).join('')}</select></div>
        <div style="flex:1;min-width:260px"><label class="lbl" for="fgAc">Fiş açıklaması</label><input type="text" id="fgAc" value="${esc(st.ust.ac)}" placeholder="örn. Ekim ayı kira tahakkuku"></div>
        <div class="fg-ustbtn">${f?'':`<span class="chip aski">${esc(firmaYokUyari())}</span>`}${f&&!hesap.size?'<span class="chip aski" title="Mizanı ya da hesap planını Luca\'dan çekin">hesap listesi boş</span>':''}<button class="btn small" id="fgKisa" aria-expanded="${st.kisa}" title="Klavye kısayolları">⌨ Kısa Yollar</button><button class="btn small" id="fgAyarBtn" aria-expanded="${st.ayarAcik}" title="KDV, kapat ve kasa hesapları">⚙ Fiş Ayarları</button><button class="btn small" id="fgMini" aria-pressed="${st.mini}" title="Mini hesap planı (Alt+3)">☷ Hesap Planı</button></div>
      </div>
      ${st.kisa?`<div class="fg-kisa"><b>Kısa yollar</b><div class="fg-kisagrid">
        <span><kbd>Enter</kbd></span><span>Sonraki alan; tutardan sonra yeni satır (evrak no, tarih, belge türü, açıklama üst satırdan)</span>
        <span><kbd>F7</kbd> / <kbd>F8</kbd> / <kbd>F9</kbd></span><span>Satırdaki tutardan %1 / %10 / %20 KDV ayır (matrahı küçült, KDV satırı ekle) ve fişi kapat hesabıyla eşitle</span>
        <span><kbd>Alt</kbd>+<kbd>1</kbd></span><span>Üst satırı olduğu gibi kopyala</span>
        <span><kbd>Alt</kbd>+<kbd>2</kbd></span><span>Bulunduğun alanı üst satırdan kopyala</span>
        <span><kbd>Alt</kbd>+<kbd>3</kbd></span><span>Mini hesap planını göster / gizle</span>
        <span><kbd>Alt</kbd>+<kbd>4</kbd></span><span>Evrak no, evrak tarihi ve açıklamayı üst satırdan kopyala</span>
        <span><kbd>Alt</kbd>+<kbd>E</kbd></span><span>Yeni satır ekle</span>
        <span><kbd>Alt</kbd>+<kbd>G</kbd></span><span>Genel bakiyeyi kapat: bu satıra fişi denkleştiren tutarı yaz</span>
        <span><kbd>Alt</kbd>+<kbd>H</kbd></span><span>Hesaba kapat: farkı “kapat hesabı”na yeni satırla yaz</span>
        <span><kbd>Alt</kbd>+<kbd>C</kbd></span><span>Kasayla kapat: farkı 100 kasa hesabına yeni satırla yaz</span>
        <span><kbd>Alt</kbd>+<kbd>M</kbd></span><span>Satırdaki hesabın muavinini aç</span>
        <span><kbd>Alt</kbd>+<kbd>S</kbd></span><span>Bulunduğun satırı sil</span>
        <span><kbd>Alt</kbd>+<kbd>Y</kbd></span><span>Yeni fiş</span>
        <span><kbd>Alt</kbd>+<kbd>K</kbd></span><span>Fişi kaydet ve Luca'ya aktar</span></div></div>`:''}
      ${st.ayarAcik?`<div class="fg-ayar"><b>Fiş ayarları</b> <span class="note">Bu firmada saklanır. Boş bırakılan KDV hesapları mizan / hesap planından oran adına göre bulunur.</span>
        <div class="fg-ayargrid">
          <label class="note">İndirilecek KDV %1 (191)<input class="mono" list="fgAccList" data-fga="191_1" value="${esc(a['191_1']||'')}" placeholder="${esc(kdvBul('191',1)||'191.01')}"></label>
          <label class="note">İndirilecek KDV %10 (191)<input class="mono" list="fgAccList" data-fga="191_10" value="${esc(a['191_10']||'')}" placeholder="${esc(kdvBul('191',10)||'191.10')}"></label>
          <label class="note">İndirilecek KDV %20 (191)<input class="mono" list="fgAccList" data-fga="191_20" value="${esc(a['191_20']||'')}" placeholder="${esc(kdvBul('191',20)||'191.20')}"></label>
          <label class="note">Hesaplanan KDV %1 (391)<input class="mono" list="fgAccList" data-fga="391_1" value="${esc(a['391_1']||'')}" placeholder="${esc(kdvBul('391',1)||'391.01')}"></label>
          <label class="note">Hesaplanan KDV %10 (391)<input class="mono" list="fgAccList" data-fga="391_10" value="${esc(a['391_10']||'')}" placeholder="${esc(kdvBul('391',10)||'391.10')}"></label>
          <label class="note">Hesaplanan KDV %20 (391)<input class="mono" list="fgAccList" data-fga="391_20" value="${esc(a['391_20']||'')}" placeholder="${esc(kdvBul('391',20)||'391.20')}"></label>
          <label class="note">Kapat hesabı (F7–F9, Alt+H)<input class="mono" list="fgAccList" data-fga="kapat" value="${esc(a.kapat||'')}" placeholder="örn. 120.01.001 / 320.01.001"></label>
          <label class="note">Kasa hesabı (Alt+C)<input class="mono" list="fgAccList" data-fga="kasa" value="${esc(a.kasa||'')}" placeholder="${esc(kasaBul()||'100.01')}"></label>
          <div style="grid-column:1/-1;display:flex;gap:10px;flex-wrap:wrap;align-items:end"><span class="note" style="flex-basis:100%">Luca fiş tipi kodları — Mahsup (3) doğrulandı; diğerleri Luca'nız farklı kod kullanıyorsa buradan düzeltin (Ayarlar › Luca İstek Kaydı ile öğrenebilirsiniz).</span>
          ${TIPLER.filter(z=>z[0]!=='3').map(z=>`<label class="note">${z[1]}<input class="mono" data-fga="tip_${z[0]}" value="${esc(a['tip_'+z[0]]||'')}" placeholder="${z[2]}" style="width:60px" maxlength="2"></label>`).join('')}</div>
        </div></div>`:''}
      <div class="fg-govde">
      <div class="mmwrap fg-tabwrap"><table class="fg-tablo tg-yok" id="fgTable"><thead><tr><th style="width:34px">#</th><th style="width:150px">Hesap kodu</th><th>Hesap adı</th><th style="width:110px">Evrak no</th><th style="width:150px">Evrak tarihi</th><th style="width:90px">Belge türü</th><th>Açıklama</th><th class="n" style="width:140px">Borç</th><th class="n" style="width:140px">Alacak</th><th style="width:34px"></th></tr></thead>
      <tbody>${st.satir.map((x,i)=>{const ad=hesap.get(x.kod);
        return `<tr data-i="${i}"><td class="note">${i+1}</td>
          <td><input type="text" class="mono" list="fgAccList" data-fg="kod" data-i="${i}" value="${esc(x.kod)}" autocomplete="off" placeholder="hesap kodu"></td>
          <td class="fg-ad">${x.kod?(ad?esc(ad):'<span style="color:var(--out)">planda yok</span>'):''}</td>
          <td><input type="text" data-fg="evrak" data-i="${i}" value="${esc(x.evrak)}" placeholder="evrak no"></td>
          <td><input type="date" data-notr data-fg="etarih" data-i="${i}" value="${esc(x.etarih)}"></td>
          <td><input type="text" data-fg="bt" data-i="${i}" value="${esc(x.bt)}" placeholder="FT"></td>
          <td><input type="text" data-fg="ac" data-i="${i}" value="${esc(x.ac)}"></td>
          <td><input type="text" class="mono n" data-fg="b" data-i="${i}" value="${esc(bicim(x.b))}" inputmode="decimal" placeholder="0,00"${tutar(x.c)?' readonly title="Alacak dolu; borca yazmak için önce alacağı silin"':''}></td>
          <td><input type="text" class="mono n" data-fg="c" data-i="${i}" value="${esc(bicim(x.c))}" inputmode="decimal" placeholder="0,00"${tutar(x.b)?' readonly title="Borç dolu; alacağa yazmak için önce borcu silin"':''}></td>
          <td><button class="btn small ghost danger" data-fgsil="${i}" title="Satırı sil (Alt+S)" tabindex="-1">✕</button></td></tr>`;}).join('')}</tbody>
      <tfoot><tr><td></td><td colspan="6"><b>Toplam</b> ${denk?'<span class="chip cari">Borç = Alacak</span>':t.b||t.c?`<span class="chip aski">Fark ${fmt(Math.abs(t.fark))} ${t.fark>0?'(alacak eksik)':'(borç eksik)'}</span>`:''}</td><td class="n mono"><b>${fmt(t.b)}</b></td><td class="n mono"><b>${fmt(t.c)}</b></td><td></td></tr></tfoot></table></div>
      ${st.mini?`<aside class="fg-mini"><div class="fg-minibas"><b>Hesap planı</b><button class="btn small ghost" id="fgMiniKapat" title="Gizle (Alt+3)">✕</button></div><input type="search" id="fgMiniQ" placeholder="kod ya da ad" value="${esc(st.miniQ)}">
        <div class="fg-minilist">${(()=>{const q=N(st.miniQ);const l=[...hesap.entries()].filter(([k,ad])=>!q||k.startsWith(st.miniQ.trim())||N(ad).includes(q)).sort((x,y)=>x[0].localeCompare(y[0],'tr',{numeric:true})).slice(0,400);
          return l.map(([k,ad])=>`<div class="fg-minis" data-fgmini="${esc(k)}" title="Satıra yaz"><span class="mono">${esc(k)}</span><span>${esc(ad)}</span></div>`).join('')||'<div class="note" style="padding:10px">Hesap yok</div>';})()}</div></aside>`:''}
      </div>
      <div class="fg-alt"><button class="btn small" id="fgSatir" title="Alt+E">＋ Satır</button><button class="btn small ghost danger" id="fgTemizle" title="Alt+Y">Yeni Fiş</button><button class="btn small" id="fgSablon" title="Sık kullanılan fişleri (kira, maaş, SGK, amortisman…) şablon olarak saklayın; firmaya özeldir">▤ Şablonlar${(f&&(f.fkFisSablon||[]).length)?` <span class="mono">${(f.fkFisSablon||[]).length}</span>`:''}</button>
        <span class="note">${eksik.length?`<span style="color:var(--out)">${eksik.length} satırda hesap ya da tutar eksik / planda yok</span>`:satirlar.length?satirlar.length+' satır':''}</span><span style="flex:1"></span>
        <button class="btn small" id="fgXls" ${denk&&!eksik.length?'':'disabled'} title="Luca'nın Excel'den fiş aktarımı biçiminde dosya">Excel'e Aktar</button>
        <button class="btn primary" id="fgKaydet" ${denk&&!eksik.length&&f?'':'disabled'} title="Alt+K">Fişi Luca'ya Kaydet</button></div>
      ${st.kayitlar.length?`<div class="fg-kayit"><b>Bu oturumda kaydedilen fişler</b>${st.kayitlar.slice().reverse().map(k=>`<div class="note">${esc(k.firma)} · ${esc(dmy(k.tarih))} · ${esc(k.ac||'')} · ${fmt(k.tutar)} TL · <b>Luca fiş ${esc(k.no||'')}</b></div>`).join('')}</div>`:''}
      <datalist id="fgAccList"></datalist>`;
    const dl=$('#fgAccList');if(dl)dl.innerHTML=[...hesap.entries()].sort((a,b)=>a[0].localeCompare(b[0],'tr',{numeric:true})).map(([k,a])=>`<option value="${esc(k)}">${esc(a)}</option>`).join('');
    if(typeof LucaBag!=='undefined')LucaBag.yenile();
    if(odak){const el=P.querySelector(`[data-fg="${odak.c}"][data-i="${odak.i}"]`);if(el){el.focus();if(el.select&&el.type!=='date')el.select();}}
  }
  const dmy=iso=>iso?String(iso).slice(0,10).split('-').reverse().join('.'):'';
  const dmyS=iso=>iso?String(iso).slice(0,10).split('-').reverse().join('/'):'';
  function fis(){const L=st.satir.filter(dolu);const t=toplam();const d=st.ust.tarih||bugun();
    return {year:+String(d).slice(0,4),borc:t.b,alacak:t.c,L,
      json:{fisNo:'1',fisTarihi:dmyS(d),fisAciklama:(st.ust.ac||'').slice(0,200),fisTipi:tipKod(st.ust.tip||'3'),borc:t.b,alacak:t.c,taslakId:'',
        detaylar:L.map(x=>({hesapKodu:x.kod,evrakNo:String(x.evrak||'').slice(0,50),evrakTarihi:dmyS(x.etarih||d),borc:tutar(x.b)||null,alacak:tutar(x.c)||null,miktar:null,belgeTuru:(x.bt||'').trim()||null,doviz:'0',kur:null,dovizTutar:null,detayAciklama:(x.ac||st.ust.ac||'').slice(0,200),tcVergiNo:null}))}};}
  async function kaydet(){
    const f=firma();if(!f){toast(firmaYokUyari()+'.');return;}if(!f.lucaId){toast('Bu firmanın Luca karşılığı yok. Firmayı Luca\'dan ekleyin.');return;}
    const x=fis();const t=toplam();if(!x.L.length||Math.abs(t.fark)>=0.005){toast('Fiş denk değil ya da satır yok.');return;}
    if(x.L.some(l=>!l.kod||!hesap.has(l.kod)||!(tutar(l.b)||tutar(l.c)))){toast('Eksik satır var: hesap ya da tutar boş / planda yok.');return;}
    try{await LucaBag.bekle();}catch(e){toast(clean(e));return;}
    const tipAd=(TIPLER.find(z=>z[0]===st.ust.tip)||TIPLER[0])[1];
    if(!(await askConfirm('Fiş Luca\'ya kaydedilsin mi?',`${f.name} firmasına ${dmy(st.ust.tarih||bugun())} tarihli ${x.L.length} satırlık ${tipAd.toLocaleLowerCase('tr-TR')} fişi kesilecek (borç = alacak = ${fmt(x.borc)} TL).`,'Evet, kaydet')))return;
    try{const p=await mwBusy.run('Luca\'ya kaydediliyor…',f.name,async()=>{const pr=await api.luca.prepareFis({lucaId:f.lucaId,year:x.year});return api.luca.fisKes({donemId:pr.donemId,fis:x.json});});
      if(!p||!p.ok){toast('Kaydedilemedi: '+((p&&p.error)||'Luca hatası'));return;}
      st.kayitlar.push({firma:f.name,tarih:st.ust.tarih||bugun(),ac:st.ust.ac,tutar:x.borc,no:p.fisNo});gunlukYaz('fis',f,{adet:1,tutar:x.borc,ad:`Fiş girişi · ${(st.ust.ac||'').slice(0,60)}`,nolar:[p.fisNo]});
      toast(`Fiş Luca'ya kaydedildi (fiş no ${p.fisNo||'—'}).`);
      yeniFis(false);HESAP.kayitSonrasi(f,{ay:String(st.ust.tarih||bugun()).slice(0,7)});
    }catch(e){toast(clean(e));}
  }
  async function excel(){const x=fis();const d=st.ust.tarih||bugun();const dt=new Date(d+'T00:00:00');
    const lines=x.L.map(L=>({fis:1,date:dt,fdesc:st.ust.ac||'',acc:L.kod,doc:L.evrak||'',docDate:L.etarih?new Date(L.etarih+'T00:00:00'):dt,desc:L.ac||st.ust.ac||'',b:tutar(L.b),c:tutar(L.c),bt:(L.bt||'').trim()}));
    const ad=`${(firma()||{}).name||'firma'}_fis_${d}.xlsx`.replace(/[^\wÇĞİÖŞÜçğıöşü.-]+/g,'_');
    try{const r=await api.saveFile(ad,new Uint8Array(makeWorkbook(lines)));if(r.ok)toast('Luca fiş aktarım dosyası kaydedildi: '+r.path);}catch(e){toast(clean(e));}}
  function yeniFis(sor){const tr=st.ust.tarih;st.satir=[];st.ust={tarih:tr,ac:'',tip:'3'};ciz({c:'kod',i:0});}
  /* ---- Fiş şablonları (firmaya özel): mevcut fişi şablon yap / şablondan doldur / sil ---- */
  async function sablonMenu(){
    const f=firma();if(!f){toast(firmaYokUyari()+'.');return;}const L=(f.fkFisSablon||[]);
    const dolu=st.satir.some(x=>x.kod);
    const sec=await Desk.choose('Fiş şablonları',L.length?`${f.name} için ${L.length} şablon. Şablon seçince tutarlar şablondaki gibi gelir; tarih bugünün tarihi olur.`:'Henüz şablon yok. Fişi doldurup "Bu fişi şablon yap" ile saklayın.',
      [...L.map((x,i)=>({label:`${x.ad} · ${x.satir.length} satır`,value:'ac:'+i})),...(dolu?[{label:'＋ Bu fişi şablon yap',value:'kaydet',primary:true}]:[]),...(L.length?[{label:'Şablon sil…',value:'sil'}]:[])]);
    if(!sec)return;
    if(sec==='kaydet'){const ad=await askText('Şablon adı','Örn. Aylık kira, SGK tahakkuku',st.ust.ac||'');if(!ad)return;
      const y=[...L.filter(x=>x.ad!==ad),{ad,ust:{ac:st.ust.ac,tip:st.ust.tip},satir:st.satir.filter(x=>x.kod).map(x=>({kod:x.kod,bt:x.bt||'',ac:x.ac||'',b:x.b||'',c:x.c||''}))}];
      S.firm={...f,fkFisSablon:y};await Store.saveFirm(S.firm);toast(`"${ad}" şablonu kaydedildi.`);ciz();return;}
    if(sec==='sil'){const h=await Desk.choose('Hangi şablon silinsin?','',L.map((x,i)=>({label:x.ad,value:i})));if(h==null)return;
      S.firm={...f,fkFisSablon:L.filter((x,i)=>i!==h)};await Store.saveFirm(S.firm);toast('Şablon silindi.');ciz();return;}
    if(String(sec).startsWith('ac:')){const x=L[+sec.slice(3)];if(!x)return;if(dolu&&!(await askConfirm('Fiş şablondan doldurulsun mu?','Ekrandaki satırlar silinir ve şablon satırları gelir.','Evet, doldur')))return;
      const tr=st.ust.tarih||bugun();st.ust={tarih:tr,ac:x.ust.ac||'',tip:x.ust.tip||'3'};st.satir=x.satir.map(s=>({...yeniSatir({...s,evrak:'',etarih:tr}),kod:s.kod,b:s.b||'',c:s.c||''}));ciz({c:'b',i:0});toast(`"${x.ad}" şablonu yüklendi — tutarları kontrol edin.`);}
  }
  // --- Enter akışı: kod → evrak no → evrak tarihi → belge türü → açıklama → borç / alacak → yeni satır
  function ileri(i,c){const x=st.satir[i];
    if(c==='kod'){if(!x.kod)return;return {i,c:'evrak'};}
    if(c==='evrak')return {i,c:'etarih'};
    if(c==='etarih')return {i,c:'bt'};
    if(c==='bt')return {i,c:'ac'};
    if(c==='ac')return {i,c:yon(x.kod)==='A'?'c':'b'};
    if(c==='b'&&!tutar(x.b)&&!tutar(x.c))return {i,c:'c'};
    if(c==='c'&&!tutar(x.c)&&!tutar(x.b))return {i,c:'b'};
    if(i===st.satir.length-1)st.satir.push(yeniSatir(x));
    return {i:i+1,c:'kod'};}
  function oku(t){const i=+t.dataset.i,c=t.dataset.fg;const x=st.satir[i];if(!x)return;
    if(c==='b'||c==='c'){const n=tutar(t.value);const diger=c==='b'?'c':'b';if(n&&tutar(x[diger])){toast(diger==='c'?'Alacak dolu; borca yazmak için önce alacağı silin.':'Borç dolu; alacağa yazmak için önce borcu silin.');return;}x[c]=n||'';}
    else x[c]=c==='kod'?t.value.trim():t.value;}
  // --- kısayol işlemleri
  function farkDisinda(i){let b=0,c=0;st.satir.forEach((y,j)=>{if(j===i)return;b+=tutar(y.b);c+=tutar(y.c);});return r2(b-c);}
  function genelKapat(i){const x=st.satir[i];if(!x)return;const fark=farkDisinda(i);if(Math.abs(fark)<0.005){toast('Fiş zaten denk.');return;}
    if(fark>0){x.c=fark;x.b='';}else{x.b=-fark;x.c='';}ciz({c:fark>0?'c':'b',i});toast('Denkleştirme tutarı yazıldı: '+fmt(Math.abs(fark)));}
  function hesabaKapat(kod,etiket){const t=toplam();if(Math.abs(t.fark)<0.005){toast('Fiş zaten denk.');return;}if(!kod){toast(etiket+' tanımlı değil — Fiş Ayarları\'ndan seçin.');st.ayarAcik=true;ciz();return;}
    const son=st.satir[st.satir.length-1];const y=yeniSatir(son);y.kod=kod;if(t.fark>0)y.c=t.fark;else y.b=-t.fark;
    if(son&&!dolu(son))st.satir[st.satir.length-1]=y;else st.satir.push(y);
    ciz({c:'kod',i:st.satir.length-1});toast(`${etiket} ${kod} ile kapatıldı: ${fmt(Math.abs(t.fark))}`);}
  function kdvAyir(i,oran){const x=st.satir[i];if(!x||!x.kod){toast('Önce satıra hesap ve tutar girin.');return;}
    const T=tutar(x.b)||tutar(x.c);if(!T){toast('Satırda tutar yok.');return;}
    const borcta=!!tutar(x.b);const grup=borcta?'191':'391';const kdvKod=kdvBul(grup,oran);
    if(!kdvKod){toast(`%${oran} KDV hesabı (${grup}) bulunamadı — Fiş Ayarları'ndan seçin.`);st.ayarAcik=true;ciz();return;}
    const matrah=r2(T/(1+oran/100));const kdv=r2(T-matrah);
    if(borcta)x.b=matrah;else x.c=matrah;
    const k=yeniSatir(x);k.kod=kdvKod;if(borcta)k.b=kdv;else k.c=kdv;k.ac=x.ac||st.ust.ac;
    st.satir.splice(i+1,0,k);
    const kapat=kapatBul();const t=toplam();
    if(kapat&&Math.abs(t.fark)>=0.005){const y=yeniSatir(x);y.kod=kapat;if(t.fark>0)y.c=t.fark;else y.b=-t.fark;st.satir.splice(i+2,0,y);}
    st.satir=st.satir.filter((s,j)=>dolu(s)||j===st.satir.length-1);
    ciz({c:'kod',i:Math.min(i+(kapat?3:2),st.satir.length-1)});
    toast(`%${oran} KDV ayrıldı: matrah ${fmt(matrah)} · KDV ${fmt(kdv)} → ${kdvKod}${kapat?' · kapat: '+kapat:' · kapat hesabı tanımlı değil (Fiş Ayarları)'}`);}
  function ustKopyala(i,alan){if(i<1){toast('Üst satır yok.');return;}const u=st.satir[i-1],x=st.satir[i];
    if(alan==='hepsi'){Object.assign(x,{kod:u.kod,evrak:u.evrak,etarih:u.etarih,bt:u.bt,ac:u.ac,b:u.b,c:u.c});}
    else if(alan==='evrak3'){x.evrak=u.evrak;x.etarih=u.etarih;x.ac=u.ac;}
    else x[alan]=u[alan];}
  function muavinAc(kod){if(!kod){toast('Satırda hesap kodu yok.');return;}
    if(typeof MMUI==='undefined')return;MMUI.open('muavin');setTimeout(()=>{const q=$('#mmQ');if(q){q.value=kod;q.dispatchEvent(new Event('input',{bubbles:true}));}},900);}
  document.addEventListener('keydown',async e=>{const P=$('#fgPanel');if(!P||P.hidden)return;const t=e.target;
    const icerde=!!(t&&t.closest&&t.closest('#fgPanel'));
    if(!icerde){if(t&&(t.tagName==='INPUT'||t.tagName==='TEXTAREA'||t.tagName==='SELECT')&&!(e.altKey||/^F[789]$/.test(e.key)))return;    // başka bir kutuda yazılıyor
      if(!e.altKey&&!/^F[789]$/.test(e.key))return;}                                                                                 // panel dışında yalnız kısayollar
    const icKutu=icerde&&t.dataset&&t.dataset.fg;
    const i=icKutu&&t.dataset.i!=null?+t.dataset.i:(sonOdak?Math.min(sonOdak.i,st.satir.length-1):st.satir.length-1),c=icKutu?t.dataset.fg:'';
    if(!c&&e.key==='Enter')return;
    // F7 / F8 / F9: KDV ayır
    if(e.key==='F7'||e.key==='F8'||e.key==='F9'){e.preventDefault();e.stopPropagation();if(c)oku(t);kdvAyir(i,e.key==='F7'?1:e.key==='F8'?10:20);return;}
    if(e.altKey&&!e.ctrlKey){const k=(e.key||'').toLowerCase();const code=e.code||'';
      const is=(ch,cd)=>{const h=k===ch||code===cd;if(h){e.preventDefault();e.stopPropagation();}return h;};
      if(is('1','Digit1')){e.preventDefault();if(c)oku(t);ustKopyala(i,'hepsi');ciz({c:c||'kod',i});return;}
      if(is('2','Digit2')){e.preventDefault();if(c)oku(t);ustKopyala(i,c||'ac');ciz({c:c||'kod',i});return;}
      if(is('3','Digit3')){e.preventDefault();if(c)oku(t);st.mini=!st.mini;ciz({c:c||'kod',i});return;}
      if(is('4','Digit4')){e.preventDefault();if(c)oku(t);ustKopyala(i,'evrak3');ciz({c:c||'kod',i});return;}
      if(is('e','KeyE')){e.preventDefault();if(c)oku(t);const s=st.satir[st.satir.length-1];st.satir.push(yeniSatir(s));ciz({c:'kod',i:st.satir.length-1});return;}
      if(is('g','KeyG')){e.preventDefault();if(c)oku(t);genelKapat(i);return;}
      if(is('h','KeyH')){e.preventDefault();if(c)oku(t);hesabaKapat(kapatBul(),'Kapat hesabı');return;}
      if(is('c','KeyC')){e.preventDefault();if(c)oku(t);hesabaKapat(kasaBul(),'Kasa');return;}
      if(is('m','KeyM')){e.preventDefault();if(c)oku(t);muavinAc((st.satir[i]||{}).kod);return;}
      if(is('s','KeyS')){e.preventDefault();if(st.satir.length){st.satir.splice(i,1);ciz({c:'kod',i:Math.max(0,Math.min(i,st.satir.length-1))});}return;}
      if(is('y','KeyY')){e.preventDefault();if(st.satir.some(dolu)&&!(await askConfirm('Yeni fiş','Girilen satırlar silinecek. Yeni fişe geçilsin mi?','Evet, yeni fiş')))return;yeniFis();return;}
      if(is('k','KeyK')){e.preventDefault();if(c)oku(t);ciz();kaydet();return;}
    }
    if(e.key!=='Enter'||!c)return;
    e.preventDefault();
    setTimeout(async()=>{oku(t);const x=st.satir[i];
      if(c==='kod'&&x&&x.kod&&!hesap.has(x.kod)&&/^\d{3}(\.[0-9A-Za-zÇĞİÖŞÜçğıöşü]+)*$/.test(x.kod)&&firma()&&firma().lucaId){
        await HESAP.sor(x.kod,x.ac||st.ust.ac||'');await hesaplariYukle();if(!hesap.has(x.kod)){ciz({c:'kod',i});return;}}
      const n=ileri(i,c);if(!n)return;ciz(n);},0);});
  document.addEventListener('change',async e=>{const t=e.target;if(!t.closest||!t.closest('#fgPanel'))return;
    if(t.id==='fgTarih'){const eski=st.ust.tarih;st.ust.tarih=t.value;for(const x of st.satir)if(!x.etarih||x.etarih===eski)x.etarih=t.value;ciz();return;}
    if(t.id==='fgTip'){st.ust.tip=t.value;return;}
    if(t.id==='fgAc'){const eski=st.ust.ac;st.ust.ac=t.value;for(const x of st.satir)if(!x.ac||x.ac===eski)x.ac=t.value;ciz();return;}
    if(t.dataset.fga){const f=firma();if(!f)return;const y={...(f.fkFisAyar||{})};y[t.dataset.fga]=t.value.trim();S.firm={...f,fkFisAyar:y};await Store.saveFirm(S.firm);toast('Fiş ayarı kaydedildi.');return;}
    if(t.dataset.fg){oku(t);const a=document.activeElement;const k=a&&a.dataset&&a.dataset.fg?{c:a.dataset.fg,i:+a.dataset.i}:null;ciz(k);}});
  document.addEventListener('input',e=>{const t=e.target;if(t.id==='fgMiniQ'){st.miniQ=t.value;const el=$('#fgPanel .fg-minilist');if(!el)return;const q=N(st.miniQ);
    const l=[...hesap.entries()].filter(([k,ad])=>!q||k.startsWith(st.miniQ.trim())||N(ad).includes(q)).sort((x,y)=>x[0].localeCompare(y[0],'tr',{numeric:true})).slice(0,400);
    el.innerHTML=l.map(([k,ad])=>`<div class="fg-minis" data-fgmini="${esc(k)}"><span class="mono">${esc(k)}</span><span>${esc(ad)}</span></div>`).join('')||'<div class="note" style="padding:10px">Hesap yok</div>';}});
  document.addEventListener('focusin',e=>{const t=e.target;if(t.dataset&&t.dataset.fg&&t.closest('#fgPanel'))sonOdak={c:t.dataset.fg,i:+t.dataset.i};});
  document.addEventListener('click',async e=>{const t=e.target;if(!t.closest||!t.closest('#fgPanel'))return;
    const sl=t.closest('[data-fgsil]');if(sl){st.satir.splice(+sl.dataset.fgsil,1);ciz();return;}
    const mn=t.closest('[data-fgmini]');if(mn){const o=sonOdak||{c:'kod',i:st.satir.length-1};const x=st.satir[o.i]||st.satir[st.satir.length-1];x.kod=mn.dataset.fgmini;ciz({c:'evrak',i:st.satir.indexOf(x)});return;}
    if(t.id==='fgSatir'){const s=st.satir[st.satir.length-1];st.satir.push(yeniSatir(s));ciz({c:'kod',i:st.satir.length-1});return;}
    if(t.id==='fgTemizle'){if(st.satir.some(dolu)&&!(await askConfirm('Yeni fiş','Girilen satırlar silinecek. Yeni fişe geçilsin mi?','Evet, yeni fiş')))return;yeniFis();return;}
    if(t.id==='fgKisa'){st.kisa=!st.kisa;ciz();return;}
    if(t.id==='fgSablon'){sablonMenu();return;}
    if(t.id==='fgAyarBtn'){st.ayarAcik=!st.ayarAcik;ciz();return;}
    if(t.id==='fgMini'||t.id==='fgMiniKapat'){st.mini=!st.mini;ciz();return;}
    if(t.id==='fgXls'){excel();return;}
    if(t.id==='fgKaydet'){kaydet();return;}});
  async function show(){const P=$('#fgPanel');if(!P)return;P.hidden=false;if(!st.ust.tarih)st.ust.tarih=bugun();await hesaplariYukle();ciz();try{const a=document.activeElement;if(a&&a.closest&&a.closest('#fgPanel'))a.blur();}catch(e){}}   // açılınca hiçbir kutu seçili gelmez (hesap listesi açılmaz); fişe tarihten başlanır
  async function firmaDegisti(){const P=$('#fgPanel');if(!P||P.hidden)return;await hesaplariYukle();ciz();}
  firmaDinle(firmaDegisti);
  return {show,firmaDegisti,_st:st,_yon:yon,_fis:fis,_firma:firma,_kdvAyir:kdvAyir,_toplam:toplam,_yenile:async()=>{await hesaplariYukle();ciz();}};
})();
window.__fisg=FISG;
/* ---------- Muhasebe İşlemleri › Fiş Listesi: firmanın yıllık muavininden fişler (tarih sırasıyla); tıklayınca içerik ---------- */
// firmanın muavin dosyalarını birleştir: en son indirilen önce; daha eski bir dosyadan yalnız yeni dosyaların kapsamadığı ayların satırları alınır
async function muavinDosyaBirlestir(dosyalar,cache){const api=window.desktop.fk;cache=cache||{};
  const L=[...dosyalar].sort((a,b)=>String(b.zaman||'').localeCompare(String(a.zaman||'')));const ms=[];
  for(const d of L){const k=d.id+'@'+(d.zaman||'');let m=cache[k];if(!m){m=await api.muavinGet(d.id);cache[k]=m;}ms.push(m);}
  if(ms.length===1)return {...ms[0],satirlar:ms[0].satirlar.slice()};
  const kapsanan=new Set(),out=[];
  for(const m of ms){const aylar=new Set();for(const r of m.satirlar){const a=String(r.tarih||'').slice(0,7);if(kapsanan.has(a))continue;out.push(r);aylar.add(a);}for(const a of aylar)kapsanan.add(a);}
  out.sort((a,b)=>String(a.tarih||'').localeCompare(String(b.tarih||'')));
  return {firma:ms[0].firma,satirlar:out,birlesik:ms.length};}
const FISL=(()=>{
  const st={fid:'',donem:null,m:null,fisler:[],bas:'',bit:'',q:'',tip:'',sec:null,sort:{k:'tarih',d:1},yukleniyor:false,hata:''};
  const firma=()=>S.firm&&S.firm.id!==EXAMPLE_ID?S.firm:null;
  const trd=x=>x?String(x).slice(0,10).split('-').reverse().join('.'):'';
  const n2=v=>v==null||v===''?'':Number(v).toLocaleString('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:2});
  const TIP_AD={'1':'Tahsil','2':'Tediye','3':'Mahsup','4':'Açılış','5':'Kapanış'};
  async function yukle(zorla){
    const f=firma();const P=$('#flPanel');if(!P||P.hidden)return;
    if(!f){st.fisler=[];st.m=null;st.hata=firmaYokUyari()+'.';ciz();return;}
    st.yukleniyor=true;st.hata='';ciz();
    try{const api=window.desktop.fk;const ds=((await api.muavinList()).donemler||[]).filter(d=>(f.lucaId&&String(d.luca_id||'')===String(f.lucaId))||N(d.firma)===N(f.name)).sort((a,b)=>String(b.zaman||'').localeCompare(String(a.zaman||'')));
      if(!ds.length){st.fisler=[];st.m=null;st.hata=`${f.name} için indirilmiş muavin yok. Muavin sekmesinden ya da aşağıdaki düğmeyle Luca'dan çekin.`;}
      else{const anahtar=ds.map(d=>d.id+'@'+(d.zaman||'')).join('|');if(zorla||!st.m||st.donem!==anahtar||st.fid!==f.id){st.m=await muavinDosyaBirlestir(ds,zorla?{}:(st.cache=st.cache||{}));st.donem=anahtar;st.fid=f.id;st.zaman=ds[0].zaman;}
        st.fisler=fisGrupla(st.m.satirlar);}
    }catch(e){st.hata=clean(e);st.fisler=[];}
    st.yukleniyor=false;ciz();
  }
  function gorunen(){const q=N(st.q);let l=st.fisler.filter(x=>(!st.bas||String(x.tarih||'')>=st.bas)&&(!st.bit||String(x.tarih||'')<=st.bit)&&(!st.tip||String(x.tip)===st.tip||TIP_AD[String(x.tip)]===st.tip)
      &&(!q||N([x.no,x.ac,x.hesaplar.join(' '),...x.satir.map(s=>s.aciklama+' '+(s.belge_no||'')+' '+s.hesap_adi)].join(' ')).includes(q)));
    const {k,d}=st.sort;l.sort((a,b)=>{const x=a[k],y=b[k];const c=(k==='borc'||k==='alacak'||k==='n')?(+x||0)-(+y||0):k==='no'?String(x).localeCompare(String(y),'tr',{numeric:true}):String(x??'').localeCompare(String(y??''),'tr',{numeric:true});return d*c||String(a.tarih).localeCompare(String(b.tarih))||String(a.no).localeCompare(String(b.no),'tr',{numeric:true});});
    return l;}
  const PARCA=300;let dahaGoz=null;
  const dengesiz=x=>x.denk?'':`<span class="chip aski" title="Borç ${n2(x.borc)} ≠ Alacak ${n2(x.alacak)}: muavinde bu fişin bazı satırları eksik olabilir">dengesiz</span> `;
  // fiş açıkken liste dar (ekranın %30'u): tarih · no · tip üstte, açıklama altta, tutar sağda
  const satirHtml=x=>st.sec?`<tr data-fl="${esc(x.k)}" class="${st.sec===x.k?'sec':''}" style="cursor:pointer"><td><div class="fl-ust1"><span class="mono">${esc(trd(x.tarih))}</span> · <b class="mono">${esc(x.no)}</b> · ${esc(TIP_AD[String(x.tip)]||x.tip)}</div><div class="fl-ac2" title="${esc(x.ac||'')}">${dengesiz(x)}${esc(x.ac||'')}</div></td><td class="n mono">${n2(x.borc)}</td></tr>`
    :`<tr data-fl="${esc(x.k)}" style="cursor:pointer"><td class="mono">${esc(trd(x.tarih))}</td><td class="mono">${esc(x.no)}</td><td>${esc(TIP_AD[String(x.tip)]||x.tip)}</td><td class="fl-ac" title="${esc(x.ac||'')}">${dengesiz(x)}${esc(x.ac||'')}</td><td class="n">${x.n}</td><td class="n mono">${n2(x.borc)}</td><td class="n mono">${n2(x.alacak)}</td></tr>`;
  function dahaKur(l){const T=$('#flTable');const tb=T&&T.tBodies[0];if(!tb||l.length<=PARCA)return;let i=PARCA;
    const sent=document.createElement('tr');sent.className='mm-daha';sent.innerHTML=`<td colspan="7" class="note" style="text-align:center;padding:10px">${l.length-i} fiş daha — aşağı kaydırınca yüklenir · <button class="btn small ghost" data-fltumu="1">Tümünü göster</button></td>`;tb.appendChild(sent);
    const ekle=n=>{const parca=l.slice(i,i+n);i+=parca.length;sent.insertAdjacentHTML('beforebegin',parca.map(satirHtml).join(''));if(i>=l.length){sent.remove();if(dahaGoz){dahaGoz.disconnect();dahaGoz=null;}}else sent.firstElementChild.firstChild.textContent=`${l.length-i} fiş daha — aşağı kaydırınca yüklenir · `;};
    sent.addEventListener('click',e=>{if(e.target.closest('[data-fltumu]')){e.stopPropagation();ekle(l.length);}});
    if(dahaGoz)dahaGoz.disconnect();dahaGoz=new IntersectionObserver(es=>{if(es.some(x=>x.isIntersecting))ekle(PARCA);},{rootMargin:'400px'});dahaGoz.observe(sent);}
  function ciz(){
    const P=$('#flPanel');if(!P)return;const f=firma();const l=gorunen();const sec=st.sec?st.fisler.find(x=>x.k===st.sec):null;
    const tipler=[...new Set(st.fisler.map(x=>String(x.tip)))].filter(Boolean);
    const ok=(k)=>st.sort.k===k?(st.sort.d>0?'▲':'▼'):'↕';
    P.innerHTML=`<div class="fl-ust">
        <label class="note">Tarih <input type="date" id="flBas" value="${esc(st.bas)}"> – <input type="date" id="flBit" value="${esc(st.bit)}"></label>
        <label class="note">Tip <select id="flTip"><option value="">Tümü</option>${tipler.map(t=>`<option value="${esc(t)}"${st.tip===t?' selected':''}>${esc(TIP_AD[t]||t)}</option>`).join('')}</select></label>
        <input type="search" id="flQ" placeholder="Fiş no, açıklama, hesap, belge ara" value="${esc(st.q)}" style="min-width:260px">
        <span class="note">${st.yukleniyor?'Yükleniyor…':st.m?`${esc(st.m.firma||f.name)} · ${st.fisler.length} fiş${l.length!==st.fisler.length?` · görünen ${l.length}`:''} · muavin ${st.zaman?new Date(st.zaman).toLocaleString('tr-TR',{dateStyle:'short',timeStyle:'short'}):''}`:''}</span>
        <span style="flex:1"></span><button class="btn small" id="flYenile" title="Firmanın yıllık muavinini Luca'dan yeniden indirir; bitince liste güncellenir">Muavini Luca'dan Çek</button><button class="btn small" id="flXls" ${l.length?'':'disabled'}>Listeyi Excel'e Aktar</button></div>
      ${st.hata?`<div class="banner" style="margin:0 0 8px">${esc(st.hata)}</div>`:''}
      <div class="fl-govde${sec?' bol':''}">
      <div class="mmwrap fl-liste"><table class="tg-yok" id="flTable">${sec?'<colgroup><col><col style="width:92px"></colgroup>':'<colgroup><col style="width:86px"><col style="width:70px"><col style="width:70px"><col><col style="width:48px"><col style="width:110px"><col style="width:110px"></colgroup>'}<thead><tr>${(sec?[['tarih','Tarih · Fiş · Açıklama'],['borc','Tutar']]:[['tarih','Tarih'],['no','Fiş No'],['tip','Tip'],['ac','Açıklama'],['n','Satır'],['borc','Borç'],['alacak','Alacak']]).map(([k,a])=>`<th class="${k==='borc'||k==='alacak'||k==='n'?'n':''}" data-flsort="${k}" style="cursor:pointer;white-space:nowrap">${a} <span class="note">${ok(k)}</span></th>`).join('')}</tr></thead>
        <tbody>${l.slice(0,PARCA).map(satirHtml).join('')||`<tr><td colspan="${sec?2:7}" class="bosliste">${st.yukleniyor?'Yükleniyor…':'Bu tarih aralığında fiş yok. Tarih aralığını genişletin ya da muavini Luca\'dan çekin.'}</td></tr>`}</tbody>
        ${l.length?(sec?`<tfoot><tr><td><b>Toplam</b> · ${l.length} fiş</td><td class="n mono"><b>${n2(l.reduce((t,x)=>t+x.borc,0))}</b></td></tr></tfoot>`:`<tfoot><tr><td colspan="4"><b>Toplam</b> · ${l.length} fiş</td><td class="n">${l.reduce((t,x)=>t+x.n,0)}</td><td class="n mono"><b>${n2(l.reduce((t,x)=>t+x.borc,0))}</b></td><td class="n mono"><b>${n2(l.reduce((t,x)=>t+x.alacak,0))}</b></td></tr></tfoot>`):''}</table>
        </div>
      ${sec?`<aside class="fl-detay"><div class="fl-detaybas"><b>Fiş ${esc(sec.no)}</b> · ${esc(TIP_AD[String(sec.tip)]||sec.tip)} · ${esc(trd(sec.tarih))}<span style="flex:1"></span>${f&&f.lucaId?`<button class="btn small" id="flLuca" title="Luca'da firma ve dönemi seçip pencereyi açar; fiş numarası panoya kopyalanır (Luca › Fiş İşlemleri › Fiş Ara)">Luca'da Aç</button>`:''}<button class="btn small" id="flPdf">PDF Yazdır</button><button class="btn small" id="flFisXls">Excel</button><button class="btn small ghost" id="flKapat">✕</button></div>
        <div class="note" style="margin:0 0 6px">${esc(sec.ac||'')}</div>
        <div class="mmwrap"><table class="mini fl-fis"><colgroup><col style="width:28%"><col><col style="width:13%"><col style="width:12.5%"><col style="width:12.5%"></colgroup><thead><tr><th>Hesap</th><th>Açıklama</th><th>Belge</th><th class="n">Borç</th><th class="n">Alacak</th></tr></thead>
        <tbody>${sec.satir.slice().sort((a,b)=>((+b.borc>0)-(+a.borc>0))||a.hesap_kodu.localeCompare(b.hesap_kodu,'tr',{numeric:true})).map(s=>`<tr><td><b class="mono">${esc(s.hesap_kodu)}</b><div class="fl-had">${esc(s.hesap_adi)}</div></td><td>${esc(s.aciklama||'')}</td><td class="mono">${esc(s.belge_no||'')}${s.belge_tarihi?`<div class="note">${esc(trd(s.belge_tarihi))}</div>`:''}</td><td class="n mono">${+s.borc?n2(s.borc):''}</td><td class="n mono">${+s.alacak?n2(s.alacak):''}</td></tr>`).join('')}</tbody>
        <tfoot><tr><td colspan="3"><b>Toplam</b> ${Math.abs(sec.borc-sec.alacak)<0.005?'<span class="chip cari">denk</span>':`<span class="chip aski">fark ${n2(Math.abs(sec.borc-sec.alacak))}</span>`}</td><td class="n mono"><b>${n2(sec.borc)}</b></td><td class="n mono"><b>${n2(sec.alacak)}</b></td></tr></tfoot></table></div></aside>`:''}
      </div>`;
    dahaKur(l);
  }
  function fisHtml(sec,f){const e=esc;const rows=sec.satir.slice().sort((a,b)=>((+b.borc>0)-(+a.borc>0))||a.hesap_kodu.localeCompare(b.hesap_kodu,'tr',{numeric:true}));
    return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><style>body{font:11.5px/1.35 "Segoe UI",Arial,sans-serif;color:#111;margin:0;padding:18px}h1{font-size:16px;margin:0 0 2px}.alt{color:#555;margin:0 0 10px}table{width:100%;border-collapse:collapse}th{background:#eef2f7;text-align:left;border-bottom:1px solid #999;padding:4px 6px}td{border-bottom:1px solid #ddd;padding:3px 6px;vertical-align:top}td.n,th.n{text-align:right;white-space:nowrap}tfoot td{font-weight:700;border-top:1px solid #999}.kod{font-family:Consolas,monospace}</style></head><body>
      <h1>Fiş ${e(sec.no)} · ${e(TIP_AD[String(sec.tip)]||sec.tip)} · ${e(trd(sec.tarih))}</h1><p class="alt">${e(f?f.name:'')}${sec.ac?' · '+e(sec.ac):''}</p>
      <table><thead><tr><th>Hesap Kodu</th><th>Hesap Adı</th><th>Açıklama</th><th>Belge No</th><th class="n">Borç</th><th class="n">Alacak</th></tr></thead>
      <tbody>${rows.map(s=>`<tr><td class="kod">${e(s.hesap_kodu)}</td><td>${e(s.hesap_adi)}</td><td>${e(s.aciklama||'')}</td><td class="kod">${e(s.belge_no||'')}</td><td class="n">${+s.borc?n2(s.borc):''}</td><td class="n">${+s.alacak?n2(s.alacak):''}</td></tr>`).join('')}</tbody>
      <tfoot><tr><td colspan="4">Toplam</td><td class="n">${n2(sec.borc)}</td><td class="n">${n2(sec.alacak)}</td></tr></tfoot></table><p class="alt" style="margin-top:10px;font-size:9px">MuhaWin · ${e(new Date().toLocaleString('tr-TR'))}</p></body></html>`;}
  document.addEventListener('click',async e=>{const t=e.target;if(!t.closest||!t.closest('#flPanel'))return;const f=firma();
    const th=t.closest('[data-flsort]');if(th){const k=th.dataset.flsort;st.sort=st.sort.k===k?{k,d:-st.sort.d}:{k,d:1};ciz();return;}
    const tr=t.closest('tr[data-fl]');if(tr){st.sec=st.sec===tr.dataset.fl?null:tr.dataset.fl;ciz();return;}
    if(t.id==='flKapat'){st.sec=null;ciz();return;}
    if(t.id==='flLuca'){const sec=st.sec?st.fisler.find(x=>x.k===st.sec):null;if(!sec||!f||!f.lucaId)return;
      try{await LucaBag.bekle();const yil=String(sec.tarih||'').slice(0,4)||String(new Date().getFullYear());
        try{await mwBusy.run('Luca\'da fiş açılıyor…',f.name+' · '+yil+' · Fiş '+sec.no,()=>window.__mwApi.luca.fisGoster({lucaId:f.lucaId,year:yil,fisNo:String(sec.no)}));
          toast(`Luca'da Fiş Listesi ${sec.no} numaralı fişle açıldı.`);return;}
        catch(x){toast(clean(x));}                      // süzgeç açılamadıysa eski yol: firma / dönem seçilir, numara panoya
        await mwBusy.run('Luca\'da firma ve dönem seçiliyor…',f.name+' · '+yil,()=>window.__mwApi.luca.prepareFis({lucaId:f.lucaId,year:yil}));
        try{await navigator.clipboard.writeText(String(sec.no));}catch(x){}
        await window.__mwApi.luca.open();toast(`Luca penceresi açıldı (${f.name} · ${yil}). Fiş İşlemleri › Fiş Ara'da ${sec.no} numaralı fişi açın — numara panoya kopyalandı. Luca'nın fiş sayfası doğrudan adreslenemediği için aramayı siz yaparsınız.`);}
      catch(x){toast(clean(x));}return;}
    if(t.id==='flYenile'){if(!f||!f.lucaId){toast('Firmanın Luca karşılığı yok.');return;}HESAP.kayitSonrasi(f,{mizan:false,muavin:true,plan:false,sonra:()=>yukle(true)});toast(`${f.name}: muavin arka planda Luca'dan indiriliyor (yalnız muavin); bitince Fiş Listesi kendiliğinden yenilenir.`);return;}
    const sec=st.sec?st.fisler.find(x=>x.k===st.sec):null;
    if(t.id==='flPdf'&&sec){try{await mwBusy.run('PDF hazırlanıyor…','Fiş '+sec.no,()=>window.desktop.htmlPdf({html:fisHtml(sec,f),ad:'Fis_'+sec.no+'_'+trd(sec.tarih)}));}catch(x){toast(clean(x));}return;}
    if(t.id==='flFisXls'&&sec){const aoa=[[`Fiş ${sec.no} · ${TIP_AD[String(sec.tip)]||sec.tip} · ${trd(sec.tarih)}`],[f?f.name:''],[],['Hesap Kodu','Hesap Adı','Açıklama','Belge No','Borç','Alacak'],...sec.satir.map(s=>[s.hesap_kodu,s.hesap_adi,s.aciklama||'',s.belge_no||'',+s.borc||0,+s.alacak||0]),['','','','Toplam',sec.borc,sec.alacak]];
      const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(aoa),'Fiş');try{const r=await window.desktop.saveFile(('Fis_'+sec.no+'_'+trd(sec.tarih)).replace(/[^\wÇĞİÖŞÜçğıöşü.-]+/g,'_')+'.xlsx',new Uint8Array(XLSX.write(wb,{type:'array',bookType:'xlsx'})));if(r.ok)toast('Kaydedildi: '+r.path);}catch(x){toast(clean(x));}return;}
    if(t.id==='flXls'){const l=gorunen();const aoa=[['Tarih','Fiş No','Tip','Açıklama','Hesaplar','Satır','Borç','Alacak'],...l.map(x=>[trd(x.tarih),x.no,TIP_AD[String(x.tip)]||x.tip,x.ac||'',x.hesaplar.join(', '),x.n,x.borc,x.alacak])];
      const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(aoa),'Fiş Listesi');try{const r=await window.desktop.saveFile(((f?f.name:'firma')+'_fis_listesi').replace(/[^\wÇĞİÖŞÜçğıöşü.-]+/g,'_')+'.xlsx',new Uint8Array(XLSX.write(wb,{type:'array',bookType:'xlsx'})));if(r.ok)toast('Kaydedildi: '+r.path);}catch(x){toast(clean(x));}return;}
  });
  document.addEventListener('change',e=>{const t=e.target;if(!t.closest||!t.closest('#flPanel'))return;if(t.id==='flBas'){st.bas=t.value;ciz();}if(t.id==='flBit'){st.bit=t.value;ciz();}if(t.id==='flTip'){st.tip=t.value;ciz();}});
  let qz=null;document.addEventListener('input',e=>{if(e.target.id==='flQ'){st.q=e.target.value;clearTimeout(qz);qz=setTimeout(()=>{const p=e.target.selectionStart;ciz();const n=$('#flQ');if(n){n.focus();n.setSelectionRange(p,p);}},200);}});
  async function show(){const P=$('#flPanel');if(!P)return;P.hidden=false;await yukle(false);}
  async function firmaDegisti(){const P=$('#flPanel');if(!P||P.hidden)return;st.sec=null;await yukle(false);}
  firmaDinle(firmaDegisti);
  return {show,firmaDegisti,yenile:()=>yukle(true),_st:st};
})();
window.__fisl=FISL;
/* ---------- HESAP: Luca hesap planına hesap açma (tüm modüller) + hesap kutularında canlı hesap listesi ---------- */
const HESAP=(()=>{
  const api=window.__mwApi||window.desktop;
  const clean=e=>String(e&&e.message||e).replace(/^Error invoking remote method '[^']+': (Error: )?/,'');
  const vis=id=>{const e=document.getElementById(id);return e&&!e.hidden&&e.getClientRects().length>0;};
  // hangi sayfadaysak o sayfanın firması
  function aktifFirma(){
    try{
      if(vis('fkKayit')&&typeof FKAYIT!=='undefined'&&FKAYIT._firma())return FKAYIT._firma();
      if(vis('okcPanel')&&typeof OKC!=='undefined'&&OKC._firma())return OKC._firma();
      if(vis('cekPanel')&&typeof CEK!=='undefined'&&CEK._firma())return CEK._firma();
      if(vis('mmPanel')&&typeof MMUI!=='undefined'){const id=MMUI._st.firm;const f=(Store.local().firms||{})[id];if(f)return f;}
    }catch(e){}
    return S.firm&&S.firm.id!==EXAMPLE_ID?S.firm:null;
  }
  // firmanın bilinen hesapları: Luca hesap planı (alındıysa) + mizan
  async function hesaplar(f){const m=new Map();
    try{for(const r of await Store.getMizan(f.id+'__hp')||[]){let ad=String(r[1]||'');if(/[ÃÄÅ][\u0080-\u00ff\u0152-\u017e\u2013-\u203a]/.test(ad)&&typeof MMUI!=='undefined'&&MMUI._mojibake)ad=MMUI._mojibake(ad);m.set(String(r[0]),ad);}}catch(e){}
    try{for(const r of await Store.getMizan(f.id,(f.mizanInfo||{}).parts)||[])if(r&&r[0]&&!m.has(String(r[0])))m.set(String(r[0]),String(r[1]||''));}catch(e){}
    return m;}
  function sonraki(m,ust){ust=String(ust||'').replace(/\.+$/,'');
    const say=[...m.keys()].filter(k=>k.startsWith(ust+'.')&&!k.slice(ust.length+1).includes('.')).map(k=>k.slice(ust.length+1)).filter(x=>/^\d+$/.test(x));
    const gen=say.length?Math.max(...say.map(x=>x.length)):(ust.split('.').length===1?2:3);
    let n=say.length?Math.max(...say.map(Number))+1:1,k;do{k=ust+'.'+String(n).padStart(gen,'0');n++;}while(m.has(k));return k;}
  // cari kodu matematiği: firmadaki 120 / 320 yapısına göre (harf grupları 320.P.0006 ya da sayısal 320.01.045)
  function cariKodu(m,grup,unvan,ek){
    const tum=new Map([...m,...(ek||new Map())]);
    const ustK=new Set();for(const k of tum.keys()){if(!k.startsWith(grup+'.'))continue;const p=k.split('.');for(let i=1;i<p.length;i++)ustK.add(p.slice(0,i).join('.'));}
    const leaf=[...tum.keys()].filter(k=>k.startsWith(grup+'.')&&!ustK.has(k));
    const ust=new Map();for(const k of leaf){const p=k.slice(0,k.lastIndexOf('.'));ust.set(p,(ust.get(p)||0)+1);}
    const harfli=[...ust.keys()].filter(u=>/^[A-ZÇĞİÖŞÜ]$/i.test(u.slice(grup.length+1)));
    const yeni=[];
    if(harfli.length&&harfli.length>=[...ust.keys()].length*0.5){
      const L=(String(unvan||'').trim().toLocaleUpperCase('tr-TR').match(/[A-ZÇĞİÖŞÜ0-9]/)||['X'])[0];const p=grup+'.'+L;
      if(!tum.has(p))yeni.push({kod:p,ad:L+' HARFİ İLE BAŞLAYAN FİRMALAR',ust:true});
      const ornek=leaf.find(k=>k.startsWith(grup+'.'+k.split('.')[1]+'.'))||'';const gen=ornek?ornek.split('.').pop().length:4;
      const say=[...tum.keys()].filter(k=>k.startsWith(p+'.')&&!k.slice(p.length+1).includes('.')).map(k=>k.slice(p.length+1)).filter(x=>/^\d+$/.test(x));
      let n=say.length?Math.max(...say.map(Number))+1:1,k;do{k=p+'.'+String(n).padStart(gen,'0');n++;}while(tum.has(k));
      yeni.push({kod:k,ad:unvan});return yeni;}
    let p=[...ust.entries()].sort((a,b)=>b[1]-a[1])[0];p=p?p[0]:'';
    if(!p){p=grup+'.01';if(!tum.has(p))yeni.push({kod:p,ad:grup==='120'?'ALICILAR':grup==='320'?'SATICILAR':'HESAPLAR',ust:true});}
    yeni.push({kod:sonraki(tum,p),ad:unvan});return yeni;}
  const AYLAR=['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
  const CEK_AD={'101':'Vadeli Alınan Çekler','103':'Vadeli Verilen Çekler','121':'Vadeli Alacak Senetleri','321':'Vadeli Borç Senetleri'};
  // çek / senet vade hesapları: 101.YY.AA (yıl ara hesabı yoksa o da)
  function vadeHesaplari(m,kodlar){const out=[];const ek=new Set();
    for(const k of kodlar){const x=String(k).match(/^(101|103|121|321)\.(\d{2})\.(\d{2})$/);if(!x||m.has(k)||ek.has(k))continue;
      const yil=x[1]+'.'+x[2];if(!m.has(yil)&&!ek.has(yil)){out.push({kod:yil,ad:'20'+x[2]+' Yılı '+CEK_AD[x[1]],ust:true});ek.add(yil);}
      out.push({kod:k,ad:AYLAR[+x[3]-1]+' 20'+x[2]+' '+CEK_AD[x[1]]});ek.add(k);}
    return out;}
  // hesapları Luca'ya aç; programdaki mizana ve hesap planına ekle; sayfalara haber ver
  async function ac(f,liste,{sor=true,baslik}={}){
    if(!f||!f.lucaId)throw new Error('Firmanın Luca karşılığı yok.');
    liste=liste.filter(x=>x&&x.kod&&x.ad);if(!liste.length)return [];
    if(sor&&!(await askConfirm(baslik||'Luca\'ya hesap açılsın mı?',`${f.name} hesap planına ${liste.length} hesap açılacak:\n`+liste.map(x=>x.kod+'  '+x.ad).join('\n'),'Evet, aç')))return null;
    await LucaBag.bekle();
    const yil=String((f.hesapPlaniInfo&&f.hesapPlaniInfo.year)||(f.mizanInfo&&f.mizanInfo.year)||new Date().getFullYear());
    const r=await mwBusy.run('Hesaplar Luca\'ya açılıyor…',f.name,()=>api.luca.hesapEkle({lucaId:f.lucaId,year:yil,hesaplar:liste.map(x=>({kod:x.kod,ad:String(x.ad).trim().slice(0,100)}))}));
    const ok=r.filter(x=>x.ok);
    if(ok.length){
      try{const plan=await Store.getMizan(f.id+'__hp')||[];if(plan.length){for(const x of ok)if(!plan.some(y=>String(y[0])===x.kod))plan.push([x.kod,x.ad]);plan.sort((a,b)=>String(a[0]).localeCompare(String(b[0]),'tr',{numeric:true}));await Store.saveMizan(f.id+'__hp',plan);}
        const m=await Store.getMizan(f.id,(f.mizanInfo||{}).parts)||[];for(const x of ok)if(!m.some(y=>String(y[0])===x.kod))m.push([x.kod,x.ad,0,0]);
        m.sort((a,b)=>String(a[0]).localeCompare(String(b[0]),'tr',{numeric:true}));const parts=await Store.saveMizan(f.id,m);
        let cur=f;try{cur=Store.local().firms[f.id]||f;}catch(e){}
        await Store.saveFirm({...cur,mizanInfo:{...(cur.mizanInfo||{source:'luca',year:yil}),count:m.length,parts,at:new Date().toISOString()}});}catch(e){}
      onb.fid='';onb.m=null;planC.fid='';planC.m=null;await yenile(f);
      planYenile(f,yil);}                    // hesap planı Luca'dan güncel haliyle (arka planda)
    const hata=r.filter(x=>!x.ok);
    toast(ok.length?`Luca'da ${ok.length} hesap açıldı: ${ok.slice(0,4).map(x=>x.kod).join(', ')}${ok.length>4?'…':''}${hata.length?` · ${hata.length} hata: ${hata[0].hata}`:''}`:'Hesap açılamadı: '+((hata[0]&&hata[0].hata)||''));
    return r;}
  // Luca'daki hesap planını yeniden çek ve programdaki kopyayı güncelle (hesap eklendikten sonra)
  // o.hata: hata yutulmaz, çağırana iletilir ("Muavini Luca'dan çek" adım adım gösterir)
  async function planYenile(f,yil,o){
    try{const r=await api.luca.hesapPlani({lucaId:f.lucaId,year:String(yil||(f.hesapPlaniInfo||{}).year||new Date().getFullYear())});
      if(!r||!r.hesaplar||!r.hesaplar.length){if(o&&o.hata)throw new Error('Luca hesap planı boş geldi');return;}
      const rows=r.hesaplar.map(([k,a])=>[String(k),String(a||'')]).sort((a,b)=>a[0].localeCompare(b[0],'tr',{numeric:true}));
      await Store.saveMizan(f.id+'__hp',rows);let cur=f;try{cur=Store.local().firms[f.id]||f;}catch(e){}
      await Store.saveFirm({...cur,hesapPlaniInfo:{year:r.year,at:new Date().toISOString(),count:rows.length,kaynak:r.kaynak||''}});
      onb.fid='';onb.m=null;await yenile(f);if(typeof MMUI!=='undefined'&&!$('#mmPanel').hidden&&MMUI._st.tab==='plan')MMUI.open('plan');}catch(e){if(o&&o.hata)throw e;}}
  // Luca'ya fiş kaydedildikten sonra: mizan hemen, muavin (tüm yıl) arka planda yeniden çekilir → program hep güncel kalır
  let muavinIs=null;
  // Kayıt sonrası yenileme: art arda kayıtlarda (ör. 10 fiş peş peşe) her biri için ayrı mizan/muavin indirmek yerine
  // 2,5 sn içinde gelen istekler firma bazında birleştirilir; muavin indirme sürüyorsa bitince bir kez daha çekilir.
  // Not: Luca muavini "fiş kaydedildi" bilgisini anında vermez; muavin yine bütün yıl indirilir (Luca'da artımlı uç yok).
  const bekleyen=new Map();   // fid → {f, mizan, muavin, plan, ay, sonra:[], t}
  function kayitSonrasi(f,{mizan=true,muavin=true,plan=true,ay,sonra}={}){
    if(!f||!f.lucaId)return Promise.resolve();
    let b=bekleyen.get(f.id);if(!b){b={f,mizan:false,muavin:false,plan:false,ay,sonra:[],t:null};bekleyen.set(f.id,b);}
    b.f=f;b.mizan=b.mizan||mizan;b.muavin=b.muavin||muavin;b.plan=b.plan||plan;if(ay)b.ay=ay;if(typeof sonra==='function')b.sonra.push(sonra);
    clearTimeout(b.t);
    return new Promise(res=>{b.t=setTimeout(async()=>{bekleyen.delete(f.id);try{await kayitSonrasiHemen(b.f,b);}finally{res();}},2500);});
  }
  async function kayitSonrasiHemen(f,{mizan,muavin,plan,ay,sonra=[]}){
    const yil=String((f.mizanInfo||{}).year||new Date().getFullYear());
    const bitti=()=>{for(const fn of sonra)try{fn();}catch(x){}};
    window.__mwArkaPlan=(window.__mwArkaPlan||0)+1;
    try{
    if(mizan){const is=Isler.basla('Mizan güncelleniyor · '+f.name);try{await Desk.pullMizan(f,yil);onb.fid='';onb.m=null;await yenile(f);}catch(e){toast('Mizan güncellenemedi: '+String(e&&e.message||e).slice(0,120));}finally{Isler.bitir(is);}}
    if(plan)await planYenile(f,yil);
    }finally{window.__mwArkaPlan--;}
    if(muavin&&api.fk&&api.fk.muavinCek){
      const d=new Date();const a=ay||(d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'));
      let s0={};try{s0=await api.fk.topluDurum();}catch(e){}
      if(s0.calisiyor){muavinSonra.set(f.id,{f,ay:a,sonra});if(!muavinIs)muavinIs=setTimeout(muavinBekle,4000);return;}   // sürüyor: bitince tekrar
      try{await api.fk.muavinCek({id:String(f.lucaId),ad:f.name,ay:a});muavinIsId=Isler.basla('Muavin indiriliyor · '+f.name);
        muavinSonra.delete(f.id);muavinBitince.push(()=>{if(typeof MMUI!=='undefined'){MMUI._st.donemler=null;MMUI._st.muavinCache={};}
          try{if(typeof FISL!=='undefined'&&!$('#flPanel').hidden)FISL.yenile();}catch(x){}toast(`${f.name}: muavin güncellendi.`);gunlukYaz('muavin',f,{ad:'Muavin Luca\'dan indirildi'});bitti();});
        if(muavinIs)clearTimeout(muavinIs);muavinIs=setTimeout(muavinBekle,4000);}
      catch(e){bitti();/* muavin indirme başlatılamadı (Luca kapalı vb.) — mizan yine güncellendi */}}
    else bitti();
  }
  const muavinSonra=new Map();let muavinBitince=[],muavinIsId=null;
  async function muavinBekle(){let s={};try{s=await api.fk.topluDurum();}catch(e){}
    if(s.calisiyor){muavinIs=setTimeout(muavinBekle,4000);return;}muavinIs=null;if(muavinIsId){Isler.bitir(muavinIsId);muavinIsId=null;}
    const L=muavinBitince;muavinBitince=[];for(const fn of L)try{fn();}catch(x){}
    const sira=[...muavinSonra.values()];muavinSonra.clear();for(const b of sira)kayitSonrasiHemen(b.f,{muavin:true,ay:b.ay,sonra:b.sonra});}
  async function yenile(f){
    try{if(S.firm&&S.firm.id===f.id){const fr=Store.local().firms[f.id];const acc=await Store.getMizan(f.id,(fr.mizanInfo||{}).parts)||[];S.firm={...fr};S.miz=mizanIndex(acc);renderDatalist();reassign();}}catch(e){}
    for(const M of [typeof FISG!=='undefined'?FISG:null,typeof FKAYIT!=='undefined'?FKAYIT:null,typeof OKC!=='undefined'?OKC:null,typeof CEK!=='undefined'?CEK:null]){try{if(M&&M._yenile&&M._firma&&M._firma()&&M._firma().id===f.id)await M._yenile();}catch(e){}}
  }

  /* ---- hesap kutuları: yazdıkça hesap planından liste; olmayan kod yazılınca "eklensin mi?" ---- */
  let drop=null,aktif=null,sec=-1,kayitli=[];
  const dl=inp=>{const id=inp.dataset.hslist||inp.getAttribute('list');return id&&/[aA]ccList$/.test(id)?document.getElementById(id):null;};
  // liste: sayfanın firmasının tüm hesapları (Luca hesap planı + mizan; ara hesaplar dahil), yoksa sayfanın listesi
  const onb={fid:'',m:null,yukleniyor:null};
  // her odakta yeniden okunur (hesap planı / mizan başka sayfada değişmiş olabilir); okunana kadar eski liste gösterilir
  function onbellek(){const f=aktifFirma();if(!f)return null;if(onb.fid===f.id&&onb.m)return onb.m;
    if(!onb.yukleniyor||onb.fid!==f.id){if(onb.fid!==f.id)onb.eski=null;onb.fid=f.id;onb.m=null;onb.yukleniyor=hesaplar(f).then(m=>{if(onb.fid===f.id){onb.m=m;onb.eski=m;onb.yukleniyor=null;if(aktif)goster(aktif);}});}
    return onb.eski||null;}
  function secenekler(inp){const m=onbellek();const d=dl(inp);const l=d?[...d.options].map(o=>[o.value,o.textContent||o.label||'']):[];
    if(!m||!m.size)return l;const out=[...m.entries()];const v=new Set(m.keys());for(const x of l)if(!v.has(x[0]))out.push(x);
    return out.sort((a,b)=>a[0].localeCompare(b[0],'tr',{numeric:true}));}
  function goster(inp){
    const q=inp.value.trim();const all=secenekler(inp);
    const L=(q?(/^\d/.test(q)?all.filter(([k])=>k.startsWith(q)):all.filter(([k,a])=>N(a).includes(N(q))||k.includes(q))):all).slice(0,150);
    if(!drop){drop=document.createElement('div');drop.id='hsDrop';document.body.appendChild(drop);
      drop.addEventListener('mousedown',e=>{const r=e.target.closest('[data-hs]');if(!r)return;e.preventDefault();sec=-1;sec_(r.dataset.hs);});}
    const var_=q&&all.some(([k])=>k===q);
    drop.innerHTML=`<div class="hs-ust">${q?`<b>${esc(q)}</b> · ${L.length===150?'150+':L.length} hesap${var_?'':/^\d{3}/.test(q)?' · <span class="hs-yok">bu kod planda yok</span>':''}`:'Hesap kodu ya da adı yazın'}</div>`+
      (L.length?L.map(([k,a],i)=>`<div class="hs-s${i===sec?' sec':''}" data-hs="${esc(k)}"><span class="mono">${/^\d/.test(q)?`<b>${esc(k.slice(0,q.length))}</b>${esc(k.slice(q.length))}`:esc(k)}</span><span>${esc(a)}</span></div>`).join(''):`<div class="hs-bos">${q?'Eşleşen hesap yok — Enter ile bu kodu Luca\'ya ekleyebilirsiniz':'Bu firmanın hesap listesi boş'}</div>`);
    const r=inp.getBoundingClientRect();const W=Math.max(r.width,440);
    drop.style.left=Math.max(8,Math.min(r.left,innerWidth-W-8))+'px';drop.style.width=W+'px';
    const alt=innerHeight-r.bottom;if(alt<260&&r.top>alt){drop.style.top='';drop.style.bottom=(innerHeight-r.top+2)+'px';}else{drop.style.bottom='';drop.style.top=(r.bottom+2)+'px';}
    drop.hidden=false;}
  function kapat(){if(drop)drop.hidden=true;sec=-1;}
  function sec_(v){if(!aktif)return;aktif.value=v;aktif.dispatchEvent(new Event('input',{bubbles:true}));aktif.dispatchEvent(new Event('change',{bubbles:true}));kapat();}
  document.addEventListener('focusin',e=>{const t=e.target;if(!(t instanceof HTMLInputElement))return;const l=t.getAttribute('list');
    if(l&&/[aA]ccList$/.test(l)){t.dataset.hslist=l;t.removeAttribute('list');}            // tarayıcının kendi listesi yerine geniş liste
    if(t.dataset.hslist){aktif=t;sec=-1;if(onb.m){onb.eski=onb.m;onb.m=null;onb.yukleniyor=null;}goster(t);}});
  document.addEventListener('input',e=>{if(e.target===aktif){sec=-1;goster(aktif);}});
  document.addEventListener('focusout',e=>{if(e.target===aktif){const t=aktif;setTimeout(()=>{if(document.activeElement!==t){kapat();if(t.dataset.hslist){t.setAttribute('list',t.dataset.hslist);}aktif=null;}},120);}});
  document.addEventListener('keydown',e=>{if(!aktif||e.target!==aktif||!drop||drop.hidden)return;const rs=[...drop.querySelectorAll('[data-hs]')];
    if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();sec=Math.max(0,Math.min(rs.length-1,sec+(e.key==='ArrowDown'?1:-1)));rs.forEach((r,i)=>r.classList.toggle('sec',i===sec));if(rs[sec])rs[sec].scrollIntoView({block:'nearest'});}
    else if(e.key==='Enter'&&sec>=0&&rs[sec]){e.preventDefault();sec_(rs[sec].dataset.hs);}
    else if(e.key==='Escape'){kapat();}},true);
  // olmayan hesap kodu yazıldıysa: eklensin mi?
  document.addEventListener('change',e=>{const t=e.target;if(!(t instanceof HTMLInputElement)||!t.dataset.hslist||t.dataset.hssorma!=null)return;const v=t.value.trim();   // data-hssorma: yalnız var olan hesap yazılır (kod tanımları)
    if(!/^\d{3}(\.[0-9A-Za-zÇĞİÖŞÜçğıöşü]+)+$/.test(v))return;if(secenekler(t).some(([k])=>k===v))return;
    setTimeout(()=>sor(v,t.dataset.hsad||''),50);},true);
  let soruluyor=false;
  async function sor(kod,adOneri){
    if(soruluyor)return;const f=aktifFirma();if(!f||!f.lucaId)return;soruluyor=true;
    try{const m=await hesaplar(f);if(m.has(kod))return;
      const ust=kod.split('.').slice(0,-1).join('.');const ustYok=ust&&!m.has(ust)&&![...m.keys()].some(k=>k.startsWith(ust+'.'));
      const ad=await new Promise(res=>{let M=$('#hsSor');if(!M){document.body.insertAdjacentHTML('beforeend','<div class="modal" id="hsSor" hidden><div class="mbox" role="dialog" aria-modal="true" style="width:min(560px,100%)"><div class="mhead"><h2>Hesap planında yok</h2></div><div class="mbody" id="hsSorB"></div></div></div>');M=$('#hsSor');}
        $('#hsSorB').innerHTML=`<p style="margin:0 0 10px"><b class="mono">${esc(kod)}</b> hesabı ${esc(f.name)} hesap planında yok. Luca'ya eklensin mi?</p>
          ${ustYok?`<p class="note" style="color:var(--aski-fg)">Üst hesap ${esc(ust)} de planda görünmüyor; Luca reddedebilir.</p>`:''}
          <label class="lbl" for="hsAd">Hesap adı</label><input id="hsAd" value="${esc(adOneri)}" placeholder="Hesap adı" style="font-size:15px;padding:9px 11px">
          <div class="actions" style="justify-content:flex-end;margin-top:12px"><button class="btn" id="hsHayir">Hayır</button><button class="btn primary" id="hsEvet">Luca'ya Ekle</button></div>`;
        M.hidden=false;setTimeout(()=>$('#hsAd').focus(),30);
        const bit=v=>{M.hidden=true;res(v);};$('#hsHayir').onclick=()=>bit(null);
        $('#hsEvet').onclick=()=>{const a=$('#hsAd').value.trim();if(!a){$('#hsAd').focus();return;}bit(a);};
        $('#hsAd').onkeydown=ev=>{if(ev.key==='Enter')$('#hsEvet').click();if(ev.key==='Escape')bit(null);};});
      if(ad)await ac(f,[{kod,ad}],{sor:false});}
    catch(e){toast(clean(e));}finally{soruluyor=false;}}
  /* ---- Taslak (önerilen) cari hesaplar ----
     Mizanda / hesap planında bulunamayan karşı taraf için firmanın 120 / 320 düzenine göre sıradaki kod önerilir; ekranda
     "var gibi" kullanılır (mor renkte). Fiş Luca'ya gönderilmeden hemen önce taslakHazirla() bu hesapları Luca hesap planına açar. */
  const taslak=new Map();                                    // fid → Map(kod → {kod, ad, ust, vkn, anahtar})
  const tMap=fid=>{if(!taslak.has(fid))taslak.set(fid,new Map());return taslak.get(fid);};
  const tk=s0=>N(s0).replace(/[^A-Z0-9 ]/g,' ').split(/\s+/).filter(t=>t.length>=3&&!STOPW.has(t));
  // hesap planında (mizanda hareket görmemiş olsa da) aynı ünvanlı cari var mı?
  const pIdx=new WeakMap();      // m → {grup → [[kod, ad, Set(token)]]} (yalnız alt hesaplar)
  function planIndeks(m){let x=pIdx.get(m);if(x&&x.n===m.size)return x;const ust=new Set();
    for(const k of m.keys()){const p=k.split('.');for(let i=1;i<p.length;i++)ust.add(p.slice(0,i).join('.'));}
    x={n:m.size,g:{}};for(const [c,n] of m){if(ust.has(c))continue;const g=c.slice(0,3);(x.g[g]=x.g[g]||[]).push([c,n,new Set(tk(n))]);}
    pIdx.set(m,x);return x;}
  function planCariBul(m,grup,unvan){const ut=tk(unvan);if(!ut.length)return null;let best=null,bs=0;
    for(const [c,n,nt] of planIndeks(m).g[grup]||[]){const hit=ut.filter(t=>nt.has(t)).length;if(!hit)continue;
      const sc=hit/Math.max(ut.length,nt.size);if(sc>bs){bs=sc;best=[c,n];}}
    return bs>=0.6?best:null;}
  // Cari adı olamayacak metinler: IBAN (TR + 24 hane, boşluklu / boşluksuz), salt sayı / kod dizileri, harfli sözcüğü olmayanlar
  function cariAdOlur(unvan){
    const s=String(unvan||'').toLocaleUpperCase('tr-TR').replace(/\bTR\s?\d{2}(?:\s?\d{4}){5}\s?\d{2}\b/g,' ').replace(/\bTR\d{24}\b/g,' ');
    const harfli=s.split(/[\s,;:|\/*()]+/).filter(t=>/[A-ZÇĞİÖŞÜ]{2,}/.test(t)&&!/^TR\d+$/.test(t)&&!GENERIC.has(N(t)));
    if(!harfli.length)return false;
    const r=s.replace(/\s/g,'');return (r.match(/\d/g)||[]).length<=r.length/2;}
  // "ABC TURİZM A.Ş. - XYZ OTEL": " - " sonrası ek (şube, otel, proje adı) atılmış taban ünvan
  const unvanTaban=u=>{const p=String(u||'').split(/\s+-\s+/);return p.length>1&&tk(p[0]).length?p[0].trim():'';};
  /** {kod, ad, yeni}: planda varsa o hesap, yoksa taslak (aynı karşı taraf için hep aynı kod). */
  function cariOner(f,m,grup,unvan,vkn){
    if(!f||!unvan||!cariAdOlur(unvan))return null;
    {const v=planCariBul(m,grup,unvan);if(v)return {kod:v[0],ad:v[1],yeni:false};}
    // ekli ünvan: ek atılarak mevcut cariyle eşleşir; eşleşmezse yeni cari de taban ünvanla açılır (aynı firmanın şubeleri tek cari)
    {const t=unvanTaban(unvan);if(t){unvan=t;const v=planCariBul(m,grup,t);if(v)return {kod:v[0],ad:v[1],yeni:false};}}
    const T=tMap(f.id);const a=(vkn?'V:'+vkn:'U:'+tk(unvan).join(' '))+'|'+grup;
    for(const x of T.values())if(x.anahtar===a&&!m.has(x.kod))return {kod:x.kod,ad:x.ad,yeni:true};
    const ek=new Map([...T.values()].map(x=>[x.kod,x.ad]));
    const yeni=cariKodu(m,grup,String(unvan).trim().slice(0,100),ek);
    for(const y of yeni){if(m.has(y.kod)||T.has(y.kod))continue;T.set(y.kod,{kod:y.kod,ad:String(y.ad).trim().slice(0,100),ust:!!y.ust,vkn:y.ust?'':(vkn||''),anahtar:y.ust?'':a,grup});}
    const son=yeni[yeni.length-1];return {kod:son.kod,ad:son.ad,yeni:true};}
  const taslakMi=(fid,kod)=>!!(fid&&kod&&taslak.has(fid)&&taslak.get(fid).has(kod));
  const taslakAd=(fid,kod)=>{const x=taslakMi(fid,kod)?taslak.get(fid).get(kod):null;return x?x.ad:'';};
  // senkron hesap listesi (banka eşleştirmesi için): yüklüyse döner, değilse yükler ve hazır olunca sonra() çağrılır
  const planC={fid:'',m:null,p:null};
  function planHazir(f,sonra){if(planC.fid===f.id&&planC.m)return planC.m;
    if(planC.fid!==f.id||!planC.p){planC.fid=f.id;planC.m=null;const id=f.id;planC.p=hesaplar(f).then(m=>{if(planC.fid===id){planC.m=m;planC.p=null;if(sonra)try{sonra();}catch(e){}}}).catch(()=>{planC.p=null;});}
    return null;}
  function planUnut(){planC.fid='';planC.m=null;planC.p=null;}
  /** Fişlerde geçen taslak hesapları Luca'ya açar. {ok, degis: Map(eski→yeni kod), hata:[kod], iptal} */
  async function taslakHazirla(f,kodlar){
    const T=tMap(f.id);let kul=[...new Set(kodlar)].filter(k=>T.has(k)&&!T.get(k).ust);const degis=new Map();
    if(!kul.length)return {ok:true,degis,hata:[]};
    await LucaBag.bekle();
    const yil=String((f.hesapPlaniInfo&&/^\d{4}$/.test(f.hesapPlaniInfo.year)&&f.hesapPlaniInfo.year)||(f.mizanInfo&&f.mizanInfo.year)||new Date().getFullYear());
    // güncel hesap planı: arada Luca'da açılmış kodlarla çakışmasın
    await mwBusy.run('Hesap planı denetleniyor…',f.name,async()=>{try{await planYenile(f,yil);}catch(e){}});
    let m=await hesaplar(f);planUnut();
    for(const k of kul.slice()){const x=T.get(k);
      const v=planCariBul(m,x.grup,x.ad);if(v){degis.set(k,v[0]);T.delete(k);continue;}                     // artık planda var
      if(m.has(k)){T.delete(k);const o=cariOner(f,m,x.grup,x.ad,x.vkn);if(o){degis.set(k,o.kod);}}}            // kod çakıştı → yeni kod
    for(const [k,x] of [...T])if(x.ust&&m.has(k))T.delete(k);
    kul=[...new Set(kul.map(k=>degis.get(k)||k))].filter(k=>T.has(k));
    // vergi numarası olanlar Luca'da aranır (açılmış ama mizanda hareketi olmayan cari)
    const vknli=kul.filter(k=>T.get(k).vkn);
    if(vknli.length)await mwBusy.run('Yeni cariler denetleniyor…','Vergi numarasıyla Luca\'da aranıyor',async()=>{
      for(const k of vknli){const x=T.get(k);try{const h=await api.luca.hesapAraVkn({lucaId:f.lucaId,year:yil,vkn:x.vkn});const v=(h||[]).find(y=>String(y[0]).startsWith(x.grup+'.'));
        if(v){degis.set(k,v[0]);for(const [e,y] of degis)if(y===k)degis.set(e,v[0]);T.delete(k);}}catch(e){}}});
    kul=kul.filter(k=>T.has(k));
    if(!kul.length)return {ok:true,degis,hata:[]};
    const liste=[];const eklendi=new Set();
    for(const k of kul){const zincir=[];let p=k;for(;;){const pp=p.split('.').slice(0,-1).join('.');if(!pp||!T.has(pp))break;zincir.unshift(pp);p=pp;}
      for(const z of [...zincir,k])if(!eklendi.has(z)){eklendi.add(z);liste.push(T.get(z));}}
    const r=await ac(f,liste.map(x=>({kod:x.kod,ad:x.ad})),{sor:true,baslik:'Fişten önce yeni cariler Luca\'ya açılsın mı?'});
    if(!r)return {ok:false,iptal:true,degis,hata:kul};
    for(const x of r)if(x.ok){if(x.lucaKod&&x.lucaKod!==x.kod)degis.set(x.kod,x.lucaKod);T.delete(x.kod);}
    planUnut();
    const hata=kul.filter(k=>T.has(k));
    for(const [e,y] of degis)if(degis.has(y))degis.set(e,degis.get(y));
    for(const k of kul)if(!T.has(k)&&!degis.has(k))degis.set(k,k);
    return {ok:!hata.length,degis,hata};}
  window.__mwMesgul=()=>bekleyen.size>0||(window.__mwArkaPlan||0)>0;   // test: kayıt sonrası mizan / plan yenilemesi bekliyor ya da sürüyor
  return {ac,hesaplar,sonraki,cariKodu,vadeHesaplari,aktifFirma,yenile,sor,planYenile,kayitSonrasi,cariOner,taslakMi,taslakAd,planHazir,planUnut,taslakHazirla,_taslak:taslak,_cariAdOlur:cariAdOlur,_unvanTaban:unvanTaban};
})();
window.__hesap=HESAP;
/* ---------- Başlık Biçimi: buton, sekme, tablo başlığı ve etiketlerde her kelime büyük harfle başlar (açıklamalar hariç) ---------- */
(()=>{
  const KUCUK=new Set(['ve','ile','veya','ya','da','de','ki','mi']);
  const SEC='button:not(.hs-s), th, h1, h2, h3, h4, label.lbl, option, .mtab, .modcard b, .hubcard b, summary, legend';
  const HARIC='p, .note, td, .ms, .sub, .ipucu, small, input, textarea, select:not(option), .mono';
  const kelime=(w,i)=>{if(!w)return w;const c=w[0];
    if(!/[a-zçğıöşü]/.test(c))return w;                       // zaten büyük, sayı ya da simge
    if(/[A-ZÇĞİÖŞÜ]/.test(w.slice(1)))return w;               // e-Fatura, iPhone gibi
    if(i>0&&KUCUK.has(w))return w;
    if(/^(https?:|www\.)/.test(w))return w;
    return c.toLocaleUpperCase('tr-TR')+w.slice(1);};
  const cevir=t=>{let i=0;return t.replace(/[^\s/()·–—-]+/g,w=>kelime(w,i++));};
  function uygula(kok){
    const els=kok.nodeType===1?[...(kok.matches&&kok.matches(SEC)?[kok]:[]),...kok.querySelectorAll(SEC)]:[];
    for(const el of els){
      if(el.closest('[data-notc]'))continue;
      const w=document.createTreeWalker(el,NodeFilter.SHOW_TEXT,{acceptNode:n=>{const p=n.parentElement;return p&&p.closest(HARIC)&&p.closest(HARIC)!==el&&el.contains(p.closest(HARIC))?NodeFilter.FILTER_REJECT:NodeFilter.FILTER_ACCEPT;}});
      let n;while((n=w.nextNode())){const y=cevir(n.nodeValue);if(y!==n.nodeValue)n.nodeValue=y;}
    }
  }
  let bek=new Set(),zam=0;
  const isle=()=>{zam=0;const k=[...bek];bek.clear();for(const x of k)if(x.isConnected)uygula(x);};
  new MutationObserver(ms=>{for(const m of ms){if(m.type==='characterData'){const p=m.target.parentElement;if(p)bek.add(p.closest(SEC)||p);}else for(const n of m.addedNodes){if(n.nodeType===1)bek.add(n);else if(n.parentElement)bek.add(n.parentElement.closest(SEC)||n.parentElement);}}
    if(!zam)zam=requestAnimationFrame(isle);}).observe(document.body,{childList:true,subtree:true,characterData:true});
  uygula(document.body);
  window.__baslikBicimi=cevir;
})();
/* ---------- Tüm tablolar: başlığa tıklayarak sıralama, başlık altında filtre, tümünü seç (kendi sıralaması olmayan tablolara) ---------- */
(()=>{
  const T=s=>String(s==null?'':s).toLocaleUpperCase('tr-TR').replace(/İ/g,'I').replace(/Ş/g,'S').replace(/Ğ/g,'G').replace(/Ü/g,'U').replace(/Ö/g,'O').replace(/Ç/g,'C').replace(/\s+/g,' ').trim();
  const durum=new Map();let sayac=0;
  const anahtar=t=>{if(!t.dataset.tgk)t.dataset.tgk=t.id||('tg'+(++sayac));return t.dataset.tgk;};
  const uygunMu=t=>{if(!t.tHead||!t.tBodies.length||t.closest('.tg-yok')||t.classList.contains('mini')||t.classList.contains('tg-yok'))return false;
    const h=t.tHead;if(h.querySelector('.sirala,[data-cks],[data-sort],[data-fksort],[data-mmsort],.sorth,tr.filtre:not(.tg-filtre)'))return false;const r=h.rows[0];return !!r&&r.cells.length>1;};
  const deger=td=>{if(!td)return '';const i=td.querySelector('input:not([type=checkbox]),select');return (i?(i.value||''):'')+' '+(td.innerText||td.textContent||'');};
  function sayi(s){s=String(s).trim();let m=s.match(/^(\d{2})[./](\d{2})[./](\d{4})/);if(m)return +(m[3]+m[2]+m[1]);
    m=s.replace(/[₺TL\s*%]/g,'').match(/^-?\d{1,3}(\.\d{3})*(,\d+)?$|^-?\d+(,\d+)?$/);if(m)return parseFloat(s.replace(/[₺TL\s*%]/g,'').replace(/\./g,'').replace(',','.'));return null;}
  function gruplar(tb){const g=[];for(const tr of tb.rows){const ek=tr.classList.contains('fisdetay')||tr.classList.contains('detay')||tr.dataset.tgek!=null;if(ek&&g.length)g[g.length-1].push(tr);else g.push([tr]);}return g;}
  function kur(t){
    const k=anahtar(t);const st=durum.get(k)||{sort:null,f:{}};durum.set(k,st);
    const hr=t.tHead.rows[t.tHead.rows.length-1];if(hr.classList.contains('tg-filtre'))return;
    const n=hr.cells.length;const ilk=t.tBodies[0].rows[0];
    const cbKol=ilk&&ilk.cells[0]&&ilk.cells[0].querySelector('input[type=checkbox]')?0:-1;
    [...hr.cells].forEach((th,i)=>{if(i===cbKol||!(th.textContent||'').trim()||th.dataset.tg)return;th.dataset.tg=i;th.style.cursor='pointer';th.title=th.title||'Sıralamak için tıklayın';
      const ok=document.createElement('span');ok.className='tg-ok';ok.style.cssText='margin-left:4px;opacity:.5;font-size:10px';th.appendChild(ok);
      th.addEventListener('click',e=>{if(e.target.closest('input,select,button'))return;const o=st.sort;st.sort=o&&o.i===i?(o.d>0?{i,d:-1}:null):{i,d:1};uygula(t);});});
    if(cbKol===0&&!hr.cells[0].querySelector('input[type=checkbox]')){const c=document.createElement('input');c.type='checkbox';c.title='Görünenlerin tümünü seç / kaldır';c.className='tg-hepsi';hr.cells[0].appendChild(c);
      c.addEventListener('change',()=>{const hedef=c.checked;for(const tr of t.tBodies[0].rows){if(tr.style.display==='none')continue;const b=tr.cells[0]&&tr.cells[0].querySelector('input[type=checkbox]');if(b&&!b.disabled&&b.checked!==hedef)b.click();}});}
    const fr=document.createElement('tr');fr.className='filtre tg-filtre';
    for(let i=0;i<n;i++){const th=document.createElement('th');th.style.cssText='padding:3px 5px';
      if(i!==cbKol&&(hr.cells[i].textContent||'').trim()){const inp=document.createElement('input');inp.placeholder='filtre…';inp.value=st.f[i]||'';inp.setAttribute('aria-label',(hr.cells[i].textContent||'').trim()+' filtresi');
        inp.style.cssText='width:100%;min-width:50px;padding:3px 6px;font-size:12px;box-sizing:border-box';inp.addEventListener('focus',()=>{st.odak=i;});inp.addEventListener('blur',()=>{setTimeout(()=>{if(document.activeElement===document.body||!document.activeElement)return;if(st.odak===i&&document.activeElement!==inp)st.odak=null;},0);});let z;inp.addEventListener('input',()=>{st.f[i]=inp.value;clearTimeout(z);z=setTimeout(()=>uygula(t),150);});th.appendChild(inp);}
      fr.appendChild(th);}
    t.tHead.appendChild(fr);uygula(t);
    if(st.odak!=null&&(!document.activeElement||document.activeElement===document.body)){const x=fr.cells[st.odak]&&fr.cells[st.odak].querySelector('input');if(x){x.focus();x.setSelectionRange(x.value.length,x.value.length);}}
  }
  function uygula(t){
    const st=durum.get(anahtar(t));if(!st)return;const tb=t.tBodies[0];if(!tb)return;t.__tgMesgul=true;
    const g=gruplar(tb);const fs=Object.entries(st.f).filter(([,v])=>v&&v.trim());
    for(const grp of g){const tr=grp[0];if(tr.cells.length===1&&tr.cells[0].colSpan>1){continue;}
      const ok=fs.every(([i,v])=>{const d=deger(tr.cells[+i]);const q=v.trim();const x=sayi(String(d).trim().split(/\s{2,}|\n/)[0]);
        const mm=q.match(/^(>=|<=|>|<|=)\s*(.+)$/);if(mm&&x!=null){const y=sayi(mm[2]);if(y==null)return false;return mm[1]==='>'?x>y:mm[1]==='<'?x<y:mm[1]==='>='?x>=y:mm[1]==='<='?x<=y:Math.abs(x-y)<0.005;}
        return T(d).includes(T(q));});
      for(const r of grp)r.style.display=ok?'':'none';}
    if(st.sort){const {i,d}=st.sort;const val=grp=>{const s=deger(grp[0].cells[i]).trim();return s;};
      const veri=g.filter(grp=>!(grp[0].cells.length===1&&grp[0].cells[0].colSpan>1));
      veri.sort((a,b)=>{const x=val(a),y=val(b);const nx=sayi(x),ny=sayi(y);if(nx!=null&&ny!=null)return d*(nx-ny);if(!x)return 1;if(!y)return -1;return d*x.localeCompare(y,'tr',{numeric:true,sensitivity:'base'});});
      for(const grp of veri)for(const r of grp)tb.appendChild(r);}
    t.tHead.querySelectorAll('th[data-tg] .tg-ok').forEach(s=>{const i=+s.parentElement.dataset.tg;s.textContent=st.sort&&st.sort.i===i?(st.sort.d>0?'▲':'▼'):'↕';});
    const hc=t.tHead.querySelector('.tg-hepsi');if(hc){const bs=[...tb.rows].filter(r=>r.style.display!=='none').map(r=>r.cells[0]&&r.cells[0].querySelector('input[type=checkbox]:not([disabled])')).filter(Boolean);hc.checked=bs.length>0&&bs.every(b=>b.checked);hc.indeterminate=!hc.checked&&bs.some(b=>b.checked);}
    setTimeout(()=>{t.__tgMesgul=false;},0);
  }
  /* ---- Sütun genişliği (başlık kenarından sürükle) ve sütun gizleme (başlığa sağ tık) — kimliği olan tüm tablolarda, kalıcı ---- */
  const KOLON_KEY='muhawin-kolon';let kolonlar={};try{kolonlar=JSON.parse(localStorage.getItem(KOLON_KEY)||'{}')||{};}catch(e){}
  const kolonKaydet=()=>{try{localStorage.setItem(KOLON_KEY,JSON.stringify(kolonlar));}catch(e){}};
  const kolonUygunMu=t=>!!(t.id&&t.tHead&&t.tHead.rows.length&&!t.classList.contains('mini')&&!t.closest('.mini,[data-kolon-yok]'));
  function kolonKur(t){
    const hr=t.tHead.rows[0];const st=kolonlar[t.id]||(kolonlar[t.id]={w:{},gizli:{}});
    [...hr.cells].forEach((th,i)=>{if(th.dataset.kz)return;th.dataset.kz=i;th.style.position=th.style.position||'relative';
      const r=document.createElement('i');r.className='kz-tut';r.title='Sürükleyerek genişlet · çift tık: sıfırla';th.appendChild(r);
      r.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();const x0=e.clientX,w0=th.getBoundingClientRect().width;r.setPointerCapture(e.pointerId);
        const mv=ev=>{const w=Math.max(28,Math.round(w0+ev.clientX-x0));th.style.width=w+'px';th.style.minWidth=w+'px';th.style.maxWidth=w+'px';st.w[i]=w;};
        const up=()=>{r.removeEventListener('pointermove',mv);r.removeEventListener('pointerup',up);kolonKaydet();};r.addEventListener('pointermove',mv);r.addEventListener('pointerup',up);});
      r.addEventListener('dblclick',e=>{e.stopPropagation();delete st.w[i];th.style.width=th.style.minWidth=th.style.maxWidth='';kolonKaydet();});
      r.addEventListener('click',e=>e.stopPropagation());});
    if(!hr.dataset.kzMenu){hr.dataset.kzMenu='1';hr.addEventListener('contextmenu',e=>{if(e.target.closest('input,select'))return;e.preventDefault();kolonMenu(t,e.clientX,e.clientY);});}
  }
  function kolonUygula(t){const st=kolonlar[t.id];if(!st)return;const hr=t.tHead.rows[0];
    [...hr.cells].forEach((th,i)=>{const w=st.w[i];if(w&&th.style.width!==w+'px'){th.style.width=w+'px';th.style.minWidth=w+'px';th.style.maxWidth=w+'px';}});
    const gz=Object.keys(st.gizli).filter(i=>st.gizli[i]).map(Number);
    const say=i=>{for(const r of t.rows){if(r.cells.length===1&&r.cells[0].colSpan>1)continue;const c=r.cells[i];if(c)c.classList.toggle('kz-gizli',gz.includes(i));}};
    if(gz.length||t.dataset.kzGizliydi){for(let i=0;i<hr.cells.length;i++)say(i);t.dataset.kzGizliydi=gz.length?'1':'';}
  }
  function kolonMenu(t,x,y){const eski=document.getElementById('kzMenu');if(eski)eski.remove();const st=kolonlar[t.id]||(kolonlar[t.id]={w:{},gizli:{}});const hr=t.tHead.rows[0];
    const m=document.createElement('div');m.id='kzMenu';m.className='kzmenu';m.setAttribute('role','menu');
    m.innerHTML=`<div class="note" style="padding:4px 10px 6px">Sütunlar</div>`+[...hr.cells].map((th,i)=>{const ad=(th.textContent||'').replace(/[↕▲▼]/g,'').trim()||('Sütun '+(i+1));return `<label><input type="checkbox" data-kzi="${i}" ${st.gizli[i]?'':'checked'}> ${esc(ad)}</label>`;}).join('')
      +`<div class="kzalt"><button class="btn small ghost" data-kzsifirla="1">Genişlik ve gizlemeyi sıfırla</button></div>`;
    document.body.appendChild(m);const r=m.getBoundingClientRect();m.style.left=Math.min(x,innerWidth-r.width-8)+'px';m.style.top=Math.min(y,innerHeight-r.height-8)+'px';
    m.addEventListener('change',e=>{const c=e.target.closest('[data-kzi]');if(!c)return;st.gizli[c.dataset.kzi]=!c.checked;kolonKaydet();kolonUygula(t);});
    m.addEventListener('click',e=>{if(e.target.closest('[data-kzsifirla]')){kolonlar[t.id]={w:{},gizli:{}};kolonKaydet();[...hr.cells].forEach(th=>{th.style.width=th.style.minWidth=th.style.maxWidth='';});t.querySelectorAll('.kz-gizli').forEach(c=>c.classList.remove('kz-gizli'));m.remove();}});
    const kapat=e=>{if(e&&e.target&&m.contains(e.target))return;m.remove();document.removeEventListener('pointerdown',kapat,true);document.removeEventListener('keydown',esc_,true);};
    const esc_=e=>{if(e.key==='Escape')kapat();};setTimeout(()=>{document.addEventListener('pointerdown',kapat,true);document.addEventListener('keydown',esc_,true);},0);}
  function tara(kok){const ts=kok.tagName==='TABLE'?[kok]:kok.querySelectorAll?kok.querySelectorAll('table'):[];for(const t of ts){if(kolonUygunMu(t)){kolonKur(t);kolonUygula(t);}if(!uygunMu(t))continue;kur(t);}}
  let bek=new Set(),zam=0;
  const isle=()=>{zam=0;const k=[...bek];bek.clear();const tablolar=new Set();
    for(const n of k){if(!n.isConnected)continue;const t=n.closest?n.closest('table'):null;if(t)tablolar.add(t);if(n.querySelectorAll)n.querySelectorAll('table').forEach(x=>tablolar.add(x));}
    for(const t of tablolar){if(t.__tgMesgul)continue;if(kolonUygunMu(t)){t.__tgMesgul=true;try{kolonKur(t);kolonUygula(t);}finally{setTimeout(()=>{t.__tgMesgul=false;},0);}}if(!uygunMu(t))continue;if(!t.tHead.querySelector('.tg-filtre'))kur(t);else uygula(t);}};
  const bas=()=>{new MutationObserver(ms=>{for(const m of ms){if(m.target&&m.target.closest&&m.target.closest('.tg-filtre'))continue;const t=m.target.closest&&m.target.closest('table');if(t&&t.__tgMesgul)continue;bek.add(m.target.nodeType===1?m.target:m.target.parentElement);}if(!zam)zam=requestAnimationFrame(isle);})
    .observe(document.body,{childList:true,subtree:true});tara(document.body);};
  if(document.body)bas();else document.addEventListener('DOMContentLoaded',bas);
  window.__tablo={tara,durum};
})();
window.__mw={$,esc,N,toast,askConfirm,askText,Desk};   // ayrı dosyadaki modüller (yonetim.js) için ortak yardımcılar
})();
