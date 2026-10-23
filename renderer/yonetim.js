/* =====================================================================
   MuhaWin · Yönetim modülü — yalnız program sahibi (bilgi@smmmantalya.com)
   Üyeler, üye fatura bilgileri, lisans / deneme işlemleri, satış ve tahsilat kayıtları,
   lisans kodu partileri, ayarlar ve duyuru, işlem günlüğü.
   Yetki sunucuda denetlenir (sunucu/supabase-yonetim.sql); bu ekran yalnız arayüzdür.
   ===================================================================== */
const ADM=(()=>{
  const {$,esc,N,toast,askConfirm,askText}=window.__mw;const Desk=window.__mw.Desk;
  const D=window.desktop;
  const call=(fn,a)=>D.admin(fn,a||{});
  const cErr=e=>String(e&&e.message||e).replace(/^Error invoking remote method '[^']+': (Error: )?/,'');
  const eskiMi=e=>/supabase-yonetim\.sql/.test(cErr(e));
  const MODAD={fatura:'Muhasebe İşlemleri',ekstre:'Banka İşlemleri',okc:'Belgeden Fiş',ozel:'Ofisinize Özel Çözümler',denetim:'Denetim ve Analiz',gecici:'Geçici Vergi İşlemleri',personel:'Personel'};
  const LISANSLI=['ekstre'];        // TEK LİSANS (2.9.0): lisans / deneme / kod 'ekstre' kaydında tutulur, tüm modülleri açar
  const LISAD={ekstre:'MuhaWin lisansı (tüm modüller)'};
  const OZEL=[{id:'cek',ad:'Çek / Senet Kayıtları'},{id:'mikro',ad:'Mikro Denetim'}];             // Ofisinize Özel Çözümler kataloğu
  const EYLEM={bilgi:'Bilgi düzenlendi',deneme:'Deneme süresi',lisans:'Lisans verildi',bitis:'Bitiş tarihi ayarlandı',lisans_bitir:'Lisans bitirildi',kapat:'Hesap kapatıldı',ac:'Hesap açıldı',
    pin_hata:'Yönetim şifresi hatalı',pin_giris:'Yönetime giriş',pin_degisti:'Yönetim şifresi değişti',ozel:'Özel çözüm tanımı',
    pc_sifirla:'Bilgisayarlar sıfırlandı',pc_sil:'Bilgisayar silindi',sil:'Üyelik silindi',satis:'Satış kaydı',satis_duzelt:'Satış düzeltildi',satis_sil:'Satış silindi',kod_uret:'Lisans kodu üretildi',ayar:'Ayarlar değişti'};
  const YONTEM=['Havale / EFT','Kredi kartı','Nakit','Çek','Diğer'];
  const st={tab:'pano',users:[],dash:null,pays:[],batches:[],ayar:null,log:[],eski:false,yuk:false,hata:'',
    q:'',durum:'',mod:'fatura',sira:'yeni',pf:{aralik:'yil',bas:'',bit:'',durum:''},sonKod:null,acik:null};
  const tl=n=>Number(n||0).toLocaleString('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:2});
  const trD=s=>{if(!s)return '—';const d=new Date(String(s).length===10?s+'T12:00:00':s);return isNaN(d)?'—':d.toLocaleDateString('tr-TR');};
  const trDT=s=>s?new Date(s).toLocaleString('tr-TR',{dateStyle:'short',timeStyle:'short'}):'—';
  const iso=d=>{const x=new Date(d);return x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0');};
  const bugun=()=>iso(new Date());
  const r2=n=>Math.round((+n||0)*100)/100;
  const toplam=p=>r2((+p.tutar||0)*(1+(+p.kdv_orani||0)/100));
  const modlar=()=>LISANSLI;
  const mad=m=>LISAD[m]||MODAD[m]||m;
  const uyeAd=u=>{const r=u.reg||{},f=u.fatura||{};return f.unvan||r.buro||'';};
  const bul=id=>st.users.find(u=>u.id===id);

  /* ---- modül durumu ---- */
  // tek lisans: tüm modül kayıtlarının en iyisi (sunucu güncellenmeden önce de doğru görünsün)
  function ms(u,m){
    const L=Object.values(u.modules||{}).filter(x=>x&&x.active!==false&&x.type!=='soon');
    if(!L.length)return {valid:u.valid,type:u.type,daysLeft:u.daysLeft,expires:u.expires,license_end:u.license_end,trial_end:u.trial_end};
    const en=a=>a.sort((x,y)=>(y.daysLeft||0)-(x.daysLeft||0))[0];
    return en(L.filter(x=>x.valid&&x.type==='pool'))||en(L.filter(x=>x.valid))||L.find(x=>x.type==='disabled')||en(L.filter(x=>x.type==='pool'&&x.expired))||L.find(x=>x.trialExpired)||L.find(x=>x.trialAvailable)||L[0];}
  function durum(u,m){
    if(u.disabled)return 'kapali';const x=ms(u,m);
    if(x.type==='soon')return 'yok';
    if(x.valid&&x.type==='pool')return 'lisansli';
    if(x.valid)return 'deneme';
    if(x.trialAvailable)return 'kullanmadi';
    return 'doldu';
  }
  const DURUM={lisansli:['kural','lisanslı'],deneme:['cari','deneme'],doldu:['aski','süresi doldu'],kullanmadi:['','kullanmadı'],kapali:['warn','kapalı'],yok:['','—']};
  function chip(u,m,uzun){const d=durum(u,m);const [c,t]=DURUM[d];const x=ms(u,m);
    const ek=uzun&&(d==='lisansli'||d==='deneme')?` · ${x.daysLeft} gün`:'';
    const bit=x.expires||((x.type==='pool'?x.license_end:x.trial_end)||'').slice(0,10);
    return `<span class="chip ${c}" title="${esc(mad(m)+': '+t+(bit?' · bitiş '+trD(bit):''))}">${esc(t+ek)}</span>`;}
  const bitecek=u=>!u.disabled&&modlar().some(m=>{const x=ms(u,m);return x.valid&&x.type==='pool'&&x.daysLeft<=30;});

  /* ---- yükleme ---- */
  async function yukle(neler){
    st.yuk=true;st.hata='';ciz();
    const N=new Set(neler||['users','dash','ayar']);
    try{
      const isler=[];
      if(N.has('users'))isler.push(call('admin_users').then(x=>{st.users=x||[];}));
      if(N.has('ayar'))isler.push(call('admin_settings').then(x=>{st.ayar=x;st.eski=false;}).catch(e=>{if(eskiMi(e))st.eski=true;else throw e;}));
      await Promise.all(isler);
      if(!st.eski){
        const b=[];
        if(N.has('dash'))b.push(call('admin_dashboard').then(x=>{st.dash=x;}));
        if(N.has('pays'))b.push(call('admin_payments',payAralik()).then(x=>{st.pays=x||[];}));
        if(N.has('kod'))b.push(call('admin_code_batches').then(x=>{st.batches=x||[];}));
        if(N.has('log'))b.push(call('admin_log_list',{p_limit:500}).then(x=>{st.log=x||[];}));
        if(N.has('ofis'))b.push(call('admin_offices').then(x=>{st.ofisler=x||[];st.ofisEski=false;}).catch(e=>{if(eskiMi(e))st.ofisEski=true;else throw e;}));
        await Promise.all(b);
      }
    }catch(e){st.hata=cErr(e);}
    st.yuk=false;ciz();
  }
  function payAralik(){const p=st.pf;const y=new Date().getFullYear(),m=new Date().getMonth();
    if(p.aralik==='ay')return {p_from:iso(new Date(y,m,1)),p_to:iso(new Date(y,m+1,0))};
    if(p.aralik==='yil')return {p_from:y+'-01-01',p_to:y+'-12-31'};
    if(p.aralik==='gecenyil')return {p_from:(y-1)+'-01-01',p_to:(y-1)+'-12-31'};
    if(p.aralik==='ozel')return {p_from:p.bas||null,p_to:p.bit||null};
    return {p_from:null,p_to:null};}

  /* ---- panel ---- */
  const SEKME=[['pano','Pano'],['uyeler','Üyeler'],['ofis','Ofisler ve özel çözümler'],['satis','Satışlar ve tahsilat'],['kod','Lisans kodları'],['ayar','Ayarlar ve duyuru'],['log','İşlem günlüğü']];
  function show(){$('#admPanel').hidden=false;if(!st.acikKilit){kilitCiz();return;}if(!st.users.length&&!st.yuk)yukle(['users','dash','ayar']);else ciz();}
  function hide(){const P=$('#admPanel');if(P)P.hidden=true;kapat();if(st.acikKilit){st.acikKilit=false;D.adminLock().catch(()=>{});}}
  /* ---- giriş şifresi ---- */
  function kilitCiz(hata){
    $('#admTabs').innerHTML='';
    $('#admBody').innerHTML=`<section class="admkart admkilit"><h3>Yönetim şifresi</h3><p class="note" style="margin:0 0 10px">Yönetim modülüne girmek için şifrenizi yazın.</p>
      <div class="actions"><input type="password" id="admPin" autocomplete="off" style="max-width:220px" aria-label="Yönetim şifresi"><button class="btn primary" id="admPinGo">Gir</button></div>
      <p class="note err" id="admPinE" style="margin:6px 0 0">${esc(hata||'')}</p></section>`;
    setTimeout(()=>{const i=$('#admPin');if(i)i.focus();},30);
  }
  async function kilitAc(){
    const i=$('#admPin');const e=$('#admPinE');if(!i)return;const pin=i.value;if(!pin){e.textContent='Şifreyi yazın.';return;}
    $('#admPinGo').disabled=true;
    try{const r=await D.adminUnlock(pin);
      if(r&&r.ok){st.acikKilit=true;if(r.yerel)st.yerelPin=true;show();
        if(r.varsayilan)toast('İlk şifre (55555) kullanılıyor; Ayarlar ve duyuru sekmesinden değiştirebilirsiniz.');return;}
      kilitCiz((r&&r.reason)||'Şifre hatalı.');}
    catch(x){kilitCiz(cErr(x));}
  }
  function sekme(t){st.tab=t;
    const gerek={satis:['pays'],kod:['kod'],log:['log'],pano:['dash'],ofis:['ofis']}[t];
    if(gerek&&!st.eski)yukle(gerek);else ciz();}
  function ciz(){
    const P=$('#admPanel');if(!P||P.hidden)return;
    $('#admTabs').innerHTML=SEKME.map(([k,v])=>`<button class="btn small" data-admtab="${k}" aria-pressed="${st.tab===k}">${esc(v)}${k==='uyeler'&&st.users.length?` <span class="count">${st.users.length}</span>`:''}</button>`).join('');
    const B=$('#admBody');
    const ust=(st.eski?`<div class="banner">Lisans sunucusunda yönetim güncellemesi yok. Supabase paneli → <b>SQL Editor</b> → New query → program klasöründeki <b>sunucu/supabase-yonetim.sql</b> dosyasının tamamını yapıştırıp <b>Run</b>'a basın. O zamana kadar yalnız üye listesi ve temel lisans işlemleri çalışır.</div>`:'')
      +(st.hata?`<div class="banner">${esc(st.hata)}</div>`:'')+(st.yuk?'<p class="note">Yükleniyor…</p>':'');
    const f={pano:pano,uyeler:uyeler,ofis:ofisler,satis:satislar,kod:kodlar,ayar:ayarlar,log:gunluk}[st.tab]||pano;
    B.innerHTML=ust+(st.eski&&!['uyeler','kod'].includes(st.tab)&&st.tab!=='pano'?'':f());
    if(st.tab==='uyeler'&&st._odak!=null){const q=$('#admQ');if(q){q.focus();q.setSelectionRange(st._odak,st._odak);}st._odak=null;}
  }

  /* ---- pano ---- */
  function pano(){
    const U=st.users,d=st.dash||{};const M=modlar();
    const say=(m,k)=>U.filter(u=>durum(u,m)===k).length;
    const tile=(k,v,f,ipucu)=>`<button class="stat admstat" ${f?`data-admf="${f}"`:'disabled'} title="${esc(ipucu||'')}"><div class="k">${esc(k)}</div><div class="v">${v}</div></button>`;
    const now=Date.now();
    const aktif7=d.aktif_7!=null?d.aktif_7:U.filter(u=>u.last_seen&&now-new Date(u.last_seen)<7*864e5).length;
    const ayl=d.aylik||[];const mx=Math.max(1,...ayl.map(a=>+a.uye||0)),mt=Math.max(1,...ayl.map(a=>+a.tahsil||0));
    const AY=['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'];
    const kodl=d.kodlar||{};
    const bit=(d.bitecek||[]).slice(0,30);
    return `<div class="stats admstats">
        ${tile('Üye',U.length,'tum')}${tile('Bu ay yeni',d.yeni_ay??'—','yeni')}${tile('Son 7 gün aktif',aktif7,'aktif')}${tile('Son 30 gün aktif',d.aktif_30??'—','aktif30')}
        ${tile('30 gün içinde bitecek',U.filter(bitecek).length,'bitecek','Herhangi bir modül lisansı 30 gün içinde bitecek üyeler')}${tile('Doğrulanmamış',U.filter(u=>u.confirmed===false).length,'dogrulanmamis')}${tile('Kapalı hesap',U.filter(u=>u.disabled).length,'kapali')}${tile('Ofis',d.ofis??'—','')}
        ${st.eski?'':tile('Tahsilat · bu ay',tl(d.tahsil_ay)+' ₺','')+tile('Tahsilat · bu yıl',tl(d.tahsil_yil)+' ₺','')+tile('Bekleyen tahsilat',tl(d.bekleyen)+' ₺'+(d.bekleyen_adet?` <small>(${d.bekleyen_adet})</small>`:''),'odeme')}
      </div>
      <div class="admgrid">
        <section class="admkart"><h3>Lisans durumu <span class="note">— tek lisans tüm modülleri açar</span></h3><table class="admt tg-yok"><thead><tr><th></th><th>Lisanslı</th><th>Denemede</th><th>Süresi doldu</th><th>Kullanmadı</th><th>Kod (kullanılan / toplam)</th></tr></thead><tbody>
          ${M.map(m=>`<tr><td>${esc(mad(m))}</td>${['lisansli','deneme','doldu','kullanmadi'].map(k=>`<td><button class="lnk" data-admf="${k}" data-admm="${m}">${say(m,k)}</button></td>`).join('')}<td class="mono">${(()=>{const v=Object.values(kodl);return v.length?v.reduce((a,x)=>a+(+x.used||0),0)+' / '+v.reduce((a,x)=>a+(+x.total||0),0):'—';})()}</td></tr>`).join('')}
        </tbody></table></section>
        ${ayl.length?`<section class="admkart"><h3>Son 12 ay</h3><div class="admbar">${ayl.map(a=>{const [y,m]=a.ay.split('-');return `<div class="ab" title="${esc(AY[+m-1]+' '+y+': '+a.uye+' yeni üye · '+tl(a.tahsil)+' ₺ tahsilat')}"><i class="u" style="height:${Math.round(100*(+a.uye||0)/mx)}%"></i><i class="t" style="height:${Math.round(100*(+a.tahsil||0)/mt)}%"></i><span>${AY[+m-1]}</span></div>`;}).join('')}</div>
          <p class="note" style="margin:6px 0 0"><span class="admlg u"></span> yeni üye &nbsp; <span class="admlg t"></span> tahsilat</p></section>`:''}
        <section class="admkart"><h3>30 gün içinde bitecek lisanslar</h3>${bit.length?`<table class="admt tg-yok"><tbody>${bit.map(b=>`<tr><td><button class="lnk" data-admu="${esc(b.user_id)}">${esc(b.buro||b.email)}</button><br><span class="note">${esc(b.email)}</span></td><td>${esc(mad(b.module))}</td><td class="mono">${trD(b.ends_at)}</td><td><button class="btn small" data-admsat="${esc(b.user_id)}" data-admm="${esc(b.module)}">Uzat / sat</button></td></tr>`).join('')}</tbody></table>`:'<p class="note">Yok.</p>'}</section>
        <section class="admkart"><h3>Son üyeler</h3>${(d.son_uyeler||U.slice(0,8)).map(x=>`<div class="admsatir"><button class="lnk" data-admu="${esc(x.id)}">${esc(x.buro||(x.reg||{}).buro||x.email)}</button><span class="note">${esc(x.email)} · ${trD(x.created_at)}</span></div>`).join('')||'<p class="note">Yok.</p>'}</section>
        ${d.surumler&&Object.keys(d.surumler).length?`<section class="admkart"><h3>Kullanılan sürümler <span class="note">(son 30 gün)</span></h3>${Object.entries(d.surumler).sort((a,b)=>String(b[0]).localeCompare(String(a[0]),'tr',{numeric:true})).map(([v,n])=>`<div class="admsatir"><span class="mono">${esc(v)}</span><b>${n}</b></div>`).join('')}</section>`:''}
      </div>`;
  }

  /* ---- üyeler ---- */
  function suzulmus(){
    const q=N(st.q);const m=st.mod;const now=Date.now();
    let L=st.users.filter(u=>{
      if(q){const r=u.reg||{},f=u.fatura||{};if(!N([u.email,r.buro,r.yetkili,r.telefon,r.vkn,f.unvan,f.vkn,u.admin_note,(u.office||{}).name].join(' ')).includes(q))return false;}
      const d=st.durum;if(!d||d==='tum')return true;
      if(d==='bitecek')return bitecek(u);
      if(d==='dogrulanmamis')return u.confirmed===false;
      if(d==='kapali')return !!u.disabled;
      if(d==='aktif')return u.last_seen&&now-new Date(u.last_seen)<7*864e5;
      if(d==='aktif30')return u.last_seen&&now-new Date(u.last_seen)<30*864e5;
      if(d==='yeni'){const a=new Date();return new Date(u.created_at)>=new Date(a.getFullYear(),a.getMonth(),1);}
      if(d==='odeme')return +u.due>0;
      if(d==='ofis')return !!u.office;
      return durum(u,m)===d;});
    const S_={yeni:(a,b)=>String(b.created_at).localeCompare(String(a.created_at)),giris:(a,b)=>String(b.last_seen||'').localeCompare(String(a.last_seen||'')),
      ad:(a,b)=>String(uyeAd(a)||a.email).localeCompare(String(uyeAd(b)||b.email),'tr'),bitis:(a,b)=>bitisOf(a)-bitisOf(b),odeme:(a,b)=>(+b.paid||0)-(+a.paid||0)};
    return L.sort(S_[st.sira]||S_.yeni);
  }
  function bitisOf(u){const x=ms(u,st.mod);const e=x.type==='pool'?x.license_end:x.trial_end;return e?new Date(e).getTime():9e15;}
  function uyeler(){
    const L=suzulmus();const M=modlar();
    const opt=(v,t,c)=>`<option value="${v}"${c===v?' selected':''}>${esc(t)}</option>`;
    return `<div class="actions admfiltre">
        <input type="search" id="admQ" placeholder="e-posta, büro, unvan, VKN, telefon, not ara" value="${esc(st.q)}" style="flex:1;min-width:220px">
        <label class="note" for="admMod">Modül</label><select id="admMod" style="width:auto">${M.map(m=>opt(m,mad(m),st.mod)).join('')}</select>
        <select id="admDurum" style="width:auto" aria-label="Durum">${[['','Tüm üyeler'],['lisansli','Lisanslı'],['deneme','Denemede'],['doldu','Süresi doldu'],['kullanmadi','Modülü hiç açmadı'],['bitecek','30 gün içinde bitecek'],['odeme','Ödemesi bekleyen'],['aktif','Son 7 gün aktif'],['aktif30','Son 30 gün aktif'],['yeni','Bu ay üye olan'],['ofis','Ofise bağlı'],['dogrulanmamis','E-postası doğrulanmamış'],['kapali','Hesabı kapalı']].map(([v,t])=>opt(v,t,st.durum)).join('')}</select>
        <select id="admSira" style="width:auto" aria-label="Sıralama">${[['yeni','Yeni üye önce'],['giris','Son giriş'],['ad','Ada göre'],['bitis','Bitişi yakın önce'],['odeme','Tahsilatı çok önce']].map(([v,t])=>opt(v,t,st.sira)).join('')}</select>
        <span class="note">${L.length} üye</span>
        <button class="btn small" id="admXls">Excel'e aktar</button><button class="btn small" id="admMail" title="Listedeki üyelerin e-posta adreslerini kopyalar">E-postaları kopyala</button>
        <button class="btn small primary" data-admsat="">+ Satış / lisans</button></div>
      <div class="tablewrap admtw"><table class="admt tg-yok admuye"><thead><tr><th>Üye</th><th>Ofis</th>${M.map(m=>`<th title="MuhaWin lisansı (tüm modüller)">Lisans</th>`).join('')}<th>Son giriş</th><th>PC</th>${st.eski?'':'<th class="num">Tahsilat</th>'}<th></th></tr></thead><tbody>
      ${L.slice(0,800).map(u=>{const r=u.reg||{};const o=u.office;
        return `<tr data-admu="${esc(u.id)}" class="${u.disabled?'admkapali':''}"><td><b>${esc(uyeAd(u)||'(büro bilgisi yok)')}</b>${u.confirmed===false?' <span class="chip warn">doğrulanmadı</span>':''}${u.admin_note?' <span class="chip man" title="'+esc(u.admin_note)+'">not</span>':''}<br><span class="note">${esc(u.email||'')}${r.yetkili?' · '+esc(r.yetkili):''}${r.telefon?' · '+esc(r.telefon):''}</span></td>
          <td>${o?`${esc(o.name)}<br><span class="note">${o.is_owner?'sahibi':o.role==='yonetici'?'yönetici':'çalışan'}</span>`:'<span class="note">—</span>'}</td>
          ${M.map(m=>`<td>${chip(u,m)}</td>`).join('')}
          <td class="mono">${trD(u.last_seen)}<br><span class="note">${esc(u.app_version||'')}</span></td><td class="mono">${u.devices||0}</td>
          ${st.eski?'':`<td class="num mono">${+u.paid?tl(u.paid):'—'}${+u.due?`<br><span class="chip aski">${tl(u.due)} bekliyor</span>`:''}</td>`}
          <td><button class="btn small" data-admu="${esc(u.id)}">Aç</button></td></tr>`;}).join('')||`<tr><td colspan="${M.length+6}" class="empty">Üye yok.</td></tr>`}
      </tbody></table></div>${L.length>800?'<p class="note">İlk 800 üye gösteriliyor; aramayı daraltın.</p>':''}`;
  }

  /* ---- üye ayrıntısı ---- */
  const MB=()=>$('#admModalB');
  function ac(baslik,html,genis){const m=$('#admModal');$('#admModalT').textContent=baslik;MB().innerHTML=html;m.querySelector('.mbox').style.width=genis?'min(1120px,100%)':'min(720px,100%)';m.hidden=false;MB().scrollTop=0;}
  function kapat(){const m=$('#admModal');if(m)m.hidden=true;st.acik=null;}
  const FATURA=[['unvan','Unvan / ad soyad',''],['vkn','VKN / TCKN',''],['vd','Vergi dairesi',''],['adres','Adres','tam'],['il','İl',''],['ilce','İlçe',''],['eposta','Fatura e-postası',''],['telefon','Telefon',''],['efatura','e-Fatura mükellefi','sec']];
  function faturaVarsayilan(u){const r=u.reg||{},f=u.fatura||{};
    return {unvan:f.unvan??r.buro??'',vkn:f.vkn??r.vkn??'',vd:f.vd??r.vd??'',adres:f.adres??r.adres??'',il:f.il??r.il??'',ilce:f.ilce??'',eposta:f.eposta??r.eposta??u.email??'',telefon:f.telefon??r.telefon??'',efatura:f.efatura??''};}
  function faturaMetin(u){const f=faturaVarsayilan(u);return [f.unvan,f.vkn?'VKN/TCKN: '+f.vkn:'',f.vd?'Vergi dairesi: '+f.vd:'',[f.adres,f.ilce,f.il].filter(Boolean).join(' '),f.eposta?'E-posta: '+f.eposta:'',f.telefon?'Tel: '+f.telefon:'',f.efatura==='evet'?'e-Fatura mükellefi':f.efatura==='hayir'?'e-Arşiv (e-Fatura mükellefi değil)':''].filter(Boolean).join('\n');}
  async function detay(id){
    st.acik=id;let u=bul(id)||{id};
    ac(u.email||'Üye','<p class="note">Yükleniyor…</p>',true);
    if(!st.eski){try{u={...u,...(await call('admin_user_detail',{p_user:id}))};const i=st.users.findIndex(x=>x.id===id);if(i>=0)st.users[i]={...st.users[i],...u};}
      catch(e){if(eskiMi(e))st.eski=true;else{MB().innerHTML=`<p class="err">${esc(cErr(e))}</p>`;return;}}}
    if(st.acik!==id)return;
    detayCiz(u);
  }
  function detayCiz(u){
    const r=u.reg||{};const fv=faturaVarsayilan(u);const M=modlar();const o=u.office_detail||u.office;
    const REG=[['buro','Büro / firma adı'],['yetkili','Yetkili'],['telefon','Telefon'],['eposta','E-posta'],['vd','Vergi dairesi'],['vkn','VKN/TCKN'],['adres','Adres'],['il','İl']];
    $('#admModalT').textContent=(uyeAd(u)||u.email||'Üye');
    MB().innerHTML=`
      <div class="admust"><div><b>${esc(u.email||'')}</b>${u.confirmed===false?' <span class="chip warn">e-posta doğrulanmadı</span>':''}${u.disabled?' <span class="chip warn">hesap kapalı</span>':''}
        <div class="note">Üyelik ${trD(u.created_at)} · son giriş ${trDT(u.last_seen)} · sürüm ${esc(u.app_version||'—')} · ${u.devices||0} bilgisayar${u.disabled&&u.note?' · kapatma notu: '+esc(u.note):''}</div></div>
        <div class="rowbtns"><button class="btn small" data-admd="mail">E-posta yaz</button><button class="btn small primary" data-admsat="${esc(u.id)}">+ Satış / lisans</button></div></div>
      <section class="admbolum"><h3>Modüller ve lisanslar</h3><table class="admt tg-yok"><thead><tr><th>Modül</th><th>Durum</th><th>Bitiş</th><th></th></tr></thead><tbody>
        ${M.map(m=>{const x=ms(u,m);const e=x.type==='pool'?x.license_end:x.trial_end;return `<tr><td>${esc(mad(m))}</td><td>${chip(u,m,true)}</td><td class="mono">${trD(x.expires||e)}</td>
          <td><div class="rowbtns"><button class="btn small" data-admd="trial" data-m="${m}">Deneme</button><button class="btn small" data-admd="grant" data-m="${m}">Lisans ver</button>${st.eski?'':`<button class="btn small" data-admd="bitis" data-m="${m}">Bitiş tarihi</button>`}<button class="btn small ghost danger" data-admd="end" data-m="${m}">Bitir</button></div></td></tr>`;}).join('')}
      </tbody></table>
      ${(u.licenses||[]).length?`<details><summary class="note" style="cursor:pointer">Lisans geçmişi (${u.licenses.length})</summary><table class="admt tg-yok"><thead><tr><th>Modül</th><th>Kaynak</th><th>Başlangıç</th><th>Bitiş</th><th>Not</th></tr></thead><tbody>${u.licenses.map(l=>`<tr><td>${esc(mad(l.module))}</td><td>${l.source==='kod'?'lisans kodu':'yönetici'}</td><td class="mono">${trD(l.starts_at)}</td><td class="mono">${trD(l.ends_at)}</td><td>${esc(l.note||'')}</td></tr>`).join('')}</tbody></table></details>`:''}
      ${o&&o.name?`<p class="note" style="margin:6px 0 0">Ofis: <b>${esc(o.name)}</b> · Luca üye no ${esc(o.luca_uye_no||'')}${o.owner_email?' · sahibi '+esc(o.owner_email):''} — ofis çalışanları ofis sahibinin lisansını kullanır.</p>
        ${st.eski||!o.id?'':`<div class="actions"><span class="note">Ofisinize özel çözümler:</span>${ozelKutular(o)}</div>`}`:''}
      ${u.office_detail&&(u.office_detail.members||[]).length>1?`<div class="admuyeler">${u.office_detail.members.map(x=>`<button class="lnk" data-admu="${esc(x.user_id)}">${esc(x.email)}</button><span class="note">${x.is_owner?'sahibi':x.role==='yonetici'?'yönetici':'çalışan'} · ${trD(x.last_seen)}</span>`).join('')}</div>`:''}
      </section>
      <section class="admbolum"><h3>Fatura bilgileri <span class="note">— üyenin girdiği büro bilgilerinden doldurulur; düzeltebilirsiniz</span></h3>
        <div class="outgrid">${FATURA.map(([k,l,t])=>`<div style="${t==='tam'?'grid-column:1/-1':''}"><label class="lbl" for="admF_${k}">${esc(l)}</label>${t==='sec'?`<select id="admF_${k}"><option value="">—</option><option value="evet"${fv[k]==='evet'?' selected':''}>Evet (e-Fatura)</option><option value="hayir"${fv[k]==='hayir'?' selected':''}>Hayır (e-Arşiv)</option></select>`:`<input type="text" id="admF_${k}" value="${esc(fv[k]||'')}">`}</div>`).join('')}</div>
        <label class="lbl" for="admNot" style="margin-top:8px">Yönetici notu (yalnız siz görürsünüz)</label><textarea id="admNot" rows="2" style="width:100%;box-sizing:border-box">${esc(u.admin_note||'')}</textarea>
        <div class="actions"><button class="btn primary" data-admd="kaydet"${st.eski?' disabled title="Sunucu güncellemesi gerekli"':''}>Kaydet</button><button class="btn" data-admd="kopyala">Fatura bilgilerini kopyala</button><span class="note" id="admKayitMsg"></span></div>
        <details><summary class="note" style="cursor:pointer">Üyenin girdiği büro bilgileri</summary><div class="admreg">${REG.map(([k,l])=>`<span class="note">${esc(l)}</span><span>${esc(r[k]||'—')}</span>`).join('')}${r.not?`<span class="note">Not</span><span>${esc(r.not)}</span>`:''}</div></details>
      </section>
      ${st.eski?'':`<section class="admbolum"><h3>Satışlar ve tahsilat</h3>${(u.payments||[]).length?satisTablo(u.payments,true):'<p class="note">Bu üyeye satış kaydı yok.</p>'}</section>`}
      <section class="admbolum"><h3>Bilgisayarlar</h3>${(u.device_list||[]).length?`<table class="admt tg-yok"><thead><tr><th>Bilgisayar</th><th>İlk giriş</th><th>Son giriş</th><th></th></tr></thead><tbody>${u.device_list.map(d=>`<tr><td>${esc(d.name||'(adsız)')}</td><td class="mono">${trDT(d.first_seen)}</td><td class="mono">${trDT(d.last_seen)}</td><td><button class="btn small ghost danger" data-admd="pcsil" data-pc="${esc(d.device_id)}">Sil</button></td></tr>`).join('')}</tbody></table>`:`<p class="note">${u.devices?u.devices+' bilgisayar kayıtlı.':'Kayıtlı bilgisayar yok.'}</p>`}
        <div class="actions"><button class="btn small" data-admd="dev">Tüm bilgisayarları sıfırla</button><span class="note">Üye bilgisayar değiştirdiyse sıfırlayın; yeni bilgisayardan girebilir.</span></div></section>
      ${(u.log||[]).length?`<section class="admbolum"><h3>İşlem geçmişi</h3><table class="admt tg-yok"><tbody>${u.log.slice(0,40).map(g=>`<tr><td class="mono">${trDT(g.at)}</td><td>${esc(EYLEM[g.action]||g.action)}</td><td class="note">${esc(detayMetin(g.detail))}</td></tr>`).join('')}</tbody></table></section>`:''}
      <section class="admbolum admtehlike"><h3>Hesap</h3><div class="actions"><button class="btn small${u.disabled?' primary':' ghost danger'}" data-admd="dis">${u.disabled?'Hesabı aç':'Hesabı kapat'}</button>${st.eski?'':'<button class="btn small dangerfill" data-admd="sil">Üyeliği sil…</button>'}<span class="note">Kapatılan hesap programa giremez; silme geri alınamaz (satış kayıtları e-postasıyla kalır).</span></div></section>`;
  }
  function detayMetin(d){if(!d)return '';const p=[];if(d.modul)p.push(mad(d.modul));if(d.ofis)p.push(d.ofis);if(d.ozel)p.push((d.ozel||[]).map(x=>(OZEL.find(o=>o.id===x)||{ad:x}).ad).join(', ')||'özel çözüm kaldırıldı');if(d.gun)p.push(d.gun+' gün');if(d.tarih)p.push(trD(d.tarih));if(d.tutar!=null)p.push(tl(d.tutar)+' ₺');if(d.adet!=null)p.push(d.adet+' kod');if(d.parti)p.push(d.parti);if(d.pc)p.push(d.pc);if(d.not)p.push(d.not);if(d.durum)p.push(d.durum);if(d.email)p.push(d.email);return p.join(' · ');}
  async function detayIslem(k,b){
    const id=st.acik;const u=bul(id)||{};const m=b&&b.dataset.m;const ch=Desk.choose;const yenile=async()=>{await yukle(['users']);await detay(id);};
    try{
      if(k==='mail'){D.openMail('mailto:'+encodeURIComponent(u.email||'')+'?subject='+encodeURIComponent('MuhaWin'));return;}
      if(k==='kopyala'){const f=formFatura();try{await navigator.clipboard.writeText(faturaMetin({...u,fatura:f}));toast('Fatura bilgileri kopyalandı.');}catch(x){toast('Kopyalanamadı.');}return;}
      if(k==='kaydet'){const r=await call('admin_user_update',{p_user:id,p_fatura:formFatura(),p_admin_note:$('#admNot').value.trim()});const i=st.users.findIndex(x=>x.id===id);if(i>=0)st.users[i]={...st.users[i],...r};const el=$('#admKayitMsg');if(el)el.textContent='Kaydedildi.';toast('Üye bilgileri kaydedildi.');return;}
      if(k==='trial'){const v=await ch('Deneme · '+mad(m),u.email+'\nDeneme süresi bugünden itibaren kaç gün olsun?',[{label:'7 gün',value:7},{label:'14 gün',value:14},{label:'30 gün',value:30},{label:'Bitir (0)',value:0},{label:'Vazgeç',value:null}]);if(v==null)return;
        await call('admin_set_trial',{p_user:id,p_days_from_now:v,p_module:m});}
      else if(k==='grant'){let v=await ch('Lisans ver · '+mad(m),u.email+'\nMevcut süreye eklenir. Ücretli satışsa "+ Satış / lisans" ile kaydedin; tahsilat da izlenir.',[{label:'1 yıl',value:365,primary:true},{label:'6 ay',value:182},{label:'3 ay',value:91},{label:'1 ay',value:30},{label:'Başka…',value:'x'},{label:'Vazgeç',value:null}]);if(v==null)return;
        if(v==='x'){const t=await askText('Lisans ver · '+mad(m),'Kaç gün eklensin?','365','Lisans ver');if(t==null)return;v=parseInt(t,10);if(!(v>0)){toast('Geçerli bir gün sayısı yazın.');return;}}
        const not=await askText('Lisans notu','İsteğe bağlı (ör. hediye, deneme uzatma, kampanya)','yönetici','Lisansı ver');if(not==null)return;
        await call('admin_grant',{p_user:id,p_days:v,p_note:not||'yönetici',p_module:m});}
      else if(k==='bitis'){const x=ms(u,m);const e=(x.type==='pool'?x.license_end:null)||'';const t=await tarihSor('Bitiş tarihi · '+mad(m),u.email+' — lisans bu tarihin sonunda biter (kısaltır ya da uzatır).',e?iso(e):iso(Date.now()+365*864e5));if(!t)return;
        await call('admin_set_license_end',{p_user:id,p_module:m,p_end:t});}
      else if(k==='end'){if(!(await askConfirm('Lisans bitirilsin mi?',u.email+' kullanıcısının '+mad(m)+' lisansı bugün itibarıyla sona erecek.','Evet, bitir')))return;await call('admin_end_license',{p_user:id,p_module:m});}
      else if(k==='dev'){if(!(await askConfirm('Bilgisayarlar sıfırlansın mı?',u.email+' hesabına kayıtlı tüm bilgisayarlar silinir; üye yeniden girdiğinde yeni bilgisayar kaydedilir.','Evet, sıfırla')))return;await call('admin_reset_devices',{p_user:id});}
      else if(k==='pcsil'){await call('admin_remove_device',{p_user:id,p_device:b.dataset.pc});}
      else if(k==='dis'){let not=null;if(!u.disabled){not=await askText('Hesap kapatılsın mı?',u.email+' programa giremeyecek. Üyeye gösterilecek not (isteğe bağlı):','','Hesabı kapat');if(not==null)return;}
        await call('admin_set_disabled',{p_user:id,p_disabled:!u.disabled,p_note:not||null});}
      else if(k==='sil'){const t=await askText('Üyelik silinsin mi? (geri alınamaz)','Onay için üyenin e-posta adresini yazın: '+u.email,'','Üyeliği sil');if(t==null)return;
        await call('admin_user_delete',{p_user:id,p_confirm_email:t});toast(u.email+' üyeliği silindi.');kapat();await yukle(['users','dash']);return;}
      else return;
      toast('Güncellendi.');await yenile();
    }catch(x){toast(cErr(x));}
  }
  function formFatura(){const f={};FATURA.forEach(([k])=>{const el=$('#admF_'+k);if(el)f[k]=el.value.trim();});return f;}
  function tarihSor(baslik,metin,def){
    return new Promise(res=>{let m=$('#admTarihModal');
      if(!m){document.body.insertAdjacentHTML('beforeend',`<div class="modal" id="admTarihModal" hidden style="z-index:48"><div class="mbox" style="width:min(420px,100%)" role="dialog" aria-modal="true" aria-labelledby="admTT"><div class="mhead"><h2 id="admTT"></h2></div><div class="mbody"><p class="note" id="admTM" style="margin:0"></p><input type="date" id="admTI" data-notr="1"><div class="actions" style="justify-content:flex-end"><button class="btn" id="admTN">Vazgeç</button><button class="btn primary" id="admTY">Tamam</button></div></div></div></div>`);m=$('#admTarihModal');}
      $('#admTT').textContent=baslik;$('#admTM').textContent=metin;const i=$('#admTI');i.value=def||'';m.hidden=false;setTimeout(()=>i.focus(),20);
      const done=v=>{m.hidden=true;document.removeEventListener('keydown',kd,true);res(v);};
      const kd=e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();done(null);}else if(e.key==='Enter'){e.preventDefault();done(i.value||null);}};document.addEventListener('keydown',kd,true);
      $('#admTN').onclick=()=>done(null);$('#admTY').onclick=()=>done(i.value||null);});
  }

  /* ---- ofisler ve özel çözümler ---- */
  function ozelKutular(o){return OZEL.map(z=>`<label class="admcb"><input type="checkbox" data-admoz="${esc(o.id)}" value="${z.id}"${(o.ozel||[]).includes(z.id)?' checked':''}> ${esc(z.ad)}</label>`).join('');}
  function ofisler(){
    if(st.ofisEski)return '<div class="banner">Ofis listesi için sunucu güncellemesi gerekli (supabase-yonetim.sql).</div>';
    const L=st.ofisler||[];
    return `<p class="note" style="margin:0">"Ofisinize Özel Çözümler" bölümünü yalnız burada işaretlediğiniz ofisler (sahibi, yöneticileri ve tüm çalışanları) görür; diğer üyeler bu bölümü hiç görmez.</p>
      <div class="tablewrap admtw"><table class="admt tg-yok"><thead><tr><th>Ofis</th><th>Luca üye no</th><th>Sahibi</th><th class="num">Kişi</th><th>Özel çözümler</th></tr></thead><tbody>
      ${L.map(o=>`<tr><td><b>${esc(o.name)}</b><br><span class="note">${trD(o.created_at)}</span></td><td class="mono">${esc(o.luca_uye_no||'')}</td>
        <td>${bul(o.owner)?`<button class="lnk" data-admu="${esc(o.owner)}">${esc(o.owner_email||'')}</button>`:esc(o.owner_email||'')}</td><td class="num">${o.uye||0}</td><td>${ozelKutular(o)}</td></tr>`).join('')||'<tr><td colspan="5" class="empty">Henüz ofis yok. Üyeler Ayarlar → Ofis ve çalışanlar bölümünden ofis oluşturur.</td></tr>'}
      </tbody></table></div>`;
  }
  async function ozelKaydet(cb){
    const oid=cb.dataset.admoz;const liste=[...document.querySelectorAll('[data-admoz]')].filter(x=>x.dataset.admoz===oid&&x.checked).map(x=>x.value);
    try{const r=await call('admin_office_set_ozel',{p_office:oid,p_ozel:liste});const o=(st.ofisler||[]).find(x=>x.id===oid);if(o)o.ozel=(r&&r.ozel)||liste;
      toast(liste.length?'Özel çözüm tanımlandı; ofis üyeleri bir sonraki girişte görür.':'Özel çözüm kaldırıldı.');await yukle(['users']);if(st.acik&&!$('#admModal').hidden)detay(st.acik);}
    catch(x){toast(cErr(x));cb.checked=!cb.checked;}
  }

  /* ---- satışlar ---- */
  function satisTablo(L,uyeIci){
    return `<div class="tablewrap admtw"><table class="admt${uyeIci?' tg-yok':''}"><thead><tr><th>Fatura tarihi</th><th>Fatura no</th>${uyeIci?'':'<th>Üye</th>'}<th>Modül</th><th>Süre</th><th class="num">Tutar</th><th class="num">KDV</th><th class="num">Toplam</th><th>Durum</th><th>Ödeme</th><th></th></tr></thead><tbody>
      ${L.map(p=>{const top=toplam(p);const dc=p.durum==='odendi'?'kural':p.durum==='iptal'?'':'aski';const dt={odendi:'tahsil edildi',bekliyor:'bekliyor',iptal:'iptal'}[p.durum]||p.durum;
        return `<tr class="${p.durum==='iptal'?'admiptal':''}"><td class="mono">${trD(p.fatura_tarihi||p.created_at)}</td><td class="mono">${esc(p.fatura_no||'—')}</td>
          ${uyeIci?'':`<td>${p.user_id?`<button class="lnk" data-admu="${esc(p.user_id)}">${esc(p.buro||p.cur_email||p.email||'')}</button>`:esc(p.email||'(silinmiş üye)')}<br><span class="note">${esc(p.cur_email||p.email||'')}${p.vkn?' · '+esc(p.vkn):''}</span></td>`}
          <td>${esc(mad(p.module))}</td><td>${p.days} gün${p.license_id?' <span class="chip kural" title="Lisans bu satışla tanımlandı">lisans</span>':''}</td>
          <td class="num mono">${tl(p.tutar)}</td><td class="num mono">${tl(top-(+p.tutar||0))}<br><span class="note">%${+p.kdv_orani}</span></td><td class="num mono"><b>${tl(top)}</b></td>
          <td><span class="chip ${dc}">${esc(dt)}</span></td><td class="mono">${trD(p.odeme_tarihi)}<br><span class="note">${esc(p.yontem||'')}</span></td>
          <td><div class="rowbtns">${p.durum==='bekliyor'?`<button class="btn small" data-admp="odendi" data-id="${p.id}">Tahsil edildi</button>`:''}<button class="btn small ghost" data-admp="duzelt" data-id="${p.id}">Düzelt</button><button class="btn small ghost danger" data-admp="sil" data-id="${p.id}">Sil</button></div></td></tr>`;}).join('')||`<tr><td colspan="11" class="empty">Kayıt yok.</td></tr>`}
      </tbody></table></div>`;
  }
  function satislar(){
    const p=st.pf;const L=st.pays.filter(x=>!p.durum||x.durum===p.durum);const g=L.filter(x=>x.durum!=='iptal');
    const net=r2(g.reduce((s,x)=>s+(+x.tutar||0),0)),top=r2(g.reduce((s,x)=>s+toplam(x),0));
    const tah=r2(g.filter(x=>x.durum==='odendi').reduce((s,x)=>s+toplam(x),0)),bek=r2(g.filter(x=>x.durum==='bekliyor').reduce((s,x)=>s+toplam(x),0));
    const opt=(v,t,c)=>`<option value="${v}"${c===v?' selected':''}>${esc(t)}</option>`;
    return `<div class="actions admfiltre"><select id="admPA" style="width:auto" aria-label="Dönem">${[['ay','Bu ay'],['yil','Bu yıl'],['gecenyil','Geçen yıl'],['tum','Tümü'],['ozel','Tarih aralığı']].map(([v,t])=>opt(v,t,p.aralik)).join('')}</select>
        ${p.aralik==='ozel'?`<input type="date" id="admPB" value="${esc(p.bas)}" style="width:auto"> – <input type="date" id="admPE" value="${esc(p.bit)}" style="width:auto">`:''}
        <select id="admPD" style="width:auto" aria-label="Durum">${[['','Tüm durumlar'],['bekliyor','Bekleyen'],['odendi','Tahsil edilen'],['iptal','İptal']].map(([v,t])=>opt(v,t,p.durum)).join('')}</select>
        <span style="flex:1"></span><button class="btn small" id="admPX">Excel'e aktar</button><button class="btn small primary" data-admsat="">+ Satış / lisans</button></div>
      <div class="stats admstats"><div class="stat"><div class="k">Satış (KDV hariç)</div><div class="v">${tl(net)} ₺</div></div><div class="stat"><div class="k">KDV</div><div class="v">${tl(top-net)} ₺</div></div><div class="stat"><div class="k">Toplam</div><div class="v">${tl(top)} ₺</div></div><div class="stat"><div class="k">Tahsil edilen</div><div class="v">${tl(tah)} ₺</div></div><div class="stat"><div class="k">Bekleyen</div><div class="v">${tl(bek)} ₺</div></div><div class="stat"><div class="k">Kayıt</div><div class="v">${L.length}</div></div></div>
      ${satisTablo(L,false)}`;
  }
  function satisForm(on,geri){
    const ay=st.ayar||{};const fy=ay.fiyatlar||{};const yeni=!on||!on.id;
    const p={user_id:'',module:'fatura',days:365,kdv_orani:20,durum:'bekliyor',fatura_tarihi:bugun(),yontem:YONTEM[0],lisans_ver:true,...(on||{})};
    if(yeni&&p.tutar==null&&fy[p.module]!=null)p.tutar=fy[p.module];
    const u=p.user_id?bul(p.user_id):null;
    const opt=(v,t,c)=>`<option value="${esc(v)}"${String(c)===String(v)?' selected':''}>${esc(t)}</option>`;
    ac(yeni?'Satış / lisans kaydı':'Satış kaydını düzelt',`
      ${st.eski?'<div class="banner">Satış kayıtları için sunucu güncellemesi gerekli (supabase-yonetim.sql).</div>':''}
      <div class="outgrid">
        <div style="grid-column:1/-1"><label class="lbl" for="admSU">Üye</label>${yeni?`<input id="admSU" list="admSUL" placeholder="e-posta ya da büro adı yazın" value="${esc(u?u.email:'')}" autocomplete="off"><datalist id="admSUL">${st.users.map(x=>`<option value="${esc(x.email)}">${esc(uyeAd(x))}</option>`).join('')}</datalist>`:`<b>${esc(u?u.email:(p.email||''))}</b>`}<span class="note" id="admSUN">${u?esc(uyeAd(u)):''}</span></div>
        <div><label class="lbl" for="admSM">Modül</label><select id="admSM">${modlar().map(m=>opt(m,mad(m),p.module)).join('')}</select></div>
        <div><label class="lbl" for="admSG">Süre (gün)</label><input id="admSG" type="number" min="1" max="3660" value="${esc(p.days)}" list="admSGL"><datalist id="admSGL"><option value="365">1 yıl</option><option value="182">6 ay</option><option value="91">3 ay</option><option value="30">1 ay</option></datalist></div>
        <div><label class="lbl" for="admST">Tutar (KDV hariç, ₺)</label><input id="admST" type="number" min="0" step="0.01" value="${esc(p.tutar??'')}"></div>
        <div><label class="lbl" for="admSK">KDV %</label><select id="admSK">${[20,10,1,0].map(v=>opt(v,'%'+v,+p.kdv_orani)).join('')}</select></div>
        <div><label class="lbl">Toplam</label><b id="admSTop" style="font-size:16px">—</b></div>
        <div><label class="lbl" for="admSFN">Fatura no</label><input id="admSFN" value="${esc(p.fatura_no||'')}" placeholder="ör. MUH2026000000012"></div>
        <div><label class="lbl" for="admSFT">Fatura tarihi</label><input id="admSFT" type="date" data-notr="1" value="${esc(p.fatura_tarihi||'')}"></div>
        <div><label class="lbl" for="admSD">Durum</label><select id="admSD">${opt('bekliyor','Ödeme bekleniyor',p.durum)}${opt('odendi','Tahsil edildi',p.durum)}${opt('iptal','İptal',p.durum)}</select></div>
        <div><label class="lbl" for="admSOT">Ödeme tarihi</label><input id="admSOT" type="date" data-notr="1" value="${esc(p.odeme_tarihi||'')}"></div>
        <div><label class="lbl" for="admSY">Ödeme yöntemi</label><select id="admSY">${YONTEM.map(v=>opt(v,v,p.yontem)).join('')}</select></div>
        <div style="grid-column:1/-1"><label class="lbl" for="admSN">Not</label><input id="admSN" value="${esc(p.note||'')}"></div>
      </div>
      ${yeni?`<label class="admcb"><input type="checkbox" id="admSL"${p.lisans_ver?' checked':''}> Lisansı şimdi tanımla (seçilen modüle, mevcut süreye eklenerek ${'<span id="admSLG">'+esc(p.days)+'</span>'} gün)</label>`:`<p class="note">${p.license_id?'Bu satışla lisans tanımlandı. Süreyi değiştirmek için üyenin sayfasında "Bitiş tarihi"ni kullanın.':'Bu satışla lisans tanımlanmamış.'}</p>`}
      <div class="actions" style="justify-content:flex-end"><span class="note err" id="admSE"></span><button class="btn" data-admsf="vaz">Vazgeç</button><button class="btn primary" data-admsf="kaydet"${st.eski?' disabled':''}>${yeni?'Kaydet':'Değişiklikleri kaydet'}</button></div>`);
    const hesap=()=>{const t=+$('#admST').value||0,k=+$('#admSK').value||0;$('#admSTop').textContent=tl(r2(t*(1+k/100)))+' ₺';const g=$('#admSLG');if(g)g.textContent=$('#admSG').value||'?';};
    ['#admST','#admSK','#admSG'].forEach(s=>$(s).addEventListener('input',hesap));hesap();
    $('#admSM').addEventListener('change',()=>{const v=fy[$('#admSM').value];if(yeni&&v!=null)$('#admST').value=v;hesap();});
    $('#admSD').addEventListener('change',()=>{if($('#admSD').value==='odendi'&&!$('#admSOT').value)$('#admSOT').value=bugun();});
    const su=$('#admSU');if(su){su.addEventListener('input',()=>{const x=uyeBul(su.value);$('#admSUN').textContent=x?' '+uyeAd(x):'';});if(!u)setTimeout(()=>su.focus(),30);}
    MB().onclick=async e=>{const b=e.target.closest('[data-admsf]');if(!b)return;
      if(b.dataset.admsf==='vaz'){MB().onclick=null;if(geri)geri();else kapat();return;}
      const err=$('#admSE');err.textContent='';
      const uu=yeni?uyeBul(su.value):u;if(yeni&&!uu){err.textContent='Listeden bir üye seçin.';return;}
      const g=parseInt($('#admSG').value,10);if(!(g>0&&g<=3660)){err.textContent='Süre 1–3660 gün olmalı.';return;}
      const kayit={id:p.id||null,user_id:uu?uu.id:p.user_id,module:$('#admSM').value,days:g,tutar:$('#admST').value||'0',kdv_orani:$('#admSK').value,
        fatura_no:$('#admSFN').value.trim(),fatura_tarihi:$('#admSFT').value,durum:$('#admSD').value,odeme_tarihi:$('#admSOT').value,yontem:$('#admSY').value,note:$('#admSN').value.trim(),
        lisans_ver:yeni&&$('#admSL').checked};
      b.disabled=true;
      try{await call('admin_payment_save',{p:kayit});MB().onclick=null;
        toast(yeni?(kayit.lisans_ver?'Satış kaydedildi ve lisans tanımlandı.':'Satış kaydedildi.'):'Satış kaydı güncellendi.');
        await yukle(['users','dash','pays']);if(geri)geri();else kapat();}
      catch(x){err.textContent=cErr(x);b.disabled=false;}};
  }
  function uyeBul(v){const q=String(v||'').trim().toLowerCase();if(!q)return null;return st.users.find(x=>String(x.email).toLowerCase()===q)||(st.users.filter(x=>N(uyeAd(x))===N(v)).length===1?st.users.find(x=>N(uyeAd(x))===N(v)):null);}
  async function satisIslem(k,id){
    const p=st.pays.find(x=>String(x.id)===String(id))||((bul(st.acik)||{}).payments||[]).find(x=>String(x.id)===String(id));if(!p)return;
    const geri=st.acik&&!$('#admModal').hidden?(()=>detay(st.acik)):null;
    try{
      if(k==='duzelt'){satisForm(p,geri);return;}
      if(k==='odendi'){await call('admin_payment_save',{p:{...p,durum:'odendi',odeme_tarihi:bugun()}});toast('Tahsil edildi olarak işaretlendi.');}
      else if(k==='sil'){if(!(await askConfirm('Satış kaydı silinsin mi?',`${p.fatura_no||'Fatura numarasız kayıt'} · ${tl(toplam(p))} ₺. Bu satışla verilen lisans geri alınmaz (gerekirse üyenin sayfasından bitirin).`,'Evet, sil')))return;await call('admin_payment_delete',{p_id:p.id});toast('Satış kaydı silindi.');}
      await yukle(['users','dash','pays']);if(geri)geri();
    }catch(x){toast(cErr(x));}
  }

  /* ---- lisans kodları ---- */
  function kodlar(){
    const d=(st.dash||{}).kodlar||{};const M=modlar();const k=st.sonKod;
    return `<div class="admgrid">
      <section class="admkart"><h3>Yeni lisans kodu üret</h3>
        <p class="note" style="margin:0 0 8px">Kodlar bu bilgisayarda üretilir ve seçtiğiniz <b>GİZLİ</b> dosyaya (CSV) yazılır. Sunucuya yalnız kodların özeti gider; kodun kendisi hiçbir yerde saklanmaz. Dosyayı kimseyle paylaşmayın, her müşteriye bir kod verin.</p>
        <div class="outgrid"><div><label class="lbl" for="admKM">Modül</label><select id="admKM">${M.map(m=>`<option value="${m}">${esc(mad(m))}</option>`).join('')}</select></div>
          <div><label class="lbl" for="admKA">Adet</label><input id="admKA" type="number" min="1" max="2000" value="10"></div>
          <div><label class="lbl" for="admKG">Süre (gün)</label><input id="admKG" type="number" min="1" max="3660" value="365"></div>
          <div><label class="lbl" for="admKP">Parti adı (isteğe bağlı)</label><input id="admKP" placeholder="ör. ekim-kampanya"></div></div>
        <div class="actions"><button class="btn primary" id="admKU"${st.eski?' disabled title="Sunucu güncellemesi gerekli"':''}>Kodları üret ve kaydet…</button><span class="note err" id="admKE"></span></div>
        ${k?`<div class="banner" style="background:var(--cari-bg);color:var(--cari-fg)">${k.added} kod eklendi (${esc(mad(k.modul))} · ${esc(k.parti)}). Dosya: <button class="lnk" data-admkf="1">${esc(k.path)}</button>
          ${k.kodlar?`<div class="admkodlar">${k.kodlar.map(x=>`<span class="mono">${esc(x)}</span><button class="btn small" data-admkk="${esc(x)}">Kopyala</button>`).join('')}</div>`:''}</div>`:''}
      </section>
      <section class="admkart"><h3>Kod sorgula</h3><p class="note" style="margin:0 0 8px">Müşterinin elindeki kodun hangi modüle ait olduğunu ve kim tarafından kullanıldığını gösterir.</p>
        <div class="actions"><input id="admKQ" placeholder="XXXXX-XXXXX-… (50 karakter)" class="mono" style="flex:1;min-width:240px"><button class="btn" id="admKS"${st.eski?' disabled':''}>Sorgula</button></div><div id="admKR"></div></section>
      <section class="admkart" style="grid-column:1/-1"><h3>Kod partileri</h3>${st.batches.length?`<table class="admt tg-yok"><thead><tr><th>Modül</th><th>Parti</th><th>Süre</th><th class="num">Kullanılan</th><th class="num">Toplam</th><th class="num">Kalan</th></tr></thead><tbody>${st.batches.map(b=>`<tr><td>${esc(mad(b.module))}</td><td>${esc(b.batch)}</td><td>${b.days} gün</td><td class="num">${b.used}</td><td class="num">${b.total}</td><td class="num"><b>${b.total-b.used}</b></td></tr>`).join('')}</tbody></table>`:`<p class="note">${Object.keys(d).length?Object.entries(d).map(([m,x])=>`${mad(m)}: ${x.used} / ${x.total}`).join(' · '):'Bilgi yok.'}</p>`}</section></div>`;
  }
  async function kodUret(){
    const e=$('#admKE');e.textContent='';const a={modul:$('#admKM').value,adet:+$('#admKA').value,gun:+$('#admKG').value,parti:$('#admKP').value.trim()};
    if(!(a.adet>=1&&a.adet<=2000)){e.textContent='Adet 1–2000 olmalı.';return;}
    try{const r=await D.adminKodUret(a);if(!r||!r.ok)return;st.sonKod={...r,modul:a.modul};toast(r.added+' lisans kodu üretildi ve kaydedildi.');await yukle(['kod','dash']);}
    catch(x){e.textContent=cErr(x);}
  }
  async function kodSorgu(){
    const R=$('#admKR');R.innerHTML='<p class="note">Sorgulanıyor…</p>';
    try{const r=await call('admin_code_lookup',{p_code:$('#admKQ').value});
      R.innerHTML=!r||!r.found?'<p class="err">Bu kod sistemde yok.</p>':`<table class="admt tg-yok"><tbody><tr><td class="note">Modül</td><td>${esc(mad(r.module))}</td></tr><tr><td class="note">Süre</td><td>${r.days} gün</td></tr><tr><td class="note">Parti</td><td>${esc(r.batch||'—')}</td></tr>
        <tr><td class="note">Durum</td><td>${r.used_by?`<span class="chip aski">kullanıldı</span> ${trDT(r.used_at)} · <button class="lnk" data-admu="${esc(r.used_by)}">${esc(r.used_email||r.used_by)}</button>`:'<span class="chip kural">kullanılmadı</span>'}</td></tr></tbody></table>`;}
    catch(x){R.innerHTML=`<p class="err">${esc(cErr(x))}</p>`;}
  }

  /* ---- ayarlar ve duyuru ---- */
  function ayarlar(){
    const a=st.ayar||{};const du=a.duyuru||null;const fy=a.fiyatlar||{};const mods=(a.modules||[]).filter(m=>m.id!=='ekstre'&&(m.active||LISANSLI.includes(m.id)));
    return `<div class="admgrid">
      <section class="admkart"><h3>Genel</h3><div class="outgrid">
        <div><label class="lbl" for="admAMD">Hesap başına bilgisayar</label><input id="admAMD" type="number" min="1" max="50" value="${esc(a.max_devices??2)}"></div>
        <div><label class="lbl" for="admAOD">Çevrimdışı çalışma (gün)</label><input id="admAOD" type="number" min="1" max="30" value="${esc(a.offline_days??3)}"></div></div>
        <h3 style="margin-top:12px">Liste fiyatı (KDV hariç, ₺) <span class="note">— satış formuna önerilir</span></h3><div class="outgrid">${LISANSLI.map(m=>`<div><label class="lbl" for="admAF_${m}">${esc(mad(m))}</label><input id="admAF_${m}" data-fy="${m}" type="number" min="0" step="0.01" value="${esc(fy[m]??'')}"></div>`).join('')}</div>
        <div class="actions"><button class="btn primary" id="admAK">Ayarları kaydet</button><span class="note">Yönetici: ${esc(a.admin_email||'bilgi@smmmantalya.com')}</span></div></section>
      <section class="admkart"><h3>Duyuru <span class="note">— tüm üyelere modül seçim ekranında gösterilir</span></h3>
        ${du?`<div class="banner ${du.tur==='uyari'?'':'admbilgi'}" style="margin:0 0 8px"><b>Yayında:</b> ${esc(du.metin)}<br><span class="note">${trDT(du.tarih)}${du.bitis?' · '+trD(du.bitis)+' tarihine kadar':''}</span></div>`:'<p class="note">Yayında duyuru yok.</p>'}
        <label class="lbl" for="admDM">Metin</label><textarea id="admDM" rows="3" maxlength="1000" style="width:100%;box-sizing:border-box" placeholder="ör. 2.8.0 sürümü yayınlandı; Ayarlar → Hakkında'dan güncelleyin.">${esc(du?du.metin:'')}</textarea>
        <div class="outgrid"><div><label class="lbl" for="admDT">Tür</label><select id="admDT"><option value="bilgi"${du&&du.tur==='uyari'?'':' selected'}>Bilgi</option><option value="uyari"${du&&du.tur==='uyari'?' selected':''}>Uyarı</option></select></div>
          <div><label class="lbl" for="admDB">Son gün (isteğe bağlı)</label><input id="admDB" type="date" data-notr="1" value="${esc(du&&du.bitis||'')}"></div></div>
        <div class="actions"><button class="btn primary" id="admDY">Yayınla</button>${du?'<button class="btn ghost danger" id="admDK">Duyuruyu kaldır</button>':''}</div></section>
      <section class="admkart"><h3>Yönetim şifresi</h3><p class="note" style="margin:0 0 8px">Yönetim modülüne girişte sorulur. Yalnız buradan değiştirilir.${st.yerelPin?' (Sunucu güncellenmediği için şifre şimdilik bu bilgisayarda saklanıyor.)':''}</p>
        <div class="outgrid"><div><label class="lbl" for="admP0">Mevcut şifre</label><input type="password" id="admP0" autocomplete="off"></div>
          <div><label class="lbl" for="admP1">Yeni şifre</label><input type="password" id="admP1" autocomplete="off" placeholder="4–32 karakter"></div>
          <div><label class="lbl" for="admP2">Yeni şifre (tekrar)</label><input type="password" id="admP2" autocomplete="off"></div></div>
        <div class="actions"><button class="btn" id="admPS">Şifreyi değiştir</button><span class="note" id="admPM"></span></div></section></div>`;
  }
  async function ayarKaydet(){
    const p={max_devices:+$('#admAMD').value,offline_days:+$('#admAOD').value,trial_days:{},fiyatlar:{}};
    document.querySelectorAll('#admBody [data-tr]').forEach(i=>{p.trial_days[i.dataset.tr]=+i.value;});
    document.querySelectorAll('#admBody [data-fy]').forEach(i=>{if(i.value!=='')p.fiyatlar[i.dataset.fy]=String(r2(i.value));});
    try{st.ayar=await call('admin_settings_set',{p});toast('Ayarlar kaydedildi.');ciz();}catch(x){toast(cErr(x));}
  }
  async function duyuru(kaldir){
    const metin=$('#admDM').value.trim();
    if(!kaldir&&!metin){toast('Duyuru metnini yazın.');return;}
    if(kaldir&&!(await askConfirm('Duyuru kaldırılsın mı?','Üyeler artık bu duyuruyu görmeyecek.','Evet, kaldır')))return;
    try{st.ayar=await call('admin_settings_set',{p:{duyuru:kaldir?null:{metin,tur:$('#admDT').value,bitis:$('#admDB').value||null}}});toast(kaldir?'Duyuru kaldırıldı.':'Duyuru yayınlandı.');ciz();}catch(x){toast(cErr(x));}
  }

  async function pinDegis(){
    const m=$('#admPM');const a=$('#admP0').value,b=$('#admP1').value,c=$('#admP2').value;m.textContent='';
    if(b!==c){m.textContent='Yeni şifreler aynı değil.';return;}
    if(!/^\S{4,32}$/.test(b)){m.textContent='Yeni şifre 4–32 karakter olmalı, boşluk içermemeli.';return;}
    try{const r=await D.adminPinSet({eski:a,yeni:b});if(r&&r.ok){['#admP0','#admP1','#admP2'].forEach(x=>$(x).value='');m.textContent='Şifre değiştirildi.';toast('Yönetim şifresi değiştirildi.');}else m.textContent=(r&&r.reason)||'Değiştirilemedi.';}
    catch(x){m.textContent=cErr(x);}
  }

  /* ---- işlem günlüğü ---- */
  function gunluk(){
    return `<div class="tablewrap admtw"><table class="admt"><thead><tr><th>Zaman</th><th>İşlem</th><th>Üye</th><th>Ayrıntı</th></tr></thead><tbody>
      ${st.log.map(g=>`<tr><td class="mono">${trDT(g.at)}</td><td>${esc(EYLEM[g.action]||g.action)}</td><td>${g.target&&bul(g.target)?`<button class="lnk" data-admu="${esc(g.target)}">${esc(g.email||'')}</button>`:esc(g.email||'—')}</td><td class="note">${esc(detayMetin(g.detail))}</td></tr>`).join('')||'<tr><td colspan="4" class="empty">Kayıt yok.</td></tr>'}
      </tbody></table></div>`;
  }

  /* ---- Excel ---- */
  async function xls(ad,sayfalar){
    if(typeof XLSX==='undefined'){toast('Excel kütüphanesi yüklenemedi.');return;}
    const wb=XLSX.utils.book_new();for(const [n,rows] of sayfalar)XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(rows.length?rows:[{'':'Kayıt yok'}]),n.slice(0,31));
    const data=XLSX.write(wb,{type:'array',bookType:'xlsx'});
    try{const r=await D.saveFile(ad,data);if(r&&r.ok)toast('Kaydedildi: '+r.path);}catch(x){toast(cErr(x));}
  }
  function uyeXls(){
    const M=modlar();
    const rows=suzulmus().map(u=>{const f=faturaVarsayilan(u),r=u.reg||{};const o={'E-posta':u.email,'Büro':r.buro||'','Yetkili':r.yetkili||'','Telefon':r.telefon||'',
      'Fatura unvanı':f.unvan,'VKN/TCKN':f.vkn,'Vergi dairesi':f.vd,'Adres':[f.adres,f.ilce,f.il].filter(Boolean).join(' '),'Fatura e-postası':f.eposta,'e-Fatura':f.efatura==='evet'?'Evet':f.efatura==='hayir'?'Hayır':'',
      'Ofis':(u.office||{}).name||'','Üyelik':trD(u.created_at),'Son giriş':trD(u.last_seen),'Sürüm':u.app_version||'','Bilgisayar':u.devices||0,'Hesap':u.disabled?'kapalı':'açık'};
      for(const m of M){const x=ms(u,m);o[mad(m)+' durum']=DURUM[durum(u,m)][1];o[mad(m)+' bitiş']=trD(x.expires||(x.type==='pool'?x.license_end:x.trial_end));}
      if(!st.eski){o['Tahsil edilen']=+u.paid||0;o['Bekleyen']=+u.due||0;}o['Yönetici notu']=u.admin_note||'';return o;});
    xls('MuhaWin-uyeler-'+bugun()+'.xlsx',[['Üyeler',rows]]);
  }
  function satisXls(){
    const L=st.pays.filter(x=>!st.pf.durum||x.durum===st.pf.durum);
    xls('MuhaWin-satislar-'+bugun()+'.xlsx',[['Satışlar',L.map(p=>({'Fatura tarihi':trD(p.fatura_tarihi||p.created_at),'Fatura no':p.fatura_no||'','Üye':p.cur_email||p.email||'','Büro':p.buro||'','VKN/TCKN':p.vkn||'',
      'Modül':mad(p.module),'Süre (gün)':p.days,'Tutar (KDV hariç)':+p.tutar||0,'KDV %':+p.kdv_orani,'KDV':r2(toplam(p)-(+p.tutar||0)),'Toplam':toplam(p),
      'Durum':{odendi:'Tahsil edildi',bekliyor:'Bekliyor',iptal:'İptal'}[p.durum]||p.durum,'Ödeme tarihi':trD(p.odeme_tarihi),'Yöntem':p.yontem||'','Not':p.note||''}))]]);
  }

  /* ---- olaylar ---- */
  document.addEventListener('click',e=>{
    const P=$('#admPanel');if(!P||P.hidden)return;
    const t=e.target;
    const tb=t.closest('[data-admtab]');if(tb){sekme(tb.dataset.admtab);return;}
    if(t.closest('#admYenile')){yukle(['users','dash','ayar',...({satis:['pays'],kod:['kod'],log:['log']}[st.tab]||[])]);return;}
    const f=t.closest('[data-admf]');if(f&&!f.disabled){st.durum=f.dataset.admf==='tum'?'':f.dataset.admf;if(f.dataset.admm)st.mod=f.dataset.admm;st.tab='uyeler';kapat();ciz();return;}
    const sat=t.closest('[data-admsat]');if(sat){const uid=sat.dataset.admsat;const geri=uid&&st.acik===uid&&!$('#admModal').hidden?(()=>detay(uid)):null;satisForm({user_id:uid||'',module:sat.dataset.admm||(uid?'fatura':'fatura')},geri);return;}
    const pd=t.closest('[data-admp]');if(pd){satisIslem(pd.dataset.admp,pd.dataset.id);return;}
    const dd=t.closest('[data-admd]');if(dd){detayIslem(dd.dataset.admd,dd);return;}
    if(t.closest('[data-admx]')){kapat();return;}
    const kk=t.closest('[data-admkk]');if(kk){navigator.clipboard.writeText(kk.dataset.admkk).then(()=>toast('Kod kopyalandı.'),()=>toast('Kopyalanamadı.'));return;}
    if(t.closest('[data-admkf]')&&st.sonKod){D.showInFolder(st.sonKod.path);return;}
    const uu=t.closest('[data-admu]');if(uu&&!t.closest('select,input,textarea')){detay(uu.dataset.admu);return;}
    if(t.closest('#admXls')){uyeXls();return;}
    if(t.closest('#admPX')){satisXls();return;}
    if(t.closest('#admMail')){const L=suzulmus().filter(u=>!u.disabled).map(u=>u.email).filter(Boolean);navigator.clipboard.writeText(L.join('; ')).then(()=>toast(L.length+' e-posta adresi kopyalandı (BCC alanına yapıştırın).'),()=>toast('Kopyalanamadı.'));return;}
    if(t.closest('#admPinGo')){kilitAc();return;}
    if(t.closest('#admPS')){pinDegis();return;}
    if(t.closest('#admKU')){kodUret();return;}
    if(t.closest('#admKS')){kodSorgu();return;}
    if(t.closest('#admAK')){ayarKaydet();return;}
    if(t.closest('#admDY')){duyuru(false);return;}
    if(t.closest('#admDK')){duyuru(true);return;}
  });
  document.addEventListener('input',e=>{if(e.target.id==='admQ'){st.q=e.target.value;st._odak=e.target.selectionStart??st.q.length;ciz();}});
  document.addEventListener('change',e=>{const id=e.target.id;
    if(id==='admMod'){st.mod=e.target.value;ciz();}else if(id==='admDurum'){st.durum=e.target.value;ciz();}else if(id==='admSira'){st.sira=e.target.value;ciz();}
    else if(id==='admPA'){st.pf.aralik=e.target.value;if(e.target.value!=='ozel')yukle(['pays']);else ciz();}
    else if(id==='admPB'||id==='admPE'){st.pf[id==='admPB'?'bas':'bit']=e.target.value;yukle(['pays']);}
    else if(id==='admPD'){st.pf.durum=e.target.value;ciz();}
    else if(e.target.dataset&&e.target.dataset.admoz){ozelKaydet(e.target);}});
  document.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.id==='admKQ'){e.preventDefault();kodSorgu();}if(e.key==='Enter'&&e.target.id==='admPin'){e.preventDefault();kilitAc();}});
  /** Esc: açık pencere → kapanır; Pano dışı sekme → Pano; Pano → Modüller (false döner) */
  function geri(){if(!$('#admModal').hidden){kapat();return true;}if(st.tab!=='pano'){sekme('pano');return true;}return false;}
  return {show,hide,geri,yukle,detay,_st:st};
})();
window.__adm=ADM;

/* Duyuru: modül seçim ekranında (her duyuru bir kez kapatılabilir) */
async function duyuruGoster(){
  const {esc}=window.__mw;
  try{
    const d=await window.desktop.duyuru();const yer=document.getElementById('modDuyuru');
    if(!d||!d.metin){if(yer)yer.remove();return;}
    let gor='';try{gor=localStorage.getItem('muhawin-duyuru-kapat')||'';}catch(e){}
    if(String(d.id)===gor){if(yer)yer.remove();return;}
    const html=`<div class="banner modduyuru${d.tur==='uyari'?'':' admbilgi'}" id="modDuyuru" role="status"><span>${esc(d.metin)}</span><button class="x" type="button" data-duyx="${esc(d.id)}" title="Kapat">✕</button></div>`;
    if(yer)yer.outerHTML=html;else{const g=document.getElementById('modGrid');if(g)g.insertAdjacentHTML('beforebegin',html);}
  }catch(e){}
}
document.addEventListener('click',e=>{const b=e.target.closest('[data-duyx]');if(!b)return;try{localStorage.setItem('muhawin-duyuru-kapat',b.dataset.duyx);}catch(x){}const y=document.getElementById('modDuyuru');if(y)y.remove();});
