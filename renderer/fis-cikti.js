/* MuhaWin fiş çıktısı ortak yardımcıları (Görev 53) – programdaki bütün fiş PDF / Excel çıktıları ve başka raporlar (ör. KDV2) kullanabilir.
Görev 53: fiş çıktıları (PDF / Excel) için ana hesap özeti ve imza alanları — tek yardımcı.
   Özet yalnız fişte aynı ana hesap (ilk 3 hane) birden fazla satırda geçiyorsa eklenir; imza alanları her zaman en altta.
   Luca'ya aktarım Excel'lerine eklenmez (içe aktarma biçimi bozulur). Ana hesap adı: firmanın hesap planı, yoksa Tek Düzen. */
(function(kok){
'use strict';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const r2=n=>Math.round(n*100)/100;
const TDHP_ANA={"100":"Kasa","101":"Alınan Çekler","102":"Bankalar","103":"Verilen Çekler ve Ödeme Emirleri (-)","108":"Diğer Hazır Değerler","120":"Alıcılar","121":"Alacak Senetleri","126":"Verilen Depozito ve Teminatlar","127":"Diğer Ticari Alacaklar","131":"Ortaklardan Alacaklar","136":"Diğer Çeşitli Alacaklar","150":"İlk Madde ve Malzeme","153":"Ticari Mallar","157":"Diğer Stoklar","159":"Verilen Sipariş Avansları","180":"Gelecek Aylara Ait Giderler","190":"Devreden KDV","191":"İndirilecek KDV","193":"Peşin Ödenen Vergiler ve Fonlar","195":"İş Avansları","196":"Personel Avansları","253":"Tesis, Makine ve Cihazlar","254":"Taşıtlar","255":"Demirbaşlar","257":"Birikmiş Amortismanlar (-)","260":"Haklar","300":"Banka Kredileri","309":"Diğer Mali Borçlar","320":"Satıcılar","321":"Borç Senetleri","326":"Alınan Depozito ve Teminatlar","329":"Diğer Ticari Borçlar","331":"Ortaklara Borçlar","335":"Personele Borçlar","336":"Diğer Çeşitli Borçlar","340":"Alınan Sipariş Avansları","360":"Ödenecek Vergi ve Fonlar","361":"Ödenecek Sosyal Güvenlik Kesintileri","391":"Hesaplanan KDV","392":"Diğer KDV","500":"Sermaye","600":"Yurtiçi Satışlar","601":"Yurtdışı Satışlar","602":"Diğer Gelirler","610":"Satıştan İadeler (-)","611":"Satış İskontoları (-)","612":"Diğer İndirimler (-)","620":"Satılan Mamuller Maliyeti (-)","621":"Satılan Ticari Mallar Maliyeti (-)","622":"Satılan Hizmet Maliyeti (-)","632":"Genel Yönetim Giderleri (-)","642":"Faiz Gelirleri","646":"Kambiyo Karları","649":"Diğer Olağan Gelir ve Karlar","653":"Komisyon Giderleri (-)","656":"Kambiyo Zararları (-)","659":"Diğer Olağan Gider ve Zararlar (-)","679":"Diğer Olağandışı Gelir ve Karlar","689":"Diğer Olağandışı Gider ve Zararlar (-)","760":"Pazarlama Satış ve Dağıtım Giderleri","770":"Genel Yönetim Giderleri","780":"Finansman Giderleri","790":"Gider Çeşitleri"};
function anaHesapOzeti(satirlar,adBul){const m=new Map();let tekrar=false;
  for(const x of satirlar||[]){const k=String(x.kod??'').trim().slice(0,3);if(!/^\d{3}$/.test(k))continue;
    const a=m.get(k)||{kod:k,ad:'',borc:0,alacak:0,n:0};a.borc+=+x.borc||0;a.alacak+=+x.alacak||0;a.n++;m.set(k,a);if(a.n>1)tekrar=true;}
  const L=[...m.values()].sort((a,b)=>a.kod.localeCompare(b.kod,'tr',{numeric:true}));
  for(const a of L){a.ad=String((adBul&&adBul(a.kod))||TDHP_ANA[a.kod]||'');a.borc=r2(a.borc);a.alacak=r2(a.alacak);}
  const tb=r2(L.reduce((t,a)=>t+a.borc,0)),ta=r2(L.reduce((t,a)=>t+a.alacak,0));
  return {goster:tekrar,L,tb,ta,denk:Math.abs(tb-ta)<0.005};}
const tl2=v=>Number(v||0).toLocaleString('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:2});
const IMZA_ALANLARI=['Hazırlayan','Kontrol Eden','Onaylayan'];
const FIS_EK_CSS=`.fisozet{margin-top:16px}.fisozet h2{font-size:13px;margin:0 0 6px}.fisozet .dengesiz{color:#b00020;font-weight:700}
  table.fisimza{width:100%;margin-top:34px;border-collapse:collapse;page-break-inside:avoid}table.fisimza td{border:0!important;width:33%;padding:0 18px 0 0;vertical-align:top}
  table.fisimza .ad{font-weight:700}table.fisimza .alan{margin-top:6px;color:#555;font-size:10px;line-height:2.2}table.fisimza .cizgi{display:inline-block;width:70%;border-bottom:1px solid #333}`;
function fisEkHtml(oz){const e=esc,n=v=>v?tl2(v):'';
  const ozet=oz&&oz.goster?`<div class="fisozet"><h2>Ana hesap özeti</h2><table><thead><tr><th>Ana hesap</th><th>Hesap adı</th><th class="n">Borç</th><th class="n">Alacak</th></tr></thead>
    <tbody>${oz.L.map(a=>`<tr><td class="kod">${e(a.kod)}</td><td>${e(a.ad)}</td><td class="n">${n(a.borc)}</td><td class="n">${n(a.alacak)}</td></tr>`).join('')}</tbody>
    <tfoot><tr><td colspan="2">Toplam · ${oz.denk?'borç = alacak':'<span class="dengesiz">fiş dengesiz (fark '+e(tl2(oz.tb-oz.ta))+')</span>'}</td><td class="n">${tl2(oz.tb)}</td><td class="n">${tl2(oz.ta)}</td></tr></tfoot></table></div>`:'';
  return ozet+`<table class="fisimza"><tr>${IMZA_ALANLARI.map(x=>`<td><div class="ad">${x}</div><div class="alan">Ad Soyad: <span class="cizgi"></span><br>Tarih: <span class="cizgi"></span><br>İmza: <span class="cizgi"></span></div></td>`).join('')}</tr></table>`;}
// Excel: fiş satırlarının altına (6 sütunlu fiş düzeninde borç / alacak 5. ve 6. sütunda)
function fisEkAoa(oz){const R=[[]];
  if(oz&&oz.goster){R.push(['Ana hesap özeti']);R.push(['Ana hesap','Hesap adı','','','Borç','Alacak']);
    for(const a of oz.L)R.push([a.kod,a.ad,'','',a.borc,a.alacak]);R.push(['Toplam',oz.denk?'borç = alacak':'fiş dengesiz (fark '+tl2(oz.tb-oz.ta)+')','','',oz.tb,oz.ta]);R.push([]);}
  R.push(IMZA_ALANLARI.flatMap(x=>[x,'']));R.push(IMZA_ALANLARI.flatMap(()=>['Ad Soyad:','']));R.push(IMZA_ALANLARI.flatMap(()=>['Tarih:','']));R.push(IMZA_ALANLARI.flatMap(()=>['İmza:','']));
  return R;}
kok.FisCikti={TDHP_ANA,anaHesapOzeti,tl2,IMZA_ALANLARI,FIS_EK_CSS,fisEkHtml,fisEkAoa};
if(typeof module!=='undefined'&&module.exports)module.exports=kok.FisCikti;
})(typeof window!=='undefined'?window:globalThis);
