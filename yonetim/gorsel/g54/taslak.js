// Görev 54 "sonra" taslağı: önerilen sade yerleşimi görsel için sayfaya geçici olarak uygular (programa girmez).
// tools/site-gorsel.js › GORSEL_EK ile her çekimden önce ana pencerede ve Fatura Kontrol çerçevesinde çalışır.
(() => {
  const ekle = (id, css) => { if (document.getElementById(id)) return; const s = document.createElement('style'); s.id = id; s.textContent = css; document.head.appendChild(s); };
  const digerMenu = (yer, dugmeler, ad = 'Diğer ▾') => {
    if (!yer || yer.querySelector('.g54-diger')) return;
    const b = document.createElement('button'); b.type = 'button'; b.className = 'btn small g54-diger'; b.textContent = ad;
    b.title = dugmeler.map(x => (x.textContent || '').trim()).filter(Boolean).join(' · ');
    yer.appendChild(b);
  };
  if (/\/toplu/.test(location.pathname)) {
    // ---- Fatura Kontrol › Toplu Kontrol (çerçeve) ----
    ekle('g54', `
      main{grid-template-columns:44px minmax(0,1fr)!important;gap:10px!important;padding:10px!important}
      aside>*{display:none!important}
      aside{display:flex!important;flex-direction:column;align-items:center;gap:8px;padding-top:4px}
      aside::before{content:"▸";writing-mode:horizontal-tb;display:grid;place-items:center;width:36px;height:36px;border:1px solid var(--line);border-radius:8px;background:var(--panel);color:var(--brand-2);font-weight:700}
      aside::after{content:"Yeni kontrol · İşlem özeti";writing-mode:vertical-rl;transform:rotate(180deg);font-size:12px;color:var(--muted);letter-spacing:.02em}
      .kutular{gap:6px!important;margin-bottom:8px!important}
      .kutu{display:flex!important;align-items:baseline;gap:6px;padding:4px 12px!important;min-width:0!important;border-radius:999px!important;box-shadow:none!important}
      .kutu .sayi{font-size:15px!important}.kutu .ad{font-size:12.5px!important;color:var(--ink)!important}
      #sonucTablo{table-layout:auto}
      #sonucTablo td,#sonucTablo th{padding-top:5px!important;padding-bottom:5px!important}
      #sonucTablo td:nth-child(2){white-space:nowrap;max-width:230px;overflow:hidden;text-overflow:ellipsis}
      #sonucTablo th{white-space:normal!important;line-height:1.15}
      .tablo-kap{overflow-x:hidden!important}
    `);
    for (const td of document.querySelectorAll('#sonucTablo tbody tr td:nth-child(2)')) td.title = td.textContent.trim();
    return;
  }
  if (location.pathname.endsWith('.html') && !document.getElementById('fkKayit')) return;   // diğer çerçeve sayfaları
  // ---- MuhaWin ana pencere ----
  ekle('g54', `
    /* üst bant tek satır: logo · firma · Luca · araçlar */
    header.top{flex-wrap:nowrap!important;gap:10px!important;justify-content:flex-start!important;padding-bottom:0!important;margin-bottom:4px!important;align-items:center!important}
    header.top .sub,header.top .h1mod,.firmbar label.lbl{display:none!important}
    header.top h1{font-size:19px!important;gap:8px!important;white-space:nowrap}
    header.top h1 img,header.top h1 svg{width:28px!important;height:28px!important}
    .firmbar{flex-wrap:nowrap!important;gap:6px!important;align-items:center!important;flex:1;justify-content:flex-end}
    /* modül sekmeleri ve alt sekmeler tek satırda */
    .modsekme{display:flex!important;align-items:flex-end;flex-wrap:nowrap!important}
    .modsekme .fknav{border-bottom:0!important;margin:0 0 0 18px!important;padding-left:18px!important;border-left:1px solid var(--line)!important;display:flex}
    .modsekme .fknav .btn{padding:5px 12px!important;min-height:0!important;font-size:13px!important}
    .firmbar>div{min-width:210px!important}
    .firmbar .btn{min-height:30px!important;padding:0 10px!important;font-size:13px!important;align-self:center!important}
    #firmSel{height:30px;padding:2px 8px}
    #komutBtn kbd,.firmbar .themepick{display:none!important}
    .wrap{padding-block:8px 24px!important}
    /* modül ve alt sekmeler: ince iki satır */
    .modsekme{margin:0!important;min-height:0!important}
    .modsekme .modsek{padding:5px 14px!important;min-height:0!important;font-size:13.5px!important}
    .fknav{margin:0 0 4px!important}
    .fknav .btn{min-height:30px!important;padding:0 12px!important;font-size:13px!important}
    /* Luca'ya kaydet: başlık ve tek satır araç çubuğu, süzgeç satırı kapalı */
    #fkKayit .mmtop{padding-top:6px!important;padding-bottom:6px!important;gap:8px!important;flex-wrap:nowrap!important}
    #fkkHead{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0;flex:0 1 auto}
    #fkkCekYer{display:flex!important;flex-wrap:nowrap!important;gap:6px}#fkkCekYer .btn{white-space:nowrap}
    #fkKayit .mmtop label.note{display:flex;align-items:center;gap:6px;white-space:nowrap}#fkkGrup{width:150px!important}
    #fkKayit .mmtop h2{font-size:16px!important;white-space:nowrap}
    #fkKayit .mmbar{padding-top:6px!important;padding-bottom:6px!important;gap:6px!important;flex-wrap:nowrap!important;overflow:hidden}
    #fkKayit .mmbar input[type=search]{min-width:170px!important;width:190px!important}
    #fkkBar>.mmtabs[title="Kurala göre süz"],#fkkBosDoldur,#fkkSecHepsi,#fkkSecYok,#fkkSecHaric,#fkkKurallar,#fkkBar .dmenu,#fkkBar label.note,#fkkBar>span[style*="flex:1"]{display:none!important}
    #fkKayit thead tr.flt{display:none}
    #fkKayit td{padding-top:4px!important;padding-bottom:4px!important}
    #fkKayit td.fk-karsi>.note:last-child:not(:nth-child(2)){display:none}
    #fkKayit td.fk-hesap .chip,#fkKayit td.fk-hesap .fkk-ksl,#fkKayit td.fk-hesap>div.note:not(:last-of-type){display:none}
    #fkKayit td.fk-hesap,#fkKayit td.fk-cari{white-space:nowrap}
    #fkKayit td.fk-hesap input,#fkKayit td.fk-cari input{width:76px!important;vertical-align:middle}
    #fkKayit td.fk-hesap>.note,#fkKayit td.fk-cari>.note{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:88px;display:inline-block!important;vertical-align:middle;margin-left:6px;-webkit-line-clamp:unset!important}
    #fkKayit td.fk-hesap>.chip+div.note{display:none!important}
    #fkKayit td.fk-karsi>b,#fkKayit td.fk-karsi>.note{max-width:160px!important}
    #fkKayit td,#fkKayit thead th{padding-left:6px!important;padding-right:6px!important}
    #fkKayit thead th{white-space:normal!important;line-height:1.2}
    #fkKayit td.fk-cari .chip{display:none}
    #fkKayit td input{height:24px!important}
    #fkKayit td{line-height:1.25}
    #fkKayit td.fk-yon .note,#fkKayit td.fk-durum .note{display:none}
    #fkKayit .fk-isler{display:flex!important;gap:2px}
    #fkKayit .fk-isler .btn:not(:first-child){display:none}
    #fkKayit .fk-isler::after{content:"⋯";display:inline-grid;place-items:center;width:28px;height:26px;border:1px solid var(--line);border-radius:7px;font-weight:700}
    /* Mizan / Muavin: tek satır araç çubuğu, açıklama tek satır */
    #mmPanel .mmtop{padding-top:6px!important;padding-bottom:6px!important}
    #mmPanel .mmtop h2{font-size:16px!important}
    #mmPanel .mmbar{padding-top:4px!important;padding-bottom:6px!important;gap:6px!important;flex-wrap:nowrap!important;overflow:hidden}
    #mmBar>label.note:first-child,#mmFirm{display:none!important}
    #mmBar [data-mmcek],#mmBar #mmYukle,#mmBar .g54-gizle{display:none!important}
    #mmPanel #mmPdf{display:none!important}
    #mmTable td{padding-top:4px!important;padding-bottom:4px!important;white-space:nowrap;max-width:260px;overflow:hidden;text-overflow:ellipsis}
    #mmTable thead tr:nth-child(2){display:none}
    /* Banka: özet tek satır, süzgeç satırı kapalı, satır işlemleri "⋯" menüsünde */
    .stat{display:flex!important;align-items:baseline;gap:8px;padding:6px 12px!important}
    .stat .v{font-size:15px!important;margin:0!important}
    .tablewrap thead tr.frow{display:none}
    .rowbtns .btn:not(:first-child){display:none}
    .rowbtns::after{content:"⋯";display:inline-grid;place-items:center;width:28px;height:28px;border:1px solid var(--line);border-radius:7px;font-weight:700}
    td.desc{min-width:0}
    .accin input{width:100px!important}.accname{display:inline-block;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;vertical-align:middle}
    td.bankcol{max-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  `);
  // alt sekmeleri modül sekmelerinin yanına al; uzun düğme adlarını kısalt
  for (const b of document.querySelectorAll('#fkKayit .fk-isler [data-pdf]')) { b.textContent = '📄'; b.style.padding = '0 6px'; }
  const ms = document.getElementById('modSekme'), fn = document.getElementById('fkNav');
  if (ms && fn && fn.parentElement !== ms && ms.offsetParent) ms.appendChild(fn);
  for (const [id, ad] of [['mmBtn', '☷ Mizan / Muavin'], ['ayarlarBtn', 'Ayarlar']]) { const b = document.getElementById(id); if (b) b.textContent = ad; }
  // "Diğer ▾" menüleri (taslakta yalnız düğme)
  const fb = document.getElementById('fkkBar'); if (fb && fb.offsetParent) digerMenu(fb, [...fb.querySelectorAll('#fkkBosDoldur,#fkkSecHepsi,#fkkSecYok,#fkkKurallar,#fkkKod')]);
  if (fb && fb.offsetParent && !fb.querySelector('.g54-suz')) { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn small g54-suz'; b.textContent = 'Süzgeç ▾'; fb.insertBefore(b, fb.querySelector('.g54-diger')); }
  const mb = document.getElementById('mmBar');
  if (mb && mb.offsetParent) { for (const b of mb.querySelectorAll('button')) if (/Excel'den/i.test(b.textContent)) b.classList.add('g54-gizle'); digerMenu(mb, [...mb.querySelectorAll('[data-mmcek],.g54-gizle')]); }
  const mt = document.querySelector('#mmPanel .mmtop'); if (mt && mt.offsetParent) for (const b of mt.querySelectorAll('button')) if (/PDF/i.test(b.textContent)) b.style.display = 'none';
  for (const td of document.querySelectorAll('#mmTable td')) if (!td.title && td.textContent.length > 30) td.title = td.textContent.trim();
  if (window.G54_OLC) { const de = document.documentElement; let en = null, enR = de.clientWidth;
    for (const x of document.querySelectorAll('body *')) { const r = x.getBoundingClientRect(); if (r.width && r.right > enR + 1 && x.getClientRects().length) { enR = r.right; en = x; } }
    return 'G54 ' + [...document.querySelectorAll('.tablewrap,#fkKayit .mmwrap,#mmPanel .mmwrap')].filter(x => x.getClientRects().length).map(x => x.className + ':' + x.scrollWidth + '/' + x.clientWidth).join(' ') + ' ' + location.pathname + ' sw=' + de.scrollWidth + ' cw=' + de.clientWidth + ' en=' + (en ? en.tagName + '#' + en.id + '.' + en.className + ' ' + Math.round(enR) : '-') + ' firmbar=' + [...document.querySelectorAll('.firmbar>*')].map(x => (x.id || x.className) + ':' + Math.round(x.getBoundingClientRect().left) + '-' + Math.round(x.getBoundingClientRect().right)).join(','); }
  return '';
})()
